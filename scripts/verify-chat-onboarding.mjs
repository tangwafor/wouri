#!/usr/bin/env node
// verify-chat-onboarding: prove the chat onboarding path end to end against
// wouri-dev, reproducing exactly what provisionWorkspace does: run Aza's real
// inference on a free-text business description, slugify the name, create the org
// through the create_organization RPC under the user JWT, enable the inferred
// capabilities through the client (RLS is the only gate), and confirm the tenant
// landed with precisely the right capability set, dependencies closed. Uses the
// SAME infer.mjs the console imports, so this cannot drift from the app.
// Self-cleaning. No em-dashes. Run: node scripts/verify-chat-onboarding.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { inferCapabilities } from '../apps/console/src/lib/onboarding/infer.mjs';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.error(`  FAIL ${n}`); } };
const PW = 'WouriTest2026!';
const SLUG = 'aza-cocoa-house';
const EMAIL = 'chattest+aza@wouri.test';

// Same as actions.ts slugify (kept in step; the logic is trivial and stable).
function slugify(name) {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'atelier';
}

async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) {
    if (u.email === EMAIL) {
      await admin.from('organizations').delete().eq('slug', SLUG);
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

try {
  console.log('verify-chat-onboarding: begin');
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAIL, password: PW, email_confirm: true });

  const c = anonClient();
  const { error: siErr } = await c.auth.signInWithPassword({ email: EMAIL, password: PW });
  if (siErr) throw new Error('signIn: ' + siErr.message);

  // The tenant types this into the chat. Aza infers, exactly as the UI does live.
  const NAME = 'Aza Cocoa House';
  const DESC = 'We export cocoa from Bakossi, must prepare the EUDR file, and need prefinancing with warehouse receipts.';
  const { keys } = inferCapabilities(DESC);
  const want = new Set(keys);

  ok('Aza inferred cocoa + eudr + financing + settlement (deps closed)',
    want.has('commodity.cocoa') && want.has('rail.eudr') && want.has('financing') && want.has('settlement'));

  // provisionWorkspace step 1: atomic org creation under the user JWT.
  const slug = slugify(NAME);
  ok('slugify(name) is url-safe', slug === SLUG);
  const { data: rpc, error: rpcErr } = await c.rpc('create_organization', {
    p_org_name: NAME, p_org_slug: slug, p_first_location_name: 'Siege', p_country: 'CM', p_locale: 'fr',
  });
  ok('chat creates the tenant through the RPC', !rpcErr && !!rpc?.organization_id);

  // provisionWorkspace step 2: find the org (RLS returns only the user's own).
  const { data: orgs } = await c.from('organizations').select('id, slug').limit(1);
  const orgId = orgs?.[0]?.id;
  ok('the new org is readable through RLS', orgs?.length === 1 && orgs[0].slug === SLUG);

  // provisionWorkspace step 3: enable the inferred capabilities through the client.
  const rows = keys.map((capability_key) => ({ organization_id: orgId, capability_key }));
  const { error: capErr } = await c.from('organization_capabilities')
    .upsert(rows, { onConflict: 'organization_id,capability_key' });
  ok('chat enables the inferred capabilities through the client', !capErr);

  // The tenant landed with EXACTLY the inferred set, no more, no less.
  const { data: got } = await c.from('organization_capabilities').select('capability_key');
  const gotSet = new Set((got ?? []).map((r) => r.capability_key));
  ok('the org has exactly the inferred capabilities',
    gotSet.size === want.size && [...want].every((k) => gotSet.has(k)));

  // Each one answers true through has_capability (the same gate the app reads).
  for (const k of ['commodity.cocoa', 'rail.eudr', 'settlement', 'financing']) {
    const { data: hc } = await c.rpc('has_capability', { p_org: orgId, p_cap: k });
    ok(`has_capability(${k}) is true`, hc === true);
  }
  // And a capability Aza did NOT infer is off.
  {
    const { data: hc } = await c.rpc('has_capability', { p_org: orgId, p_cap: 'rail.cites' });
    ok('has_capability(rail.cites) is false (not inferred)', hc === false);
  }

  await cleanup();
  {
    const { data } = await admin.from('organizations').select('slug').eq('slug', SLUG);
    ok('cleanup removed the test tenant', (data?.length ?? 0) === 0);
  }

  console.log(`\nverify-chat-onboarding: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('verify-chat-onboarding error:', e.message);
  await cleanup().catch(() => {});
  fail++;
}
process.exit(fail > 0 ? 1 : 0);
