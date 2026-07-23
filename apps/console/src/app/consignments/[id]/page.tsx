// Consignment detail: allocate lots, open settlement, watch the BEAC clock. The
// operator hub that ties the chain together. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { AppNav } from '../../AppNav';
import { Allocator } from './Allocator';
import { SettlementPanel } from './SettlementPanel';

export const dynamic = 'force-dynamic';

export default async function ConsignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  const org = orgs?.[0];
  if (!org) redirect('/onboarding');

  const { locale, tt } = await getT();
  const { data: con } = await supabase
    .from('consignments').select('id, code, destination_country, status, parties:buyer_party_id(name)').eq('id', id).maybeSingle();
  if (!con) redirect('/consignments');

  const { data: allocatedRows } = await supabase.from('consignment_lots').select('lot_id, lots(id, code)').eq('consignment_id', id);
  const allocated = (allocatedRows ?? []).map((r) => (r.lots as unknown as { id: string; code: string })).filter(Boolean);
  const allocatedIds = new Set(allocated.map((l) => l.id));
  const { data: allLots } = await supabase.from('lots').select('id, code').order('created_at', { ascending: false });
  const available = (allLots ?? []).filter((l) => !allocatedIds.has(l.id));

  const { data: instrument } = await supabase
    .from('settlement_instruments').select('id, kind, currency, amount_minor, status').eq('consignment_id', id).maybeSingle();
  let clock = null;
  if (instrument) {
    const { data: clk } = await supabase.from('settlement_clock').select('repatriation_due, days_remaining, overdue').eq('id', instrument.id).maybeSingle();
    clock = clk;
  }

  const buyer = (con.parties as unknown as { name: string } | null)?.name;
  return (
    <main className="wrap-wide">
      <AppNav current="/consignments" locale={locale} />
      <a className="muted" href="/consignments" style={{ marginTop: 0 }}>{tt('back')}</a>
      <h1 className="brand" style={{ marginTop: 8, marginBottom: 2 }}>{con.code}</h1>
      <p className="tag">{buyer ?? '-'}{con.destination_country ? ` · ${con.destination_country}` : ''} · {con.status}</p>

      <Allocator orgId={org.id} consignmentId={id} allocated={allocated} available={available} locale={locale} />
      <SettlementPanel orgId={org.id} consignmentId={id} instrument={instrument ?? null} clock={clock} locale={locale} />
    </main>
  );
}
