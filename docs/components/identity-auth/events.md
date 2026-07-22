# Component: Identity and auth (events)

Traces to ADR-0029. Org-scoped audit events (not lot_events). No em-dashes.

| Event | When | Effect |
|---|---|---|
| `auth.user_registered` | Supabase Auth signup | trigger creates a `people` row |
| `org.created` | atomic signup RPC succeeds | org + first location + owner membership (shared with onboarding org.created) |
| `member.invited` | owner/admin invites | invitations row |
| `member.joined` | invite accepted | membership + role_assignment; idempotent on invite_token |
| `role.assigned` / `role.revoked` | owner/admin changes a member | role_assignments change |
| `role.capabilities_changed` | owner/admin edits a role | role_capabilities change |
| `auth.password_reset_requested` / `auth.password_changed` | reset flow | audit only |
| `member.suspended` / `member.reactivated` | owner/admin | membership.status change |

Rules: events are append-only, client-minted ids, server-stamped actor and sequence. Authorization changes (role.assigned, role.capabilities_changed) always record the actor for the registry audit (ADR-0006). No auth event carries a credential or a token value in its payload.
