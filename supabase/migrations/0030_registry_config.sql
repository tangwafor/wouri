-- Wouri 0030: operational thresholds become registry data, not literals
-- The readiness board carried its notice windows as literals baked into the view
-- (repatriation-soon at 15 days, departure-soon at 7 days), and the document
-- resolver carried a weight tolerance of 0.5 kg. Those are policy, and policy is a
-- row that an owner can change, never a literal in a view body (No Hardcoding,
-- ADR-0002). This migration moves them into registry_config, effective-dated like
-- the rest of the registry, and rewrites the board to read them. The weight
-- tolerance key is seeded here and consumed when the resolver is rebuilt on the
-- bindings model. No em-dashes.

create table if not exists registry_config (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value_numeric numeric not null,
  description text,
  valid_at tstzrange not null default tstzrange(now(), null),
  source text,
  exclude using gist (key with =, valid_at with &&)
);

insert into registry_config (key, value_numeric, description, source)
select * from (values
  ('board_repatriation_soon_days', 15, 'Days before the BEAC window closes at which the board warns', 'Wouri operational policy'),
  ('board_etd_soon_days', 7, 'Days before ETD at which a still-booked shipment is flagged', 'Wouri operational policy'),
  ('document_weight_tolerance_kg', 0.5, 'Allowed difference between declared and computed net weight', 'Wouri operational policy')
) as v(key, value_numeric, description, source)
where not exists (select 1 from registry_config rc where rc.key = v.key and rc.valid_at @> now());

-- The effective value of a config key now. Falls back to a caller default so a
-- missing key never breaks a view or a function.
create or replace function cfg_num(p_key text, p_default numeric default null)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(
    (select value_numeric from registry_config where key = p_key and valid_at @> now() order by lower(valid_at) desc limit 1),
    p_default);
$$;
grant execute on function cfg_num(text, numeric) to authenticated, anon;

-- Readiness board, rewritten to read the two notice windows from registry_config.
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
    and ((si.export_date + (sr.repatriation_days || ' days')::interval)::date - current_date) <= cfg_num('board_repatriation_soon_days', 15)
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
  where sh.etd is not null and sh.status = 'booked' and sh.etd >= current_date and (sh.etd - current_date) <= cfg_num('board_etd_soon_days', 7)
  union all
  select t.organization_id, null::uuid, null::text, 'task_overdue', 'high',
    greatest(0, current_date - t.due_at::date), t.due_at::date, t.title
  from tasks t
  where t.status <> 'done' and t.due_at is not null and t.due_at < now();

grant select on readiness_board to authenticated;

-- RLS: anyone signed in reads the config (a view uses it); only a platform admin writes.
alter table registry_config enable row level security;
revoke all on registry_config from anon;
grant select on registry_config to authenticated, anon;
create policy registry_config_read on registry_config for select to authenticated, anon using (true);
create policy registry_config_write on registry_config for all to authenticated using (is_platform_admin()) with check (is_platform_admin());
