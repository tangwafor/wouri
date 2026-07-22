# Wouri: Build Plan and Architecture Decisions (v0.1 structural reference)

This is the working reference distilled from the founder's original v0.1 build plan. The full prose narrative is the founder's source document (`wouri-build-plan.md`); drop it in alongside this file to keep the complete version. House style: no em-dashes.

## The rule
Anything that varies by commodity, country, authority, buyer or year is **a row**, never a column, and never a code branch. If a change request would alter Layer 1, the model is wrong and needs generalising.

## Three layers by volatility
- **Layer 1, the spine.** Nouns that will not change in ten years (~22 tables). The levelled base.
- **Layer 2, the registry.** Reference data that changes constantly and is data, not schema. Every row effective-dated. Changing what Cameroon requires is an INSERT, not a migration.
- **Layer 3, projections.** Derived state, rebuildable from the spine, never authoritative.

## Brand
- Wouri is the system of record for an African export consignment: one file, PO to settlement, that produces every document, proves every claim, and can be verified by anyone holding the paper.
- Positioning: a registry of record (land registry, notary, classification society), NOT a marketplace/ERP/traceability app.
- The primary brand surface is a document with a QR code held by a non-customer (customs officer, compliance analyst, bank), and the verification page it resolves to.
- The Wouri Verified mark: a fixed, non-customisable lockup next to the QR and atop every verification page. Worth registering as a certification-style mark at OAPI.
- Visual: institutional, precise, quiet; one serif for documents + one clear sans for the interface (full French diacritics, legible on a photocopy/fax); a single deep saturated anchor colour plus black, white, one alert red; light and dark for the app, documents always light; no illustration/gradient/rounded-playful.
- Naming bilingual, French primary (Dossier d'expedition, Unite d'origine, Lot, Dossier de conformite, Points bloquants). The document engine outputs in whichever language the receiving authority requires (FR-LOC-02, hard rule).
- Voice: plain, specific, never reassuring without evidence. Never "All good" or "You are compliant."

## Stack
- Web console: Next.js 15 App Router, TS, Tailwind, owned shadcn.
- Field app: Expo (React Native), Android + iOS. Native not PWA because iOS Safari evicts IndexedDB after ~7 days and has no background sync; the requirement is 14 days offline, plus Bluetooth peripherals and sustained camera/media.
- Shared core: `packages/core` (types, units, money, fx, geo, validation, event emission).
- Backend: Supabase (Postgres + PostGIS + RLS + Storage + Realtime).
- Offline doctrine (from Bazah): writes never touch the sync engine (emitEvent mints a client UUID, durable local queue, idempotent append_event RPC, replay collapses on the PK); reads are pull-only replication under the user JWT (RLS is the single isolation gate); occurred_at separate from created_at; media on a separate resumable queue.
- Lift from Bazah (do not extract a shared package; copy into a new repo): the offline event spine, geo, units, money/fx, identity/orgs, payment_requests share-code design, the test doctrine.

## Layer 1 spine (~22 tables)
Identity/tenancy: organizations, people, memberships, roles, role_assignments, capabilities, organization_capabilities, organization_groups (+ members).
Parties: parties, party_roles, party_contacts, party_banks (an employee is a party).
Places/origin: locations, origin_units (+ origin_unit_versions, origin_unit_evidence, origin_unit_risk), location_fixes.
Lots + events: lots, lot_events (client-minted uuid PK, append-only, provenance, prev_event_hash + event_hash, NO update/delete policy), lot_lineage (proportional attribution in basis points).
Transformation: transformations (+ inputs, outputs), yield tolerances from the registry.
Consignments: consignments, consignment_lots, consignment_states, contracts, transport_units (+ lots).
Documents: documents (verification_code 26 chars), document_versions (content_hash, field_values), document_bindings (every field records source table/id/column; unbound blocks issuance), document_signatures, verification_scans, anchor_digests (periodic Merkle roots to an RFC 3161 authority).
Compliance: compliance_packs, compliance_items, supplier_due_diligence, permits, quota_ledger (may never go negative).
Costing/tasks: cost_entries (exactly one of consignment/lot/pool), cost_pools, tasks.

## Layer 2 registry (effective-dated, cited, certainty-flagged)
commodities, commodity_packs, hs_codes, units, quality_attributes (+ quality_values typed EAV), grade_rules, transformation_types, document_types, document_dependencies, document_requirements, compliance_regimes, compliance_requirements, species (cites_appendix, export_eligibility), duty_rates, levies, deadline_rules, validation_rules, currencies, fx_rates.
Four rules: everything carries valid_from/valid_to; source_citation + last_verified_at; certainty (confirmed/probable/unverified); no regulatory figure in application code.

## Layer 3 projections
lot_stock, consignment_readiness (the blocking board), traceability_completeness, consignment_margin, document_staleness. Each has a rebuild_*() function.

## Aza (the AI layer)
Answers operational questions over the tenant's data under the tenant's permissions; drafts (never issues); explains a rule with citation; finds the discrepancy. Hard limits: never asserts a compliance status; every answer cites records; never mutates without confirmation and never for issue/submit/sign/transition; runs as the requesting user's identity; degrades to nothing gracefully; says "I do not know" when the registry entry is unverified.

## Build sequence (6 phases, ~28 weeks)
0. Base (3wk) - repo, canonicals, CI, Supabase, identity, orgs, RLS, i18n, tokens, lifted substrate.
1. Spine (4wk) - all of Layer 1 + the regression suite; registry seeded with one commodity.
2. Documents (5wk) - template engine, bindings, dependency graph, versioning, consistency, QR, verification page, anchoring.
3. Consignment (5wk) - state machine, allocation, readiness board, blockers, deadlines, cost ledger, margin. First exporter demo.
4. Field (6wk) - Expo, offline queue, capture, grading, photos, signatures, Bluetooth, polygon capture.
5. Compliance (5wk) - EUDR pack, DDS, plot risk, supplier due diligence, traceability completeness, CITES/quota.
Aza arrives after Phase 3.

## Section-11 decisions (research-informed answers in `artifacts/synthesis.html`)
1. Beachhead: research says cocoa first, timber second and repositioned to processed-wood + compliance (log-export ban).
2. The friend: see one real consignment file before generating the bundle.
3. Expo: confirmed.
4. Aza's name: keep it (your call); keep the compliance-status abstinence absolute.
5. Registry seeding: the moat and the network good; budget real hours.
6. New private repo, copied substrate, no shared package: confirm.
7. Bazah pause: your call; shared standards matter more if it does not.

## TaTech and Outsyd inheritance
Conform to TATECH_STANDARDS.md (all 28 points, a Conformance table). UI-layer render tests mandatory (jest-expo + testing-library for the field app, Playwright for the console). Branding signature, tenant logo on every printed doc (but Wouri-issued export documents carry the Wouri Verified mark, verification URL and hash prefix in the footer, not a vendor motto; decision pending). ui-qa-sweep.mjs (role-aware Playwright walk, fails on console error or 5xx). Anti-spoof: never hard-block an honest user, return a trust tier, the server decides on the spheroid; native adds mock-location/rooted-device/Play Integrity detection. Image capture: profiles in the registry, not one pipeline (a seal close-up is not a stump photo); hash the original before processing; never strip EXIF on evidence; capture guidance in the UI; media on its own queue.

## The research fixes (see docs/research/ and artifacts/synthesis.html)
The seven research tracks add: EUDR dds entity + country_risk + legality evidence + point/polygon gate; Cameroon integration_connectors + missing docs + port scoping; remove FLEGT gate + EUR.1-CMR + VC 2.0 verification + eBL handoff; CITES annotation + population scope + permits + identity-preserved constraint; per-stream hash chain + Merkle checkpoints + JSONB projection + btree_gist + RLS hardening + reproducible issuance; settlement presentation layer + BEAC 150-day clock + working-capital records; the isolation-safe tenant network. Plus the three wow features (self-verifiable, financeable, continuously-verified consignment) and the live FX + weather cockpit.
