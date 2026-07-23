#!/usr/bin/env node
// compliance-selftest: proves the compliance gap. A shipment is loaded but the
// BESC/ECTN cargo tracking note was never recorded, so the readiness board flags
// it; recording the note clears it. Self-cleaning. No em-dashes.
// Run: node scripts/compliance-selftest.mjs
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
const SLUG = 'comp-a', EMAIL = 'comptest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query("delete from organizations where slug=$1", [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('compliance-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Comp A', p_org_slug: SLUG, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-C1', destination_country: 'DE' }).select().single()).data;
  const sh = (await a.from('shipments').insert({ organization_id: orgA, consignment_id: con.id, etd: '2026-08-01', eta: '2026-09-01' }).select().single()).data;

  // Load the shipment without a BESC.
  await a.rpc('shipment_advance', { p_shipment: sh.id, p_to: 'loaded' });
  let gaps = (await a.from('readiness_board').select('kind, consignment_code').eq('kind', 'compliance_gap')).data ?? [];
  ok('a loaded shipment with no BESC is flagged on the board', gaps.some((g) => g.consignment_code === 'CN-C1'));

  // Record the cargo tracking note.
  await a.from('consignments').update({ besc_reference: 'ECTN-CM-2026-0001' }).eq('id', con.id);
  gaps = (await a.from('readiness_board').select('kind, consignment_code').eq('kind', 'compliance_gap')).data ?? [];
  ok('recording the BESC clears the compliance gap', !gaps.some((g) => g.consignment_code === 'CN-C1'));

  // The reference is stored on the consignment.
  const c = (await a.from('consignments').select('besc_reference, dds_reference').eq('id', con.id).single()).data;
  ok('the BESC reference is stored', c.besc_reference === 'ECTN-CM-2026-0001');

  await cleanup();
  console.log(`\ncompliance-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('compliance-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
