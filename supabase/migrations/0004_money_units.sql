-- Wouri 0004: currencies, fx (null not one), units (integer base)
-- Traces to ADR-0017, the Bazah money/fx doctrine. No em-dashes.

create table if not exists currencies (
  code text primary key,               -- ISO 4217
  label text not null,
  minor_unit int not null default 2    -- XAF is 0, EUR/USD 2
);

insert into currencies (code, label, minor_unit) values
  ('XAF','CFA franc BEAC',0),('EUR','Euro',2),('USD','US dollar',2),
  ('GBP','Pound sterling',2),('CAD','Canadian dollar',2)
on conflict do nothing;

-- Effective-dated fx. A missing rate is NULL, never assumed to be 1 (null-not-one).
create table if not exists fx_rates (
  id uuid primary key default gen_random_uuid(),
  base_code text not null references currencies(code),
  quote_code text not null references currencies(code),
  rate numeric(24,12),                 -- nullable on purpose
  rate_source text,
  as_of timestamptz not null default now(),
  captured_at timestamptz not null default now()
);
create index if not exists fx_rates_pair_asof on fx_rates (base_code, quote_code, as_of desc);

-- Units, quantities live in integer base units; cross-dimension conversion is refused.
create table if not exists units (
  code text primary key,               -- kg, m3, hoppus_m3, bag_60, bag_65
  label text not null,
  dimension text not null,             -- mass | volume | count
  to_base numeric(24,12) not null      -- factor into the dimension base
);

insert into units (code, label, dimension, to_base) values
  ('kg','Kilogramme','mass',1),('t','Tonne','mass',1000),
  ('m3','Metre cube','volume',1),('bag_60','Sac 60 kg','mass',60),('bag_65','Sac 65 kg','mass',65)
on conflict do nothing;
