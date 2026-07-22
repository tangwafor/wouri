# Component: Capabilities (data model)

Traces to ADR-0028, ADR-0002, ADR-0005. No em-dashes.

```
capability_catalog   (platform-owned, effective-dated)
  capability_key, label_fr, label_en, category,
  requires_capability_key nullable,   -- the dependency graph
  default_for_vertical text[],         -- wizard pre-selection
  registry_scope jsonb,                -- which rule domains this unlocks
  description_fr, description_en,
  valid_at tstzrange                   -- btree_gist exclusion (ADR-0005)

organization_capabilities
  organization_id, capability_key, enabled_at, enabled_by
  -- unique (organization_id, capability_key)
```

## The catalog (seeded)
`commodity.cocoa`, `commodity.timber`, `commodity.other`, `rail.eudr`, `rail.cites`, `field_capture`, `settlement`, `financing`, `groups`. Dependencies: `rail.cites` requires `commodity.timber`; `rail.eudr` is auto-suggested when any EUDR commodity is combined with an EU destination.

## registry_scope
Each capability declares which registry domains it unlocks for the tenant, for example `rail.eudr` unlocks the EUDR `compliance_requirements`, `country_risk`, and DDS document types; `rail.cites` unlocks `species`, `permits`, and the quota domain. The tenant reads the platform-owned registry filtered by the union of its capabilities' scopes. Nothing is copied into the tenant.

## Constraints
- capability_catalog is platform-owned: SELECT to all authenticated, writes platform-only.
- organization_capabilities writes are gated to owner/admin of that org, and enforce `requires_capability_key` (enabling a capability whose prerequisite is absent is refused).
- The catalog is effective-dated so the menu can evolve without breaking a tenant pinned to what it enabled.
- No table stores a per-tenant copy of a rule; capabilities scope reads only.
