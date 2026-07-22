# Research Track 04: CITES species compliance + competitive landscape

Sources 2022-2026 with URLs.

## Part A: CITES and species for Central African / Cameroonian timber

Annotation is as load-bearing as the appendix: it defines which commodity forms are regulated. #17 = logs, sawn wood, veneer, plywood, transformed wood. #15 = all parts/derivatives with small exemptions. #7 = logs, chips, powder, extracts. Finished products generally exempt.

| Species | Common (Cameroon) | Appendix | Annotation | In force | Note |
|---|---|---|---|---|---|
| Pericopsis elata | Assamela/Afrormosia/Obang | II | #17 | App II since 11 Jun 1992; #17 since 26 Nov 2019 | RST; export quotas + NDF |
| Afzelia spp. (African) | Doussie | II | #17 | 23 Feb 2023 (CoP19) | African populations only |
| Khaya spp. (African) | Acajou | II | #17 | 23 Feb 2023 (CoP19) | African populations only |
| Pterocarpus spp. (African) | Padouk/Kosso | II | #17 | 23 Feb 2023 (CoP19) | P. erinaceus 2017, P. tinctorius 2019, folded into #17 |
| Guibourtia demeusei/pellegriniana/tessmannii | Bubinga | II | #15 | 2 Jan 2017 (CoP17) | |
| Dalbergia spp. | Rosewood | II | #15 | 2 Jan 2017 | D. nigra is Appendix I |
| Prunus africana | Pygeum | II | (bark #) | long-standing | RST; NTFP/bark |

Sources: CITES "CITES and Timber" guide 2023; Timber Development UK (16 Feb 2023); US FWS CoP19; Forest Trends (Feb 2023); Forest Trends Cameroon Dashboard (2022).

### Recent CITES changes that bite
1. **CoP19 (in force 23 Feb 2023)**: Doussie, Acajou, Padouk now need CITES export permits. Before 2023 they moved freely. The one change Wouri must not get wrong.
2. **CoP20 (Samarkand, 24 Nov-5 Dec 2025): delisting attempts FAILED.** Congo/Gabon/Cameroon co-sponsored Prop. 45 (delist Central African Afzelia bipindensis) and Prop. 47 (delist Central African Pterocarpus soyauxii). Both rejected (49-56-24 and 51-57-20, short of 66%). These species REMAIN Appendix II. Do not seed any delisting. Sources: IISD ENB CoP20 (Dec 2025); Government of Canada CoP20 outcomes; ATIBT (8 Dec 2025).
3. **EU Annex D extension (3 Jul 2026)** to Entandrophragma (Sapelli/Sipo), Shorea, Anthoshorea: import-monitoring, not a CITES appendix, but triggers EU import notifications. Monitoring flag.
4. **National log-export ban:** 76 species (order 4 Apr 2024), ECCAS regional, enforced from 1 Jan 2028 (Cameroon moving early); Assamela, Khaya anthotheca, Bubinga among species barred from log form. Interacts with #17 and export_eligibility.

### Permit, NDF, quota, authorities
- Management Authority (issues permits): **MINFOF**. Scientific Authority for flora (NDFs): **ANAFOR**.
- Non-Detriment Finding (NDF): a CITES Article IV scientific opinion; precedes the permit; underpins the quota.
- Quota: a conservative harvest/export ceiling from the NDF, published on the CITES website; exports may not exceed it.
- Permit validity: a CITES export permit expires after **6 months**; Cameroon flagged at CoP20 that EU import-permit delays up to 18 months collide with this. Track issue date + 6-month expiry.

### Traceability vs mass-balance under CITES
A CITES-regulated log must be **identity-preserved** (traceable to the source FMU/concession/tree and harvest event) or at minimum segregated. Mass-balance and book-and-claim/credit are invalid for a CITES specimen because the permit references a specific consignment. Sources: WRI/Forest Policy Timber Traceability diagnostic (2024); ISO 22095:2020; ISEAL.

## Part B: Competitive / solution landscape

### Timber traceability / legality software
- **TIMFLOW (HS Timber Group):** truck-GPS log tracking, tamper-proof server, geofence alerts. Single-operator, mill-inbound; not a registry or CITES/quota engine.
- **Double Helix / SourceCertain + World Forest ID:** stable-isotope + DNA verification of species and origin, works on finished products (~USD 0.75-1.00/m3). A forensic test, not a system of record; reference-database coverage gap.
- **Helveta CI World / Track Record (legacy):** full CoC + Legality Assurance + revenue reconciliation (Liberia LiberFor). Heavyweight government-deployment model.
- **Government log-tracking systems Wouri must interoperate with, not replace:** Cameroon SIGIF 2, Gabon SNTBG, Tanzania Timber Tracker, Brazil SINAFLOR, Romania SUMAL 2.0.

### Agri-commodity / EUDR platforms (table-stakes)
Players: Koltiva (KoltiTrace), Sourcemap, Meridia (Verify, powering ICE Commodity Traceability), Farmforce, TraceX, Global Traceability (RADIX Tree), LiveEO, Nadar, ResourceWise Forest Trackt.
Table-stakes: (1) polygon mapping (mandatory > 4 ha), GeoJSON for TRACES; (2) offline-first mobile capture + persistent farmer digital ID; (3) DDS generation + submission to TRACES via API returning the DDR reference number; (4) risk screening against forest-loss datasets, best practice 3+ satellite heat maps with re-screen alerts; (5) 31 Dec 2020 cutoff + legality checks.

### Digital trade / documentary platforms
essDOCS (ICE Digital Trade), Bolero, CargoX (blockchain, passed ICC DSI/DGC MLETR self-assessment Mar 2025), edoxOnline, WaveBL, TradeTrust, ICC TradeFlow. Legal backbone = MLETR; liability via IG P&I.

### Forest-loss datasets for EUDR risk
- **JRC Global Forest Cover map GFC2020 (V3)** on the EU Observatory (EUFO) is the reference 2020-baseline map (non-mandatory, non-binding).
- **Global Forest Watch (GFW)** for forest-loss and degradation (timber must be degradation-free after 31 Dec 2020).
- Screening: intersect the plot polygon with the 2020 forest layer + loss/degradation series; screen multiple layers.
- **EUDR country benchmarking (Reg 2025/1093, in force 22 May 2025):** 4 high-risk, ~50 standard, ~140 low. **Cameroon = STANDARD**, so full due diligence always.
- **EUDR application date (current):** 30 Dec 2026 large/medium, 30 Jun 2027 micro/small; cutoff 31 Dec 2020; penalties up to 4% of EU turnover (Reg 2025/2650).

## Critique of the Wouri plan

### Right / beats the field
- Effective-dated `species` rows (cites_appendix + export_eligibility) are a genuine differentiator; every EUDR competitor hardcodes species lists and would misclassify a lot shipped across a listing date.
- **`quota_ledger` that can never go negative: NO competitor models a CITES quota at all.** Wouri's clearest moat for regulated timber.
- `origin_claim` enum maps to ISO 22095 and is the right place to enforce the CITES rule.
- `origin_unit_risk` with dataset_key + dataset_version is smart (JRC ships V1/V2/V3; reproducibility depends on pinning).

### Table-stakes to fix before pitching
1. Model the CITES **annotation** (#17 vs #15 vs #7), not just the appendix; `export_eligibility` per commodity-form.
2. Population/range-state scoping on species rows (African populations only; CoP20 litigated geographic split-listing).
3. Built-in polygon screening against JRC GFC2020 (version-pinned) + GFW + one national layer, 31 Dec 2020 cutoff hard-coded, re-screen alerts on new dataset versions. Confirm it runs the intersection, not just stores a boolean.
4. Polygon geometry + validity (PostGIS, GeoJSON, > 4 ha polygon rule). Invalid geometry is the #1 cause of DDS rejection.
5. DDS payload generation + DDR reference capture.
6. CITES `permits` object: number, issuing MA (MINFOF), issue date, 6-month expiry, linked to the consignment and to a quota_ledger decrement.
7. EUDR country-benchmark tier as an effective-dated dimension (Cameroon = standard).
8. Third-party scientific verification capture (World Forest ID / Double Helix isotope + DNA, FLEGT/SIGIF2 authorization numbers, NDF references) as immutable evidence objects.

### Features that make Wouri clearly better
1. **Dual-rail compliance lot:** one lot carries BOTH a CITES rail (appendix + annotation + permit + quota decrement) AND an EUDR rail (polygon + versioned risk screen + DDS/DDR). Served by no single tool today. Wouri's category.
2. **Hard guardrail as a DB constraint:** any lot whose species.cites_appendix is in (I, II, III) is forbidden from origin_claim in (mass_balance, credit); forced to identity_preserved/segregated.
3. **Government-system interop as first-class ingest:** pull SIGIF 2 export data and the published CITES quotas to seed quota_ledger; Ivorian/Ghanaian farmer-ID registries to seed origin units.
4. **Evidence vault + re-screen alerting:** immutable evidence per lot + automatic re-flag when a plot appears in a newer JRC/GFW release.

### Correction to watch
Do not seed any Afzelia bipindensis or Pterocarpus soyauxii delisting; both CoP20 proposals were rejected (Dec 2025). Record the rejection date if you track legislative history.
