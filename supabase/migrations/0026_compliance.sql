-- Wouri 0026: the compliance and reference layer (the real export paperwork)
-- A Cameroon export is not just the certificates Wouri issues; it also hinges on
-- references the operator must record: the EUDR DDS number that clears the EU
-- border, and the BESC/ECTN cargo tracking note that must exist before loading.
-- We capture them on the consignment and flag a missing BESC on a loaded shipment
-- as a blocker, because that is the classic thing that holds a container. The
-- destination-aware checklist itself is computed in the app. Built under ADR-0030.
-- No em-dashes.

alter table consignments add column if not exists dds_reference text;      -- EUDR TRACES DDS number
alter table consignments add column if not exists besc_reference text;     -- BESC / ECTN cargo tracking note
alter table consignments add column if not exists insurance_ref text;      -- marine insurance certificate ref

-- Readiness board, redefined to add the compliance blocker: a shipment has been
-- loaded (or later) but the cargo tracking note was never recorded.
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
    greatest(0, current_date - l.created_at::date), null::date, 'EUDR lot missing plot geolocation'
  from lots l join commodities co on co.id = l.commodity_id
  where co.eudr = true and l.status <> 'closed' and not lot_has_origin_geo(l.id)
  union all
  select c.organization_id, c.id, c.code, 'compliance_gap', 'high',
    greatest(0, current_date - coalesce(sh.loaded_at, now())::date), null::date,
    'Cargo tracking note (BESC/ECTN) not recorded before loading'
  from consignments c
  join shipments sh on sh.consignment_id = c.id
  where sh.status in ('loaded','sailed','arrived','cleared') and coalesce(c.besc_reference, '') = ''
  union all
  select sh.organization_id, sh.consignment_id, c.code, 'shipment_overdue', 'high',
    greatest(0, current_date - sh.eta), sh.eta, 'Shipment past its ETA, not yet arrived'
  from shipments sh join consignments c on c.id = sh.consignment_id
  where sh.eta is not null and sh.status not in ('arrived','cleared') and current_date > sh.eta
  union all
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
