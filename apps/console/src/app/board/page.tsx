// The readiness board: the operator's morning surface. What is blocking each
// consignment right now, most urgent first. A rebuildable projection over the
// spine, RLS-scoped to the tenant. No em-dashes.
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getT } from '@/lib/locale';
import { type Key } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

type Blocker = {
  kind: string; severity: 'critical' | 'high' | 'warning';
  age_days: number; consignment_code: string | null; detail: string; due_date: string | null;
};
const SEV_RANK: Record<string, number> = { critical: 0, high: 1, warning: 2 };
const SEV_COLOR: Record<string, string> = { critical: 'var(--alert)', high: '#b4741f', warning: 'var(--ink-3)' };
const KIND_KEY: Record<string, Key> = {
  repatriation_overdue: 'board_repatriation_overdue', repatriation_due_soon: 'board_repatriation_due_soon',
  discrepancy: 'board_discrepancy', task_overdue: 'board_task_overdue',
};

export default async function BoardPage() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  if (!orgs?.length) redirect('/onboarding');

  const { tt } = await getT();
  const { data } = await supabase
    .from('readiness_board')
    .select('kind, severity, age_days, consignment_code, detail, due_date');
  const blockers = ((data ?? []) as Blocker[])
    .sort((x, y) => (SEV_RANK[x.severity] - SEV_RANK[y.severity]) || (y.age_days - x.age_days));

  return (
    <main className="wrap-wide">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="brand">{tt('board')}</h1>
        <a className="muted" href="/home">{tt('home')}</a>
      </div>

      {blockers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--ink-3)' }}>{tt('board_clear')}</div>
      ) : (
        blockers.map((b, i) => (
          <div className="card" key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', borderLeft: `4px solid ${SEV_COLOR[b.severity]}` }}>
            <span style={{
              fontFamily: 'var(--sans)', fontSize: '.66rem', fontWeight: 800, letterSpacing: '.06em',
              textTransform: 'uppercase', color: SEV_COLOR[b.severity], whiteSpace: 'nowrap',
            }}>{tt(('sev_' + b.severity) as Key)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 650 }}>
                {tt(KIND_KEY[b.kind] ?? ('board_' + b.kind) as Key)}
                {b.consignment_code ? <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · {b.consignment_code}</span> : null}
              </div>
              <div style={{ color: 'var(--ink-2)', fontSize: '.9rem' }}>{b.detail}</div>
            </div>
            <div style={{ color: 'var(--ink-3)', fontSize: '.8rem', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {b.age_days > 0 ? `${b.age_days} ${tt('board_age')}` : ''}
              {b.due_date ? <div>{String(b.due_date).slice(0, 10)}</div> : null}
            </div>
          </div>
        ))
      )}
    </main>
  );
}
