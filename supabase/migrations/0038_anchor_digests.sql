-- Wouri 0038: Merkle checkpoints, so a document proves it existed at a point in time
-- ADR-0004 and ADR-0008: the server periodically folds the issued document hashes
-- into a signed, published Merkle root (the Certificate Transparency model). A third
-- party can then verify, offline, that a specific document was included in a
-- published checkpoint, and cannot be back-dated or removed without changing the
-- root. Roots are public (that is the point of a transparency anchor); the inclusion
-- proof is reconstructible from the append-only document set. The root is
-- Ed25519-signed with the same server key that signs documents. No em-dashes.

create extension if not exists pgcrypto;

create table if not exists anchor_digests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope text not null default 'documents',
  merkle_root text not null,          -- hex sha256
  leaf_count int not null,
  covered_through timestamptz not null,
  root_signature jsonb,               -- Ed25519 signature over the root (set by the anchoring step)
  external_anchor text,               -- optional RFC 3161 / public-ledger reference
  created_at timestamptz not null default now()
);
create index if not exists anchor_org on anchor_digests (organization_id, covered_through desc);

-- A plain binary Merkle tree over already-hashed leaves: node = sha256(left || right),
-- an odd node is promoted unpaired. The JS verifier mirrors this exactly.
create or replace function merkle_root(p_leaves bytea[])
returns bytea language plpgsql immutable set search_path = public, extensions as $$
declare cur bytea[]; nxt bytea[]; n int; i int;
begin
  cur := p_leaves;
  if cur is null or array_length(cur, 1) is null then return digest(''::bytea, 'sha256'); end if;
  while array_length(cur, 1) > 1 loop
    nxt := array[]::bytea[]; n := array_length(cur, 1); i := 1;
    while i <= n loop
      if i < n then nxt := nxt || digest(cur[i] || cur[i + 1], 'sha256'); i := i + 2;
      else nxt := nxt || cur[i]; i := i + 1; end if;
    end loop;
    cur := nxt;
  end loop;
  return cur[1];
end $$;

-- The sibling path for the leaf at 1-based index p_index, leaf to root.
create or replace function merkle_proof(p_leaves bytea[], p_index int)
returns jsonb language plpgsql immutable set search_path = public, extensions as $$
declare cur bytea[]; nxt bytea[]; n int; i int; idx int; proof jsonb := '[]'::jsonb; sib bytea; side text;
begin
  cur := p_leaves; idx := p_index;
  if cur is null or array_length(cur, 1) is null then return proof; end if;
  while array_length(cur, 1) > 1 loop
    n := array_length(cur, 1);
    if idx % 2 = 1 then
      if idx + 1 <= n then sib := cur[idx + 1]; side := 'right'; else sib := null; end if;
    else
      sib := cur[idx - 1]; side := 'left';
    end if;
    if sib is not null then proof := proof || jsonb_build_object('sibling', encode(sib, 'hex'), 'side', side); end if;
    idx := (idx + 1) / 2;
    nxt := array[]::bytea[]; i := 1;
    while i <= n loop
      if i < n then nxt := nxt || digest(cur[i] || cur[i + 1], 'sha256'); i := i + 2;
      else nxt := nxt || cur[i]; i := i + 1; end if;
    end loop;
    cur := nxt;
  end loop;
  return proof;
end $$;

-- Publish a checkpoint over an org's issued documents up to now.
create or replace function anchor_documents(p_org uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_cut timestamptz := now(); v_leaves bytea[]; v_root bytea; v_id uuid; v_n int;
begin
  if not is_org_member(p_org) then raise exception 'not a member of this org'; end if;
  select array_agg(decode(content_hash, 'hex') order by created_at, id), count(*)
    into v_leaves, v_n
  from documents where organization_id = p_org and created_at <= v_cut;
  if coalesce(v_n, 0) = 0 then raise exception 'nothing to anchor'; end if;
  v_root := merkle_root(v_leaves);
  insert into anchor_digests (organization_id, scope, merkle_root, leaf_count, covered_through)
    values (p_org, 'documents', encode(v_root, 'hex'), v_n, v_cut)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function anchor_documents(uuid) to authenticated;

-- Attach the Ed25519 signature over the root (computed off-database with the server key).
create or replace function set_anchor_signature(p_checkpoint uuid, p_signature jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  select organization_id into v_org from anchor_digests where id = p_checkpoint;
  if v_org is null then raise exception 'unknown checkpoint'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;
  update anchor_digests set root_signature = p_signature where id = p_checkpoint;
end $$;
grant execute on function set_anchor_signature(uuid, jsonb) to authenticated;

-- The inclusion proof for a document against the latest checkpoint that covers it.
-- Reconstructed from the append-only document set, so no leaves need storing. Anon
-- callable: it is a public transparency proof over already-public document hashes.
create or replace function document_inclusion_proof(p_doc uuid)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare v_org uuid; v_created timestamptz; v_hash text; v_cp record; v_leaves bytea[]; v_index int;
begin
  select organization_id, created_at, content_hash into v_org, v_created, v_hash from documents where id = p_doc;
  if v_org is null then return jsonb_build_object('found', false); end if;
  select * into v_cp from anchor_digests
    where organization_id = v_org and scope = 'documents' and covered_through >= v_created
    order by covered_through desc limit 1;
  if v_cp.id is null then return jsonb_build_object('found', false, 'reason', 'not yet anchored'); end if;
  select array_agg(decode(content_hash, 'hex') order by created_at, id) into v_leaves
    from documents where organization_id = v_org and created_at <= v_cp.covered_through;
  select count(*) into v_index from documents
    where organization_id = v_org and created_at <= v_cp.covered_through and (created_at, id) <= (v_created, p_doc);
  return jsonb_build_object(
    'found', true, 'checkpoint_id', v_cp.id, 'root', v_cp.merkle_root,
    'root_signature', v_cp.root_signature, 'covered_through', v_cp.covered_through,
    'leaf', v_hash, 'index', v_index, 'leaf_count', v_cp.leaf_count,
    'proof', merkle_proof(v_leaves, v_index));
end $$;
grant execute on function document_inclusion_proof(uuid) to authenticated, anon;

-- RLS: the checkpoint roots are a public transparency log.
alter table anchor_digests enable row level security;
revoke all on anchor_digests from anon, authenticated;
grant select on anchor_digests to authenticated, anon;
create policy anchor_read on anchor_digests for select to authenticated, anon using (true);
