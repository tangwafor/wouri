-- Wouri 0031: organization_groups, the tenant-of-tenants skeleton
-- A holding, a cooperative-of-cooperatives, or an EUDR/FSC group-certification
-- scheme groups several organizations under one coordinator, so they can share a
-- group certificate (research track 07, FSC group-certification precedent).
-- Membership is opt-in and consented: a coordinator invites, the member org's own
-- admin accepts. Nobody is added by force. This is the schema that genuinely
-- breaks a live database if retrofitted later, so the skeleton lands now even
-- though the shared-certificate feature comes later. All writes go through
-- SECURITY DEFINER RPCs; direct writes are revoked. No em-dashes.

create table if not exists organization_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'holding' check (kind in ('holding','cooperative_union','group_certification')),
  owner_organization_id uuid not null references organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists org_groups_owner on organization_groups (owner_organization_id);

create table if not exists organization_group_members (
  group_id uuid not null references organization_groups(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','active','left')),
  role text not null default 'member' check (role in ('coordinator','member')),
  invited_at timestamptz not null default now(),
  consented_at timestamptz,
  primary key (group_id, organization_id)
);
create index if not exists ogm_org on organization_group_members (organization_id);

-- Create a group; the owner org becomes the active coordinator in one step.
create or replace function create_organization_group(p_owner_org uuid, p_name text, p_kind text default 'holding')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_group uuid;
begin
  if not is_org_admin(p_owner_org) then raise exception 'only an org admin can create a group'; end if;
  insert into organization_groups (name, kind, owner_organization_id) values (p_name, p_kind, p_owner_org) returning id into v_group;
  insert into organization_group_members (group_id, organization_id, status, role, consented_at)
    values (v_group, p_owner_org, 'active', 'coordinator', now());
  return v_group;
end $$;

-- A coordinator invites another org. It is only an invitation until that org consents.
create or replace function invite_org_to_group(p_group uuid, p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_organization_id into v_owner from organization_groups where id = p_group;
  if v_owner is null then raise exception 'unknown group'; end if;
  if not is_org_admin(v_owner) then raise exception 'only the group coordinator can invite'; end if;
  insert into organization_group_members (group_id, organization_id, status, role)
    values (p_group, p_org, 'invited', 'member')
  on conflict (group_id, organization_id) do nothing;
end $$;

-- The invited org's own admin consents. This is the only path to active membership.
create or replace function accept_group_membership(p_group uuid, p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_org_admin(p_org) then raise exception 'only the member org admin can accept'; end if;
  update organization_group_members set status = 'active', consented_at = now()
    where group_id = p_group and organization_id = p_org and status = 'invited';
  if not found then raise exception 'no pending invitation for this org'; end if;
end $$;

grant execute on function create_organization_group(uuid, text, text) to authenticated;
grant execute on function invite_org_to_group(uuid, uuid) to authenticated;
grant execute on function accept_group_membership(uuid, uuid) to authenticated;

-- RLS. Reads: the coordinator org and any member org (invited or active) see the
-- group and its membership. Writes are RPC-only.
alter table organization_groups enable row level security;
revoke all on organization_groups from anon, authenticated;
grant select on organization_groups to authenticated;
create policy org_groups_read on organization_groups for select to authenticated using (
  is_org_member(owner_organization_id)
  or exists (select 1 from organization_group_members m where m.group_id = id and is_org_member(m.organization_id))
);

alter table organization_group_members enable row level security;
revoke all on organization_group_members from anon, authenticated;
grant select on organization_group_members to authenticated;
create policy ogm_read on organization_group_members for select to authenticated using (
  is_org_member(organization_id)
  or exists (select 1 from organization_groups g where g.id = group_id and is_org_member(g.owner_organization_id))
);
