# Component: Identity and auth (permissions)

Traces to ADR-0029, ADR-0006. No em-dashes.

## The authorization model
- Identity comes from Supabase Auth. Authorization comes from the `memberships` + `role_assignments` + `role_capabilities` tables, never from a JWT claim. Every RLS policy joins membership through `(select auth.uid())`.
- The first member of an org is owner. owner and admin can invite, assign and revoke roles, edit role capabilities, suspend members, and (with the onboarding component) enable capabilities and submit verification.
- All other roles get capability-gated views and cannot change membership, roles, or capabilities.

## RLS
- Every identity table is RLS deny-by-default. A person reads a membership only for their own person_id or for an org where they are an active member. roles and role_capabilities are readable by members of the owning org. Anon and wrong-tenant read zero rows.
- Integrity columns (people.auth_user_id, memberships integrity, role system flags) are unreachable from the client by column GRANT.
- Membership and role mutations are gated to owner/admin of that org, enforced in the policy `with check`, not only in the UI.

## Session and org scope
- A session resolves to one active organization at a time (switchOrg for multi-org people). All queries in that session are RLS-scoped to it.
- Suspending a membership immediately removes the person's access to that org's data (RLS returns zero rows), verified in tests.

## Reuse
The role-login harness (PulSe test-role-logins) is the mechanical proof that each role sees exactly its surface. It is part of the e2e sweep and a red run blocks the merge.
