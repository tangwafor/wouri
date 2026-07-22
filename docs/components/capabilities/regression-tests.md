# Component: Capabilities (regression tests)

Traces to ADR-0028, ADR-0027. Attacking, positive controls, real foreign role. No em-dashes.

1. **Gating hides the right surface.** A cocoa-only tenant resolves no CITES screen, species field, or CITES requirement row. Positive control: enabling timber makes the CITES rail and its rows appear.
2. **Dependency enforced.** Enabling `rail.cites` without `commodity.timber` is refused. Positive control: with timber present it succeeds, and the cascade event is recorded.
3. **Registry scope is a filter, not a copy.** After enabling `rail.eudr`, the EUDR requirement rows resolve for the tenant with zero rows written into any tenant-owned table. Positive control: a tenant without the rail resolves none of those rows.
4. **No hardcoded vertical.** The canonicals grep gate fails the build if any screen or action branches on a hardcoded vertical or feature flag instead of a capability lookup. Positive control: the same feature gated by `hasCapability` passes.
5. **Enabling is owner/admin only.** A manager calling setCapabilities is refused (policy, not just UI). Positive control: an owner enables it.
6. **Isolation.** Tenant B cannot read or change tenant A's organization_capabilities; anon reads zero. Positive control: tenant A's owner reads and changes its own.
7. **Reversibility without data loss.** Disabling a capability hides its surface but leaves data captured under it intact; re-enabling shows it again. Positive control: the data is queryable after re-enable.
8. **Chat-or-click parity.** Aza enabling a capability from a conversation produces the identical organization_capabilities row and event as the picker. Positive control: a different toggle set differs.

Runs in the machine self-test and the e2e sweep. A red run blocks the merge.
