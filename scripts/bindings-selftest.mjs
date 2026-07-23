#!/usr/bin/env node
// bindings-selftest: proves the data-driven document resolver (0034). Two claims:
// (1) every issued document records provenance (where each field came from), and
// (2) a brand-new document type works by inserting binding rows, with no change to
// resolve_document. Self-cleaning. No em-dashes.
// Run: node scripts/bindings-selftest.mjs
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
const SLUG = 'bind-a', EMAIL = 'bindtest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const META = (template, code) => ({ issuer: 'wouri:org:bind-a', validFrom: '2026-07-23T09:00:00Z', template, templateVersion: 'v1', packVersion: 'cm-docs-v1', verificationCode: code });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  await pgc.query("delete from document_field_bindings where template_key='test_cert'").catch(() => {});
  await pgc.query("delete from document_templates where key='test_cert'").catch(() => {});
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('bindings-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Bind A', p_org_slug: SLUG, p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  const PRIV = (await pgc.query("select secret from wouri_secrets where key_name = 'proof_private_pem'")).rows[0].secret;
  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data;
  const buyer = (await a.from('parties').insert({ organization_id: orgA, kind: 'buyer', name: 'EU Buyer GmbH', country: 'DE' }).select().single()).data;
  const lot = (await a.from('lots').insert({ organization_id: orgA, commodity_id: cocoa.id, code: 'LOT-B-1', claim: 'segregated', quantity_kg: 1000 }).select().single()).data;
  const contract = (await a.from('contracts').insert({ organization_id: orgA, code: 'CT-B', buyer_party_id: buyer.id, commodity_id: cocoa.id, quantity_kg: 1000 }).select().single()).data;
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-B', buyer_party_id: buyer.id, contract_id: contract.id, destination_country: 'DE' }).select().single()).data;
  await a.from('consignment_lots').insert({ consignment_id: con.id, lot_id: lot.id, organization_id: orgA, quantity_kg: 1000 });

  // (1) Issue EUR.1 and check the provenance was recorded.
  const rEur = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'eur1_cmr' })).data;
  ok('resolve returns a provenance array', Array.isArray(rEur.provenance) && rEur.provenance.length > 0);
  ok('provenance names the source of a field (exporter <- org.legal_name)',
    rEur.provenance.some((p) => p.field === 'exporter' && p.source_kind === 'org' && p.source_ref === 'legal_name'));
  const code = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
  const vc = issueCredential(rEur.content, META('eur1_cmr', code), PRIV);
  const docId = (await a.rpc('issue_document', { p_id: randomUUID(), p_consignment: con.id, p_template: 'eur1_cmr', p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: contentHash(rEur.content), p_vc: vc, p_code: code })).data;
  const prov = (await a.from('document_bindings').select('field_key, source_kind, source_ref, value').eq('document_id', docId)).data ?? [];
  ok('issued document has provenance rows', prov.length >= 6);
  ok('a provenance row answers which source produced hs_code', prov.some((p) => p.field_key === 'hs_code' && p.source_kind === 'commodity'));
  ok('a member can read the provenance value', prov.some((p) => p.field_key === 'net_weight_kg' && Number(p.value) === 1000));

  // (2) Add a BRAND-NEW document type entirely by data: a template + bindings, with
  // NO change to resolve_document.
  await pgc.query(`insert into document_templates (key, version, title_fr, title_en) values ('test_cert','v1','Test','Test')`);
  await pgc.query(`insert into document_field_bindings (template_key, template_version, field_key, source_kind, source_ref, datatype, required, sort) values
    ('test_cert','v1','exporter','org','legal_name','text',true,1),
    ('test_cert','v1','a_literal','literal','HELLO','text',false,20),
    ('test_cert','v1','the_weight','computed','net_weight_kg','number',true,21)`);
  const rNew = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'test_cert' })).data;
  ok('a new document type resolves with no function change (literal field)', rNew.content.a_literal === 'HELLO');
  ok('the new type resolves a computed field', Number(rNew.content.the_weight) === 1000);
  ok('the new type carries the common required fields', rNew.content.exporter === 'Bind A' && rNew.unbound.length === 0);

  await cleanup();
  console.log(`\nbindings-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('bindings-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
