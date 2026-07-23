-- Wouri 0032: fix mutually recursive RLS on the organization group tables
-- The 0031 policies referenced each other's table (a group policy read membership,
-- a membership policy read the group), so Postgres detected infinite recursion.
-- The fix is the standard one: move each cross-table membership test into a
-- SECURITY DEFINER helper that reads the table directly and so is not re-checked by
-- RLS, breaking the cycle. Behaviour is unchanged; it now evaluates. No em-dashes.

create or replace function is_group_member(p_group uuid)
returns bool language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_group_members m
    where m.group_id = p_group and is_org_member(m.organization_id)
  );
$$;

create or replace function is_group_owner_member(p_group uuid)
returns bool language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_groups g
    where g.id = p_group and is_org_member(g.owner_organization_id)
  );
$$;

grant execute on function is_group_member(uuid) to authenticated;
grant execute on function is_group_owner_member(uuid) to authenticated;

drop policy if exists org_groups_read on organization_groups;
create policy org_groups_read on organization_groups for select to authenticated using (
  is_org_member(owner_organization_id) or is_group_member(id)
);

drop policy if exists ogm_read on organization_group_members;
create policy ogm_read on organization_group_members for select to authenticated using (
  is_org_member(organization_id) or is_group_owner_member(group_id)
);
