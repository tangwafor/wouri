'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Entry = {
  key: string; kind: string; label_en: string | null; label_fr: string | null;
  body_en: string | null; body_fr: string | null; source: string | null;
  review_by: string | null; updated_at: string | null;
};

const KIND_ORDER = ['commodity', 'rail', 'regulation', 'capability'];
const KIND_LABEL: Record<string, string> = {
  commodity: 'Commodities', rail: 'Compliance rails', regulation: 'Regulations', capability: 'Capabilities',
};

function Row({ entry, isAdmin }: { entry: Entry; isAdmin: boolean }) {
  const supabase = supabaseBrowser();
  const [e, setE] = useState<Entry>(entry);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function save() {
    setState('saving'); setMsg('');
    const { error } = await supabase.from('aza_kb')
      .update({ body_en: e.body_en, body_fr: e.body_fr, source: e.source, review_by: e.review_by || null })
      .eq('key', e.key);
    if (error) { setState('error'); setMsg(error.message); return; }
    setState('saved'); setTimeout(() => setState('idle'), 1500);
  }

  const field = (label: string, value: string | null, set: (v: string) => void, area = false) => (
    <div style={{ marginTop: 8 }}>
      <label style={{ fontSize: '.72rem', color: 'var(--ink-3)' }}>{label}</label>
      {area
        ? <textarea value={value ?? ''} onChange={(ev) => set(ev.target.value)} rows={2} disabled={!isAdmin} style={{ resize: 'vertical' }} />
        : <input value={value ?? ''} onChange={(ev) => set(ev.target.value)} disabled={!isAdmin} />}
    </div>
  );

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontWeight: 650 }}>{e.label_en ?? e.key}</div>
        <code style={{ fontSize: '.72rem', color: 'var(--ink-3)' }}>{e.key}</code>
      </div>
      {field('Explanation (EN)', e.body_en, (v) => setE({ ...e, body_en: v }), true)}
      {field('Explanation (FR)', e.body_fr, (v) => setE({ ...e, body_fr: v }), true)}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 60%' }}>{field('Source', e.source, (v) => setE({ ...e, source: v }))}</div>
        <div style={{ flex: '1 1 30%' }}>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: '.72rem', color: 'var(--ink-3)' }}>Review by</label>
            <input type="date" value={e.review_by ?? ''} onChange={(ev) => setE({ ...e, review_by: ev.target.value })} disabled={!isAdmin} />
          </div>
        </div>
      </div>
      {isAdmin ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 6 }}>
          <button type="button" onClick={save} disabled={state === 'saving'}>
            {state === 'saving' ? 'Saving' : 'Save'}
          </button>
          {state === 'saved' ? <span className="pill on">Saved</span> : null}
          {state === 'error' ? <span className="err" style={{ margin: 0 }}>{msg}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function KbAdmin({ entries, isAdmin }: { entries: Entry[]; isAdmin: boolean }) {
  return (
    <div>
      {KIND_ORDER.map((kind) => {
        const items = entries.filter((e) => e.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} style={{ marginTop: 18 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              {KIND_LABEL[kind] ?? kind}
            </div>
            {items.map((e) => <Row key={e.key} entry={e} isAdmin={isAdmin} />)}
          </section>
        );
      })}
    </div>
  );
}
