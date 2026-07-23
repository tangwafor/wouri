'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

type Item = {
  id: string; kind: string; severity: string; title: string; body: string | null;
  entity_type: string | null; entity_id: string | null; created_at: string; read_at: string | null;
};

// Severity drives the colour so what needs attention reads at a glance; the
// accent is separate from these semantic hues. Marking read updates the row (RLS
// lets a member mark their org's notifications). No em-dashes.
const HUE: Record<string, string> = {
  critical: 'var(--alert)', high: 'var(--alert)', warning: 'var(--warn, #b7791f)', info: 'var(--anchor-2)',
};

export function InboxList({ items, locale }: { items: Item[]; locale: Locale }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [busy, setBusy] = useState(false);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
    setBusy(false);
    router.refresh();
  }

  const shown = onlyUnread ? items.filter((i) => !i.read_at) : items;
  const unreadIds = items.filter((i) => !i.read_at).map((i) => i.id);
  const href = (i: Item) => (i.entity_type === 'consignment' && i.entity_id ? `/consignments/${i.entity_id}` : undefined);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '10px 0 14px', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '.88rem', color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> {t('unread_only', locale)}
        </label>
        {unreadIds.length > 0 ? (
          <button type="button" className="ghost" style={{ marginTop: 0 }} disabled={busy} onClick={() => markRead(unreadIds)}>{t('mark_all_read', locale)}</button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="muted">{t('inbox_empty', locale)}</p>
      ) : shown.map((i) => {
        const link = href(i);
        const body = (
          <div className="card" style={{ borderLeft: `3px solid ${HUE[i.severity] ?? 'var(--anchor-2)'}`, opacity: i.read_at ? 0.62 : 1, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 650 }}>{i.title}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: '.8rem' }}>{new Date(i.created_at).toISOString().slice(0, 16).replace('T', ' ')}</span>
            </div>
            {i.body ? <div style={{ color: 'var(--ink-2)', fontSize: '.9rem', marginTop: 3 }}>{i.body}</div> : null}
            {!i.read_at ? (
              <button type="button" className="ghost" style={{ marginTop: 8, fontSize: '.82rem' }} disabled={busy}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead([i.id]); }}>{t('mark_read', locale)}</button>
            ) : null}
          </div>
        );
        return link
          ? <a key={i.id} href={link} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{body}</a>
          : <div key={i.id}>{body}</div>;
      })}
    </div>
  );
}
