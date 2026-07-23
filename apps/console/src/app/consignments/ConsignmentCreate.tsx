'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { t, type Locale } from '@/lib/i18n';

// Create a consignment (and its buyer party). Client inserts under the user
// session; RLS scopes to the org. No em-dashes.
export function ConsignmentCreate({ orgId, locale }: { orgId: string; locale: Locale }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [f, setF] = useState({ code: '', buyer: '', destination: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });

  async function submit() {
    setBusy(true); setErr(null);
    let buyerId: string | null = null;
    if (f.buyer.trim()) {
      const { data: existing } = await supabase.from('parties').select('id').eq('organization_id', orgId).eq('kind', 'buyer').eq('name', f.buyer.trim()).maybeSingle();
      if (existing) buyerId = existing.id;
      else {
        const { data: np, error: pe } = await supabase.from('parties').insert({ organization_id: orgId, kind: 'buyer', name: f.buyer.trim() }).select('id').single();
        if (pe) { setErr(pe.message); setBusy(false); return; }
        buyerId = np.id;
      }
    }
    const { error } = await supabase.from('consignments').insert({
      organization_id: orgId, code: f.code, buyer_party_id: buyerId, destination_country: f.destination || null,
    });
    if (error) { setErr(error.message); setBusy(false); return; }
    setF({ code: '', buyer: '', destination: '' });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="eyebrow">{t('new_consignment', locale)}</div>
      <label htmlFor="cc">{t('lot_code', locale)}</label>
      <input id="cc" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="CN-2026-001" />
      <label htmlFor="cb">{t('buyer_name', locale)}</label>
      <input id="cb" value={f.buyer} onChange={(e) => set('buyer', e.target.value)} />
      <label htmlFor="cd">{t('destination', locale)}</label>
      <input id="cd" value={f.destination} onChange={(e) => set('destination', e.target.value)} placeholder="DE" />
      <div><button type="button" onClick={submit} disabled={busy || !f.code}>{busy ? t('setting_up', locale) : t('create_consignment', locale)}</button></div>
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}
