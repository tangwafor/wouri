-- Wouri 0005: the atomic org-signup RPC (the PulSe pattern)
-- Traces to ADR-0029. One transaction creates the org, its first location, and the
-- owner membership, so a half-created tenant is unrepresentable. No em-dashes.

create or replace function create_organization(
  p_org_name text,
  p_org_slug text,
  p_first_location_name text default 'Siege',
  p_country text default 'CM',
  p_locale text default 'fr'
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_person uuid;
  v_org uuid;
  v_loc uuid;
  v_owner_role uuid;
  v_membership uuid;
  v_slug text := lower(trim(p_org_slug));
begin
  if p_org_name is null or p_org_name = '' then raise exception 'Organization name is required'; end if;
  if v_slug is null or v_slug = '' then raise exception 'Organization slug is required'; end if;
  if exists (select 1 from organizations where slug = v_slug) then
    raise exception 'That slug is taken. Please choose another.';
  end if;

  select id into v_person from people where auth_user_id = (select auth.uid());
  if v_person is null then raise exception 'No signed-in user'; end if;

  insert into organizations (slug, legal_name, status, default_locale, base_currency, onboarding_channel)
  values (v_slug, p_org_name, 'onboarding', coalesce(p_locale,'fr'),
          case when p_country = 'CM' then 'XAF' else 'XAF' end, 'self_serve_click')
  returning id into v_org;

  insert into locations (organization_id, name, country, kind)
  values (v_org, coalesce(p_first_location_name,'Siege'), p_country, 'buying_station')
  returning id into v_loc;

  -- Instantiate the org's owner role from the system template and assign it.
  insert into roles (organization_id, key, label_fr, label_en, is_system)
  select v_org, key, label_fr, label_en, false from roles where organization_id is null and is_system = true
  on conflict do nothing;
  select id into v_owner_role from roles where organization_id = v_org and key = 'owner';

  insert into memberships (person_id, organization_id, status, is_primary)
  values (v_person, v_org, 'active', true) returning id into v_membership;
  insert into role_assignments (membership_id, role_id) values (v_membership, v_owner_role);

  -- Record the creation on the event spine.
  insert into org_events (id, organization_id, kind, actor_person_id, channel, payload)
  values (gen_random_uuid(), v_org, 'org.created', v_person, 'self_serve_click',
          json_build_object('slug', v_slug)::jsonb);

  return json_build_object('organization_id', v_org, 'membership_id', v_membership, 'slug', v_slug);
end $$;
