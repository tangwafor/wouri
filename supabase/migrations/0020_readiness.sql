-- Wouri 0020: the readiness board (the morning blocker board, Sprint 3 slice)
-- A ranked, rebuildable projection (Layer 3) of what is blocking each consignment
-- right now: a repatriation past the BEAC window, a window closing soon, an open
-- settlement discrepancy, an overdue task. security_invoker so the caller's RLS
-- scopes it to their own org. Ranking (critical > high > warning, then oldest
-- first) is applied by the reader. No em-dashes.

create or replace view readiness_board with (security_invoker = true) as
  -- Repatriation past the BEAC window: the most serious blocker.
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
  -- Repatriation window closing within 15 days.
  select si.organization_id, si.consignment_id, c.code,
    'repatriation_due_soon', 'warning',
    0, (si.export_date + (sr.repatriation_days || ' days')::interval)::date,
    'Repatriation window closing soon'
  from settlement_instruments si
  join consignments c on c.id = si.consignment_id
  join lateral (select repatriation_days from settlement_rules where region = si.region and valid_at @> now() order by lower(valid_at) desc limit 1) sr on true
  where si.status <> 'repatriated' and si.export_date is not null
    and (si.export_date + (sr.repatriation_days || ' days')::interval)::date >= current_date
    and ((si.export_date + (sr.repatriation_days || ' days')::interval)::date - current_date) <= 15   -- canon:allow-literal superseded by 0030 registry_config

  union all
  -- Open settlement discrepancies.
  select d.organization_id, si.consignment_id, c.code,
    'discrepancy', 'high',
    greatest(0, current_date - d.raised_at::date), null::date,
    coalesce(d.description, d.code)
  from settlement_discrepancies d
  join settlement_instruments si on si.id = d.instrument_id
  join consignments c on c.id = si.consignment_id
  where d.resolved_at is null

  union all
  -- Overdue tasks.
  select t.organization_id, null::uuid, null::text,
    'task_overdue', 'high',
    greatest(0, current_date - t.due_at::date), t.due_at::date,
    t.title
  from tasks t
  where t.status <> 'done' and t.due_at is not null and t.due_at < now();

grant select on readiness_board to authenticated;
