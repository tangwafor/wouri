#!/usr/bin/env node
// signatures-selftest: proves human signatures (0039). A producer signs a purchase
// receipt with a thumbprint, timestamp, and location; a driver accepts a load; a
// supervisor seals a container. A signature on a lot is also sealed into the lot's
// tamper-evident chain. Org-isolated; anon denied. Self-cleaning. No em-dashes.
// Run: node scripts/signatures-selftest.mjs
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
const ORGS = [['sig-a', 'sigtest+a@wouri.test'], ['sig-b', 'sigtest+b@wouri.test']];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  for (const [slug] of ORGS) { try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [slug]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); } }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (ORGS.some(([, e]) => e === u.email)) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn(email) { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('signatures-selftest: begin');
  await pgc.connect();
  await cleanup();
  const cli = {}, org = {};
  for (const [slug, email] of ORGS) {
    await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    cli[slug] = await signedIn(email);
    org[slug] = (await cli[slug].rpc('create_organization', { p_org_name: slug.toUpperCase(), p_org_slug: slug, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  }
  const a = cli['sig-a'], orgA = org['sig-a'];
  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data.id;
  const lot = (await a.from('lots').insert({ organization_id: orgA, commodity_id: cocoa, code: 'LOT-SIG-1', claim: 'segregated', quantity_kg: 500 }).select().single()).data;
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-SIG', destination_country: 'DE' }).select().single()).data;
  const sh = (await a.from('shipments').insert({ organization_id: orgA, consignment_id: con.id, etd: '2026-09-01', eta: '2026-10-01' }).select().single()).data;

  // A producer signs a purchase receipt (a lot) with a thumbprint, time, and place.
  const sid = (await a.rpc('record_signature', {
    p_org: orgA, p_subject_type: 'lot', p_subject_id: lot.id, p_signer_role: 'producer', p_signer_name: 'Mama Ngassa',
    p_method: 'thumbprint', p_signature_hash: 'a'.repeat(64), p_lat: 4.05, p_lng: 9.7, p_place: 'Kumba buying station',
  })).data;
  ok('a producer signature is recorded', typeof sid === 'string');
  const row = (await a.from('signatures').select('signer_role, method, captured_lat, place, signed_at').eq('id', sid).single()).data;
  ok('it carries signer, method, timestamp, and location', row.signer_role === 'producer' && row.method === 'thumbprint' && Number(row.captured_lat) === 4.05 && !!row.signed_at && row.place === 'Kumba buying station');

  // The lot signature is sealed into the tamper-evident chain.
  const evt = (await a.from('lot_events').select('event_type').eq('lot_id', lot.id).eq('event_type', 'signature')).data ?? [];
  ok('a lot signature is sealed into the lot chain', evt.length === 1);
  const chain = await a.rpc('verify_lot_chain', { p_lot: lot.id });
  const chainOk = Array.isArray(chain.data) ? chain.data[0]?.ok : chain.data?.ok;
  ok('the lot chain is still intact after signing', chainOk === true);

  // A driver accepts the load; a supervisor seals the container.
  const drv = (await a.rpc('record_signature', { p_org: orgA, p_subject_type: 'shipment', p_subject_id: sh.id, p_signer_role: 'driver', p_signer_name: 'Etienne', p_method: 'drawn', p_lat: 4.06, p_lng: 9.71, p_place: 'Depot' })).data;
  const sup = (await a.rpc('record_signature', { p_org: orgA, p_subject_type: 'consignment', p_subject_id: con.id, p_signer_role: 'stuffing_supervisor', p_signer_name: 'Bih', p_method: 'pin', p_place: 'Douala port' })).data;
  ok('a driver and a supervisor signature are recorded', typeof drv === 'string' && typeof sup === 'string');
  const all = (await a.from('signatures').select('signer_role').eq('organization_id', orgA)).data ?? [];
  ok('all three attestations are stored', all.length === 3);

  // Isolation: B cannot see A's signatures; anon sees none.
  const bSees = (await cli['sig-b'].from('signatures').select('id').eq('organization_id', orgA)).data ?? [];
  ok('another org cannot read these signatures', bSees.length === 0);
  const anonSees = (await anonClient().from('signatures').select('id')).data ?? [];
  ok('anon sees no signatures', anonSees.length === 0);

  // A non-member cannot record a signature for another org.
  const hijack = await cli['sig-b'].rpc('record_signature', { p_org: orgA, p_subject_type: 'lot', p_subject_id: lot.id, p_signer_role: 'producer', p_signer_name: 'X' });
  ok('a non-member cannot sign for another org', !!hijack.error);

  await cleanup();
  console.log(`\nsignatures-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('signatures-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
