# Wouri CONTINUE.md (session handoff)

## Infrastructure
- **Supabase dev project: `wouri-dev`** created 2026-07-22, ref **`iledioojfggozfzebafs`**, org TA-TECH (ztmoyoyidphoifjduktn), region **eu-central-1 (Frankfurt)**. Env (ref, DB password, URL, anon + service keys) saved to `wouri/.env.local` (gitignored, never committed). URL: https://iledioojfggozfzebafs.supabase.co. To drive it via MCP, add a `supabase-wouri` MCP server for this ref (or use the Management API with the fleet token). This clears one of the two Sprint 0 blockers; the other is the green light to copy the Bazah substrate.

## Domain
**wouri.co** registered on Namecheap 2026-07-22 (active through 2027-07-22, domain privacy on). This is the home of the public verification page, the most-viewed Wouri surface (a document held by a non-customer resolves its QR here). Plan the verification route now: a public `wouri.co/v/{verification_code}` (or `verify.wouri.co`) that resolves through a SECURITY DEFINER function and renders the Verifiable Credential, plus per-tenant `verification_subdomain` on organizations for a tenant-branded verify page. The verification page gets the same design investment as the dashboard.

## 2026-07-22 - Sprint 0 database foundation LIVE + verified on wouri-dev
Migrations 0001-0007 applied to wouri-dev (identity, orgs, roles, memberships, event spine, capabilities, currencies/fx/units, the PulSe atomic create_organization RPC, RLS deny-by-default). `scripts/wouri-selftest.mjs` = **19/19 green** (RLS isolation with positive controls, atomic signup, tenant A cannot see B, capability gating, self-cleaning). `scripts/apply-migrations.mjs` is the idempotent runner (uses SUPABASE_DB_URL in .env.local). packages/offline lifted from Bazah (@wouri/offline, event queue only); packages/core (money/fx/units); brand/tokens.css. check-canonicals clean. Run: `node scripts/apply-migrations.mjs` then `node scripts/wouri-selftest.mjs`.
- **apps/console (Next 15) BUILT + typecheck-clean (HEAD 19887b1):** Supabase @supabase/ssr server+browser clients + session middleware (console never holds the service role); login (password + magic link), signup -> atomic create_organization RPC, forgot-password + reset, /auth/callback code exchange; home with the org card + pick-and-choose capability picker (writes organization_capabilities under the user session); fr/en i18n (French default); brand tokens. **Branded email templates** (confirmation/recovery/magic-link/invite) + site_url + redirect allow-list SET on wouri-dev via `scripts/brand-emails.mjs`. Dev email autoconfirm ON. `scripts/verify-app-path.mjs` = **11/11 green** (anon-key + auth session + RPC + RLS end to end). Run the app: `cd apps/console && npm run dev` (port 3400). `apps/console/.env.local` has URL+anon only (gitignored).
- **Chat-or-click onboarding BUILT + proven (ADR-0028):** `apps/console/src/lib/onboarding/infer.mjs` = Aza's pure, deterministic inference (free-text business description -> capability keys, dependencies closed: cites->timber, financing->settlement, any commodity->eudr). `/onboarding` (OnboardingChat.tsx) runs it live client-side (detected capabilities update as you type, no round trip), then `actions.provisionWorkspace` creates the org via the RPC + enables the inferred capabilities in one atomic step. Signup is now account-only -> /onboarding; /home and the auth callback route a no-org user to /onboarding. TWO self-tests, both green on Windows with no browser: `scripts/onboarding-infer-selftest.mjs` **9/9** (the inference contract, incl. the "plots means field-capture not eudr" fix) and `scripts/verify-chat-onboarding.mjs` **12/12** (the whole path against wouri-dev through the real client: infer -> RPC -> enable -> exact-set + RLS + has_capability + self-clean). The click path (CapabilityPicker on /home) provisions the identical graph.
- **Repo on GitHub + CI (activation blocked on account billing):** pushed to **github.com/tangwafor/wouri** (private). `.github/workflows/ci.yml` has a `gate` job (npm ci, canonicals, Aza inference contract, and the DB self-tests guarded to run only when Supabase secrets are set) and a `console` job (npm ci, tsc, `next build` = the cloud build-verification this Windows box cannot do). First run **could not start: GitHub Actions billing/spending-limit on the tangwafor account** (same block as Bazah). YOU clear it in GitHub -> Billing & plans; the workflow is correct and runs the moment it is. To run the DB self-tests in CI, add repo secrets SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Root scripts: `npm test` (canonicals + infer), `npm run test:db` (the three DB/app-path suites).
- **Fabrice UAT for Sprint 0 written:** `docs/delivery/fabrice-uat-sprint0.md` = the guided human walk (22 steps, pass/fail) for the auth + chat/click onboarding + two-tenant isolation, matching the kanban Sprint 0 gate ("see only your org"). Run it on staging once deploy is unblocked; the machine half is already green in the three self-test suites.
## 2026-07-22 - Sprint 1 + Sprint 2 built (ADR-0030 gate override)
The founder overrode ADR-0027 (freestyle, no real consignment file yet); recorded as ADR-0030. Reconcile the spine fields and the Cameroon document bindings against a real issued document when one arrives.
- **Sprint 1 spine (0008-0012), proven 21/21 (`npm run selftest:spine`):** commodities, parties, origin_units + effective-dated versions + evidence, lots (origin_claim enum; CITES-not-mass-balance moat rule enforced), transformations, lineage, contracts, consignments + consignment_lots, cost_entries, tasks. lot_events append-only + client-minted uuid: the SERVER seals a per-lot hash chain and counter-signs every event onto a per-tenant server chain with a server-held HMAC key (wouri_secrets, unreadable by clients). verify_lot_chain recomputes + DETECTS tampering. Corrections are compensating events (void_lot_event), never deletes. Controlled purge path (0012, wouri.purge GUC) for tenant teardown. RLS deny-by-default + column grants so clients set only safe lot_events columns. Registry v1 cocoa quality_attributes + registry_audit (0011).
- **Sprint 2 document engine + proof (0013), proven 18/18 (`npm run selftest:documents`):** document_templates (EUR.1-CMR, phyto, VGM, quality_cert seeded, bindings PROVISIONAL per ADR-0030), quality_values, documents. resolve_document builds content from the spine + reports unbound + weight consistency. issue_document re-resolves and REFUSES unbound fields or a weight mismatch server-side, idempotent by content_hash. Each document is a **W3C VC with an Ed25519 signature** (`apps/console/src/lib/proof/vc.mjs`, node:crypto; keys in wouri_secrets via `npm run proof:init`, public key exposed via get_proof_public_key). verify_document(code) is the public (anon) surface. Proven: unbound blocks, weight mismatch caught, **offline verify with the public key alone**, idempotent issuance, revoked reads revoked, tamper of subject AND signature detected.
- **Public verification page** `/v/[code]` built in the console (server component, verifies the signature server-side, branded institutional seal, valid/revoked/invalid/notfound states). This is the wouri.co/v/{code} surface a QR resolves to. tsc clean.
## 2026-07-23 - Training (docs + interactive) + Expo field app scaffold
- **Training guides** `docs/training/` (7 guides + index with a role map): getting-started, lots-harvest-quality, consignments-documents, verification, settlement-money, cockpit-dashboard-board, branding-kb. Practice: write the training doc as each feature lands.
- **Full Fabrice UAT** `docs/delivery/fabrice-uat-full.md` = whole-app human walk (23 steps, plot to payment), aligned to the guides. Ready to hand to Fabrice on the founder's word.
- **Interactive branded training (published Artifact):** https://claude.ai/code/artifact/9d23d389-143a-4453-b45a-788060dc24ed - end-to-end journey (10 steps) + knowledge check (80% gate) + printable branded certificate; localStorage progress. Source committed at `docs/training/interactive-training.html` (redeploy: republish that path).
- **Expo field app scaffold** `apps/field/` (NOT built on Windows; EAS/device only): expo-router login + harvest capture (commodity, lot, plot, area, GPS via expo-location, photo via expo-image-picker), offline queue (`lib/queue.ts`, AsyncStorage, client-minted ids) that syncs to `create_lot_at_origin`. Follow-ons in its README: photo upload to storage, boundary-walk polygon, background sync. Set the anon key in app.json extra at build.

## 2026-07-23 - Reactive layer, agentic auto-checks, and the architecture-review hardening
Two waves in one session.

**Wave 1 (reactive + agentic), HEAD ~39f02b4:** 0027 event triggers + notifications
(a document issued, discrepancy, settlement repatriated, shipment moved -> a
tenant-scoped notification; /inbox + real-time bell; events-selftest 7/7). 0028
SQL agentic auto-checks (stored SELECTs the board misses; run_auto_checks opens,
re-affirms, auto-resolves; hourly pg_cron; platform-admin gated SQL;
autochecks-selftest 9/9). Post-harvest processing events on the lot detail
(fermentation/drying/sorting/... via record_lot_event). Tavily e2e coverage sweep
(plot to paid) in docs/research/08.

**Wave 2 (architecture-review hardening, HEAD 2ebfb86), all 4 tracks done + a
phyto correctness fix first:**
- **0029 phyto place-of-origin fix:** it had read the DESTINATION country (a false
  declaration). Now derives from the exporter location; required + guarded by a
  positive-control test in document-selftest.
- **Track 1 (guardrails + structural):** 0030 registry_config + cfg_num (board
  windows + weight tolerance are rows now). check-canonicals: regulatory-literal is
  a HARD failure, stems fixed, scans view/function bodies (seed inserts exempt),
  `-- canon:allow-literal` opt-out, and it now scans untracked files too.
  scripts/rls-coverage.mjs (every anon/authenticated-reachable table has RLS;
  exempts extension-owned tables). 0031/0032 organization_groups tenant-of-tenants
  with consented membership (org-groups-selftest 9/9; 0032 fixed recursive RLS).
  0033 external_references (killed the dds/besc/insurance column-per-authority;
  board + auto-check repointed; columns dropped).
- **Track 2 (keystone) 0034:** resolve_document is data-driven over
  document_field_bindings (closed source-kind vocabulary), not a branch per type;
  document_bindings records per-field provenance; issue_document stores it.
  Adding a doc type = inserting rows (proven). document-selftest 21/21,
  bindings-selftest 8/8.
- **Track 3 0035 (PostGIS):** geography column, server-computed area/centroid/
  validity, client area advisory, point-cap in registry; spatial fraud signals
  (overlap, self-intersect, protected-area, point-over-cap) as auto_checks;
  protected_areas table. spatial-selftest 8/8.
- **Track 4 (moat):** 0036 quota_ledger (CITES quota never negative, row-locked;
  cites_quota_status aggregate; quota-selftest 8/8). 0037 transformation_inputs/
  outputs + record_transformation (mass cannot be created; backstop auto_check;
  transformation-selftest 7/7).

Migrations now 0001-0037. New gates: `node scripts/rls-coverage.mjs`. New KB APP
entries: provenance, geometry, quota, mass_balance, groups, processing, events,
auto_checks. Everything applied to wouri-dev; check-canonicals + rls-coverage +
tsc + next build all green. NEXT candidates (roadmap, not blocking): field-app
boundary polygon, real CITES/protected-area data import, EUDR risk-assessment
record + TRACES filing, GUCE single-window, Merkle checkpoints, human signatures.

## 2026-07-23 - Third review pass: staleness feature, critical-path e2e, conformance fix (0043-0044)
A reviewer read the code (not filenames) and made two fair pushes; both actioned.
- **Document staleness (0043)** was a genuinely MISSING feature (provenance existed,
  the projection did not). resolve_document split into resolve_document_core
  (unchecked, ungranted) + membership-gated wrapper; document_staleness (gated, UI) +
  document_stale auto_check. Amend a source value -> document flagged stale with
  field/was/now; revert or revoke clears it. staleness-selftest 9/9.
- Building it EXPOSED a real leak in my own code: SECURITY DEFINER functions keep the
  default PUBLIC execute grant, and `revoke from anon, authenticated` does NOT remove
  it. So the unchecked resolvers AND notify() (writes notifications for any org) were
  client-callable. **0043 + 0044 revoke PUBLIC** on them; security-check.mjs gained an
  "internal definer functions not client-executable" assertion. (Class fix + guard.)
- **Critical-path e2e (canonical CRITICAL_PATH_E2E)**: apps/console/playwright/
  critical-path.spec.ts = ONE self-cleaning run (tag zze2e): create a consignment in
  the browser -> verify page AUTHENTIC -> revoke -> REVOKED -> weight mismatch refused
  -> amend -> stale -> tenant B sees none of A. Passes vs BOTH localhost AND the live
  staging deploy (PLAYWRIGHT_BASE_URL). Runner `scripts/run-e2e.mjs` +
  `scripts/e2e-cleanup.mjs --check` (proves clean). npm: gate:e2e.
- **Conformance drift fixed**: I had invented Wouri rows into a file the drift gate
  would flag. Now `docs/TATECH_STANDARDS.md` = the canonical verbatim (version stamp
  2026-06-16.1) with an honest `## Conformance (Wouri)` section (mostly Partial/
  Roadmap) below the heading; removed the invented root TATECH_STANDARDS.md.
- STILL OPEN (not code): ADR-0030 real consignment file (now CHEAP since bindings are
  rows and staleness/provenance exist - do it sooner); full biometric matching;
  video walkthrough (#7); watch pages (#28); prod project + branded domain.
- Migrations now 0001-0044. New: `npm run gate:e2e`, `selftest:staleness`. All gates
  green; tsc + next build clean; critical path green vs live.

## 2026-07-23 - Second review pass: remaining gaps closed (migrations 0038-0042)
Everything the architecture review named, plus the standards/testing gate. All on
wouri-dev, HEAD f9b7a52, each with its own self-test, all green.
- **0038 Merkle anchoring** (ADR-0004/0008): anchor_documents publishes a signed
  checkpoint (Ed25519 root, same server key); document_inclusion_proof rebuilds the
  proof from the append-only set (no leaves stored), anon-callable. JS verifier
  `apps/console/src/lib/proof/merkle.mjs` mirrors the SQL. anchor-selftest 8/8.
- **0039 human signatures**: producer thumbprint / driver / supervisor, with role,
  method, timestamp, GPS, hash of the capture (never raw biometrics); a lot signature
  is sealed into the lot chain. signatures-selftest 9/9. NOTE for user: this is a
  CONSENT MARK, not biometric identity matching (answered mid-session); real 1:1
  fingerprint match = separate hardware+privacy project.
- **0040 EUDR Article 10 risk record**: origin_unit_risk per plot (dataset+version,
  deforestation_free, cutoff, legality, level); auto_checks for missing/high risk.
  risk-selftest 5/5.
- **0041 image_profiles** (ADR-0021): registry + record_media_asset REQUIRES the
  original hash (hash-before-processing). media-selftest 6/6.
- **0042** registry_freshness -> security_invoker (clean security-check rule).
- **Standards gate**: `TATECH_STANDARDS.md` conformance table; `scripts/
  security-check.mjs` (RLS + deny-all secrets + anon-allowlist + no definer views,
  6/6); `scripts/stress-test.mjs` (quota lock + chain integrity under concurrency,
  4/4); `scripts/ui-qa-sweep.mjs` = Playwright render sweep over public + operator
  pages, 2/2 (needs `npx playwright install chromium`). All wired in package.json:
  `npm run gates`, `npm run gate:ui`, extended `test:db`.
- New KB APP entries: anchoring, human_signatures, eudr_risk, media (+ earlier
  provenance/geometry/quota/mass_balance/groups). Gates: canonicals + rls + security
  + stress all green; tsc + next build clean; kb-coverage 16/16.
- REMAINING (roadmap, not gaps in the code): field-app boundary polygon, real
  dataset/quota/protected-area imports, TRACES DDS filing + GUCE integration, EORI,
  biometric matching, a real consignment file (ADR-0030), prod project, full RBAC.

## 2026-07-23 - The whole operator chain is in the UI (source to settlement), proven live
The console is now a full operator app, walked end-to-end on staging:
- **Owner dashboard (/home):** KPI cards (consignments, lots, documents, blockers), a "needs attention" panel (ranked readiness blockers, critical first), the repatriation clock (nearest due / overdue), recent consignments, quick actions. "Owner sees all he needs." Capabilities moved to a secondary "Your activities" card.
- **/lots:** the entry-point toggle (At harvest = capture plot + polygon + harvest event; Received after harvest = supplier + receipt). All 8 commodities. EUDR origin-gap flag (never blocks). create_lot_at_origin / create_lot_post_harvest (0021). lot-entry-selftest 12/12.
- **/consignments + /consignments/[id]:** create, allocate lots (carries quantity), issue documents, open settlement + advance the state machine + watch the BEAC clock. All RPC-backed, RLS-scoped.
- **Documents:** issue signed docs from a consignment via a server action that reads the Ed25519 key from a SERVER-ONLY env var (WOURI_PROOF_PRIVATE_PEM_B64, set on Netlify + .env.local; never NEXT_PUBLIC). 0022 lets docs resolve against allocated-lot weight when no contract.
- **/v/[code]:** a BRANDED, PRINTABLE, E-SIGNED certificate meeting the docs standard: Wouri seal + logo, verdict (authentic/revoked/altered), fields, **timestamp** (issued on), **location** (place of issue), **e-signature** block (Ed25519), and a **QR** to verify. Print CSS.
- **App shell:** AppNav across every surface; a polished design system (globals.css: focus states, shadows, dark-mode tokens, reduced-motion).
- **LIVE walkthrough passed:** signup -> harvest a cocoa lot with a plot polygon -> consignment -> allocate -> issue EUR.1 (signed on the deployed server) -> the branded certificate rendered with all four marks + QR. Dashboard populated correctly.
- **Full suite: 153 assertions, 11 suites, 0 failures** (added settlement 15, readiness 9, lot-entry 12). KB now 36 entries (added app.origin, app.readiness, app.dashboard). Founder is a platform admin (vangwafor@yahoo.com).
- NEXT ideas: live cockpit (real-time FX + weather hotspots), quality-value capture UI, the Expo field app, per-tenant doc branding.

## 2026-07-23 - Sprint 3 slices: settlement + readiness board
- **Settlement spine + BEAC clock (0019), proven 15/15** (`npm run selftest:settlement`): settlement_rules (150-day window as effective-dated DATA, not hardcoded), settlement_instruments (draft->presented->accepted->paid->repatriated), settlement_discrepancies. A discrepancy blocks acceptance + payment. settlement_advance enforces order; is_consignment_settled true only when repatriated ("settled means repatriated"). settlement_clock view (security_invoker) = due date + days_remaining + overdue. RLS org-scoped.
- **Readiness board (0020), proven 9/9** (`npm run selftest:readiness`) + **console /board page** (linked from /home): readiness_board view (security_invoker) ranks blockers - repatriation overdue (critical), window closing soon (warning), open discrepancy (high), overdue task (high). Rebuildable Layer-3 projection, RLS-scoped.
- KB now 34 entries (added app.readiness). Full test:db suite now 9 DB suites.

## 2026-07-23 - Live walkthrough passed + KB covers the whole app
- **Live browser walkthrough on staging = all green** (docs/delivery/live-walkthrough-2026-07-23.md): login + FR/EN switch, signup -> Aza chat onboarding (LIVE detected Timber/Coffee/CITES/EUDR/Settlement/Financing from free text + listed all 10 needed documents from the offline KB), provisioned "Moungo Coffee and Timber" with exactly those capabilities, grouped picker + tooltips, public /v/ verification not-found state. Test tenant cleaned up.
- **Full self-test suite: 116 assertions, 8 suites, 0 failures** (`npm test` + `npm run test:db`): canonicals 132 files, infer 14, wouri 19, app-path 11, chat 12, spine 21, documents 18, kb-coverage 15, kb-admin 6.
- **Aza KB now covers the WHOLE app** (aza_kb 33 entries; new `app` kind, 15 entries: what Wouri is, onboarding, capabilities, custody spine, document engine, verification, settlement/BEAC, financing, field, roles, languages, security, resilience, stays-current, dual-rail moat). RULE: every feature that ships adds a KB entry ("fill the KB as we go"). Edit at /admin/kb.
- **Platform admin granted** to vangwafor@yahoo.com (account created + confirmed; sign in via magic link, then /admin/kb is editable). Fabrice UAT ready when the founder says go.

## 2026-07-23 - Console is LIVE on staging
**https://wouri-console-staging.netlify.app** serves: /login + /signup 200, / + /onboarding 307 (auth redirect), /v/[code] 200 (renders the verification state). git continuous deployment is on (push to master auto-deploys). The staging URL is in the Supabase auth redirect allow-list (brand-emails.mjs), so magic-link / reset / confirm email links work on staging. NEXT: run the Fabrice UAT (docs/delivery/fabrice-uat-sprint0.md) on this URL.
- **ROOT CAUSE of the exit-2 saga (fleet-wide lesson):** Netlify BLOCKS deploys of Next versions with a critical CVE. Next 15.1.6 is affected by CVE-2025-55182, so the function upload failed with HTTP 400 and the build reported exit code 2 with a generic "building site" message. The build always compiled; only Netlify's security gate refused it. Fix: `next@16` (tsc + build clean). Any fleet app on Netlify + an old Next will hit this.

## 2026-07-23 - Netlify deploy: (RESOLVED) was blocked by Next CVE, see above
Site **wouri-console-staging** (id 3778de68-45cb-4e54-8366-3f0f2984aef7, https://wouri-console-staging.netlify.app) created; public env set (URL + anon + NEXT_PUBLIC_SITE_URL); git connected to tangwafor/wouri (GitHub App authorized). Root `netlify.toml`: base apps/console, plugin @netlify/plugin-nextjs, NODE_OPTIONS 4096, NODE_VERSION 20.
- **The app builds cleanly EVERYWHERE except Netlify's cloud:** local `next build` exit 0 (even after `rm -rf node_modules && npm install` fresh, with the real env + heap cap), local `netlify build` (plugin) completes and bundles the server handler, and GitHub CI console job is green. So code + command + config are proven good.
- **Netlify git-CD build fails:** `Failed during stage 'building site': Build script returned non-zero exit code: 2` on every commit once base was applied. Not OOM (heap raised), not the plugin (plugin_state success; removed the vendored copy), not compile (builds everywhere else). Cause is Netlify-cloud-specific and the build LOG is only readable from the Netlify UI (CLI token is in the OS keyring; no public deploy-log API/MCP).
- **Manual CLI deploy is a dead end for this:** `netlify deploy` does NOT upload the plugin's `functions-internal` SSR handler (available_functions: []), so every route 404s even though functions bundle locally. Next SSR on Netlify needs the git-CD cloud build.
- **Gotchas found + fixed:** the Ed-middleware forced an edge function that dragged in deno vendor files with `#` in the name (breaks deploy) and an @opentelemetry/api resolve error -> **removed `src/middleware.ts`** (server components refresh the session via getUser anyway); vendoring @netlify/plugin-nextjs put a `#` file in node_modules -> let Netlify install the plugin.
- **NEXT STEP (needs founder, 2 clicks):** open the failed deploy at https://app.netlify.com/projects/wouri-console-staging/deploys -> latest -> "Deploy log", copy the `next build` error lines, paste them back. That log names the exact cause and it is a one-shot fix. Alternative: the console builds perfectly, so Vercel (native Next, zero-config) would deploy it immediately if we choose that host for staging.
- **Sprint 0 REMAINING (ungated):** apps/field (Expo); finish this staging deploy; then execute the Fabrice UAT (docs/delivery/fabrice-uat-sprint0.md) on the live URL. NOTE: local Next/Expo BUILD fails on this Windows box (corepack/symlink), so RUNTIME UI verify is via cloud (Netlify) or a Linux box, like akongne. tsc typecheck + the DB/app-path self-tests all pass locally.
- Then, with ONE real consignment file: Sprint 1 (the spine) + Sprint 2 (the document engine).

## 2026-07-22 - Research and planning complete; nothing built
Wouri is a new project: the trust and credit layer for African commodity export (Cameroon cocoa and timber first), a registry of record, not a marketplace. House style: no em-dashes.

**What exists in this repo (all documentation, no code yet):**
- `docs/build-plan.md` - the v0.1 structural reference (schema layers, brand, stack, phases, section-11 decisions).
- `docs/research/01..07` - seven cited research tracks (EUDR, Cameroon systems, documents/digital standards, CITES/competitors, architecture, finance/settlement, tenant network).
- `docs/delivery/sprint-kanban.md` - six sprints, each ending on four green gates (build, e2e sweep, machine self-test, Fabrice UAT).
- `docs/pitch/investor.md`, `docs/pitch/customer.md`.
- `artifacts/synthesis.html`, `artifacts/sprint-kanban.html`, `artifacts/pitches.html` - the rendered branded versions.
- Published artifacts (claude.ai): synthesis 085c5cbd-312d-4e34-b8e2-de3cdfea25d0; sprint-kanban 48db3304-c02b-4b4f-bdc5-09de9d8cdd30; pitches 929575ed-f0d9-4b1a-9d79-64ba7baf439e.

**The reframe:** build the trust and credit layer. Three wow features: the self-verifiable consignment (W3C VC 2.0 + Merkle checkpoints + vLEI, verify offline without Wouri), the financeable consignment (reputation as collateral; never lends), the continuously-verified consignment (re-screen shipped lots). The category no one serves: the dual-rail lot (EUDR + CITES on one consignment).

**The wedge:** EUDR applies 30 Dec 2026 (large/medium), 30 Jun 2027 (micro/small). No DDS reference number, the container is held at the EU border.

## NEXT (in order)
1. Founder answers the section-11 decisions (research answers most in the synthesis).
2. **See one real consignment file before generating the handoff bundle or starting Sprint 1** (the one hard rule).
3. Generate the section-10 Claude Code handoff bundle with the research fixes and the three wow features folded in as first-class components, then run Sprint 0.

## Open decisions for the founder
- Beachhead: cocoa first (research-recommended) vs timber. The live cockpit (worth-now, margin-now, BEAC clock, weather) as its own surface vs folded into the readiness board. Aza's name shared with Bazah or not. Does Bazah pause.

## Key facts to re-verify at build time (fast-moving)
EUDR dates and amendments; Cameroon FLEGT VPA termination (June 2025); CITES CoP20 outcomes (Dec 2025, delistings rejected); BEAC 150-day repatriation enforcement; the banned-species list (91 as of April 2026); CAMCIS as the live customs system.
