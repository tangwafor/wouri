# Component: Tenant onboarding (ui)

Traces to ADR-0028. French first, phone-capable, capability-gated, institutional brand (serif documents, sans interface, deep anchor colour, one alert red). Chat-or-click parity throughout. No em-dashes.

## Surfaces

### 1. The front door: EUDR-readiness assessment (public, on wouri.co)
A single question: are you ready for 30 December 2026? One action: drop or draw one plot, we screen it, show the gap in plain language ("this plot is over 4 hectares, so it needs a polygon, not a point" / "no forest loss detected since 31 December 2020"). The result is factual, never "you are compliant." A clear next step: create your tenant to fix the gaps and do the whole shipment. This assessment seeds the first origin unit and starts onboarding.

### 2. Create your tenant: chat or click, side by side
One screen, two equivalent entries the user can switch between at any time:
- **Click:** a capability picker (large toggles with French labels and one-line descriptions: cocoa, timber, EUDR, CITES, field capture, settlement, financing). A short four-question wizard (what you export, where to, your role, which port) pre-selects the toggles. Dependencies auto-enable (choosing timber offers the CITES rail).
- **Chat:** a plain box: "Tell us about your business." The user types or speaks ("I export cocoa from Kumba to Rotterdam and some Doussie"). Aza proposes the tenant (name, capabilities, registry scope, a starter party bench) as a confirmable summary, then creates it on one tap. The user can jump to the picker to adjust.
Both land on the identical tenant. Progress is a resume-anywhere checklist, never a locked linear wizard.

### 3. The guided first consignment (the aha)
"Let us do your next shipment" (or "bring your last rejected shipment"). A click path: add the buyer (reuse a known party if offered, one tap), add a lot, confirm the plots (reuse mapped plots if offered), and Wouri assembles the document set and runs the screen. The readiness board then shows exactly what is missing, ranked, with who owns it and the days left. Generating a document and verifying it offline is the moment the tenant believes.

### 4. The team and the bench
Invite the export manager, documentation officer and field agent (each a role, each a gated view). The field agent gets a link to install the Expo app. Seed the bench by reusing known parties or adding new ones. Everything is optional and skippable; onboarding never blocks on a full bench.

### 5. Identity verification (light, progressive)
Upload RCCM, NIU and exporter registrations when convenient. A quiet status shows the tenant's `verification_level` progressing and explains, plainly, what verification unlocks (a stronger Wouri Verified mark that buyers and banks rely on, and the reputation record that makes you bankable). Never a hard wall on the first shipment.

## UX rules
- Capability-gated: a cocoa-only tenant never sees a CITES or field screen. The picker itself is the only place unused capabilities appear.
- Every workflow has a click path completable by a non-technical person, in French, on a phone, without training (the non-technical rule). Aza accelerates any of them and is required for none.
- Never reassure without evidence: statuses show the concrete fact, not "all good."
- Progressive disclosure: the front door asks one question; depth appears as the tenant opts into it.
- Communicate: in-app messaging (free Supabase Realtime) for the team and, later, counterparties, plus Aza; onboarding help is in-product, not a manual.

## Persona landing after onboarding
Export manager lands on the blocker board; documentation officer on the document set; field agent on the capture screen; managing director on the margin and the repatriation clock.
