# Sprint 0 execution checklist (Foundation, weeks 1 to 3)

The repo that boots, logs a user in, isolates a tenant, and speaks French and English. Everything here is ungated by the one hard rule. No em-dashes.

## Needs from the founder before code starts
- [ ] A Wouri Supabase project (dev), on the founder's account.
- [ ] Green light to copy the Bazah substrate into this repo (ADR-0025: copy, no shared package).

## Repo and tooling
- [ ] Monorepo: `apps/console` (Next.js 15 App Router, TS, Tailwind), `apps/field` (Expo), `packages/core` (types, units, money, fx, geo, validation, event emission), `packages/offline` (lifted from Bazah).
- [x] `scripts/check-canonicals.mjs` (built): em-dash gate + regulatory-literal and hardcoded-vertical warnings. Wire into CI and pre-push.
- [ ] `scripts/check-i18n.mjs`: every key present in fr and en.
- [ ] CI: run canonicals, i18n, typecheck, build on every push. Pre-push gate mirrors CI.
- [ ] Design tokens: the institutional palette (deep anchor colour, black, white, one alert red), the serif for documents and the sans for the interface, light and dark for the app, documents always light.

## Supabase and identity
- [ ] Supabase project wired (URL, anon, service role in env; never a service key in the client or in Aza).
- [ ] Identity and orgs from the Bazah substrate + the PulSe atomic org-signup RPC (ADR-0029): organizations, people, memberships, roles, role_assignments, role_capabilities.
- [ ] RLS deny-by-default on every table; the RLS-on-every-table CI check.
- [ ] The seeded system roles (owner, admin, manager, documentation_officer, field_agent, finance, viewer) with capability sets.
- [ ] The regulatory registry skeleton (Layer 2), effective-dating via tstzrange + btree_gist exclusion; capability_catalog seeded.

## Lifted substrate (from Bazah)
- [ ] The offline event spine, geo (PostGIS, location_fixes, anti-spoof trust tier), units (integer base units), money and fx (null-not-one), the payment_requests share-code design, and the test doctrine (canonicals + regression pattern).

## i18n and voice
- [ ] fr + en message catalogues; French default; the document-output-language axis stubbed.
- [ ] The voice rule enforced in copy review: never "all good" or "you are compliant".

## The four gates, stood up
- [ ] Build gate: canonicals + i18n + typecheck + migrations clean.
- [ ] E2E sweep: `ui-qa-sweep` walks login as each role at phone size; anon sees 0 rows; tenant B sees nothing of tenant A.
- [ ] Machine self-test: `wouri-selftest` harness (rollback subtransactions + anon and wrong-tenant RLS probes), a green baseline to grow.
- [ ] Fabrice UAT: dev-backed staging + a seeded role bench + the realtime triage feed (reuse the fleet Human Test Suite: dev==prod, qa_live_triage).

## Sprint 0 definition of done
Login works as each role; anon and wrong-tenant see zero rows (proven by probing as the real role); the four gates are wired and green; the pitch deck skeleton and the French customer headline exist. Then, and only with a real consignment file in hand, Sprint 1 (the spine) begins.
