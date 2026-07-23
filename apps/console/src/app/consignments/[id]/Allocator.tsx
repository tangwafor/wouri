'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

type Lot = { id: string; code: string };

// Allocate a tenant lot to this consignment. No em-dashes.
export function Allocator({ orgId, consignmentId, allocated, available, locale }: {
  orgId: string; consignmentId: string; allocated: Lot[]; available: Lot[]; locale: Locale;
}) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [sel, setSel] = useState(available[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  async function allocate() {
    if (!sel) return;
    setBusy(true);
    await supabase.from('consignment_lots').insert({ consignment_id: consignmentId, lot_id: sel, organization_id: orgId });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="eyebrow">{t('allocate_lots', locale)}</div>
      {allocated.length === 0 ? <p className="muted" style={{ marginTop: 6 }}>{t('no_lots', locale)}</p> : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {allocated.map((l) => <span key={l.id} className="pill on">{l.code}</span>)}
        </div>
      )}
      {available.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 12 }}>
          <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ flex: 1 }}>
            {available.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
          </select>
          <button type="button" onClick={allocate} disabled={busy || !sel} style={{ marginTop: 0 }}>{t('allocate', locale)}</button>
        </div>
      ) : null}
    </div>
  );
}
