-- Wouri 0043: document staleness (the projection the provenance was built for)
-- 0034 recorded, per issued document, the value of every field and where it came
-- from. That was the foundation; this is the projection that uses it. A document is
-- stale if any field's value today differs from the value captured when it was
-- issued (someone amended a quantity, corrected a party, re-graded a lot). Because
-- the binding is a row, staleness is a comparison, not a rebuild. The comparison
-- re-resolves the document server-side, so it needs an unchecked resolver callable
-- only by trusted definer functions (the auto-check runner is not a member of every
-- org). No em-dashes.

-- Split resolve_document into an unchecked core (no membership gate, not granted to
-- clients) and the public wrapper (membership gate, then core). Behaviour of the
-- public function is unchanged.
create or replace function resolve_document_core(p_consignment uuid, p_template text)
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
revoke all on function resolve_document_core(uuid, text) from public, anon, authenticated;

create or replace function resolve_document(p_consignment uuid, p_template text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from consignments where id = p_consignment;
  if v_org is null then raise exception 'unknown consignment'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;
  return resolve_document_core(p_consignment, p_template);
end $$;

-- The comparison, unchecked. Not granted to clients (it would leak another org's
-- field values); called by the guarded wrapper and by the definer auto-check runner.
create or replace function document_staleness_core(p_doc uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_con uuid; v_tpl text; v_res jsonb; v_drift jsonb := '[]'::jsonb; b record; v_now text;
begin
  select consignment_id, template_key into v_con, v_tpl from documents where id = p_doc and status = 'issued';
  if v_con is null then return jsonb_build_object('stale', false, 'drift', v_drift); end if;
  v_res := resolve_document_core(v_con, v_tpl);
  for b in select field_key, value from document_bindings where document_id = p_doc loop
    v_now := (select e->>'value' from jsonb_array_elements(v_res->'provenance') e where e->>'field' = b.field_key limit 1);
    if coalesce(v_now, '') <> coalesce(b.value, '') then
      v_drift := v_drift || jsonb_build_object('field', b.field_key, 'was', b.value, 'now', v_now);
    end if;
  end loop;
  return jsonb_build_object('stale', jsonb_array_length(v_drift) > 0, 'drift', v_drift);
end $$;
revoke all on function document_staleness_core(uuid) from public, anon, authenticated;

-- Detailed drift for the UI, gated to a member of the document's org.
create or replace function document_staleness(p_doc uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from documents where id = p_doc;
  if v_org is null then return jsonb_build_object('stale', false, 'drift', '[]'::jsonb); end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;
  return document_staleness_core(p_doc);
end $$;
grant execute on function document_staleness(uuid) to authenticated;

-- Boolean, unchecked and ungranted; the definer auto-check runner calls it as owner.
create or replace function document_is_stale(p_doc uuid)
returns bool language sql stable security definer set search_path = public as $$
  select (document_staleness_core(p_doc) ->> 'stale')::bool;
$$;
revoke all on function document_is_stale(uuid) from public, anon, authenticated;

-- Auto-check: an issued document whose source values have drifted since issuance.
insert into auto_checks (key, title, description, severity, query) values
  ('document_stale', 'Issued document is stale',
   'An issued document no longer matches its source data (a value changed after issuance); reissue or revoke it.', 'high',
   $q$ select d.organization_id as organization_id, 'consignment'::text as entity_type, d.consignment_id as entity_id,
         'Document ' || d.template_key || ' for ' || coalesce(c.code, 'a consignment') || ' is stale (source data changed since issuance)' as detail
       from documents d join consignments c on c.id = d.consignment_id
       where d.status = 'issued' and document_is_stale(d.id) $q$)
on conflict (key) do nothing;
