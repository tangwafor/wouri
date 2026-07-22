# Component: Capabilities (overview)

Traces to ADR-0028 (pick-and-choose, capability-first), ADR-0002 (row not column). No em-dashes.

## Purpose
The one mechanism that decides what a tenant sees and does. A tenant picks capabilities (or Aza infers them from a conversation), and everything downstream, the visible surface, the registry scope, the available document types, and the compliance rails, follows from that single set. Unused surface is not neutral; it is the main reason non-technical users abandon business software.

## The idea
- A platform-owned **capability catalog** is the menu (cocoa, timber, EUDR rail, CITES rail, field capture, settlement, financing, groups). Each entry is effective-dated data with French-first labels and a dependency (`requires_capability_key`).
- A tenant's enabled set lives in `organization_capabilities`.
- Every screen, action, and registry query is **gated** by that set. A cocoa-only tenant never sees a CITES field; a trading house without a plantation never sees a harvest screen.
- Capabilities are additive and reversible; enabling one is an INSERT, never a migration (ADR-0002).

## Capability-first, like Bazah
This is the Bazah capability model adapted: the tenant is defined by what it does, not by a fixed vertical. A tenant can be cocoa-only today and add timber (and with it the CITES rail) tomorrow, self-serve, with no code change. Aza and the picker write to the same set (chat-or-click parity).

## What it owns
- The capability catalog and its dependency graph.
- organization_capabilities and the enable/disable actions.
- The gating primitives the whole app reads (a server helper and a client hook that answer "does this tenant have capability X").
- The mapping from a capability to its registry scope (which requirement, duty, species, and document-type rows resolve for this tenant).

## What it does not own
- The wizard and conversation that choose capabilities (onboarding).
- The rules themselves (the registry; capabilities only scope what the tenant reads).
- Role-level permissions (identity-auth); capabilities gate the tenant surface, roles gate who within the tenant may act.

## Non-negotiable
Nothing in the app hardcodes a vertical or a feature flag in code. Availability is always a capability lookup. A feature that cannot be gated by a capability does not ship.
