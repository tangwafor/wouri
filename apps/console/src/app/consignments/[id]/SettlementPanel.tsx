'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

type Instrument = { id: string; kind: string; currency: string; amount_minor: number; status: string } | null;
type Clock = { repatriation_due: string | null; days_remaining: number | null; overdue: boolean } | null;

const NEXT: Record<string, { to: string; key: string }> = {
  draft: { to: 'presented', key: 'sett_present' },
  presented: { to: 'accepted', key: 'sett_accept' },
  accepted: { to: 'paid', key: 'sett_pay' },
  paid: { to: 'repatriated', key: 'sett_repatriate' },
};

// The settlement instrument and the BEAC clock for a consignment. No em-dashes.
export function SettlementPanel({ orgId, consignmentId, instrument, clock, locale }: {
  orgId: string; consignmentId: string; instrument: Instrument; clock: Clock; locale: Locale;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [f, setF] = useState({ kind: 'lc', currency: 'EUR', amount: '', export_date: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function open() {
    setBusy(true); setErr(null);
    const { error } = await supabase.from('settlement_instruments').insert({
      organization_id: orgId, consignment_id: consignmentId, kind: f.kind, currency: f.currency,
      amount_minor: f.amount ? Math.round(Number(f.amount) * 100) : 0, export_date: f.export_date || null,
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    setBusy(false); router.refresh();
  }
  async function advance(to: string) {
    setBusy(true); setErr(null);
    const { error } = await supabase.rpc('settlement_advance', { p_instr: instrument!.id, p_to: to });
    if (error) { setErr(error.message); setBusy(false); return; }
    setBusy(false); router.refresh();
  }

  const clockColor = clock?.overdue ? 'var(--alert)' : (clock?.days_remaining != null && clock.days_remaining <= 15 ? 'var(--warn)' : 'var(--anchor-2)');

  return (
    <div className="card">
      <div className="eyebrow">{t('settlement_h', locale)}</div>
      {!instrument ? (
        <>
          <label htmlFor="sk">{t('settlement_kind', locale)}</label>
          <select id="sk" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            <option value="lc">Letter of credit</option>
            <option value="documentary_collection">Documentary collection</option>
            <option value="dp">Documents against payment</option>
            <option value="da">Documents against acceptance</option>
            <option value="open_account">Open account</option>
            <option value="advance">Advance</option>
          </select>
          <label htmlFor="sa">{t('amount', locale)} ({f.currency})</label>
          <input id="sa" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} inputMode="decimal" />
          <label htmlFor="sd">{t('export_date', locale)}</label>
          <input id="sd" type="date" value={f.export_date} onChange={(e) => setF({ ...f, export_date: e.target.value })} />
          <div><button type="button" onClick={open} disabled={busy}>{t('open_settlement', locale)}</button></div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 650 }}>{instrument.kind} · {instrument.currency} {(instrument.amount_minor / 100).toLocaleString()}</div>
              <div style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>{instrument.status}</div>
            </div>
            {clock && clock.repatriation_due ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: clockColor, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {clock.overdue ? t('overdue_word', locale) : `${clock.days_remaining} ${t('days_left', locale)}`}
                </div>
                <div style={{ color: 'var(--ink-3)', fontSize: '.78rem' }}>{String(clock.repatriation_due).slice(0, 10)}</div>
              </div>
            ) : null}
          </div>
          {NEXT[instrument.status] ? (
            <div><button type="button" onClick={() => advance(NEXT[instrument.status].to)} disabled={busy}>{t(NEXT[instrument.status].key as never, locale)}</button></div>
          ) : null}
        </>
      )}
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}
