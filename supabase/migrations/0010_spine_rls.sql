-- Wouri 0010: RLS for the spine (the single isolation gate extends to Sprint 1)
-- Traces to ADR-0006 and the architecture research: deny-by-default, org-scoped
-- via is_org_member wrapped in a scalar subquery, column GRANTs so a client can
-- never write lot_events integrity fields, and the server chain + secret table
-- locked to nobody. No em-dashes.

-- Enable RLS on every new table.
do $$
declare t text;
begin
  foreach t in array array[
    'commodities','parties','origin_units','origin_unit_versions','origin_evidence',
    'lots','transformations','lineage','contracts','consignments','consignment_lots',
    'cost_entries','tasks','lot_events','server_event_chain','wouri_secrets'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- Authenticated gets table access; the policies below decide the rows. lot_events,
-- the server chain, and the secret are handled explicitly further down.
grant select, insert, update, delete on
  commodities, parties, origin_units, origin_unit_versions, origin_evidence,
  lots, transformations, lineage, contracts, consignments, consignment_lots,
  cost_entries, tasks
  to authenticated;

-- Commodities are shared reference data: any tenant reads, none writes.
create policy commodities_read on commodities for select to authenticated using (true);

-- Org-scoped tables: one policy each, member-only for read and write.
do $$
declare t text;
begin
  foreach t in array array[
    'parties','origin_units','origin_unit_versions','origin_evidence','lots',
    'transformations','lineage','contracts','consignments','consignment_lots',
    'cost_entries','tasks'
  ] loop
    execute format(
      'create policy %1$s_member on %1$s for all to authenticated
         using (is_org_member(organization_id)) with check (is_org_member(organization_id))', t);
  end loop;
end $$;

-- ── lot_events: read as a member; insert only, only safe columns, only for a lot
--    that belongs to the same org. No update or delete grant or policy exists;
--    the trigger and the missing policy both refuse mutation. ─────────────────
revoke all on lot_events from authenticated;
grant select on lot_events to authenticated;
grant insert (id, organization_id, lot_id, event_type, payload, occurred_at, clock_delta_ms, actor_person_id, compensates_event_id)
  on lot_events to authenticated;

create policy lot_events_read on lot_events for select to authenticated
  using (is_org_member(organization_id));

create policy lot_events_insert on lot_events for insert to authenticated
  with check (
    is_org_member(organization_id)
    and exists (select 1 from lots l where l.id = lot_id and l.organization_id = lot_events.organization_id)
  );

-- ── The server chain and the secret answer to nobody through the client. RLS is
--    on with no policy, so every authenticated/anon row read or write is denied;
--    only the SECURITY DEFINER trigger and verify function touch them. ─────────
revoke all on server_event_chain from authenticated;
revoke all on wouri_secrets from authenticated;
