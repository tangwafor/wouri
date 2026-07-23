// Wouri Merkle anchoring verifier. Mirrors the SQL builder (0038) exactly: a leaf
// is an already-computed sha256 (a document content hash); an internal node is
// sha256(left || right) over raw bytes; an odd node is promoted unpaired. A third
// party uses verifyInclusion to confirm, offline, that a document was in a published
// checkpoint, and verifyRootSignature to confirm the server signed that root. Pure
// node:crypto so the self-test runs the exact code a verifier would. No em-dashes.
import { createHash, sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from 'node:crypto';

const sha256 = (buf) => createHash('sha256').update(buf).digest();

// Recompute a Merkle root from ordered leaf hex hashes. Matches merkle_root() in SQL.
export function computeRoot(leafHexes) {
  if (!leafHexes || leafHexes.length === 0) return sha256(Buffer.alloc(0)).toString('hex');
  let level = leafHexes.map((h) => Buffer.from(h, 'hex'));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) next.push(sha256(Buffer.concat([level[i], level[i + 1]])));
      else next.push(level[i]); // odd promoted
    }
    level = next;
  }
  return level[0].toString('hex');
}

// Verify an inclusion proof: fold the leaf up through the sibling path and check it
// reaches the root. `proof` is the array [{sibling: hex, side: 'left'|'right'}] from
// document_inclusion_proof; `side` is which side the sibling sits on.
export function verifyInclusion(leafHex, proof, rootHex) {
  let h = Buffer.from(leafHex, 'hex');
  for (const step of proof || []) {
    const sib = Buffer.from(step.sibling, 'hex');
    h = sha256(step.side === 'left' ? Buffer.concat([sib, h]) : Buffer.concat([h, sib]));
  }
  return h.toString('hex') === rootHex;
}

// Sign / verify a checkpoint root with the Ed25519 server key (the same key that
// signs documents). The signed payload is the root hex string.
export function signRoot(rootHex, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  return { type: 'Ed25519Signature2020', value: edSign(null, Buffer.from(rootHex, 'utf8'), key).toString('base64') };
}
export function verifyRootSignature(rootHex, signature, publicKeyPem) {
  try {
    if (!signature || !signature.value) return false;
    const key = createPublicKey(publicKeyPem);
    return edVerify(null, Buffer.from(rootHex, 'utf8'), key, Buffer.from(signature.value, 'base64'));
  } catch { return false; }
}
