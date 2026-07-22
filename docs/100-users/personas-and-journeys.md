# Users: personas, the four questions, and journeys

No em-dashes.

## The four questions every screen serves
Users are not looking for software; they want an answer to one of these. A screen that answers none should not be built.
1. What is blocking my shipment? (export manager, every morning)
2. What do I type next? (documentation officer, all day)
3. Did I record it? (field agent, in a plantation, on one bar of signal)
4. Did we make money? (managing director, once a week)

## Personas
- **Export manager.** Owns the shipment. Home is the readiness board: every open consignment ranked by risk of missing its window, each showing its single most urgent blocker, the owner, and the age. Not a chart. A list of what is wrong, worst first.
- **Documentation officer.** Lives in the consignment file. Needs the document set to be consistent and the dependency graph visible (the bill of lading cannot issue because the VGM is not declared; changing the net weight just made four documents stale). Needs discrepancies shown side by side with one button to fix at the source.
- **Field agent (buying agent, warehouse, quality controller, forest crew).** Standing in a plantation or a log yard, bright sun, one hand, gloves, 2 GB of RAM, no signal. One task per screen, camera first, always writable, sync state always visible and honest, French default.
- **Managing director.** Once a week: the margin, and the 150-day repatriation clock. Trusts the number because it is computed from the file, not typed.
- **Finance / documentation for settlement.** The presentation set, the discrepancy tracker, the letter-of-credit terms, the BEAC clock.
- **The non-customer verifiers** (the most-viewed surface): a customs officer at Douala, a compliance analyst in Hamburg, a bank's documentary-credit desk. They hold a document and scan its code. They never log in. The verification page on wouri.co is built for them.

## Capability gating shapes the persona
A cocoa-only tenant's manager never sees a CITES screen; a trading house without a plantation has no field agent surface. The persona a member experiences is the intersection of their role and the tenant's capabilities.

## Day-30 journey (a cocoa exporter)
1. Day 0: EUDR-readiness assessment on wouri.co catches a plot gap; the exporter creates a tenant (chat or click).
2. Week 1: the guided first consignment reaches a verified document; the team is invited; the field agent maps three plots offline.
3. Week 2: the readiness board becomes the 7am habit; a weight mismatch is caught before the bank; the DDS reference is filed in TRACES.
4. Week 3: a document is verified offline by a buyer; identity verification advances the Wouri Verified mark.
5. Week 4: the margin and the repatriation clock on the MD's weekly view; the first clean consignment starts the reputation record.
