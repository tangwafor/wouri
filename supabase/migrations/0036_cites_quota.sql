-- Wouri 0036: the CITES quota ledger that can never go negative (ADR-0011)
-- The CITES rail is the moat, but a quota that is not enforced is not a moat. A
-- national export quota exists per species per year; every CITES export debits it;
-- the remaining balance may never go negative. This is enforced at write, under a
-- row lock so concurrent debits cannot both slip past. cites_quotas is left empty
-- (real figures are a sourced data import, not invented here); the mechanism and
-- the guard land now. Usage is org-scoped; the national remaining is an aggregate
-- exposed without leaking who used what. No em-dashes.

create table if not exists cites_quotas (
  id uuid primary key default gen_random_uuid(),
  species text not null,
  year int not null,
  quota_kg numeric not null check (quota_kg >= 0),
  source text,
  created_at timestamptz not null default now(),
  unique (species, year)
);

create table if not exists quota_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  species text not null,
  year int not null,
  amount_kg numeric not null check (amount_kg > 0),
  lot_id uuid references lots(id) on delete set null,
  consignment_id uuid references consignments(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists quota_ledger_key on quota_ledger (species, year);
create index if not exists quota_ledger_org on quota_ledger (organization_id);

-- Debit the quota. Locks the quota row so two concurrent exports cannot both pass
-- the check; raises if there is no quota defined or the balance would go negative.
create or replace function record_quota_use(
  p_org uuid, p_species text, p_year int, p_amount_kg numeric,
  p_lot uuid default null, p_consignment uuid default null, p_reason text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_quota numeric; v_used numeric; v_id uuid;
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  if coalesce(p_amount_kg, 0) <= 0 then raise exception 'quota use must be positive'; end if;

  select quota_kg into v_quota from cites_quotas where species = p_species and year = p_year for update;
  if v_quota is null then
    raise exception 'no CITES quota defined for % in %', p_species, p_year;
  end if;

  select coalesce(sum(amount_kg), 0) into v_used from quota_ledger where species = p_species and year = p_year;
  if v_used + p_amount_kg > v_quota then
    raise exception 'CITES quota exceeded for % in %: remaining %, requested %', p_species, p_year, (v_quota - v_used), p_amount_kg;
  end if;

  insert into quota_ledger (organization_id, species, year, amount_kg, lot_id, consignment_id, reason)
    values (p_org, p_species, p_year, p_amount_kg, p_lot, p_consignment, p_reason)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function record_quota_use(uuid, text, int, numeric, uuid, uuid, text) to authenticated;

-- The national remaining balance as an aggregate. SECURITY DEFINER so it totals
-- across all exporters, but it returns only totals per species and year, never a
-- per-org row, so it does not leak who exported what.
create or replace function cites_quota_status()
returns table (species text, year int, quota_kg numeric, used_kg numeric, remaining_kg numeric)
language sql stable security definer set search_path = public as $$
  select q.species, q.year, q.quota_kg,
    coalesce(sum(l.amount_kg), 0) as used_kg,
    q.quota_kg - coalesce(sum(l.amount_kg), 0) as remaining_kg
  from cites_quotas q
  left join quota_ledger l on l.species = q.species and l.year = q.year
  group by q.species, q.year, q.quota_kg;
$$;
grant execute on function cites_quota_status() to authenticated;

-- RLS. Quota figures are public reference; a ledger row is the owning org's data.
alter table cites_quotas enable row level security;
revoke all on cites_quotas from anon;
grant select on cites_quotas to authenticated, anon;
create policy cites_quotas_read on cites_quotas for select to authenticated, anon using (true);

alter table quota_ledger enable row level security;
revoke all on quota_ledger from anon, authenticated;
grant select on quota_ledger to authenticated;
create policy quota_ledger_read on quota_ledger for select to authenticated using (is_org_member(organization_id));
