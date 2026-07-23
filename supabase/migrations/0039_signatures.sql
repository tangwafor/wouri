-- Wouri 0039: human signatures (the thumbprint, the driver, the supervisor)
-- The Ed25519 signature on a document is the issuer's machine signature. It is not
-- the human attestation the field needs: a producer's thumbprint on a purchase
-- receipt, a driver accepting a load, a stuffing supervisor sealing a container.
-- Each of those is a signature row carrying who signed, in what role, by what
-- method, WHEN, and WHERE (the "e-signed, timestamp, location" standard). We store a
-- hash of the captured signature, never raw biometrics. Writes go through an RPC; a
-- signature on a lot is also sealed into the tamper-evident lot chain. No em-dashes.

create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  subject_type text not null check (subject_type in ('lot','lot_event','consignment','shipment','document','transformation','purchase_receipt')),
  subject_id uuid not null,
  signer_role text not null check (signer_role in ('producer','driver','stuffing_supervisor','inspector','agent','buyer','other')),
  signer_name text not null,
  signer_party_id uuid references parties(id),
  method text not null default 'drawn' check (method in ('thumbprint','drawn','pin','photo','typed')),
  signature_hash text,                 -- sha256 of the captured signature payload, never the raw biometric
  signed_at timestamptz not null default now(),
  captured_lat numeric,
  captured_lng numeric,
  place text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists signatures_subject on signatures (subject_type, subject_id);
create index if not exists signatures_org on signatures (organization_id);

-- Record a human signature. If it is on a lot, also seal a signature event into the
-- lot's tamper-evident chain, so the attestation cannot be silently detached.
create or replace function record_signature(
  p_org uuid, p_subject_type text, p_subject_id uuid, p_signer_role text, p_signer_name text,
  p_method text default 'drawn', p_signature_hash text default null,
  p_lat numeric default null, p_lng numeric default null, p_place text default null,
  p_signer_party uuid default null, p_signed_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  insert into signatures (organization_id, subject_type, subject_id, signer_role, signer_name, signer_party_id, method, signature_hash, signed_at, captured_lat, captured_lng, place)
    values (p_org, p_subject_type, p_subject_id, p_signer_role, p_signer_name, p_signer_party, p_method, p_signature_hash, coalesce(p_signed_at, now()), p_lat, p_lng, p_place)
  returning id into v_id;

  if p_subject_type = 'lot' then
    perform record_lot_event(gen_random_uuid(), p_subject_id, 'signature',
      jsonb_build_object('signature_id', v_id, 'role', p_signer_role, 'signer', p_signer_name, 'hash', p_signature_hash, 'place', p_place),
      coalesce(p_signed_at, now()), null);
  end if;
  return v_id;
end $$;
grant execute on function record_signature(uuid, text, uuid, text, text, text, text, numeric, numeric, text, uuid, timestamptz) to authenticated;

-- RLS: a signature is the owning org's data.
alter table signatures enable row level security;
revoke all on signatures from anon, authenticated;
grant select on signatures to authenticated;
create policy signatures_read on signatures for select to authenticated using (is_org_member(organization_id));
