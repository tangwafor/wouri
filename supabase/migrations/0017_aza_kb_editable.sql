-- Wouri 0017: owner-editable Aza knowledge base
-- The bundled kb.mjs is the offline floor; this table is the LIVE, editable layer
-- a platform owner curates without a code deploy (ADR-0032). KB content is
-- platform-wide reference (cocoa thresholds are the same for every tenant), so
-- only a platform admin may edit it; any authenticated user may read it. Every
-- edit is stamped and flows through registry_audit discipline. No em-dashes.

-- Who may edit platform reference data. Seeded out of band (grant-platform-admin
-- script, service role), never writable through the client.
create table if not exists platform_admins (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  added_at timestamptz not null default now()
);

create or replace function is_platform_admin()
returns bool language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where auth_user_id = (select auth.uid()));
$$;

create table if not exists aza_kb (
  key text primary key,
  kind text not null check (kind in ('commodity','rail','regulation','capability')),
  label_en text, label_fr text,
  body_en text, body_fr text,
  data jsonb not null default '{}'::jsonb,        -- hs_code, eudr, cites, quality, documents, sources
  source text,
  review_by date,
  updated_at timestamptz not null default now(),
  updated_by uuid references people(id) on delete set null
);

-- Stamp who changed it and when, on every edit.
create or replace function aza_kb_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := (select id from people where auth_user_id = (select auth.uid()));
  return new;
end $$;
drop trigger if exists aza_kb_stamp_trg on aza_kb;
create trigger aza_kb_stamp_trg before insert or update on aza_kb
  for each row execute function aza_kb_stamp();

-- RLS: anyone signed in reads; only a platform admin writes.
alter table platform_admins enable row level security;
alter table aza_kb enable row level security;
revoke all on platform_admins from anon, authenticated;
revoke all on aza_kb from anon;
grant select on platform_admins to authenticated;
grant select, insert, update, delete on aza_kb to authenticated;

create policy platform_admins_read on platform_admins for select to authenticated
  using (auth_user_id = (select auth.uid()) or is_platform_admin());
create policy aza_kb_read on aza_kb for select to authenticated using (true);
create policy aza_kb_write on aza_kb for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

grant execute on function is_platform_admin() to authenticated;
