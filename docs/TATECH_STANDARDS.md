<!-- TATECH_STANDARDS_VERSION: 2026-06-16.1 -->
<!-- TATECH_STANDARDS_POINTS: 27 -->
<!-- This file is the SINGLE SOURCE OF TRUTH. Do not hand-edit per repo. -->
<!-- Update here, then run: node ~/.claude/tatech/sync-standards.mjs -->

# TaTech App Signature

**The definitive build standard. Every app we ship (NdamBa, PulSe, PolyHealth, AAA, SaBi, StanleyCom, ImmiReady, YmShotS, Pamoja, CivicLoop, and anything new) must satisfy all 27 points before it is "done."** A point not yet met is a tracked gap, not an exception.

Locked 2026-05-22. Extended 2026-05-25 (units), 2026-05-26 (security + stress), 2026-05-28 (sales kit, automation promoted to #25, branded-domain hosting added as #26, auth done right added as #27), 2026-05-29 (#7 hardened: from-scratch journey, voice-after-render sync, two cuts, freshness, ship-only-verified).

> **Why a signature:** every TaTech app must be instantly recognizable as TaTech-grade (same polish, same guarantees, same signature) so any one of them can win a client.

---

## The 27 points

### Core (1-14)
1. **Themes**: light AND dark mode, user-toggle, persisted.
2. **Mobile-first + offline PWA**: designed mobile-first; installable on iOS + Android with the tenant's icon; core flows work OFFLINE (cache + queue, sync on reconnect).
3. **Multilingual**: every UI string in all supported languages from day one; i18n is part of "done."
4. **Great UI/UX**: polished and branded; back navigation on every sub-page (no dead ends); in-app guided walkthrough/tour (first-run + per-feature).
5. **Named AI assistant per tenant**: named after the owner; broad knowledge base (the app + that tenant's policies/processes); falls back to Anthropic when it does not know; role-scoped; each owner can rename their AI.
6. **Self-testing suite**: in-app `/admin/test-runner` + RLS/privacy QA + `record-demo.mjs`; real behavior tests (not "page loaded"); green before every release. Must include (a) a full-stack E2E (UI flow + backend DB assertions proving each action persisted) and (b) an exhaustive every-button UI regression test, run per role. **(c) UI-LAYER COMPONENT/RENDER TESTS are mandatory, not optional**: tsc + logic tests are NOT proof the UI works; a passing build or a pretty demo video proves nothing about rendered behavior. Use the harness that fits the stack: **React Native / Expo → `jest-expo` + `@testing-library/react-native`** (mount the real screen, mock only the data edges (DB/services/native modules) and assert visible output + wiring); **Next.js / React web → Playwright UI specs** that `page.goto` real routes and assert on rendered content with `getByRole`/`getByText` (not just HTTP 200), per role. Every app wires its UI suite into the pre-push preflight gate (degrade-gracefully if the harness is absent on a fresh clone). Reference implementation: transitos `tests-ui/` (jest-expo) and PulSe `*.spec.ts` (Playwright). On-device E2E (Detox/Maestro) is the next tier and may stay open, but render+wiring coverage is the floor.
7. **Voice-narrated video walkthrough (from scratch, synced, two cuts)**: a voiced (one consistent named voice, e.g. Aoede), captioned (.vtt/.srt) walkthrough recorded against the LIVE app in every supported language. (a) **Detailed cut = the WHOLE app, from scratch**: create a tenant/account from zero and go through the entire journey; it doubles as a real UI+SQL test that surfaces bugs (fix them, never ship half-baked). (b) **Reel cut = a 60-90s wow hook** that makes people want to watch the full walkthrough. (c) **Sync + pacing**: each page must render and settle BEFORE the voice starts, and the shot holds for the whole line + a tail, so the picture always leads the voice; slow, steady pace (no voice racing ahead). (d) **UI in the narration's language** (locale-matched routes: FR narration over the FR UI, never EN UI). (e) **Freshness**: stamp each render with date + app commit; a staleness gate blocks wiring/upload once the app has moved past it. (f) Keep **UNLISTED until watched + verified** ("sleep well"); publish only what genuinely works. See [[ship-only-verified-never-half-baked]] + [[demo-recording-standard]].
8. **How-to docs**: user-facing in-app help + docs site, updated with every patch. No doc-debt.
9. **Platform console (TaTech-engineer tier)**: separate tier from tenant admin; gated by a `platform_admins` table (no self-promotion); per-tenant usage + health, drifting per-tenant billing, services on/off kill-switch, impersonation WITH audit log + always-on banner. Never called "god" in any user-facing place.
10. **Observability ("our own Datadog")**: error tracking (Sentry), synthetic uptime/flow monitors, a metrics dashboard, alerts.
11. **Source of truth + brief/exec tab**: canonical page + API inventory; an in-app brief tab.
12. **Branding signature**: per-tenant logo across app + PWA icon + printables; "Powered by TA-Tech" attribution everywhere; every printed doc carries the tenant logo + name (header) AND the TaTech logo + motto (footer). Motto: "It's not where you have been, but where you are going." No em-dashes anywhere.
13. **DB discipline**: snapshots over migrations, dev-first, RLS-enforced, audit code-vs-LATEST before release; pull a fresh dump before any new SQL.
14. **RBAC + privacy by default**: DB-enforced RLS, least-privilege, sensitive data scoped to the right roles.

### Added 2026-05-22
15. **Everything editable + removable**: full CRUD from the UI on every entity the app creates; no write-only data, no dead records.
16. **Highly customizable, NO hardcoding**: multi-tenant, so admins define their own lists (activities, positions, levels, fee types, roles, etc.); ship sensible defaults but never hardcode an enum a tenant might want to change.
17. **White-label isolation ("each tenant feels alone")**: their logo/colors/PWA icon, their AI, their data, their lists; no cross-tenant leakage, no other-tenant branding. Only "Powered by TA-Tech" sits above the tenant brand.
18. **AI onboarding questionnaire**: a comprehensive owner questionnaire (in all supported languages) filled at onboarding that seeds the tenant AI's knowledge base; editable/extendable anytime.
19. **Slack-grade in-app comms**: channels/threads/reactions/mentions/search/slash, PLUS exceed Slack via WhatsApp/SMS bridge, AI persona, auto-translate, inline cards.
20. **Smart forms + address autocomplete**: real dropdowns for every enum/CHECK field (never a bare text box), currency prefix on money inputs, country/region pickers, translated labels + options, and address autocomplete.
21. **Engineering hygiene & release gates**: build-before-push, click-through-in-dev before deploy, docs-with-every-patch, fresh dump before SQL, trigger smoke-tests, API GET + mutation audit, check information_schema before SQL, double-check prod-vs-staging, GRANT SELECT on security_invoker views, NO `.test` accounts on prod.

### Added 2026-05-25
22. **Global-ready units**: every measurement offers both systems with a user toggle (distance km/mi, height cm/ft-in, weight kg/lb, temperature C/F where used); locale-aware dates + numbers; money is per-tenant currency. Store one canonical unit (metric) and convert at the edge.

### Added 2026-05-26
23. **End-to-end security checks + stress tests**: (a) `scripts/security-check.mjs` + in-app surface: proves RLS/authz per role (each role sees only what it should, cross-tenant isolation holds, no public leakage); every admin/platform/automation endpoint is secret- or auth-gated (probe returns 401/403 without creds); input validation; no secrets in client bundle/responses; runs the Supabase advisors/security lints; checks security headers. Fails the release on any finding. (b) `scripts/stress-test.mjs`: drives critical flows under concurrency + sustained throughput and asserts latency/error-rate thresholds. Run before every release; archive findings per date.

### Added 2026-05-28
24. **Sales & docs kit (on the corporate site, NOT the app stack)**: every product ships on tatech.dev: (a) an investor pitch, (b) a book-length brochure/handbook (multi-chapter, table of contents), (c) a step-by-step how-to guide. Branded, no em-dash, linked from `/products/[slug]`. Marketing/sales docs live on corporate (no app backend); anything tied to the app stack (technical, runbooks, schema, this file) stays INTERNAL to TaTech engineers.
25. **Automation everywhere (event-driven + agentic)**: automation is part of "done." Two layers: (a) **event-driven**: DB triggers that react to events, each shipping an inline INSERT+DELETE smoke test (e.g. injury/red-card auto-flagging a coach note; overdue invoice auto-posting to a channel); (b) **agentic workflows**: a scheduled, secret-gated `/api/automations` runner on the FREE LLM tier (Gemini-first, fall back to Anthropic) for overdue-fee reminders via the WhatsApp/SMS bridge, weekly digests, expiry/renewal nudges, etc. Agentic LLM work defaults to the free provider. Meta-automation: standards conformance itself is automated: this file is version-stamped and a drift check surfaces whenever drift appears, so nobody has to remember to propagate a new standard.
26. **Branded-domain hosting**: every standalone product is served from its OWN domain, with branded subdomains (apex/www = the app, `docs.` = the docs site, `watch.` = videos). Never expose a raw `*.netlify.app` (or any platform) URL in public. tatech.dev only embeds the demo reel and the sales/docs kit; it is not where the app lives.

27. **Auth done right (login / signup / logout / recovery)**: auth is the front door; everything starts here, so it must work perfectly. (a) **Never fail silently**: Supabase auth calls (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`) RESOLVE with `{ error }`, they do not throw; always read AND show the error (a try/catch alone hides failures). (b) **Friendly, localized errors** via a shared `authErrors` map for every case: network/offline, invalid credentials, unconfirmed email, already-registered, rate-limited, weak password, same-as-old, expired/invalid recovery link, 5xx, plus a never-blank fallback. (c) **Password UX**: a show/hide **eye toggle** on every password field, confirm-password match on signup, min 8 chars. (d) **Recovery + change**: forgot-password sends a BRANDED reset email with an explicit `redirectTo`; a top-level `/reset-password` route (auth-guard-exempt) exchanges the code; **Settings > Security > Change password** works in-app. (e) **Sign-out** is always reachable and fully clears the session. (f) **Supabase config per project**: `site_url` = the prod domain (never localhost, or every recovery/confirm link breaks); `uri_allow_list` covers prod + `/reset-password` + native scheme; BRANDED email subjects/templates (logo, product name, motto) AND a branded FROM address via custom SMTP (Resend/SendGrid/SES), since the default mailer forces `noreply@mail.app.supabase.io`. Reference implementation + full checklist: ImmiReady `docs/LOGIN_SIGNUP_STANDARD.md`.

### Added 2026-06-14
28. **Shareable watch pages + canonical ShareButton**: every product reel/demo gets a real WATCH PAGE (not a raw `.mp4` URL): a branded route (e.g. `/products/[slug]/watch`, ideally on the `watch.` subdomain per #26) with the language toggle + captions and OpenGraph/Twitter `player` tags so a shared link previews richly. Every watch / receipt / track / public share surface uses the **canonical `ShareButton`** component (native Web Share where supported, with copy-link + WhatsApp + X + email fallbacks; `accent` matches the host brand). Canonical source: `~/.claude/tatech/components/ShareButton.tsx`, vendored by `sync-standards.mjs` into each app's components dir; never hand-edit the vendored copy. Share text/url must be the watch page, never a bare file.

---

## App-specific (not universal, listed so they are not lost)
- **PulSe:** pitch 3-axis framing (Facilitates work / Keeps compliant / Saves money with $ figures) + new-feature 5-surface checklist.
- **PolyHealth:** WHO compliance (ICD-11, FHIR, DHIS2, SMART Guidelines) + 35 languages + facility templates + per-country localization.
- **Per-app language minimums** (e.g. Cameroon apps: EN/FR/PCM/FF; SaBi: EN/ES/FR only).

## How to use this file
- This is the canonical copy. It is identical in every repo as `docs/TATECH_STANDARDS.md`, synced from `~/.claude/tatech/TATECH_STANDARDS.canonical.md`.
- To change a standard: edit the canonical, then run `node ~/.claude/tatech/sync-standards.mjs`. Never hand-edit a repo copy above the conformance section.
- Per-app conformance notes live below a `## Conformance` heading in each repo's copy; the sync preserves anything below that heading.
- The drift gate compares the repo copy's `TATECH_STANDARDS_VERSION` stamp against this canonical and flags any repo that is behind.

---

## Conformance (Wouri)

Honest status of each canonical point for Wouri, with evidence. Met / Partial /
Roadmap. This section is per-app; everything above is synced from the canonical and
must not be hand-edited. No em-dashes.

| # | Point | Status | Evidence |
|---|-------|--------|----------|
| 1 | Themes (light/dark, persisted) | Roadmap | tokens.css palette; a persisted light/dark toggle is not yet wired |
| 2 | Mobile-first + offline PWA | Partial | offline resilience (Aza local, cockpit cache, field queue); per-tenant PWA install is Roadmap |
| 3 | Multilingual | Met | fr default + en on every screen (i18n.ts), day one |
| 4 | Great UI/UX (back nav, walkthrough) | Partial | back links on sub-pages; interactive training artifact; per-feature in-app tour is Roadmap |
| 5 | Named AI per tenant (KB, fallback, rename) | Partial | Aza named, bundled + owner-editable KB, local-first; Anthropic fallback + per-tenant rename Roadmap |
| 6 | Self-testing suite (full-stack E2E + UI render) | Partial | (a) critical-path e2e `run-e2e.mjs`; (c) Playwright UI render `ui-qa-sweep.mjs`; in-app `/admin/test-runner` + every-button-per-role Roadmap |
| 7 | Voice-narrated video walkthrough | Roadmap | not produced for Wouri yet |
| 8 | How-to docs | Met | docs/ (research, training, delivery, ADRs), updated per patch |
| 9 | Platform console (platform_admins, impersonation+audit) | Partial | `platform_admins` gate (no self-promote); full console + audited impersonation Roadmap |
| 10 | Observability | Partial | in-app auto_checks + notifications + inbox; Sentry/uptime/metrics Roadmap |
| 11 | Source of truth + brief tab | Partial | docs canonical + API/schema; in-app brief tab Roadmap |
| 12 | Branding signature (per-tenant logo, printables, motto) | Partial | exporter brand baked into signed docs + verification cert; TaTech footer/motto on every printable to verify |
| 13 | DB discipline (dev-first, RLS, audit) | Met | dev-first on wouri-dev, RLS deny-by-default, apply-migrations idempotent runner |
| 14 | RBAC + privacy by default | Partial | RLS deny-by-default Met + proven; full least-privilege role matrix Partial |
| 15 | Everything editable/removable (CRUD) | Partial | most entities editable; a full-CRUD audit is open |
| 16 | No hardcoding | Met | registry_config + cfg_num; regulatory-literal gate is a hard failure |
| 17 | White-label isolation | Met | RLS isolation proven in every suite + the critical path; per-tenant brand |
| 18 | AI onboarding questionnaire | Partial | chat/click onboarding infers capabilities; full KB-seeding questionnaire Partial |
| 19 | Slack-grade in-app comms | Roadmap | notifications + inbox exist; channels/threads Roadmap |
| 20 | Smart forms + address autocomplete | Partial | selects for enums in places; address autocomplete Roadmap |
| 21 | Engineering hygiene & release gates | Met | build-before-push, docs-with-patch, canonicals, rls-coverage, security-check, GRANT SELECT on invoker views, no .test accounts on prod |
| 22 | Global-ready units | Partial | metric canonical; unit toggle Roadmap |
| 23 | Security checks + stress tests | Met | `security-check.mjs` (RLS/authz, secrets, definer fns/views) + `stress-test.mjs` (quota lock + chain integrity) |
| 24 | Sales & docs kit (corporate site) | Roadmap | Wouri pitch in repo; corporate `/products/[slug]` Roadmap |
| 25 | Automation everywhere (event-driven + agentic) | Met | event triggers (0027) + SQL agentic auto_checks (0028), each with a smoke test |
| 26 | Branded-domain hosting | Partial | wouri.co registered; staging on netlify.app; prod branded domain Roadmap |
| 27 | Auth done right | Partial | login/signup/logout/recovery + branded emails + reset route + password eye toggle; a full `authErrors` map to verify |
| 28 | Shareable watch pages + ShareButton | Roadmap | not built for Wouri yet |

### Wouri-specific (beyond the signature)
The registry-of-record architecture adds guarantees the signature does not name:
effective-dated registry, server-decided plot geometry (PostGIS) with spatial fraud
checks, W3C VC + Ed25519 documents with Merkle-checkpoint anchoring, document
provenance + staleness, enforceable CITES quota and transformation mass balance, and
human signatures. These are documented in `docs/research/08-coverage-and-gaps.md` and
the ADRs, and proven by the self-test suite and the critical-path e2e.
