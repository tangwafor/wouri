// The live cockpit data: FX (XAF crosses) and weather at the export hotspots.
// Resilient: fetch live, cache the last-known in market_cache, and fall back to
// that cache if the upstream is down, so the cockpit is never blank. Both sources
// are free and keyless. No em-dashes.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// XAF is pegged to the euro at a fixed parity; the others float through it.
export const XAF_EUR_PEG = 655.957;

export const HOTSPOTS = [
  { name: 'Douala', role: 'Port', lat: 4.05, lon: 9.70 },
  { name: 'Kumba', role: 'Cocoa (Bakossi)', lat: 4.63, lon: 9.45 },
  { name: 'Bafoussam', role: 'Coffee (West)', lat: 5.48, lon: 10.42 },
  { name: 'Bertoua', role: 'Timber (East)', lat: 4.58, lon: 13.68 },
];

async function fetchFx(): Promise<Any> {
  const r = await fetch('https://open.er-api.com/v6/latest/USD', { next: { revalidate: 3600 } });
  if (!r.ok) throw new Error('fx http ' + r.status);
  const j = await r.json();
  const rates = j.rates;
  const xaf = (c: string) => (rates.XAF && rates[c] ? Math.round((rates.XAF / rates[c]) * 100) / 100 : null);
  return { per: { EUR: xaf('EUR'), USD: rates.XAF ?? null, GBP: xaf('GBP'), CNY: xaf('CNY') }, peg: XAF_EUR_PEG };
}

async function fetchWeather(): Promise<Any> {
  const out = [];
  for (const h of HOTSPOTS) {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${h.lat}&longitude=${h.lon}&current=temperature_2m,precipitation,weather_code`, { next: { revalidate: 1800 } });
    if (!r.ok) throw new Error('weather http ' + r.status);
    const c = (await r.json()).current;
    out.push({ name: h.name, role: h.role, temp: c.temperature_2m, precip: c.precipitation, code: c.weather_code, wet: (c.precipitation ?? 0) >= 3 });
  }
  return out;
}

export async function getCockpit(supabase: Any) {
  let fx: Any = null, fxSource = 'live', fxAt: string | null = new Date().toISOString();
  try {
    fx = await fetchFx();
    await supabase.rpc('cache_market', { p_key: 'fx', p_data: fx, p_source: 'open.er-api.com' });
  } catch {
    const { data } = await supabase.from('market_cache').select('data, fetched_at').eq('key', 'fx').maybeSingle();
    fx = data?.data ?? null; fxSource = 'cached'; fxAt = data?.fetched_at ?? null;
  }

  let weather: Any = null, wSource = 'live', wAt: string | null = new Date().toISOString();
  try {
    weather = await fetchWeather();
    await supabase.rpc('cache_market', { p_key: 'weather', p_data: weather, p_source: 'open-meteo.com' });
  } catch {
    const { data } = await supabase.from('market_cache').select('data, fetched_at').eq('key', 'weather').maybeSingle();
    weather = data?.data ?? null; wSource = 'cached'; wAt = data?.fetched_at ?? null;
  }

  return { fx, fxSource, fxAt, weather, wSource, wAt };
}
