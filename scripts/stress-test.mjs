#!/usr/bin/env node
// stress-test: concurrency invariants (TaTech point 23). Two things must hold under
// parallel writes: the CITES quota can never be over-drawn even when many exports
// race, and a lot's hash chain stays intact and contiguous when many events are
// appended at once. Self-cleaning. No em-dashes.
// Run: node scripts/stress-test.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n + (d ? '  ' + d : '')); } };
const PW = 'WouriTest2026!';
const SLUG = 'stress-a', EMAIL = 'stresstest+a@wouri.test';
const SPECIES = 'Stress-species', YEAR = 2098;
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  await pgc.query('delete from cites_quotas where species=$1 and year=$2', [SPECIES, YEAR]).catch(() => {});
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('stress-test: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const org = (await a.rpc('create_organization', { p_org_name: 'Stress A', p_org_slug: SLUG, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;

  // 1. Quota: 100 kg, 20 concurrent debits of 10. Exactly 10 must succeed.
  await pgc.query('insert into cites_quotas (species, year, quota_kg, source) values ($1,$2,100,$3)', [SPECIES, YEAR, 'stress']);
  const debits = await Promise.all(Array.from({ length: 20 }, () =>
    a.rpc('record_quota_use', { p_org: org, p_species: SPECIES, p_year: YEAR, p_amount_kg: 10 })));
  const succeeded = debits.filter((d) => !d.error).length;
  const status = (await a.rpc('cites_quota_status')).data.find((r) => r.species === SPECIES && r.year === YEAR);
  ok('under 20 concurrent debits, exactly the quota is used, never more', succeeded === 10 && Number(status.used_kg) === 100 && Number(status.remaining_kg) === 0, `succeeded=${succeeded} used=${status.used_kg}`);
  ok('the balance never went negative', Number(status.remaining_kg) >= 0);

  // 2. Chain: 15 concurrent events on one lot. The chain must stay intact and its
  // sequence contiguous.
  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data.id;
  const lot = (await a.from('lots').insert({ organization_id: org, commodity_id: cocoa, code: 'LOT-STRESS', claim: 'segregated', quantity_kg: 500 }).select().single()).data;
  const N = 15;
  await Promise.all(Array.from({ length: N }, (_, i) =>
    a.rpc('record_lot_event', { p_id: randomUUID(), p_lot: lot.id, p_type: 'moved', p_payload: { n: i } })));
  const chain = await a.rpc('verify_lot_chain', { p_lot: lot.id });
  const chainOk = Array.isArray(chain.data) ? chain.data[0]?.ok : chain.data?.ok;
  const seqs = (await pgc.query('select seq from lot_events where lot_id=$1 order by seq', [lot.id])).rows.map((r) => Number(r.seq));
  const contiguous = seqs.length === N && seqs.every((s, i) => s === i + 1);
  const unique = new Set(seqs).size === seqs.length;
  ok('the lot chain is intact after concurrent appends', chainOk === true);
  ok('the sequence is contiguous 1..N with no duplicates', contiguous && unique, `seqs=${seqs.join(',')}`);

  await cleanup();
  console.log(`\nstress-test: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('stress-test error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
