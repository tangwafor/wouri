// The owner dashboard: at a glance, everything that matters. The numbers, what
// needs attention, and the repatriation clock, so the owner sees all they need
// without hunting. Easy and, we hope, a little spectacular. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { loadKb } from '@/lib/aza/kb-source';
import { type Key } from '@/lib/i18n';
import { AppNav } from '../AppNav';
import { CapabilityPicker } from './CapabilityPicker';
import { BrandSettings } from './BrandSettings';

async function signout() {
  'use server';
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}

const SEV_RANK: Record<string, number> = { critical: 0, high: 1, warning: 2 };
const SEV_COLOR: Record<string, string> = { critical: 'var(--alert)', high: '#b4741f', warning: 'var(--ink-3)' };
const KIND_KEY: Record<string, Key> = {
  repatriation_overdue: 'board_repatriation_overdue', repatriation_due_soon: 'board_repatriation_due_soon',
  discrepancy: 'board_discrepancy', task_overdue: 'board_task_overdue', origin_gap: 'origin_gap_flag',
  shipment_overdue: 'board_shipment_overdue', shipment_etd_soon: 'board_shipment_etd_soon', compliance_gap: 'board_compliance_gap',
};

export default async function Home() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: orgs } = await supabase.from('organizations').select('id, slug, legal_name, status, brand');
  const org = orgs?.[0];
  if (!org) redirect('/onboarding');

  const { locale, tt } = await getT();
  const [lotsC, consC, docsC] = await Promise.all([
    supabase.from('lots').select('*', { count: 'exact', head: true }),
    supabase.from('consignments').select('*', { count: 'exact', head: true }),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
  ]);
  const { data: blockersRaw } = await supabase.from('readiness_board').select('kind, severity, age_days, consignment_code, detail');
  const blockers = (blockersRaw ?? []).sort((a, b) => (SEV_RANK[a.severity] - SEV_RANK[b.severity]) || (b.age_days - a.age_days));
  const criticalCount = blockers.filter((b) => b.severity === 'critical').length;
  const { data: clocks } = await supabase.from('settlement_clock').select('days_remaining, overdue, status');
  const open = (clocks ?? []).filter((c) => c.status !== 'repatriated');
  const overdueCount = open.filter((c) => c.overdue).length;
  const nearest = open.filter((c) => !c.overdue && c.days_remaining != null).map((c) => c.days_remaining as number).sort((a, b) => a - b)[0];
  const { data: recent } = await supabase.from('consignments').select('id, code, status, parties:buyer_party_id(name)').order('created_at', { ascending: false }).limit(5);
  const { data: isAdmin } = await supabase.rpc('is_platform_admin');

  const { data: catalog } = await supabase.from('capability_catalog').select('capability_key, label_fr, label_en, category, requires_capability_key, description_fr, description_en').order('category');
  const { data: enabledRows } = await supabase.from('organization_capabilities').select('capability_key');
  const enabled = new Set((enabledRows ?? []).map((r) => r.capability_key));
  const { body: descriptions } = await loadKb(supabase);

  const kpi = (n: number | string, label: string, accent?: string) => (
    <div className="card" style={{ margin: 0, padding: '16px 18px' }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: accent ?? 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{n}</div>
      <div className="eyebrow" style={{ marginTop: 6, marginBottom: 0 }}>{label}</div>
    </div>
  );

  return (
    <main className="wrap-wide">
      <div style={{ position: 'relative' }}>
        <AppNav current="/home" locale={locale} />
        <form action={signout} style={{ position: 'absolute', top: 2, right: 0 }}>
          <button className="ghost" type="submit" style={{ marginTop: 0, padding: '5px 11px', fontSize: '.85rem' }}>{tt('signout')}</button>
        </form>
      </div>

      {/* Hero */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', margin: '4px 0 18px' }}>
        <div>
          <h1 className="brand" style={{ marginBottom: 2 }}>{org.legal_name ?? org.slug}</h1>
          <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{org.status}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/lots"><button className="ghost" style={{ marginTop: 0 }}>{tt('new_lot')}</button></a>
          <a href="/consignments"><button style={{ marginTop: 0 }}>{tt('new_consignment')}</button></a>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
        {kpi(consC.count ?? 0, tt('consignments'))}
        {kpi(lotsC.count ?? 0, tt('lots'))}
        {kpi(docsC.count ?? 0, tt('documents_h'))}
        {kpi(blockers.length, tt('needs_attention'), criticalCount > 0 ? 'var(--alert)' : undefined)}
      </div>

      {/* Attention + repatriation */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div className="eyebrow">{tt('needs_attention')}</div>
            <a href="/board" style={{ fontSize: '.82rem' }}>{tt('view_all')}</a>
          </div>
          {blockers.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>{tt('all_good')}</p>
          ) : blockers.slice(0, 4).map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: i ? '1px solid var(--rule)' : 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: SEV_COLOR[b.severity], flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.9rem', fontWeight: 600 }}>{tt(KIND_KEY[b.kind] ?? ('board_' + b.kind) as Key)}{b.consignment_code ? <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · {b.consignment_code}</span> : null}</div>
                <div style={{ fontSize: '.8rem', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <div className="eyebrow">{tt('repatriation_h')}</div>
          {open.length === 0 ? (
            <p className="muted" style={{ marginTop: 8 }}>{tt('nothing_due')}</p>
          ) : (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontFamily: 'var(--serif)', fontSize: '2rem', fontWeight: 700, lineHeight: 1, color: overdueCount > 0 ? 'var(--alert)' : (nearest != null && nearest <= 15 ? 'var(--warn)' : 'var(--anchor-2)') }}>
                {overdueCount > 0 ? overdueCount : (nearest ?? '-')}
              </div>
              <div className="eyebrow" style={{ marginTop: 6 }}>
                {overdueCount > 0 ? tt('overdue_word') : (nearest != null ? tt('days_left') : tt('nothing_due'))}
              </div>
              <div style={{ marginTop: 8, color: 'var(--ink-3)', fontSize: '.82rem' }}>{open.length} {tt('in_flight')}</div>
            </div>
          )}
        </div>
      </div>

      {/* Recent consignments */}
      {(recent ?? []).length > 0 ? (
        <div className="card">
          <div className="eyebrow">{tt('recent_consignments')}</div>
          {(recent as unknown as { id: string; code: string; status: string; parties: { name: string } | null }[]).map((c, i) => (
            <a key={c.id} href={`/consignments/${c.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: i ? '1px solid var(--rule)' : 0, textDecoration: 'none', color: 'inherit' }}>
              <div><span style={{ fontWeight: 600 }}>{c.code}</span><span style={{ color: 'var(--ink-3)' }}> · {c.parties?.name ?? '-'}</span></div>
              <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{c.status}</span>
            </a>
          ))}
        </div>
      ) : null}

      {/* Document branding */}
      <div className="card">
        <div className="eyebrow">{tt('doc_branding')}</div>
        <BrandSettings orgId={org.id} initial={(org.brand ?? {}) as { color?: string; tagline?: string }} locale={locale} />
      </div>

      {/* Activities (secondary) */}
      <div className="card">
        <div className="eyebrow">{tt('your_activities')}</div>
        <CapabilityPicker orgId={org.id} catalog={catalog ?? []} initiallyEnabled={Array.from(enabled)} locale={locale} descriptions={descriptions} />
      </div>

      {isAdmin ? <p className="muted"><a href="/admin/kb">Aza knowledge base (platform admin)</a></p> : null}
    </main>
  );
}
