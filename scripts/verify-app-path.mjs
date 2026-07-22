#!/usr/bin/env node
// verify-app-path.mjs: prove the app's real data path against wouri-dev, exactly as
// the console will use it: the anon key, a Supabase Auth session, the create_organization
// RPC under the user JWT, and RLS. Stronger than the postgres-role self-test because it
// goes through the client and the anon/authenticated JWT. Self-cleaning. No em-dashes.
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.error(`  FAIL ${n}`); } };
const PW = 'WouriTest2026!';

async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) {
    if (u.email?.startsWith('apptest+')) {
      // drop the user's orgs first (cascades), then the user
      await admin.from('organizations').delete().in('slug', ['bakossi-cocoa', 'wouri-timber']);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

async function mkUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user;
}

async function signedIn(email) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return c;
}

try {
  console.log('verify-app-path: begin');
  await cleanup();
  await mkUser('apptest+a@wouri.test');
  await mkUser('apptest+b@wouri.test');

  // Anon (no session) sees nothing.
  {
    const c = anonClient();
    const { data } = await c.from('organizations').select('id');
    ok('anon (no session) sees no organizations', (data?.length ?? 0) === 0);
  }

  // User A signs in and creates a tenant via the RPC, under the user JWT.
  const a = await signedIn('apptest+a@wouri.test');
  const { data: rpcA, error: rpcErrA } = await a.rpc('create_organization', {
    p_org_name: 'Bakossi Cocoa', p_org_slug: 'bakossi-cocoa', p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr',
  });
  ok('A creates a tenant through the client RPC', !rpcErrA && !!rpcA?.organization_id);

  {
    const { data: orgs } = await a.from('organizations').select('slug, status');
    ok('A reads exactly its own org through RLS', orgs?.length === 1 && orgs[0].slug === 'bakossi-cocoa');
    const { data: mem } = await a.from('memberships').select('id');
    ok('A has a membership', (mem?.length ?? 0) === 1);
  }

  // Enable a capability through the client (owner passes the org_caps_write policy).
  {
    const orgId = rpcA.organization_id;
    const { error: capErr } = await a.from('organization_capabilities').insert({ organization_id: orgId, capability_key: 'commodity.cocoa' });
    ok('A (owner) enables a capability through the client', !capErr);
    const { data: cap } = await a.rpc('has_capability', { p_org: orgId, p_cap: 'commodity.cocoa' });
    ok('has_capability reflects it through the client', cap === true);
    const { data: cat } = await a.from('capability_catalog').select('capability_key');
    ok('A inherits the platform capability catalog (9 rows)', cat?.length === 9);
  }

  // User B signs in, creates its own, and cannot see A's.
  const b = await signedIn('apptest+b@wouri.test');
  await b.rpc('create_organization', { p_org_name: 'Wouri Timber', p_org_slug: 'wouri-timber', p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });
  {
    const { data: bOrgs } = await b.from('organizations').select('slug');
    ok('B sees only its own org, not A', bOrgs?.length === 1 && bOrgs[0].slug === 'wouri-timber');
    const { data: aSeesB } = await a.from('organizations').select('slug').eq('slug', 'wouri-timber');
    ok('A cannot see B through the client', (aSeesB?.length ?? 0) === 0);
  }

  // Duplicate slug is refused through the client too.
  {
    const { error: dupErr } = await b.rpc('create_organization', { p_org_name: 'Dup', p_org_slug: 'bakossi-cocoa', p_first_location_name: 'x', p_country: 'CM', p_locale: 'fr' });
    ok('duplicate slug is refused through the client', !!dupErr);
  }

  await cleanup();
  {
    const { data } = await admin.from('organizations').select('slug').in('slug', ['bakossi-cocoa', 'wouri-timber']);
    ok('cleanup removed the test tenants', (data?.length ?? 0) === 0);
  }

  console.log(`\nverify-app-path: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('verify-app-path error:', e.message);
  await cleanup().catch(() => {});
  fail++;
}
process.exit(fail > 0 ? 1 : 0);
