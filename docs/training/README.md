# Wouri training

**Wouri** · The registry of record for African commodity export.

These guides teach the app one area at a time. Each one is short, practical, and
matches a section of the human test suite (`docs/delivery/fabrice-uat-full.md`),
so you can learn a feature and test it in the same sitting. House style: no
em-dashes.

## Who does what

Wouri is role-based per organization. A guide notes the role that usually owns it.

| Role | Owns |
|---|---|
| Owner / Admin | The workspace, capabilities, document branding, the dashboard |
| Export manager | Consignments, allocation, documents, settlement |
| Documentation officer | Documents, verification |
| Field agent | Lots, harvest capture, quality values |
| Finance | Settlement, the BEAC clock, financing |
| Viewer | Read-only across their surface |

A small team wears several hats. Nothing here needs a technical background.

## The guides, in the order you would use them

1. [Getting started](getting-started.md) - sign in, set up your workspace, read the dashboard, find your way around.
2. [Lots, harvest, and quality](lots-harvest-quality.md) - where your chain starts, the two entry points, recording quality, the custody timeline.
3. [Consignments and documents](consignments-documents.md) - build a shipment, allocate lots, issue the export documents.
4. [Shipment tracking](shipments.md) - follow a consignment from the port to arrival.
5. [Verification](verification.md) - what a Wouri certificate is, how anyone checks it, offline.
6. [Settlement and money](settlement-money.md) - the payment instrument, the state machine, the BEAC repatriation clock, discrepancies.
7. [Cockpit, dashboard, and board](cockpit-dashboard-board.md) - the numbers at a glance, live rates and weather, and what needs attention.
8. [Branding and the knowledge base](branding-kb.md) - put your identity on your documents, and (for platform admins) edit what Aza knows.

## The one idea to hold on to

Wouri is a **registry of record**. Its value is that a third party, a buyer, a
bank, a customs officer, can rely on what it says. You are building a trustworthy
file for each shipment, from the plot to the payment. Everything else follows from
that.
