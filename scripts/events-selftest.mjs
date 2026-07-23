#!/usr/bin/env node
// events-selftest: proves the reactive layer (0027). Database triggers drop a
// notification when a shipment moves, a discrepancy is raised, and a settlement
// is repatriated. Members read their own notifications and mark them read; anon
// sees none. Self-cleaning. No em-dashes.
// Run: node scripts/events-selftest.mjs
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
const SLUG = 'evt-a', EMAIL = 'evttest+a@wouri.test';
const SLUG_B = 'evt-b', EMAIL_B = 'evttest+b@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  for (const s of [SLUG, SLUG_B]) { try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [s]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); } }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL || u.email === EMAIL_B) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn(email) { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(error.message); return c; }
const kinds = (rows) => (rows ?? []).map((r) => r.kind);

try {
  console.log('events-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  await admin.auth.admin.createUser({ email: EMAIL_B, password: PW, email_confirm: true });
  const a = await signedIn(EMAIL); const b = await signedIn(EMAIL_B);
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Evt A', p_org_slug: SLUG, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  await b.rpc('create_organization', { p_org_name: 'Evt B', p_org_slug: SLUG_B, p_first_location_name: 'Kribi', p_country: 'CM', p_locale: 'fr' });
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-E1', destination_country: 'DE' }).select().single()).data;

  // A shipment that moves fires a notification per transition.
  const sh = (await a.from('shipments').insert({ organization_id: orgA, consignment_id: con.id, etd: '2026-08-01', eta: '2026-09-01' }).select().single()).data;
  await a.rpc('shipment_advance', { p_shipment: sh.id, p_to: 'loaded' });
  let notes = (await a.from('notifications').select('kind, title, entity_id').eq('organization_id', orgA)).data ?? [];
  ok('shipment move drops a notification', kinds(notes).includes('shipment'));

  // A settlement instrument, a discrepancy, and repatriation.
  const instr = (await a.from('settlement_instruments').insert({ organization_id: orgA, consignment_id: con.id, kind: 'lc', currency: 'EUR', amount_minor: 5000000, incoterm: 'FOB', export_date: '2026-08-05', region: 'CEMAC' }).select().single()).data;
  await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'presented' });
  await a.rpc('settlement_raise_discrepancy', { p_id: randomUUID(), p_instr: instr.id, p_code: 'WEIGHT_MISMATCH', p_desc: 'net weight differs from B/L' });
  notes = (await a.from('notifications').select('kind').eq('organization_id', orgA)).data ?? [];
  ok('a discrepancy drops a high notification', kinds(notes).includes('discrepancy'));

  const disc = (await a.from('settlement_discrepancies').select('id').eq('instrument_id', instr.id).single()).data;
  await a.rpc('settlement_resolve_discrepancy', { p_id: disc.id });
  await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'accepted' });
  await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'paid' });
  await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'repatriated' });
  notes = (await a.from('notifications').select('kind').eq('organization_id', orgA)).data ?? [];
  ok('paid drops a notification', kinds(notes).includes('paid'));
  ok('repatriated drops a settled notification', kinds(notes).includes('settled'));

  // A member marks a notification read.
  const one = (await a.from('notifications').select('id').eq('organization_id', orgA).is('read_at', null).limit(1)).data?.[0];
  await a.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', one.id);
  const unread = (await a.from('notifications').select('id', { count: 'exact', head: true }).eq('organization_id', orgA).is('read_at', null));
  const total = (await a.from('notifications').select('id', { count: 'exact', head: true }).eq('organization_id', orgA));
  ok('marking read reduces the unread count', (unread.count ?? 0) < (total.count ?? 0));

  // Tenant isolation: B never sees A's notifications; anon sees none.
  const bSees = (await b.from('notifications').select('id').eq('organization_id', orgA)).data ?? [];
  ok('another org cannot read these notifications', bSees.length === 0);
  const anonSees = (await anonClient().from('notifications').select('id')).data ?? [];
  ok('anon reads no notifications', anonSees.length === 0);

  await cleanup();
  console.log(`\nevents-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('events-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
