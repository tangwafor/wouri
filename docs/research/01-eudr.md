# Research Track 01: EUDR (Regulation 2023/1115) in 2026

Verified against 2024-2026 sources. Every regulatory claim carries a source URL and date. No em-dashes.

## Current state of the regulation

### Timeline (a SECOND delay landed Dec 2025)
- The old "30 Dec 2025 / 30 June 2026" dates are OUTDATED. Regulation (EU) 2025/2650 was published in the OJ on 23 December 2025, entered into force 26 December 2025.
- CURRENT application dates: **30 December 2026** for medium and large operators and traders (and micro/small dealing in products already in the old EUTR Annex); **30 June 2027** for operators who are natural persons and micro-enterprises for the rest of EUDR products. Source: EC Access2Markets, "Delay until December 2026", Reg (EU) 2025/2650, Dec 2025, https://trade.ec.europa.eu/access-to-markets/en/news/delay-until-december-2026-and-other-developments-implementation-eudr-regulation
- This is the SECOND 12-month delay; the first was Reg (EU) 2024/3234 (19 Dec 2024).
- Deforestation cut-off date unchanged: **31 December 2020**. Source: zerodeforestationhub factsheet, Oct 2025.
- 2025/2650 also changed WHO files: the obligation to run due diligence and submit a DDS now falls exclusively on the operator who first places the product on the EU market or first exports it. Downstream operators and traders no longer submit a DDS.

### Due Diligence Statement and geolocation
- Plots of **4 hectares or less** use a single point (lat/long); plots **larger than 4 ha** require a polygon (at least 4 non-aligned points). Coordinates need >= 6 decimal places, decimal degrees, longitude before latitude in GeoJSON. Source: TraceX 2025; LiveEO EUDR geolocation guide.
- A central point plus a radius is NOT an accepted substitute for a polygon over 4 ha.
- File format: GeoJSON, WGS84 (EPSG:4326); mass upload supported; DDS file size cap 25 MB.
- Submission: register with TRACES (the EU Information System), enter HS/CN codes and quantities, upload geolocation, confirm negligible risk, submit; the system returns a **DDS reference number AND a verification number**. The reference number must be attached to customs declarations and shared downstream. Source: Coolset, 2025-2026.
- After 2025/2650, sharing is limited to the first downstream operator ("Operator+1"). Micro/small primary operators submit a one-off simplified declaration and may verify land by postal address instead of coordinates. Sources: Cocoa Association of Asia (Dec 2025 amendment summary); Meridia 2026; LiveEO.

### Country benchmarking and Cameroon
- First benchmarking list adopted via Commission Implementing Regulation (EU) 2025/1093, published 22 May 2025. Three classes: low, standard, high.
- **Cameroon = STANDARD risk.** Only Belarus, DPRK, Myanmar, Russia are high; anything unlisted defaults to standard. Sources: Meridia (28 May 2025); ATIBT (24 May 2025); Compliance Gate.
- Standard and high require FULL due diligence (information + risk assessment + risk mitigation). Only LOW risk unlocks simplified due diligence (Article 13), which still does not drop geolocation collection. So Cameroon exporters get NO simplification.
- Control intensity: high 9%, standard 3%, low 1% of operators inspected annually.
- The European Parliament voted 373-289 on 9 July 2025 to object to benchmarking, but that vote was non-binding and 2025/1093 stays in force.

### Operator vs trader vs SME
- Operator = first places on the EU market OR exports. Trader = makes available further down. After 2025/2650 a "downstream operator" category has the same reduced obligations as traders.
- Only the first operator submits the DDS; downstream keep supplier contact details; the first downstream operator retains the upstream reference number (Operator+1). Micro/small primary operators file a one-off simplified declaration.

### Penalties (Article 25)
Effective, proportionate, dissuasive; minimum: fines >= 4% of the operator's total annual EU-wide (consolidated) turnover; confiscation of the products; confiscation of transaction revenue; exclusion up to 12 months from public procurement/funding; temporary prohibition on placing/exporting for serious/repeated infringements; ban on simplified due diligence for serious/repeated infringements. Directive (EU) 2024/1203 adds criminal liability.

### Cocoa vs timber, and the EUTR interaction
- Seven commodities: cattle, cocoa, coffee, oil palm, rubber, soya, wood, plus Annex I derived products (DDS reports the first 6 HS digits).
- Cocoa scope: HS 1801-1806. Composite products: only the main commodity is regulated.
- Timber: EUDR replaces the EUTR (995/2010). EUTR continues transitionally ~3 years for certain wood products (toward 2028), while new-to-EUDR wood codes (4402 charcoal, 4404, 4405 wood wool/flour) get NO transition. FSC/PEFC do not replace geolocation.
- Practical: cocoa smallholder plots are usually <= 4 ha (often point-eligible); timber concessions are almost always > 4 ha, so polygons are effectively mandatory for timber.

### Mass balance vs segregation
Mixing deforestation-free with unknown/non-deforestation-free is prohibited; compliant commodities must be SEGREGATED at every step; if a non-compliant part cannot be separated the WHOLE product is non-compliant. Full identity preservation is not strictly mandated: because all connected plots are geolocated and risk-assessed, a mass-balance model that still guarantees deforestation-free origin can persist (contested; Commission FAQ / Fairtrade reading). Sources: Sustainable Supply Chains study (Art 10(j)); Fairtrade "Mass balance for EUDR".

## Critique of the Wouri plan

### Right
- Effective-dated compliance packs + requirements with a certainty flag is the correct architecture for a regulation that has slipped twice.
- PostGIS polygons in `origin_units` with `origin_unit_versions` maps to the >4 ha polygon rule AND proving plot state relative to 31 Dec 2020.
- `origin_unit_risk` with dataset_key, dataset_version, forest_loss_detected, graded result is the right shape and defends a DDS during an audit.

### Missing / wrong / outdated
1. `point_only` does NOT satisfy EUDR over 4 ha (timber almost always non-compliant). The plan lets `geometry_basis = point_only` exist with no size gate. Correctness bug.
2. The DDS reference number + verification number and the Operator+1 pass-through are not modeled. The reference number is the actual market-access gate.
3. Country risk class does not drive obligations. Cameroon = standard = full DD always; simplified (Art 13) unavailable. The plan needs the class to gate risk-assessment/mitigation.
4. Timeline data risk: seeded 30 Dec 2025 / 30 Jun 2026 would be outdated (now 30 Dec 2026 / 30 Jun 2027). Missing the EUTR 3-year transition and the no-transition new wood codes.
5. No lot/batch spine to enforce segregation and no-mixing. EUDR makes the WHOLE lot non-compliant if any plot is unknown or non-compliant.
6. Deforestation-only risk misses legality (Article 9): proof of legal production (land-use rights, permits, environmental/forest law, labour rights), not just no-forest-loss.
7. Sequencing: DDS generation and traceability-completeness are the blocking market-access gate, not a Phase 5 afterthought.

### Concrete improvements
- Add computed `area_ha` on `origin_unit_versions`; allow `point_only` only when `area_ha <= 4`. Add `postal_address` basis gated to micro/small primary operators.
- Add a `dds` entity: `traces_submission_id`, `dds_reference_number`, `dds_verification_number`, `status`, `submitted_at`, `operator_role`, `inbound_reference_number`. Wire as the market-access gate.
- Add an effective-dated `country_risk` registry (source: Reg 2025/1093, 22 May 2025); seed Cameroon = standard; drive the obligation set.
- Re-seed `compliance_requirements` with 30 Dec 2026 / 30 Jun 2027; add an operator-class dimension; flag EUTR transition vs new-to-EUDR wood codes.
- Add a lot/consignment spine with a completeness gate (every contributing plot valid geolocation AND negligible risk AND legality evidence).
- Add a legality-evidence entity (Article 9), separate from forest-loss risk.
- Store harvest/production date on each `origin_unit_version`.
- Carry HS/CN code and the composite main-commodity rule at product level.
