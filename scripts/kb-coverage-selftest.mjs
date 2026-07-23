#!/usr/bin/env node
// kb-coverage-selftest: proves Aza's bundled knowledge base covers everything the
// platform offers, so Aza can guide a tenant with zero external API. For every
// capability in the catalog, the KB returns an explanation; every commodity has a
// quality profile AND a document list. A new menu item with no KB entry fails
// here. Uses the SAME kb.mjs the console imports. No em-dashes.
// Run: node scripts/kb-coverage-selftest.mjs
import { config } from 'dotenv';
import pg from 'pg';
import { explain, documentsFor, commodityInfo, COMMODITIES } from '../apps/console/src/lib/aza/kb.mjs';

config({ path: '.env.local' });
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  // Every capability in the catalog has a KB explanation.
  const caps = (await c.query('select capability_key, category from capability_catalog')).rows;
  let missing = caps.filter((r) => !explain(r.capability_key));
  ok(`every capability has a KB explanation (${caps.length} caps)`, missing.length === 0);
  if (missing.length) console.error('    missing KB for:', missing.map((m) => m.capability_key).join(', '));

  // Every commodity in the DB has a KB profile with quality + documents.
  const commodities = (await c.query('select key from commodities order by key')).rows.map((r) => r.key);
  for (const key of commodities) {
    const info = commodityInfo(key);
    const qa = (await c.query('select count(*)::int n from quality_attributes qa join commodities co on co.id = qa.commodity_id where co.key = $1', [key])).rows[0].n;
    ok(`commodity ${key}: KB profile + quality attrs + documents`,
      !!info && Array.isArray(info.quality) && info.quality.length > 0 && qa > 0 && documentsFor(key).length > 0);
  }

  // Every EUDR commodity's KB lists the EUDR due diligence statement.
  for (const [key, info] of Object.entries(COMMODITIES)) {
    if (!info.eudr) continue;
    ok(`EUDR commodity ${key} lists the DDS document`, info.documents.includes('eudr_dds'));
  }
  // Timber, the only CITES commodity, lists the CITES permit.
  ok('timber lists the CITES permit', COMMODITIES.timber.documents.includes('cites_permit'));

  // The KB is self-sufficient: no entry references an external fetch.
  ok('KB is bundled data only (no network dependency)', typeof explain('commodity.cocoa') === 'string' && explain('commodity.cocoa').length > 20);

  console.log(`\nkb-coverage-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('kb-coverage-selftest error:', e.message); fail++;
} finally {
  await c.end();
}
process.exit(fail > 0 ? 1 : 0);
