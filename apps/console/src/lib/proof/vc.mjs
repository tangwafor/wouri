// Wouri proof layer: a document is a W3C Verifiable Credential whose proof is an
// Ed25519 signature over a canonical hash of its content. A third party verifies
// it with the published public key alone, offline, with no call back to Wouri.
// This is "proof not trust." Pure ESM over node:crypto so the self-test runs the
// exact code the verification page imports. Merkle-checkpoint anchoring and vLEI
// binding layer on top of this; the signature is the base. No em-dashes.
import { createHash, sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from 'node:crypto';

// Deterministic serialization: sorted keys, arrays in order. Two structurally
// equal documents produce byte-identical output, so the content hash is stable
// and issuance is reproducible.
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

export function contentHash(content) {
  return createHash('sha256').update(canonicalize(content), 'utf8').digest('hex');
}

// Build the signed VC. `meta` carries the issuer id, the template, the pack
// version, the verification code, and (once anchored) the Merkle checkpoint.
export function issueCredential(content, meta, privateKeyPem) {
  const hash = contentHash(content);
  const vc = {
    '@context': ['https://www.w3.org/ns/credentials/v2'],
    type: ['VerifiableCredential', 'WouriConsignmentDocument'],
    issuer: meta.issuer,
    validFrom: meta.validFrom,
    credentialSubject: content,
    wouri: {
      template: meta.template,
      templateVersion: meta.templateVersion,
      packVersion: meta.packVersion,
      verificationCode: meta.verificationCode,
      contentHash: hash,
      checkpoint: meta.checkpoint ?? null,
    },
  };
  const toSign = contentHash({ subjectHash: hash, wouri: vc.wouri, issuer: vc.issuer, validFrom: vc.validFrom });
  const key = createPrivateKey(privateKeyPem);
  const signature = edSign(null, Buffer.from(toSign, 'utf8'), key).toString('base64');
  vc.proof = {
    type: 'Ed25519Signature2020',
    created: meta.validFrom,
    proofPurpose: 'assertionMethod',
    verificationMethod: meta.verificationMethod ?? 'wouri:proof-key-1',
    proofValue: signature,
  };
  return vc;
}

// Verify offline: recompute the content hash from the subject, rebuild the signed
// payload, and check the Ed25519 signature against the public key. Returns a
// reason so the verification page can say WHY a document failed.
export function verifyCredential(vc, publicKeyPem) {
  try {
    if (!vc || !vc.proof || !vc.credentialSubject || !vc.wouri) return { ok: false, reason: 'malformed' };
    const hash = contentHash(vc.credentialSubject);
    if (hash !== vc.wouri.contentHash) return { ok: false, reason: 'content-hash-mismatch' };
    const toSign = contentHash({ subjectHash: hash, wouri: vc.wouri, issuer: vc.issuer, validFrom: vc.validFrom });
    const key = createPublicKey(publicKeyPem);
    const good = edVerify(null, Buffer.from(toSign, 'utf8'), key, Buffer.from(vc.proof.proofValue, 'base64'));
    return good ? { ok: true, reason: 'valid' } : { ok: false, reason: 'bad-signature' };
  } catch (e) {
    return { ok: false, reason: 'verify-error:' + e.message };
  }
}
