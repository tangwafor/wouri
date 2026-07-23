'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t, type Locale, type Key } from '@/lib/i18n';
import { issueDocument } from './actions';

type Doc = { template_key: string; verification_code: string; status: string };
const TEMPLATES = ['eur1_cmr', 'phyto', 'vgm', 'quality_cert'];

// Issue and view the consignment documents. Issuing calls the server action that
// signs with the server-only key; the browser only sees the verification code.
export function DocumentsPanel({ consignmentId, documents, locale }: {
  consignmentId: string; documents: Doc[]; locale: Locale;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const byTemplate = new Map(documents.map((d) => [d.template_key, d]));

  async function issue(template: string) {
    setBusy(template); setErr(null);
    const res = await issueDocument(consignmentId, template);
    setBusy(null);
    if (!res.ok) { setErr(t(('doc_' + template) as Key, locale) + ': ' + res.error); return; }
    router.refresh();
  }

  return (
    <div className="card">
      <div className="eyebrow">{t('documents_h', locale)}</div>
      {TEMPLATES.map((tmpl) => {
        const doc = byTemplate.get(tmpl);
        return (
          <div className="cap" key={tmpl}>
            <span>
              {t(('doc_' + tmpl) as Key, locale)}
              {doc ? <span className="pill on" style={{ marginLeft: 8 }}>{doc.status}</span> : null}
            </span>
            {doc ? (
              <a href={`/v/${doc.verification_code}`} target="_blank" rel="noreferrer">{t('view_doc', locale)}</a>
            ) : (
              <button type="button" className="ghost" style={{ marginTop: 0 }} disabled={busy === tmpl} onClick={() => issue(tmpl)}>
                {busy === tmpl ? t('setting_up', locale) : t('issue_doc', locale)}
              </button>
            )}
          </div>
        );
      })}
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
}
