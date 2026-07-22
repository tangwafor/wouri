# Wouri

**The trust and credit layer for African commodity export.** A registry of record for an export consignment (Cameroon cocoa and timber first): one file, from purchase order to settlement, that produces every document, proves every claim, and can be verified by anyone holding the paper, offline, without trusting Wouri.

House style: **no em-dashes** (inherited from Bazah Law 10). Positioning: registry of record, not a marketplace.

Status: **research and planning complete; nothing built yet.** Awaiting the section-11 decisions and one real consignment file before the Claude Code handoff bundle is generated.

## What is in this repo

| Path | What it is |
|------|-----------|
| `docs/build-plan.md` | The original build plan and architecture decisions (v0.1), the source of truth for the three-layer schema, brand, stack, phases, and the section-11 decisions. |
| `docs/research/` | Seven cited research tracks that verified the plan against current 2024-2026 sources (EUDR, Cameroon systems, documents and digital standards, CITES and competitors, architecture, finance and settlement, tenant network). |
| `docs/delivery/sprint-kanban.md` | Six sprints start to finish, each ending on four green gates (build, e2e sweep, machine self-test, Fabrice UAT). |
| `docs/pitch/investor.md` | Investor pitch: 11-slide deck, cited market numbers, competition matrix, three memorable lines. |
| `docs/pitch/customer.md` | Customer pitch: one-pager, elevator version, French version, three demo hooks. |
| `artifacts/*.html` | The rendered, branded versions of the synthesis, sprint Kanban, and pitches (Wouri institutional style). |

## The reframe

The plan builds an excellent registry. The research says build the **trust and credit layer**: a consignment a foreigner can believe and a bank can fund, provably, without anyone having to trust Wouri at all. Three differentiating features fall out of that:

1. **The self-verifiable consignment.** Each document is a W3C Verifiable Credential (a standard since 2025) anchored to a public Merkle checkpoint, verifiable offline without contacting Wouri.
2. **The financeable consignment.** Wouri holds exactly the artifacts a pre-export lender wants, so a verified track record becomes reputation collateral. It never lends or holds money.
3. **The continuously-verified consignment.** Version-pinned satellite data lets Wouri re-screen a shipped consignment and alert a buyer.

The category no single tool serves today is the **dual-rail lot**: one consignment carrying both an EUDR rail and a CITES rail.

## The wedge

EUDR applies **30 December 2026** (medium and large operators), **30 June 2027** (micro and small). Every EU-bound cocoa or wood shipment needs a geolocated Due Diligence Statement and its reference number, or the container is held at the border. This is a hard, dated buying trigger for every serious Cameroon cocoa and timber exporter.

## Next steps

1. Answer the section-11 decisions (see `docs/build-plan.md`; the research answers most of them in `artifacts/synthesis.html`).
2. See one real consignment file before generating the handoff bundle.
3. Generate the section-10 Claude Code handoff bundle with the research fixes and the three wow features folded in as first-class components.
