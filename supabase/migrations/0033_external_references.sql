-- Wouri 0033: external references become a registry-keyed table, not columns
-- 0026 started a column per reference kind on consignments (dds_reference,
-- besc_reference, insurance_ref). The next one is a CITES permit, then a CAMCIS
-- declaration, then an ONCC certificate: that is freight_lanes beginning again, a
-- column per authority. The founding rule says anything that varies by authority
-- is a row, not a column. So references move into external_references, keyed on a
-- registry of reference kinds, attachable to a consignment, lot, or shipment. The
-- three columns are backfilled and dropped; the board and the auto-check read the
-- table. No em-dashes.

create table if not exists reference_kinds (
  key text primary key,
  label_en text not null,
  label_fr text not null,
  applies_to text not null default 'consignment',   -- hint: consignment | lot | shipment
  authority text,
  description text
);
insert into reference_kinds (key, label_en, label_fr, applies_to, authority, description) values
  ('dds','EUDR DDS reference','Reference DDS EUDR','consignment','EU TRACES','Due diligence statement number that clears the EU border'),
  ('besc','BESC / ECTN cargo tracking note','Note de suivi BESC / ECTN','consignment','Cameroon Shippers Council','Mandatory before loading'),
  ('insurance','Marine insurance certificate','Certificat d assurance maritime','consignment','Insurer','CIF marine insurance reference'),
  ('cites_permit','CITES permit','Permis CITES','lot','MINFOF','Permit for a CITES-listed species'),
  ('camcis','CAMCIS customs declaration','Declaration douaniere CAMCIS','consignment','Customs','Single-window customs declaration'),
  ('oncc_quality','ONCC quality certificate','Certificat qualite ONCC','consignment','ONCC/NCCB','National board quality certification')
on conflict (key) do nothing;

create table if not exists external_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('consignment','lot','shipment')),
  entity_id uuid not null,
  kind text not null references reference_kinds(key),
  value text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, kind)
);
create index if not exists ext_ref_entity on external_references (entity_type, entity_id);
create index if not exists ext_ref_org on external_references (organization_id);

-- Set (or clear) a reference. An empty value clears it. Upsert on the natural key.
create or replace function set_external_reference(p_org uuid, p_entity_type text, p_entity_id uuid, p_kind text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  if coalesce(trim(p_value), '') = '' then
    delete from external_references where entity_type = p_entity_type and entity_id = p_entity_id and kind = p_kind;
    return;
  end if;
  insert into external_references (organization_id, entity_type, entity_id, kind, value)
    values (p_org, p_entity_type, p_entity_id, p_kind, trim(p_value))
  on conflict (entity_type, entity_id, kind) do update set value = excluded.value, updated_at = now();
end $$;
grant execute on function set_external_reference(uuid, text, uuid, text, text) to authenticated;

-- Backfill from the three columns before dropping them.
insert into external_references (organization_id, entity_type, entity_id, kind, value)
  select organization_id, 'consignment', id, 'dds', dds_reference from consignments where coalesce(dds_reference,'') <> ''
on conflict do nothing;
insert into external_references (organization_id, entity_type, entity_id, kind, value)
  select organization_id, 'consignment', id, 'besc', besc_reference from consignments where coalesce(besc_reference,'') <> ''
on conflict do nothing;
insert into external_references (organization_id, entity_type, entity_id, kind, value)
  select organization_id, 'consignment', id, 'insurance', insurance_ref from consignments where coalesce(insurance_ref,'') <> ''
on conflict do nothing;

-- Convenience: does an entity have a given reference?
create or replace function has_reference(p_entity_type text, p_entity_id uuid, p_kind text)
returns bool language sql stable security definer set search_path = public as $$
  select exists (select 1 from external_references
    where entity_type = p_entity_type and entity_id = p_entity_id and kind = p_kind and coalesce(value,'') <> '');
$$;
grant execute on function has_reference(text, uuid, text) to authenticated;

-- Readiness board, rewritten so the compliance gap reads external_references for the
-- BESC note instead of the dropped column.
create or replace view readiness_board with (security_invoker = true) as
  select si.organization_id, si.consignment_id, c.code as consignment_code,
    'repatriation_overdue' as kind, 'critical' as severity,
    greatest(0, current_date - (si.export_date + (sr.repatriation_days || ' days')::interval)::date) as age_days,
    (si.export_date + (sr.repatriation_days || ' days')::interval)::date as due_date,
    'Export proceeds not repatriated within the BEAC window' as detail
  from settlement_instruments si
  join consignments c on c.id = si.consignment_id
  join lateral (select repatriation_days from settlement_rules where region = si.region and valid_at @> now() order by lower(valid_at) desc limit 1) sr on true
  where si.status <> 'repatriated' and si.export_date is not null
    and current_date > (si.export_date + (sr.repatriation_days || ' days')::interval)::date
  union all
  select si.organization_id, si.consignment_id, c.code, 'repatriation_due_soon', 'warning',
    0, (si.export_date + (sr.repatriation_days || ' days')::interval)::date, 'Repatriation window closing soon'
  from settlement_instruments si
  join consignments c on c.id = si.consignment_id
  join lateral (select repatriation_days from settlement_rules where region = si.region and valid_at @> now() order by lower(valid_at) desc limit 1) sr on true
  where si.status <> 'repatriated' and si.export_date is not null
    and (si.export_date + (sr.repatriation_days || ' days')::interval)::date >= current_date
    and ((si.export_date + (sr.repatriation_days || ' days')::interval)::date - current_date) <= cfg_num('board_repatriation_soon_days', 15)   -- canon:allow-literal fallback only; the value of record is the registry_config row
  union all
  select d.organization_id, si.consignment_id, c.code, 'discrepancy', 'high',
    greatest(0, current_date - d.raised_at::date), null::date, coalesce(d.description, d.code)
  from settlement_discrepancies d
  join settlement_instruments si on si.id = d.instrument_id
  join consignments c on c.id = si.consignment_id
  where d.resolved_at is null
  union all
  select l.organization_id, null::uuid, l.code, 'origin_gap', 'high',
    greatest(0, current_date - l.created_at::date), null::date, 'EUDR lot missing plot geolocation'
  from lots l join commodities co on co.id = l.commodity_id
  where co.eudr = true and l.status <> 'closed' and not lot_has_origin_geo(l.id)
  union all
  select c.organization_id, c.id, c.code, 'compliance_gap', 'high',
    greatest(0, current_date - coalesce(sh.loaded_at, now())::date), null::date,
    'Cargo tracking note (BESC/ECTN) not recorded before loading'
  from consignments c
  join shipments sh on sh.consignment_id = c.id
  where sh.status in ('loaded','sailed','arrived','cleared') and not has_reference('consignment', c.id, 'besc')
  union all
  select sh.organization_id, sh.consignment_id, c.code, 'shipment_overdue', 'high',
    greatest(0, current_date - sh.eta), sh.eta, 'Shipment past its ETA, not yet arrived'
  from shipments sh join consignments c on c.id = sh.consignment_id
  where sh.eta is not null and sh.status not in ('arrived','cleared') and current_date > sh.eta
  union all
  select sh.organization_id, sh.consignment_id, c.code, 'shipment_etd_soon', 'warning',
    0, sh.etd, 'Departure closing in, shipment still booked'
  from shipments sh join consignments c on c.id = sh.consignment_id
  where sh.etd is not null and sh.status = 'booked' and sh.etd >= current_date and (sh.etd - current_date) <= cfg_num('board_etd_soon_days', 7)   -- canon:allow-literal fallback only; the value of record is the registry_config row
  union all
  select t.organization_id, null::uuid, null::text, 'task_overdue', 'high',
    greatest(0, current_date - t.due_at::date), t.due_at::date, t.title
  from tasks t
  where t.status <> 'done' and t.due_at is not null and t.due_at < now();
grant select on readiness_board to authenticated;

-- Repoint the auto-check: an EU consignment with a document but no DDS reference.
update auto_checks set query = $q$
  select c.organization_id as organization_id, 'consignment'::text as entity_type, c.id as entity_id,
    'EU-bound consignment ' || c.code || ' has a document issued but no EUDR DDS reference recorded' as detail
  from consignments c
  where upper(coalesce(c.destination_country,'')) in ('DE','FR','NL','BE','IT','ES','SE','PL','EU')
    and not has_reference('consignment', c.id, 'dds')
    and exists (select 1 from documents d where d.consignment_id = c.id)
$q$ where key = 'eu_consignment_no_dds';

-- Drop the columns now that every reader points at external_references.
alter table consignments drop column if exists dds_reference;
alter table consignments drop column if exists besc_reference;
alter table consignments drop column if exists insurance_ref;

-- RLS. Reference kinds are public reference; external_references are org data.
alter table reference_kinds enable row level security;
revoke all on reference_kinds from anon;
grant select on reference_kinds to authenticated, anon;
create policy reference_kinds_read on reference_kinds for select to authenticated, anon using (true);

alter table external_references enable row level security;
revoke all on external_references from anon, authenticated;
grant select on external_references to authenticated;
create policy ext_ref_read on external_references for select to authenticated using (is_org_member(organization_id));
