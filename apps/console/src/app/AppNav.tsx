import { t, type Locale, type Key } from '@/lib/i18n';
import { NotificationBell } from './NotificationBell';

// The app shell nav, shared across the authed operator surfaces so the console
// reads as one product. The current page is marked. No em-dashes.
const ITEMS: { href: string; key: Key }[] = [
  { href: '/home', key: 'home' },
  { href: '/lots', key: 'lots' },
  { href: '/consignments', key: 'consignments' },
  { href: '/cockpit', key: 'cockpit' },
  { href: '/board', key: 'board' },
];

export function AppNav({ current, locale }: { current: string; locale: Locale }) {
  return (
    <nav style={{
      display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center',
      borderBottom: '1px solid var(--rule)', paddingBottom: 10, marginBottom: 18,
    }}>
      <span style={{ fontFamily: 'var(--serif)', color: 'var(--anchor)', fontSize: '1.15rem', fontWeight: 700, marginRight: 12 }}>Wouri</span>
      {ITEMS.map((it) => {
        const active = current === it.href;
        return (
          <a key={it.href} href={it.href} style={{
            padding: '5px 11px', borderRadius: 7, textDecoration: 'none', fontSize: '.9rem', fontWeight: active ? 650 : 500,
            color: active ? 'var(--on-anchor)' : 'var(--ink-2)', background: active ? 'var(--anchor)' : 'transparent',
          }}>{t(it.key, locale)}</a>
        );
      })}
      <NotificationBell locale={locale} />
    </nav>
  );
}
