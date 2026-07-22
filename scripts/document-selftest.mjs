#!/usr/bin/env node
// document-selftest: proves the Sprint 2 gates against wouri-dev, using the real
// proof module (Ed25519 VC) the verification page imports. Gates: an unbound
// required field blocks issuance (enforced in the DB, not just the client), a
// declared weight that does not match the consignment blocks issuance, a document
// verifies OFFLINE from its code with the public key alone, issuance is idempotent
// by content hash, a revoked document reads revoked, and any tamper (to the signed
// subject or the signature) is detected. Self-cleaning. No em-dashes.
// Run: node scripts/document-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { contentHash, issueCredential, verifyCredential } from '../apps/console/src/lib/proof/vc.mjs';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.error(`  FAIL ${n}`); } };
const PW = 'WouriTest2026!';
const SLUG = 'doc-a', SLUG_B = 'doc-b';
const EMAIL = 'doctest+a@wouri.test', EMAIL_B = 'doctest+b@wouri.test';
const pgClient = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });

async function cleanup() {
  try {
    await pgClient.query('begin');
    await pgClient.query("set local wouri.purge = 'on'");
    await pgClient.query('delete from organizations where slug = any($1)', [[SLUG, SLUG_B]]);
    await pgClient.query('commit');
  } catch { await pgClient.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) {
    if ([EMAIL, EMAIL_B].includes(u.email ?? '')) await admin.auth.admin.deleteUser(u.id);
  }
}
async function signedIn(email) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error('signIn: ' + error.message);
  return c;
}

const META = (template, code) => ({
  issuer: 'wouri:org:doc-a', validFrom: '2026-07-22T09:00:00Z',
  template, templateVersion: 'v1', packVersion: 'cm-docs-v1', verificationCode: code,
});

try {
  console.log('document-selftest: begin');
  await pgClient.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  await admin.auth.admin.createUser({ email: EMAIL_B, password: PW, email_confirm: true });
  const a = await signedIn(EMAIL);
  const b = await signedIn(EMAIL_B);
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Doc Exporter A', p_org_slug: SLUG, p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  await b.rpc('create_organization', { p_org_name: 'Doc B', p_org_slug: SLUG_B, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });

  const PRIV = (await pgClient.query("select secret from wouri_secrets where key_name = 'proof_private_pem'")).rows[0].secret;
  const PUB = (await anonClient().rpc('get_proof_public_key')).data;
  ok('the public proof key is readable by anyone (offline verify)', typeof PUB === 'string' && PUB.includes('PUBLIC KEY'));

  // Spine data: buyer, cocoa lot 1000kg, contract 1000kg, consignment to DE.
  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data;
  const buyer = (await a.from('parties').insert({ organization_id: orgA, kind: 'buyer', name: 'EU Buyer GmbH', country: 'DE' }).select().single()).data;
  const lot = (await a.from('lots').insert({ organization_id: orgA, commodity_id: cocoa.id, code: 'LOT-D-1', claim: 'segregated', quantity_kg: 1000 }).select().single()).data;
  const contract = (await a.from('contracts').insert({ organization_id: orgA, code: 'CT-1', buyer_party_id: buyer.id, commodity_id: cocoa.id, quantity_kg: 1000 }).select().single()).data;
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-1', buyer_party_id: buyer.id, contract_id: contract.id, destination_country: 'DE' }).select().single()).data;
  await a.from('consignment_lots').insert({ consignment_id: con.id, lot_id: lot.id, organization_id: orgA, quantity_kg: 1000 });

  // Issue EUR.1: resolve is complete, weight matches.
  const rEur = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'eur1_cmr' })).data;
  ok('EUR.1 resolves with no unbound field and matching weight', rEur.unbound.length === 0 && rEur.weight_ok === true);
  const codeE = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
  const vcE = issueCredential(rEur.content, META('eur1_cmr', codeE), PRIV);
  const idE = (await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: con.id, p_template: 'eur1_cmr', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(rEur.content), p_vc: vcE, p_code: codeE })).data;
  ok('EUR.1 issues', !!idE);

  // Offline verification through the public surface: anon resolves the code and
  // checks the signature with the public key alone.
  {
    const vd = (await anonClient().rpc('verify_document', { p_code: codeE })).data;
    ok('anon resolves the verification code', vd.found === true && vd.status === 'issued');
    const v = verifyCredential(vd.vc, vd.public_key);
    ok('the document verifies offline (valid signature)', v.ok === true);
  }

  // Idempotent by content hash: reissuing identical content returns the same doc.
  {
    const idE2 = (await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: con.id, p_template: 'eur1_cmr', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(rEur.content), p_vc: vcE, p_code: 'WOURI-DUP' })).data;
    ok('reissuing identical content is idempotent (same id)', idE2 === idE);
  }

  // Unbound blocks issuance: the quality certificate needs moisture + bean count.
  {
    const rQ = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'quality_cert' })).data;
    ok('quality cert reports unbound moisture + bean_count', rQ.unbound.includes('moisture_pct') && rQ.unbound.includes('bean_count'));
    // Even a direct issue_document call is refused server-side.
    const forced = await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: con.id, p_template: 'quality_cert', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(rQ.content), p_vc: {}, p_code: 'WOURI-Q-BAD' });
    ok('issue_document refuses an unbound quality cert (server-side)', !!forced.error && /unbound/.test(forced.error.message));
  }

  // Bind the values, then it issues.
  {
    await a.from('quality_values').insert([
      { organization_id: orgA, lot_id: lot.id, attribute_key: 'moisture', numeric_value: 7.2 },
      { organization_id: orgA, lot_id: lot.id, attribute_key: 'bean_count', numeric_value: 100 },
    ]);
    const rQ = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'quality_cert' })).data;
    ok('quality cert resolves once values are bound', rQ.unbound.length === 0);
    const codeQ = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
    const vcQ = issueCredential(rQ.content, META('quality_cert', codeQ), PRIV);
    const idQ = (await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: con.id, p_template: 'quality_cert', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(rQ.content), p_vc: vcQ, p_code: codeQ })).data;
    ok('quality cert issues once bound', !!idQ);
    globalThis.__codeQ = codeQ;
  }

  // Weight mismatch is caught: break the contract weight, issuance refuses.
  {
    await a.from('contracts').update({ quantity_kg: 900 }).eq('id', contract.id);
    const rW = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'phyto' })).data;
    ok('resolve flags the weight mismatch (900 vs 1000)', rW.weight_ok === false);
    const forced = await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: con.id, p_template: 'phyto', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(rW.content), p_vc: {}, p_code: 'WOURI-W-BAD' });
    ok('issue_document refuses on a weight mismatch (server-side)', !!forced.error && /weight/.test(forced.error.message));
    await a.from('contracts').update({ quantity_kg: 1000 }).eq('id', contract.id);
  }

  // Revoked reads revoked.
  {
    await a.rpc('revoke_document', { p_id: idE, p_reason: 'superseded' });
    const vd = (await anonClient().rpc('verify_document', { p_code: codeE })).data;
    ok('a revoked document reads revoked to anyone', vd.status === 'revoked' && vd.revoked_reason === 'superseded');
  }

  // Tamper detection on the quality cert: change the signed subject, then the sig.
  {
    const codeQ = globalThis.__codeQ;
    const idQrow = (await pgClient.query('select id from documents where verification_code = $1', [codeQ])).rows[0].id;
    await pgClient.query(`update documents set vc = jsonb_set(vc, '{credentialSubject,moisture_pct}', '99') where id = $1`, [idQrow]);
    let vd = (await anonClient().rpc('verify_document', { p_code: codeQ })).data;
    let v = verifyCredential(vd.vc, vd.public_key);
    ok('tampering the signed subject is detected (content-hash-mismatch)', v.ok === false && v.reason === 'content-hash-mismatch');

    await pgClient.query(`update documents set vc = jsonb_set(jsonb_set(vc, '{credentialSubject,moisture_pct}', '7.2'), '{proof,proofValue}', '"AAAAAA"') where id = $1`, [idQrow]);
    vd = (await anonClient().rpc('verify_document', { p_code: codeQ })).data;
    v = verifyCredential(vd.vc, vd.public_key);
    ok('tampering the signature is detected (bad-signature)', v.ok === false && v.reason === 'bad-signature');
  }

  // RLS: anon and tenant B see no documents through the table.
  {
    const anonDocs = (await anonClient().from('documents').select('id')).data ?? [];
    ok('anon reads no documents through the table', anonDocs.length === 0);
    const bDocs = (await b.from('documents').select('id').eq('organization_id', orgA)).data ?? [];
    ok('tenant B reads no A documents', bDocs.length === 0);
  }

  await cleanup();
  {
    const { data } = await admin.from('organizations').select('slug').in('slug', [SLUG, SLUG_B]);
    ok('cleanup removed the test tenants', (data?.length ?? 0) === 0);
  }
  console.log(`\ndocument-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('document-selftest error:', e.message);
  await cleanup().catch(() => {});
  fail++;
} finally {
  await pgClient.end().catch(() => {});
}
process.exit(fail > 0 ? 1 : 0);
