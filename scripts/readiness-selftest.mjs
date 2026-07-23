#!/usr/bin/env node
// readiness-selftest: proves the readiness board surfaces the right blockers with
// the right severity, and stays org-scoped. Builds four real situations (an
// overdue repatriation, an open discrepancy, a window closing soon, an overdue
// task) and asserts each appears, that critical outranks the rest, and that
// tenant B sees none of A. Self-cleaning. No em-dashes.
// Run: node scripts/readiness-selftest.mjs
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
const SLUGS = ['ready-a', 'ready-b'];
const EMAILS = ['readytest+a@wouri.test', 'readytest+b@wouri.test'];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
const SEV_RANK = { critical: 0, high: 1, warning: 2 };
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

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
  console.log('readiness-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAILS[0], password: PW, email_confirm: true });
  await admin.auth.admin.createUser({ email: EMAILS[1], password: PW, email_confirm: true });
  const a = await signedIn(EMAILS[0]);
  const b = await signedIn(EMAILS[1]);
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Ready A', p_org_slug: SLUGS[0], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  await b.rpc('create_organization', { p_org_name: 'Ready B', p_org_slug: SLUGS[1], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });

  // CN-R1: an overdue repatriation with an open discrepancy.
  const con1 = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-R1', destination_country: 'DE' }).select().single()).data;
  const instr1 = (await a.from('settlement_instruments').insert({ organization_id: orgA, consignment_id: con1.id, kind: 'lc', export_date: '2020-01-01' }).select().single()).data;
  await a.rpc('settlement_raise_discrepancy', { p_id: randomUUID(), p_instr: instr1.id, p_code: 'MISSING_EUR1', p_desc: 'EUR.1 not presented' });

  // CN-R2: a repatriation window closing in about 10 days (export 140 days ago).
  const con2 = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-R2', destination_country: 'DE' }).select().single()).data;
  await a.from('settlement_instruments').insert({ organization_id: orgA, consignment_id: con2.id, kind: 'lc', export_date: daysAgo(140) });

  // An overdue task.
  await a.from('tasks').insert({ organization_id: orgA, title: 'Chase phytosanitary certificate', status: 'open', due_at: daysAgo(3) + 'T00:00:00Z' });

  const board = (await a.from('readiness_board').select('kind, severity, age_days, consignment_code, detail')).data ?? [];
  const kinds = new Set(board.map((r) => r.kind));
  ok('the board shows the overdue repatriation (critical)', board.some((r) => r.kind === 'repatriation_overdue' && r.severity === 'critical'));
  ok('the board shows the open discrepancy (high)', board.some((r) => r.kind === 'discrepancy' && r.severity === 'high'));
  ok('the board shows the window closing soon (warning)', board.some((r) => r.kind === 'repatriation_due_soon' && r.severity === 'warning'));
  ok('the board shows the overdue task (high)', board.some((r) => r.kind === 'task_overdue' && r.severity === 'high'));
  ok('all four blocker kinds are present', kinds.size >= 4);

  // Ranking: sort critical > high > warning, then oldest first. Top is the
  // overdue repatriation.
  const ranked = [...board].sort((x, y) => SEV_RANK[x.severity] - SEV_RANK[y.severity] || y.age_days - x.age_days);
  ok('the most urgent blocker ranks first (repatriation overdue)', ranked[0].kind === 'repatriation_overdue');
  ok('the overdue repatriation age is large (years overdue)', ranked[0].age_days > 1000);

  // RLS: tenant B and anon see nothing of A.
  ok('tenant B sees an empty board (no A blockers)', ((await b.from('readiness_board').select('kind')).data ?? []).length === 0);
  ok('anon sees no board rows', ((await anonClient().from('readiness_board').select('kind')).data ?? []).length === 0);

  await cleanup();
  console.log(`\nreadiness-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('readiness-selftest error:', e.message);
  await cleanup().catch(() => {});
  fail++;
} finally {
  await pgc.end().catch(() => {});
}
process.exit(fail > 0 ? 1 : 0);
