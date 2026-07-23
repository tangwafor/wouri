'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

// EU member country codes (destination is where EUDR and EUR.1 apply).
const EU = new Set(['DE', 'FR', 'NL', 'BE', 'IT', 'ES', 'PT', 'PL', 'SE', 'DK', 'FI', 'IE', 'AT', 'GR', 'CZ', 'RO', 'HU', 'BG', 'SK', 'HR', 'SI', 'LT', 'LV', 'EE', 'LU', 'CY', 'MT']);

type Refs = { dds_reference: string | null; besc_reference: string | null; insurance_ref: string | null };

// The export checklist and the references the operator must record: the EUDR DDS
// number and the BESC/ECTN cargo tracking note. Destination-aware, so an
// EU-bound EUDR shipment shows exactly what it needs. No em-dashes.
export function CompliancePanel({ orgId, consignmentId, destination, refs, docKeys, eudr, locale }: {
  orgId: string; consignmentId: string; destination: string | null; refs: Refs; docKeys: string[]; eudr: boolean; locale: Locale;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [f, setF] = useState({ dds: refs.dds_reference ?? '', besc: refs.besc_reference ?? '', ins: refs.insurance_ref ?? '' });
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isEU = EU.has((destination ?? '').toUpperCase());
  const docs = new Set(docKeys);

  async function save() {
    setState('saving');
    await supabase.from('consignments').update({
      dds_reference: f.dds || null, besc_reference: f.besc || null, insurance_ref: f.ins || null,
    }).eq('id', consignmentId);
    setState('saved'); setTimeout(() => setState('idle'), 1400);
    router.refresh();
  }

  const items: { label: string; ok: boolean; optional?: boolean }[] = [
    { label: t('besc_ref', locale), ok: !!f.besc },
    { label: 'Verified gross mass (VGM)', ok: docs.has('vgm') },
    { label: 'Phytosanitary certificate', ok: docs.has('phyto') },
    { label: t('insurance_ref_label', locale), ok: !!f.ins, optional: true },
  ];
  if (isEU) {
    items.push({ label: 'EUR.1 certificate of origin', ok: docs.has('eur1_cmr') });
    if (eudr) items.push({ label: t('dds_ref', locale), ok: !!f.dds });
  }

  return (
    <div className="card">
      <div className="eyebrow">{t('compliance_h', locale)}</div>

      <div style={{ margin: '6px 0 12px' }}>
        <div className="eyebrow" style={{ color: 'var(--ink-3)' }}>{t('export_checklist', locale)}{destination ? ' · ' + destination : ''}{isEU ? ' (EU)' : ''}</div>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: it.ok ? 'var(--anchor)' : (it.optional ? 'var(--surface-2)' : 'color-mix(in srgb, var(--alert) 15%, transparent)'),
              color: it.ok ? 'var(--on-anchor)' : 'var(--alert)', fontSize: '.7rem', fontWeight: 800, border: it.optional && !it.ok ? '1px solid var(--rule)' : '0' }}>
              {it.ok ? '✓' : (it.optional ? '' : '!')}
            </span>
            <span style={{ flex: 1, fontSize: '.92rem', color: it.ok ? 'var(--ink)' : 'var(--ink-2)' }}>{it.label}</span>
            <span style={{ fontSize: '.76rem', color: it.ok ? 'var(--anchor-2)' : (it.optional ? 'var(--ink-3)' : 'var(--alert)') }}>
              {it.ok ? t('present_word', locale) : (it.optional ? t('recommended', locale) : t('missing_word', locale))}
            </span>
          </div>
        ))}
      </div>

      <label htmlFor="besc">{t('besc_ref', locale)}</label>
      <input id="besc" value={f.besc} onChange={(e) => setF({ ...f, besc: e.target.value })} placeholder="ECTN-CM-..." />
      {isEU && eudr ? (<><label htmlFor="dds">{t('dds_ref', locale)}</label>
        <input id="dds" value={f.dds} onChange={(e) => setF({ ...f, dds: e.target.value })} placeholder="TRACES DDS ..." /></>) : null}
      <label htmlFor="ins">{t('insurance_ref_label', locale)}</label>
      <input id="ins" value={f.ins} onChange={(e) => setF({ ...f, ins: e.target.value })} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={save} disabled={state === 'saving'}>{state === 'saving' ? t('setting_up', locale) : t('reset_save', locale)}</button>
        {state === 'saved' ? <span className="pill on">{t('saved_word', locale)}</span> : null}
      </div>
    </div>
  );
}
