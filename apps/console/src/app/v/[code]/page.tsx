// The public verification page: wouri.co/v/{code}. Anyone, no account. It resolves
// the code, verifies the Ed25519 signature server-side with the public key, and
// shows whether the document is authentic, revoked, or tampered. This is the
// most-viewed Wouri surface (a QR on a paper document lands here), so it earns the
// design. node:crypto runs server-side, so this is a server component. No em-dashes.
import { supabaseServer } from '@/lib/supabase/server';
import { verifyCredential } from '@/lib/proof/vc.mjs';
import { type Key } from '@/lib/i18n';
import { getT } from '@/lib/locale';

export const dynamic = 'force-dynamic';

type Verdict = 'valid' | 'revoked' | 'invalid' | 'notfound';
const SEAL: Record<Verdict, string> = { valid: '#0d4f47', revoked: '#a11f1c', invalid: '#a11f1c', notfound: '#7c7566' };
const MARK: Record<Verdict, string> = { valid: 'OK', revoked: 'REVOKED', invalid: 'FAIL', notfound: '?' };

function fieldLabel(k: string): string {
  const map: Record<string, string> = {
    exporter: 'Exporter', exporter_niu: 'Exporter NIU', consignment_code: 'Consignment',
    destination_country: 'Destination', buyer_name: 'Buyer', commodity: 'Commodity',
    net_weight_kg: 'Net weight (kg)', origin_country: 'Origin', hs_code: 'HS code',
    place_of_origin: 'Place of origin', treatment: 'Treatment', verified_gross_mass_kg: 'Verified gross mass (kg)',
    method: 'Method', moisture_pct: 'Moisture (%)', bean_count: 'Bean count',
  };
  return map[k] ?? k;
}

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('verify_document', { p_code: code });

  let verdict: Verdict = 'notfound';
  let subject: Record<string, unknown> = {};
  if (data?.found) {
    const v = verifyCredential(data.vc, data.public_key);
    subject = (data.vc?.credentialSubject ?? {}) as Record<string, unknown>;
    verdict = data.status === 'revoked' ? 'revoked' : v.ok ? 'valid' : 'invalid';
  }

  const titleKey: Record<Verdict, Key> = { valid: 'verify_valid', revoked: 'verify_revoked', invalid: 'verify_invalid', notfound: 'verify_notfound' };
  const subKey: Record<Verdict, Key> = { valid: 'verify_valid_sub', revoked: 'verify_revoked_sub', invalid: 'verify_invalid_sub', notfound: 'verify_notfound_sub' };
  const docTypeKey = (data?.template ? ('doc_' + data.template) : null) as Key | null;
  const { tt } = await getT();

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '40px 20px', fontFamily: 'var(--serif)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
        <span style={{ fontFamily: 'var(--serif)', color: 'var(--anchor)', fontSize: '1.5rem', fontWeight: 700 }}>Wouri</span>
        <span style={{ fontFamily: 'var(--sans)', color: 'var(--ink-3)', fontSize: '.8rem' }}>{tt('verify_title')}</span>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ background: SEAL[verdict], color: '#f6f4ee', padding: '22px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: '.85rem', letterSpacing: '.08em', border: '2px solid #f6f4ee', borderRadius: 100, padding: '8px 12px', whiteSpace: 'nowrap' }}>
            {MARK[verdict]}
          </span>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.15 }}>{tt(titleKey[verdict])}</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: '.85rem', opacity: .9, marginTop: 4 }}>{tt(subKey[verdict])}</div>
          </div>
        </div>

        {data?.found ? (
          <div style={{ padding: '20px 24px', fontFamily: 'var(--sans)' }}>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px, 40%) 1fr', rowGap: 10, columnGap: 16 }}>
              {docTypeKey ? (
                <>
                  <dt style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>{tt('verify_type')}</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{tt(docTypeKey)}</dd>
                </>
              ) : null}
              {Object.entries(subject).map(([k, val]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>{fieldLabel(k)}</dt>
                  <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{val === null || val === undefined ? '-' : String(val)}</dd>
                </div>
              ))}
              <dt style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>{tt('verify_issuer')}</dt>
              <dd style={{ margin: 0 }}>{String(data.vc?.issuer ?? '-')}</dd>
              <dt style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>{tt('verify_issued')}</dt>
              <dd style={{ margin: 0 }}>{data.issued_at ? new Date(data.issued_at).toISOString().slice(0, 10) : '-'}</dd>
              {data.revoked_at ? (
                <>
                  <dt style={{ color: 'var(--alert)', fontSize: '.85rem' }}>{tt('verify_revoked_on')}</dt>
                  <dd style={{ margin: 0, color: 'var(--alert)' }}>{new Date(data.revoked_at).toISOString().slice(0, 10)} ({data.revoked_reason})</dd>
                </>
              ) : null}
              <dt style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>{tt('verify_code')}</dt>
              <dd style={{ margin: 0, fontFamily: 'var(--mono, monospace)' }}>{code}</dd>
            </dl>
          </div>
        ) : null}
      </div>

      <p style={{ fontFamily: 'var(--sans)', color: 'var(--ink-3)', fontSize: '.8rem', marginTop: 18, textAlign: 'center' }}>
        {tt('verify_offline')}
      </p>
    </main>
  );
}
