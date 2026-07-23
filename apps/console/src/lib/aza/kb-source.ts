import { COMMODITIES, RAILS, CAPABILITIES, docLabel } from './kb.mjs';

// The KB read path for tenant-facing surfaces. It PREFERS the live, owner-edited
// aza_kb table so edits at /admin/kb show up immediately, and FALLS BACK to the
// bundled kb.mjs if the table is empty or the read fails, so Aza still answers
// during an outage (ADR-0031, ADR-0032). Returns plain objects so a server
// component can pass them to a client component. No em-dashes.

export type KbBody = Record<string, { en: string; fr: string }>;
export type KbDocs = Record<string, { key: string; label: string }[]>;

function bundledBody(): KbBody {
  const b: KbBody = {};
  for (const [k, v] of Object.entries(COMMODITIES)) b['commodity.' + k] = { en: v.what_en, fr: v.what_fr };
  for (const [k, v] of Object.entries(RAILS)) b[k] = { en: v.what_en, fr: v.what_fr };
  for (const [k, v] of Object.entries(CAPABILITIES)) b[k] = { en: v.what_en, fr: v.what_en };
  return b;
}
function bundledDocs(): KbDocs {
  const d: KbDocs = {};
  for (const [k, v] of Object.entries(COMMODITIES)) d['commodity.' + k] = v.documents.map((x) => ({ key: x, label: docLabel(x) }));
  return d;
}

type Row = { key: string; kind: string; body_en: string | null; body_fr: string | null; data: { documents?: string[] } | null };

// Accepts any Supabase-like client (the generics on the real client are noisy).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadKb(supabase: any): Promise<{ body: KbBody; docs: KbDocs }> {
  const body = bundledBody();
  const docs = bundledDocs();
  try {
    const { data } = await supabase.from('aza_kb').select('key, kind, body_en, body_fr, data');
    if (data && data.length) {
      for (const row of data as Row[]) {
        const capKey = row.kind === 'capability' ? row.key.replace(/^cap\./, '') : row.key;
        if (row.kind === 'commodity' || row.kind === 'rail' || row.kind === 'capability') {
          const en = row.body_en ?? body[capKey]?.en ?? '';
          body[capKey] = { en, fr: row.body_fr ?? row.body_en ?? body[capKey]?.fr ?? en };
        }
        if (row.kind === 'commodity' && Array.isArray(row.data?.documents)) {
          docs[capKey] = row.data.documents.map((x) => ({ key: x, label: docLabel(x) }));
        }
      }
    }
  } catch {
    // aza_kb unreadable: the bundled copy is the floor.
  }
  return { body, docs };
}
