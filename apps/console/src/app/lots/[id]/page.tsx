// Lot detail: the custody timeline, the tamper-evident chain status, and quality
// capture. Recording quality values here makes the quality certificate issuable.
// No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { AppNav } from '../../AppNav';
import { QualityCapture } from './QualityCapture';
import { AddCustodyEvent } from './AddCustodyEvent';

export const dynamic = 'force-dynamic';

export default async function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  const org = orgs?.[0];
  if (!org) redirect('/onboarding');

  const { locale, tt } = await getT();
  const { data: lot } = await supabase
    .from('lots').select('id, code, commodity_id, quantity_kg, origin_mode, status, is_cites_listed, claim, commodities(key, label_en, label_fr, eudr)').eq('id', id).maybeSingle();
  if (!lot) redirect('/lots');

  const [{ data: attrs }, { data: values }, { data: events }, { data: chain }] = await Promise.all([
    supabase.from('quality_attributes').select('key, label_en, label_fr, datatype, unit, min_value, max_value, pack_version').eq('commodity_id', lot.commodity_id).order('key'),
    supabase.from('quality_values').select('attribute_key, numeric_value, recorded_at').eq('lot_id', id).order('recorded_at', { ascending: false }),
    supabase.from('lot_events').select('event_type, occurred_at, seq, payload').eq('lot_id', id).order('seq'),
    supabase.rpc('verify_lot_chain', { p_lot: id }),
  ]);
  // Latest value per attribute.
  const latest = new Map<string, number | null>();
  for (const v of (values ?? [])) if (!latest.has(v.attribute_key)) latest.set(v.attribute_key, v.numeric_value);
  const latestVals = Array.from(latest.entries()).map(([attribute_key, numeric_value]) => ({ attribute_key, numeric_value }));
  const chainOk = Array.isArray(chain) ? chain[0]?.ok : (chain as { ok: boolean } | null)?.ok;
  const commodity = lot.commodities as unknown as { label_en: string; label_fr: string } | null;

  return (
    <main className="wrap-wide">
      <AppNav current="/lots" locale={locale} />
      <a className="muted" href="/lots" style={{ marginTop: 0 }}>{tt('back')}</a>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        <h1 className="brand" style={{ marginBottom: 2 }}>{lot.code}</h1>
        <span className="pill" style={{ background: chainOk ? 'color-mix(in srgb, var(--anchor) 16%, transparent)' : 'color-mix(in srgb, var(--alert) 16%, transparent)', color: chainOk ? 'var(--anchor-2)' : 'var(--alert)' }}>
          {chainOk ? tt('chain_ok') : tt('chain_bad')}
        </span>
      </div>
      <p className="tag">{locale === 'en' ? commodity?.label_en : commodity?.label_fr} · {Number(lot.quantity_kg)} kg · {lot.status}</p>

      <div className="card">
        <div className="eyebrow">{tt('quality_h')}</div>
        <QualityCapture orgId={org.id} lotId={id} attrs={attrs ?? []} values={latestVals} locale={locale} />
      </div>

      <div className="card">
        <div className="eyebrow">{tt('custody_h')}</div>
        {(events ?? []).map((e, i) => {
          const note = (e.payload as { note?: string } | null)?.note;
          return (
            <div className="cap" key={i}>
              <span style={{ fontWeight: 600 }}>{e.event_type}{note ? <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · {note}</span> : null}</span>
              <span style={{ color: 'var(--ink-3)', fontSize: '.82rem' }}>#{e.seq} · {new Date(e.occurred_at).toISOString().slice(0, 10)}</span>
            </div>
          );
        })}
        <p className="cap" style={{ fontSize: '.8rem', color: 'var(--ink-3)', marginTop: 6 }}>{tt('processing_hint')}</p>
        <AddCustodyEvent lotId={id} locale={locale} />
      </div>
    </main>
  );
}
