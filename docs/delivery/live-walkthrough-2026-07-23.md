# Live walkthrough and test status, 2026-07-23

A record of testing the deployed staging app end to end, plus the full self-test
suite. House style: no em-dashes.

## What was tested (live, in a real browser on the deployed app)

Target: https://wouri-console-staging.netlify.app (Next 16, git continuous
deployment, Supabase wouri-dev).

| Step | Result |
|---|---|
| Login page | Renders: FR/EN toggle, tagline, show-password eye, magic-link button, forgot/create links |
| Language switch | Click EN, the whole page re-renders in English (and back to FR). No browser auto-translation needed |
| Signup | New account created, autoconfirm on, lands on /onboarding |
| Aza chat onboarding | Typed "We export robusta coffee and timber logs to the EU, need the EUDR file, CITES permits for protected species, and prefinancing." Aza detected LIVE: Timber, Coffee, CITES rail, EUDR rail, Settlement, Financing |
| KB documents (offline) | The same screen listed the 10 documents this consignment needs, from the bundled KB, no API: commercial invoice, packing list, EUR.1, bill of lading, VGM, EUDR DDS, CITES permit, MINFOF specification, phytosanitary, ONCC quality certificate |
| Provision | "Set up my workspace" created the tenant "Moungo Coffee and Timber" with exactly the detected capabilities |
| Home / capability picker | Grouped by category (what you export, compliance rails, field, money, structure). Each capability has a working info tooltip. The Aza-enabled ones read Enabled |
| Public verification page | /v/{unknown-code} shows "Code not found" with the "verified offline with the Wouri public key" note |

Every step passed. This is the "works end to end" regression proof on the live
deployment. The test tenant was cleaned up afterward.

## Full self-test suite (all green)

```
canonicals ....... 132 files, 0 failures     spine ............ 21/21
inference ........ 14/14                       documents ........ 18/18
wouri-selftest ... 19/19                       kb-coverage ...... 15/15
app-path ......... 11/11                       kb-admin ......... 6/6
chat-onboarding .. 12/12
```

116 assertions across 8 suites, 0 failures. Run with `npm test` (canonicals +
inference) and `npm run test:db` (the database and app-path suites).

## Knowledge base now covers the whole app

Aza's KB (aza_kb, 33 entries) now includes an "app" section (15 entries)
describing every feature: what Wouri is, onboarding, capabilities, the custody
spine, the document engine, proof and verification, settlement and the BEAC
clock, financing, field capture, roles, languages, security, resilience, how it
stays current, and the dual-rail moat. Rule going forward: every feature that
ships adds a KB entry (the "fill the KB as we go" rule). A platform admin edits
all of it at /admin/kb.

## Notes

- Platform admin granted to vangwafor@yahoo.com (sign in via magic link, then
  /admin/kb is editable).
- Fabrice UAT (docs/delivery/fabrice-uat-sprint0.md) is ready to run on this URL
  when the founder gives the word; Fabrice is on other projects for now.
