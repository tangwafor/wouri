-- Wouri 0035: PostGIS, so the server decides the plot, not the client
-- Origin geometry was GeoJSON in a jsonb column and the client declared its own
-- area_ha, so a client could bypass the point-only-under-cap rule by typing a small
-- number. This is the EUDR spine and the primary anti-fraud surface, and ADR-0020
-- says the server decides. Now it does: a real geography column, server-computed
-- area, centroid, geometry kind, and validity, with the client area demoted to a
-- declared (advisory) value. The relational fraud signals (a plot that overlaps
-- another, a plot inside a protected area, a point declared over the cap) are
-- expressed as auto_checks over the engine (0028), not another board rewrite, so
-- they stay current and data-driven. The point-area cap is registry data. No em-dashes.

create extension if not exists postgis;

-- The point-only area cap (ADR-0010) is a rule, so it is a registry row.
insert into registry_config (key, value_numeric, description, source)
select 'origin_point_area_cap_ha', 4, 'Max area for which a point (not a boundary polygon) is accepted as origin geometry', 'EUDR practice, ADR-0010'
where not exists (select 1 from registry_config rc where rc.key = 'origin_point_area_cap_ha' and rc.valid_at @> now());

alter table origin_unit_versions add column if not exists geom geography(Geometry, 4326);
alter table origin_unit_versions add column if not exists centroid geography(Point, 4326);
alter table origin_unit_versions add column if not exists computed_area_ha numeric;   -- server, from the polygon
alter table origin_unit_versions add column if not exists declared_area_ha numeric;    -- the client claim (advisory)
alter table origin_unit_versions add column if not exists geometry_kind text;          -- point | polygon | multipolygon | none
alter table origin_unit_versions add column if not exists self_intersects boolean not null default false;
create index if not exists ouv_geom on origin_unit_versions using gist (geom);

-- Compute the geometry facts on the server for every write path (create_lot_at_origin
-- and the field app alike). The client area is captured as declared; for a polygon
-- the authoritative area_ha is the server-computed area.
create or replace function origin_geometry_compute()
returns trigger language plpgsql set search_path = public, extensions as $$
declare v_g geometry;
begin
  -- Capture the client claim before we overwrite the authoritative area.
  if new.declared_area_ha is null then new.declared_area_ha := new.area_ha; end if;
  new.geom := null; new.centroid := null; new.computed_area_ha := null;
  new.geometry_kind := 'none'; new.self_intersects := false;

  if new.geometry is not null and (new.geometry ? 'type') then
    begin
      v_g := st_setsrid(st_geomfromgeojson(new.geometry::text), 4326);
    exception when others then v_g := null; end;
  end if;

  if v_g is not null then
    new.geom := v_g::geography;
    new.centroid := st_centroid(v_g)::geography;
    new.geometry_kind := lower(geometrytype(v_g));
    if geometrytype(v_g) in ('POLYGON', 'MULTIPOLYGON') then
      new.self_intersects := not st_isvalid(v_g);
      new.computed_area_ha := round((st_area(new.geom) / 10000.0)::numeric, 4);
      new.area_ha := new.computed_area_ha;   -- server wins for a polygon
    end if;
  end if;
  return new;
end $$;

drop trigger if exists origin_geometry_compute_trg on origin_unit_versions;
create trigger origin_geometry_compute_trg before insert or update on origin_unit_versions
  for each row execute function origin_geometry_compute();

-- Recompute existing rows through the trigger.
update origin_unit_versions set area_ha = area_ha;

-- A minimal protected-areas reference (EUDR deforestation-free proxy). Seeded empty;
-- real boundaries are a data import. The mechanism and the check land now.
create table if not exists protected_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'protected',
  geom geography(Geometry, 4326) not null,
  source text,
  created_at timestamptz not null default now()
);
create index if not exists protected_areas_geom on protected_areas using gist (geom);
alter table protected_areas enable row level security;
revoke all on protected_areas from anon;
grant select on protected_areas to authenticated, anon;
create policy protected_areas_read on protected_areas for select to authenticated, anon using (true);

-- Spatial fraud signals as auto_checks (always current, over the engine).
insert into auto_checks (key, title, description, severity, query) values
  ('origin_self_intersecting', 'Invalid origin polygon',
   'A lot origin polygon is self-intersecting, so its area and boundary cannot be trusted.', 'high',
   $q$ select l.organization_id as organization_id, 'lot'::text as entity_type, l.id as entity_id,
         'Origin polygon for lot ' || l.code || ' is self-intersecting (invalid geometry)' as detail
       from lots l join origin_unit_versions ouv on ouv.origin_unit_id = l.origin_unit_id and ouv.valid_at @> now()
       where l.status <> 'closed' and ouv.self_intersects $q$),
  ('origin_point_over_cap', 'Point origin over the area cap',
   'A lot origin is a single point but the declared area exceeds the cap; EUDR needs a boundary polygon.', 'high',
   $q$ select l.organization_id as organization_id, 'lot'::text as entity_type, l.id as entity_id,
         'Origin for lot ' || l.code || ' is a point but the declared area exceeds the cap; a boundary polygon is required' as detail
       from lots l join origin_unit_versions ouv on ouv.origin_unit_id = l.origin_unit_id and ouv.valid_at @> now()
       where l.status <> 'closed' and ouv.geometry_kind = 'point'
         and coalesce(ouv.declared_area_ha, 0) > cfg_num('origin_point_area_cap_ha', 4) $q$),
  ('origin_overlaps_another', 'Origin overlaps another plot',
   'A lot origin polygon overlaps another registered plot, a double-claim signal.', 'high',
   $q$ select l.organization_id as organization_id, 'lot'::text as entity_type, l.id as entity_id,
         'Origin for lot ' || l.code || ' overlaps another registered plot' as detail
       from lots l join origin_unit_versions ouv on ouv.origin_unit_id = l.origin_unit_id and ouv.valid_at @> now()
       where l.status <> 'closed' and ouv.geom is not null
         and exists (select 1 from origin_unit_versions o2 where o2.origin_unit_id <> ouv.origin_unit_id
                       and o2.valid_at @> now() and o2.geom is not null and st_intersects(o2.geom, ouv.geom)) $q$),
  ('origin_in_protected_area', 'Origin inside a protected area',
   'A lot origin intersects a protected area, a deforestation-risk signal.', 'critical',
   $q$ select l.organization_id as organization_id, 'lot'::text as entity_type, l.id as entity_id,
         'Origin for lot ' || l.code || ' intersects a protected area' as detail
       from lots l join origin_unit_versions ouv on ouv.origin_unit_id = l.origin_unit_id and ouv.valid_at @> now()
       where l.status <> 'closed' and ouv.geom is not null
         and exists (select 1 from protected_areas pa where st_intersects(pa.geom, ouv.geom)) $q$)
on conflict (key) do nothing;
