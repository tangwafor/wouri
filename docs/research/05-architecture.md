# Research Track 05: Data architecture and data-model validation

Design review of the Wouri schema (Postgres + PostGIS + Supabase RLS, offline event-sourcing). Sources 2023-2026.

Overall: a strong, opinionated design. Three-layer split by volatility, "varying dimension is a ROW not a column not a branch," append-only custody, and trust-tier-not-hard-block are correct. Risks concentrate where the design bets on patterns with sharp edges at scale or under adversarial scrutiny.

## 1. Typed EAV for quality attributes
**Sound.** The `quality_attributes` declaration row (key/datatype/unit/range/pack version) plus a `quality_values` row with a CHECK forcing exactly one of numeric/text/bool matching the declared datatype gives the schema-catalog discipline naive EAV lacks.

**Where it hurts:** N attributes = N inserts + N index passes; full-profile reads need a pivot; COUNT/ORDER/unbounded scans are much slower; cross-attribute constraints leak to `validation_rules` or app code.

**Recommendation (hybrid):** keep typed EAV as the system of record (auditable, pack-versioned, provenance per value). Add a JSONB projection column (Layer 3) per lot/consignment holding the current denormalized quality map, rebuilt from `quality_values`, with a GIN index (`jsonb_path_ops`) for "find lots matching predicate." For high-cardinality numeric attributes you filter/sort on, add partial expression indexes (`... ON quality_values (numeric_value) WHERE attribute_id = <moisture>`). JSONB update rewrites the whole row, so the projection is write-on-rebuild, not hot-path mutated. Sources: Evolveum JSONB-vs-EAV benchmark; razsamuel.com.

## 2. Event sourcing + client-minted UUID + hash-chain
**Sound.** Client-minted UUID as the idempotency key is the correct offline-first pattern; no update/delete policy on `lot_events` matches the canonical rule; occurred_at vs created_at is right; rich provenance is model behavior.

**Traps:**
- **Hash-chain vs offline reordering:** a single global `prev_event_hash -> event_hash` chain is a total order; concurrent offline devices cannot agree on one predecessor. **Chain per lot (or per origin_unit/device stream), not one global chain.** Cross-stream ordering belongs to a Lamport/vector clock or the server receive sequence.
- **Client-computed hash proves little alone:** an attacker with the device can rewrite a consistent chain. Add a **server-side counter-signature at ingest**: append to a server per-tenant chain and sign the running head (Ed25519).
- **Third-party verifiability requires batched Merkle + published checkpoints, not a bare chain.** Periodically Merkle-batch the server chain into a signed tree head / checkpoint and publish/anchor it (the Certificate Transparency amortization). This yields inclusion and consistency proofs. Make proof artifacts vendor-neutral and exportable (QLDB discontinuation cautionary tale). Consider COSE Receipts / IETF SCITT.
- **Clock skew must never enter the hash pre-image as authority.** Keep clock_delta as provenance; link the chain on server-assigned sequence + payload hash; validation uses occurred_at reconciled to server receive time with the delta flagged.
- **Add snapshots.** Past ~1,000 events per lot, naive replay exceeds ~100ms; plan periodic snapshot rows (Layer 3).

## 3. Effective-dated / bitemporal registry
**Sound and central.** Pinning a consignment to the pack version it was created under separates valid time from decision time. Keep both.
- Model each effective-dated row with a single range column (`valid_at tstzrange`), not loose from/to scalars.
- Enforce "one active row per (commodity, country, authority, key) at any instant" with an EXCLUDE constraint requiring **btree_gist**: `EXCLUDE USING gist (commodity_id WITH =, ..., valid_at WITH &&)`. On PG18/19 use `PRIMARY KEY (..., valid_at WITHOUT OVERLAPS)`.
- Column order in the GiST index matters for performance: high-selectivity equality columns first, the range last.
- For bitemporal, prefer pinning by `pack_version_id` FK to immutable versioned rows (simplest) over a second range.
- **Trap:** effective-dated lookups are only fast if every query carries the as-of predicate and hits the GiST index. Enforce in code that registry reads resolve through the pinned version, never "latest."

## 4. RLS as the single isolation gate + pull replication
**Sound in principle**, but "single gate" raises the stakes.
- Wrap every auth/current_setting call in a scalar subquery: `USING ((select auth.uid()) = ...)` or the policy re-runs per row (5ms -> 5s on 100k rows). Same for auth.jwt(), auth.role(), current_setting(). Watch the `auth_rls_initplan` advisor.
- Index the columns policies filter on (tenant_id, lot_id, party_id).
- Never authorize from JWT user_metadata (user-writable); use app_metadata or a DB membership table.
- Combine RLS with column GRANTs: RLS filters rows but does not stop a client writing a column it should not (tenant_id, event_hash, prev_event_hash, provenance). `GRANT INSERT (...safe columns...)`. For lot_events: clients INSERT append-only rows but never UPDATE/DELETE and never set server-computed integrity fields.
- **Replication completeness is a correctness risk:** a row that later becomes visible may never be pulled; a now-invisible row stays cached. Design the sync cursor on a monotonic server sequence / updated_at that RLS lets through, with explicit tombstones. Verify RLS returns 0 rows to anon and to a wrong-tenant JWT (probe as the actual foreign role, not postgres). CVE-2025-48757: 10.3% of AI-built Supabase apps shipped public-readable tables; keep the RLS-on-every-table CI check.

## 5. Structurally missing for a system of record
- **Registry audit (Layers 2/3):** `document_types`, `duty_rates`, `validation_rules`, pack versions, party records are legally consequential and mutable-ish. Add an append-only `registry_audit` (or make registry changes event-sourced), capturing actor, timestamp, before/after.
- **Correction semantics:** use compensating events, never soft-delete flags. A `deleted_at` on lot_events reintroduces mutability and breaks the hash chain. Define named correction event types (e.g. custody_event_voided, quality_value_superseded) pointing to the event they compensate.
- **Document generation idempotency:** `document_bindings` is strong; add idempotent issuance (deterministic content hash over resolved bindings + pack_version + consignment, unique constraint) plus a client-minted issuance UUID; record which pack version and which effective-dated rule rows were resolved at issuance so a regenerated document is byte-reproducible.
- **Projection rebuild determinism:** events applied in a defined order (server sequence per chain, occurred_at tiebreak, not created_at wall clock); projection logic versioned; rebuilds do not re-trigger external side effects; add a projection checkpoint (last-applied sequence + handler version + state hash).
- **Snapshots** (as above).

## Bottom line
- **Keep as-is:** three-layer split; row-not-column-not-branch; append-only custody with client-minted UUIDs; occurred_at vs created_at; trust-tier; document_bindings; pack-version pinning.
- **Highest-priority changes:** (1) per-lot/device hash chain + server counter-signed chain + periodic signed Merkle checkpoints; (2) JSONB quality projection with GIN + partial expression indexes; (3) btree_gist EXCLUDE (or WITHOUT OVERLAPS) on a single range column, equality-first; (4) harden the single RLS gate ((select auth.uid()), column GRANTs, DB-membership auth, tombstone-aware sync cursor); (5) registry audit, compensating-event corrections, idempotent reproducible document issuance, projection checkpoints/snapshots.
