# Wouri CONTINUE.md (session handoff)

## Infrastructure
- **Supabase dev project: `wouri-dev`** created 2026-07-22, ref **`iledioojfggozfzebafs`**, org TA-TECH (ztmoyoyidphoifjduktn), region **eu-central-1 (Frankfurt)**. Env (ref, DB password, URL, anon + service keys) saved to `wouri/.env.local` (gitignored, never committed). URL: https://iledioojfggozfzebafs.supabase.co. To drive it via MCP, add a `supabase-wouri` MCP server for this ref (or use the Management API with the fleet token). This clears one of the two Sprint 0 blockers; the other is the green light to copy the Bazah substrate.

## Domain
**wouri.co** registered on Namecheap 2026-07-22 (active through 2027-07-22, domain privacy on). This is the home of the public verification page, the most-viewed Wouri surface (a document held by a non-customer resolves its QR here). Plan the verification route now: a public `wouri.co/v/{verification_code}` (or `verify.wouri.co`) that resolves through a SECURITY DEFINER function and renders the Verifiable Credential, plus per-tenant `verification_subdomain` on organizations for a tenant-branded verify page. The verification page gets the same design investment as the dashboard.

## 2026-07-22 - Sprint 0 database foundation LIVE + verified on wouri-dev
Migrations 0001-0007 applied to wouri-dev (identity, orgs, roles, memberships, event spine, capabilities, currencies/fx/units, the PulSe atomic create_organization RPC, RLS deny-by-default). `scripts/wouri-selftest.mjs` = **19/19 green** (RLS isolation with positive controls, atomic signup, tenant A cannot see B, capability gating, self-cleaning). `scripts/apply-migrations.mjs` is the idempotent runner (uses SUPABASE_DB_URL in .env.local). packages/offline lifted from Bazah (@wouri/offline, event queue only); packages/core (money/fx/units); brand/tokens.css. check-canonicals clean. Run: `node scripts/apply-migrations.mjs` then `node scripts/wouri-selftest.mjs`.
- **Sprint 0 REMAINING (ungated, needs no consignment file):** scaffold apps/console (Next.js 15) + apps/field (Expo) UIs; the login + signup + capability picker + chat-onboarding screens; CI wiring; fr/en message catalogues; the e2e sweep (ui-qa-sweep) + Fabrice UAT gate. NOTE: local Next/Expo builds fail on this Windows machine (corepack/symlink/shell), so build-verify via Netlify cloud or a Linux box, like akongne.
- Then, with ONE real consignment file: Sprint 1 (the spine) + Sprint 2 (the document engine).

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
