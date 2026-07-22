# Wouri CONTINUE.md (session handoff)

## 2026-07-22 - Research and planning complete; nothing built
Wouri is a new project: the trust and credit layer for African commodity export (Cameroon cocoa and timber first), a registry of record, not a marketplace. House style: no em-dashes.

**What exists in this repo (all documentation, no code yet):**
- `docs/build-plan.md` - the v0.1 structural reference (schema layers, brand, stack, phases, section-11 decisions).
- `docs/research/01..07` - seven cited research tracks (EUDR, Cameroon systems, documents/digital standards, CITES/competitors, architecture, finance/settlement, tenant network).
- `docs/delivery/sprint-kanban.md` - six sprints, each ending on four green gates (build, e2e sweep, machine self-test, Fabrice UAT).
- `docs/pitch/investor.md`, `docs/pitch/customer.md`.
- `artifacts/synthesis.html`, `artifacts/sprint-kanban.html`, `artifacts/pitches.html` - the rendered branded versions.
- Published artifacts (claude.ai): synthesis 085c5cbd-312d-4e34-b8e2-de3cdfea25d0; sprint-kanban 48db3304-c02b-4b4f-bdc5-09de9d8cdd30; pitches 929575ed-f0d9-4b1a-9d79-64ba7baf439e.

**The reframe:** build the trust and credit layer. Three wow features: the self-verifiable consignment (W3C VC 2.0 + Merkle checkpoints + vLEI, verify offline without Wouri), the financeable consignment (reputation as collateral; never lends), the continuously-verified consignment (re-screen shipped lots). The category no one serves: the dual-rail lot (EUDR + CITES on one consignment).

**The wedge:** EUDR applies 30 Dec 2026 (large/medium), 30 Jun 2027 (micro/small). No DDS reference number, the container is held at the EU border.

## NEXT (in order)
1. Founder answers the section-11 decisions (research answers most in the synthesis).
2. **See one real consignment file before generating the handoff bundle or starting Sprint 1** (the one hard rule).
3. Generate the section-10 Claude Code handoff bundle with the research fixes and the three wow features folded in as first-class components, then run Sprint 0.

## Open decisions for the founder
- Beachhead: cocoa first (research-recommended) vs timber. The live cockpit (worth-now, margin-now, BEAC clock, weather) as its own surface vs folded into the readiness board. Aza's name shared with Bazah or not. Does Bazah pause.

## Key facts to re-verify at build time (fast-moving)
EUDR dates and amendments; Cameroon FLEGT VPA termination (June 2025); CITES CoP20 outcomes (Dec 2025, delistings rejected); BEAC 150-day repatriation enforcement; the banned-species list (91 as of April 2026); CAMCIS as the live customs system.
