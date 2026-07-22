-- Wouri 0009: lot_events, append-only and tamper-evident
-- Traces to ADR-0003 (append-only custody, client-minted uuid, compensating
-- events) and the architecture research (track 05): a per-lot hash chain the
-- SERVER computes (clients never set integrity fields), plus a per-tenant server
-- chain counter-signed at ingest with a server-held key, so an attacker with a
-- field device cannot forge history. Merkle checkpoints and Ed25519 come with the
-- Sprint 2 proof layer; this is the ingest chain they anchor. No em-dashes.

-- ── Server secret (never granted to anyone; read only inside definer funcs) ────
create table if not exists wouri_secrets (
  key_name text primary key,
  secret text not null,
  created_at timestamptz not null default now()
);
insert into wouri_secrets (key_name, secret)
  values ('lot_chain_hmac', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key_name) do nothing;

-- ── Per-tenant server chain (append-only running head, counter-signed) ─────────
create table if not exists server_event_chain (
  id bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null,
  event_hash text not null,
  prev_head text,
  head_sig text not null,
  created_at timestamptz not null default now()
);
create index if not exists server_chain_org on server_event_chain (organization_id, id);

-- ── lot_events (client-minted uuid pk; server seals seq + hashes + signature) ──
create table if not exists lot_events (
  id uuid primary key,                                   -- client-minted, idempotent
  organization_id uuid not null references organizations(id) on delete cascade,
  lot_id uuid not null references lots(id) on delete cascade,
  seq int not null,                                      -- per-lot, server-assigned
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),        -- provenance, not chain authority
  clock_delta_ms bigint,                                 -- device skew, provenance only
  actor_person_id uuid references people(id) on delete set null,
  compensates_event_id uuid references lot_events(id),   -- corrections point here
  prev_event_hash text,                                  -- server-computed
  event_hash text not null,                              -- server-computed
  server_seq bigint,                                     -- server chain row id
  created_at timestamptz not null default now(),
  unique (lot_id, seq)
);
create index if not exists lot_events_lot on lot_events (lot_id, seq);
create index if not exists lot_events_org on lot_events (organization_id, created_at);

-- The canonical pre-image. Server-controlled fields only: no wall clock as
-- authority (the research is explicit about clock skew never entering as truth).
create or replace function lot_event_hash(p_org uuid, p_lot uuid, p_seq int, p_type text, p_payload jsonb, p_prev text)
returns text language sql immutable set search_path = public, extensions as $$
  select encode(digest(
    p_org::text || '|' || p_lot::text || '|' || p_seq::text || '|' || p_type || '|' ||
    coalesce(p_payload::text, '{}') || '|' || coalesce(p_prev, ''), 'sha256'), 'hex');
$$;

-- BEFORE INSERT: assign the per-lot seq, link the hash chain, counter-sign into
-- the per-tenant server chain. Definer so it can read the secret and write the
-- server chain that clients have no grants to. Per-org advisory lock serializes
-- the chain head under concurrent ingest.
create or replace function lot_events_seal()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prev_hash text;
  v_seq int;
  v_secret text;
  v_prev_head text;
  v_head_sig text;
  v_chain_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext(new.organization_id::text));

  select coalesce(max(seq), 0) + 1, (select event_hash from lot_events where lot_id = new.lot_id order by seq desc limit 1)
    into v_seq, v_prev_hash
    from lot_events where lot_id = new.lot_id;

  new.seq := v_seq;
  new.prev_event_hash := v_prev_hash;
  new.event_hash := lot_event_hash(new.organization_id, new.lot_id, v_seq, new.event_type, new.payload, v_prev_hash);

  -- Counter-sign onto the per-tenant server chain.
  select secret into v_secret from wouri_secrets where key_name = 'lot_chain_hmac';
  select head_sig into v_prev_head from server_event_chain
    where organization_id = new.organization_id order by id desc limit 1;
  v_head_sig := encode(hmac(coalesce(v_prev_head, '') || '|' || new.event_hash, v_secret, 'sha256'), 'hex');
  insert into server_event_chain (organization_id, event_id, event_hash, prev_head, head_sig)
    values (new.organization_id, new.id, new.event_hash, v_prev_head, v_head_sig)
    returning id into v_chain_id;
  new.server_seq := v_chain_id;
  return new;
end $$;
drop trigger if exists lot_events_seal_trg on lot_events;
create trigger lot_events_seal_trg before insert on lot_events
  for each row execute function lot_events_seal();

-- Append-only: no update, no delete, ever. Corrections are compensating events.
create or replace function lot_events_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'lot_events is append-only; record a compensating event instead';
end $$;
drop trigger if exists lot_events_no_mutate on lot_events;
create trigger lot_events_no_mutate before update or delete on lot_events
  for each row execute function lot_events_append_only();

-- ── Convenience RPCs (offline-idempotent; membership-checked) ──────────────────
create or replace function record_lot_event(
  p_id uuid, p_lot uuid, p_type text, p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now(), p_clock_delta bigint default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_actor uuid;
begin
  select organization_id into v_org from lots where id = p_lot;
  if v_org is null then raise exception 'unknown lot'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;
  select id into v_actor from people where auth_user_id = (select auth.uid());
  insert into lot_events (id, organization_id, lot_id, event_type, payload, occurred_at, clock_delta_ms, actor_person_id)
    values (p_id, v_org, p_lot, p_type, coalesce(p_payload, '{}'::jsonb), coalesce(p_occurred_at, now()), p_clock_delta, v_actor)
  on conflict (id) do nothing;   -- exactly-once replay
  return p_id;
end $$;

-- A correction: never a delete. Appends a void event that points at its target.
create or replace function void_lot_event(p_id uuid, p_target uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_lot uuid; v_actor uuid;
begin
  select organization_id, lot_id into v_org, v_lot from lot_events where id = p_target;
  if v_org is null then raise exception 'unknown target event'; end if;
  if not is_org_member(v_org) then raise exception 'not a member of this org'; end if;
  select id into v_actor from people where auth_user_id = (select auth.uid());
  insert into lot_events (id, organization_id, lot_id, event_type, payload, actor_person_id, compensates_event_id)
    values (p_id, v_org, v_lot, 'custody_event_voided', jsonb_build_object('reason', p_reason, 'target', p_target), v_actor, p_target)
  on conflict (id) do nothing;
  return p_id;
end $$;

-- ── Verify a lot's chain by recomputing every link in order ────────────────────
create or replace function verify_lot_chain(p_lot uuid)
returns table(ok bool, checked int, detail text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare r record; v_prev text; v_expect text; v_n int := 0;
begin
  v_prev := null;
  for r in select * from lot_events where lot_id = p_lot order by seq asc loop
    v_n := v_n + 1;
    if r.prev_event_hash is distinct from v_prev then
      ok := false; checked := v_n; detail := 'prev-hash break at seq ' || r.seq; return next; return;
    end if;
    v_expect := lot_event_hash(r.organization_id, r.lot_id, r.seq, r.event_type, r.payload, v_prev);
    if r.event_hash <> v_expect then
      ok := false; checked := v_n; detail := 'hash mismatch at seq ' || r.seq; return next; return;
    end if;
    v_prev := r.event_hash;
  end loop;
  ok := true; checked := v_n; detail := 'chain intact'; return next;
end $$;
