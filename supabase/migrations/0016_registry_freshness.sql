-- Wouri 0016: registry freshness (how the registry stays current)
-- Three mechanisms keep Wouri current without a code deploy: (1) the registry is
-- effective-dated data (ADR-0002), so an update is a NEW row and the old one
-- survives for historical pinning; (2) registry_audit (0011) logs every change
-- with actor and before/after; (3) this review tracker names every fast-moving
-- fact, its source, and when it is next due for review, with a view that flags
-- what is overdue. FX and market rates are real-time (the live cockpit, Sprint 3)
-- and are marked as such. No em-dashes.

create table if not exists registry_review (
  topic text primary key,
  title text not null,
  source text not null,
  cadence text not null,               -- realtime | quarterly | semiannual | annual
  review_by date,                      -- null = continuously refreshed (e.g. FX)
  last_reviewed_at date,
  notes text,
  created_at timestamptz not null default now()
);

insert into registry_review (topic, title, source, cadence, review_by, notes) values
  ('eudr_dates','EUDR application dates','Reg (EU) 2023/1115 + 2025/2650','quarterly','2026-10-01','Large/medium 30 Dec 2026; micro/small 30 Jun 2027. Verify no further amendment.'),
  ('cites_list','CITES appendices and banned-species list','CITES appendices, CoP outcomes','quarterly','2026-10-01','Re-check listed timber species and the national banned list.'),
  ('beac_repatriation','BEAC foreign-exchange repatriation window','BEAC FX regulation, CEMAC','semiannual','2026-10-01','150-day repatriation; settled means repatriated. Do not hardcode 35 percent.'),
  ('flegt_status','FLEGT status for Cameroon','EU-Cameroon VPA','semiannual','2026-10-01','VPA terminated 17 Jun 2025; no FLEGT gate on timber.'),
  ('quality_packs','Commodity quality thresholds','ISO 2451/4150/6673/2000, PORAM/MS814, USDA HVI, Codex STAN 205','annual','2027-01-01','Reconcile each pack against a real certificate of analysis (ADR-0030).'),
  ('fx_market_rates','FX and daily market rates','Live feed (cockpit, Sprint 3)','realtime',null,'Real-time; not a manual review item.')
on conflict (topic) do nothing;

-- What is due or overdue for review, most urgent first.
create or replace view registry_freshness as
  select topic, title, source, cadence, review_by, last_reviewed_at,
    case when review_by is null then false else review_by <= current_date end as overdue,
    notes
  from registry_review
  order by (review_by is null), review_by;

alter table registry_review enable row level security;
revoke all on registry_review from anon;
grant select on registry_review to authenticated;
grant select on registry_freshness to authenticated;
create policy registry_review_read on registry_review for select to authenticated using (true);
