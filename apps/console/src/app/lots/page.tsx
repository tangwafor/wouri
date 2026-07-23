// Lots: where the custody chain starts. Create a lot at harvest (with a plot) or
// after harvest (from a supplier), and see the tenant's lots with an EUDR
// origin-gap flag. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { AppNav } from '../AppNav';
import { LotEntry } from './LotEntry';

export const dynamic = 'force-dynamic';

type Lot = {
  id: string; code: string; origin_mode: string; quantity_kg: number; status: string;
  commodities: { key: string; label_en: string; label_fr: string; eudr: boolean } | null;
};

export default async function LotsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  const org = orgs?.[0];
  if (!org) redirect('/onboarding');

  const { locale, tt } = await getT();
  const { data: commodities } = await supabase.from('commodities').select('key, label_fr, label_en, eudr').order('label_en');
  const { data: lots } = await supabase
    .from('lots')
    .select('id, code, origin_mode, quantity_kg, status, commodities(key, label_en, label_fr, eudr)')
    .order('created_at', { ascending: false });
  // Which lots are flagged as an origin gap on the readiness board.
  const { data: gaps } = await supabase.from('readiness_board').select('consignment_code').eq('kind', 'origin_gap');
  const gapCodes = new Set((gaps ?? []).map((g) => g.consignment_code));

  return (
    <main className="wrap-wide">
      <AppNav current="/lots" locale={locale} />
      <h1 className="brand" style={{ marginBottom: 16 }}>{tt('lots')}</h1>

      <LotEntry orgId={org.id} commodities={commodities ?? []} locale={locale} />

      {(lots ?? []).length === 0 ? (
        <p className="muted">{tt('no_lots')}</p>
      ) : (
        (lots as unknown as Lot[]).map((l) => (
          <a className="card" key={l.id} href={`/lots/${l.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
            <div>
              <div style={{ fontWeight: 650 }}>
                {l.code}
                <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · {locale === 'en' ? l.commodities?.label_en : l.commodities?.label_fr}</span>
              </div>
              <div style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>
                {l.origin_mode === 'at_harvest' || l.origin_mode === 'at_origin' ? tt('at_harvest') : tt('after_harvest')}
                {' · '}{Number(l.quantity_kg)} kg · {l.status}
              </div>
            </div>
            {gapCodes.has(l.code) ? (
              <span className="pill" style={{ background: 'color-mix(in srgb, var(--alert) 15%, transparent)', color: 'var(--alert)', whiteSpace: 'nowrap' }}>
                {tt('origin_gap_flag')}
              </span>
            ) : null}
          </a>
        ))
      )}
    </main>
  );
}
