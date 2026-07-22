# Platform: security and RLS

Traces to ADR-0006. No em-dashes.

## RLS is the single isolation gate
Every tenant table is RLS deny-by-default. Reads are pull replication under the user JWT, so there is exactly one place tenant scoping lives. This raises the stakes on getting RLS exactly right, so the rules below are laws, not suggestions.

## The rules
- Wrap every auth call in a scalar subquery: `USING ((select auth.uid()) = ...)`. Same for auth.jwt(), auth.role(), current_setting(). A bare call re-evaluates per row and turns a 5ms query into a 5s query on 100k rows. Watch the `auth_rls_initplan` advisor.
- Index every column a policy filters on (organization_id, lot_id, party_id).
- Authorize from the membership table, never JWT user_metadata (user-writable). A forged metadata role grants nothing.
- Combine RLS with column GRANTs. RLS filters rows; it does not stop a client writing a column it should never touch (organization_id, event_hash, prev_event_hash, provenance, verification_level). GRANT INSERT/UPDATE only on safe columns. lot_events: clients INSERT append-only rows, never UPDATE or DELETE, never set server-computed integrity fields.
- The sync cursor is a monotonic server sequence RLS lets through, with explicit tombstones for now-invisible rows.
- RLS-on-every-table is a CI check. A single un-toggled table in a single-gate design is a full-tenant leak (CVE-2025-48757: 10.3% of AI-built Supabase apps shipped public-readable tables).

## The anon surface
Deliberately tiny and enumerated: the verification page resolver (a SECURITY DEFINER function that demands the 26-char code and returns at most one row), and nothing else. Never a view. Every definer function is audited: it takes no caller-supplied identity, and the security-check gate asserts the anon surface has not grown.

## Proving it
Every isolation claim is a regression test that probes as the actual foreign role (anon and a wrong-tenant JWT), never as postgres, and carries a positive control so a refusal for the wrong reason cannot pass. The absence-test anti-pattern (asserting an empty list without a populated companion) is banned.
