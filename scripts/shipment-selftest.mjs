#!/usr/bin/env node
// shipment-selftest: proves shipment tracking. The milestones advance in order,
// they mirror the consignment status, a departure closing in and an overdue
// arrival surface on the readiness board, and RLS isolates. Self-cleaning. No em-dashes.
// Run: node scripts/shipment-selftest.mjs
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
const SLUGS = ['ship-a', 'ship-b'];
const EMAILS = ['shiptest+a@wouri.test', 'shiptest+b@wouri.test'];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug = any($1)', [SLUGS]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (EMAILS.includes(u.email ?? '')) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn(email) { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('shipment-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAILS[0], password: PW, email_confirm: true });
  await admin.auth.admin.createUser({ email: EMAILS[1], password: PW, email_confirm: true });
  const a = await signedIn(EMAILS[0]); const b = await signedIn(EMAILS[1]);
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Ship A', p_org_slug: SLUGS[0], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  await b.rpc('create_organization', { p_org_name: 'Ship B', p_org_slug: SLUGS[1], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });

  // CN-1: full lifecycle, ETA in the future.
  const con1 = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-SH1', destination_country: 'DE' }).select().single()).data;
  const sh1 = (await a.from('shipments').insert({ organization_id: orgA, consignment_id: con1.id, carrier: 'Maersk', vessel: 'MV Douala', port_loading: 'Douala', port_discharge: 'Antwerp', etd: day(2), eta: day(30) }).select().single()).data;

  const skip = await a.rpc('shipment_advance', { p_shipment: sh1.id, p_to: 'sailed' });
  ok('cannot sail before loaded', !!skip.error);
  ok('load succeeds from booked', !(await a.rpc('shipment_advance', { p_shipment: sh1.id, p_to: 'loaded' })).error);
  ok('loading marks the consignment ready', (await a.from('consignments').select('status').eq('id', con1.id).single()).data.status === 'ready');
  ok('sail succeeds from loaded', !(await a.rpc('shipment_advance', { p_shipment: sh1.id, p_to: 'sailed' })).error);
  ok('sailing marks the consignment shipped', (await a.from('consignments').select('status').eq('id', con1.id).single()).data.status === 'shipped');
  ok('arrive then clear succeed in order',
    !(await a.rpc('shipment_advance', { p_shipment: sh1.id, p_to: 'arrived' })).error &&
    !(await a.rpc('shipment_advance', { p_shipment: sh1.id, p_to: 'cleared' })).error);

  // CN-2: departure closing in (ETD within 7 days, still booked).
  const con2 = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-SH2', destination_country: 'DE' }).select().single()).data;
  await a.from('shipments').insert({ organization_id: orgA, consignment_id: con2.id, etd: day(3), eta: day(40) });

  // CN-3: arrival overdue (ETA in the past, sailed not arrived).
  const con3 = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-SH3', destination_country: 'DE' }).select().single()).data;
  const sh3 = (await a.from('shipments').insert({ organization_id: orgA, consignment_id: con3.id, etd: day(-20), eta: day(-3), status: 'sailed' }).select().single()).data;

  const board = (await a.from('readiness_board').select('kind, consignment_code').in('kind', ['shipment_etd_soon', 'shipment_overdue'])).data ?? [];
  ok('a departure closing in shows on the board', board.some((r) => r.kind === 'shipment_etd_soon' && r.consignment_code === 'CN-SH2'));
  ok('an overdue arrival shows on the board', board.some((r) => r.kind === 'shipment_overdue' && r.consignment_code === 'CN-SH3'));

  // RLS
  ok('tenant B cannot see A shipments', ((await b.from('shipments').select('id').eq('organization_id', orgA)).data ?? []).length === 0);

  await cleanup();
  console.log(`\nshipment-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('shipment-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
