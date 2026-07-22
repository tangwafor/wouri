# Registry: the seeding method (the moat)

Traces to ADR-0002, ADR-0022, and section-11 decision 5. The registry is the platform-owned common good and the one part software cannot do for you. Budget real hours. No em-dashes.

## What gets seeded
Every effective-dated, cited, certainty-flagged reference row: commodities and packs, hs_codes, document_types and dependencies, document_requirements, compliance_regimes and requirements (EUDR), country_risk, species (cites_appendix + annotation + population scope), permits domains, duty_rates, levies, deadline_rules, validation_rules, quality_attributes and grade_rules, units, currencies, capability_catalog, integration_connectors.

## The four rules for every row
1. Effective-dated (valid_at tstzrange). A consignment validates against the rules in force on its relevant date, via its pinned pack version.
2. source_citation and last_verified_at. A rule you cannot cite is a rule you invented. Tenants see the citation; that is how the registry sells as an asset rather than a claim.
3. certainty (confirmed, probable, unverified). Where you do not know, the row says unverified and the UI says so plainly. Aza says "I do not know" and shows the citation gap.
4. No regulatory figure in application code. All lookups. A canonicals grep gate fails the build on a numeric literal near a regulatory identifier.

## How to seed responsibly (the verification protocol for rules)
- Each rule row is entered with its legal source (a finance law, an arrete, a CEMAC decision, an EU regulation number and date, a CITES CoP decision) and the date last verified.
- Fast-moving domains carry a recheck cadence. Known movers: EUDR dates (delayed twice), Cameroon banned-species list (31 to 76 to 91), CEMAC log-export ban (2028), CITES CoP outcomes, BEAC repatriation enforcement, CAMCIS as the live customs system.
- A rule changing is an INSERT of a new effective-dated row, never an edit of history and never a migration.

## Seeding scope by beachhead
Seed cocoa-to-EU first (the recommended beachhead): the EUDR requirements, EUR.1-CMR origin, phyto/ePhyto, VGM, the ONCC grade, the cocoa levies, the Douala and Kribi port rules. Then timber: the CITES species and annotations, the specification bulletin, ATIBT grades, the FET and royalties, the SIGIF 2 reconciliation. The research reports (docs/research/) hold the sourced facts to seed from; re-verify the fast-moving ones at seeding time.

## The network effect
A tenant inherits this registry on day one and seeds nothing. One verified rule benefits every tenant instantly. A code-baked competitor needs a redeploy for each change; Wouri does not. This is the core moat and the reason to invest real verification hours here first.
