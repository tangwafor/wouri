# Component: Tenant onboarding (regression tests)

Traces to ADR-0028, ADR-0027 (the four gates). A blocking suite written to attack. Every negative assertion carries a positive control so a refusal for the wrong reason cannot pass silently (CLAUDE law 15). Probe as the real foreign role, never as postgres. No em-dashes.

## Isolation (the whole point)
1. **Anon sees nothing.** As anon, SELECT every onboarding table returns 0 rows. Positive control: the owner sees their own org's rows.
2. **Wrong tenant sees nothing.** Tenant B's JWT reading tenant A's organization, capabilities, sessions, invitations, identity_verifications, parties, consents returns 0 rows. Positive control: tenant A's owner reads them.
3. **Integrity columns are unwritable.** A member UPDATE of `organizations.verification_level` or `status` fails at the column GRANT before RLS. Positive control: a platform review advances verification_level via the reviewed event.

## Chat-or-click parity
4. **Same tenant either way.** Onboarding the same business by the picker and by a scripted conversation produces the identical organization, organization_capabilities, vertical, and party-bench skeleton (compare the two resulting states). Positive control: a deliberately different set of answers produces a different capability set.
5. **Aza runs as the user.** A conversation driven by a member who lacks admin cannot enable a capability (it is refused). Positive control: the same conversation by an owner enables it.

## Capability gating and registry inheritance
6. **Cocoa-only hides CITES.** A tenant with only `commodity.cocoa` never resolves a CITES screen or a CITES requirement row. Positive control: enabling `commodity.timber` makes the CITES rail and its requirements appear.
7. **Dependencies enforced.** Enabling `rail.cites` without `commodity.timber` is refused. Positive control: with timber present it is allowed.
8. **Registry is inherited, not seeded.** Immediately after onboarding a cocoa + EU tenant, the EUDR requirement rows resolve for that tenant with zero rows written into any tenant-owned table. Positive control: a non-EU-only tenant does not resolve EUDR rows.

## Reuse under consent
9. **No consent, no reuse.** `linkParty` and `reusePlot` without a consent row are refused and expose nothing beyond existence. Positive control: with consent, the link succeeds and only the consented scope is visible.
10. **Yield cap blocks laundering.** Reusing a plot whose yield-cap capacity is exhausted is refused. Positive control: reuse within remaining capacity succeeds and decrements the ledger.
11. **PSI does not leak the book.** Overlap discovery returns only the intersection; a probe cannot enumerate tenant A's full counterparty set from tenant B. Positive control: a genuinely shared counterparty is found.

## Verification and the mark
12. **verification_level advances only on review.** A submitted identity_verification does not change the level; an accepted review does. Positive control: the reviewed event advances it.
13. **The mark reflects the level.** A document issued by an unverified tenant carries the self-declared qualifier; by a verified tenant, full attestation. Positive control: verifying the tenant upgrades the mark on a re-issued document.

## Flow and idempotency
14. **Invite join is idempotent.** Accepting the same invite_token twice yields one membership. Positive control: two different tokens yield two memberships.
15. **Resume anywhere.** An interrupted onboarding session resumes at the right step with prior answers intact.
16. **Completion requires a proof.** `completeOnboarding` is refused until the first consignment has a verified document or a caught discrepancy. Positive control: once a proof exists, completion succeeds and status becomes active.
17. **No compliance assertion.** `runEudrReadiness` and every onboarding surface return factual results; a text scan asserts the strings "compliant" and "all good" never appear (with a populated positive control that the factual result strings do appear).

## Gate wiring
This suite runs in the machine self-test (rollback subtransactions + the anon and wrong-tenant probes) and the end-to-end sweep (the two paths walked as each role at phone size, tenant B seeing none of tenant A). A red here blocks the merge.
