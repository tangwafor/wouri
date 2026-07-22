-- Wouri 0013: the document engine and proof surface (Sprint 2)
-- Traces to ADR-0012 (unbound field blocks issuance, reproducible), ADR-0011
-- (proof not trust), the documents research (track 03). Built under ADR-0030:
-- the Cameroon bindings are provisional until validated against a real issued
-- document. The DB enforces the invariants (all required bindings resolve, weight
-- consistency, idempotent issuance by content hash); the Ed25519 signature and
-- offline verification live in the proof module the trusted server runs. Anyone
-- verifies a document by its code with no account. No em-dashes.

-- Measured quality values (the typed values behind a quality certificate).
create table if not exists quality_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lot_id uuid not null references lots(id) on delete cascade,
  attribute_key text not null,
  numeric_value numeric,
  text_value text,
  bool_value bool,
  pack_version text not null default 'cocoa-v1',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists quality_values_lot on quality_values (lot_id, attribute_key);

-- Document templates (platform reference). schema.fields declares the bindings:
-- which fields a document carries and which are required. Provisional per ADR-0030.
create table if not exists document_templates (
  key text primary key,
  version text not null default 'v1',
  commodity_key text,
  title_fr text not null,
  title_en text not null,
  pack_version text not null default 'cm-docs-v1',
  schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key,                       -- client-minted, idempotent
  organization_id uuid not null references organizations(id) on delete cascade,
  consignment_id uuid not null references consignments(id) on delete cascade,
  template_key text not null references document_templates(key),
  template_version text not null,
  pack_version text not null,
  content jsonb not null,
  content_hash text not null,
  vc jsonb,
  verification_code text not null unique,
  status text not null default 'issued' check (status in ('draft','issued','revoked')),
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id, consignment_id, template_key, content_hash)
);
create index if not exists documents_org on documents (organization_id);
create index if not exists documents_consignment on documents (consignment_id);

-- ── Resolve: build a document's content from the spine and report what is missing
--    and whether the declared weight matches the consignment. The authority on
--    content, so issuance and the UI agree. ────────────────────────────────────
create or replace function resolve_document(p_consignment uuid, p_template text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_org uuid; v_con record; v_org_row record; v_buyer record; v_contract record; v_commodity record;
  v_content jsonb; v_required text[]; v_unbound text[] := '{}'; v_computed numeric; v_declared numeric;
  v_moisture numeric; v_beancount numeric; k text;
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

  select coalesce(sum(cl.quantity_kg), 0) into v_computed
    from consignment_lots cl where cl.consignment_id = p_consignment;
  v_declared := v_contract.quantity_kg;

  -- Fields common to every consignment document.
  v_content := jsonb_build_object(
    'exporter', v_org_row.legal_name,
    'exporter_niu', nullif(v_org_row.niu, ''),
    'consignment_code', v_con.code,
    'destination_country', v_con.destination_country,
    'buyer_name', v_buyer.name,
    'commodity', v_commodity.label_en,
    'net_weight_kg', v_computed
  );
  v_required := array['exporter','consignment_code','destination_country','buyer_name','commodity','net_weight_kg'];

  if p_template = 'eur1_cmr' then
    v_content := v_content || jsonb_build_object('origin_country', 'CM', 'hs_code', v_commodity.hs_code);
    v_required := v_required || array['hs_code'];
  elsif p_template = 'phyto' then
    v_content := v_content || jsonb_build_object('place_of_origin', v_con.destination_country, 'treatment', 'none-declared');
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

  -- Unbound = a required field that resolved to null (unbound blocks issuance).
  foreach k in array v_required loop
    if v_content->k is null or v_content->>k is null then v_unbound := v_unbound || k; end if;
  end loop;

  return jsonb_build_object(
    'content', v_content,
    'required', to_jsonb(v_required),
    'unbound', to_jsonb(v_unbound),
    'weight_declared', v_declared,
    'weight_computed', v_computed,
    'weight_ok', (v_declared is not null and abs(v_declared - v_computed) <= 0.5)
  );
end $$;

-- ── Issue: re-resolve, enforce the invariants, store the server-signed VC.
--    Idempotent by content hash: the same content yields the same document. ─────
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

  -- Idempotent reissue: identical content returns the existing document.
  select id into v_existing from documents
    where organization_id = v_org and consignment_id = p_consignment
      and template_key = p_template and content_hash = p_content_hash;
  if v_existing is not null then return v_existing; end if;

  insert into documents (id, organization_id, consignment_id, template_key, template_version,
    pack_version, content, content_hash, vc, verification_code, status)
  values (p_id, v_org, p_consignment, p_template, p_template_version, p_pack_version,
    v_res->'content', p_content_hash, p_vc, p_code, 'issued')
  on conflict (id) do nothing;
  return p_id;
end $$;

create or replace function revoke_document(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from documents where id = p_id;
  if v_org is null then raise exception 'unknown document'; end if;
  if not is_org_admin(v_org) then raise exception 'only an org admin can revoke'; end if;
  update documents set status = 'revoked', revoked_at = now(), revoked_reason = p_reason where id = p_id;
end $$;

-- ── The public verification surface: anyone, no account, resolves a code to the
--    document, its status, and the public key to check the signature offline. ──
create or replace function verify_document(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d record; v_pub text;
begin
  select * into d from documents where verification_code = p_code;
  if d.id is null then return jsonb_build_object('found', false); end if;
  select secret into v_pub from wouri_secrets where key_name = 'proof_public_pem';
  return jsonb_build_object(
    'found', true,
    'status', d.status,
    'template', d.template_key,
    'issued_at', d.issued_at,
    'revoked_at', d.revoked_at,
    'revoked_reason', d.revoked_reason,
    'content', d.content,
    'vc', d.vc,
    'public_key', v_pub
  );
end $$;

create or replace function get_proof_public_key()
returns text language sql stable security definer set search_path = public as $$
  select secret from wouri_secrets where key_name = 'proof_public_pem';
$$;

-- ── RLS: documents and quality values are org-scoped; verification goes through
--    the definer functions, which anon may call. ────────────────────────────────
alter table documents enable row level security;
alter table quality_values enable row level security;
alter table document_templates enable row level security;
revoke all on documents, quality_values from anon;
revoke all on document_templates from anon;
grant select, insert, update, delete on documents, quality_values to authenticated;
grant select on document_templates to authenticated;

create policy documents_member on documents for all to authenticated
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy quality_values_member on quality_values for all to authenticated
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
create policy templates_read on document_templates for select to authenticated using (true);

grant execute on function verify_document(text) to anon, authenticated;
grant execute on function get_proof_public_key() to anon, authenticated;

-- ── Seed the Cameroon document set (no FLEGT gate). Bindings provisional. ──────
insert into document_templates (key, version, commodity_key, title_fr, title_en, schema) values
  ('eur1_cmr','v1',null,'Certificat de circulation EUR.1','EUR.1 movement certificate',
    '{"fields":[{"key":"exporter","required":true},{"key":"consignment_code","required":true},{"key":"destination_country","required":true},{"key":"hs_code","required":true},{"key":"net_weight_kg","required":true}]}'),
  ('phyto','v1',null,'Certificat phytosanitaire (reference)','Phytosanitary certificate (reference)',
    '{"fields":[{"key":"exporter","required":true},{"key":"commodity","required":true},{"key":"destination_country","required":true},{"key":"net_weight_kg","required":true}]}'),
  ('vgm','v1',null,'Masse brute verifiee (VGM)','Verified gross mass (VGM)',
    '{"fields":[{"key":"consignment_code","required":true},{"key":"verified_gross_mass_kg","required":true},{"key":"method","required":true}]}'),
  ('quality_cert','v1','cocoa','Certificat de qualite','Quality certificate',
    '{"fields":[{"key":"commodity","required":true},{"key":"moisture_pct","required":true},{"key":"bean_count","required":true},{"key":"net_weight_kg","required":true}]}')
on conflict (key) do nothing;
