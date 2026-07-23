#!/usr/bin/env node
// e2e-cleanup: delete everything the critical-path e2e creates (tagged zze2e) and,
// with --check, PROVE the environment is left clean. Self-cleaning is a canonical
// requirement of the critical-path gate. No em-dashes.
// Run: node scripts/e2e-cleanup.mjs [--check]
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

config({ path: '.env.local' });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const check = process.argv.includes('--check');

async function purge() {
  const slugs = (await pgc.query("select slug from organizations where slug like 'zze2e%'")).rows.map((r) => r.slug);
  for (const slug of slugs) {
    try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [slug]); await pgc.query('commit'); }
    catch (e) { await pgc.query('rollback').catch(() => {}); console.error('purge failed for', slug, e.message); }
  }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (/zze2e/i.test(u.email ?? '')) await admin.auth.admin.deleteUser(u.id);
}

try {
  await pgc.connect();
  await purge();
  if (check) {
    const orgs = (await pgc.query("select count(*)::int n from organizations where slug like 'zze2e%'")).rows[0].n;
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    const users = (data?.users ?? []).filter((u) => /zze2e/i.test(u.email ?? '')).length;
    if (orgs > 0 || users > 0) { console.error(`e2e-cleanup --check: NOT CLEAN (${orgs} orgs, ${users} users left)`); process.exit(1); }
    console.log('e2e-cleanup --check: environment is clean');
  } else {
    console.log('e2e-cleanup: purged');
  }
} catch (e) { console.error('e2e-cleanup error:', e.message); process.exit(1); }
finally { await pgc.end().catch(() => {}); }
