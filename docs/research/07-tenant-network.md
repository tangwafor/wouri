# Research Track 07: Tenant network effects without breaking isolation

How tenants (exporters) benefit from each other and the platform, given strict deny-by-default RLS. Sources 2022-2026.

Framing: for a registry of record the value is not hoarded data (AI commoditizes that), it is the audit trail a third party relies on. The durable vertical-SaaS moats are compliance anchoring, transaction embedding, and the multi-party collaboration graph. Sourcemap already markets itself in Wouri's language ("the trusted system of record for supply chain mapping data ... that procurement leaders and customs authorities require").

## Part A: what genuinely works

### A1. Data network effects in registries / compliance utilities
- **Works: a neutral, participant-governed, open-standard common good.** Negative case: **TradeLens** (IBM/Maersk) spent USD 100M+, tracked ~4B events, 36M+ documents, 70M+ containers, yet shut down in 2022 because competitors were asked to share sensitive data with a platform owned by a direct competitor; smaller participants had no governance voice; proprietary standards created lock-in. A governance failure, not a technology one. The survivor is DCSA (a neutral non-profit publishing open standards, not owning data). Sources: Supply Chain Dive 2022; Frontiers in Blockchain (Ostrom's commons) 2025.
- **Hype to discount:** "we have lots of data therefore a moat." AI flattens accumulated-integration and template moats; only proprietary, provenance-verified data plus governed audit trails hold value.
- **Credit bureaus / KYC utilities: reciprocity is the engine.** Closed user groups governed by Principles of Reciprocity (contribute on the same basis to access), administered by an industry steering committee (SCOR). KYC utilities pool CDD but work only with clear consent and repository governance.

### A2. Two-sided trust networks (a private "verified" mark credible to a foreign auditor)
- **Separate the standard-setter from the auditor** (FSC does not audit against its own standard; independent accredited bodies do). Recognized/acted on by 55-76% of buyers.
- **A certificate is worth what third parties agree to rely on** (a classification society's certificate; P&I insurers require IACS class). This is the exact economic structure of "Wouri Verified."
- **A root-of-trust plus accredited issuers, cryptographically verifiable anywhere** (GLEIF vLEI: GLEIF root, Qualified vLEI Issuers accredited, verify "anywhere, without intermediaries"; the World Bank SME-finance use case removes expensive aggregation services).
- **Interoperability, not platform capture, unlocks the network** (eBL adoption ~1.2% in 2021, ~11% by mid-2025 because siloed platforms required all participants on one provider; DCSA's 2025 interoperable transfer unlocked ~USD 6.5B).
- **Cross-border reliance is built on shared standards plus reciprocal audits** (AEO mutual recognition).

### A3. Privacy-preserving techniques
- Anonymized benchmarking: k-anonymity (blend into a group of at least k; often implemented as aggregation + a minimum threshold); differential privacy (calibrated noise on the aggregate output, used with aggregation). A 2026 cohort-analytics framework: minimum cohort k_min of 50-200, approximate quantiles for robust percentile benchmarks, a Laplace mechanism. Sources: IAB Tech Lab Differential Privacy Guidance 2024; arXiv 2601.12105 (2026).
- Counterparty matching without disclosure: Private Set Intersection (learn only the intersection); Authorized PSI (APSI) requires each element authorized by a mutually trusted authority (right when a central registry vouches). Salted hashes decouple a stored hash from the personal data. Homomorphic-encryption/SMPC (Duality) for AML consortia.

### A4. EUDR plot reuse and the double-counting trap
A single DDS can cover multiple suppliers/buyers/plots only when they share consignment, operator of record, country-risk class and fully verified plot data. Platforms map plots once and reuse them (Koltiva 1.9M+ producers; Ferrero ~230,000 supplier polygons). Trap: "declaration in excess" (declaring more plots than sourced) is strongly discouraged and enables laundering unless yield-limit/plausibility checks are enforced. A shared plot must be governed by a cross-tenant volume cap.

### A5. Aggregated financing (well-precedented in Africa)
Warehouse-receipt and pre-export finance are mainstream: collateral packages of warehouse receipts, offtake contracts, SGS inspection, controlled collection accounts (Financely, FAO, Vicage). Binding constraints: licensed/insured/inspected warehouses, robust grading, legal recognition of receipts. A verified, permissioned data feed removes the underwriting friction the vLEI SME-finance case describes.

### A6. Freight/container pooling (the marketplace-drift risk)
Groupage/LCL is shared container space with proportional cost, with a real compliance coupling (an error in one of twenty shipments delays clearance for all twenty; denied-party screening covers the whole container). This is a coordination/transaction function, where a registry starts to look like a marketplace or freight broker.

## Part B: Wouri design per mechanism (four buckets)
Platform-owned registry row / opt-in consent row / anonymized Layer-3 projection / new spine.

| # | Mechanism | Construct | Bucket | Guardrail |
|---|---|---|---|---|
| 1 | Regulatory rules registry | platform-owned versioned reference tables | platform-owned | zero tenant data; SELECT to all authenticated; writes platform-only. One verified rule benefits every tenant. |
| 2 | "Wouri Verified" mark | attestation/verification ledger; verifier role separate from exporter; exportable VC verifiable off-platform | spine + platform-owned governance | the verified tenant never audits itself; portable so counterparties verify without joining Wouri |
| 3 | Anonymized benchmarking | Layer-3 materialized projections over all tenants | anonymized | emit only when cohort >= k_min (start 50), suppress small cells, Laplace noise, percentile bands not values; never row-level |
| 4 | Aggregated financing | `financing_consents` grant table (exporter authorizes lender X to read record Y for window Z) | opt-in | open-banking-style permissioned read; Wouri provides the verified record, never originates or matches |
| 5 | Shared origin/plot reuse | platform/farmer-owned canonical geometry + risk; `plot_source_consents`; a cross-tenant yield-cap ledger | commons + opt-in + spine | holder consent per link; the yield-cap ledger accounts aggregate declared volume (not who sources), blocking double-counting; exporters see only "capacity remaining" |
| 6 | Shared counterparty registry | canonical identity skeleton; reputation from opt-in reciprocal FACTUAL attestations (verified/disputed events, not scores) | platform-owned identity + opt-in; PSI/APSI | reciprocity gate (contribute to read), right-of-reply, hashed matching |
| 7 | Group/holding consolidation | `organization_groups` tenant-of-tenants + shared group certificate | opt-in membership | explicit consented membership; FSC group-certification precedent |
| 8 | Consolidated DDS (not freight brokering) | record a multi-operator consolidated consignment + shared DDS | opt-in | record the compliance submission; do not match cargo or book freight |

**Cross-cutting neutrality guardrail (the TradeLens lesson):** contributions flow only if Wouri is, and is seen to be, neutral (participant-visible governance, open standards, no ownership/favoritism toward any exporter or trader).

## Part C: ranked shortlist
1. Regulatory rules registry (platform-owned common good). Highest leverage, lowest risk. The core moat.
2. "Wouri Verified" two-sided mark with independent-verifier separation and a portable/interoperable credential. This IS the product.
3. Anonymized benchmarking (Layer 3, min-cohort + noise).
4. Aggregated financing via opt-in permissioned data to lenders. Never lend or match.
5. Shared plot/origin reuse with holder consent + cross-tenant yield-cap ledger (do not ship without the ledger).
6. Shared counterparty registry with reciprocal factual attestations + PSI (highest governance/liability risk; sequence after the reciprocity/consent engine exists).
7. Group/holding consolidation.
8. Freight/container pooling: lowest strategic leverage, highest positioning risk. Restrict to recording the shared DDS / consolidated-consignment compliance artifact.

### Positioning conflicts ("registry of record, not marketplace")
- Freight pooling / consolidation booking -> marketplace drift. Keep only the compliance-record slice.
- Counterparty reputation as subjective scores -> rating-agency liability. Keep it to factual events with reciprocity and right-of-reply.
- Aggregated financing origination/matching -> marketplace drift. Provide permissioned data; never match borrower to lender.
- Every cross-tenant benefit resolves to exactly one of: platform-owned commons, opt-in consent row, or anonymized aggregate. There is no fourth path.
