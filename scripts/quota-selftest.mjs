#!/usr/bin/env node
// quota-selftest: proves the CITES quota ledger can never go negative (0036). A
// national quota is defined; debits succeed up to it; the debit that would exceed
// it is refused and the balance is unchanged; two orgs debit the same national
// quota; a member sees only its own ledger rows; anon sees none. Self-cleaning.
// No em-dashes.
// Run: node scripts/quota-selftest.mjs
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
const SPECIES = 'Test-species-selftest', YEAR = 2099;
const ORGS = [['quota-a', 'quotatest+a@wouri.test'], ['quota-b', 'quotatest+b@wouri.test']];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  await pgc.query('delete from cites_quotas where species=$1 and year=$2', [SPECIES, YEAR]).catch(() => {});
  for (const [slug] of ORGS) { try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [slug]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); } }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (ORGS.some(([, e]) => e === u.email)) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn(email) { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('quota-selftest: begin');
  await pgc.connect();
  await cleanup();
  const cli = {}, org = {};
  for (const [slug, email] of ORGS) {
    await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    cli[slug] = await signedIn(email);
    org[slug] = (await cli[slug].rpc('create_organization', { p_org_name: slug.toUpperCase(), p_org_slug: slug, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  }

  // Define a national quota of 100 kg for the test species/year.
  await pgc.query('insert into cites_quotas (species, year, quota_kg, source) values ($1,$2,100,$3)', [SPECIES, YEAR, 'selftest']);

  // No quota for an unknown species is refused (never negative by default).
  const noQuota = await cli['quota-a'].rpc('record_quota_use', { p_org: org['quota-a'], p_species: 'Nonexistent', p_year: YEAR, p_amount_kg: 1 });
  ok('a species with no defined quota is refused', !!noQuota.error);

  // A debits 60 (ok), B debits 30 against the same national quota (ok).
  const a60 = await cli['quota-a'].rpc('record_quota_use', { p_org: org['quota-a'], p_species: SPECIES, p_year: YEAR, p_amount_kg: 60 });
  const b30 = await cli['quota-b'].rpc('record_quota_use', { p_org: org['quota-b'], p_species: SPECIES, p_year: YEAR, p_amount_kg: 30 });
  ok('a debit within the quota succeeds', !a60.error && !b30.error);

  // A debit of 20 would take it to 110, over 100. Refused.
  const over = await cli['quota-a'].rpc('record_quota_use', { p_org: org['quota-a'], p_species: SPECIES, p_year: YEAR, p_amount_kg: 20 });
  ok('a debit that would exceed the quota is refused', !!over.error && /exceeded/i.test(over.error.message));

  // The balance is unchanged by the refused debit: used 90, remaining 10.
  const status = (await cli['quota-a'].rpc('cites_quota_status')).data ?? [];
  const row = status.find((r) => r.species === SPECIES && r.year === YEAR);
  ok('the national remaining is exactly what the successful debits left', row && Number(row.used_kg) === 90 && Number(row.remaining_kg) === 10);

  // Exactly the remaining 10 succeeds and drives it to zero, never below.
  const exact = await cli['quota-b'].rpc('record_quota_use', { p_org: org['quota-b'], p_species: SPECIES, p_year: YEAR, p_amount_kg: 10 });
  ok('a debit of exactly the remaining balance succeeds', !exact.error);
  const one_more = await cli['quota-a'].rpc('record_quota_use', { p_org: org['quota-a'], p_species: SPECIES, p_year: YEAR, p_amount_kg: 0.1 });
  ok('any debit past zero is refused (never negative)', !!one_more.error);

  // A sees only its own ledger rows; anon sees none.
  const aRows = (await cli['quota-a'].from('quota_ledger').select('organization_id').eq('species', SPECIES)).data ?? [];
  ok('a member sees only its own ledger rows', aRows.length > 0 && aRows.every((r) => r.organization_id === org['quota-a']));
  const anonRows = (await anonClient().from('quota_ledger').select('id')).data ?? [];
  ok('anon sees no ledger rows', anonRows.length === 0);

  await cleanup();
  console.log(`\nquota-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('quota-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
