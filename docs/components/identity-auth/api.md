# Component: Identity and auth (api)

Traces to ADR-0029. Runs as the caller; RLS is the single gate. No em-dashes.

## Auth flows (Supabase Auth, PulSe shapes)
- `signUp(email_or_phone, password, full_name, locale='fr')` -> Supabase Auth create user; the `handle_new_auth_user` trigger creates the `people` row. Then the client either calls `create_organization(...)` to start a new tenant or `acceptInvite(token)` to join one.
- `signIn(email_or_phone, password)` -> session. On sign-in the app loads the person's active memberships and picks the primary org (or prompts if several).
- `requestPasswordReset(email)` / `confirmPasswordReset(token, new_password)` -> PulSe flow.
- `confirmContact(token)` -> email/phone confirmation.

## Org and membership
- `create_organization(p_org_name, p_org_slug, p_first_location_name, p_country, p_locale)` -> the atomic SECURITY DEFINER RPC (data-model.md). Returns `{ organization_id, membership_id, slug }`. Enforces slug uniqueness; a taken slug returns a plain "choose another" error.
- `inviteMember(organization_id, email_or_phone, role_key)` -> owner/admin only; returns the invite link.
- `acceptInvite(invite_token, person)` -> public, idempotent on the token; creates membership + role_assignment.
- `assignRole(membership_id, role_key)` / `revokeRole(...)` -> owner/admin only.
- `setRoleCapabilities(role_id, capability_keys[])` -> owner/admin only; roles are data.
- `suspendMember(membership_id)` / `reactivateMember(...)` -> owner/admin only.
- `switchOrg(organization_id)` -> sets the active org for a person who belongs to several (diaspora holdings, ADR-0002).

## Cross-cutting
- Slug generation lower-cases and validates; org codes never collide (unique index, checked in the RPC).
- All membership and role mutations are gated to owner/admin of that org and RLS-scoped.
- No endpoint returns another tenant's identity data; a wrong-tenant call returns zero rows or a plain error.
- The role-login harness (test-role-logins) exercises each role's real session in the e2e sweep.
