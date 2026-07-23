-- Wouri 0025: shipment tracking (the logistics layer)
-- A consignment travels: booked, loaded, sailed, arrived, cleared. This records
-- the carrier, vessel, ports, and the ETD/ETA, advances the milestones in order,
-- mirrors the consignment status, and feeds the readiness board so an approaching
-- departure or a missed arrival surfaces as a blocker. Built under ADR-0030.
-- No em-dashes.

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  consignment_id uuid not null references consignments(id) on delete cascade unique,
  carrier text, vessel text, booking_ref text,
  port_loading text, port_discharge text,
  etd date, eta date,
  status text not null default 'booked' check (status in ('booked','loaded','sailed','arrived','cleared')),
  loaded_at timestamptz, sailed_at timestamptz, arrived_at timestamptz, cleared_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists shipments_org on shipments (organization_id);

-- Advance a shipment in order, stamp the milestone, and mirror the consignment
-- status (loaded -> ready, sailed -> shipped).
create or replace function shipment_advance(p_shipment uuid, p_to text)
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_con uuid; v_status text;
begin
  select organization_id, consignment_id, status into v_org, v_con, v_status from shipments where id = p_shipment;
  if v_org is null then raise exception 'unknown shipment'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;

  if p_to = 'loaded' then
    if v_status <> 'booked' then raise exception 'can only load from booked'; end if;
    update shipments set status = 'loaded', loaded_at = now() where id = p_shipment;
    update consignments set status = 'ready' where id = v_con and status in ('draft','allocated');
  elsif p_to = 'sailed' then
    if v_status <> 'loaded' then raise exception 'can only sail from loaded'; end if;
    update shipments set status = 'sailed', sailed_at = now() where id = p_shipment;
    update consignments set status = 'shipped' where id = v_con;
  elsif p_to = 'arrived' then
    if v_status <> 'sailed' then raise exception 'can only arrive from sailed'; end if;
    update shipments set status = 'arrived', arrived_at = now() where id = p_shipment;
  elsif p_to = 'cleared' then
    if v_status <> 'arrived' then raise exception 'can only clear from arrived'; end if;
    update shipments set status = 'cleared', cleared_at = now() where id = p_shipment;
  else
    raise exception 'unknown target %', p_to;
  end if;
  return p_to;
end $$;

-- Readiness board, redefined to add shipment blockers: a departure closing in and
-- an arrival that is overdue.
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
    and ((si.export_date + (sr.repatriation_days || ' days')::interval)::date - current_date) <= 15   -- canon:allow-literal superseded by 0030 registry_config
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
  -- Arrival overdue: past the ETA and not yet arrived.
  select sh.organization_id, sh.consignment_id, c.code, 'shipment_overdue', 'high',
    greatest(0, current_date - sh.eta), sh.eta, 'Shipment past its ETA, not yet arrived'
  from shipments sh join consignments c on c.id = sh.consignment_id
  where sh.eta is not null and sh.status not in ('arrived','cleared') and current_date > sh.eta
  union all
  -- Departure closing: ETD within 7 days and still only booked.
  select sh.organization_id, sh.consignment_id, c.code, 'shipment_etd_soon', 'warning',
    0, sh.etd, 'Departure closing in, shipment still booked'
  from shipments sh join consignments c on c.id = sh.consignment_id
  where sh.etd is not null and sh.status = 'booked' and sh.etd >= current_date and (sh.etd - current_date) <= 7
  union all
  select t.organization_id, null::uuid, null::text, 'task_overdue', 'high',
    greatest(0, current_date - t.due_at::date), t.due_at::date, t.title
  from tasks t
  where t.status <> 'done' and t.due_at is not null and t.due_at < now();

grant select on readiness_board to authenticated;

-- RLS
alter table shipments enable row level security;
revoke all on shipments from anon;
grant select, insert, update, delete on shipments to authenticated;
create policy shipments_member on shipments for all to authenticated
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
