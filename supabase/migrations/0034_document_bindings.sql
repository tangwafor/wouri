-- Wouri 0034: the document resolver becomes data, not a branch per type
-- resolve_document was an if/elsif branch per template, copy-pasted whole across
-- four migrations, and that is why a wrong binding (the phyto place-of-origin) rode
-- through three copies. The founding rule: a binding that varies by document is a
-- row, not a branch. So each document field is a row in document_field_bindings
-- naming a source_kind (a small closed vocabulary of primitive sources) and a
-- source_ref; the resolver iterates the rows. Adding a document type is now inserting
-- rows, not editing a function. And every issued document records where each field
-- came from in document_bindings, which is the provenance the dependency-graph,
-- staleness, and cross-document checks were always meant to build on. No em-dashes.

-- The binding registry. _common bindings apply to every template.
create table if not exists document_field_bindings (
  template_key text not null,
  template_version text not null default 'v1',
  field_key text not null,
  source_kind text not null check (source_kind in ('literal','consignment','org','org_brand','buyer','commodity','computed','quality')),
  source_ref text,                    -- a column, attribute, literal value, or computed name
  datatype text not null default 'text' check (datatype in ('text','number')),
  required boolean not null default false,
  sort int not null default 100,
  primary key (template_key, template_version, field_key)
);

insert into document_field_bindings (template_key, template_version, field_key, source_kind, source_ref, datatype, required, sort) values
  -- Common to every template.
  ('_common','v1','exporter','org','legal_name','text',true,1),
  ('_common','v1','exporter_niu','org','niu','text',false,2),
  ('_common','v1','consignment_code','consignment','code','text',true,3),
  ('_common','v1','destination_country','consignment','destination_country','text',true,4),
  ('_common','v1','buyer_name','buyer','name','text',true,5),
  ('_common','v1','commodity','commodity','label_en','text',true,6),
  ('_common','v1','net_weight_kg','computed','net_weight_kg','number',true,7),
  ('_common','v1','exporter_brand_color','org_brand','color','text',false,8),
  ('_common','v1','exporter_tagline','org_brand','tagline','text',false,9),
  -- EUR.1 certificate of origin.
  ('eur1_cmr','v1','origin_country','computed','origin_country','text',false,20),
  ('eur1_cmr','v1','hs_code','commodity','hs_code','text',true,21),
  -- Phytosanitary certificate. Place of origin is where grown, never the destination.
  ('phyto','v1','place_of_origin','computed','place_of_origin','text',true,20),
  ('phyto','v1','treatment','literal','none-declared','text',false,21),
  -- Verified gross mass.
  ('vgm','v1','verified_gross_mass_kg','computed','verified_gross_mass_kg','number',false,20),
  ('vgm','v1','method','literal','SM2','text',false,21),
  -- Quality certificate.
  ('quality_cert','v1','moisture_pct','quality','moisture','number',true,20),
  ('quality_cert','v1','bean_count','quality','bean_count','number',true,21)
on conflict (template_key, template_version, field_key) do nothing;

-- Per-issued-document provenance: where each field came from. This is the record the
-- dependency graph and cross-document discrepancy view build on.
create table if not exists document_bindings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  field_key text not null,
  source_kind text not null,
  source_ref text,
  value text,
  created_at timestamptz not null default now()
);
create index if not exists doc_bindings_doc on document_bindings (document_id);

-- The resolver, now data-driven over the binding rows and a closed set of primitive
-- source kinds. No branch per document type.
create or replace function resolve_document(p_consignment uuid, p_template text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid; v_con record; v_org_row record; v_buyer record; v_contract record; v_commodity record;
  v_content jsonb := '{}'::jsonb; v_required text[] := '{}'; v_unbound text[] := '{}'; v_prov jsonb := '[]'::jsonb;
  v_computed numeric; v_declared numeric; v_region text; v_country text; v_place_of_origin text;
  v_bind record; v_val text;
begin
  select * into v_con from consignments where id = p_consignment;
  if v_con.organization_id is null then raise exception 'unknown consignment'; end if;
  v_org := v_con.organization_id;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;

  select * into v_org_row from organizations where id = v_org;
  select * into v_buyer from parties where id = v_con.buyer_party_id;
  select * into v_contract from contracts where id = v_con.contract_id;
  select c.* into v_commodity from commodities c
    join consignment_lots cl on cl.consignment_id = p_consignment
    join lots l on l.id = cl.lot_id and l.commodity_id = c.id limit 1;

  select coalesce(sum(cl.quantity_kg), 0) into v_computed from consignment_lots cl where cl.consignment_id = p_consignment;
  v_declared := coalesce(v_contract.quantity_kg, v_computed);

  select l.region, l.country into v_region, v_country
    from locations l where l.organization_id = v_org
    order by (l.kind = 'buying_station') desc, l.created_at asc limit 1;
  v_place_of_origin := nullif(trim(both ', ' from concat_ws(', ', nullif(v_region, ''), nullif(v_country, ''))), '');

  for v_bind in
    select * from document_field_bindings
    where template_key in ('_common', p_template) and template_version = 'v1'
    order by sort, field_key
  loop
    v_val := case v_bind.source_kind
      when 'literal' then v_bind.source_ref
      when 'consignment' then to_jsonb(v_con) ->> v_bind.source_ref
      when 'org' then to_jsonb(v_org_row) ->> v_bind.source_ref
      when 'buyer' then to_jsonb(v_buyer) ->> v_bind.source_ref
      when 'commodity' then to_jsonb(v_commodity) ->> v_bind.source_ref
      when 'org_brand' then v_org_row.brand ->> v_bind.source_ref
      when 'computed' then case v_bind.source_ref
          when 'net_weight_kg' then v_computed::text
          when 'verified_gross_mass_kg' then v_computed::text
          when 'place_of_origin' then v_place_of_origin
          when 'origin_country' then coalesce(nullif(v_country, ''), 'CM')
          else null end
      when 'quality' then (
          select qv.numeric_value::text from quality_values qv
          join consignment_lots cl on cl.lot_id = qv.lot_id and cl.consignment_id = p_consignment
          where qv.attribute_key = v_bind.source_ref order by qv.recorded_at desc limit 1)
      else null end;

    if v_bind.required then v_required := v_required || v_bind.field_key; end if;
    if v_val is null or v_val = '' then
      if v_bind.required then v_unbound := v_unbound || v_bind.field_key; end if;
    else
      v_content := v_content || jsonb_build_object(v_bind.field_key,
        case when v_bind.datatype = 'number' then to_jsonb(v_val::numeric) else to_jsonb(v_val) end);
      v_prov := v_prov || jsonb_build_object('field', v_bind.field_key, 'source_kind', v_bind.source_kind, 'source_ref', v_bind.source_ref, 'value', v_val);
    end if;
  end loop;

  return jsonb_build_object(
    'content', v_content, 'required', to_jsonb(v_required), 'unbound', to_jsonb(v_unbound), 'provenance', v_prov,
    'weight_declared', v_declared, 'weight_computed', v_computed,
    'weight_ok', (v_declared is not null and abs(v_declared - v_computed) <= cfg_num('document_weight_tolerance_kg', 0.5))   -- canon:allow-literal fallback only; the value of record is the registry_config row
  );
end $$;

-- issue_document now also records provenance for the issued document.
create or replace function issue_document(
  p_id uuid, p_consignment uuid, p_template text, p_template_version text, p_pack_version text,
  p_content_hash text, p_vc jsonb, p_code text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_res jsonb; v_existing uuid;
begin
  select organization_id into v_org from consignments where id = p_consignment;
  if v_org is null then raise exception 'unknown consignment'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;

  v_res := resolve_document(p_consignment, p_template);
  if jsonb_array_length(v_res->'unbound') > 0 then
    raise exception 'cannot issue: unbound required fields %', v_res->>'unbound';
  end if;
  if (v_res->>'weight_ok')::bool is not true then
    raise exception 'cannot issue: declared weight % does not match consignment weight %',
      v_res->>'weight_declared', v_res->>'weight_computed';
  end if;

  select id into v_existing from documents
    where organization_id = v_org and consignment_id = p_consignment
      and template_key = p_template and content_hash = p_content_hash;
  if v_existing is not null then return v_existing; end if;

  insert into documents (id, organization_id, consignment_id, template_key, template_version,
    pack_version, content, content_hash, vc, verification_code, status)
  values (p_id, v_org, p_consignment, p_template, p_template_version, p_pack_version,
    v_res->'content', p_content_hash, p_vc, p_code, 'issued')
  on conflict (id) do nothing;

  -- Record provenance once (guard against replay duplicating it).
  if not exists (select 1 from document_bindings where document_id = p_id) then
    insert into document_bindings (document_id, field_key, source_kind, source_ref, value)
    select p_id, e->>'field', e->>'source_kind', e->>'source_ref', e->>'value'
    from jsonb_array_elements(v_res->'provenance') e;
  end if;
  return p_id;
end $$;

-- RLS: provenance is readable by a member of the document's org.
alter table document_field_bindings enable row level security;
revoke all on document_field_bindings from anon;
grant select on document_field_bindings to authenticated, anon;
create policy dfb_read on document_field_bindings for select to authenticated, anon using (true);

alter table document_bindings enable row level security;
revoke all on document_bindings from anon, authenticated;
grant select on document_bindings to authenticated;
create policy doc_bindings_read on document_bindings for select to authenticated
  using (exists (select 1 from documents d where d.id = document_id and is_org_member(d.organization_id)));
