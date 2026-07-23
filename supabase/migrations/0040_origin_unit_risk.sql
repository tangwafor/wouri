-- Wouri 0040: the EUDR risk-assessment record per plot (Article 10)
-- EUDR requires, per origin, a risk assessment: the deforestation-free finding
-- against a dataset (with its version), the production-after-cutoff check, the
-- legality basis, and a resulting risk level (Cameroon is Standard). We captured a
-- protected-area intersection signal in 0035, but not the formal assessment record.
-- This is that record, effective-dated per origin version, with the dataset and its
-- version so a stale assessment is visible. An EUDR lot whose active origin has no
-- current assessment is flagged by an auto_check. No em-dashes.

create table if not exists origin_unit_risk (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  origin_unit_id uuid not null references origin_units(id) on delete cascade,
  assessed_at timestamptz not null default now(),
  risk_level text not null check (risk_level in ('low','standard','high')),
  deforestation_free boolean not null,
  produced_after_cutoff boolean not null,        -- production after 31 Dec 2020
  legality_basis text,                            -- land title, permit, customary right reference
  dataset text,                                   -- e.g. JRC Tropical Moist Forest
  dataset_version text,                           -- so a stale assessment is visible
  result jsonb not null default '{}'::jsonb,
  assessor text,
  created_at timestamptz not null default now()
);
create index if not exists our_unit on origin_unit_risk (origin_unit_id, assessed_at desc);

create or replace function record_origin_risk(
  p_org uuid, p_origin_unit uuid, p_risk_level text, p_deforestation_free boolean,
  p_produced_after_cutoff boolean, p_legality_basis text default null,
  p_dataset text default null, p_dataset_version text default null,
  p_result jsonb default '{}'::jsonb, p_assessor text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  insert into origin_unit_risk (organization_id, origin_unit_id, risk_level, deforestation_free, produced_after_cutoff, legality_basis, dataset, dataset_version, result, assessor)
    values (p_org, p_origin_unit, p_risk_level, p_deforestation_free, p_produced_after_cutoff, p_legality_basis, p_dataset, p_dataset_version, p_result, p_assessor)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function record_origin_risk(uuid, uuid, text, boolean, boolean, text, text, text, jsonb, text) to authenticated;

-- Has a plot been risk-assessed?
create or replace function origin_has_risk_assessment(p_origin_unit uuid)
returns bool language sql stable security definer set search_path = public as $$
  select exists (select 1 from origin_unit_risk where origin_unit_id = p_origin_unit);
$$;
grant execute on function origin_has_risk_assessment(uuid) to authenticated;

-- Auto_check: an EUDR lot whose origin has no risk assessment, or a high-risk
-- assessment, is flagged. Complements the origin geolocation gap.
insert into auto_checks (key, title, description, severity, query) values
  ('eudr_lot_no_risk_assessment', 'EUDR lot without a risk assessment',
   'An EUDR-scope lot has no recorded Article 10 risk assessment on its origin.', 'high',
   $q$ select l.organization_id as organization_id, 'lot'::text as entity_type, l.id as entity_id,
         'EUDR lot ' || l.code || ' has no risk assessment on its origin (Article 10)' as detail
       from lots l join commodities co on co.id = l.commodity_id
       where co.eudr = true and l.status <> 'closed' and l.origin_unit_id is not null
         and not origin_has_risk_assessment(l.origin_unit_id) $q$),
  ('origin_high_risk', 'Origin assessed high risk',
   'A lot origin has a high-risk EUDR assessment, which needs mitigation before export.', 'high',
   $q$ select r.organization_id as organization_id, 'lot'::text as entity_type, l.id as entity_id,
         'Origin of lot ' || l.code || ' is assessed high risk or not deforestation-free' as detail
       from lots l
       join lateral (select * from origin_unit_risk r where r.origin_unit_id = l.origin_unit_id order by assessed_at desc limit 1) r on true
       where l.status <> 'closed' and (r.risk_level = 'high' or r.deforestation_free = false or r.produced_after_cutoff = false) $q$)
on conflict (key) do nothing;

alter table origin_unit_risk enable row level security;
revoke all on origin_unit_risk from anon, authenticated;
grant select on origin_unit_risk to authenticated;
create policy our_read on origin_unit_risk for select to authenticated using (is_org_member(organization_id));
