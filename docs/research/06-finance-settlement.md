# Research Track 06: Trade finance and settlement

Does "to settlement" hold up? Sources with URLs and dates.

## How African cocoa and timber actually get paid
- **Cocoa (Cameroon to Europe): Cash Against Documents (documentary collection) dominates, not LC.** LC used mainly for very large shipments. Source: CBI, https://www.cbi.eu/market-information/cocoa-cocoa-products/tips-organise-your-export ; ITC/UNCTAD cocoa trade guide. Cameroon cocoa export is domiciled through the exporter's bank; the whole chain is documentary (MINEPAT 2020).
- **Timber (Cameroon): T/T bank transfer, and (illegally) cash.** EU-bound (large European operators) run on bank transfer; Asian log trade runs on cash. Source: Forest Trends Cameroon dashboard (Aug 2024).
- Documentary collection is governed by URC 522; the bank moves documents but does not guarantee payment. Source: trade.gov.
- **LC document check (UCP 600):** banks deal in documents alone; examiners compare each document to the credit, UCP 600, and ISBP; any nonconformity is a discrepancy; Article 14 gives a maximum 5 banking days; one refusal notice must list every discrepancy. Core documents: invoice, B/L, insurance certificate, inspection/quality certificate, CO, bill of exchange.
- **First-presentation discrepancy rate: roughly 60-70% of LC transactions.** Typical killers: misspelled beneficiary, late shipment, LC expired, amount/quantity conflicts between invoice and B/L, port mismatch, insurance certificate missing number of originals or wrong coverage/place, unsigned/wrongly-signed B/L, documents inconsistent. Sources: JITAL; UNCTAD Documentary Risk; ISBP casebook. Relevance: "to settlement" only earns the claim if it validates the presentation set against the credit before the beneficiary reaches the bank.

## The working-capital gap (the single biggest pain)
- Worked example: pay farmers cash on day 1 (~USD 8,000/ton), ship day 45, buyer pays day 135 on Net-90-from-shipment. Needs USD 50,000-100,000 in working capital to bridge; most African exporters lack it. Sources: LinkedIn/Mawaka; AVEC Africa/Adalidda.
- Structures that close it (Wouri's opportunity surface): pre-export finance against contracts/POs/offtake repaid from proceeds into a controlled account (Financely lists the credit support a lender wants: "offtake contract, buyer track record, warehouse receipts, quality reports, export licenses and receivables assignment"); warehouse receipt finance / collateral management (FAO i3339e; used mainly by large traders/exporters, which fits Wouri); a live cocoa case using pre-export WRF + SGS + offtake-backed repayment (Vicage); receivables factoring (~80% advance, Afreximbank flagship).

## FX, pricing, and BEAC repatriation
- **Pricing: PTBF against ICE is dominant.** Contracts moved to price-to-be-fixed at the prevailing futures price; the "differential" is a premium/discount to a defined futures contract. Cameroon cocoa is deliverable on the London ICE contract and typically trades at a discount. ICE: London (GBP) and New York (USD), 10 metric tons, months Mar/May/Jul/Sep/Dec. So `price_mode` = tbf/differential is correct, but a differential needs the terminal reference (which month, which exchange/currency, the premium in the same currency).
- Currency exposure: London GBP, New York USD, CME Europe EUR; the exporter earns in one and reports/settles in XAF, so there is a live FX leg on every fixing.
- **BEAC/CEMAC repatriation is a hard obligation.** Article 55, Reglement No 02/18/CEMAC/UMAC/CM: exporters of goods and services have **150 days from the effective date of export to collect and repatriate proceeds**, credited via the same domiciled bank. Every export over threshold must be DOMICILED with a CEMAC bank (thresholds cited XAF 5,000,000 general / 10,000,000 in the 2022 instructions). **The 35% minimum repatriation rate applies to the EXTRACTIVE sector only**; cocoa/timber owe effectively FULL repatriation within 150 days. Enforcement tightening (IMF Country Report 25/64, 10 Feb 2025). Sources: BEAC official text; Clarence Abogados. Why it gates settlement: money in the buyer's country is not "settled" for a Cameroonian exporter until repatriated within 150 days.

## Insurance and Incoterm responsibility
- Only **CIF and CIP** oblige the seller to insure. CIF: minimum ICC (C). CIP: minimum ICC (A) (upgraded from C in Incoterms 2020). FOB/CFR/FAS/EXW: no seller insurance obligation.
- Clauses: ICC (A) all risks (CL382); (B) (CL383) and (C) (CL384) named perils; War (CL385) and Strikes (CL386) separate add-ons.
- Risk/cost split trap: under CIF the seller pays freight + insurance but RISK passes when goods are on board. "Who paid" and "who bore the loss" are different fields.
- LC linkage: an insurance certificate naming a different place than the LC is rejected. It belongs in both the document engine and the registry.

## Landed cost and margin
`cost_entries` + `cost_pools` + `consignment_margin` are directionally right. Exporters under-cost by omitting certification, testing, inspection (SGS/ONCC), and pre-financing interest. The structural addition: financing cost (interest over the ~135-day gap) and the FX result at fixing are cost/margin lines, or landed cost looks profitable while the deal loses money on carry and currency.

## Assessment against the "to settlement" claim
Not credible as written, but the fix is small because the document engine already exists. Minimum viable settlement modeling:
1. `settlement_instrument` on the contract: type (LC / documentary_collection / CAD / advance / open_account), and for LC the key terms (banks, amount, currency, latest shipment, expiry, tenor).
2. `presentation` record: the actual document set, presentation date, and a per-document `discrepancy` list with status (raised / waived / cured). Reuses the document registry as line items.
3. A settlement state machine: contracted -> shipped -> documents presented -> accepted/discrepant -> paid -> **repatriated**. Only "repatriated" is truly settled for a CEMAC exporter.
Without (2), the product says "your file is complete" while the bank refuses to pay.

**Working-capital: killer feature if scoped as records, not lending.** Wouri already holds the offtake, quality reports, warehouse/inspection data and export documents. Minimal safe version: `warehouse_receipt` records (commodity, grade, quantity, warehouse/collateral-manager, inspection ref, borrowing-base value); reuse `payment_requests` for farmer-payment-out and finance-advance-in/repayment-from-proceeds; a cash-timeline view per contract. Later: an "export-ready finance package" export. Wouri is the origination file, never the balance sheet.

**FX repatriation: make it first-class.** A `domiciliation` record (bank, file reference, threshold), a repatriation clock (start = effective export date, deadline = +150 days), status (pending/repatriated/justified-exception), and the same-bank linkage. Do NOT hardcode the 35% rate (extractive only).

**Insurance and Incoterm as spine additions:** `incoterm` (2020) on the contract, deriving two flags (who insures, where risk transfers); `insurance_certificate` first-class with the LC-checked fields (ICC clause, insured amount + currency, number of originals, route endpoints), cross-checked against Incoterm and LC.

## Improvements, ranked by leverage
1. Discrepancy-tracked document presentation layer (highest leverage, smallest build).
2. BEAC 150-day repatriation + domiciliation clock as a spine state.
3. Working-capital records (warehouse_receipt + payment_requests reuse + cash-timeline).
4. settlement_instrument + settlement state machine ending at repatriated.
5. Incoterm + insurance_certificate first-class, cross-validated.
6. Extend cost/margin with financing cost + FX result at PTBF fixing; nail the PTBF/differential to a terminal reference.
