# Registry: the verification protocol (proof, not trust)

Traces to ADR-0004, ADR-0008. This is the most-viewed Wouri surface. No em-dashes.

## The claim a verification makes
This document's contents match the record that produced it, here is who issued it, here is when that was last true, and you can check all of that without trusting or contacting Wouri.

## The three layers of proof
1. **Field bindings.** Every field on the document records its source table, id, and column; an unbound field cannot be issued; issuance is idempotent and byte-reproducible (it records the resolved pack version and rule rows), so a regenerated document is identical.
2. **The Verifiable Credential.** Each issued document is a W3C Verifiable Credential 2.0 (a W3C Recommendation since 15 May 2025) in the UN/CEFACT Verifiable Trade Documents envelope, cryptographically signed. The signer identity is bound with a GLEIF vLEI (or at minimum an LEI), so a verifier learns which authorised human of which organization signed. The VC verifies offline, by signature, without calling Wouri.
3. **The anchor.** The document hash sits in a per-lot or per-stream hash chain that the server counter-signs at ingest and periodically folds into a signed, published Merkle checkpoint (the Certificate Transparency model), anchored with an RFC 3161 trusted timestamp plus a second independent anchor and LTV re-stamping. This gives inclusion and consistency proofs that survive a TSA change and let a third party verify append-only-ness independently. Consider COSE Receipts / IETF SCITT for interoperable receipts.

## The verification page (wouri.co/v/{code})
- The 26-char verification code is the human-friendly lookup, read aloud down a phone line to a customs officer: one random byte per character, an alphabet with no vowels so it cannot spell a word, no look-alike glyphs.
- Resolution is a SECURITY DEFINER function that demands the code and returns at most one row. Never a view.
- The page renders the document, the Wouri Verified mark, the issuer (via vLEI), the anchor reference and time, and lets the visitor download the VC to verify on their own device offline.
- A per-tenant verification_subdomain serves a tenant-branded verify page; the Wouri Verified mark is fixed and non-customisable.
- The verification page gets the same design investment as the dashboard. It is scanned by non-customers (a customs officer, a bank's documentary-credit desk, a certifier), the people whose reliance is the entire value of the mark.

## The mark and tenant verification
The Wouri Verified mark's strength reflects the tenant's verification_level: a self-declared issuer carries a qualifier; a verified issuer carries full attestation. The mark is enforced at issuance, not decorated in the UI. It is worth registering as a certification-style mark at OAPI and never diluting by putting it on anything unverified.

## Not the eBL title registry
For a negotiable bill of lading, generate DCSA BL 3.0-conformant data and hand issuance and transfer to a DCSA-interoperable, IG P&I-approved eBL platform via PINT, storing the reference. Wouri-rendered bills of lading that are not issued on such a platform are marked non-negotiable copies. Cameroon has not adopted MLETR, so a Wouri-native eBL is not legally transferable there.
