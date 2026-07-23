'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale, type Key } from '@/lib/i18n';

type Shipment = {
  id: string; carrier: string | null; vessel: string | null; port_loading: string | null;
  port_discharge: string | null; etd: string | null; eta: string | null; status: string;
} | null;

const STAGES = ['booked', 'loaded', 'sailed', 'arrived', 'cleared'];
const NEXT: Record<string, { to: string; key: Key }> = {
  booked: { to: 'loaded', key: 'ship_load' }, loaded: { to: 'sailed', key: 'ship_sail' },
  sailed: { to: 'arrived', key: 'ship_arrive' }, arrived: { to: 'cleared', key: 'ship_clear' },
};

// Shipment logistics for a consignment: booking, ports, ETD/ETA, and the
// milestone timeline. No em-dashes.
export function ShipmentPanel({ orgId, consignmentId, shipment, locale }: {
  orgId: string; consignmentId: string; shipment: Shipment; locale: Locale;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [f, setF] = useState({ carrier: '', vessel: '', booking_ref: '', port_loading: '', port_discharge: '', etd: '', eta: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  async function open() {
    setBusy(true); setErr(null);
    const { error } = await supabase.from('shipments').insert({
      organization_id: orgId, consignment_id: consignmentId,
      carrier: f.carrier || null, vessel: f.vessel || null, booking_ref: f.booking_ref || null,
      port_loading: f.port_loading || null, port_discharge: f.port_discharge || null,
      etd: f.etd || null, eta: f.eta || null,
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    setBusy(false); router.refresh();
  }
  async function advance(to: string) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('shipment_advance', { p_shipment: shipment!.id, p_to: to });
    if (error) { setErr(error.message); setBusy(false); return; }
    setBusy(false); router.refresh();
  }

  const idx = shipment ? STAGES.indexOf(shipment.status) : -1;

  return (
    <div className="card">
      <div className="eyebrow">{t('shipment_h', locale)}</div>
      {!shipment ? (
        <>
          <label htmlFor="ca">{t('carrier', locale)}</label>
          <input id="ca" value={f.carrier} onChange={(e) => set('carrier', e.target.value)} />
          <label htmlFor="ve">{t('vessel', locale)}</label>
          <input id="ve" value={f.vessel} onChange={(e) => set('vessel', e.target.value)} />
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 130 }}><label htmlFor="pl">{t('port_loading', locale)}</label><input id="pl" value={f.port_loading} onChange={(e) => set('port_loading', e.target.value)} placeholder="Douala" /></div>
            <div style={{ flex: 1, minWidth: 130 }}><label htmlFor="pd">{t('port_discharge', locale)}</label><input id="pd" value={f.port_discharge} onChange={(e) => set('port_discharge', e.target.value)} placeholder="Antwerp" /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 130 }}><label htmlFor="etd">{t('etd', locale)}</label><input id="etd" type="date" value={f.etd} onChange={(e) => set('etd', e.target.value)} /></div>
            <div style={{ flex: 1, minWidth: 130 }}><label htmlFor="eta">{t('eta', locale)}</label><input id="eta" type="date" value={f.eta} onChange={(e) => set('eta', e.target.value)} /></div>
          </div>
          <div><button type="button" onClick={open} disabled={busy}>{t('open_shipment', locale)}</button></div>
        </>
      ) : (
        <>
          <div style={{ margin: '4px 0 10px', color: 'var(--ink-2)', fontSize: '.9rem' }}>
            {[shipment.carrier, shipment.vessel].filter(Boolean).join(' · ') || '-'}
            {shipment.port_loading || shipment.port_discharge ? <> · {shipment.port_loading ?? '?'} &rarr; {shipment.port_discharge ?? '?'}</> : null}
            {shipment.etd ? <> · ETD {shipment.etd}</> : null}{shipment.eta ? <> · ETA {shipment.eta}</> : null}
          </div>
          {/* Milestone timeline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' }}>
            {STAGES.map((st, i) => (
              <span key={st} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{
                  fontSize: '.74rem', fontWeight: 600, padding: '3px 9px', borderRadius: 100,
                  background: i <= idx ? 'var(--anchor)' : 'var(--surface-2)', color: i <= idx ? 'var(--on-anchor)' : 'var(--ink-3)',
                }}>{st}</span>
                {i < STAGES.length - 1 ? <span style={{ width: 14, height: 2, background: i < idx ? 'var(--anchor)' : 'var(--rule)' }} /> : null}
              </span>
            ))}
          </div>
          {NEXT[shipment.status] ? (
            <div><button type="button" onClick={() => advance(NEXT[shipment.status].to)} disabled={busy}>{t(NEXT[shipment.status].key, locale)}</button></div>
          ) : null}
        </>
      )}
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}
