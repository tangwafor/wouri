#!/usr/bin/env node
// grant-platform-admin: make a user a platform admin so they can edit the Aza
// knowledge base at /admin/kb. Run by an operator with the service DB url; there
// is no client path to grant this. No em-dashes.
// Run: node scripts/grant-platform-admin.mjs someone@example.com
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local' });
const email = process.argv[2];
if (!email) { console.error('usage: node scripts/grant-platform-admin.mjs <email>'); process.exit(1); }

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
const u = await c.query('select id from auth.users where email = $1', [email]);
if (!u.rowCount) {
  console.error(`no user with email ${email} (they must sign up first).`);
  await c.end(); process.exit(1);
}
await c.query(
  "insert into platform_admins (auth_user_id, note) values ($1, $2) on conflict (auth_user_id) do nothing",
  [u.rows[0].id, 'granted via grant-platform-admin script'],
);
console.log(`grant-platform-admin: ${email} is now a platform admin.`);
await c.end();
