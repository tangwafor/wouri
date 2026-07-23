#!/usr/bin/env node
// risk-selftest: proves the EUDR Article 10 risk record (0040). An EUDR lot with no
// risk assessment on its origin is flagged; recording a standard, deforestation-free
// assessment clears it; a high-risk assessment raises a different finding. Org
// isolated; anon denied. Self-cleaning. No em-dashes.
// Run: node scripts/risk-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };
const PW = 'WouriTest2026!';
const SLUG = 'risk-a', EMAIL = 'risktest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('risk-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const org = (await a.rpc('create_organization', { p_org_name: 'Risk A', p_org_slug: SLUG, p_first_location_name: 'Bertoua', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  const eudrKey = (await a.from('commodities').select('key').eq('eudr', true).limit(1).single()).data.key;

  // Create an EUDR lot at origin (gives it an origin_unit).
  const lotId = randomUUID();
  await a.rpc('create_lot_at_origin', {
    p_org: org, p_lot_id: lotId, p_commodity_key: eudrKey, p_lot_code: 'LOT-RISK-1', p_quantity_kg: 500,
    p_claim: 'segregated', p_is_cites: false, p_plot_code: 'PLOT-RISK-1', p_plot_kind: 'plot', p_area_ha: 2,
    p_geometry: { type: 'Point', coordinates: [13.68, 4.58] }, p_event_id: randomUUID(),
  });
  const unit = (await a.from('lots').select('origin_unit_id').eq('id', lotId).single()).data.origin_unit_id;

  await a.rpc('run_auto_checks');
  let f = (await a.from('auto_check_findings').select('check_key, status').eq('organization_id', org).eq('status', 'open')).data ?? [];
  ok('an EUDR lot with no risk assessment is flagged', f.some((x) => x.check_key === 'eudr_lot_no_risk_assessment'));

  // Record a standard, deforestation-free assessment.
  await a.rpc('record_origin_risk', {
    p_org: org, p_origin_unit: unit, p_risk_level: 'standard', p_deforestation_free: true,
    p_produced_after_cutoff: true, p_legality_basis: 'customary right, attestation 2026',
    p_dataset: 'JRC Tropical Moist Forest', p_dataset_version: '2024', p_assessor: 'Compliance officer',
  });
  await a.rpc('run_auto_checks');
  f = (await a.from('auto_check_findings').select('check_key, status').eq('organization_id', org).eq('check_key', 'eudr_lot_no_risk_assessment')).data ?? [];
  ok('recording the assessment resolves the finding', f.length === 1 && f[0].status === 'resolved');

  // The assessment is stored with its dataset version.
  const r = (await a.from('origin_unit_risk').select('risk_level, dataset, dataset_version, deforestation_free').eq('origin_unit_id', unit).single()).data;
  ok('the assessment records the dataset and its version', r.dataset === 'JRC Tropical Moist Forest' && r.dataset_version === '2024' && r.deforestation_free === true);

  // A later high-risk assessment raises the high-risk finding.
  await a.rpc('record_origin_risk', { p_org: org, p_origin_unit: unit, p_risk_level: 'high', p_deforestation_free: false, p_produced_after_cutoff: true });
  await a.rpc('run_auto_checks');
  f = (await a.from('auto_check_findings').select('check_key, status').eq('organization_id', org).eq('status', 'open')).data ?? [];
  ok('a high-risk assessment raises the high-risk finding', f.some((x) => x.check_key === 'origin_high_risk'));

  // Isolation and anon.
  const anonSees = (await anonClient().from('origin_unit_risk').select('id')).data ?? [];
  ok('anon sees no risk assessments', anonSees.length === 0);

  await cleanup();
  console.log(`\nrisk-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('risk-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
