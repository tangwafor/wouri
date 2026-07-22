# CANONICALS.md: Wouri laws and ADR log

The decision record. Every law in CLAUDE.md traces to an ADR here. New decisions append; superseded decisions are marked, never deleted. Sources for the regulatory ADRs are in docs/research/.

## ADR log

**ADR-0001. Registry of record, not a marketplace.** Wouri is a system of record whose value is third-party reliance, like a land registry, notary, or classification society. It never takes title, holds money, or lends. This decides every downstream feature. Rejected: marketplace, ERP, traceability-app framings.

**ADR-0002. Three layers by volatility; row not column not branch.** Layer 1 spine (~22 immutable nouns), Layer 2 registry (effective-dated, cited, certainty-flagged reference data), Layer 3 projections (rebuildable). Anything varying by commodity, country, authority, buyer, or year is a row. A change that would alter Layer 1 signals the model is wrong.

**ADR-0003. Append-only custody with client-minted UUIDs.** lot_events has a client-minted uuid primary key (idempotent offline replay), no update or delete policy, per-row provenance (gps accuracy, fix type, offline flag, device, app version, clock delta). Corrections are compensating events. occurred_at is separate from created_at.

**ADR-0004. Per-stream hash chain plus server-signed Merkle checkpoints.** The chain is per lot or device stream, not global (offline devices cannot agree on one predecessor). The server counter-signs at ingest and periodically folds the chain into a signed, published Merkle checkpoint (the Certificate Transparency model) so a third party can verify inclusion and append-only-ness without trusting Wouri. Clock delta is provenance, never part of the hash pre-image as authority. Consider COSE Receipts / IETF SCITT for interoperable receipts. Source: docs/research/05.

**ADR-0005. Effective-dated registry with tstzrange and btree_gist; pack-version pinning.** Each effective-dated row uses a single tstzrange with an exclusion constraint (equality columns first). A consignment pins the pack version it was created under and always validates against that version, never "latest." Source: docs/research/05.

**ADR-0006. RLS is the single isolation gate, hardened.** (select auth.uid()) scalar-subquery wrapping; indexes on policy columns; column GRANTs on integrity fields; authorization from a membership table not JWT metadata; tombstone-aware sync cursor; RLS-on-every-table CI check. Source: docs/research/05.

**ADR-0007. Document bindings; unbound blocks issuance; reproducible issuance.** Every document field records source table/id/column; an unbound field cannot be issued; issuance is idempotent (deterministic content hash) and byte-reproducible (records the resolved pack version and rule rows).

**ADR-0008. Proof not trust: Verifiable Credentials plus anchoring.** Every issued document is a W3C Verifiable Credential 2.0 (a W3C Recommendation since 15 May 2025) in the UN/CEFACT Verifiable Trade Documents envelope, anchored to the ADR-0004 checkpoint, signer bound by a GLEIF vLEI, verifiable offline without contacting Wouri. RFC 3161 timestamping with LTV re-stamping and a second anchor. Source: docs/research/03, 05.

**ADR-0009. Feed government systems, store authoritative references.** Model CAMCIS, e-GUCE (e-BUSINESS and SIAT XML), SIGIF 2, ONCC lab, and EU TRACES as registry-driven integration_connectors. For any artifact a government system legally issues, store its authoritative external reference, never a self-minted substitute. Source: docs/research/02.

**ADR-0010. EUDR.** Applies 30 Dec 2026 (medium and large), 30 Jun 2027 (micro and small); Reg 2025/2650. A dds entity captures the TRACES submission id, reference number, verification number, operator role, and inbound Operator+1 reference. An effective-dated country_risk registry (Cameroon = standard, so full due diligence always) drives obligations. Article 9 legality evidence is separate from forest-loss risk. geometry_basis point_only is allowed only when area_ha <= 4; polygons for larger plots. A lot fails if any contributing plot is unknown or non-compliant (no-mixing). Source: docs/research/01.

**ADR-0011. The dual-rail lot; CITES.** One consignment carries an EUDR rail and a CITES rail. Model the CITES annotation (#17 vs #15 vs #7), not just the appendix; scope species to African populations; a permits object carries the six-month expiry and decrements a quota_ledger that can never go negative; ADR-0009 law 9 (CITES-listed is identity-preserved) is a DB constraint. This intersection is Wouri's category and moat. Source: docs/research/04.

**ADR-0012. No FLEGT gate for Cameroon.** The EU terminated the Cameroon FLEGT VPA on 17 June 2025 and it never reached licensing. Timber clears under EUDR, residual EUTR, and CITES. A hard FLEGT dependency would make every Cameroon timber consignment un-issuable. Source: docs/research/03.

**ADR-0013. Certificate of origin is EUR.1-CMR.** Under the Cameroon interim EPA the proof of origin is the EUR.1-CMR movement certificate or an approved-exporter origin declaration. Not GSP Form A, not REX. Source: docs/research/03.

**ADR-0014. Settlement layer.** A settlement_instrument on the contract (LC / documentary_collection / CAD / advance / open_account), a discrepancy-tracked presentation layer over the document registry (LC first-presentation failure is 60 to 70 percent), and a settlement state machine ending at repatriated. Source: docs/research/06.

**ADR-0015. BEAC 150-day repatriation clock.** A domiciliation record and a 150-day countdown in the spine (start = effective export date; same domiciled bank). Do not hardcode the 35 percent surrender rate (extractive-sector only). Settled means repatriated. Source: docs/research/06.

**ADR-0016. Working-capital records; Wouri never lends.** warehouse_receipt records, reuse of payment_requests for farmer-payment-out and finance-advance-in, and a cash-timeline view. Wouri is the origination file a lender relies on, never the balance sheet, never the matcher. Source: docs/research/06.

**ADR-0017. Real-time all-currency FX plus terminal price.** The fx_rates ledger freezes the rate at every economically-relevant event with source and timestamp (the record); a live feed pulls every currency pair (the projection). A terminal_price reference (exchange, futures month, currency) makes a PTBF differential computable. Start on free ONCC daily reference prices; license ICE later. Source: docs/research/06.

**ADR-0018. Weather hotspots.** Weather attaches to locations, origin_units and routes; a Layer 3 projection flags risk against registry-defined thresholds (weather_risk_rules), feeding the readiness board (a storm on the shipping window is a ranked blocker) and cocoa moisture quality. Free and keyless (Open-Meteo).

**ADR-0019. Typed EAV for quality plus a JSONB projection.** quality_attributes declares key/datatype/unit/range per pack version; quality_values stores exactly one typed value with a matching check. A Layer 3 JSONB projection per lot with a GIN index and partial expression indexes serves reporting. Source: docs/research/05.

**ADR-0020. Anti-spoof trust tier; the server decides.** Never hard-block an honest user; return a trust tier; the server computes on the spheroid. The native field app adds mock-location, rooted-device, and Play Integrity / App Attest detection.

**ADR-0021. Image profiles in the registry.** Capture purpose drives the pipeline (a seal close-up is not a stump photo). Hash the original before any processing; never strip EXIF on evidence; capture guidance in the UI; media on its own resumable queue.

**ADR-0022. Tenant network: three isolation-safe paths only.** Every cross-tenant benefit is a platform-owned common good, an opt-in consent, or an anonymized aggregate (minimum cohort, noise). Neutrality is existential (the TradeLens lesson). Ranked: regulatory registry (1), Wouri Verified mark (2), benchmarking (3), aggregated financing (4), plot commons plus yield-cap ledger (5), counterparty registry plus PSI (6), group consolidation (7), freight restricted to the compliance record (8). Source: docs/research/07.

**ADR-0023. Aza.** Answers operational questions over the tenant's data under the tenant's permissions; drafts but never issues; explains a rule with its citation; finds cross-document discrepancies. Never asserts a compliance status; every answer cites records; never mutates without confirmation and never for issue/submit/sign/transition; runs as the requesting user's identity; degrades to nothing gracefully; says "I do not know" when the registry entry is unverified.

**ADR-0024. No em-dashes.** Inherited from Bazah Law 10. Enforced by the canonicals check.

**ADR-0025. New private repo, copied Bazah substrate, no shared package.** One developer, two products, different deadlines: a shared dependency means a Wouri release can break Bazah at the worst time. Copy the offline event spine, geo, units, money/fx, identity, and the test doctrine.

**ADR-0026. Expo native field app, not PWA.** The 14-day offline requirement, Bluetooth peripherals, and forest-canopy GPS rule out a PWA on iOS.

**ADR-0027. The four sprint gates and the one hard rule.** Every sprint ends on build, e2e sweep, machine self-test, and a Fabrice UAT run. Do not generate the DOCUMENT-ENGINE component specs or start Sprint 1 (the spine) until one real consignment file has been seen. Foundational and peripheral component specs whose design does not depend on the consignment file's document layout (for example onboarding, identity, i18n) may be written earlier.

**ADR-0028. Tenant onboarding is self-serve, capability-first, and chat-or-click, like Bazah.** A tenant creates itself with zero dev, by either path, and the two are equivalent (chat-or-click parity, Bazah ADR-0016):
- **Pick and choose (click):** a capability picker. The tenant toggles what it does (cocoa, timber, EUDR rail, CITES rail, field capture, settlement, financing), and that sets `organization_capabilities` and the registry scope. A short smart wizard (what you export, where to, your role, which port) can pre-select the picker.
- **Communicate (chat):** the tenant describes its business in a conversation ("I export cocoa from Kumba to Rotterdam and some Doussie") and Aza creates the organization, selects the capabilities, sets the registry scope, and seeds the party-bench skeleton from the conversation. Aza builds the tenant, exactly as in Bazah, but keeps its Wouri compliance abstinence (ADR-0023): it sets up, it never asserts a compliance status.
Reuse Bazah's onboarding substrate (business-type picker, capability model, chat-or-click parity). Onboard for time-to-first-proof, not time-to-setup: the front door is an EUDR-readiness assessment (the 30 Dec 2026 wedge), and onboarding is a guided first consignment that reaches a verified document or a caught discrepancy. A tenant INHERITS the platform-owned regulatory registry on day one (the moat) and REUSES platform-owned party identities and already-mapped plots under consent (never re-typing a known cooperative, transporter, or plot). A cocoa-only exporter never sees a CITES or harvest screen. A light identity verification (RCCM, NIU, exporter registrations) progresses `verification_level` and starts the reputation record that later makes the tenant bankable (ADR-0016). Self-serve by default, concierge for design partners. French first, phone-capable. Full spec: docs/components/onboarding/. Source: docs/research/07 + the fleet non-savvy-tenants, smart-onboarding, chat-or-click, and in-app-comms standards.

**ADR-0029. Auth follows the PulSe login standard.** (Supersedes the plan's ImmiReady note.) Supabase Auth for identity; signup atomically creates the organization and its first location through a single SECURITY DEFINER RPC (validate required fields, enforce a unique organization_code, create the org, create the first location, assign the creating user an owner membership, return JSON), so a half-created tenant is unrepresentable. RBAC is org-scoped roles + role_assignments with capability sets as data, not code. A role-login test harness (PulSe's test-role-logins pattern) logs in as every role and asserts each sees exactly its surface, run as part of the e2e sweep. Password reset, email/phone confirm, and session handling reuse PulSe's flows. Full spec: docs/components/identity-auth/. Source: PulSe web/components/auth + database/schema/create_org_signup_function.sql.

## Laws (short form, for grep)
Row not column not branch. No regulatory literal in code. No policy-less table. Append-only custody, compensating events. Unbound field blocks issuance, reproducible. No projection as truth. Proof not trust. Feed government systems. CITES-listed is identity-preserved. Settled means repatriated. Anti-spoof never hard-blocks. Effective-dated with pinning. RLS is the single gate. Cross-tenant benefit is commons, consent, or aggregate. Every negative assertion carries a positive control. No em-dash.
