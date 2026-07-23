'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

// A live unread count on the nav. It reads the count once (RLS scopes it to the
// member's org) and then listens on Realtime for new notifications, so the badge
// updates the moment a document is issued, a discrepancy is raised, or a shipment
// moves. Free, in-app, no external service. No em-dashes.
export function NotificationBell({ locale }: { locale: Locale }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let alive = true;
    async function refresh() {
      const { count: c } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      if (alive) setCount(c ?? 0);
    }
    refresh();
    const channel = supabase
      .channel('notifications-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => refresh())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  return (
    <a href="/inbox" title={t('inbox', locale)} style={{
      marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 11px', borderRadius: 7, textDecoration: 'none', fontSize: '.9rem',
      color: 'var(--ink-2)', position: 'relative',
    }}>
      <span aria-hidden style={{ fontSize: '1.05rem', lineHeight: 1 }}>&#128276;</span>
      <span>{t('inbox', locale)}</span>
      {count > 0 ? (
        <span style={{
          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: 'var(--alert)',
          color: '#fff', fontSize: '.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{count > 99 ? '99+' : count}</span>
      ) : null}
    </a>
  );
}
