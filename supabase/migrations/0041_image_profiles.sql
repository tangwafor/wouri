-- Wouri 0041: image profiles registry + the hash-before-processing rule (ADR-0021)
-- Media is captured against a named profile from the registry (dimensions, format,
-- quality, purpose), and the ORIGINAL is hashed before any processing, so a resized
-- or recompressed derivative still commits to the untouched original. A media asset
-- cannot be recorded without that original hash. Profiles are platform reference;
-- assets are org data. No em-dashes.

create table if not exists image_profiles (
  key text primary key,
  label_en text not null,
  label_fr text not null,
  purpose text not null check (purpose in ('evidence','product','document_scan','signature','identity')),
  max_width int not null,
  max_height int not null,
  format text not null check (format in ('webp','jpeg','png')),
  quality int not null check (quality between 1 and 100),
  created_at timestamptz not null default now()
);
insert into image_profiles (key, label_en, label_fr, purpose, max_width, max_height, format, quality) values
  ('evidence_photo','Evidence photo','Photo de preuve','evidence',1600,1600,'webp',80),
  ('product_photo','Product photo','Photo de produit','product',2000,2000,'webp',82),
  ('document_scan','Document scan','Scan de document','document_scan',2480,3508,'jpeg',90),
  ('signature_capture','Signature capture','Capture de signature','signature',800,400,'png',90),
  ('id_document','Identity document','Piece d identite',  'identity',1600,1000,'jpeg',88)
on conflict (key) do nothing;

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  profile_key text not null references image_profiles(key),
  original_hash text not null,       -- sha256 of the ORIGINAL bytes, computed before any processing
  storage_path text,                 -- where the processed derivative lives
  width int, height int, bytes bigint,
  captured_at timestamptz not null default now(),
  captured_lat numeric, captured_lng numeric,
  created_at timestamptz not null default now()
);
create index if not exists media_subject on media_assets (subject_type, subject_id);
create index if not exists media_org on media_assets (organization_id);

create or replace function record_media_asset(
  p_org uuid, p_subject_type text, p_subject_id uuid, p_profile text, p_original_hash text,
  p_storage_path text default null, p_width int default null, p_height int default null,
  p_bytes bigint default null, p_lat numeric default null, p_lng numeric default null, p_captured_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  if coalesce(trim(p_original_hash), '') = '' then
    raise exception 'the original must be hashed before processing (ADR-0021)';
  end if;
  insert into media_assets (organization_id, subject_type, subject_id, profile_key, original_hash, storage_path, width, height, bytes, captured_at, captured_lat, captured_lng)
    values (p_org, p_subject_type, p_subject_id, p_profile, p_original_hash, p_storage_path, p_width, p_height, p_bytes, coalesce(p_captured_at, now()), p_lat, p_lng)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function record_media_asset(uuid, text, uuid, text, text, text, int, int, bigint, numeric, numeric, timestamptz) to authenticated;

alter table image_profiles enable row level security;
revoke all on image_profiles from anon;
grant select on image_profiles to authenticated, anon;
create policy image_profiles_read on image_profiles for select to authenticated, anon using (true);

alter table media_assets enable row level security;
revoke all on media_assets from anon, authenticated;
grant select on media_assets to authenticated;
create policy media_assets_read on media_assets for select to authenticated using (is_org_member(organization_id));
