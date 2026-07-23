'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

type Attr = { key: string; label_en: string; label_fr: string; datatype: string; unit: string | null; min_value: number | null; max_value: number | null; pack_version: string };
type Val = { attribute_key: string; numeric_value: number | null };

// Record measured quality values against the commodity's declared attributes, so
// the quality certificate carries real numbers. Each value is checked against the
// declared range. No em-dashes.
export function QualityCapture({ orgId, lotId, attrs, values, locale }: {
  orgId: string; lotId: string; attrs: Attr[]; values: Val[]; locale: Locale;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const current = new Map(values.map((v) => [v.attribute_key, v.numeric_value]));
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function record(a: Attr) {
    const raw = draft[a.key];
    if (raw === undefined || raw === '') return;
    setBusy(a.key);
    await supabase.from('quality_values').insert({
      organization_id: orgId, lot_id: lotId, attribute_key: a.key,
      numeric_value: Number(raw), pack_version: a.pack_version,
    });
    setBusy(null);
    setDraft({ ...draft, [a.key]: '' });
    router.refresh();
  }

  if (attrs.length === 0) return <p className="muted">{t('no_quality', locale)}</p>;

  return (
    <div style={{ marginTop: 6 }}>
      {attrs.map((a) => {
        const val = current.get(a.key);
        const inRange = val != null && (a.min_value == null || val >= a.min_value) && (a.max_value == null || val <= a.max_value);
        return (
          <div className="cap" key={a.key} style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{locale === 'en' ? a.label_en : a.label_fr}{a.unit ? <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> ({a.unit})</span> : null}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--ink-3)' }}>
                {a.min_value != null || a.max_value != null ? `${a.min_value ?? ''}${a.max_value != null ? ' - ' + a.max_value : ''}` : ''}
                {val != null ? (
                  <> · <span style={{ color: inRange ? 'var(--anchor-2)' : 'var(--alert)', fontWeight: 600 }}>{val} {inRange ? t('in_range', locale) : t('out_range', locale)}</span></>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={draft[a.key] ?? ''} onChange={(e) => setDraft({ ...draft, [a.key]: e.target.value })} inputMode="decimal"
                placeholder={t('value_label', locale)} style={{ width: 90 }} />
              <button type="button" className="ghost" style={{ marginTop: 0 }} disabled={busy === a.key || !draft[a.key]} onClick={() => record(a)}>{t('record', locale)}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
