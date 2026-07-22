-- Wouri 0003: the capability system (pick and choose, capability-first)
-- Traces to ADR-0028, ADR-0002, ADR-0005 (effective-dated with btree_gist).
-- No em-dashes.

-- Platform-owned menu, effective-dated so it can evolve without breaking a tenant.
create table if not exists capability_catalog (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null,
  label_fr text not null, label_en text not null,
  category text not null,
  requires_capability_key text,             -- the dependency graph
  default_for_vertical text[] not null default '{}',
  registry_scope jsonb not null default '{}'::jsonb,
  description_fr text, description_en text,
  valid_at tstzrange not null default tstzrange(now(), null),
  exclude using gist (capability_key with =, valid_at with &&)
);

create table if not exists organization_capabilities (
  organization_id uuid not null references organizations(id) on delete cascade,
  capability_key text not null,
  enabled_at timestamptz not null default now(),
  enabled_by uuid references people(id),
  primary key (organization_id, capability_key)
);

-- Does a tenant have a capability (read by the whole app for gating).
create or replace function has_capability(p_org uuid, p_cap text)
returns bool language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_capabilities
                 where organization_id = p_org and capability_key = p_cap);
$$;

-- Seed the menu.
insert into capability_catalog (capability_key, label_fr, label_en, category, requires_capability_key, default_for_vertical, registry_scope, description_fr, description_en) values
  ('commodity.cocoa','Cacao','Cocoa','commodity',null,'{cocoa}','{"domains":["eudr","docs.cocoa","levies.cocoa"]}','Vous exportez du cacao.','You export cocoa.'),
  ('commodity.timber','Bois','Timber','commodity',null,'{timber}','{"domains":["eudr","cites","docs.timber","levies.timber"]}','Vous exportez du bois.','You export timber.'),
  ('commodity.other','Autre produit','Other commodity','commodity',null,'{}','{}','Un autre produit d''exportation.','Another export commodity.'),
  ('rail.eudr','Filiere EUDR','EUDR rail','rail',null,'{cocoa,timber}','{"domains":["eudr","country_risk","dds"]}','Le dossier de diligence raisonnee EUDR.','The EUDR due diligence file.'),
  ('rail.cites','Filiere CITES','CITES rail','rail','commodity.timber','{timber}','{"domains":["species","permits","quota"]}','Permis et quotas CITES pour les especes reglementees.','CITES permits and quotas for regulated species.'),
  ('field_capture','Capture terrain','Field capture','field',null,'{}','{}','L''application terrain hors ligne (parcelles, photos, signatures).','The offline field app (plots, photos, signatures).'),
  ('settlement','Reglement','Settlement','money',null,'{}','{"domains":["settlement","beac"]}','Flux documentaire, ecarts, horloge de rapatriement BEAC.','Documentary flow, discrepancies, the BEAC repatriation clock.'),
  ('financing','Financement','Financing','money','settlement','{}','{"domains":["warehouse_receipt","cash_timeline"]}','Recepisses d''entrepot et calendrier de tresorerie.','Warehouse receipts and the cash timeline.'),
  ('groups','Groupes','Groups','structure',null,'{}','{}','Holdings et cooperatives de cooperatives.','Holdings and cooperatives of cooperatives.')
on conflict do nothing;
