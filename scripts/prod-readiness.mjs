#!/usr/bin/env node
// prod-readiness: assert the go-live bar against a target project (default: the
// current SUPABASE_DB_URL). Structural checks that must hold before Wouri serves a
// real exporter. Hard-fails on the structural bar; warns on things that are fine on
// dev but must be clean on prod (test accounts). No em-dashes.
// Run: node scripts/prod-readiness.mjs   (or TARGET_DB_URL=... node scripts/prod-readiness.mjs)
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

config({ path: '.env.local' });
const url = process.env.TARGET_DB_URL || process.env.SUPABASE_DB_URL;
if (!url) { console.error('prod-readiness: no target DB url'); process.exit(2); }
const migDir = resolve(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let fail = 0, warn = 0;
const ok = (n, cond, d) => { if (cond) console.log('  PASS ' + n); else { fail++; console.error('  FAIL ' + n + (d ? '  ' + d : '')); } };
const warnIf = (n, cond, d) => { if (cond) { warn++; console.warn('  WARN ' + n + (d ? '  ' + d : '')); } else console.log('  PASS ' + n); };

try {
  await c.connect();

  // 1. Every migration is applied.
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  const applied = new Set((await c.query('select name from _wouri_migrations')).rows.map((r) => r.name));
  const missing = files.filter((f) => !applied.has(f));
  ok('every migration is applied', missing.length === 0, missing.join(', '));

  // 2. RLS coverage: no anon/authenticated-reachable table without RLS (excl extension-owned).
  const leaky = (await c.query(`
    select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    join information_schema.role_table_grants g on g.table_schema='public' and g.table_name=c.relname and g.grantee in ('anon','authenticated')
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
      and not exists (select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')`)).rows.map((r) => r.relname);
  ok('every reachable table has RLS', leaky.length === 0, leaky.join(', '));

  // 3. Secrets and the server chain are deny-all.
  for (const t of ['wouri_secrets', 'server_event_chain']) {
    const r = (await c.query(`select c.relrowsecurity rls, (select count(*) from pg_policy p where p.polrelid=c.oid) n from pg_class c join pg_namespace nsp on nsp.oid=c.relnamespace where nsp.nspname='public' and c.relname=$1`, [t])).rows[0];
    ok(`${t} is deny-all`, r && r.rls && Number(r.n) === 0);
  }

  // 4. The proof keys exist (documents can be signed and verified).
  const keys = (await c.query("select key_name from wouri_secrets where key_name in ('proof_private_pem','proof_public_pem','lot_chain_hmac')")).rows.map((r) => r.key_name);
  ok('signing + chain keys are provisioned', keys.length >= 3, 'have: ' + keys.join(', '));

  // 5. Internal definer functions are not client-callable.
  const exposed = (await c.query(`
    select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array['notify','resolve_document_core','document_staleness_core','document_is_stale'])
      and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))`)).rows.map((r) => r.proname);
  ok('internal definer functions are locked', exposed.length === 0, exposed.join(', '));

  // 6. No .test accounts (fine on dev; must be zero on prod).
  const svc = process.env.TARGET_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const surl = process.env.TARGET_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (svc && surl) {
    const admin = createClient(surl, svc, { auth: { persistSession: false } });
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    const dotTest = (data?.users ?? []).filter((u) => /\.test$/i.test(u.email ?? '')).length;
    warnIf('no .test accounts (must be 0 on prod)', dotTest > 0, `${dotTest} found (expected on dev; purge before prod)`);
  }

  console.log(`\nprod-readiness: ${fail} failure(s), ${warn} warning(s).`);
} catch (e) { console.error('prod-readiness error:', e.message); fail++; }
finally { await c.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
