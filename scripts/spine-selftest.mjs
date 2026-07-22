#!/usr/bin/env node
// spine-selftest: proves the Sprint 1 gates against wouri-dev, through the real
// client and JWT where a user would act, and through a direct connection only to
// simulate an attacker tampering with stored bytes. Gates: RLS isolation (anon
// and wrong tenant), lot_events append-only (client and owner both refused), the
// per-lot hash chain verifies and DETECTS tampering, the CITES-not-mass-balance
// moat rule, compensating events, and the server chain + secret sealed from
// clients. Self-cleaning. No em-dashes. Run: node scripts/spine-selftest.mjs
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

config({ path: '.env.local' });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.SUPABASE_DB_URL;

const admin = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log(`  PASS ${n}`); } else { fail++; console.error(`  FAIL ${n}`); } };
const PW = 'WouriTest2026!';
const SLUGS = ['spine-a', 'spine-b'];
const EMAILS = ['spinetest+a@wouri.test', 'spinetest+b@wouri.test'];

async function cleanup() {
  // Tear the tenants down through the controlled purge path: the cascade delete of
  // append-only lot_events is allowed only inside a session that set wouri.purge.
  try {
    await pgClient.query('begin');
    await pgClient.query("set local wouri.purge = 'on'");
    await pgClient.query('delete from organizations where slug = any($1)', [SLUGS]);
    await pgClient.query('commit');
  } catch { await pgClient.query('rollback').catch(() => {}); }
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const u of (data?.users ?? [])) {
    if (EMAILS.includes(u.email ?? '')) await admin.auth.admin.deleteUser(u.id);
  }
}
async function signedIn(email) {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error('signIn ' + email + ': ' + error.message);
  return c;
}

const pgClient = new pg.Client({ connectionString: DB });

try {
  console.log('spine-selftest: begin');
  await pgClient.connect();
  await cleanup();
  await admin.auth.admin.createUser({ email: EMAILS[0], password: PW, email_confirm: true });
  await admin.auth.admin.createUser({ email: EMAILS[1], password: PW, email_confirm: true });

  const a = await signedIn(EMAILS[0]);
  const b = await signedIn(EMAILS[1]);
  const rpcA = (await a.rpc('create_organization', { p_org_name: 'Spine A', p_org_slug: SLUGS[0], p_first_location_name: 'Kumba', p_country: 'CM', p_locale: 'fr' })).data;
  await b.rpc('create_organization', { p_org_name: 'Spine B', p_org_slug: SLUGS[1], p_first_location_name: 'Douala', p_country: 'CM', p_locale: 'fr' });
  const orgA = rpcA.organization_id;

  const cocoa = (await a.from('commodities').select('id').eq('key', 'cocoa').single()).data;
  ok('a reads the shared commodity catalog', !!cocoa?.id);

  // Create a lot.
  const lot = (await a.from('lots').insert({ organization_id: orgA, commodity_id: cocoa.id, code: 'LOT-A-1', claim: 'segregated', quantity_kg: 1000 }).select().single()).data;
  ok('a creates a lot through the client (member policy)', !!lot?.id);

  // The moat rule: CITES-listed cannot be mass_balance; the identity-preserved control passes.
  {
    const bad = await a.from('lots').insert({ organization_id: orgA, commodity_id: cocoa.id, code: 'LOT-CITES-BAD', claim: 'mass_balance', is_cites_listed: true, quantity_kg: 5 });
    ok('CITES-listed + mass_balance is refused (the moat rule)', !!bad.error);
    const good = await a.from('lots').insert({ organization_id: orgA, commodity_id: cocoa.id, code: 'LOT-CITES-OK', claim: 'identity_preserved', is_cites_listed: true, quantity_kg: 5 });
    ok('positive control: CITES-listed + identity_preserved is allowed', !good.error);
  }

  // Record three custody events through the RPC; the server seals seq + hashes.
  const e = [randomUUID(), randomUUID(), randomUUID()];
  await a.rpc('record_lot_event', { p_id: e[0], p_lot: lot.id, p_type: 'harvest_received', p_payload: { bags: 20 } });
  await a.rpc('record_lot_event', { p_id: e[1], p_lot: lot.id, p_type: 'weighed', p_payload: { kg: 1000 } });
  await a.rpc('record_lot_event', { p_id: e[2], p_lot: lot.id, p_type: 'moved', p_payload: { to: 'warehouse-1' } });

  const evs = (await a.from('lot_events').select('id, seq, prev_event_hash, event_hash').eq('lot_id', lot.id).order('seq')).data ?? [];
  ok('three events sealed with seq 1,2,3', evs.length === 3 && evs[0].seq === 1 && evs[2].seq === 3);
  ok('the hash chain links (each prev = the prior event_hash)',
    evs[0].prev_event_hash === null && evs[1].prev_event_hash === evs[0].event_hash && evs[2].prev_event_hash === evs[1].event_hash);

  // Idempotent replay: re-recording the same client uuid does not duplicate.
  await a.rpc('record_lot_event', { p_id: e[0], p_lot: lot.id, p_type: 'harvest_received', p_payload: { bags: 20 } });
  const cnt = (await a.from('lot_events').select('id').eq('lot_id', lot.id)).data?.length;
  ok('re-recording the same event uuid is idempotent (still 3)', cnt === 3);

  // verify_lot_chain confirms the chain.
  const v1 = (await a.rpc('verify_lot_chain', { p_lot: lot.id })).data?.[0];
  ok('verify_lot_chain reports intact, checked 3', v1?.ok === true && v1?.checked === 3);

  // Append-only through the client: update and delete refused, row unchanged.
  {
    await a.from('lot_events').update({ event_type: 'hacked' }).eq('id', e[0]);
    await a.from('lot_events').delete().eq('id', e[0]);
    const still = (await a.from('lot_events').select('event_type').eq('id', e[0]).single()).data;
    ok('client update/delete on lot_events does not change it', still?.event_type === 'harvest_received');
  }

  // Append-only against the owner too: the trigger raises even on a direct update.
  {
    let raised = false;
    try { await pgClient.query('update lot_events set payload = $1 where id = $2', ['{"x":1}', e[1]]); }
    catch (err) { raised = /append-only/.test(err.message); }
    ok('a direct owner update on lot_events raises append-only', raised);
  }

  // Compensating event: void the middle event, original survives, chain still intact.
  {
    const vid = randomUUID();
    await a.rpc('void_lot_event', { p_id: vid, p_target: e[1], p_reason: 'wrong weight' });
    const rows = (await a.from('lot_events').select('id, event_type, compensates_event_id').eq('lot_id', lot.id).order('seq')).data ?? [];
    const voidRow = rows.find((r) => r.event_type === 'custody_event_voided');
    ok('void appends a compensating event pointing at its target', !!voidRow && voidRow.compensates_event_id === e[1]);
    ok('the voided original event still exists (no delete)', rows.some((r) => r.id === e[1]));
    const v2 = (await a.rpc('verify_lot_chain', { p_lot: lot.id })).data?.[0];
    ok('chain still intact after the compensating event (4)', v2?.ok === true && v2?.checked === 4);
  }

  // Tamper detection: corrupt a stored payload directly (disabling the guard as an
  // attacker with DB access would) and confirm verify_lot_chain catches it.
  {
    await pgClient.query('alter table lot_events disable trigger lot_events_no_mutate');
    await pgClient.query('update lot_events set payload = $1 where id = $2', ['{"tampered":true}', e[0]]);
    await pgClient.query('alter table lot_events enable trigger lot_events_no_mutate');
    const v = (await pgClient.query('select * from verify_lot_chain($1)', [lot.id])).rows[0];
    ok('verify_lot_chain DETECTS the tampered event', v.ok === false && /mismatch/.test(v.detail));
  }

  // RLS isolation: b and anon see nothing of a.
  {
    const bLots = (await b.from('lots').select('id').eq('organization_id', orgA)).data ?? [];
    ok('tenant B cannot see A lots', bLots.length === 0);
    const bEvents = (await b.from('lot_events').select('id').eq('lot_id', lot.id)).data ?? [];
    ok('tenant B cannot see A events', bEvents.length === 0);
    const anonLots = (await anonClient().from('lots').select('id')).data ?? [];
    ok('anon sees no lots', anonLots.length === 0);
  }

  // The server chain and the secret are sealed from clients.
  {
    const chain = await a.from('server_event_chain').select('id');
    ok('the server chain is unreadable through the client', (chain.data?.length ?? 0) === 0);
    const secret = await a.from('wouri_secrets').select('secret');
    ok('the server secret is unreadable through the client', (secret.data?.length ?? 0) === 0);
    // But it was written server-side: one chain row per event for org A.
    const n = (await pgClient.query('select count(*)::int c from server_event_chain where organization_id = $1', [orgA])).rows[0].c;
    ok('the server chain counter-signed every event (5 rows)', n === 5);
  }

  await cleanup();
  {
    const { data } = await admin.from('organizations').select('slug').in('slug', SLUGS);
    ok('cleanup removed the test tenants', (data?.length ?? 0) === 0);
  }

  console.log(`\nspine-selftest: ${pass} passed, ${fail} failed.`);
} catch (e) {
  console.error('spine-selftest error:', e.message);
  await cleanup().catch(() => {});
  fail++;
} finally {
  await pgClient.end().catch(() => {});
}
process.exit(fail > 0 ? 1 : 0);
