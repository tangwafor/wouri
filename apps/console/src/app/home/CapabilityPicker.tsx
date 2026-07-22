'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t } from '@/lib/i18n';

type Cap = {
  capability_key: string;
  label_fr: string;
  label_en: string;
  category: string;
  requires_capability_key: string | null;
};

// The pick-and-choose capability picker (ADR-0028). Toggling writes
// organization_capabilities under the user session; RLS gates it. A prerequisite
// is auto-enabled so the chat and click paths enforce the same dependency graph.
export function CapabilityPicker({
  orgId, catalog, initiallyEnabled,
}: { orgId: string; catalog: Cap[]; initiallyEnabled: string[] }) {
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

  return (
    <div style={{ marginTop: 10 }}>
      {catalog.map((cap) => {
        const on = enabled.has(cap.capability_key);
        return (
          <div className="cap" key={cap.capability_key}>
            <span>{cap.label_fr}</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {on ? <span className="pill on">{t('enabled')}</span> : null}
              <button className="ghost" disabled={busy === cap.capability_key} onClick={() => toggle(cap)}>
                {on ? t('disable') : t('enable')}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
