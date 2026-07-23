#!/usr/bin/env node
// brand-selftest: proves per-tenant document branding. An owner sets the brand;
// it lands in the resolved (and thus signed) document content; a non-admin of the
// org cannot set it. Self-cleaning. No em-dashes.
// Run: node scripts/brand-selftest.mjs
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
const SLUGS = ['brand-a', 'brand-b'];
const EMAILS = ['brandtest+a@wouri.test', 'brandtest+b@wouri.test'];
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug = any($1)', [SLUGS]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (EMAILS.includes(u.email ?? '')) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn(email) { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('brand-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAILS[0], password: PW, email_confirm: true });
  await admin.auth.admin.createUser({ email: EMAILS[1], password: PW, email_confirm: true });
  const a = await signedIn(EMAILS[0]); const b = await signedIn(EMAILS[1]);
  const orgA = (await a.rpc('create_organization', { p_org_name: 'Brand A', p_org_slug: SLUGS[0], p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr' })).data.organization_id;
  await b.rpc('create_organization', { p_org_name: 'Brand B', p_org_slug: SLUGS[1], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });

  // Owner sets the brand.
  const r = await a.rpc('update_org_brand', { p_org: orgA, p_color: '#123456', p_tagline: 'Fine Cameroon cocoa' });
  ok('owner sets the brand', !r.error);
  const brand = (await a.from('organizations').select('brand').eq('id', orgA).single()).data.brand;
  ok('brand colour + tagline stored', brand.color === '#123456' && brand.tagline === 'Fine Cameroon cocoa');

  // It lands in the resolved (signed) document content.
  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data;
  const lot = (await a.from('lots').insert({ organization_id: orgA, commodity_id: cocoa.id, code: 'LOT-BR', quantity_kg: 100 }).select().single()).data;
  const con = (await a.from('consignments').insert({ organization_id: orgA, code: 'CN-BR', destination_country: 'DE' }).select().single()).data;
  await a.from('consignment_lots').insert({ consignment_id: con.id, lot_id: lot.id, organization_id: orgA, quantity_kg: 100 });
  const res = (await a.rpc('resolve_document', { p_consignment: con.id, p_template: 'eur1_cmr' })).data;
  ok('the brand is baked into the document content', res.content.exporter_brand_color === '#123456' && res.content.exporter_tagline === 'Fine Cameroon cocoa');
  ok('brand fields are not required (do not block issuance)', !res.required.includes('exporter_brand_color'));

  // A non-admin of the org cannot set the brand.
  const bad = await b.rpc('update_org_brand', { p_org: orgA, p_color: '#ff0000', p_tagline: 'hijacked' });
  ok('a non-admin cannot set another org brand', !!bad.error);
  const still = (await a.from('organizations').select('brand').eq('id', orgA).single()).data.brand;
  ok('the brand is unchanged after the refused attempt', still.color === '#123456');

  await cleanup();
  console.log(`\nbrand-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('brand-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
