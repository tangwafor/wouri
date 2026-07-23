#!/usr/bin/env node
// org-groups-selftest: proves the tenant-of-tenants skeleton (0031). A coordinator
// creates a group and invites another org; membership is only active after the
// invited org's own admin consents; nobody is added by force; a third org sees
// nothing. Self-cleaning. No em-dashes.
// Run: node scripts/org-groups-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };
const PW = 'WouriTest2026!';
const ORGS = [['grp-a', 'grptest+a@wouri.test'], ['grp-b', 'grptest+b@wouri.test'], ['grp-c', 'grptest+c@wouri.test']];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  for (const [slug] of ORGS) { try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [slug]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); } }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (ORGS.some(([, e]) => e === u.email)) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn(email) { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('org-groups-selftest: begin');
  await pgc.connect();
  await cleanup();
  const cli = {}, org = {};
  for (const [slug, email] of ORGS) {
    await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    cli[slug] = await signedIn(email);
    org[slug] = (await cli[slug].rpc('create_organization', { p_org_name: slug.toUpperCase(), p_org_slug: slug, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  }

  // A creates a group.
  const group = (await cli['grp-a'].rpc('create_organization_group', { p_owner_org: org['grp-a'], p_name: 'Cocoa Union', p_kind: 'cooperative_union' })).data;
  ok('coordinator creates a group', typeof group === 'string');

  // A invites B. B is invited, not active.
  await cli['grp-a'].rpc('invite_org_to_group', { p_group: group, p_org: org['grp-b'] });
  let bRow = (await cli['grp-b'].from('organization_group_members').select('status').eq('group_id', group).eq('organization_id', org['grp-b']).maybeSingle()).data;
  ok('an invited org sees its pending invitation', bRow?.status === 'invited');

  // B cannot be forced active by A: A cannot accept on B's behalf.
  const forced = await cli['grp-a'].rpc('accept_group_membership', { p_group: group, p_org: org['grp-b'] });
  ok('the coordinator cannot accept on the member behalf (consent required)', !!forced.error);

  // B consents itself.
  const accept = await cli['grp-b'].rpc('accept_group_membership', { p_group: group, p_org: org['grp-b'] });
  ok('the member org admin accepts its own membership', !accept.error);
  bRow = (await cli['grp-b'].from('organization_group_members').select('status, consented_at').eq('group_id', group).eq('organization_id', org['grp-b']).single()).data;
  ok('membership becomes active with a consent timestamp', bRow.status === 'active' && !!bRow.consented_at);

  // B can see the group it belongs to.
  const bSeesGroup = (await cli['grp-b'].from('organization_groups').select('id, name').eq('id', group)).data ?? [];
  ok('a member org sees the group', bSeesGroup.length === 1);

  // C (not a member) sees neither the group nor its membership.
  const cSeesGroup = (await cli['grp-c'].from('organization_groups').select('id').eq('id', group)).data ?? [];
  const cSeesMembers = (await cli['grp-c'].from('organization_group_members').select('organization_id').eq('group_id', group)).data ?? [];
  ok('a non-member org sees neither the group nor its membership', cSeesGroup.length === 0 && cSeesMembers.length === 0);

  // Anon sees nothing.
  const anonSees = (await anonClient().from('organization_groups').select('id')).data ?? [];
  ok('anon sees no groups', anonSees.length === 0);

  // A non-admin cannot create a group for an org it does not administer.
  const notAdmin = await cli['grp-c'].rpc('create_organization_group', { p_owner_org: org['grp-a'], p_name: 'Hijack', p_kind: 'holding' });
  ok('a non-admin cannot create a group for another org', !!notAdmin.error);

  await cleanup();
  console.log(`\norg-groups-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('org-groups-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
