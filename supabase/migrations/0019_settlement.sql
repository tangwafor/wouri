-- Wouri 0019: settlement spine + the BEAC repatriation clock (Sprint 3 slice)
-- Traces to the finance research (track 06) and the law "settled means
-- repatriated". A consignment is not settled when the buyer pays; it is settled
-- when the proceeds are repatriated and domiciled within the CEMAC/BEAC window.
-- The window (150 days) is registry DATA, not a literal in code (ADR-0002), so it
-- can change without a deploy. A discrepancy blocks acceptance and payment. Built
-- under ADR-0030; reconcile fields against a real presentation. No em-dashes.

-- The repatriation window as effective-dated registry data (no hardcoded 150).
create table if not exists settlement_rules (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  repatriation_days int not null,
  domiciliation_required bool not null default true,
  valid_at tstzrange not null default tstzrange(now(), null),
  source text,
  exclude using gist (region with =, valid_at with &&)
);
insert into settlement_rules (region, repatriation_days, domiciliation_required, source)
select 'CEMAC', 150, true, 'BEAC FX regulation'
where not exists (select 1 from settlement_rules where region = 'CEMAC');

create table if not exists settlement_instruments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  consignment_id uuid not null references consignments(id) on delete cascade,
  kind text not null check (kind in ('lc','documentary_collection','dp','da','open_account','advance')),
  currency text not null default 'XAF',
  amount_minor bigint not null default 0,
  incoterm text,
  buyer_bank text,
  domiciliation_ref text,
  region text not null default 'CEMAC',
  export_date date,                          -- starts the repatriation clock
  status text not null default 'draft'
    check (status in ('draft','presented','accepted','paid','repatriated')),
  presented_at timestamptz, accepted_at timestamptz, paid_at timestamptz, repatriated_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists settlement_instruments_org on settlement_instruments (organization_id);
create index if not exists settlement_instruments_con on settlement_instruments (consignment_id);

create table if not exists settlement_discrepancies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  instrument_id uuid not null references settlement_instruments(id) on delete cascade,
  code text not null,
  description text,
  raised_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists settlement_disc_instr on settlement_discrepancies (instrument_id);

-- Open (unresolved) discrepancies on an instrument.
create or replace function settlement_open_discrepancies(p_instr uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from settlement_discrepancies where instrument_id = p_instr and resolved_at is null;
$$;

-- Guarded transitions. Order: draft -> presented -> accepted -> paid ->
-- repatriated. A discrepancy blocks accepted and paid. Repatriated needs paid.
create or replace function settlement_advance(p_instr uuid, p_to text)
returns text language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_status text;
begin
  select organization_id, status into v_org, v_status from settlement_instruments where id = p_instr;
  if v_org is null then raise exception 'unknown settlement instrument'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;

  if p_to = 'presented' then
    if v_status <> 'draft' then raise exception 'can only present from draft'; end if;
    update settlement_instruments set status = 'presented', presented_at = now() where id = p_instr;
  elsif p_to = 'accepted' then
    if v_status <> 'presented' then raise exception 'can only accept from presented'; end if;
    if settlement_open_discrepancies(p_instr) > 0 then raise exception 'cannot accept: open discrepancies'; end if;
    update settlement_instruments set status = 'accepted', accepted_at = now() where id = p_instr;
  elsif p_to = 'paid' then
    if v_status <> 'accepted' then raise exception 'can only mark paid from accepted'; end if;
    if settlement_open_discrepancies(p_instr) > 0 then raise exception 'cannot pay: open discrepancies'; end if;
    update settlement_instruments set status = 'paid', paid_at = now() where id = p_instr;
  elsif p_to = 'repatriated' then
    if v_status <> 'paid' then raise exception 'settled means repatriated: can only repatriate from paid'; end if;
    update settlement_instruments set status = 'repatriated', repatriated_at = now() where id = p_instr;
  else
    raise exception 'unknown target status %', p_to;
  end if;
  return p_to;
end $$;

create or replace function settlement_raise_discrepancy(p_id uuid, p_instr uuid, p_code text, p_desc text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from settlement_instruments where id = p_instr;
  if v_org is null then raise exception 'unknown instrument'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;
  insert into settlement_discrepancies (id, organization_id, instrument_id, code, description)
    values (p_id, v_org, p_instr, p_code, p_desc) on conflict (id) do nothing;
  return p_id;
end $$;

create or replace function settlement_resolve_discrepancy(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from settlement_discrepancies where id = p_id;
  if v_org is null then raise exception 'unknown discrepancy'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;
  update settlement_discrepancies set resolved_at = now() where id = p_id;
end $$;

-- Settled means repatriated.
create or replace function is_consignment_settled(p_con uuid)
returns bool language sql stable security definer set search_path = public as $$
  select exists (select 1 from settlement_instruments where consignment_id = p_con and status = 'repatriated');
$$;

-- The BEAC clock: due date from the registry window, days remaining, overdue.
-- security_invoker so the caller's RLS on settlement_instruments applies.
create or replace view settlement_clock with (security_invoker = true) as
  select si.id, si.organization_id, si.consignment_id, si.status, si.export_date, si.region,
    (si.export_date + (sr.repatriation_days || ' days')::interval)::date as repatriation_due,
    ((si.export_date + (sr.repatriation_days || ' days')::interval)::date - current_date) as days_remaining,
    (si.status <> 'repatriated' and si.export_date is not null
      and current_date > (si.export_date + (sr.repatriation_days || ' days')::interval)::date) as overdue
  from settlement_instruments si
  left join lateral (
    select repatriation_days from settlement_rules
    where region = si.region and valid_at @> now() order by lower(valid_at) desc limit 1
  ) sr on true;

-- RLS: org-scoped instruments and discrepancies; rules are shared reference.
alter table settlement_rules enable row level security;
alter table settlement_instruments enable row level security;
alter table settlement_discrepancies enable row level security;
revoke all on settlement_rules from anon;
revoke all on settlement_instruments, settlement_discrepancies from anon;
grant select on settlement_rules to authenticated;
grant select on settlement_clock to authenticated;
grant select, insert, update, delete on settlement_instruments, settlement_discrepancies to authenticated;
create policy settlement_rules_read on settlement_rules for select to authenticated using (true);
create policy settlement_instruments_member on settlement_instruments for all to authenticated
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy settlement_disc_member on settlement_discrepancies for all to authenticated
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
