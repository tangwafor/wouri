#!/usr/bin/env node
// polygon-selftest: proves the field boundary-walk polygon (apps/field/lib/polygon).
// The pure builder closes the ring and estimates area; then a walked boundary is sent
// through create_lot_at_origin and the SERVER-computed area matches the field
// estimate, so the whole field-to-server EUDR polygon path works even though Expo
// cannot build on Windows. Self-cleaning. No em-dashes.
// Run: node scripts/polygon-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { buildRing, ringAreaHa, isClosable } from '../apps/field/lib/polygon.mjs';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };
const PW = 'WouriTest2026!';
const SLUG = 'poly-a', EMAIL = 'polytest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('polygon-selftest: begin');

  // Pure builder (no DB): a walked boundary of corners.
  const corners = [
    { lat: 4.050, lng: 9.700 }, { lat: 4.050, lng: 9.703 },
    { lat: 4.053, lng: 9.703 }, { lat: 4.053, lng: 9.700 },
  ];
  ok('fewer than 3 corners is not closable', !isClosable([corners[0], corners[1]]));
  ok('3+ corners is closable', isClosable(corners));
  const ring = buildRing(corners);
  ok('buildRing returns a GeoJSON Polygon', ring.type === 'Polygon' && Array.isArray(ring.coordinates[0]));
  ok('the ring is closed (first point repeated last)', JSON.stringify(ring.coordinates[0][0]) === JSON.stringify(ring.coordinates[0][ring.coordinates[0].length - 1]));
  const estimate = ringAreaHa(corners);
  ok('the field area estimate is sane (about 11 ha)', estimate > 9 && estimate < 13);

  // Round-trip: send the walked boundary through the same RPC the field app uses.
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const org = (await a.rpc('create_organization', { p_org_name: 'Poly A', p_org_slug: SLUG, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;

  const lotId = randomUUID();
  const res = await a.rpc('create_lot_at_origin', {
    p_org: org, p_lot_id: lotId, p_commodity_key: 'cocoa', p_lot_code: 'POLY-LOT-1', p_quantity_kg: 500,
    p_claim: 'segregated', p_is_cites: false, p_plot_code: 'POLY-PLOT-1', p_plot_kind: 'plot',
    p_area_ha: Number(estimate.toFixed(3)),      // the field estimate, advisory
    p_geometry: buildRing(corners), p_event_id: randomUUID(),
  });
  ok('a walked boundary is accepted by create_lot_at_origin', !res.error);

  const v = (await pgc.query("select area_ha, declared_area_ha, computed_area_ha, geometry_kind from origin_unit_versions ouv join origin_units u on u.id=ouv.origin_unit_id where u.code='POLY-PLOT-1'")).rows[0];
  ok('the server stored a polygon', v.geometry_kind === 'polygon');
  ok('the server computed the area from the walked boundary', Number(v.computed_area_ha) > 9 && Number(v.computed_area_ha) < 13);
  const rel = Math.abs(Number(v.computed_area_ha) - estimate) / estimate;
  ok('the field estimate matches the server area within 5 percent', rel < 0.05);
  ok('the field estimate is kept as the declared (advisory) value', Math.abs(Number(v.declared_area_ha) - Number(estimate.toFixed(3))) < 0.001);
  ok('the authoritative area is the server area, not the declared estimate', Math.abs(Number(v.area_ha) - Number(v.computed_area_ha)) < 0.001);

  await cleanup();
  console.log(`\npolygon-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('polygon-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
