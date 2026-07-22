-- Wouri 0012: a controlled purge path for lot_events
-- The append-only guard (0009) refuses every update and delete, which also blocks
-- the cascade delete when a tenant is torn down (org offboarding, a test cleanup,
-- an erasure request). Custody events must stay immutable in normal operation, so
-- deletion is gated behind a session flag no client can set: the DELETE grant and
-- policy do not exist for authenticated, so only an owner-level session that has
-- deliberately set wouri.purge = 'on' (a superuser or the service role in a
-- controlled teardown) can let a cascade through. Updates remain forbidden
-- outright; corrections are still compensating events. No em-dashes.

create or replace function lot_events_append_only()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'DELETE' and coalesce(current_setting('wouri.purge', true), '') = 'on' then
    return old;   -- a deliberate administrative teardown
  end if;
  raise exception 'lot_events is append-only; record a compensating event instead';
end $$;
