'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

// The owner sets the brand that appears on their certificates (colour + tagline).
// Saved through the admin-gated update_org_brand RPC. No em-dashes.
export function BrandSettings({ orgId, initial, locale }: {
  orgId: string; initial: { color?: string; tagline?: string }; locale: Locale;
}) {
  const supabase = supabaseBrowser();
  const [color, setColor] = useState(initial.color ?? '#0d4f47');
  const [tagline, setTagline] = useState(initial.tagline ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function save() {
    setState('saving'); setMsg('');
    const { error } = await supabase.rpc('update_org_brand', { p_org: orgId, p_color: color, p_tagline: tagline });
    if (error) { setState('error'); setMsg(error.message); return; }
    setState('saved'); setTimeout(() => setState('idle'), 1500);
  }

  return (
    <div>
      <p style={{ margin: '2px 0 6px', color: 'var(--ink-3)', fontSize: '.85rem' }}>{t('brand_hint', locale)}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label htmlFor="bc" style={{ marginTop: 0 }}>{t('brand_color', locale)}</label>
          <input id="bc" type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 56, height: 40, padding: 3 }} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="bt" style={{ marginTop: 0 }}>{t('brand_tagline', locale)}</label>
          <input id="bt" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Fine Cameroon cocoa" />
        </div>
        <button type="button" onClick={save} disabled={state === 'saving'} style={{ marginTop: 0 }}>
          {state === 'saving' ? t('setting_up', locale) : t('reset_save', locale)}
        </button>
        {state === 'saved' ? <span className="pill on">{t('saved_word', locale)}</span> : null}
      </div>
      {state === 'error' ? <p className="err">{msg}</p> : null}
    </div>
  );
}
