-- Wouri 0001: identity, organizations, roles, memberships (Sprint 0 foundation)
-- Traces to ADR-0025 (Bazah substrate), ADR-0029 (PulSe auth), ADR-0002 (row not column).
-- No em-dashes.

create extension if not exists btree_gist;

-- ── People (one row per human, linked to Supabase Auth) ──────────────────────
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  full_name text,
  contact jsonb not null default '{}'::jsonb,
  default_locale text not null default 'fr',
  created_at timestamptz not null default now()
);

-- ── Organizations (the tenant) ───────────────────────────────────────────────
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  legal_name text,
  status text not null default 'onboarding'
    check (status in ('draft','onboarding','active','suspended')),
  verification_level text not null default 'unverified'
    check (verification_level in ('unverified','self_declared','documents_submitted','verified')),
  verified_at timestamptz,
  verification_subdomain text,
  vertical text,
  base_currency text not null default 'XAF',
  default_locale text not null default 'fr',
  rccm text, niu text, exporter_registrations jsonb not null default '{}'::jsonb,
  brand jsonb not null default '{}'::jsonb,
  onboarding_channel text check (onboarding_channel in ('self_serve_click','self_serve_chat','concierge')),
  claim_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  parent_id uuid references locations(id),
  kind text not null default 'buying_station',
  name text not null,
  city text, region text, country text,
  created_at timestamptz not null default now()
);

-- ── Roles (system roles are org-scoped instances) + capability sets ───────────
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade, -- null = system template
  key text not null,
  label_fr text not null,
  label_en text not null,
  is_system bool not null default false,
  unique (organization_id, key)
);

create table if not exists role_capabilities (
  role_id uuid not null references roles(id) on delete cascade,
  capability_key text not null,
  granted bool not null default true,
  primary key (role_id, capability_key)
);

-- ── Memberships + assignments ─────────────────────────────────────────────────
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  status text not null default 'active' check (status in ('invited','active','suspended')),
  is_primary bool not null default true,
  created_at timestamptz not null default now(),
  unique (person_id, organization_id)
);

create table if not exists role_assignments (
  membership_id uuid not null references memberships(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  primary key (membership_id, role_id)
);

-- ── The new-auth-user trigger: create a people row on signup ──────────────────
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into people (auth_user_id, full_name, default_locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.raw_user_meta_data->>'locale','fr'))
  on conflict (auth_user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ── Membership helper (used by RLS; a member of an org) ───────────────────────
create or replace function is_org_member(p_org uuid)
returns bool language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    join people pe on pe.id = m.person_id
    where m.organization_id = p_org and m.status = 'active'
      and pe.auth_user_id = (select auth.uid())
  );
$$;

-- ── Seed the system role templates (org-scoped copies made at signup) ─────────
insert into roles (organization_id, key, label_fr, label_en, is_system) values
  (null,'owner','Proprietaire','Owner',true),
  (null,'admin','Administrateur','Admin',true),
  (null,'manager','Responsable export','Export manager',true),
  (null,'documentation_officer','Agent documentaire','Documentation officer',true),
  (null,'field_agent','Agent de terrain','Field agent',true),
  (null,'finance','Finance','Finance',true),
  (null,'viewer','Lecture seule','Viewer',true)
on conflict do nothing;
