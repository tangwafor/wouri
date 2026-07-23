-- Wouri 0021: where the chain starts (at harvest, or after)
-- A tenant enters the custody chain at one of two points, a choice not a branch
-- in code (ADR-0002): at_origin (they own the plot, capture the harvest) or
-- post_harvest (they received it from a supplier). Missing plot geolocation for
-- an EUDR commodity is never a hard block (trust-tier); it surfaces on the
-- readiness board as an origin gap to fill before the border. Built under
-- ADR-0030. No em-dashes.

-- Which commodities are in EUDR scope, as data (so readiness can reason on it).
alter table commodities add column if not exists eudr bool not null default false;
update commodities set eudr = true where key in ('cocoa','coffee','palm_oil','rubber','timber');
update commodities set eudr = false where key in ('cotton','banana','other');

-- How a lot entered custody.
alter table lots add column if not exists origin_mode text not null default 'at_origin'
  check (origin_mode in ('at_origin','post_harvest'));
alter table lots add column if not exists supplier_party_id uuid references parties(id);

-- Does the lot have a plot geolocation anywhere in its origin unit versions.
create or replace function lot_has_origin_geo(p_lot uuid)
returns bool language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from lots l
    join origin_unit_versions ouv on ouv.origin_unit_id = l.origin_unit_id
    where l.id = p_lot and ouv.geometry is not null
  );
$$;

-- Start at harvest: create the plot (origin unit + effective-dated version +
-- optional polygon evidence), the lot bound to it, and the harvest event. Atomic.
create or replace function create_lot_at_origin(
  p_org uuid, p_lot_id uuid, p_commodity_key text, p_lot_code text, p_quantity_kg numeric,
  p_claim text, p_is_cites bool, p_plot_code text, p_plot_kind text, p_area_ha numeric,
  p_geometry jsonb, p_event_id uuid, p_occurred_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_comm uuid; v_unit uuid; v_ver uuid; v_actor uuid;
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  select id into v_comm from commodities where key = p_commodity_key;
  if v_comm is null then raise exception 'unknown commodity %', p_commodity_key; end if;
  select id into v_actor from people where auth_user_id = (select auth.uid());

  insert into origin_units (organization_id, commodity_id, code, kind)
    values (p_org, v_comm, p_plot_code, coalesce(p_plot_kind, 'plot')) returning id into v_unit;
  insert into origin_unit_versions (origin_unit_id, organization_id, area_ha, geometry)
    values (v_unit, p_org, p_area_ha, p_geometry) returning id into v_ver;
  if p_geometry is not null then
    insert into origin_evidence (origin_unit_version_id, organization_id, kind, captured_at)
      values (v_ver, p_org, 'polygon', p_occurred_at);
  end if;

  insert into lots (id, organization_id, commodity_id, code, claim, is_cites_listed, origin_unit_id, quantity_kg, origin_mode)
    values (p_lot_id, p_org, v_comm, p_lot_code, p_claim::origin_claim, coalesce(p_is_cites, false), v_unit, coalesce(p_quantity_kg, 0), 'at_origin');
  insert into lot_events (id, organization_id, lot_id, event_type, payload, occurred_at, actor_person_id)
    values (p_event_id, p_org, p_lot_id, 'harvest', jsonb_build_object('plot', p_plot_code, 'area_ha', p_area_ha), coalesce(p_occurred_at, now()), v_actor);
  return p_lot_id;
end $$;

-- Start after harvest: create the lot from a named supplier, first event is the
-- receipt. Origin geolocation may be absent (a gap the readiness board flags).
create or replace function create_lot_post_harvest(
  p_org uuid, p_lot_id uuid, p_commodity_key text, p_lot_code text, p_quantity_kg numeric,
  p_claim text, p_is_cites bool, p_supplier_name text, p_supplier_origin_ref text,
  p_event_id uuid, p_occurred_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_comm uuid; v_supplier uuid; v_actor uuid;
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  select id into v_comm from commodities where key = p_commodity_key;
  if v_comm is null then raise exception 'unknown commodity %', p_commodity_key; end if;
  select id into v_actor from people where auth_user_id = (select auth.uid());

  if coalesce(p_supplier_name, '') <> '' then
    select id into v_supplier from parties where organization_id = p_org and kind = 'supplier' and name = p_supplier_name;
    if v_supplier is null then
      insert into parties (organization_id, kind, name) values (p_org, 'supplier', p_supplier_name) returning id into v_supplier;
    end if;
  end if;

  insert into lots (id, organization_id, commodity_id, code, claim, is_cites_listed, quantity_kg, origin_mode, supplier_party_id)
    values (p_lot_id, p_org, v_comm, p_lot_code, p_claim::origin_claim, coalesce(p_is_cites, false), coalesce(p_quantity_kg, 0), 'post_harvest', v_supplier);
  insert into lot_events (id, organization_id, lot_id, event_type, payload, occurred_at, actor_person_id)
    values (p_event_id, p_org, p_lot_id, 'received_from_supplier',
      jsonb_build_object('supplier', p_supplier_name, 'origin_ref', p_supplier_origin_ref), coalesce(p_occurred_at, now()), v_actor);
  return p_lot_id;
end $$;

-- Readiness board, redefined to add the EUDR origin-gap blocker: an EUDR-scope
-- lot with no plot geolocation yet. Trust-tier: surfaced, never blocking.
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
    and ((si.export_date + (sr.repatriation_days || ' days')::interval)::date - current_date) <= 15
  union all
  select d.organization_id, si.consignment_id, c.code, 'discrepancy', 'high',
    greatest(0, current_date - d.raised_at::date), null::date, coalesce(d.description, d.code)
  from settlement_discrepancies d
  join settlement_instruments si on si.id = d.instrument_id
  join consignments c on c.id = si.consignment_id
  where d.resolved_at is null
  union all
  select l.organization_id, null::uuid, l.code, 'origin_gap', 'high',
    greatest(0, current_date - l.created_at::date), null::date,
    'EUDR lot missing plot geolocation'
  from lots l
  join commodities co on co.id = l.commodity_id
  where co.eudr = true and l.status <> 'closed' and not lot_has_origin_geo(l.id)
  union all
  select t.organization_id, null::uuid, null::text, 'task_overdue', 'high',
    greatest(0, current_date - t.due_at::date), t.due_at::date, t.title
  from tasks t
  where t.status <> 'done' and t.due_at is not null and t.due_at < now();

grant select on readiness_board to authenticated;
