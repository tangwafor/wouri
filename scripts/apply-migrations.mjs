#!/usr/bin/env node
// apply-migrations.mjs: apply supabase/migrations/*.sql in order to the project in
// SUPABASE_DB_URL, tracking applied files in a _wouri_migrations table. Idempotent.
// No em-dashes.
import { config } from 'dotenv';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

config({ path: '.env.local' });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'supabase/migrations');

const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error('SUPABASE_DB_URL not set'); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`create table if not exists _wouri_migrations (
  name text primary key, applied_at timestamptz not null default now())`);
// The migrations ledger is operational, not app data. No app role reaches it
// (rls-coverage gate: a reachable table with no RLS is a leak class).
await client.query('revoke all on _wouri_migrations from anon, authenticated');

const applied = new Set((await client.query('select name from _wouri_migrations')).rows.map(r => r.name));
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

let n = 0;
for (const f of files) {
  if (applied.has(f)) { console.log(`skip  ${f}`); continue; }
  const sql = readFileSync(resolve(dir, f), 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into _wouri_migrations (name) values ($1)', [f]);
    await client.query('commit');
    console.log(`apply ${f}`);
    n++;
  } catch (e) {
    await client.query('rollback');
    console.error(`FAIL  ${f}: ${e.message}`);
    await client.end();
    process.exit(1);
  }
}
console.log(`\n${n} migration(s) applied, ${files.length} total.`);
await client.end();
