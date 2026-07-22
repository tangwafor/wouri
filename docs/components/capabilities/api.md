# Component: Capabilities (api)

Traces to ADR-0028. Runs as the caller; RLS-scoped. No em-dashes.

## Actions
- `listCatalog(locale)` -> the effective-dated capability catalog with labels and the dependency graph. Public to authenticated tenants.
- `getCapabilities(organization_id)` -> the tenant's enabled set.
- `setCapabilities(organization_id, capability_keys[])` -> owner/admin only. Diffs against the current set, enforces `requires_capability_key` (auto-enabling prerequisites and emitting the cascade), writes organization_capabilities, recomputes vertical. Idempotent. This is the single write both the picker and Aza call.
- `suggestCapabilities(answers)` -> from the four wizard answers (or Aza's parse), returns the recommended set via `default_for_vertical`. Pure suggestion.

## The gating primitives (read by the whole app)
- Server: `hasCapability(organization_id, capability_key) -> bool`, and `capabilityScope(organization_id) -> the registry domains to filter reads by`. Every gated query and action calls these; none hardcode a vertical.
- Client: a `useCapability(key)` hook and a `<Gated capability=...>` wrapper for screens and controls.

## Cross-cutting
- A capability lookup is the only way availability is decided; a grep gate (canonicals) fails the build if a screen or action branches on a hardcoded vertical or feature flag.
- setCapabilities is owner/admin only and RLS-scoped; a wrong-tenant call returns a plain error.
- The registry read helpers accept the capability scope so a tenant only ever resolves the rule rows its capabilities unlock.
