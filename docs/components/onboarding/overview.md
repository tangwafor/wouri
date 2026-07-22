# Component: Tenant onboarding (overview)

Traces to ADR-0028. House style: no em-dashes.

## Purpose
Let a Cameroonian exporter create its own Wouri tenant with zero developer involvement, and reach a first proof (a verified document or a caught discrepancy) as fast as possible. Onboard for time-to-first-proof, not time-to-setup.

## The principle
The wrong onboarding asks "configure your organization." The right one asks "let us do your next shipment." Setup is a side effect of doing one real thing.

## Two equivalent paths (chat-or-click parity, like Bazah)
1. **Pick and choose (click).** A capability picker: the tenant toggles what it does (cocoa, timber, EUDR rail, CITES rail, field capture, settlement, financing). A short smart wizard (what you export, where to, your role, which port) can pre-select the picker. The answers set `organization_capabilities` and the registry scope.
2. **Communicate (chat).** The tenant describes its business ("I export cocoa from Kumba to Rotterdam and some Doussie") and Aza creates the organization, selects capabilities, sets registry scope, and seeds the party-bench skeleton from the conversation. Aza builds the tenant, as in Bazah, while keeping its Wouri compliance abstinence (ADR-0023): it sets up, it never asserts a compliance status.

Both paths produce the identical tenant state. Neither is required; a user can start in chat and finish in the picker or the reverse.

## The wedge is the front door
The public entry is an EUDR-readiness assessment (the 30 December 2026 deadline): map one plot, we screen it against the satellite record, show the gap. That assessment starts onboarding; it is not a separate marketing toy.

## What a tenant inherits vs configures
- **Inherited day one, zero effort:** the platform-owned regulatory registry (EUDR rules, CITES listings, duty rates, document requirements). The tenant seeds no rules. This is the moat and the biggest accelerant.
- **Reused with consent:** known parties (cooperative, transporter, inspector, buyer) link to the platform-owned identity skeleton; already-mapped plots reuse the canonical geometry and risk assessment under the holder's consent and the yield-cap ledger. No re-typing known counterparties or plots.
- **Configured, and only this:** the tenant's own organization, team, and party bench.

## Capability gating
The surface is minimal from minute one. A cocoa-only exporter never sees a CITES or harvest screen; a trading house with no plantation never sees a field-capture screen. Gating is driven by `organization_capabilities` set during onboarding.

## The trust dimension (unique to a registry of record)
A tenant's documents carry weight only if the tenant is credible. Onboarding carries a light identity verification (RCCM, NIU, exporter registrations) that progresses `verification_level`. The first verified consignment starts the reputation record that later makes the tenant bankable (ADR-0016). Onboarding plants the reputation flywheel.

## Personas and their aha (the four questions)
- Export manager: the blocker board with their real shipment ranked.
- Documentation officer: generate a full document set, watch a mismatched weight get caught.
- Field agent: capture a plot offline, see it sync.
- Managing director: the margin and the 150-day repatriation clock.

## Delivery notes
Self-serve by default, concierge for the first design-partner exporters. French first, phone-capable. Aza is an accelerator that is never required (chat-or-click parity). This component rides on existing spine tables; it needs no commodity-specific document layout, so it may be built before the document-engine specs (ADR-0027). It slots around Sprint 3 once the consignment pipeline exists, but its capability-gating and registry-inheritance are Sprint 0 and Sprint 1 foundations.

## Success metric
Time from sign-up to first verified document or first caught discrepancy. Secondary: percent of tenants who complete onboarding self-serve without concierge; percent of parties and plots reused vs re-typed.
