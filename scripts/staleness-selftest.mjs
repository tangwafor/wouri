#!/usr/bin/env node
// staleness-selftest: proves document staleness (0043). A fresh document is not
// stale; amend a source value (a quantity) and the document goes stale, with the
// drift naming the field, its old value, and its new one; the auto-check flags it;
// reverting clears it; revoking clears it. Another org cannot read the drift.
// Self-cleaning. No em-dashes.
// Run: node scripts/staleness-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { contentHash, issueCredential } from '../apps/console/src/lib/proof/vc.mjs';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };
const PW = 'WouriTest2026!';
const ORGS = [['stale-a', 'staletest+a@wouri.test'], ['stale-b', 'staletest+b@wouri.test']];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const META = (code) => ({ issuer: 'wouri:org:stale-a', validFrom: '2026-07-23T09:00:00Z', template: 'eur1_cmr', templateVersion: 'v1', packVersion: 'cm-docs-v1', verificationCode: code });

async function cleanup() {
  for (const [slug] of ORGS) { try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [slug]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); } }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (ORGS.some(([, e]) => e === u.email)) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn(email) { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('staleness-selftest: begin');
  await pgc.connect();
  await cleanup();
  const cli = {}, org = {};
  for (const [slug, email] of ORGS) {
    await admin.auth.admin.createUser({ email, password: PW, email_confirm: true });
    cli[slug] = await signedIn(email);
    org[slug] = (await cli[slug].rpc('create_organization', { p_org_name: slug.toUpperCase(), p_org_slug: slug, p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  }
  const a = cli['stale-a'], orgA = org['stale-a'];
  const PRIV = (await pgc.query("select secret from wouri_secrets where key_name = 'proof_private_pem'")).rows[0].secret;
  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data.id;
  const buyer = (await a.from('parties').insert({ organization_id: orgA, kind: 'buyer', name: 'EU Buyer GmbH', country: 'DE' }).select().single()).data;
  const lot = (await a.from('lots').insert({ organization_id: orgA, commodity_id: cocoa, code: 'LOT-ST-1', claim: 'segregated', quantity_kg: 1000 }).select().single()).data;
  const ct = (await a.from('contracts').insert({ organization_id: orgA, code: 'CT-ST', buyer_party_id: buyer.id, commodity_id: cocoa, quantity_kg: 1000 }).select().single()).data;
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-ST', buyer_party_id: buyer.id, contract_id: ct.id, destination_country: 'DE' }).select().single()).data;
  const cl = (await a.from('consignment_lots').insert({ consignment_id: con.id, lot_id: lot.id, organization_id: orgA, quantity_kg: 1000 }).select().single()).data;

  const r = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'eur1_cmr' })).data;
  const code = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
  const docId = (await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: con.id, p_template: 'eur1_cmr', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(r.content), p_vc: issueCredential(r.content, META(code), PRIV), p_code: code })).data;
  const freshCall = await a.rpc('document_staleness', { p_doc: docId });
  ok('the public staleness function is callable by a member', !freshCall.error);
  ok('a freshly issued document reports stale=false', freshCall.data.stale === false && freshCall.data.drift.length === 0);

  // Amend the allocated quantity: net_weight_kg now differs from what was issued.
  await a.from('consignment_lots').update({ quantity_kg: 1500 }).eq('consignment_id', con.id).eq('lot_id', lot.id);
  const drifted = (await a.rpc('document_staleness', { p_doc: docId })).data;
  ok('amending the quantity makes the document stale', drifted.stale === true);
  ok('the drift names the field, its old value and its new value',
    drifted.drift.some((d) => d.field === 'net_weight_kg' && Number(d.was) === 1000 && Number(d.now) === 1500));

  // The auto-check flags it.
  await a.rpc('run_auto_checks');
  let f = (await a.from('auto_check_findings').select('check_key, status').eq('organization_id', orgA).eq('check_key', 'document_stale').eq('status', 'open')).data ?? [];
  ok('the auto-check flags the stale document', f.length >= 1);

  // Another org cannot read the drift (the guard).
  const bPeek = await cli['stale-b'].rpc('document_staleness', { p_doc: docId });
  ok('another org cannot read the staleness of this document', !!bPeek.error);
  const bCore = await cli['stale-b'].rpc('document_is_stale', { p_doc: docId });
  ok('the unchecked staleness boolean is not callable by a client', !!bCore.error);

  // Reverting the source clears staleness.
  await a.from('consignment_lots').update({ quantity_kg: 1000 }).eq('consignment_id', con.id).eq('lot_id', lot.id);
  ok('reverting the source clears staleness', (await a.rpc('document_staleness', { p_doc: docId })).data.stale === false);

  // Break it again, then revoke: a revoked document is not reported stale.
  await a.from('consignment_lots').update({ quantity_kg: 1500 }).eq('consignment_id', con.id).eq('lot_id', lot.id);
  await a.rpc('revoke_document', { p_id: docId, p_reason: 'superseded by corrected quantity' });
  ok('a revoked document is not reported stale', (await a.rpc('document_staleness', { p_doc: docId })).data.stale === false);

  await cleanup();
  console.log(`\nstaleness-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('staleness-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
