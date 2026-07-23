'use client';
import { useState } from 'react';
import type { Locale } from '@/lib/i18n';

// FR / EN toggle. Sets the `locale` cookie and reloads so server components
// re-render in the chosen language. Fixed top-right on every page. No em-dashes.
export function LocaleSwitcher({ current }: { current: Locale }) {
  const [busy, setBusy] = useState(false);
  function set(loc: Locale) {
    if (loc === current) return;
    setBusy(true);
    document.cookie = `locale=${loc}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }
  const cell = (loc: Locale, label: string) => (
    <button
      type="button" onClick={() => set(loc)} disabled={busy}
      aria-pressed={current === loc}
      style={{
        margin: 0, padding: '3px 9px', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.03em',
        border: 0, borderRadius: 6, cursor: current === loc ? 'default' : 'pointer',
        background: current === loc ? 'var(--anchor)' : 'transparent',
        color: current === loc ? 'var(--on-anchor)' : 'var(--ink-3)',
      }}
    >{label}</button>
  );
  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 50, display: 'flex', gap: 2,
      background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 8, padding: 2,
    }}>
      {cell('fr', 'FR')}
      {cell('en', 'EN')}
    </div>
  );
}
