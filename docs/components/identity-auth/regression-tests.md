# Component: Identity and auth (regression tests)

Traces to ADR-0029, ADR-0027. Written to attack; every negative assertion carries a positive control; probe as the real foreign role. No em-dashes.

## Atomic signup
1. **No half-created tenant.** Force the org-creation RPC to fail after the org insert (for example a duplicate slug injected mid-transaction); assert no organization, location, or membership rows persist. Positive control: a clean call creates exactly one org, one location, one owner membership.
2. **Slug uniqueness.** Two orgs cannot share a slug; the second is refused with a plain message. Positive control: a different slug succeeds.
3. **First member is owner.** After create_organization, the creating user has the owner role. Positive control: an invited member does not get owner.

## Isolation
4. **Anon sees no identity.** As anon, every identity table returns 0 rows. Positive control: an owner reads their own org's members.
5. **Wrong tenant sees nothing.** Tenant B reading tenant A's memberships, roles, invitations returns 0 rows. Positive control: tenant A reads them.
6. **Authorization is not from the JWT.** A JWT with a forged `user_metadata.role = 'owner'` grants nothing; the membership table governs. Positive control: a real owner membership grants owner actions.
7. **Integrity columns unwritable.** A member cannot UPDATE people.auth_user_id or a role system flag (column GRANT blocks it). Positive control: a platform/owner path changes what it legitimately can.

## RBAC
8. **Role-login harness.** Log in as every seeded role and assert each sees exactly its surface and no more (the PulSe test-role-logins pattern). Positive control: enabling a capability for a role makes exactly that surface appear.
9. **Only owner/admin mutate membership.** A manager inviting, assigning a role, or editing role capabilities is refused. Positive control: an owner does all three.
10. **Suspension cuts access immediately.** After suspendMember, that person reads 0 rows from the org. Positive control: reactivate restores access.

## Flow and idempotency
11. **Invite join is idempotent.** Accepting the same token twice yields one membership; a wrong or expired token returns a plain error that does not reveal the org. Positive control: a valid token joins once.
12. **Password reset and confirm** follow the PulSe flow and do not leak account existence.
13. **Org switch.** A person in two orgs switches and every subsequent query is scoped to the new org (the other org's rows return 0). Positive control: switching back restores the first org's rows.

## Gate wiring
Runs in the machine self-test (rollback subtransactions + anon and wrong-tenant probes) and the e2e sweep (the role-login harness at phone size). A red run blocks the merge.
