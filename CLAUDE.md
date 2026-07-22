# CLAUDE.md: Wouri build rules

Read this first, every session. Wouri is a registry of record for African commodity export (Cameroon cocoa and timber first): one file per consignment, purchase order to settlement, that produces every document, proves every claim, and is verifiable by anyone holding the paper, offline, without trusting Wouri. It is NOT a marketplace, an ERP, or a traceability app. Its value is that a third party (a customs officer, a bank, a buyer) relies on its stamp.

## House style
- **No em-dashes.** Ever. Use commas, colons, or restructure. Enforced by the canonicals check.
- French is the primary product language; every user-facing string ships fr + en, with full diacritics, legible on a photocopy.
- The brand is institutional, precise, quiet: one serif for documents, one clear sans for the interface, a single deep anchor colour plus black, white and one alert red. No illustration, no gradient, no rounded-playful shapes. The app has light and dark; documents are always light.
- Voice: plain, specific, never reassuring without evidence. Never write "All good" or "You are compliant." Write the concrete thing ("Nine of nine required documents present, phytosanitary certificate expires in four days").

## The laws (imperative; each has an ADR in CANONICALS.md)
1. **Row, not column, not branch.** Anything that varies by commodity, country, authority, buyer or year is an effective-dated, cited registry ROW. If a change request would alter a Layer 1 spine table, the model is wrong and needs generalising, not extending.
2. **No regulatory literal in application code.** Not a duty rate, threshold, deadline, minimum diameter, or species list. All lookups against the registry. A canonicals check greps for numeric literals near regulatory identifiers.
3. **No policy-less table.** RLS deny-by-default on every tenant table. A CI check fails if any table has RLS off. Verify anon and a wrong-tenant JWT see zero rows, probing as the actual foreign role, never as postgres.
4. **lot_events is append-only.** No UPDATE or DELETE policy. Corrections are named compensating events pointing to the event they compensate, never a soft-delete flag. A deleted_at on lot_events breaks the hash chain and is forbidden.
5. **No document issued with an unbound field.** Every field records its source table, id and column. Issuance is idempotent and reproducible: a deterministic content hash over resolved bindings plus pack version plus consignment, a client-minted issuance UUID, and a record of which effective-dated rule rows were resolved, so a regenerated document is byte-reproducible.
6. **No projection treated as truth.** Layer 3 is rebuildable from the spine; a projection that cannot be rebuilt has become a source of truth by accident and is a bug. Rebuilds are deterministic (defined event order by server sequence, occurred_at tiebreak, never created_at wall clock; versioned handlers; a projection checkpoint).
7. **Proof, not trust.** Every issued document is a W3C Verifiable Credential anchored to a signed, published Merkle checkpoint, bound to a vLEI signer, verifiable offline. The verification page never depends on trusting or reaching Wouri. The 26-char code is the human-friendly lookup, not the trust root.
8. **Feed government systems, do not replace them.** For any artifact a government system legally issues (SIGIF 2 waybill, NCCB cocoa grade certificate, CAMCIS SAD, e-GUCE packing/export declaration, EU TRACES DDS reference), store the authoritative external reference, never a self-minted substitute.
9. **A CITES-listed species is identity-preserved.** Any lot whose species.cites_appendix is in (I, II, III) is forbidden by DB constraint from origin_claim in (mass_balance, credit); it must be identity_preserved or segregated.
10. **Settled means repatriated.** The settlement state machine ends at the BEAC 150-day foreign-exchange repatriation, not at "paid." Do not hardcode the 35 percent surrender rate; that is extractive-sector only. Cocoa and timber owe full repatriation within 150 days through the same domiciled bank.
11. **Anti-spoof never hard-blocks an honest user.** Return a trust tier (verified / unverified / too_far / teleport), the server computes distance on the spheroid, the record is stored with its tier. Refuse only physical impossibility. Never lose an offline write.
12. **Effective-dated rows use a single tstzrange plus a btree_gist exclusion constraint**, equality columns first. A consignment validates against its pinned pack version, never "latest."
13. **RLS is the single isolation gate.** Wrap auth.uid() in a scalar subquery; index the columns policies filter on; add column GRANTs on integrity fields (tenant_id, event_hash, prev_event_hash, provenance) so a client cannot write them; authorize from a DB membership table, never JWT user_metadata; make the sync cursor tombstone-aware.
14. **Every cross-tenant benefit resolves to one of three paths**: a platform-owned common good, an explicit opt-in consent, or an anonymized aggregate (minimum cohort, noise). There is no fourth path. Neutrality is existential; the moment a tenant suspects a competitor controls the registry, contribution stops.
15. **Every negative assertion in a test carries a positive control.** No absence test that never looked at anything. No test that reaches around the function it is testing. Probe as the real foreign role.

## What not to do
- No em-dash. No `deleted_at` on lot_events. No global hash chain (chain per lot or device stream). No FLEGT licence gate for Cameroon timber (the VPA was terminated in June 2025; timber clears under EUDR, residual EUTR, and CITES). No GSP Form A default for EU-preference (use EUR.1-CMR, or the approved-exporter declaration). No hardcoded 35 percent repatriation. No eBL title registry (generate DCSA BL 3.0 data and hand issuance to a DCSA-interoperable platform via PINT, store the reference). No marketplace drift (freight booking, subjective counterparty scores, or financing origination and matching).

## Definition of done, every sprint
Four green gates: build (canonicals + typecheck + migrations clean), end-to-end sweep (whole app as each role at phone size, fails on any console error or 5xx, tenant B sees none of tenant A), machine self-test (rollback subtransactions plus anon and wrong-tenant RLS probes), and a Fabrice UAT run on dev-backed staging feeding a realtime triage. See docs/delivery/sprint-kanban.md.

## The one hard rule
Do not generate the component specs or start Sprint 1 until one real consignment file has been seen. It is the highest-value input to the document engine.
