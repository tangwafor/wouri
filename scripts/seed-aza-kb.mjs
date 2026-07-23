#!/usr/bin/env node
// seed-aza-kb: mirror the bundled Aza knowledge base (kb.mjs) into the editable
// aza_kb table. The bundled module stays the offline floor and the seed source;
// the table is what an owner curates. Idempotent upsert by key. No em-dashes.
// Run: node scripts/seed-aza-kb.mjs
import { config } from 'dotenv';
import pg from 'pg';
import { COMMODITIES, RAILS, REGULATIONS, CAPABILITIES } from '../apps/console/src/lib/aza/kb.mjs';

config({ path: '.env.local' });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();

const rows = [];
for (const [k, v] of Object.entries(COMMODITIES)) rows.push({
  key: 'commodity.' + k, kind: 'commodity', label_en: v.label_en, label_fr: v.label_fr,
  body_en: v.what_en, body_fr: v.what_fr,
  data: { hs_code: v.hs_code, eudr: v.eudr, cites: v.cites, body: v.body, quality: v.quality, documents: v.documents },
  source: (v.sources || []).join('; '), review_by: null,
});
for (const [k, v] of Object.entries(RAILS)) rows.push({
  key: k, kind: 'rail', label_en: v.label_en, label_fr: v.label_fr, body_en: v.what_en, body_fr: v.what_fr,
  data: { applies_from: v.applies_from ?? null }, source: (v.sources || []).join('; '), review_by: v.review_by ?? null,
});
for (const [k, v] of Object.entries(REGULATIONS)) rows.push({
  key: 'reg.' + k, kind: 'regulation', label_en: v.title_en, label_fr: v.title_fr, body_en: v.what_en, body_fr: null,
  data: { applies_from: v.applies_from ?? null }, source: (v.sources || []).join('; '), review_by: v.review_by ?? null,
});
for (const [k, v] of Object.entries(CAPABILITIES)) rows.push({
  key: 'cap.' + k, kind: 'capability', label_en: v.label_en, label_fr: null, body_en: v.what_en, body_fr: null,
  data: {}, source: null, review_by: null,
});

let n = 0;
for (const r of rows) {
  await c.query(
    `insert into aza_kb (key, kind, label_en, label_fr, body_en, body_fr, data, source, review_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (key) do update set kind=excluded.kind, label_en=excluded.label_en, label_fr=excluded.label_fr,
       body_en=excluded.body_en, body_fr=excluded.body_fr, data=excluded.data, source=excluded.source, review_by=excluded.review_by`,
    [r.key, r.kind, r.label_en, r.label_fr, r.body_en, r.body_fr, JSON.stringify(r.data), r.source, r.review_by],
  );
  n++;
}
console.log(`seed-aza-kb: upserted ${n} entries.`);
await c.end();
