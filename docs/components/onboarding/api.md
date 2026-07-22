# Component: Tenant onboarding (api)

Traces to ADR-0028. Server actions / RPCs run as the requesting user's identity so RLS is the single gate (ADR-0006, ADR-0023). Security-definer functions are used only where a controlled cross-boundary read is required, and each takes no caller-supplied identity. No em-dashes.

## Actions

### startOnboarding(input)
`{ legal_name, locale='fr', channel }` -> creates organizations(status=draft) + first membership(owner) + onboarding_sessions. Emits org.created, onboarding.session_started. Returns { organization_id, session_id }.

### suggestCapabilities(session_id)
Reads session.answers (the four questions) and returns the recommended capability set from `capability_catalog.default_for_vertical`, plus the dependency graph. Pure suggestion; sets nothing.

### setCapabilities(organization_id, capability_keys[])
Owner/admin only. Writes/removes organization_capabilities, enforcing `requires_capability_key`. Emits capability.enabled/disabled and org.vertical_set. Idempotent (setting the same set is a no-op). This is the pick-and-choose write; the wizard and the chat both call it.

### onboardFromConversation(session_id, message)
The chat path. Aza parses the message, then calls the SAME primitives (startOnboarding if new, setCapabilities, createParty, inviteMember) under the user's identity. It never calls a compliance-assertion path. Returns a structured plan the user confirms before any mutation (ADR-0023: never mutate without explicit confirmation). Produces the identical tenant state as the click path.

### inviteMember(organization_id, email_or_phone, role_key)
Owner/admin only. Creates invitations(invite_token). Emits member.invited. Returns the shareable invite link (per-tenant, and, once set, the verification_subdomain).

### acceptInvite(invite_token, person)
Public, idempotent on the token. Creates membership + role_assignment; emits member.joined. Wrong or expired token returns a plain error, never reveals the org.

### linkParty(organization_id, party_ref, consent_scope)
Links a known platform-owned party under consent. Overlap discovery uses PSI so the tenant does not disclose its full book (ADR-0022). Creates party_link_consents; emits party.linked.

### createParty(organization_id, spec)
Creates a new counterparty on the bench. Emits party.created.

### reusePlot(organization_id, origin_unit_ref, holder_party_id)
Reuses a mapped plot under the holder's consent; checks the yield_cap_ledger for remaining capacity (refuses if exhausted, ADR-0022). Creates plot_source_consents; emits plot.reused.

### submitIdentityVerification(organization_id, kind, reference, file)
Uploads the proof (RCCM/NIU/exporter registration) as a document; creates identity_verifications(submitted). Emits identity.verification_submitted. Does NOT set verification_level (server review does).

### runEudrReadiness(organization_id, polygon)
The front-door assessment. Screens one plot against the version-pinned dataset (JRC GFC2020 + GFW), returns the gap (geometry valid, deforestation-free vs the 31 Dec 2020 cutoff, legality present). Records eudr.assessment_run with the dataset version. Returns a factual result, never the word "compliant" (CLAUDE law 7, voice rule).

### completeOnboarding(organization_id)
Requires at least one reached proof (a verified document or a caught discrepancy on the first consignment). Sets organizations.status=active; emits onboarding.completed. Returns the readiness board as the new home.

## Cross-cutting
- Every action is RLS-scoped to the caller's org; a wrong-tenant call returns zero rows or a plain error (verified in regression-tests.md).
- Mutating actions are idempotent (client-minted ids where a create; token collapse where a join).
- Aza (chat path) and the UI (click path) call the same actions, so parity is structural, not duplicated.
- No action accepts a regulatory literal; all rule resolution goes through the inherited registry (ADR-0002).
