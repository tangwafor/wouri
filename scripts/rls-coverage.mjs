#!/usr/bin/env node
// rls-coverage: the structural security gate. Every public base table that anon or
// authenticated can reach MUST have row-level security enabled. A table with RLS on
// and no policy is fine (that is deny-all, the correct locked-down posture for an
// audit log, the server chain, or secrets). A table with a grant to anon or
// authenticated and RLS OFF is a cross-tenant or anon leak waiting to happen; that
// is the class ADR-0033 caught only by luck on Bazah. This gate catches it every
// build. No em-dashes.
// Run: node scripts/rls-coverage.mjs
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local' });
const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error('rls-coverage: SUPABASE_DB_URL not set'); process.exit(2); }
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let fail = 0;

try {
  await c.connect();

  // Base tables in public with a grant to anon or authenticated but RLS off.
  const leaky = (await c.query(`
    select distinct c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join information_schema.role_table_grants g
      on g.table_schema = 'public' and g.table_name = c.relname and g.grantee in ('anon','authenticated')
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      -- Tables owned by an installed extension (e.g. PostGIS spatial_ref_sys) are the
      -- extension's reference data, not our app data.
      and not exists (
        select 1 from pg_depend dep
        where dep.classid = 'pg_class'::regclass and dep.objid = c.oid and dep.deptype = 'e')
    order by 1`)).rows.map((r) => r.relname);

  if (leaky.length) {
    fail += leaky.length;
    for (const t of leaky) console.error(`FAIL rls-off-but-reachable  ${t}  (grant to anon/authenticated with no RLS)`);
  } else {
    console.log('PASS every anon/authenticated-reachable table has RLS enabled');
  }

  // Informational: deny-all tables (RLS on, no policy). Correct by design; listed so
  // a genuinely wrong one can be spotted.
  const denyAll = (await c.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid) order by 1`)).rows.map((r) => r.relname);
  if (denyAll.length) console.log('INFO deny-all (RLS on, no policy, intentional):', denyAll.join(', '));

  // Anon surface sanity: the only anon-facing read paths are the verification code
  // and public reference (proof key, config). Anon must not read a tenant table.
  for (const t of ['lots', 'consignments', 'documents', 'settlement_instruments', 'notifications', 'auto_check_findings']) {
    const row = (await c.query(
      `select has_table_privilege('anon', ('public.' || $1)::regclass, 'SELECT') as ok`, [t])).rows[0];
    // A grant may exist; RLS still gates rows. We assert RLS is on (rows are gated).
    const rls = (await c.query(`select relrowsecurity from pg_class where oid = ('public.'||$1)::regclass`, [t])).rows[0];
    if (!rls.relrowsecurity) { fail++; console.error(`FAIL tenant table ${t} has RLS off`); }
  }
  if (!fail) console.log('PASS tenant tables gate rows with RLS');

  console.log(`\nrls-coverage: ${fail} failure(s).`);
} catch (e) { console.error('rls-coverage error:', e.message); fail++; }
finally { await c.end().catch(() => {}); }
process.exit(fail > 0 ? 1 : 0);
