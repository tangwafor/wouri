#!/usr/bin/env node
// anchor-selftest: proves Merkle anchoring (0038). Three documents are issued, a
// checkpoint is published and its root Ed25519-signed, and each document proves its
// inclusion in the published root, verified independently in JS. A tampered leaf
// fails; a document issued after the checkpoint is not yet anchored; anon can verify
// (public transparency). Self-cleaning. No em-dashes.
// Run: node scripts/anchor-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { contentHash, issueCredential } from '../apps/console/src/lib/proof/vc.mjs';
import { verifyInclusion, computeRoot, signRoot, verifyRootSignature } from '../apps/console/src/lib/proof/merkle.mjs';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };
const PW = 'WouriTest2026!';
const SLUG = 'anchor-a', EMAIL = 'anchortest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const META = (code) => ({ issuer: 'wouri:org:anchor-a', validFrom: '2026-07-23T09:00:00Z', template: 'eur1_cmr', templateVersion: 'v1', packVersion: 'cm-docs-v1', verificationCode: code });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('anchor-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const org = (await a.rpc('create_organization', { p_org_name: 'Anchor A', p_org_slug: SLUG, p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  const PRIV = (await pgc.query("select secret from wouri_secrets where key_name = 'proof_private_pem'")).rows[0].secret;
  const PUB = (await anonClient().rpc('get_proof_public_key')).data;
  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data.id;
  const buyer = (await a.from('parties').insert({ organization_id: org, kind: 'buyer', name: 'EU Buyer GmbH', country: 'DE' }).select().single()).data;

  // Issue three EUR.1 documents on three consignments.
  const docIds = [];
  for (const n of [1, 2, 3]) {
    const lot = (await a.from('lots').insert({ organization_id: org, commodity_id: cocoa, code: `LOT-A-${n}`, claim: 'segregated', quantity_kg: 1000 }).select().single()).data;
    const ct = (await a.from('contracts').insert({ organization_id: org, code: `CT-${n}`, buyer_party_id: buyer.id, commodity_id: cocoa, quantity_kg: 1000 }).select().single()).data;
    const con = (await a.from('consignments').insert({ organization_id: org, code: `CN-${n}`, buyer_party_id: buyer.id, contract_id: ct.id, destination_country: 'DE' }).select().single()).data;
    await a.from('consignment_lots').insert({ consignment_id: con.id, lot_id: lot.id, organization_id: org, quantity_kg: 1000 });
    const r = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'eur1_cmr' })).data;
    const code = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
    const vc = issueCredential(r.content, META(code), PRIV);
    const id = (await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: con.id, p_template: 'eur1_cmr', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(r.content), p_vc: vc, p_code: code })).data;
    docIds.push(id);
  }
  ok('three documents issued', docIds.length === 3 && docIds.every(Boolean));

  // Publish a checkpoint and sign the root.
  const cp = await a.rpc('anchor_documents', { p_org: org });
  ok('a checkpoint is published', !cp.error && typeof cp.data === 'string');
  const root0 = (await a.from('anchor_digests').select('merkle_root, leaf_count').eq('id', cp.data).single()).data;
  ok('the checkpoint covers the three documents', root0.leaf_count === 3);
  const sig = signRoot(root0.merkle_root, PRIV);
  await a.rpc('set_anchor_signature', { p_checkpoint: cp.data, p_signature: sig });

  // Each document proves inclusion, verified independently in JS.
  let allIncluded = true, sigOk = false;
  for (const id of docIds) {
    const p = (await anonClient().rpc('document_inclusion_proof', { p_doc: id })).data;
    if (!p.found || !verifyInclusion(p.leaf, p.proof, p.root)) allIncluded = false;
    sigOk = verifyRootSignature(p.root, p.root_signature, PUB);
  }
  ok('every document verifies inclusion in the published root (offline, in JS)', allIncluded);
  ok('the published root is Ed25519-signed by the server key', sigOk);

  // Independent cross-check: JS rebuilds the same root from the ordered leaves.
  const leaves = (await pgc.query('select content_hash from documents where organization_id=$1 order by created_at, id', [org])).rows.map((r) => r.content_hash);
  ok('JS rebuilds the identical root from the ordered leaves', computeRoot(leaves) === root0.merkle_root);

  // A tampered leaf does not verify.
  const p1 = (await a.rpc('document_inclusion_proof', { p_doc: docIds[0] })).data;
  ok('a tampered leaf fails inclusion', verifyInclusion('00'.repeat(32), p1.proof, p1.root) === false);

  // A document issued AFTER the checkpoint is not yet anchored.
  const lotX = (await a.from('lots').insert({ organization_id: org, commodity_id: cocoa, code: 'LOT-A-X', claim: 'segregated', quantity_kg: 1000 }).select().single()).data;
  const ctX = (await a.from('contracts').insert({ organization_id: org, code: 'CT-X', buyer_party_id: buyer.id, commodity_id: cocoa, quantity_kg: 1000 }).select().single()).data;
  const conX = (await a.from('consignments').insert({ organization_id: org, code: 'CN-X', buyer_party_id: buyer.id, contract_id: ctX.id, destination_country: 'DE' }).select().single()).data;
  await a.from('consignment_lots').insert({ consignment_id: conX.id, lot_id: lotX.id, organization_id: org, quantity_kg: 1000 });
  const rX = (await a.rpc('resolve_document', { p_consignment: conX.id, p_template: 'eur1_cmr' })).data;
  const codeX = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
  const idX = (await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: conX.id, p_template: 'eur1_cmr', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(rX.content), p_vc: issueCredential(rX.content, META(codeX), PRIV), p_code: codeX })).data;
  const pX = (await a.rpc('document_inclusion_proof', { p_doc: idX })).data;
  ok('a document issued after the checkpoint is not yet anchored', pX.found === false);

  await cleanup();
  console.log(`\nanchor-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('anchor-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
