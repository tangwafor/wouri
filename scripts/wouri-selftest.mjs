#!/usr/bin/env node
// wouri-selftest.mjs: the Sprint 0 machine self-test. Proves RLS deny-by-default,
// the atomic org-signup, and tenant isolation, probing as the REAL roles (anon and
// authenticated with a jwt sub), never as postgres. Every negative has a positive
// control. Self-cleaning. No em-dashes.
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local' });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  PASS ${name}`); } else { fail++; console.error(`  FAIL ${name}`); } };

// Run a block as a given persona (anon, or authenticated with a sub).
async function as(persona, sub, fn) {
  await c.query('reset role');
  if (persona === 'authenticated') {
    await c.query(`select set_config('request.jwt.claims', $1, false)`,
      [JSON.stringify({ sub, role: 'authenticated' })]);
    await c.query('set role authenticated');
  } else {
    await c.query(`select set_config('request.jwt.claims', '', false)`);
    await c.query('set role anon');
  }
  try { return await fn(); } finally { await c.query('reset role'); }
}
const count = async (sql, params = []) => Number((await c.query(sql, params)).rows[0].n);
const denied = async (fn) => { try { await fn(); return false; } catch { return true; } };

try {
  console.log('wouri-selftest: begin');
  // Fresh test users (fire the people trigger). Clean any prior run first:
  // drop the test orgs (cascades their events, locations, memberships), then the users.
  await c.query(`delete from organizations where slug in ('kumba-cocoa','douala-timber')`);
  await c.query(`delete from auth.users where email like 'selftest+%@wouri.test'`);
  const mk = async (email) => (await c.query(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
     values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),'authenticated','authenticated',$1,'',now(),now(),now())
     returning id`, [email])).rows[0].id;
  const userA = await mk('selftest+a@wouri.test');
  const userB = await mk('selftest+b@wouri.test');
  ok('trigger created a people row for each signup',
     await count('select count(*)::int n from people where auth_user_id = any($1)', [[userA, userB]]) === 2);

  // 1. anon sees nothing (permission denied or 0 rows both count as "nothing").
  await as('anon', null, async () => {
    ok('anon cannot read organizations', await denied(() => c.query('select 1 from organizations')) ||
       await count('select count(*)::int n from organizations') === 0);
    ok('anon cannot read people', await denied(() => c.query('select 1 from people')) ||
       await count('select count(*)::int n from people') === 0);
  });

  // 2. authenticated with no org sees no organizations (positive control comes next).
  await as('authenticated', userA, async () => {
    ok('authenticated with no membership sees 0 organizations',
       await count('select count(*)::int n from organizations') === 0);
  });

  // 3. atomic org-signup as user A.
  let orgA;
  await as('authenticated', userA, async () => {
    const r = await c.query(`select create_organization('Kumba Cocoa','kumba-cocoa','Kumba','CM','fr') j`);
    orgA = r.rows[0].j.organization_id;
    ok('create_organization returned an org id', !!orgA);
    ok('A now sees exactly its own org', await count('select count(*)::int n from organizations') === 1);
    ok('the org has one location', await count('select count(*)::int n from locations') === 1);
    ok('A has an owner membership', await count(
      `select count(*)::int n from memberships m join role_assignments ra on ra.membership_id=m.id
       join roles r on r.id=ra.role_id where r.key='owner'`) === 1);
  });

  // 4. atomic guarantee: a duplicate slug fails and leaves nothing partial.
  await as('authenticated', userB, async () => {
    ok('duplicate slug is refused', await denied(() =>
      c.query(`select create_organization('Dup','kumba-cocoa','x','CM','fr')`)));
    // B still has no org (the failed call created nothing)
    ok('the failed signup created no partial org for B',
       await count('select count(*)::int n from organizations') === 0);
    const r = await c.query(`select create_organization('Douala Timber','douala-timber','Douala','CM','fr') j`);
    ok('a fresh slug succeeds (positive control)', !!r.rows[0].j.organization_id);
  });

  // 5. tenant isolation: A cannot see B and B cannot see A.
  await as('authenticated', userA, async () => {
    ok('A sees only its own org, not B', await count(
      `select count(*)::int n from organizations where slug='douala-timber'`) === 0
      && await count(`select count(*)::int n from organizations where slug='kumba-cocoa'`) === 1);
  });
  await as('authenticated', userB, async () => {
    ok('B sees only its own org, not A', await count(
      `select count(*)::int n from organizations where slug='kumba-cocoa'`) === 0
      && await count(`select count(*)::int n from organizations where slug='douala-timber'`) === 1);
  });

  // 6. capability read + gating helper.
  await as('authenticated', userA, async () => {
    await c.query(`insert into organization_capabilities (organization_id, capability_key)
                   values ($1,'commodity.cocoa') on conflict do nothing`, [orgA]);
    ok('has_capability reflects the enabled capability',
       (await c.query('select has_capability($1,$2) b', [orgA, 'commodity.cocoa'])).rows[0].b === true);
    ok('has_capability is false for a capability not enabled',
       (await c.query('select has_capability($1,$2) b', [orgA, 'rail.cites'])).rows[0].b === false);
    ok('the capability catalog is inherited (14 rows readable)',
       await count('select count(*)::int n from capability_catalog') === 14);
    ok('reference currencies are inherited', await count('select count(*)::int n from currencies') >= 5);
  });

  // 7. event spine recorded the org creation, and is append-only (no delete grant path here).
  await as('authenticated', userA, async () => {
    ok('org.created was recorded on the event spine',
       await count(`select count(*)::int n from org_events where kind='org.created'`) >= 1);
  });

  // Cleanup: orgs first (cascades events), then the users.
  await c.query('reset role');
  await c.query(`delete from organizations where slug in ('kumba-cocoa','douala-timber')`);
  await c.query(`delete from auth.users where email like 'selftest+%@wouri.test'`);
  ok('cleanup removed the test tenants (cascade)',
     await count(`select count(*)::int n from organizations where slug in ('kumba-cocoa','douala-timber')`) === 0);

  console.log(`\nwouri-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('selftest error:', e.message);
  await c.query('reset role').catch(() => {});
  await c.query(`delete from organizations where slug in ('kumba-cocoa','douala-timber')`).catch(() => {});
  await c.query(`delete from auth.users where email like 'selftest+%@wouri.test'`).catch(() => {});
  fail++;
} finally {
  await c.end();
}
process.exit(fail > 0 ? 1 : 0);
