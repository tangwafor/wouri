-- Wouri 0029: fix a false declaration on the phytosanitary certificate
-- The phyto binding set place_of_origin to the DESTINATION country. On a phyto
-- certificate, place of origin is where the goods were GROWN, not where they are
-- going. That is a wrong declaration on a government-facing document, exactly the
-- class ADR-0027 exists to prevent, and it propagated through 0013, 0022 and 0024
-- because the resolver is copy-pasted whole per document type. This migration
-- corrects the value and makes place_of_origin a required, bound field; the real
-- cure (a document_field_bindings resolver, so a binding is a row not a branch) is
-- tracked as the next ADR. No em-dashes.
--
-- Origin is derived from the exporter's registered location (region + country),
-- which is captured at onboarding and is Cameroonian, never the buyer country.

create or replace function resolve_document(p_consignment uuid, p_template text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid; v_con record; v_org_row record; v_buyer record; v_contract record; v_commodity record;
  v_content jsonb; v_required text[]; v_unbound text[] := '{}'; v_computed numeric; v_declared numeric;
  v_moisture numeric; v_beancount numeric; k text;
  v_region text; v_country text; v_place_of_origin text;
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

  -- Place of origin: the exporter's registered growing region and country. Never
  -- the destination. Falls back to country code, so it is always at least
  -- country-correct and can never silently become the buyer country.
  select l.region, l.country into v_region, v_country
    from locations l where l.organization_id = v_org
    order by (l.kind = 'buying_station') desc, l.created_at asc limit 1;
  v_place_of_origin := nullif(trim(both ', ' from concat_ws(', ', nullif(v_region, ''), nullif(v_country, ''))), '');

  select coalesce(sum(cl.quantity_kg), 0) into v_computed
    from consignment_lots cl where cl.consignment_id = p_consignment;
  v_declared := coalesce(v_contract.quantity_kg, v_computed);

  v_content := jsonb_build_object(
    'exporter', v_org_row.legal_name,
    'exporter_niu', nullif(v_org_row.niu, ''),
    'consignment_code', v_con.code,
    'destination_country', v_con.destination_country,
    'buyer_name', v_buyer.name,
    'commodity', v_commodity.label_en,
    'net_weight_kg', v_computed
  );
  v_content := v_content || jsonb_build_object(
    'exporter_brand_color', nullif(v_org_row.brand->>'color', ''),
    'exporter_tagline', nullif(v_org_row.brand->>'tagline', '')
  );
  v_required := array['exporter','consignment_code','destination_country','buyer_name','commodity','net_weight_kg'];

  if p_template = 'eur1_cmr' then
    v_content := v_content || jsonb_build_object('origin_country', coalesce(nullif(v_country, ''), 'CM'), 'hs_code', v_commodity.hs_code);
    v_required := v_required || array['hs_code'];
  elsif p_template = 'phyto' then
    v_content := v_content || jsonb_build_object('place_of_origin', v_place_of_origin, 'treatment', 'none-declared');
    v_required := v_required || array['place_of_origin'];   -- a missing origin now blocks issuance
  elsif p_template = 'vgm' then
    v_content := v_content || jsonb_build_object('verified_gross_mass_kg', v_computed, 'method', 'SM2');
  elsif p_template = 'quality_cert' then
    select qv.numeric_value into v_moisture from quality_values qv
      join consignment_lots cl on cl.lot_id = qv.lot_id and cl.consignment_id = p_consignment
      where qv.attribute_key = 'moisture' order by qv.recorded_at desc limit 1;
    select qv.numeric_value into v_beancount from quality_values qv
      join consignment_lots cl on cl.lot_id = qv.lot_id and cl.consignment_id = p_consignment
      where qv.attribute_key = 'bean_count' order by qv.recorded_at desc limit 1;
    v_content := v_content || jsonb_build_object('moisture_pct', v_moisture, 'bean_count', v_beancount);
    v_required := v_required || array['moisture_pct','bean_count'];
  end if;

  foreach k in array v_required loop
    if v_content->k is null or v_content->>k is null then v_unbound := v_unbound || k; end if;
  end loop;

  return jsonb_build_object(
    'content', v_content, 'required', to_jsonb(v_required), 'unbound', to_jsonb(v_unbound),
    'weight_declared', v_declared, 'weight_computed', v_computed,
    'weight_ok', (v_declared is not null and abs(v_declared - v_computed) <= 0.5)
  );
end $$;
