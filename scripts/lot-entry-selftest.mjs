#!/usr/bin/env node
// lot-entry-selftest: proves a tenant can enter the custody chain at either point.
// at_origin creates the plot (with a polygon) + the harvest event; post_harvest
// creates the lot from a supplier with the receipt event. An EUDR lot with no
// plot geolocation is never blocked, it surfaces on the readiness board as an
// origin gap; a non-EUDR lot does not. RLS isolates. Self-cleaning. No em-dashes.
// Run: node scripts/lot-entry-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };
const PW = 'WouriTest2026!';
const SLUGS = ['lot-a', 'lot-b'];
const EMAILS = ['lottest+a@wouri.test', 'lottest+b@wouri.test'];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const POLY = { type: 'Polygon', coordinates: [[[9.7, 4.1], [9.7, 4.2], [9.8, 4.2], [9.8, 4.1], [9.7, 4.1]]] };

async function cleanup() {
  try {
    await pgc.query('begin'); await pgc.query("set local wouri.purge='on'");
    await pgc.query('delete from organizations where slug = any($1)', [SLUGS]); await pgc.query('commit');
  } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (EMAILS.includes(u.email ?? '')) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn(email) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error('signIn: ' + error.message);
  return c;
}

try {
  console.log('lot-entry-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAILS[0], password: PW, email_confirm: true });
  await admin.auth.admin.createUser({ email: EMAILS[1], password: PW, email_confirm: true });
  const a = await signedIn(EMAILS[0]);
  const b = await signedIn(EMAILS[1]);
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Lot A', p_org_slug: SLUGS[0], p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  await b.rpc('create_organization', { p_org_name: 'Lot B', p_org_slug: SLUGS[1], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });

  // At harvest, with a plot polygon: full origin.
  const lot1 = randomUUID();
  const r1 = await a.rpc('create_lot_at_origin', {
    p_org: orgA, p_lot_id: lot1, p_commodity_key: 'cocoa', p_lot_code: 'LOT-H1', p_quantity_kg: 1000,
    p_claim: 'segregated', p_is_cites: false, p_plot_code: 'PLOT-1', p_plot_kind: 'plot', p_area_ha: 3.5,
    p_geometry: POLY, p_event_id: randomUUID(),
  });
  ok('at_origin lot is created', !r1.error && r1.data === lot1);
  {
    const l = (await a.from('lots').select('origin_mode, origin_unit_id').eq('id', lot1).single()).data;
    ok('at_origin lot has mode at_origin + a plot', l.origin_mode === 'at_origin' && !!l.origin_unit_id);
    const geo = (await a.rpc('lot_has_origin_geo', { p_lot: lot1 })).data;
    ok('at_origin lot has plot geolocation', geo === true);
    const evs = (await a.from('lot_events').select('event_type').eq('lot_id', lot1)).data ?? [];
    ok('the first event is the harvest', evs.length === 1 && evs[0].event_type === 'harvest');
  }

  // At harvest but NO polygon, EUDR commodity: allowed, but flagged as an origin gap.
  const lot2 = randomUUID();
  await a.rpc('create_lot_at_origin', {
    p_org: orgA, p_lot_id: lot2, p_commodity_key: 'cocoa', p_lot_code: 'LOT-NOGEO', p_quantity_kg: 500,
    p_claim: 'segregated', p_is_cites: false, p_plot_code: 'PLOT-2', p_plot_kind: 'plot', p_area_ha: null,
    p_geometry: null, p_event_id: randomUUID(),
  });
  ok('an EUDR lot with no geolocation is still created (not blocked)', (await a.from('lots').select('id').eq('id', lot2)).data?.length === 1);
  {
    const board = (await a.from('readiness_board').select('kind, detail').eq('kind', 'origin_gap')).data ?? [];
    ok('the missing geolocation surfaces as an origin_gap blocker', board.length >= 1);
  }

  // After harvest, from a supplier: chain starts at receipt.
  const lot3 = randomUUID();
  const r3 = await a.rpc('create_lot_post_harvest', {
    p_org: orgA, p_lot_id: lot3, p_commodity_key: 'coffee', p_lot_code: 'LOT-R1', p_quantity_kg: 800,
    p_claim: 'segregated', p_is_cites: false, p_supplier_name: 'Moungo Aggregators', p_supplier_origin_ref: 'coop-cert-887',
    p_event_id: randomUUID(),
  });
  ok('post_harvest lot is created', !r3.error && r3.data === lot3);
  {
    const l = (await a.from('lots').select('origin_mode, supplier_party_id, origin_unit_id').eq('id', lot3).single()).data;
    ok('post_harvest lot has mode post_harvest + a supplier + no plot', l.origin_mode === 'post_harvest' && !!l.supplier_party_id && !l.origin_unit_id);
    const evs = (await a.from('lot_events').select('event_type').eq('lot_id', lot3)).data ?? [];
    ok('the first event is the receipt from the supplier', evs.length === 1 && evs[0].event_type === 'received_from_supplier');
    const party = (await a.from('parties').select('name, kind').eq('id', l.supplier_party_id).single()).data;
    ok('the supplier was recorded as a party', party.kind === 'supplier' && party.name === 'Moungo Aggregators');
  }

  // A non-EUDR post-harvest lot with no geolocation is NOT an origin gap.
  const lot4 = randomUUID();
  await a.rpc('create_lot_post_harvest', {
    p_org: orgA, p_lot_id: lot4, p_commodity_key: 'cotton', p_lot_code: 'LOT-COT', p_quantity_kg: 200,
    p_claim: 'segregated', p_is_cites: false, p_supplier_name: 'Garoua Cotton', p_supplier_origin_ref: null,
    p_event_id: randomUUID(),
  });
  {
    const gaps = (await a.from('readiness_board').select('detail, consignment_code').eq('kind', 'origin_gap')).data ?? [];
    ok('the non-EUDR cotton lot is NOT flagged as an origin gap', !gaps.some((g) => g.consignment_code === 'LOT-COT'));
  }

  // RLS: tenant B sees none of A lots.
  ok('tenant B cannot see A lots', ((await b.from('lots').select('id').eq('organization_id', orgA)).data ?? []).length === 0);

  await cleanup();
  console.log(`\nlot-entry-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('lot-entry-selftest error:', e.message);
  await cleanup().catch(() => {});
  fail++;
} finally {
  await pgc.end().catch(() => {});
}
process.exit(fail > 0 ? 1 : 0);
