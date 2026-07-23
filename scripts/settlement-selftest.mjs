#!/usr/bin/env node
// settlement-selftest: proves the Sprint 3 settlement slice against wouri-dev.
// The BEAC clock computes the repatriation due date from the registry window
// (not a hardcoded 150), a discrepancy blocks acceptance and payment, the state
// machine only advances in order, "settled means repatriated" (a consignment is
// settled only once repatriated), and RLS isolates instruments. Self-cleaning.
// No em-dashes. Run: node scripts/settlement-selftest.mjs
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
const SLUGS = ['settle-a', 'settle-b'];
const EMAILS = ['settletest+a@wouri.test', 'settletest+b@wouri.test'];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });

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
  console.log('settlement-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAILS[0], password: PW, email_confirm: true });
  await admin.auth.admin.createUser({ email: EMAILS[1], password: PW, email_confirm: true });
  const a = await signedIn(EMAILS[0]);
  const b = await signedIn(EMAILS[1]);
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Settle A', p_org_slug: SLUGS[0], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  await b.rpc('create_organization', { p_org_name: 'Settle B', p_org_slug: SLUGS[1], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });

  const buyer = (await a.from('parties').insert({ organization_id: orgA, kind: 'buyer', name: 'EU Buyer', country: 'DE' }).select().single()).data;
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-S1', buyer_party_id: buyer.id, destination_country: 'DE' }).select().single()).data;

  // A settlement instrument whose export date is well in the past.
  const instr = (await a.from('settlement_instruments').insert({
    organization_id: orgA, consignment_id: con.id, kind: 'lc', currency: 'EUR', amount_minor: 5000000,
    incoterm: 'FOB', export_date: '2020-01-01', region: 'CEMAC',
  }).select().single()).data;
  ok('A creates a settlement instrument', !!instr?.id);

  // The BEAC clock: due = export_date + the registry window (150 days from
  // settlement_rules, not a hardcoded literal). 2020-01-01 + 150 = 2020-05-30.
  {
    const clk = (await a.from('settlement_clock').select('repatriation_due, days_remaining, overdue').eq('id', instr.id).single()).data;
    ok('the clock due date is export + registry window (2020-05-30)', String(clk.repatriation_due).slice(0, 10) === '2020-05-30');
    ok('a past-due unrepatriated instrument is overdue', clk.overdue === true && clk.days_remaining < 0);
  }

  // Not settled yet (positive control before we advance).
  ok('a consignment with no repatriation is NOT settled', (await a.rpc('is_consignment_settled', { p_con: con.id })).data === false);

  // State machine only advances in order.
  {
    const skip = await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'accepted' });
    ok('cannot accept straight from draft', !!skip.error);
    const repEarly = await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'repatriated' });
    ok('cannot repatriate before paid (settled means repatriated)', !!repEarly.error && /repatriated/.test(repEarly.error.message));
  }

  // Present, then a discrepancy blocks acceptance until resolved.
  {
    await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'presented' });
    const discId = randomUUID();
    await a.rpc('settlement_raise_discrepancy', { p_id: discId, p_instr: instr.id, p_code: 'WEIGHT_MISMATCH', p_desc: 'net weight differs from B/L' });
    const blocked = await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'accepted' });
    ok('a discrepancy blocks acceptance', !!blocked.error && /discrepanc/i.test(blocked.error.message));
    await a.rpc('settlement_resolve_discrepancy', { p_id: discId });
    const okAccept = await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'accepted' });
    ok('acceptance succeeds once the discrepancy is resolved', !okAccept.error);
  }

  // Pay, then repatriate. Only then is the consignment settled.
  {
    ok('paid succeeds from accepted', !(await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'paid' })).error);
    ok('a paid but not repatriated consignment is still NOT settled', (await a.rpc('is_consignment_settled', { p_con: con.id })).data === false);
    ok('repatriate succeeds from paid', !(await a.rpc('settlement_advance', { p_instr: instr.id, p_to: 'repatriated' })).error);
    ok('now the consignment IS settled (repatriated)', (await a.rpc('is_consignment_settled', { p_con: con.id })).data === true);
    const clk = (await a.from('settlement_clock').select('overdue, status').eq('id', instr.id).single()).data;
    ok('a repatriated instrument is no longer overdue', clk.overdue === false && clk.status === 'repatriated');
  }

  // RLS: tenant B and anon see no A instruments.
  {
    const bSees = (await b.from('settlement_instruments').select('id').eq('organization_id', orgA)).data ?? [];
    ok('tenant B cannot see A settlement instruments', bSees.length === 0);
    const anonSees = (await anonClient().from('settlement_instruments').select('id')).data ?? [];
    ok('anon sees no settlement instruments', anonSees.length === 0);
  }

  await cleanup();
  console.log(`\nsettlement-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('settlement-selftest error:', e.message);
  await cleanup().catch(() => {});
  fail++;
} finally {
  await pgc.end().catch(() => {});
}
process.exit(fail > 0 ? 1 : 0);
