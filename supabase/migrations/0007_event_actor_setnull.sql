-- Wouri 0007: org_events outlive people (append-only)
-- An event is permanent; if the person who caused it is removed, the event stays
-- with a null actor rather than blocking the delete. Traces to ADR-0003. No em-dashes.

alter table org_events drop constraint if exists org_events_actor_person_id_fkey;
alter table org_events add constraint org_events_actor_person_id_fkey
  foreign key (actor_person_id) references people(id) on delete set null;
