-- Wouri 0006: RLS deny-by-default, the single isolation gate
-- Traces to ADR-0006. Reads are scoped to org membership; writes go through the
-- security-definer RPCs (create_organization, append_org_event). Anon gets nothing.
-- Every auth call is wrapped in a scalar subquery. No em-dashes.

-- Admin helper: is the caller an owner or admin of the org.
create or replace function is_org_admin(p_org uuid)
returns bool language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join people pe on pe.id = m.person_id and pe.auth_user_id = (select auth.uid())
    join role_assignments ra on ra.membership_id = m.id
    join roles r on r.id = ra.role_id
    where m.organization_id = p_org and m.status = 'active' and r.key in ('owner','admin')
  );
$$;

-- Enable RLS on every tenant + reference table.
do $$
declare t text;
begin
  foreach t in array array[
    'people','organizations','locations','roles','role_capabilities','memberships',
    'role_assignments','org_events','capability_catalog','organization_capabilities',
    'currencies','fx_rates','units'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Grants: anon gets no table access; authenticated is gated by the policies below.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ── SELECT isolation ──────────────────────────────────────────────────────────
create policy people_self on people for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy orgs_member_read on organizations for select to authenticated
  using (is_org_member(id));

create policy locations_member_read on locations for select to authenticated
  using (is_org_member(organization_id));

create policy roles_read on roles for select to authenticated
  using (organization_id is null or is_org_member(organization_id));

create policy role_caps_read on role_capabilities for select to authenticated
  using (exists (select 1 from roles r where r.id = role_id
                 and (r.organization_id is null or is_org_member(r.organization_id))));

create policy memberships_read on memberships for select to authenticated
  using (person_id in (select id from people where auth_user_id = (select auth.uid()))
         or is_org_member(organization_id));

create policy role_assign_read on role_assignments for select to authenticated
  using (exists (select 1 from memberships m where m.id = membership_id and is_org_member(m.organization_id)));

create policy org_events_read on org_events for select to authenticated
  using (is_org_member(organization_id));

create policy org_caps_read on organization_capabilities for select to authenticated
  using (is_org_member(organization_id));

-- ── Reference data: readable by any authenticated tenant, never by anon ───────
create policy catalog_read on capability_catalog for select to authenticated using (true);
create policy currencies_read on currencies for select to authenticated using (true);
create policy fx_read on fx_rates for select to authenticated using (true);
create policy units_read on units for select to authenticated using (true);

-- ── Direct writes that owner/admin may make (most writes are via RPCs) ────────
create policy org_caps_write on organization_capabilities for all to authenticated
  using (is_org_admin(organization_id)) with check (is_org_admin(organization_id));
create policy people_self_update on people for update to authenticated
  using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));
