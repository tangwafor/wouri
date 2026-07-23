-- Wouri 0023: the live cockpit cache (FX + weather), resilient by design
-- Real-time market data is inherently external, so we cache the last-known value
-- in the DB: if the upstream API is down, the cockpit still shows the last good
-- figures with a staleness note, never a blank. The refresh writes through a
-- SECURITY DEFINER function; everyone reads. Public data (rates, weather), so a
-- shared cache is fine. No em-dashes.

create table if not exists market_cache (
  key text primary key,
  data jsonb not null,
  source text,
  fetched_at timestamptz not null default now()
);

create or replace function cache_market(p_key text, p_data jsonb, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into market_cache (key, data, source, fetched_at) values (p_key, p_data, p_source, now())
  on conflict (key) do update set data = excluded.data, source = excluded.source, fetched_at = now();
end $$;

alter table market_cache enable row level security;
revoke all on market_cache from anon;
grant select on market_cache to authenticated;
create policy market_cache_read on market_cache for select to authenticated using (true);
grant execute on function cache_market(text, jsonb, text) to authenticated;
