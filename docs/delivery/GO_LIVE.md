# Wouri go-live runbook

The exact sequence to take Wouri from dev-only to serving a real exporter. Steps
marked **APPROVAL** cost money or are outward-facing and must not be done without the
founder's explicit go-ahead. Everything else is tooled and reversible. No em-dashes.

## Where we are

- Dev project `wouri-dev` (ref iledioojfggozfzebafs), all migrations 0001-0044 applied.
- Staging console at wouri-console-staging.netlify.app (git-CD, backend = wouri-dev).
- Domain wouri.co registered (Namecheap), not yet pointed anywhere.
- Structural go-live bar is GREEN on dev: `node scripts/prod-readiness.mjs`
  (migrations applied, RLS coverage, secrets deny-all, signing keys present, internal
  functions locked). The only warning is dev `.test` accounts, which must be zero on prod.

## The bar before any of this (run now, must be green)

```
npm run preflight          # canonicals, RLS, security, stress, critical-path e2e
node scripts/prod-readiness.mjs
```

## Step 1 (APPROVAL: spend) Provision the production Supabase project

A second Supabase project is a paid line item (note the fleet cost-burn concern: 23
projects already). Do NOT create it without the founder's go-ahead.

Once approved:
1. Create project `wouri-prod` in the TA-TECH org, region eu-central-1 (Frankfurt),
   matching dev.
2. Record ref, DB password, URL, anon + service keys into `.env.local` as
   `PROD_DB_URL`, `PROD_URL`, `PROD_ANON`, `PROD_SVC` (gitignored, never committed).
3. Rotate: the dev service-role key must never be reused on prod. Generate fresh.

## Step 2 Apply the schema to prod (guarded, reversible)

```
PROD_DB_URL="$PROD_DB_URL" node scripts/sync-prod.mjs --confirm
node scripts/init-proof-keys.mjs           # with WOURI_APPLY targeting prod: fresh Ed25519 + HMAC keys
TARGET_DB_URL="$PROD_DB_URL" TARGET_SUPABASE_URL="$PROD_URL" TARGET_SERVICE_ROLE_KEY="$PROD_SVC" node scripts/prod-readiness.mjs
```

sync-prod refuses if PROD_DB_URL is unset, equals dev, or `--confirm` is missing.
prod-readiness against prod must be 0 failures AND 0 `.test` accounts.

Prod gets its OWN proof keys (never copy dev's private key). Documents issued on dev
stay verifiable with the dev public key; prod documents use the prod key.

## Step 3 Seed the registry (real data, not dev fixtures)

Prod starts empty of tenants. Seed only platform reference: commodities + quality
profiles + document templates/bindings + settlement rules + registry_config are in the
migrations. Real CITES quotas and protected-area boundaries are a sourced import (still
open). Do NOT copy dev tenant data to prod.

## Step 4 (APPROVAL: outward-facing) Point the console at prod + the branded domain

1. New Netlify project (or a prod context) with `PROD_URL` + `PROD_ANON` +
   `NEXT_PUBLIC_SITE_URL=https://wouri.co` as env; git-CD from `main`.
2. Branded email: Supabase auth `site_url = https://wouri.co`, `uri_allow_list`
   covers wouri.co + `/reset-password`, branded templates + a custom SMTP FROM
   (Resend), per `scripts/brand-emails.mjs` targeted at prod.
3. DNS (APPROVAL): point wouri.co (apex + www) at the prod console, `verify.wouri.co`
   or `wouri.co/v/{code}` for the verification page. Never expose a raw netlify.app URL.
4. Never ship a `.test` account to prod; the regression suite uses dev only.

## Step 5 Reconcile against a real consignment file (ADR-0030)

Before onboarding the first exporter, reconcile the document bindings against a real
file: fill `docs/delivery/reconciliation-fixture.example.json` from a genuine EUR.1 /
phyto set and run `npm run reconcile <fixture>`. Fix any drift (commodity description,
HS subheading, place-of-origin format are the known candidates) in the registry, on dev
first, then sync to prod.

## Step 6 Cutover checklist (all must be true)

- [ ] `npm run preflight` green on the code being deployed.
- [ ] `prod-readiness` against prod: 0 failures, 0 `.test` accounts.
- [ ] Prod has its own rotated service key and its own proof keys.
- [ ] Branded email works on prod (send a real reset to yourself).
- [ ] wouri.co serves the console over HTTPS; `/v/{code}` renders a real verification.
- [ ] A real consignment reconciled (ADR-0030) or the drift consciously accepted.
- [ ] The critical path passes against the live prod URL:
      `PLAYWRIGHT_BASE_URL=https://wouri.co node scripts/run-e2e.mjs`
      (uses tagged zze2e data, self-cleans; do this in a quiet window).

## Rollback

The console is git-CD: redeploy the previous commit. The database is append-only and
effective-dated; a bad registry change is a new row, not a destructive edit. Nothing
in this runbook deletes tenant data.
