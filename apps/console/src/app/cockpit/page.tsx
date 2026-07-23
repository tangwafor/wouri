// The live cockpit: real-time FX (XAF crosses) and weather at the export
// hotspots. Fetched live, cached for resilience, so it is never blank. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { AppNav } from '../AppNav';
import { getCockpit } from '@/lib/cockpit';

export const dynamic = 'force-dynamic';

const WCODE = (code: number): string => {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  return 'Storm';
};

export default async function CockpitPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  if (!orgs?.length) redirect('/onboarding');

  const { locale, tt } = await getT();
  const { fx, fxSource, fxAt, weather, wSource, wAt } = await getCockpit(supabase);

  const badge = (source: string, at: string | null) => (
    <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.04em', color: source === 'live' ? 'var(--anchor-2)' : 'var(--ink-3)', textTransform: 'uppercase' }}>
      {source === 'live' ? tt('live_badge') : tt('cached_badge')}
      {at ? <span style={{ fontWeight: 400, textTransform: 'none' }}> · {tt('as_of')} {new Date(at).toISOString().slice(11, 16)} UTC</span> : null}
    </span>
  );
  const fxCard = (label: string, value: number | null) => (
    <div className="card" style={{ margin: 0, padding: '14px 16px' }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>XAF / {label}</div>
      <div style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {value != null ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
      </div>
    </div>
  );

  return (
    <main className="wrap-wide">
      <AppNav current="/cockpit" locale={locale} />
      <h1 className="brand" style={{ marginBottom: 16 }}>{tt('cockpit')}</h1>

      {/* FX */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div className="eyebrow">{tt('fx_rates')}</div>
          {badge(fxSource, fxAt)}
        </div>
        {fx?.per ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 8 }}>
              {fxCard('EUR', fx.per.EUR)}
              {fxCard('USD', fx.per.USD)}
              {fxCard('GBP', fx.per.GBP)}
              {fxCard('CNY', fx.per.CNY)}
            </div>
            <p className="muted" style={{ marginTop: 12 }}>{tt('peg_note')}: 1 EUR = {fx.peg} XAF</p>
          </>
        ) : <p className="muted">{tt('cockpit_unavailable')}</p>}
      </div>

      {/* Weather hotspots */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div className="eyebrow">{tt('weather_hotspots')}</div>
          {badge(wSource, wAt)}
        </div>
        {Array.isArray(weather) && weather.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginTop: 8 }}>
            {weather.map((w: { name: string; role: string; temp: number; precip: number; code: number; wet: boolean }) => (
              <div className="card" key={w.name} style={{ margin: 0, padding: '14px 16px', borderLeft: w.wet ? '3px solid var(--warn)' : undefined }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontWeight: 650 }}>{w.name}</div>
                  {w.wet ? <span className="pill" style={{ background: 'color-mix(in srgb, var(--warn) 16%, transparent)', color: 'var(--warn)' }}>{tt('wet_flag')}</span> : null}
                </div>
                <div className="eyebrow" style={{ marginTop: 2 }}>{w.role}</div>
                <div style={{ marginTop: 8, fontFamily: 'var(--serif)', fontSize: '1.4rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(w.temp)}&deg;C</div>
                <div style={{ color: 'var(--ink-3)', fontSize: '.82rem' }}>{WCODE(w.code)} · {tt('rain_label')} {w.precip ?? 0} mm</div>
              </div>
            ))}
          </div>
        ) : <p className="muted">{tt('cockpit_unavailable')}</p>}
      </div>
    </main>
  );
}
