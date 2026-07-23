'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale, type Key } from '@/lib/i18n';

// Record a post-harvest processing step (fermentation, drying, sorting, bagging,
// and so on) as a custody event. This seals the step into the tamper-evident
// chain, so the file shows the full journey from the plot, not just harvest and
// export. The event id is client-minted so a retry is exactly-once. No em-dashes.
const KINDS = ['fermented', 'dried', 'sorted', 'graded', 'bagged', 'stored', 'weighed', 'moved', 'aggregated'] as const;
type Kind = (typeof KINDS)[number];
const LABEL: Record<Kind, Key> = {
  fermented: 'ev_fermented', dried: 'ev_dried', sorted: 'ev_sorted', graded: 'ev_graded',
  bagged: 'ev_bagged', stored: 'ev_stored', weighed: 'ev_weighed', moved: 'ev_moved', aggregated: 'ev_aggregated',
};

export function AddCustodyEvent({ lotId, locale }: { lotId: string; locale: Locale }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [kind, setKind] = useState<Kind>('fermented');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function record() {
    setBusy(true);
    const payload = note.trim() ? { step: kind, note: note.trim() } : { step: kind };
    await supabase.rpc('record_lot_event', {
      p_id: crypto.randomUUID(), p_lot: lotId, p_type: kind, p_payload: payload,
    });
    setBusy(false);
    setNote('');
    router.refresh();
  }

  return (
    <div className="cap" style={{ alignItems: 'flex-end', borderTop: '1px dashed var(--line)', paddingTop: 12, marginTop: 8 }}>
      <div style={{ flex: 1 }}>
        <label className="cap" style={{ fontSize: '.8rem', color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>{t('add_event', locale)}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} style={{ width: 150 }}>
            {KINDS.map((k) => <option key={k} value={k}>{t(LABEL[k], locale)}</option>)}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('event_note', locale)} style={{ flex: 1, minWidth: 140 }} />
        </div>
      </div>
      <button type="button" className="ghost" style={{ marginTop: 0 }} disabled={busy} onClick={record}>{t('record_event', locale)}</button>
    </div>
  );
}
