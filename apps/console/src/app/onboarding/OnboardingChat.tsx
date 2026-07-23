'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { inferCapabilities } from '@/lib/onboarding/infer.mjs';
import { provisionWorkspace } from './actions';
import { t, type Locale } from '@/lib/i18n';

type Cap = { capability_key: string; label_fr: string; label_en: string };

// The chat path (ADR-0028). Aza runs the SAME pure inference the server commits,
// right here as the tenant types, so the detected capabilities update live with
// no round trip. Submitting provisions the org and those capabilities in one
// atomic step. The click path (CapabilityPicker on /home) provisions the same
// graph; this is the conversational door to it.
export function OnboardingChat({ catalog, locale }: { catalog: Cap[]; locale: Locale }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const labelOf = useMemo(() => {
    const m = new Map(catalog.map((c) => [c.capability_key, locale === 'en' ? c.label_en : c.label_fr]));
    return (k: string) => m.get(k) ?? k;
  }, [catalog, locale]);

  const detected = useMemo(() => inferCapabilities(desc).keys, [desc]);

  async function submit() {
    setBusy(true); setErr(null);
    const res = await provisionWorkspace(name, desc);
    if (res.ok) { router.push('/home'); router.refresh(); return; }
    setErr(res.error); setBusy(false);
  }

  const ready = name.trim().length > 1 && !busy;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label htmlFor="ws-name">{t('workspace_name', locale)}</label>
        <input id="ws-name" value={name} onChange={(e) => setName(e.target.value)}
          type="text" autoComplete="organization" placeholder="Bakossi Cocoa Union" />
      </div>
      <div>
        <label htmlFor="ws-desc">{t('onboarding', locale)}</label>
        <textarea id="ws-desc" value={desc} onChange={(e) => setDesc(e.target.value)}
          rows={4} placeholder={t('describe_business', locale)} style={{ resize: 'vertical' }} />
      </div>

      <div aria-live="polite">
        {detected.length ? (
          <>
            <div style={{ fontSize: '.82rem', color: 'var(--ink-3)', marginBottom: 6 }}>{t('aza_detected', locale)}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {detected.map((k) => <span className="pill on" key={k}>{labelOf(k)}</span>)}
            </div>
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '.85rem' }}>{t('aza_nothing', locale)}</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button type="button" onClick={submit} disabled={!ready}>
          {busy ? t('setting_up', locale) : t('setup_workspace', locale)}
        </button>
        <span className="muted" style={{ marginTop: 0 }}>{t('or_click', locale)}</span>
      </div>
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}
