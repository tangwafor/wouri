'use server';
import { randomUUID } from 'node:crypto';
import { supabaseServer } from '@/lib/supabase/server';
import { contentHash, issueCredential } from '@/lib/proof/vc.mjs';

// Issue a document from a consignment. The Ed25519 signing key is read from a
// SERVER-ONLY env var (never NEXT_PUBLIC, never sent to the browser); the browser
// only ever sees the resulting verification code. resolve_document and
// issue_document enforce the invariants (unbound blocks issuance, weight
// consistency, idempotent by content hash) under the user session. No em-dashes.
export async function issueDocument(
  consignmentId: string, template: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const supabase = await supabaseServer();
  const { data: resolved, error: rErr } = await supabase.rpc('resolve_document', { p_consignment: consignmentId, p_template: template });
  if (rErr || !resolved) return { ok: false, error: rErr?.message ?? 'resolve failed' };
  if ((resolved.unbound?.length ?? 0) > 0) return { ok: false, error: 'Missing required: ' + resolved.unbound.join(', ') };
  if (!resolved.weight_ok) return { ok: false, error: 'Declared weight does not match the consignment' };

  const b64 = process.env.WOURI_PROOF_PRIVATE_PEM_B64;
  if (!b64) return { ok: false, error: 'Signing key is not configured on the server' };
  const priv = Buffer.from(b64, 'base64').toString('utf8');

  const content = resolved.content;
  const hash = contentHash(content);
  const code = 'WOURI-' + randomUUID().slice(0, 8).toUpperCase();
  const meta = {
    issuer: 'wouri:registry', validFrom: new Date().toISOString(),
    template, templateVersion: 'v1', packVersion: 'cm-docs-v1', verificationCode: code,
  };
  const vc = issueCredential(content, meta, priv);
  const { error } = await supabase.rpc('issue_document', {
    p_id: randomUUID(), p_consignment: consignmentId, p_template: template,
    p_template_version: 'v1', p_pack_version: 'cm-docs-v1', p_content_hash: hash, p_vc: vc, p_code: code,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, code };
}
