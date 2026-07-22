# Wouri: Delivery Plan and Sprint Kanban

Roughly 28 weeks across six phases. The rendered board is `artifacts/sprint-kanban.html`. No em-dashes.

## The definition of done, every sprint (four gates)
Nothing moves to the next sprint until all four are green. Three of the four are living artifacts that grow with the product.
1. **Build green** (`check-canonicals.mjs` + `tsc`): typecheck, migrations apply clean, no regulatory literal in code, no policy-less table, no unbound document field, no em-dash.
2. **End-to-end sweep** (`ui-qa-sweep.mjs` + `jest-expo`): the whole app walked as each role at phone size, screenshotted, asserting real behaviour; fails on any console error or 5xx; tenant B sees none of tenant A.
3. **Machine self-test** (`wouri-selftest`, in-DB): core flows in rollback subtransactions + RLS probes as anon and wrong-tenant JWT; grows one flow set per sprint.
4. **Fabrice UAT** (tester portal + `qa_live_triage`): a human walks the new sprint on dev-backed staging, submitting pass/fail into a realtime feed the build agent watches and fixes. Reuses the Human Test Suite standard.

A fifth soft gate: the **pitch touchpoint** (each sprint firms one deck part and one customer-pager line).

## The sprints

### Sprint 0 - Foundation (Phase 0 Base, weeks 1-3)
Ships: a repo that boots, logs in, isolates a tenant, speaks fr/en.
- Repo + rails (CLAUDE.md, CANONICALS + ADR log, CI, Supabase, Wouri design tokens).
- Lifted Bazah substrate: event spine, units, geo, money, fx, identity, orgs.
- Identity + tenancy: orgs, memberships, roles, RLS deny-by-default, organization_groups from the start.
- Regulatory registry skeleton (platform-owned), effective-dating via tstzrange + btree_gist. [network good]
- E2E: login each role; anon 0 rows; tenant B sees nothing. Self-test: the harness baseline. Fabrice: see only your org. Pitch: deck skeleton + French headline.

### Sprint 1 - The spine (Phase 1 Spine, weeks 4-7)
Ships: the 22-table base, append-only and tamper-evident, seeded with cocoa.
- Spine: parties, locations, origin units (+ versions, evidence), lots, lot_events (client-minted UUID, append-only, per-stream hash chain + server counter-signed checkpoint), lineage, transformations, consignments, contracts, cost entries, tasks. [architecture fix]
- Dual-rail foundations: origin_claim enum; CITES-listed cannot be mass-balance. [moat]
- Registry v1 (cocoa); registry audit; compensating-event corrections.
- E2E: attack each table as anon + tenant B; lot_events rejects UPDATE/DELETE; hash chain verifies. Fabrice: create origin unit, record a lot event, cannot edit history. Pitch: Problem + Why-Now with cited numbers.

### Sprint 2 - The document engine and proof (Phase 2 Documents, weeks 8-12)
Ships: a document anyone can verify offline; an unbound field cannot be issued.
- Engine: template + bindings (unbound blocks issuance), conditional dependency graph, versioning, cross-document consistency, idempotent reproducible issuance by content hash.
- Proof not trust: each document a W3C Verifiable Credential anchored to a signed Merkle checkpoint, signer bound by vLEI, verifiable offline; the verification page. [Wow 1]
- Cameroon document set: EUR.1-CMR, phyto reference, VGM, quality certificate. No FLEGT gate.
- E2E: mismatched weight caught; unbound field blocks issuance; QR verifies offline; revoked reads revoked. Fabrice: generate a set, verify offline, break a weight. Pitch: proof-not-trust slide + offline-verify hook.

### Sprint 3 - The pipeline, the money, the cockpit (Phase 3 Consignment, weeks 13-17)
Ships: the morning blocker board, the settlement spine, the live cockpit. **First exporter demo at end of sprint.**
- Pipeline: consignment state machine, allocation, readiness board (ranked blockers with owner + age), deadlines, cost ledger, margin.
- Settlement: settlement_instrument, discrepancy-tracked presentation, state machine ending at repatriated, BEAC 150-day clock + domiciliation. [settlement fix]
- Live cockpit: real-time FX feed + terminal price + weather hotspots on the readiness board. [your ask]
- Financeable consignment: warehouse receipt, financing consents, cash timeline. Records, never lending. [Wow 2]
- E2E: blockers rank; a discrepancy blocks "paid"; the BEAC clock counts; cockpit shows worth/margin/clock; weather flags a window. Pitch: full deck for first investor conversations.

### Sprint 4 - The field app (Phase 4 Field, weeks 18-23)
Ships: a native app that captures a felling with no signal and never loses it.
- Expo + offline queue (Bazah): purchase capture, intake, grading, photos, signatures, Bluetooth peripherals.
- Origin-unit polygon capture; anti-spoof returns a trust tier; the server decides on the spheroid.
- Image profiles from the registry; media on a separate resumable queue; original hashed before processing.
- E2E: jest-expo render tests; 14-day offline write never lost; replay idempotent; media never blocks a row. Fabrice: airplane-mode capture, sync later, see it in the console.

### Sprint 5 - EUDR and CITES, the dual rail complete (Phase 5 Compliance, weeks 24-28)
Ships: a cocoa-and-Doussie consignment that clears both rails, with a verified file a Hamburg desk believes.
- EUDR pack: DDS + TRACES reference, plot risk vs JRC GFC2020 (version-pinned) + GFW, legality evidence (Art 9), country_risk registry (Cameroon standard), traceability completeness.
- CITES rail: permits (6-month expiry) + quota decrement, annotation + population scope, identity-preserved constraint. [moat]
- Continuous verification: re-screen a shipped consignment on a new dataset, alert the buyer. [Wow 3]
- Integration connectors (CAMCIS, e-GUCE, SIGIF 2, ONCC, TRACES) storing authoritative external references.
- E2E: point-only over 4 ha rejected; DDS assembles with a reference number; quota cannot go negative; re-screen alert fires. **Milestone: the one-run proof** (the sweep walks the whole product as every role, both rails, the money, tenant isolation, in one pass).

## Post-launch backlog (the network turns on)
Anonymized benchmarking; aggregated financing (opt-in permissioned reads); shared plot commons (holder consent + yield-cap ledger); counterparty registry (reciprocal factual attestations + PSI); group consolidation; second origin and second commodity.

## Where the pitches live
Investor and customer pitches are companion documents (`docs/pitch/`), growing on the pitch touchpoint: the customer headline from Sprint 0, demo hooks as features land, the investor deck complete and demonstrable by the Sprint 3 first-exporter milestone, the dual-rail proof by Sprint 5.

## The one hard rule
Do not generate the Claude Code handoff bundle, and do not start Sprint 1, until one real consignment file has been seen.
