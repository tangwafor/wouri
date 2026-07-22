# Roadmap: coverage map

What is specified, what is gated on a real consignment file, and where each piece lands in the six sprints. No em-dashes.

## Component specs (docs/components/, seven-file bundles)
| Component | Status | Sprint | Notes |
|---|---|---|---|
| onboarding | Specified | 3 (foundations in 0/1) | chat-or-click, capability-first, EUDR front door (ADR-0028) |
| identity-auth | Specified | 0 | PulSe login standard, atomic org-signup RPC (ADR-0029) |
| capabilities | Specified | 0 | pick-and-choose module system, gates the whole surface (ADR-0028) |
| the spine (parties, origin_units, lots, lot_events, consignments) | **Gated** | 1 | needs a real consignment file first (ADR-0027) |
| document engine (bindings, versioning, dependencies, verification) | **Gated** | 2 | needs the real document layout (ADR-0027); protocol in docs/500-registry |
| consignment pipeline + settlement + cockpit | To spec | 3 | readiness board, BEAC clock, FX + weather cockpit |
| field app | To spec | 4 | Expo, offline queue, polygon capture, anti-spoof |
| EUDR + CITES dual rail | To spec | 5 | DDS, plot risk, permits + quota, continuous re-screen |
| tenant network (registry, mark, benchmarking, financing, plot commons) | Ranked in research | post-launch | isolation-safe, three paths only (ADR-0022) |

## Platform and cross-cutting (docs/300-platform, 200-ai, 500-registry, 100-users)
| Area | Status |
|---|---|
| Users: personas, the four questions, day-30 | Specified (100-users) |
| Aza: scope, hard limits, grounding, resilience | Specified (200-ai) |
| Offline architecture | Specified (300-platform/offline) |
| Security and RLS | Specified (300-platform/security-rls) |
| i18n (interface fr/en + document output language) | Specified (300-platform/i18n) |
| Integrations (feed government systems) | Specified (300-platform/integrations) |
| Verification protocol (proof not trust) | Specified (500-registry/verification-protocol) |
| Registry seeding method (the moat) | Specified (500-registry/seeding-method) |
| Auth standard | ADR-0029 = PulSe |

## The six sprints (see docs/delivery/sprint-kanban.md)
0 Foundation, 1 Spine, 2 Documents, 3 Consignment + money + cockpit (first exporter demo), 4 Field app, 5 EUDR + CITES dual rail (the one-run proof). Each sprint ends on four green gates: build, e2e sweep, machine self-test, Fabrice UAT.

## Decisions log
CANONICALS.md holds ADR-0001 to 0029. The section-11 decisions are answered from evidence in artifacts/synthesis.html; the founder confirms.

## The one hard rule
Do not generate the gated specs (the spine, the document engine) or start Sprint 1 until one real consignment file has been seen. Everything marked Specified above respects that rule because none of it depends on the consignment file's document layout.

## What is left to spec before the bundle is complete (foundational, ungated)
i18n message-catalogue structure detail; the design tokens and the Wouri Verified mark asset; the CI and canonicals check scripts; the Sprint 0 task checklist. All can be written now.
