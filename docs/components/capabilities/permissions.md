# Component: Capabilities (permissions)

Traces to ADR-0028, ADR-0006, ADR-0022. No em-dashes.

- **Catalog is platform-owned.** capability_catalog: SELECT to all authenticated tenants, writes restricted to the platform. A tenant reads the menu, never edits it.
- **Enabling is owner/admin only.** organization_capabilities writes are gated to owner/admin of that org, enforced in the policy `with check`, not only the UI. Other roles see the enabled set read-only.
- **RLS.** organization_capabilities is RLS-scoped to the org; anon and wrong-tenant read zero rows.
- **Capabilities gate the tenant surface; roles gate who acts.** The two are orthogonal: a capability decides whether the tenant has the CITES rail at all; a role decides whether a given member may act on it. Both must pass.
- **No cross-tenant leak.** A capability never grants a read of another tenant's data. The registry scope a capability unlocks is the platform-owned common good (ADR-0022), not another tenant's rows.
- **Registry scope is a filter, not a copy.** A capability changes which platform-owned rule rows resolve for the tenant; it never writes rules into the tenant.
