# Component: Identity and auth (data model)

Traces to ADR-0029, ADR-0006. RLS deny-by-default. No em-dashes.

```
people
  id, auth_user_id (fk auth.users, unique), full_name, contact jsonb,
  default_locale (default 'fr'), created_at
  -- one row per human; created by the handle_new_auth_user trigger on signup

memberships
  id, person_id, organization_id, status (invited|active|suspended),
  is_primary bool, created_at
  -- unique (person_id, organization_id)

roles
  id, organization_id nullable (null = system role), key, label_fr, label_en
  -- system roles seeded platform-wide; org roles are per-tenant

role_assignments
  membership_id, role_id
  -- unique (membership_id, role_id)

role_capabilities
  role_id, capability_key, granted
  -- the action set per role, as DATA not code (PulSe RBAC pattern)

invitations   (shared with onboarding)
  id, organization_id, email_or_phone, role_key, invite_token (26-char),
  invited_by, accepted_at, expires_at
```

## The atomic org-signup RPC (the PulSe pattern)
```
create_organization(
  p_org_name text, p_org_slug text, p_first_location_name text,
  p_country text, p_locale text default 'fr'
) returns json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
```
In one transaction: validate required fields; enforce a unique `organizations.slug` (lower-cased); insert the organization (status = onboarding); insert the first `locations` row; insert a `memberships` row for `auth.uid()` with status active and is_primary; assign the seeded owner role; return `{ organization_id, membership_id, slug }`. Any failure rolls the whole thing back, so a half-created tenant cannot exist.

## Seeded system roles (org-scoped instances created per tenant)
owner, admin, manager, documentation_officer, field_agent, finance, viewer. Each has a `role_capabilities` set. owner and admin are the only roles that can change capabilities, invite, or verify (permissions.md).

## Constraints and protections
- `people.auth_user_id` is unique and set only by the signup trigger; a column GRANT keeps it server-only.
- `memberships.status` and role assignments are writable only by owner/admin of that org (RLS + policy).
- The first membership of an organization must carry the owner role (enforced in the RPC, asserted in tests).
- Every table is RLS-scoped: a person sees a membership row only for their own person_id or for an org they are an active member of; anon sees nothing.
- No auth decision reads JWT user_metadata; policies join `memberships` (ADR-0006).

## Reuse from PulSe / the lifted substrate
The signup RPC, the LoginForm and SignupForm shapes, the password-reset and confirm flows, and the role-login test harness are lifted from PulSe and adapted (slug instead of org-code + branch; French default). Identity/orgs come from the Bazah substrate (ADR-0025); PulSe contributes the signup-and-RBAC flow specifically.
