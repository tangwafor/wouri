// Consignment detail: allocate lots, open settlement, watch the BEAC clock. The
// operator hub that ties the chain together. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { AppNav } from '../../AppNav';
import { Allocator } from './Allocator';
import { SettlementPanel } from './SettlementPanel';
import { DocumentsPanel } from './DocumentsPanel';
import { ShipmentPanel } from './ShipmentPanel';
import { CompliancePanel } from './CompliancePanel';

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

  // References now live in external_references, keyed on a registry of reference kinds.
  const { data: refRows } = await supabase.from('external_references').select('kind, value').eq('entity_type', 'consignment').eq('entity_id', id);
  const refMap = new Map((refRows ?? []).map((r) => [r.kind, r.value]));
  const refs = { dds: refMap.get('dds') ?? null, besc: refMap.get('besc') ?? null, insurance: refMap.get('insurance') ?? null };

  const { data: allocatedRows } = await supabase.from('consignment_lots').select('lot_id, lots(id, code)').eq('consignment_id', id);
  const allocated = (allocatedRows ?? []).map((r) => (r.lots as unknown as { id: string; code: string })).filter(Boolean);
  const allocatedIds = new Set(allocated.map((l) => l.id));
  const { data: allLots } = await supabase.from('lots').select('id, code, quantity_kg').order('created_at', { ascending: false });
  const available = (allLots ?? []).filter((l) => !allocatedIds.has(l.id));

  const { data: instrument } = await supabase
    .from('settlement_instruments').select('id, kind, currency, amount_minor, status').eq('consignment_id', id).maybeSingle();
  let clock = null;
  if (instrument) {
    const { data: clk } = await supabase.from('settlement_clock').select('repatriation_due, days_remaining, overdue').eq('id', instrument.id).maybeSingle();
    clock = clk;
  }
  const { data: documents } = await supabase.from('documents').select('template_key, verification_code, status').eq('consignment_id', id);
  const { data: shipment } = await supabase.from('shipments').select('id, carrier, vessel, port_loading, port_discharge, etd, eta, status').eq('consignment_id', id).maybeSingle();
  const { data: eudrRows } = await supabase.from('consignment_lots').select('lots(commodities(eudr))').eq('consignment_id', id);
  const eudr = (eudrRows ?? []).some((r) => (r.lots as unknown as { commodities: { eudr: boolean } | null } | null)?.commodities?.eudr === true);
  const docKeys = (documents ?? []).map((d) => d.template_key);

  const buyer = (con.parties as unknown as { name: string } | null)?.name;
  return (
    <main className="wrap-wide">
      <AppNav current="/consignments" locale={locale} />
      <a className="muted" href="/consignments" style={{ marginTop: 0 }}>{tt('back')}</a>
      <h1 className="brand" style={{ marginTop: 8, marginBottom: 2 }}>{con.code}</h1>
      <p className="tag">{buyer ?? '-'}{con.destination_country ? ` · ${con.destination_country}` : ''} · {con.status}</p>

      <Allocator orgId={org.id} consignmentId={id} allocated={allocated} available={available} locale={locale} />
      <CompliancePanel orgId={org.id} consignmentId={id} destination={con.destination_country}
        refs={refs} docKeys={docKeys} eudr={eudr} locale={locale} />
      <ShipmentPanel orgId={org.id} consignmentId={id} shipment={shipment ?? null} locale={locale} />
      <DocumentsPanel consignmentId={id} documents={documents ?? []} locale={locale} />
      <SettlementPanel orgId={org.id} consignmentId={id} instrument={instrument ?? null} clock={clock} locale={locale} />
    </main>
  );
}
