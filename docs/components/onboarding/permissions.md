# Component: Tenant onboarding (permissions)

Traces to ADR-0028, ADR-0006. RLS deny-by-default on every table; RLS is the single isolation gate. No em-dashes.

## Roles created during onboarding
- The first person to create an organization gets an **owner** membership (bootstraps RBAC). Owner can enable capabilities, invite members, submit identity verification, and complete onboarding.
- **admin** mirrors owner for onboarding actions except transferring ownership.
- Invited **manager**, **documentation_officer**, **field_agent**, **finance** get gated views; they cannot change capabilities or verification.
- Roles are `roles` + `role_assignments`; capabilities per role live in `staff_roles`-style capability sets (lifted pattern), so the exact action set is data, not code.

## Action gating
| Action | Allowed role |
|---|---|
| startOnboarding, setCapabilities, onboardFromConversation (mutations) | owner, admin |
| inviteMember | owner, admin |
| acceptInvite | anyone holding a valid invite_token (public, idempotent) |
| createParty, linkParty, reusePlot | owner, admin, manager |
| submitIdentityVerification | owner, admin |
| runEudrReadiness | any member (read-only screen) |
| completeOnboarding | owner, admin |
| identity.verification_reviewed | platform reviewer only (never the tenant) |

## RLS and column protection
- Every onboarding table (organizations, organization_capabilities, onboarding_sessions, invitations, identity_verifications, parties, consents) is RLS-scoped to the caller's organization via a membership-table predicate wrapped in `(select auth.uid())`. Anon and a wrong-tenant JWT return zero rows.
- Integrity/identity columns are unreachable from the client by column GRANT: `organizations.verification_level`, `verified_at`, `status`, and any event integrity field. `verification_level` advances only via a platform-reviewed `identity.verification_reviewed` event.
- `capability_catalog` and the regulatory registry are platform-owned: SELECT to all authenticated tenants, writes restricted to the platform. A tenant reads rules, never writes them.

## The verification gate on capability
`verification_level` gates outward-facing power, not inward setup:
- unverified / self_declared: can onboard, create consignments, and generate documents, but the Wouri Verified mark on issued documents carries a "self-declared issuer" qualifier.
- documents_submitted / verified: the mark carries full issuer attestation. The mark's credibility depends on this, so it is enforced at issuance, not hidden in the UI.

## Cross-tenant consent (neutrality, ADR-0022)
- `linkParty` and `reusePlot` require an explicit consent row; without it, the shared identity skeleton exposes nothing beyond existence, and reuse is refused.
- Party overlap is discovered by PSI so a tenant never reveals its full counterparty book.
- No onboarding action grants any implicit read of another tenant's data. Every cross-tenant benefit resolves to platform-owned commons, an opt-in consent, or an anonymized aggregate. There is no fourth path.

## Aza (chat path)
Runs strictly as the requesting user's identity, so it can only do what that user could do by clicking. It proposes and confirms before mutating (never mutates without explicit confirmation) and never touches identity verification review or any compliance assertion.
