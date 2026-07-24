#!/usr/bin/env node
// reconcile-consignment: the ADR-0030 tool. Given a fixture describing a REAL
// consignment file (the actual field values as they appear on the real EUR.1 /
// phyto / etc.), it builds the equivalent consignment in Wouri, resolves each
// document, and reports every field where Wouri's output DRIFTS from the real paper
// (wrong value, missing, or extra). This is how a genuine document reconciles the
// bindings: fill the fixture from a real file and run it. Self-cleaning. Exits
// non-zero on drift, so a committed real fixture becomes a gate. No em-dashes.
// Run: node scripts/reconcile-consignment.mjs [fixture.json]
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
const PW = 'WouriTest2026!';
const fixturePath = process.argv[2] || 'docs/delivery/reconciliation-fixture.example.json';
const fx = JSON.parse(readFileSync(resolve(process.cwd(), fixturePath), 'utf8'));
const TAG = 'zzrecon-' + (fx.tag || 'x').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
const EMAIL = TAG + '@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

const norm = (v) => (v == null ? '' : String(v).trim());
const numish = (v) => typeof v === 'number' || (/^-?\d+(\.\d+)?$/.test(norm(v)));
const eq = (a, b) => (numish(a) && numish(b) ? Number(a) === Number(b) : norm(a) === norm(b));

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [TAG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

let drift = 0;
try {
  console.log(`reconcile-consignment: ${fixturePath} (tag ${TAG})\n`);
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();

  // Build the spine from the fixture.
  const org = (await a.rpc('create_organization', { p_org_name: fx.org.name, p_org_slug: TAG, p_first_location_name: fx.org.location?.name || 'Origin', p_country: fx.org.location?.country || 'CM', p_locale: 'fr' })).data.organization_id;
  await pgc.query('update organizations set niu = $2 where id = $1', [org, fx.org.niu || null]);
  await pgc.query('update locations set region = $2, country = $3 where organization_id = $1', [org, fx.org.location?.region || null, fx.org.location?.country || 'CM']);

  const commodity = (await a.from('commodities').select('id').eq('key', fx.commodity).single()).data.id;
  const buyer = (await a.from('parties').insert({ organization_id: org, kind: 'buyer', name: fx.buyer.name, country: fx.buyer.country || null }).select().single()).data;
  const lot = (await a.from('lots').insert({ organization_id: org, commodity_id: commodity, code: fx.lot.code, claim: 'segregated', quantity_kg: fx.lot.quantity_kg }).select().single()).data;
  for (const [attr, val] of Object.entries(fx.lot.quality || {})) {
    const pack = (await a.from('quality_attributes').select('pack_version').eq('commodity_id', commodity).eq('key', attr).maybeSingle()).data?.pack_version;
    if (pack) await a.from('quality_values').insert({ organization_id: org, lot_id: lot.id, attribute_key: attr, numeric_value: val, pack_version: pack });
  }
  const contract = (await a.from('contracts').insert({ organization_id: org, code: fx.consignment.code + '-CT', buyer_party_id: buyer.id, commodity_id: commodity, quantity_kg: fx.contract?.quantity_kg ?? fx.lot.quantity_kg }).select().single()).data;
  const con = (await a.from('consignments').insert({ organization_id: org, code: fx.consignment.code, buyer_party_id: buyer.id, contract_id: contract.id, destination_country: fx.consignment.destination_country }).select().single()).data;
  await a.from('consignment_lots').insert({ consignment_id: con.id, lot_id: lot.id, organization_id: org, quantity_kg: fx.lot.quantity_kg });

  // Reconcile each document against the real paper.
  for (const doc of fx.documents) {
    console.log(`  --- ${doc.template} ---`);
    const r = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: doc.template })).data;
    const content = r?.content || {};
    for (const [field, real] of Object.entries(doc.expected)) {
      const wouri = content[field];
      if (wouri === undefined || wouri === null) { drift++; console.log(`  MISSING  ${field}: real="${norm(real)}", Wouri produced nothing`); }
      else if (!eq(wouri, real)) { drift++; console.log(`  DRIFT    ${field}: Wouri="${norm(wouri)}"  real="${norm(real)}"`); }
      else console.log(`  ok       ${field} = ${norm(wouri)}`);
    }
    // Fields Wouri produces that are not on the real paper (informational).
    for (const field of Object.keys(content)) {
      if (!(field in doc.expected) && !/^exporter_brand|^exporter_tagline/.test(field)) console.log(`  extra    ${field} = ${norm(content[field])} (Wouri produces this; not listed on the real doc)`);
    }
    if (r?.unbound?.length) console.log(`  unbound  ${r.unbound.join(', ')}`);
    console.log('');
  }

  await cleanup();
  console.log(drift === 0 ? 'reconcile: NO DRIFT. Wouri matches the real file.' : `reconcile: ${drift} field(s) drift from the real file (see above). These are the bindings to reconcile.`);
} catch (e) { console.error('reconcile error:', e.message); await cleanup().catch(() => {}); process.exit(2); }
finally { await pgc.end().catch(() => {}); }
process.exit(drift > 0 ? 1 : 0);
