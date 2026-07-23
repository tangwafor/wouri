-- Wouri 0028: SQL-based agentic auto-checks
-- The registry should watch itself. An auto-check is a stored SELECT that returns
-- findings (organization_id, entity_type, entity_id, detail); a scheduled runner
-- executes every enabled check, opens a finding for anything new, re-affirms what
-- is still true, and auto-resolves anything the check no longer reports. New
-- findings drop a notification for the org (0027). The checks catch what the
-- readiness board does not: money not being tracked, an EU consignment with no
-- DDS, a lot with no quality. The stored SQL is powerful, so only a platform
-- admin may write a check; the runner is SECURITY DEFINER and sweeps every org,
-- but each finding is attributed to its org and only that org's members see it.
-- Built under ADR-0033. No em-dashes.

create table if not exists auto_checks (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  title text not null,
  description text,
  severity text not null default 'warning' check (severity in ('info','warning','high','critical')),
  query text not null,   -- a SELECT returning columns: organization_id, entity_type, entity_id, detail
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists auto_check_findings (
  id uuid primary key default gen_random_uuid(),
  check_key text not null references auto_checks(key) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text,
  entity_id uuid,
  detail text not null,
  fingerprint text unique not null,   -- check + entity, so a finding is opened once and re-affirmed, not duplicated
  status text not null default 'open' check (status in ('open','resolved')),
  opened_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists acf_org on auto_check_findings (organization_id, status);
create index if not exists acf_check on auto_check_findings (check_key, status);

-- The runner. Dynamic EXECUTE of each stored check; a broken check is isolated so
-- it cannot break the sweep. Returns the count of newly opened findings.
create or replace function run_auto_checks()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_chk record; v_row record; v_run timestamptz := now(); v_fp text; v_existing uuid; v_new int := 0;
begin
  for v_chk in select * from auto_checks where enabled loop
    begin
      for v_row in execute v_chk.query loop
        v_fp := v_chk.key || ':' || coalesce(v_row.entity_id::text, md5(v_row.detail));
        select id into v_existing from auto_check_findings where fingerprint = v_fp;
        if v_existing is null then
          insert into auto_check_findings (check_key, organization_id, entity_type, entity_id, detail, fingerprint, last_seen)
            values (v_chk.key, v_row.organization_id, v_row.entity_type, v_row.entity_id, v_row.detail, v_fp, v_run);
          perform notify(v_row.organization_id, 'auto_check', v_chk.severity, v_chk.title, v_row.detail, v_row.entity_type, v_row.entity_id);
          v_new := v_new + 1;
        else
          update auto_check_findings set detail = v_row.detail, status = 'open', resolved_at = null, last_seen = v_run where id = v_existing;
        end if;
      end loop;
      -- auto-resolve: anything this check opened before but did not report this run
      update auto_check_findings set status = 'resolved', resolved_at = v_run
        where check_key = v_chk.key and status = 'open' and last_seen < v_run;
    exception when others then
      raise warning 'auto_check % failed: %', v_chk.key, sqlerrm;   -- isolate a broken check; keep sweeping
    end;
  end loop;
  return v_new;
end $$;

-- Seed checks that catch what the board does not. Each is a plain read-only SELECT
-- returning the finding shape. Owner-curated; not user input.
insert into auto_checks (key, title, description, severity, query) values
  ('shipped_without_settlement', 'Money not being tracked',
   'A shipment has sailed but no settlement instrument was recorded, so the repatriation clock never starts.', 'high',
   $q$ select sh.organization_id as organization_id, 'consignment'::text as entity_type, sh.consignment_id as entity_id,
         'Shipment ' || sh.status || ' but no settlement instrument recorded; the repatriation clock is not running' as detail
       from shipments sh
       where sh.status in ('sailed','arrived','cleared')
         and not exists (select 1 from settlement_instruments si where si.consignment_id = sh.consignment_id) $q$),
  ('eu_consignment_no_dds', 'EU consignment without a DDS',
   'A consignment bound for the EU has a document issued but no EUDR DDS reference, which will hold it at the border.', 'high',
   $q$ select c.organization_id as organization_id, 'consignment'::text as entity_type, c.id as entity_id,
         'EU-bound consignment ' || c.code || ' has a document issued but no EUDR DDS reference recorded' as detail
       from consignments c
       where upper(coalesce(c.destination_country,'')) in ('DE','FR','NL','BE','IT','ES','SE','PL','EU')
         and coalesce(c.dds_reference,'') = ''
         and exists (select 1 from documents d where d.consignment_id = c.id) $q$),
  ('open_lot_no_quality', 'Lot with no quality recorded',
   'An open lot has no quality values, so no quality certificate can be issued for it.', 'warning',
   $q$ select l.organization_id as organization_id, 'lot'::text as entity_type, l.id as entity_id,
         'Lot ' || l.code || ' has no recorded quality; a quality certificate cannot be issued' as detail
       from lots l
       where l.status <> 'closed'
         and not exists (select 1 from quality_values qv where qv.lot_id = l.id) $q$)
on conflict (key) do nothing;

-- RLS. The stored SQL is platform reference and powerful, so only a platform admin
-- reads or writes the check definitions. Findings are org data: members read their
-- own; only the definer runner writes them.
alter table auto_checks enable row level security;
revoke all on auto_checks from anon;
revoke all on auto_checks from authenticated;
grant select on auto_checks to authenticated;
create policy auto_checks_read on auto_checks for select to authenticated using (is_platform_admin());
create policy auto_checks_write on auto_checks for all to authenticated using (is_platform_admin()) with check (is_platform_admin());

alter table auto_check_findings enable row level security;
revoke all on auto_check_findings from anon;
grant select on auto_check_findings to authenticated;
create policy acf_read on auto_check_findings for select to authenticated using (is_org_member(organization_id));

grant execute on function run_auto_checks() to authenticated;

-- Schedule it hourly if pg_cron is available; guarded so a missing extension is not
-- an error. Idempotent: unschedule an old copy first.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('wouri_auto_checks') where exists (select 1 from cron.job where jobname = 'wouri_auto_checks');
    perform cron.schedule('wouri_auto_checks', '7 * * * *', 'select run_auto_checks();');
  end if;
exception when others then null; end $$;
