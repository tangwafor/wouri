import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { contentHash, issueCredential } from '../src/lib/proof/vc.mjs';

// The critical-path e2e (canonical gate): the whole product in one run. A real
// create in the browser; the public verification page shows AUTHENTIC then REVOKED;
// the server refuses a mismatched-weight document and reports a document stale after
// a source change; and tenant B sees none of tenant A's data. Self-cleaning (tag
// zze2e). Runs against PLAYWRIGHT_BASE_URL. No em-dashes.
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env.local') });
config({ path: resolve(__dirname, '../.env.local') });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const anon = () => createClient(URL, ANON, { auth: { persistSession: false } });
const PW = 'WouriTest2026!';
const A = { slug: 'zze2e-a', email: 'zze2e+a@wouri.test' };
const B = { slug: 'zze2e-b', email: 'zze2e+b@wouri.test' };
const UI_CODE = 'ZZE2E-CN-UI-' + Math.floor(Date.now() / 1000);
const SEED_CODE = 'ZZE2E-CN-SEED';

const ctx: { orgA?: string; aCli?: any; seededDoc?: string; verifyCode?: string; con?: any; lot?: any } = {};
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function ensureUserOrg(who: { slug: string; email: string }) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (!list.users.find((u) => u.email === who.email)) await admin.auth.admin.createUser({ email: who.email, password: PW, email_confirm: true });
  const cli = anon();
  await cli.auth.signInWithPassword({ email: who.email, password: PW });
  const { data: orgs } = await cli.from('organizations').select('id').limit(1);
  let orgId = orgs?.[0]?.id;
  if (!orgId) orgId = (await cli.rpc('create_organization', { p_org_name: who.slug, p_org_slug: who.slug, p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  return { cli, orgId };
}

async function login(page: any, email: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PW);
  await Promise.all([page.waitForURL(/\/(home|onboarding)/, { timeout: 40_000 }), page.locator('button[type="submit"]').first().click()]);
}

test.beforeAll(async () => {
  await pgc.connect();
  // Clean slate for the tag.
  for (const s of [A.slug, B.slug]) { try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [s]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); } }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of data.users) if (/zze2e/i.test(u.email ?? '')) await admin.auth.admin.deleteUser(u.id);

  const a = await ensureUserOrg(A); ctx.aCli = a.cli; ctx.orgA = a.orgId;
  await ensureUserOrg(B);

  // Seed a consignment with a lot allocated and an issued EUR.1 document for A.
  const PRIV = (await pgc.query("select secret from wouri_secrets where key_name='proof_private_pem'")).rows[0].secret;
  const cocoa = (await a.cli.from('commodities').select('id').eq('key', 'cocoa').single()).data.id;
  const buyer = (await a.cli.from('parties').insert({ organization_id: a.orgId, kind: 'buyer', name: 'EU Buyer GmbH', country: 'DE' }).select().single()).data;
  ctx.lot = (await a.cli.from('lots').insert({ organization_id: a.orgId, commodity_id: cocoa, code: 'ZZE2E-LOT-1', claim: 'segregated', quantity_kg: 1000 }).select().single()).data;
  const ct = (await a.cli.from('contracts').insert({ organization_id: a.orgId, code: 'ZZE2E-CT', buyer_party_id: buyer.id, commodity_id: cocoa, quantity_kg: 1000 }).select().single()).data;
  ctx.con = (await a.cli.from('consignments').insert({ organization_id: a.orgId, code: SEED_CODE, buyer_party_id: buyer.id, contract_id: ct.id, destination_country: 'DE' }).select().single()).data;
  await a.cli.from('consignment_lots').insert({ consignment_id: ctx.con.id, lot_id: ctx.lot.id, organization_id: a.orgId, quantity_kg: 1000 });
  const r = (await a.cli.rpc('resolve_document', { p_consignment: ctx.con.id, p_template: 'eur1_cmr' })).data;
  ctx.verifyCode = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
  ctx.seededDoc = (await a.cli.rpc('issue_document', { p_id: randomUUID(), p_consignment: ctx.con.id, p_template: 'eur1_cmr', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(r.content), p_vc: issueCredential(r.content, { issuer: 'wouri:org:zze2e-a', validFrom: '2026-07-23T09:00:00Z', template: 'eur1_cmr', templateVersion: 'v1', packVersion: 'cm-docs-v1', verificationCode: ctx.verifyCode }, PRIV), p_code: ctx.verifyCode })).data;
});

test.afterAll(async () => {
  for (const s of [A.slug, B.slug]) { try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [s]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); } }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of data.users) if (/zze2e/i.test(u.email ?? '')) await admin.auth.admin.deleteUser(u.id);
  await pgc.end().catch(() => {});
});

test('critical path: create, verify, revoke, consistency, staleness, isolation', async ({ page }) => {
  // 1. CREATE (real browser action): tenant A creates a consignment through the UI.
  await login(page, A.email);
  await page.goto('/consignments');
  await page.fill('#cc', UI_CODE);
  await page.fill('#cb', 'Browser Buyer SARL');
  await page.fill('#cd', 'FR');
  await page.locator('.card').filter({ has: page.locator('#cc') }).getByRole('button').click();
  // Assert it persisted in the DB (real assertion), waiting for the write to land.
  await expect.poll(async () => (await ctx.aCli.from('consignments').select('id').eq('code', UI_CODE)).data?.length ?? 0, { timeout: 15_000 }).toBe(1);
  // And that the UI shows it.
  await page.goto('/consignments');
  await expect(page.getByText(UI_CODE)).toBeVisible({ timeout: 15_000 });

  // 2. VERIFY (real browser read): the public verification page shows AUTHENTIC.
  await page.goto(`/v/${ctx.verifyCode}`);
  await expect(page.getByText('AUTHENTIC')).toBeVisible({ timeout: 15_000 });

  // 3. REVOKE + rescan: revoke the document, reload, the page shows REVOKED.
  await ctx.aCli.rpc('revoke_document', { p_id: ctx.seededDoc, p_reason: 'zze2e revoke' });
  await page.goto(`/v/${ctx.verifyCode}`);
  await expect(page.getByText('REVOKED')).toBeVisible({ timeout: 15_000 });

  // 4. CONSISTENCY (server): a mismatched-weight document is refused server-side.
  await ctx.aCli.from('contracts').update({ quantity_kg: 900 }).eq('code', 'ZZE2E-CT');
  const mismatch = await ctx.aCli.rpc('issue_document', { p_id: randomUUID(), p_consignment: ctx.con.id, p_template: 'eur1_cmr', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: 'x', p_vc: {}, p_code: 'ZZE2E-BAD' });
  expect(mismatch.error, 'weight mismatch must be refused').toBeTruthy();
  await ctx.aCli.from('contracts').update({ quantity_kg: 1000 }).eq('code', 'ZZE2E-CT');

  // 5. STALENESS: issue a fresh document, amend a source value, it goes stale.
  const r2 = (await ctx.aCli.rpc('resolve_document', { p_consignment: ctx.con.id, p_template: 'vgm' })).data;
  const code2 = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
  const doc2 = (await ctx.aCli.rpc('issue_document', { p_id: randomUUID(), p_consignment: ctx.con.id, p_template: 'vgm', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(r2.content), p_vc: issueCredential(r2.content, { issuer: 'wouri:org:zze2e-a', validFrom: '2026-07-23T09:00:00Z', template: 'vgm', templateVersion: 'v1', packVersion: 'cm-docs-v1', verificationCode: code2 }, (await pgc.query("select secret from wouri_secrets where key_name='proof_private_pem'")).rows[0].secret), p_code: code2 })).data;
  await ctx.aCli.from('consignment_lots').update({ quantity_kg: 1500 }).eq('consignment_id', ctx.con.id).eq('lot_id', ctx.lot.id);
  const stale = (await ctx.aCli.rpc('document_staleness', { p_doc: doc2 })).data;
  expect(stale.stale, 'document must be stale after a source change').toBe(true);

  // 6. ISOLATION (the whole product in one assertion): tenant B sees none of A's data.
  await login(page, B.email);
  await page.goto('/consignments');
  await expect(page.getByText(UI_CODE)).toHaveCount(0);
  await expect(page.getByText(SEED_CODE)).toHaveCount(0);
  const bReach = anon();
  await bReach.auth.signInWithPassword({ email: B.email, password: PW });
  const bSeesA = (await bReach.from('consignments').select('id').eq('organization_id', ctx.orgA)).data ?? [];
  expect(bSeesA.length, 'tenant B must not read tenant A consignments').toBe(0);
});
