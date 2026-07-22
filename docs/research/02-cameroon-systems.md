# Research Track 02: Cameroon export systems reality check

Current to July 2026. Sources with URLs and dates.

## How a Cameroonian export actually clears

### GUCE / e-GUCE (the single window)
- GUCE (Guichet Unique des Operations du Commerce Exterieur) runs the **e-GUCE** platform (Bonanjo, Douala), the mandatory single entry point. Modules: e-FORCE (single form import/export/transit), e-GOVERNMENT/SIAT (technical-admin information systems: phytosanitary, standards, forestry), e-PAYMENT, e-BUSINESS (system-to-system channel to private partners), e-HELPDESK. Source: https://www.guichetunique.cm/en/home-3
- Portal-first, NOT an open public API. But e-BUSINESS is an explicit system-to-system channel, and SIAT already runs on XML messaging (ePhyto exchange to the EU, ISPM 12 Appendix 1; production since 1 June 2022, EU acceptance with e-signature from 2 Sept 2022). Source (IPPC): https://assets.ippc.int/static/media/files/publication/en/2025/10/07_SPG_2025_Oct_Cameroon_ePhyto.pdf

### Customs: CAMCIS is live, ASYCUDA/SYDONIA retired
- **CAMCIS** (Cameroon Customs Information System) is the live customs platform in 2026, modelled on Korea's UNI-PASS, fully paperless, three portals (admin, operators, public), remote-operable. Replaced ASYCUDA/SYDONIA. Source (ITWeb Africa): https://itweb.africa/article/cameroon-implements-new-e-customs-system/mYZRXv9aLwyvOgA8 ; operator portal https://ept.camcis.cm
- Actively extended in 2026 (mobile import-duty module Mar 2026; "Douane CMR" traveller e-declaration from 1 Feb 2026).
- **Caveat:** the 2020 MINEPAT guide still says "Obtaining SYDONIA Number." That is stale. The customs declaration is the **CAMCIS SAD**, not SYDONIA.

### Timber export specifics
- **SIGIF 2** (Systeme Informatique de Gestion des Informations Forestieres, 2nd gen) operational since 1 April 2021: barcode on every tree, tracing from export back to the stump across **19 mandatory checkpoints** on the routes to Douala and Kribi; auto-generates secure waybills and the worksite notebook; integrates CITES, litigation and fiscal signals; designed to issue FLEGT authorizations. Mandatory for community forests.
- **Status flag:** SIGIF 2 is operational but not fully deployed; **the EU has not recognized SIGIF 2 under the VPA**, so FLEGT licences are not flowing. Source (Forest Policy): https://forestpolicy.org/sites/default/files/pdf/cameroon.pdf
- Required timber export documents (TRAFFIC/FODER legality guide, Feb 2025): export specification bulletin ("bulletin de specification") signed by the Regional Delegate for Forests (Littoral/Douala or South/Kribi); secure waybills + worksite notebook (SIGIF 2); certificate of origin (MINFOF/CITES, Customs, Chamber of Commerce by destination); phytosanitary (MINADER); special declaration on slip; loading certificate + loading report signed by the port forestry control post, co-signed by Customs and SGS; evidence of FET (forestry exit tax)/exit duties and royalties. Source: https://www.traffic.org/site/assets/files/28083/vf3_traffic-foder-guide-to-verify-legality-of-timber-from-cameroon_feb2025-final-repris.pdf
- Grading: ATIBT Main Grading Rules for Sawn Tropical Timber (updated 03 June 2025).
- **Log-export ban (decisive for the timber beachhead):** CEMAC Decision No. 06/24-UEAC-225-CM-41 (23 Feb 2024) mandates a progressive ban on unprocessed-log exports, **full ban 1 Jan 2028**, phasing from 1 Jan 2025. National: Law No. 2024/008 (24 July 2024); the banned-species list expanded from 76 to 91 by an arrete signed 28 April 2026; raw-log export duty raised from 17.5% to 60-75% over 2017-2023. Logs still ship under a quota system; raw-log volumes fell to 349,611 t in 2025 (5-year low). Sources: https://eia.org/press-releases/cameroon-advances-cemac-log-export-ban ; https://woodcentral.com.au/cemac-log-export-ban-2028

### Cocoa export specifics: ONCC / NCCB
- **ONCC / NCCB** (Law No. 95/11, 27 July 1995) controls all cocoa purchases/sales farm to export. Mandatory quality control before export via the **NCCB laboratory**; only Grade I and Grade II may be exported; pre-shipment samples analysed and a quality certificate issued. ONCC handles export sales declarations, statistics, the Cocoa Quality Premium, and publishes daily CIF/FOB reference prices. Other bodies: CICC, CTSCCC, FODECC, MINADER, MINCOMMERCE. Sources: https://www.oncc.cm/coffee ; https://www.oncc.cm/prices

### Port and VGM
- Douala handles ~95% of traffic (also Kribi, Limbe, Tiko). Container export flow (MINEPAT guide): start the coverage circuit on e-GUCE; obtain the packing certificate (electronic packing request + on-site inspection by >= 2 officers); sanitary/phytosanitary certificates; authorisations/permits/visas; the tax form (BDT) for timber and coffee.
- VGM (SOLAS ch. VI reg. 2): certificate from Douala Port Weighing Services (DPWS).
- ECTN / BESC (Bordereau Electronique de Suivi de Cargaison): mandatory, from the Cameroon National Shippers' Council (CNSC/CNCC).

### Parastatals / inspection bodies
Customs (DGD/CAMCIS), GUCE, ONCC/NCCB, MINFOF (SIGIF 2, CITES, specification bulletin), MINADER (phytosanitary), SGS (port inspection, loading report), TUV Rheinland (PECAE/CoC, import side), Bureau Veritas, ANOR (standards/CoC), CNSC/CNCC (ECTN), DPWS (VGM), Chamber of Commerce (certificate of origin), FODECC/CICC, PAD/PAK.

## Critique

### Covered well
- Registry-as-source-of-truth for document types, duties, levies, permits, validation rules, effective-dated with source_citation, is exactly right; Cameroon rules move constantly (log duty 17.5%->60-75%; banned species 31->76->91; CEMAC deadlines slid; EUDR slid). A code-baked engine needs a redeploy per change.
- Document-assembly framing matches reality.
- Offline field app well-matched to the SIGIF 2 stump-to-port chain.
- System-of-record framing defensible: government systems are fragmented; none is the exporter's consolidated record.

### Gaps
1. **Wouri feeds government systems, it does not replace them, and the plan names none.** CAMCIS owns the SAD; e-GUCE owns the coverage circuit, packing certificate, export declaration and e-payment; SIGIF 2 auto-generates the legal waybills; the ONCC/NCCB lab owns the cocoa grade certificate. Integration surfaces exist (GUCE e-BUSINESS, SIAT XML/ISPM-12, CAMCIS portal), so integration is realistic. The silence on these is the biggest gap.
2. **EUDR effectively unaddressed** and is the highest-value near-term driver (DDS in TRACES with plot GeoJSON, 31 Dec 2020 proof; TRACES has published API specs).
3. **Missing document/authority/levy rows:** ECTN/BESC (CNSC), VGM (DPWS), specification bulletin (Regional Delegate, port-scoped), tri-party loading report (forestry + Customs + SGS), certificate of origin (three issuers by destination; new AfCFTA/ZLECAf preferential-origin certificate Oct 2025), FET + royalties (timber), FODECC checkoff + Cocoa Quality Premium (cocoa), CITES permit, packing certificate, ePhyto as an integration not a PDF.
4. **A jurisdiction/port dimension is missing** (Douala vs Kribi; destination zone for ECTN fees and origin certificates). Need `port` / `destination_zone` scoping, not just effective_from.

### Improvements
1. Add registry-driven `integration_connectors` rows (CAMCIS, e-GUCE e-BUSINESS/SIAT, SIGIF 2, ONCC lab, EU TRACES): endpoint, auth mode, message format (SIAT/ePhyto is XML/ISPM-12; TRACES has its own API), field mapping, effective-dated status. Start with read/mirror + document-handoff before write-back.
2. Rule: for any document a government system legally issues, store the authoritative external reference, never a self-minted substitute.
3. Seed the missing rows with port/destination scoping.
4. Make EUDR a headline module.
5. Reposition the timber beachhead from "log export paperwork" (a disappearing base) to "processed-wood legality + traceability + EUDR compliance." Cocoa may be the better first commodity.

### Accuracy fixes
- Customs = CAMCIS, not SYDONIA/ASYCUDA.
- Phytosanitary = ePhyto via GUCE/SIAT (XML), EU-accepted since Sept 2022; model as integration.
