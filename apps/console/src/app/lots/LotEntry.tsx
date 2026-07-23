'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

type Commodity = { key: string; label_fr: string; label_en: string; eudr: boolean };
type Mode = 'at_harvest' | 'after_harvest';

// The entry-point toggle (ADR-0002: a choice, not a code branch). At harvest, the
// tenant captures the plot; after harvest, they record the supplier. A missing
// plot geolocation for an EUDR commodity is never blocked here; it surfaces on the
// readiness board.
export function LotEntry({ orgId, commodities, locale }: { orgId: string; commodities: Commodity[]; locale: Locale }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('at_harvest');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    commodity_key: commodities[0]?.key ?? 'cocoa', code: '', quantity: '', is_cites: false,
    plot_code: '', area: '', geometry: '', supplier: '', origin_ref: '',
  });
  const set = (k: string, v: string | boolean) => setF({ ...f, [k]: v });

  async function submit() {
    setBusy(true); setErr(null);
    const id = crypto.randomUUID();
    const ev = crypto.randomUUID();
    const qty = f.quantity ? Number(f.quantity) : 0;
    let res;
    if (mode === 'at_harvest') {
      let geo: unknown = null;
      if (f.geometry.trim()) { try { geo = JSON.parse(f.geometry); } catch { setErr('Plot boundary is not valid GeoJSON'); setBusy(false); return; } }
      res = await supabase.rpc('create_lot_at_origin', {
        p_org: orgId, p_lot_id: id, p_commodity_key: f.commodity_key, p_lot_code: f.code, p_quantity_kg: qty,
        p_claim: f.is_cites ? 'identity_preserved' : 'segregated', p_is_cites: f.is_cites,
        p_plot_code: f.plot_code || f.code + '-plot', p_plot_kind: 'plot', p_area_ha: f.area ? Number(f.area) : null,
        p_geometry: geo, p_event_id: ev,
      });
    } else {
      res = await supabase.rpc('create_lot_post_harvest', {
        p_org: orgId, p_lot_id: id, p_commodity_key: f.commodity_key, p_lot_code: f.code, p_quantity_kg: qty,
        p_claim: f.is_cites ? 'identity_preserved' : 'segregated', p_is_cites: f.is_cites,
        p_supplier_name: f.supplier, p_supplier_origin_ref: f.origin_ref || null, p_event_id: ev,
      });
    }
    if (res.error) { setErr(res.error.message); setBusy(false); return; }
    setF({ ...f, code: '', quantity: '', plot_code: '', area: '', geometry: '', supplier: '', origin_ref: '' });
    setBusy(false);
    router.refresh();
  }

  const tab = (m: Mode, label: string) => (
    <button type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
      style={{
        margin: 0, padding: '8px 14px', border: '1px solid var(--rule)', borderRadius: 8, cursor: 'pointer',
        background: mode === m ? 'var(--anchor)' : 'transparent', color: mode === m ? 'var(--on-anchor)' : 'var(--ink-2)', fontWeight: 600,
      }}>{label}</button>
  );

  return (
    <div className="card">
      <p style={{ margin: '0 0 10px', color: 'var(--ink-3)', fontSize: '.88rem' }}>{t('entry_help', locale)}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {tab('at_harvest', t('at_harvest', locale))}
        {tab('after_harvest', t('after_harvest', locale))}
      </div>

      <label htmlFor="lc">{t('commodity_f', locale)}</label>
      <select id="lc" value={f.commodity_key} onChange={(e) => set('commodity_key', e.target.value)}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--rule)', borderRadius: 8, background: 'var(--surface)', color: 'var(--ink)', fontSize: '1rem' }}>
        {commodities.map((c) => <option key={c.key} value={c.key}>{locale === 'en' ? c.label_en : c.label_fr}{c.eudr ? ' (EUDR)' : ''}</option>)}
      </select>

      <label htmlFor="code">{t('lot_code', locale)}</label>
      <input id="code" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="LOT-2026-001" />
      <label htmlFor="qty">{t('quantity_kg', locale)}</label>
      <input id="qty" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} inputMode="decimal" />

      {mode === 'at_harvest' ? (
        <>
          <label htmlFor="plot">{t('plot_code', locale)}</label>
          <input id="plot" value={f.plot_code} onChange={(e) => set('plot_code', e.target.value)} />
          <label htmlFor="area">{t('area_ha', locale)}</label>
          <input id="area" value={f.area} onChange={(e) => set('area', e.target.value)} inputMode="decimal" />
          <label htmlFor="geo">{t('plot_boundary', locale)}</label>
          <textarea id="geo" value={f.geometry} onChange={(e) => set('geometry', e.target.value)} rows={2}
            placeholder='{"type":"Polygon","coordinates":[[[9.7,4.1],...]]}' style={{ resize: 'vertical', fontFamily: 'var(--mono, monospace)', fontSize: '.85rem' }} />
        </>
      ) : (
        <>
          <label htmlFor="sup">{t('supplier_name', locale)}</label>
          <input id="sup" value={f.supplier} onChange={(e) => set('supplier', e.target.value)} />
          <label htmlFor="oref">{t('origin_ref', locale)}</label>
          <input id="oref" value={f.origin_ref} onChange={(e) => set('origin_ref', e.target.value)} />
        </>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <input type="checkbox" checked={f.is_cites} onChange={(e) => set('is_cites', e.target.checked)} style={{ width: 'auto' }} />
        {t('cites_listed_f', locale)}
      </label>

      <div>
        <button type="button" onClick={submit} disabled={busy || !f.code || (mode === 'after_harvest' && !f.supplier)}>
          {busy ? t('setting_up', locale) : t('create_lot', locale)}
        </button>
      </div>
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}
