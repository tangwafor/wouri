-- Wouri 0008: the Sprint 1 spine (Layer 1 nouns, custody + consignment)
-- Traces to ADR-0002 (row not column), ADR-0008 (dual-rail), the architecture
-- research (track 05). Built under the ADR-0030 gate override: reconcile every
-- field against a real consignment file when one arrives. No em-dashes.

create extension if not exists pgcrypto;

-- origin_claim: how a lot's identity is preserved through custody. A CITES-listed
-- lot can never be mass_balance (enforced on lots below). ADR: CITES is identity-preserved.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'origin_claim') then
    create type origin_claim as enum ('segregated','identity_preserved','mass_balance','controlled_blending');
  end if;
end $$;

-- ── Commodities (platform reference; small, stable Layer 1) ────────────────────
create table if not exists commodities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label_fr text not null,
  label_en text not null,
  hs_code text,
  created_at timestamptz not null default now()
);

-- ── Parties (org-scoped counterparties: buyers, suppliers, cooperatives) ───────
create table if not exists parties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('buyer','supplier','cooperative','agent','transporter','authority','laboratory')),
  name text not null,
  country text,
  identifiers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists parties_org on parties (organization_id);

-- ── Origin units (the farm / plot / forest unit) + effective-dated versions ────
create table if not exists origin_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  commodity_id uuid not null references commodities(id),
  code text not null,
  kind text not null default 'plot' check (kind in ('plot','farm','forest','cooperative_aggregate')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index if not exists origin_units_org on origin_units (organization_id);

-- A version is the state of an origin unit over a validity range. Immutable rows;
-- a change appends a new version. One active version per unit at any instant
-- (btree_gist EXCLUDE, equality-first per the architecture research).
create table if not exists origin_unit_versions (
  id uuid primary key default gen_random_uuid(),
  origin_unit_id uuid not null references origin_units(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  valid_at tstzrange not null default tstzrange(now(), null),
  holder_party_id uuid references parties(id),
  area_ha numeric(12,4),
  geometry jsonb,          -- GeoJSON polygon; a geography column comes with PostGIS work
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  exclude using gist (origin_unit_id with =, valid_at with &&)
);
create index if not exists ouv_org on origin_unit_versions (organization_id);

create table if not exists origin_evidence (
  id uuid primary key default gen_random_uuid(),
  origin_unit_version_id uuid not null references origin_unit_versions(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('photo','polygon','document','attestation','lab_result')),
  uri text,
  content_hash text,
  captured_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists origin_evidence_org on origin_evidence (organization_id);

-- ── Lots (a quantity of commodity moving through custody) ──────────────────────
create table if not exists lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  commodity_id uuid not null references commodities(id),
  code text not null,
  claim origin_claim not null default 'segregated',
  is_cites_listed bool not null default false,
  origin_unit_id uuid references origin_units(id),
  quantity_kg numeric(14,3) not null default 0,
  status text not null default 'open' check (status in ('open','in_transformation','consigned','shipped','closed')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index if not exists lots_org on lots (organization_id);

-- The moat rule (ADR: CITES-listed is identity-preserved). A CITES lot can never
-- be mass-balanced. Enforced here because it spans two columns.
create or replace function lots_cites_not_mass_balance()
returns trigger language plpgsql as $$
begin
  if new.is_cites_listed and new.claim = 'mass_balance' then
    raise exception 'a CITES-listed lot cannot use the mass_balance claim (it is identity-preserved)';
  end if;
  return new;
end $$;
drop trigger if exists lots_cites_guard on lots;
create trigger lots_cites_guard before insert or update on lots
  for each row execute function lots_cites_not_mass_balance();

-- ── Transformations + lineage (splits, merges, process steps) ──────────────────
create table if not exists transformations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('drying','fermentation','sorting','bagging','milling','aggregation','split')),
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists lineage (
  parent_lot_id uuid not null references lots(id) on delete cascade,
  child_lot_id uuid not null references lots(id) on delete cascade,
  transformation_id uuid references transformations(id),
  organization_id uuid not null references organizations(id) on delete cascade,
  quantity_kg numeric(14,3),
  primary key (parent_lot_id, child_lot_id)
);

-- ── Contracts + consignments (the sale, the shipment) ──────────────────────────
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  buyer_party_id uuid references parties(id),
  commodity_id uuid references commodities(id),
  incoterm text,
  quantity_kg numeric(14,3),
  price jsonb not null default '{}'::jsonb,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists consignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  buyer_party_id uuid references parties(id),
  contract_id uuid references contracts(id),
  destination_country text,
  status text not null default 'draft'
    check (status in ('draft','allocated','ready','shipped','presented','settled')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index if not exists consignments_org on consignments (organization_id);

create table if not exists consignment_lots (
  consignment_id uuid not null references consignments(id) on delete cascade,
  lot_id uuid not null references lots(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  quantity_kg numeric(14,3),
  primary key (consignment_id, lot_id)
);

-- ── Cost entries + tasks ───────────────────────────────────────────────────────
create table if not exists cost_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  consignment_id uuid references consignments(id) on delete cascade,
  lot_id uuid references lots(id) on delete cascade,
  category text not null,
  amount_minor bigint not null default 0,
  currency text not null default 'XAF',
  incurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open','doing','blocked','done')),
  due_at timestamptz,
  assignee_membership_id uuid references memberships(id),
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now()
);

-- Seed the two beachhead commodities.
insert into commodities (key, label_fr, label_en, hs_code) values
  ('cocoa','Cacao','Cocoa','1801'),
  ('timber','Bois','Timber','4403')
on conflict (key) do nothing;
