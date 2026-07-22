# Component: Tenant onboarding (data model)

Traces to ADR-0028. Sketches show intent and load-bearing constraints, not final DDL. All tenant tables are RLS deny-by-default. No em-dashes.

## Touched spine tables (from Layer 1)
```
organizations        (extended for onboarding)
  status enum: draft | onboarding | active | suspended
  verification_level enum: unverified | self_declared | documents_submitted | verified
  verified_at, verification_subdomain
  legal_name, rccm, niu, exporter_registrations jsonb
  base_currency (fk currencies), default_locale (default 'fr'), brand jsonb
  claim_token text (nullable; for a concierge-provisioned tenant to claim)
  created_from onboarding_channel: self_serve_click | self_serve_chat | concierge

organization_capabilities   organization_id, capability_key, enabled_at, enabled_by
capabilities                key                       -- the pick-and-choose menu (below)

people / memberships / roles / role_assignments       -- the first user becomes owner
parties + party_roles + party_contacts + party_banks  -- the tenant's bench
```

## New onboarding-specific tables
```
onboarding_sessions
  id, organization_id, channel (click|chat|concierge), locale,
  current_step, answers jsonb (the four wizard questions + free notes),
  completed_at, first_consignment_id (nullable), created_at, updated_at
  -- drives resume-anywhere; a projection view derives percent-complete

invitations
  id, organization_id, email_or_phone, role_key, invite_token (26-char, ADR-0033-style),
  invited_by, accepted_at, expires_at
  -- a member joins by presenting the token; join is idempotent on the token

identity_verifications
  id, organization_id, kind (rccm|niu|exporter_registration|other),
  reference, document_id (fk documents, the uploaded proof), status
  (submitted|accepted|rejected), reviewed_by, reviewed_at, note
  -- accepting one or more advances organizations.verification_level

capability_catalog  (platform-owned reference, effective-dated)
  capability_key, label_fr, label_en, category, requires_capability_key nullable,
  default_for_vertical text[], description_fr, description_en
```

## The capability menu (pick and choose)
Seeded platform-owned rows, French-first labels. Toggling a capability writes an `organization_capabilities` row and widens the registry scope and the visible surface.
- `commodity.cocoa`, `commodity.timber`, `commodity.other`
- `rail.eudr` (implied when any EUDR commodity + EU destination), `rail.cites` (implied when timber)
- `field_capture` (the Expo app; producers and cooperatives)
- `settlement` (documentary flow, discrepancy tracking, BEAC clock)
- `financing` (warehouse receipts, cash timeline; ADR-0016)
- `groups` (holding / cooperative-of-cooperatives; ADR-0002)
Dependencies live in `capability_catalog.requires_capability_key`, so the chat and the picker enforce the same graph.

## What is inherited, not stored per tenant
The regulatory registry (Layer 2) is platform-owned. Onboarding does NOT copy rules into the tenant; it sets the tenant's `organization_capabilities` and the tenant reads the shared registry filtered by its scope (ADR-0002, ADR-0022). A cocoa exporter with an EU destination immediately resolves the EUDR requirement rows without seeding anything.

## Reuse under consent (never re-typing)
```
party_link_consents   party_id, requesting_org_id, granted_by, scope
                      (identity_only | contacts | banks), granted_at, revoked_at
plot_source_consents  origin_unit_id, sourcing_org_id, holder_party_id,
                      granted_at, revoked_at
```
- A shared party is the platform-owned identity skeleton; a tenant links to it, seeing only what the consent scope allows. Overlap is discovered by Private Set Intersection so a tenant does not reveal its full counterparty book (ADR-0022).
- A shared plot reuses the canonical geometry + latest `origin_unit_risk`; the cross-tenant `yield_cap_ledger` (defined with the plot commons component) accounts aggregate declared volume so reuse cannot enable EUDR declaration-in-excess.

## Constraints
- The first membership created for an organization has an owner/admin role (bootstraps RBAC).
- `verification_level` only advances via an accepted `identity_verifications` row (never set directly by the client; a column GRANT keeps it server-only, ADR-0006).
- `organization_capabilities` writes are gated to owner/admin (permissions.md).
- Effective-dating applies to `capability_catalog` (the menu can change over time) via tstzrange + btree_gist (ADR-0005).
- `onboarding_sessions.answers` is free-form jsonb but never a source of regulatory truth (ADR-0002).
