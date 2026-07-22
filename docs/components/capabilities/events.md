# Component: Capabilities (events)

Traces to ADR-0028. Org-scoped audit events. No em-dashes.

| Event | When | Effect |
|---|---|---|
| `capability.enabled` | picker toggle on, or Aza inference (confirmed) | organization_capabilities INSERT; widens surface + registry scope |
| `capability.disabled` | picker toggle off | organization_capabilities DELETE; narrows surface |
| `capability.dependency_auto_enabled` | enabling X auto-enables its prerequisite | records the cascade so the audit is complete |
| `org.vertical_derived` | capability set changes | organizations.vertical recomputed from the set (text, no enum) |

Rules: client-minted ids, server-stamped actor. Enabling and disabling are idempotent. Aza-driven changes emit the identical events as the picker under the user's identity, so chat-or-click produce the same auditable history. Disabling a capability never deletes tenant data captured under it; it only hides the surface (reversible).
