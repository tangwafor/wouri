#!/usr/bin/env node
// spatial-selftest: proves the server decides the plot (0035). The headline: a
// client declares a small area but supplies a large polygon, and the server
// computes the real area and overrides the claim. Then the four spatial fraud
// checks fire: a point declared over the cap, a self-intersecting polygon, an
// overlap with another plot, and a plot inside a protected area. Self-cleaning.
// No em-dashes.
// Run: node scripts/spatial-selftest.mjs
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
const SLUG = 'geo-a', EMAIL = 'geotest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const poly = (l0, t0, l1, t1) => ({ type: 'Polygon', coordinates: [[[l0, t0], [l1, t0], [l1, t1], [l0, t1], [l0, t0]]] });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  await pgc.query("delete from protected_areas where name='TEST-PA'").catch(() => {});
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

async function newLot(a, org, code, plot, areaDeclared, geometry) {
  return a.rpc('create_lot_at_origin', {
    p_org: org, p_lot_id: randomUUID(), p_commodity_key: 'cocoa', p_lot_code: code, p_quantity_kg: 500,
    p_claim: 'segregated', p_is_cites: false, p_plot_code: plot, p_plot_kind: 'plot',
    p_area_ha: areaDeclared, p_geometry: geometry, p_event_id: randomUUID(),
  });
}

try {
  console.log('spatial-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const org = (await a.rpc('create_organization', { p_org_name: 'Geo A', p_org_slug: SLUG, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;

  // Headline: declare 3.9 ha but hand over a ~11 ha polygon. Server computes the truth.
  await newLot(a, org, 'GEO-P1', 'PLOT-P1', 3.9, poly(9.700, 4.050, 9.703, 4.053));
  const p1 = (await pgc.query("select area_ha, declared_area_ha, computed_area_ha, geometry_kind from origin_unit_versions ouv join origin_units u on u.id=ouv.origin_unit_id where u.code='PLOT-P1'")).rows[0];
  ok('server computes the polygon area', Number(p1.computed_area_ha) > 4);
  ok('the authoritative area is the server area, not the client claim', Math.abs(Number(p1.area_ha) - Number(p1.computed_area_ha)) < 0.001 && Number(p1.area_ha) > 4);
  ok('the client claim is kept only as declared (advisory)', Number(p1.declared_area_ha) === 3.9);
  ok('the geometry kind is a polygon', p1.geometry_kind === 'polygon');

  // A point declared over the cap.
  await newLot(a, org, 'GEO-P2', 'PLOT-P2', 9, { type: 'Point', coordinates: [9.800, 4.100] });
  // A self-intersecting bowtie polygon.
  await newLot(a, org, 'GEO-P3', 'PLOT-P3', 1, { type: 'Polygon', coordinates: [[[9.900, 4.200], [9.901, 4.201], [9.901, 4.200], [9.900, 4.201], [9.900, 4.200]]] });
  // Two overlapping polygons.
  await newLot(a, org, 'GEO-P4A', 'PLOT-P4A', 5, poly(10.000, 4.300, 10.002, 4.302));
  await newLot(a, org, 'GEO-P4B', 'PLOT-P4B', 5, poly(10.001, 4.301, 10.003, 4.303));
  // A protected area covering P1.
  await pgc.query(`insert into protected_areas (name, geom, source) values ('TEST-PA', st_setsrid(st_geomfromgeojson($1), 4326)::geography, 'test')`, [JSON.stringify(poly(9.699, 4.049, 9.704, 4.054))]);

  await a.rpc('run_auto_checks');
  const findings = (await a.from('auto_check_findings').select('check_key, status, detail').eq('organization_id', org).eq('status', 'open')).data ?? [];
  const has = (k) => findings.some((f) => f.check_key === k);
  ok('a point over the cap is flagged', has('origin_point_over_cap'));
  ok('a self-intersecting polygon is flagged', has('origin_self_intersecting'));
  ok('an overlapping plot is flagged', has('origin_overlaps_another'));
  ok('a plot inside a protected area is flagged', has('origin_in_protected_area'));

  await cleanup();
  console.log(`\nspatial-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('spatial-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
