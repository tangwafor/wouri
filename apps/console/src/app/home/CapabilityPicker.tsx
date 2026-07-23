'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale, type Key } from '@/lib/i18n';

// Category order + header key, so the list reads as grouped sections (commodities
// first) instead of a flat mix a reader cannot scan.
const CATEGORY_ORDER: { key: string; label: Key }[] = [
  { key: 'commodity', label: 'cat_commodity' },
  { key: 'rail', label: 'cat_rail' },
  { key: 'field', label: 'cat_field' },
  { key: 'money', label: 'cat_money' },
  { key: 'structure', label: 'cat_structure' },
];

type Cap = {
  capability_key: string;
  label_fr: string;
  label_en: string;
  category: string;
  requires_capability_key: string | null;
  description_fr: string | null;
  description_en: string | null;
};

// The pick-and-choose capability picker (ADR-0028). Toggling writes
// organization_capabilities under the user session; RLS gates it. A prerequisite
// is auto-enabled so the chat and click paths enforce the same dependency graph.
export function CapabilityPicker({
  orgId, catalog, initiallyEnabled, locale,
}: { orgId: string; catalog: Cap[]; initiallyEnabled: string[]; locale: Locale }) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initiallyEnabled));
  const [busy, setBusy] = useState<string | null>(null);
  const supabase = supabaseBrowser();

  async function toggle(cap: Cap) {
    setBusy(cap.capability_key);
    const next = new Set(enabled);
    if (enabled.has(cap.capability_key)) {
      await supabase.from('organization_capabilities').delete()
        .eq('organization_id', orgId).eq('capability_key', cap.capability_key);
      next.delete(cap.capability_key);
    } else {
      const rows: { organization_id: string; capability_key: string }[] = [];
      if (cap.requires_capability_key && !next.has(cap.requires_capability_key)) {
        rows.push({ organization_id: orgId, capability_key: cap.requires_capability_key });
        next.add(cap.requires_capability_key);
      }
      rows.push({ organization_id: orgId, capability_key: cap.capability_key });
      next.add(cap.capability_key);
      await supabase.from('organization_capabilities').upsert(rows, { onConflict: 'organization_id,capability_key' });
    }
    setEnabled(next);
    setBusy(null);
  }

  const row = (cap: Cap) => {
    const on = enabled.has(cap.capability_key);
    const desc = (locale === 'en' ? cap.description_en : cap.description_fr) ?? '';
    return (
      <div className="cap" key={cap.capability_key}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {locale === 'en' ? cap.label_en : cap.label_fr}
          {desc ? (
            <span
              title={desc} aria-label={desc} role="img" tabIndex={0}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 15, height: 15, borderRadius: '50%', border: '1px solid var(--rule)',
                color: 'var(--ink-3)', fontSize: '.62rem', fontWeight: 700, cursor: 'help',
              }}
            >i</span>
          ) : null}
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {on ? <span className="pill on">{t('enabled', locale)}</span> : null}
          <button className="ghost" disabled={busy === cap.capability_key} onClick={() => toggle(cap)}>
            {on ? t('disable', locale) : t('enable', locale)}
          </button>
        </span>
      </div>
    );
  };

  return (
    <div style={{ marginTop: 10 }}>
      {CATEGORY_ORDER.map(({ key, label }) => {
        const items = catalog.filter((c) => c.category === key);
        if (!items.length) return null;
        return (
          <section key={key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 2 }}>
              {t(label, locale)}
            </div>
            {items.map(row)}
          </section>
        );
      })}
    </div>
  );
}
