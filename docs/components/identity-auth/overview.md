# Component: Identity and auth (overview)

Traces to ADR-0029 (the PulSe login standard) and ADR-0006 (RLS single gate). No em-dashes.

## Purpose
Who a person is, which organization they belong to, and what they may do. The single source of the identity that RLS enforces everywhere else.

## The PulSe standard, adapted to Wouri
- **Supabase Auth** for the credential (email or phone + password), with email/phone confirmation, password reset, and session handling reused from PulSe's flows.
- **Atomic org signup.** A user who creates a new tenant does so through one SECURITY DEFINER RPC that validates the input, enforces a unique organization slug, creates the organization, creates its first location, and assigns the creating user an owner membership, all in one transaction. A half-created tenant (an org with no owner, or an owner with no org) is unrepresentable. This is the load-bearing PulSe pattern.
- **Org-scoped RBAC.** Roles and role_assignments per organization; the exact action set per role is a capability set stored as data, not code, so a new role or permission is a row.
- **A role-login test harness.** PulSe's test-role-logins pattern: log in as every role, assert each sees exactly its surface and nothing else. Run in the e2e sweep.

## What this component owns
- The signup and login flows and the atomic org-creation RPC.
- people, memberships, roles, role_assignments, and the join-by-invite flow (shared with onboarding).
- Session identity that every RLS policy reads through `(select auth.uid())`.
- The membership table that authorization derives from (never JWT user_metadata, ADR-0006).

## What it does not own
- The capability menu and gating (the capabilities component).
- Tenant provisioning UX and the wizard (the onboarding component); this component provides the primitives onboarding calls.
- verification_level and the Wouri Verified mark (onboarding + the document engine).

## Non-negotiables
- The first user of a new org is its owner (bootstraps RBAC).
- Authorization is a membership-table lookup, not a JWT claim.
- A wrong-tenant or anon request returns zero rows, always, verified by probing as the real foreign role.
- French default locale on the person and the org.
