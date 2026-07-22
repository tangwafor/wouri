-- Wouri 0002: the org event spine (append-only, client-minted uuid)
-- Traces to ADR-0003. This is the audit/spine stream for org-scoped events
-- (onboarding, auth, capabilities). Physical custody lot_events come in Sprint 1.
-- No em-dashes.

create table if not exists org_events (
  id uuid primary key,                       -- client-minted; replay collapses here
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null,
  actor_person_id uuid references people(id),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  channel text,
  payload jsonb not null default '{}'::jsonb,
  seq bigint generated always as identity      -- server receive order
);

create index if not exists org_events_org_seq on org_events (organization_id, seq);

-- Idempotent append. Replaying a queued event collapses on the primary key.
create or replace function append_org_event(
  p_id uuid, p_org uuid, p_kind text, p_payload jsonb default '{}'::jsonb,
  p_channel text default null, p_occurred_at timestamptz default now()
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_actor uuid;
begin
  select id into v_actor from people where auth_user_id = (select auth.uid());
  insert into org_events (id, organization_id, kind, actor_person_id, occurred_at, channel, payload)
  values (p_id, p_org, p_kind, v_actor, coalesce(p_occurred_at, now()), p_channel, coalesce(p_payload,'{}'::jsonb))
  on conflict (id) do nothing;   -- exactly-once for free
  return p_id;
end $$;

-- Append-only: no update or delete policy will ever be added to org_events (ADR-0003).
