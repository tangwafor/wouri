// Types for the Ed25519 VC proof module, beside vc.mjs so the console typechecks
// against the same code the self-test runs.
export function canonicalize(value: unknown): string;
export function contentHash(content: unknown): string;
export interface CredentialMeta {
  issuer: string;
  validFrom: string;
  template: string;
  templateVersion: string;
  packVersion: string;
  verificationCode: string;
  checkpoint?: string | null;
  verificationMethod?: string;
}
export function issueCredential(content: unknown, meta: CredentialMeta, privateKeyPem: string): Record<string, unknown>;
export function verifyCredential(vc: Record<string, unknown>, publicKeyPem: string): { ok: boolean; reason: string };
