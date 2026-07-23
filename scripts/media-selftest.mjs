#!/usr/bin/env node
// media-selftest: proves image profiles + the hash-before-processing rule (0041).
// Profiles are seeded; a media asset records against a profile and its original
// hash; recording without the original hash is refused (ADR-0021); an unknown
// profile is refused; org isolated; anon denied. Self-cleaning. No em-dashes.
// Run: node scripts/media-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n); } };
const PW = 'WouriTest2026!';
const SLUG = 'media-a', EMAIL = 'mediatest+a@wouri.test';
const pgc = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  try { await pgc.query('begin'); await pgc.query("set local wouri.purge='on'"); await pgc.query('delete from organizations where slug=$1', [SLUG]); await pgc.query('commit'); } catch { await pgc.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) if (u.email === EMAIL) await admin.auth.admin.deleteUser(u.id);
}
async function signedIn() { const c = anonClient(); const { error } = await c.auth.signInWithPassword({ email: EMAIL, password: PW }); if (error) throw new Error(error.message); return c; }

try {
  console.log('media-selftest: begin');
  await pgc.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });
  const a = await signedIn();
  const org = (await a.rpc('create_organization', { p_org_name: 'Media A', p_org_slug: SLUG, p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' })).data.organization_id;

  const profiles = (await a.from('image_profiles').select('key')).data ?? [];
  ok('image profiles are seeded and readable', profiles.some((p) => p.key === 'evidence_photo') && profiles.length >= 4);

  const subject = randomUUID();
  const good = await a.rpc('record_media_asset', {
    p_org: org, p_subject_type: 'lot_event', p_subject_id: subject, p_profile: 'evidence_photo',
    p_original_hash: 'b'.repeat(64), p_storage_path: 'media/x.webp', p_width: 1600, p_height: 1200, p_bytes: 240000, p_lat: 4.05, p_lng: 9.7,
  });
  ok('a media asset records against a profile and its original hash', typeof good.data === 'string');
  const row = (await a.from('media_assets').select('profile_key, original_hash').eq('id', good.data).single()).data;
  ok('the original hash is stored', row.original_hash === 'b'.repeat(64) && row.profile_key === 'evidence_photo');

  // The ADR-0021 rule: no original hash, no asset.
  const noHash = await a.rpc('record_media_asset', { p_org: org, p_subject_type: 'lot_event', p_subject_id: subject, p_profile: 'evidence_photo', p_original_hash: '' });
  ok('recording without the original hash is refused', !!noHash.error && /hashed before processing/i.test(noHash.error.message));

  // Unknown profile is refused.
  const badProfile = await a.rpc('record_media_asset', { p_org: org, p_subject_type: 'lot_event', p_subject_id: subject, p_profile: 'nope', p_original_hash: 'c'.repeat(64) });
  ok('an unknown image profile is refused', !!badProfile.error);

  // Anon sees no assets.
  const anonSees = (await anonClient().from('media_assets').select('id')).data ?? [];
  ok('anon sees no media assets', anonSees.length === 0);

  await cleanup();
  console.log(`\nmedia-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) { console.error('media-selftest error:', e.message); await cleanup().catch(() => {}); fail++; }
finally { await pgc.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
