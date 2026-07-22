-- Wouri 0011: registry v1 (cocoa) + registry audit
-- Traces to ADR-0002 (Layer 2 registry, effective-dated, cited) and the
-- architecture research (registry audit; compensating corrections). Quality
-- attributes are declared here, effective-dated, so a consignment pins the pack
-- version it was created under. Platform-owned reference data. No em-dashes.

-- Quality attribute declarations (the schema catalog for typed values). One
-- active declaration per (commodity, key) at any instant.
create table if not exists quality_attributes (
  id uuid primary key default gen_random_uuid(),
  commodity_id uuid not null references commodities(id) on delete cascade,
  key text not null,
  label_fr text not null,
  label_en text not null,
  datatype text not null check (datatype in ('numeric','text','bool')),
  unit text,
  min_value numeric,
  max_value numeric,
  pack_version text not null default 'cocoa-v1',
  valid_at tstzrange not null default tstzrange(now(), null),
  created_at timestamptz not null default now(),
  exclude using gist (commodity_id with =, key with =, valid_at with &&)
);

-- Registry audit: every change to legally consequential reference data is an
-- append-only row (actor, when, before, after). Never a soft-delete.
create table if not exists registry_audit (
  id bigint generated always as identity primary key,
  actor_person_id uuid references people(id) on delete set null,
  table_name text not null,
  row_key text,
  before_row jsonb,
  after_row jsonb,
  at timestamptz not null default now()
);

-- RLS: attributes are shared reference (any tenant reads, none writes through the
-- client); the audit answers to nobody through the client (platform-written).
alter table quality_attributes enable row level security;
alter table registry_audit enable row level security;
revoke all on quality_attributes from anon;
revoke all on registry_audit from anon, authenticated;
grant select on quality_attributes to authenticated;
create policy quality_attributes_read on quality_attributes for select to authenticated using (true);

-- Seed cocoa v1: the attributes a Cameroon cocoa quality certificate turns on.
-- Ranges are provisional under ADR-0030 until validated against a real certificate.
insert into quality_attributes (commodity_id, key, label_fr, label_en, datatype, unit, min_value, max_value)
select c.id, v.key, v.label_fr, v.label_en, v.datatype, v.unit, v.min_value, v.max_value
from commodities c
join (values
  ('moisture','Humidite','Moisture','numeric','%', 0, 8),
  ('bean_count','Grainage','Bean count','numeric','beans/100g', 80, 120),
  ('defects','Defauts','Defects','numeric','%', 0, 10),
  ('foreign_matter','Matieres etrangeres','Foreign matter','numeric','%', 0, 2)
) as v(key, label_fr, label_en, datatype, unit, min_value, max_value) on true
where c.key = 'cocoa'
on conflict do nothing;
