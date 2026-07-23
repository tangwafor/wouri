#!/usr/bin/env node
// autochecks-selftest: proves the SQL agentic auto-check engine. A shipment sails
// with no settlement instrument, so the runner opens a finding and drops a
// notification; recording the settlement instrument makes the next run auto-resolve
// it. Self-cleaning. No em-dashes.
// Run: node scripts/autochecks-selftest.mjs
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
const SLUG = 'autochk-a', EMAIL = 'autochktest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query("delete from organizations where slug=$1", [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  await pgc.query("delete from auto_check_findings where detail like '%CN-AC1%' or detail like '%CN-AC1%'").catch(() => {});
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('autochecks-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const orgA = (await a.rpc('create_organization', { p_org_name: 'AutoChk A', p_org_slug: SLUG, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-AC1', destination_country: 'DE' }).select().single()).data;
  const sh = (await a.from('shipments').insert({ organization_id: orgA, consignment_id: con.id, etd: '2026-08-01', eta: '2026-09-01' }).select().single()).data;

  // The seed checks exist.
  const checks = (await pgc.query('select key from auto_checks order by key')).rows.map((r) => r.key);
  ok('seed auto-checks are installed', checks.includes('shipped_without_settlement') && checks.includes('eu_consignment_no_dds'));

  // Sail the shipment with no settlement instrument recorded.
  await a.rpc('shipment_advance', { p_shipment: sh.id, p_to: 'loaded' });
  await a.rpc('shipment_advance', { p_shipment: sh.id, p_to: 'sailed' });

  // Run the engine (definer, sweeps all orgs; we read back our own).
  const run1 = await a.rpc('run_auto_checks');
  ok('run_auto_checks returns without error', !run1.error);

  let findings = (await a.from('auto_check_findings').select('check_key, status, detail, entity_id').eq('organization_id', orgA)).data ?? [];
  ok('a finding is opened for the sailed shipment with no settlement', findings.some((f) => f.check_key === 'shipped_without_settlement' && f.status === 'open'));
  ok('an EU consignment finding is NOT opened yet (no document issued)', !findings.some((f) => f.check_key === 'eu_consignment_no_dds'));

  // The finding produced a notification for the org.
  const notes = (await a.from('notifications').select('kind, title').eq('organization_id', orgA).eq('kind', 'auto_check')).data ?? [];
  ok('the auto-check dropped a notification', notes.length >= 1);

  // Running again does not duplicate the finding (fingerprint dedup).
  await a.rpc('run_auto_checks');
  findings = (await a.from('auto_check_findings').select('check_key, status').eq('organization_id', orgA).eq('check_key', 'shipped_without_settlement')).data ?? [];
  ok('a second run does not duplicate the finding', findings.length === 1);

  // Record the settlement instrument; the clock can now run.
  await a.from('settlement_instruments').insert({ organization_id: orgA, consignment_id: con.id, kind: 'lc', currency: 'EUR', amount_minor: 5000000, incoterm: 'FOB', export_date: '2026-08-05', region: 'CEMAC' });

  // Next run auto-resolves the finding.
  await a.rpc('run_auto_checks');
  findings = (await a.from('auto_check_findings').select('status').eq('organization_id', orgA).eq('check_key', 'shipped_without_settlement')).data ?? [];
  ok('recording the settlement instrument auto-resolves the finding', findings.length === 1 && findings[0].status === 'resolved');

  // A tenant member cannot read the check SQL (platform-admin gated).
  const canReadSql = (await a.from('auto_checks').select('key, query')).data ?? [];
  ok('a tenant member cannot read the auto-check SQL', canReadSql.length === 0);

  // Anon sees nothing.
  const anonFindings = (await anonClient().from('auto_check_findings').select('id')).data ?? [];
  ok('anon reads no findings', anonFindings.length === 0);

  await cleanup();
  console.log(`\nautochecks-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('autochecks-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
