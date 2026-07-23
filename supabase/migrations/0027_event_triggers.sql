-- Wouri 0027: event triggers and notifications
-- The registry should react, not just record. Database triggers fire on the
-- events that matter (a document issued, a discrepancy raised, a settlement
-- repatriated, a shipment moved) and drop a notification for the org, delivered
-- in real time. Notifications are written by the triggers (SECURITY DEFINER), read
-- by members, and marked read by members. In-app and free, no external service.
-- No em-dashes.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind text not null,
  severity text not null default 'info' check (severity in ('info','warning','high','critical')),
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_org on notifications (organization_id, created_at desc);

create or replace function notify(p_org uuid, p_kind text, p_severity text, p_title text, p_body text, p_entity_type text, p_entity_id uuid)
returns void language sql security definer set search_path = public as $$
  insert into notifications (organization_id, kind, severity, title, body, entity_type, entity_id)
  values (p_org, p_kind, p_severity, p_title, p_body, p_entity_type, p_entity_id);
$$;

-- Document issued.
create or replace function trg_notify_document()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select code into v_code from consignments where id = new.consignment_id;
  perform notify(new.organization_id, 'document_issued', 'info',
    'Document issued', new.template_key || ' for ' || coalesce(v_code, 'a consignment'),
    'consignment', new.consignment_id);
  return new;
end $$;
drop trigger if exists notify_document on documents;
create trigger notify_document after insert on documents for each row execute function trg_notify_document();

-- Settlement discrepancy raised.
create or replace function trg_notify_discrepancy()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_con uuid;
begin
  select consignment_id into v_con from settlement_instruments where id = new.instrument_id;
  perform notify(new.organization_id, 'discrepancy', 'high',
    'Settlement discrepancy raised', coalesce(new.description, new.code), 'consignment', v_con);
  return new;
end $$;
drop trigger if exists notify_discrepancy on settlement_discrepancies;
create trigger notify_discrepancy after insert on settlement_discrepancies for each row execute function trg_notify_discrepancy();

-- Settlement advanced (paid, repatriated).
create or replace function trg_notify_settlement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'repatriated' then
      perform notify(new.organization_id, 'settled', 'info', 'Consignment settled', 'Proceeds repatriated', 'consignment', new.consignment_id);
    elsif new.status = 'paid' then
      perform notify(new.organization_id, 'paid', 'info', 'Settlement marked paid', 'Now watch the repatriation clock', 'consignment', new.consignment_id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notify_settlement on settlement_instruments;
create trigger notify_settlement after update on settlement_instruments for each row execute function trg_notify_settlement();

-- Shipment moved.
create or replace function trg_notify_shipment()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if new.status is distinct from old.status then
    select code into v_code from consignments where id = new.consignment_id;
    perform notify(new.organization_id, 'shipment', 'info',
      'Shipment ' || new.status, coalesce(v_code, 'a consignment'), 'consignment', new.consignment_id);
  end if;
  return new;
end $$;
drop trigger if exists notify_shipment on shipments;
create trigger notify_shipment after update on shipments for each row execute function trg_notify_shipment();

-- RLS: members read and mark read; the triggers write via the definer function.
alter table notifications enable row level security;
revoke all on notifications from anon;
grant select, update on notifications to authenticated;
create policy notifications_read on notifications for select to authenticated using (is_org_member(organization_id));
create policy notifications_mark on notifications for update to authenticated
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));

-- Real time: publish inserts so the inbox updates live.
do $$ begin
  begin alter publication supabase_realtime add table notifications; exception when others then null; end;
end $$;
