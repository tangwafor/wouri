// Consignments: the shipments that carry lots to a buyer and settle. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { AppNav } from '../AppNav';
import { ConsignmentCreate } from './ConsignmentCreate';

export const dynamic = 'force-dynamic';

type Row = { id: string; code: string; destination_country: string | null; status: string; parties: { name: string } | null };

export default async function ConsignmentsPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  const org = orgs?.[0];
  if (!org) redirect('/onboarding');

  const { locale, tt } = await getT();
  const { data: rows } = await supabase
    .from('consignments')
    .select('id, code, destination_country, status, parties:buyer_party_id(name)')
    .order('created_at', { ascending: false });

  return (
    <main className="wrap-wide">
      <AppNav current="/consignments" locale={locale} />
      <h1 className="brand" style={{ marginBottom: 16 }}>{tt('consignments')}</h1>

      <ConsignmentCreate orgId={org.id} locale={locale} />

      {(rows ?? []).length === 0 ? (
        <p className="muted">{tt('no_consignments')}</p>
      ) : (
        (rows as unknown as Row[]).map((c) => (
          <a key={c.id} href={`/consignments/${c.id}`} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
            <div>
              <div style={{ fontWeight: 650 }}>{c.code}</div>
              <div style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>
                {c.parties?.name ?? '-'}{c.destination_country ? ` · ${c.destination_country}` : ''}
              </div>
            </div>
            <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{c.status}</span>
          </a>
        ))
      )}
    </main>
  );
}
