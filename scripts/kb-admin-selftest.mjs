#!/usr/bin/env node
// kb-admin-selftest: proves the owner-editable KB is gated at the DATABASE, not
// just the UI. A signed-in non-admin cannot change aza_kb (RLS refuses the
// write, the row is unchanged); a platform admin can, and the edit is stamped.
// Self-cleaning on a throwaway KB key. No em-dashes.
// Run: node scripts/kb-admin-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };
const PW = 'WouriTest2026!';
const EMAIL = 'kbadmin+a@wouri.test';
const KEY = 'test.kb.selftest';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });

async function cleanup() {
  await pgc.query('delete from aza_kb where key = $1', [KEY]).catch(() => {});
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) {
    if (u.email === EMAIL) {
      await pgc.query('delete from platform_admins where auth_user_id = $1', [u.id]).catch(() => {});
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

try {
  console.log('kb-admin-selftest: begin');
  await pgc.connect();
  await cleanup();
  await pgc.query("insert into aza_kb (key, kind, body_en) values ($1,'capability','ORIGINAL')", [KEY]);
  const u = (await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true })).data.user;
  const a = anonClient();
  await a.auth.signInWithPassword({ email: EMAIL, password: PW });

  // Everyone may READ the KB.
  const readable = (await a.from('aza_kb').select('key').eq('key', KEY)).data;
  ok('a signed-in user can read the KB', readable?.length === 1);

  // A non-admin CANNOT write: RLS refuses, the row is unchanged.
  await a.from('aza_kb').update({ body_en: 'HACKED' }).eq('key', KEY);
  let body = (await pgc.query('select body_en from aza_kb where key = $1', [KEY])).rows[0].body_en;
  ok('a non-admin edit is refused by RLS (row unchanged)', body === 'ORIGINAL');

  // Grant platform admin, then the edit succeeds and is stamped.
  await pgc.query('insert into platform_admins (auth_user_id, note) values ($1, $2)', [u.id, 'selftest']);
  const r = await a.from('aza_kb').update({ body_en: 'EDITED BY ADMIN' }).eq('key', KEY);
  ok('a platform admin edit is accepted', !r.error);
  const row = (await pgc.query('select body_en, updated_by, updated_at from aza_kb where key = $1', [KEY])).rows[0];
  ok('the KB content changed', row.body_en === 'EDITED BY ADMIN');
  ok('the edit was stamped with the editor', !!row.updated_by);

  // Revoking admin closes the door again.
  await pgc.query('delete from platform_admins where auth_user_id = $1', [u.id]);
  await a.from('aza_kb').update({ body_en: 'HACKED AGAIN' }).eq('key', KEY);
  body = (await pgc.query('select body_en from aza_kb where key = $1', [KEY])).rows[0].body_en;
  ok('after revoke, edits are refused again', body === 'EDITED BY ADMIN');

  await cleanup();
  console.log(`\nkb-admin-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('kb-admin-selftest error:', e.message);
  await cleanup().catch(() => {});
  fail++;
} finally {
  await pgc.end().catch(() => {});
}
process.exit(fail > 0 ? 1 : 0);
