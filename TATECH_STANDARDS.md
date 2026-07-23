# TaTech App Signature: Wouri conformance

How Wouri meets the TaTech build standards, with the evidence for each. Status is
honest: Met, Partial (working but not complete), or Roadmap (mechanism exists or is
planned, not finished). No em-dashes.

Run the machine gates: `npm run gates` (canonicals, RLS coverage, security, stress)
plus `npm run test:db` (every self-test) and `npm run gate:ui` (the render sweep).

| # | Standard | Status | Evidence |
|---|----------|--------|----------|
| 1 | Works end to end (full UI walkthrough is the regression proof) | Met | `gate:ui` drives login + home/lots/consignments/cockpit/board/inbox; `docs/delivery/fabrice-uat-full.md` (plot to payment) |
| 2 | Verified-done gate (real clicks + DB smoke + build, not curl 200) | Met | 20+ self-tests against `wouri-dev`, `gate:ui`, `next build`; each commit ran them |
| 3 | No em-dashes | Met | `check-canonicals.mjs` hard failure on U+2014/U+2013 |
| 4 | No hardcoding (policy/price/copy DB-backed, owner-editable) | Met | `registry_config` + `cfg_num`; board windows, weight tolerance, area cap, max yield are rows; literal gate is a hard failure |
| 5 | RLS deny-by-default, tenant-scoped | Met | `rls-coverage.mjs` (every reachable table has RLS); every self-test asserts tenant isolation + anon-denied |
| 6 | RBAC gates mutations | Partial | org-admin gates on brand, revoke, group, config; platform-admin on KB + auto-checks. Full per-role matrix is Roadmap |
| 7 | Security check (anon surface, secrets, definer views) | Met | `security-check.mjs`: RLS coverage, deny-all secrets/chain/audit, anon-reference allowlist, no definer views |
| 8 | Stress / concurrency | Met | `stress-test.mjs`: quota never over-drawn under 20 racing debits; chain contiguous under 15 concurrent appends |
| 9 | UI render tests (Playwright) mandatory | Met | `gate:ui` (Playwright over public + operator pages, no uncaught error) |
| 10 | Tenant isolation proven (positive controls) | Met | each self-test creates a second org and asserts it cannot read the first |
| 11 | Docs as we go | Met | `docs/` (research, training, delivery, ADRs 0001-0042), updated with each patch |
| 12 | Branded printable documents (logo, timestamp, location, e-signed) | Met | `/v/[code]` branded e-signed certificate (Ed25519, timestamp, place, QR); human `signatures` add signer + method + time + location |
| 13 | Default languages (FR first, EN) | Met | `i18n.ts` fr default + en, switchable per user |
| 14 | Dev/prod architecture, dev-first | Partial | all work on `wouri-dev`; production project not yet provisioned |
| 15 | Observability / auto-checks | Met | `auto_checks` engine (0028) + notifications (0027) + `/inbox` real-time |
| 16 | Proof, not trust (verifiable + anchored) | Met | W3C VC + Ed25519 (0013), offline verify; Merkle checkpoint anchoring + inclusion proof (0038) |
| 17 | Offline resilience (no single point blocks the tenant) | Met | Aza local inference + bundled KB; cockpit cache fallback; field queue; media original hashed before processing |
| 18 | Registry effective-dated, reproducible | Met | tstzrange + btree_gist on settlement_rules, origin versions, registry_config; `registry_audit`; reproducible document issuance |
| 19 | Anti-fraud on the origin (server decides) | Met | PostGIS server-computed area/centroid/validity (0035); overlap, self-intersection, protected-area, point-over-cap as auto-checks |
| 20 | The moat is enforceable (CITES + mass balance) | Met | `quota_ledger` never negative (0036); transformation mass balance (0037) |
| 21 | EUDR compliance record | Partial | Article 10 risk record per plot (0040); DDS reference captured; TRACES filing + polygon capture in the field are Roadmap |
| 22 | Human attestation layer | Met | `signatures` (0039): producer thumbprint, driver, supervisor, sealed into the lot chain |
| 23 | Media discipline (profiles, hash original first) | Met | `image_profiles` registry + `record_media_asset` requires the original hash (0041, ADR-0021) |
| 24 | Bug becomes a permanent guard | Met | the phyto place-of-origin bug is fixed and guarded by a positive-control test; the literal-gate hole and the RLS hole each became a gate |
| 25 | Tenant-of-tenants (group certification) | Partial | `organization_groups` skeleton with consented membership (0031); shared group certificate is Roadmap |

## Known gaps (roadmap, not blocking)

- Field-app boundary polygon capture (server already computes area from a polygon).
- Real CITES quota figures and protected-area boundaries (mechanisms enforced; data is a sourced import).
- The TRACES DDS filing itself, GUCE single-window integration, EORI, and the rest of the GUCE document set (each is now binding rows, not code).
- Full per-role RBAC matrix and a production Supabase project.
- A real consignment file to reconcile the document bindings against (ADR-0030).
