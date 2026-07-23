#!/usr/bin/env node
// security-check: the composite security gate (TaTech point 23). Four structural
// assertions against the database, each catching a known leak class:
//   1. Every anon/authenticated-reachable table has RLS (rls-coverage, inline).
//   2. The sensitive tables (secrets, server chain, audit) are deny-all.
//   3. Anon can read only the declared public-reference tables, nothing else.
//   4. No security-definer (non-invoker) view exists in public except an extension's
//      (the ADR-0033 enumerable-public-view class).
// Run: node scripts/security-check.mjs
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local' });
const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error('security-check: SUPABASE_DB_URL not set'); process.exit(2); }
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let fail = 0;
const ok = (n, cond, detail) => { if (cond) { console.log('  PASS ' + n); } else { fail++; console.error('  FAIL ' + n + (detail ? '  ' + detail : '')); } };

// Anon may read ONLY these public-reference / transparency tables. A new anon-exposed
// table that is not on this list is a leak until it is reviewed and added here.
const ANON_ALLOW = new Set([
  'anchor_digests', 'cites_quotas', 'document_field_bindings', 'image_profiles',
  'protected_areas', 'reference_kinds', 'registry_config',
]);
const DENY_ALL = ['wouri_secrets', 'server_event_chain', 'registry_audit'];

try {
  await c.connect();

  const leaky = (await c.query(`
    select distinct c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join information_schema.role_table_grants g on g.table_schema='public' and g.table_name=c.relname and g.grantee in ('anon','authenticated')
    where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
      and not exists (select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
    order by 1`)).rows.map((r) => r.relname);
  ok('every anon/authenticated-reachable table has RLS', leaky.length === 0, leaky.join(', '));

  for (const t of DENY_ALL) {
    const r = (await c.query(`
      select c.relrowsecurity, (select count(*) from pg_policy p where p.polrelid=c.oid) as npol
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=$1`, [t])).rows[0];
    ok(`${t} is deny-all (RLS on, no policy)`, r && r.relrowsecurity && Number(r.npol) === 0);
  }

  const anonTables = (await c.query(`
    select distinct c.relname from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and 'anon' = any(select rolname from pg_roles where oid = any(p.polroles))
    order by 1`)).rows.map((r) => r.relname);
  const unexpected = anonTables.filter((t) => !ANON_ALLOW.has(t));
  ok('anon reads only declared public-reference tables', unexpected.length === 0, 'unexpected: ' + unexpected.join(', '));

  const defViews = (await c.query(`
    select c.relname, c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v'
      and not exists (select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')`)).rows
    .filter((r) => !(r.reloptions || []).some((o) => o === 'security_invoker=true' || o === 'security_invoker=on'))
    .map((r) => r.relname);
  ok('no security-definer view in public (except extension-owned)', defViews.length === 0, defViews.join(', '));

  console.log(`\nsecurity-check: ${fail} failure(s).`);
} catch (e) { console.error('security-check error:', e.message); fail++; }
finally { await c.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
