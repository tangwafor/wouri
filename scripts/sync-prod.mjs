#!/usr/bin/env node
// sync-prod: apply every migration to the PRODUCTION project, guarded. Prod does not
// exist yet; this is ready for when it does. It refuses to run unless PROD_DB_URL is
// set, it is NOT the dev database, and --confirm is passed, so it can never be fired
// by accident. After applying, run prod-readiness against the same target. No em-dashes.
// Run: PROD_DB_URL=... node scripts/sync-prod.mjs --confirm
import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: '.env.local' });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prod = process.env.PROD_DB_URL;
const dev = process.env.SUPABASE_DB_URL;

if (!prod) { console.error('sync-prod: PROD_DB_URL is not set. Provision the production project first (see docs/delivery/GO_LIVE.md).'); process.exit(2); }
if (prod === dev) { console.error('sync-prod: PROD_DB_URL equals the dev SUPABASE_DB_URL. Refusing.'); process.exit(2); }
if (!process.argv.includes('--confirm')) { console.error('sync-prod: this applies migrations to PRODUCTION. Re-run with --confirm once you are sure.'); process.exit(2); }

console.log('sync-prod: applying migrations to the production project...');
const r = spawnSync('node', ['scripts/apply-migrations.mjs'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, WOURI_APPLY_URL: prod } });
if (r.status !== 0) { console.error('sync-prod: apply failed'); process.exit(r.status ?? 1); }
console.log('\nsync-prod: applied. Now verify parity:\n  TARGET_DB_URL=$PROD_DB_URL TARGET_SUPABASE_URL=$PROD_URL TARGET_SERVICE_ROLE_KEY=$PROD_SVC node scripts/prod-readiness.mjs');
