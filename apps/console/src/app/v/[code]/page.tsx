// The public verification document: wouri.co/v/{code}. Anyone, no account. It
// verifies the Ed25519 signature server-side and renders a branded, printable,
// e-signed certificate carrying the four marks a Wouri document must show: logo,
// timestamp, place of issue, and the electronic signature (with a QR to verify).
// node:crypto and qrcode run server-side, so this is a server component. No em-dashes.
import QRCode from 'qrcode';
import { supabaseServer } from '@/lib/supabase/server';
import { verifyCredential } from '@/lib/proof/vc.mjs';
import { getT } from '@/lib/locale';
import { type Key } from '@/lib/i18n';
import { PrintButton } from './PrintButton';

export const dynamic = 'force-dynamic';

type Verdict = 'valid' | 'revoked' | 'invalid' | 'notfound';
const SEAL: Record<Verdict, string> = { valid: '#0d4f47', revoked: '#a11f1c', invalid: '#a11f1c', notfound: '#7c7566' };
const MARK: Record<Verdict, string> = { valid: 'AUTHENTIC', revoked: 'REVOKED', invalid: 'ALTERED', notfound: 'NOT FOUND' };
const FIELDS: Record<string, string> = {
  exporter: 'Exporter', exporter_niu: 'Exporter NIU', consignment_code: 'Consignment',
  destination_country: 'Destination', buyer_name: 'Buyer', commodity: 'Commodity',
  net_weight_kg: 'Net weight (kg)', origin_country: 'Origin', hs_code: 'HS code',
  place_of_origin: 'Place of origin', treatment: 'Treatment', verified_gross_mass_kg: 'Verified gross mass (kg)',
  method: 'Method', moisture_pct: 'Moisture (%)', bean_count: 'Bean count',
};

function Seal({ color }: { color: string }) {
  return (
    <svg width="52" height="52" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="50" cy="50" r="38" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />
      <path d="M50 30 C42 42, 42 54, 50 68 C58 54, 58 42, 50 30 Z" fill={color} opacity="0.9" />
      <path d="M50 40 L50 68" stroke="#f6f4ee" strokeWidth="1.4" />
      <text x="50" y="86" textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="1.5" fill={color} fontFamily="system-ui, sans-serif">WOURI</text>
    </svg>
  );
}

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('verify_document', { p_code: code });
  const { tt } = await getT();

  let verdict: Verdict = 'notfound';
  let subject: Record<string, unknown> = {};
  if (data?.found) {
    const v = verifyCredential(data.vc, data.public_key);
    subject = (data.vc?.credentialSubject ?? {}) as Record<string, unknown>;
    verdict = data.status === 'revoked' ? 'revoked' : v.ok ? 'valid' : 'invalid';
  }
  const color = SEAL[verdict];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://wouri.co';
  const qr = await QRCode.toDataURL(`${site}/v/${code}`, { margin: 1, width: 220, color: { dark: '#15130e', light: '#00000000' } });
  const docTypeKey = (data?.template ? ('doc_' + data.template) : null) as Key | null;
  const issued = data?.issued_at ? new Date(data.issued_at) : (data?.vc?.validFrom ? new Date(data.vc.validFrom) : null);
  const place = (subject.origin_country as string) === 'CM' || data?.found ? 'Cameroon' : '-';

  return (
    <main style={{ maxWidth: 660, margin: '0 auto', padding: '28px 16px 60px' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .sheet { box-shadow: none !important; border: 1px solid #ccc !important; }
        }
      `}</style>

      {data?.found ? (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <PrintButton label={tt('print')} />
        </div>
      ) : null}

      <div className="sheet" style={{ background: 'var(--surface)', border: '1px solid var(--rule)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
        {/* Branded header: logo + registry line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 26px', borderBottom: `2px solid ${color}` }}>
          <Seal color={color} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--anchor)', lineHeight: 1 }}>Wouri</div>
            <div style={{ fontFamily: 'var(--sans)', fontSize: '.74rem', color: 'var(--ink-3)' }}>Registry of record for African commodity export</div>
          </div>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: '.72rem', letterSpacing: '.08em', color, border: `2px solid ${color}`, borderRadius: 100, padding: '6px 12px', whiteSpace: 'nowrap' }}>
            {MARK[verdict]}
          </span>
        </div>

        {/* Title */}
        <div style={{ padding: '20px 26px 6px' }}>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: '1.5rem', margin: 0, color: 'var(--ink)' }}>
            {docTypeKey ? tt(docTypeKey) : tt('verify_notfound')}
          </h1>
          {!data?.found ? <p style={{ color: 'var(--ink-3)' }}>{tt('verify_notfound_sub')}</p> : null}
        </div>

        {data?.found ? (
          <>
            {/* Fields */}
            <div style={{ padding: '6px 26px 8px', fontFamily: 'var(--sans)' }}>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(130px, 42%) 1fr', rowGap: 9, columnGap: 16 }}>
                {Object.entries(subject).map(([k, val]) => (
                  <div key={k} style={{ display: 'contents' }}>
                    <dt style={{ color: 'var(--ink-3)', fontSize: '.85rem' }}>{FIELDS[k] ?? k}</dt>
                    <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums' }}>{val === null || val === undefined ? '-' : String(val)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Signature block: e-signed, timestamp, location, QR */}
            <div style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '16px 26px 22px', borderTop: '1px solid var(--rule)', marginTop: 8, flexWrap: 'wrap' }}>
              <img src={qr} alt={tt('scan_to_verify')} width={92} height={92} style={{ borderRadius: 6 }} />
              <div style={{ flex: 1, minWidth: 220, fontFamily: 'var(--sans)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color, fontWeight: 700, fontSize: '.9rem' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                  {tt('esigned')}
                </div>
                <div style={{ color: 'var(--ink-3)', fontSize: '.78rem', marginTop: 2 }}>Ed25519 · {data.status === 'revoked' ? tt('verify_revoked') : verdict === 'valid' ? tt('verify_valid') : tt('verify_invalid')}</div>
                <div style={{ marginTop: 8, fontSize: '.82rem', color: 'var(--ink-2)' }}>
                  <div><span style={{ color: 'var(--ink-3)' }}>{tt('issued_on')}:</span> {issued ? issued.toISOString().slice(0, 10) : '-'}</div>
                  <div><span style={{ color: 'var(--ink-3)' }}>{tt('place_of_issue')}:</span> {place}</div>
                  {data.revoked_at ? <div style={{ color: 'var(--alert)' }}>{tt('verify_revoked_on')}: {new Date(data.revoked_at).toISOString().slice(0, 10)} ({data.revoked_reason})</div> : null}
                  <div style={{ fontFamily: 'var(--mono, monospace)', marginTop: 4 }}>{code}</div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <p style={{ fontFamily: 'var(--sans)', color: 'var(--ink-3)', fontSize: '.78rem', marginTop: 16, textAlign: 'center' }}>
        {tt('verify_offline')} · Wouri Verified · wouri.co
      </p>
    </main>
  );
}
