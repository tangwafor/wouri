#!/usr/bin/env node
// transformation-selftest: proves mass balance (0037). A drying step that loses mass
// is accepted and its lineage recorded; a step that outputs more mass than it took
// in is refused and nothing is written; the backstop auto_check flags a mass gain
// written around the RPC. Self-cleaning. No em-dashes.
// Run: node scripts/transformation-selftest.mjs
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
const SLUG = 'xform-a', EMAIL = 'xformtest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }
async function lot(a, org, cocoa, code, kg) {
  return (await a.from('lots').insert({ organization_id: org, commodity_id: cocoa, code, claim: 'segregated', quantity_kg: kg }).select().single()).data;
}

try {
  console.log('transformation-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const org = (await a.rpc('create_organization', { p_org_name: 'Xform A', p_org_slug: SLUG, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data.id;

  // Drying: 1000 kg wet in, 800 kg dry out (loses water). Mass balance holds.
  const wet = await lot(a, org, cocoa, 'WET-1', 1000);
  const dry = await lot(a, org, cocoa, 'DRY-1', 800);
  const tid = randomUUID();
  const good = await a.rpc('record_transformation', {
    p_id: tid, p_org: org, p_kind: 'drying',
    p_inputs: [{ lot_id: wet.id, quantity_kg: 1000 }], p_outputs: [{ lot_id: dry.id, quantity_kg: 800 }],
  });
  ok('a drying step that loses mass is accepted', !good.error);
  const ins = (await a.from('transformation_inputs').select('quantity_kg').eq('transformation_id', tid)).data ?? [];
  const outs = (await a.from('transformation_outputs').select('quantity_kg').eq('transformation_id', tid)).data ?? [];
  ok('the inputs and outputs are recorded', ins.length === 1 && outs.length === 1 && Number(outs[0].quantity_kg) === 800);
  const lin = (await pgc.query('select 1 from lineage where parent_lot_id=$1 and child_lot_id=$2', [wet.id, dry.id])).rowCount;
  ok('the lineage edge from input to output is written', lin === 1);

  // A step that outputs MORE than it took in is refused, and writes nothing.
  const big = await lot(a, org, cocoa, 'BIG-1', 2000);
  const badId = randomUUID();
  const bad = await a.rpc('record_transformation', {
    p_id: badId, p_org: org, p_kind: 'milling',
    p_inputs: [{ lot_id: dry.id, quantity_kg: 800 }], p_outputs: [{ lot_id: big.id, quantity_kg: 2000 }],
  });
  ok('a step that creates mass is refused', !!bad.error && /mass balance/i.test(bad.error.message));
  const wrote = (await pgc.query('select 1 from transformations where id=$1', [badId])).rowCount;
  ok('the refused transformation wrote nothing', wrote === 0);

  // Backstop: write a mass-gain transformation directly (around the RPC) and let the
  // auto_check catch it.
  const gainId = randomUUID();
  await pgc.query('insert into transformations (id, organization_id, kind) values ($1,$2,$3)', [gainId, org, 'milling']);
  await pgc.query('insert into transformation_inputs (transformation_id, lot_id, quantity_kg, organization_id) values ($1,$2,100,$3)', [gainId, dry.id, org]);
  await pgc.query('insert into transformation_outputs (transformation_id, lot_id, quantity_kg, organization_id) values ($1,$2,500,$3)', [gainId, big.id, org]);
  await a.rpc('run_auto_checks');
  const findings = (await a.from('auto_check_findings').select('check_key, entity_id, status').eq('organization_id', org).eq('check_key', 'transformation_mass_gain').eq('status', 'open')).data ?? [];
  ok('the backstop auto_check flags a mass gain written around the RPC', findings.some((f) => f.entity_id === gainId));

  // Anon sees no transformation rows.
  const anonSees = (await anonClient().from('transformation_inputs').select('lot_id')).data ?? [];
  ok('anon sees no transformation inputs', anonSees.length === 0);

  await cleanup();
  console.log(`\ntransformation-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('transformation-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
