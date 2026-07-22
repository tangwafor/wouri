# Research Track 03: Trade documents and digital-trade standards

Cameroon-to-EU export direction. Sources with dates.

## The export document set (cocoa + timber, Cameroon to EU)

Core commercial/transport set: commercial invoice, packing list, bill of lading (ocean B/L or seaway bill), certificate of origin, insurance certificate (CIF/CIP), quality/weight certificates. For cocoa: a Certificate of Analysis (CoA) plus third-party pre-shipment inspection (SGS/BV/TUV) covering grade, moisture, aflatoxin (FDA action level 20 ppb), pesticide/MRL residues (Cameroonian cocoa is flagged on residues). Source: CBI, https://www.cbi.eu/market-information/cocoa-cocoa-products/tips-organise-your-export

### Certificate of origin (the EPA question, definitive)
For Cameroon to the EU under the Central Africa (Cameroon) interim EPA, the proof of origin is a **movement certificate EUR.1, in the "EUR.1-CMR" variant**, OR an origin declaration by approved exporters. **GSP Form A does NOT apply.** A standard chamber-of-commerce CO is a fallback where no preference is claimed. EUR.1-CMR is defined by Cameroon Decree No. 2016/367 (3 Aug 2016); EU imports governed by Regulation (EU) 2016/1076 Annex II. **REX does NOT apply** to the Cameroon EPA (it is used for Cote d'Ivoire/Ghana stepping-stone EPAs). Source: EU DG TAXUD "Proofs of origin under EPAs", v11, https://taxation-customs.ec.europa.eu/document/download/c85324d8-e61f-4898-aebf-554beb3e1631_en

### Phytosanitary
Issued by MINADER (NPPO), ISPM 12; Cameroon joined IPPC 5 April 2006. Now flows as **ePhyto** (see below).

### Certificate of Conformity (trap)
Cameroon's PECAE / TUV Rheinland CoC is an **IMPORT** conformity regime (goods entering Cameroon), NOT an export requirement to the EU. The plan should not model a generic export CoC as mandatory. Source: USDA FAS Cameroon Exporter Guide 2025.

### Timber-specific
- **FLEGT licence REALITY CHECK (critical):** Cameroon is NOT issuing FLEGT licences and never reached the licensing stage. On **17 June 2025** the European Parliament plenary voted to terminate the EU-Cameroon FLEGT VPA (unilaterally; Cameroon had not consented). SIGIF 2 was deemed unable to underpin FLEGT licences. **There is no FLEGT green-lane for Cameroon timber.** It clears the EU under due-diligence regimes (EUTR, now EUDR). Sources: Fern, 10 July 2025, https://www.fern.org/publications-insight/article/cameroons-vpa-ends-but-parliaments-resolution-reinforces-eu-accountability ; FLEGT VPA Facility.
- **EUDR DDS** is the dominant new document for BOTH commodities (30 Dec 2026 large; 30 Jun 2027 micro/small; Reg 2025/2650, OJ 23 Dec 2025). EUTR continues for pre-29 Jun 2023 timber until 31 Dec 2028.
- **CITES permits:** CoP19 (Panama, Nov 2022) added 4 Khaya, 4 Afzelia, 3 Pterocarpus (African populations) to Appendix II, in force 23 Feb 2023, all relevant to Cameroon; handled outside FLEGT at the EU border.

### Dependency chain
Invoice + packing list feed the B/L, EUR.1-CMR, phyto, CoA. The origin declaration underpins the EUR.1. Phyto depends on the fumigation/treatment record. VGM depends on packing-list weights. The EUDR DDS depends on geolocation + legality; its reference number propagates to the customs declaration. CITES/EUDR gate timber before the B/L is relied on.

## VGM (SOLAS)
SOLAS Ch. VI Reg. 2, effective 1 July 2016. Method 1: weigh the packed sealed container on certified equipment. Method 2: weigh all packages + add the container tare (certified party in the country of packing). The **shipper named on the B/L** is responsible; estimating is prohibited; must reach carrier/terminal before loading. No VGM = not loaded.

## ePhyto for Cameroon
IPPC ePhyto Solution (Hub run by UNICC). **Cameroon is live**, using GeNS, actively exchanging ePhytos through the Hub including to the EU via TRACES. Validity in TRACES requires a digital signature; the ePhyto replaces the paper copy. Sources: UNESCAP ePhyto Guide (2024); Swedish Board of Agriculture list dated 2026-01-15 (includes Cameroon). Design implication: store the ePhyto/TRACES reference, do not re-issue.

## Electronic / transferable trade documents
- **MLETR (UNCITRAL, 2017):** functional-equivalence test (singularity, control, integrity). Adopted/enacted: ADGM, Bahrain, Belize, Kiribati, PNG, Paraguay, Singapore, UAE, UK (Electronic Trade Documents Act 2023, in force Sept 2023). **France** transposed via Law 2024-537 (13 June 2024), transferable provisions in force 13 March 2025, Decree 2025-811 (Aug 2025), first EU member. **China** recognised electronic B/Ls (Oct 2025, effective 1 May 2026). **Cameroon: no MLETR adoption** (the central legal gap for an eBL).
- **eBL / DCSA:** Bill of Lading 3.0 (early 2025), digital signatures + 190+ attributes aligned to EU ICS2, interoperability via PINT API; members committed to 100% eBL by 2030. First standards-based interoperable eBL transaction in production 15 May 2025 (CargoX + EdoxOnline). eBL adoption ~11% in 2025. IG P&I Clubs auto-approving eBL systems since Feb 2025.
- **ICC DSI:** Key Trade Documents and Data Elements (KTDDE) framework, launched April 2024; 36 key documents; 32 core data elements. Trust architecture: zero-trust cryptographic verifiability, digital ID for all parties, interoperability.
- **What to align to:** DCSA BL 3.0 + PINT for the eBL; ICC DSI KTDDE glossary + 32 core data elements for field naming; MLETR functional-equivalence; UN/CEFACT + W3C VC for the verifiable envelope.

## Verification and tamper-evidence
- RFC 3161 trusted timestamping (+ RFC 5816): a TSA binds a document hash to a signed time token; eIDAS-qualified, 21 CFR Part 11 contexts.
- **Merkle-root anchoring is recognised good practice:** build a Merkle tree of many document hashes and anchor only the root, combining an RFC 3161 token with an immutable anchor for long-term validation (MDPI Applied Sciences 15, 2025, https://www.mdpi.com/2076-3417/15/23/12722). Weakness of pure RFC 3161: a TSA cert compromise (even post-expiry) can invalidate prior timestamps, so LTV re-stamping / a second anchor is advised.
- **QR-verifiable / Verifiable Credentials:** W3C Verifiable Credentials 2.0 became a W3C Recommendation in 2025 (15 May 2025). UN/CEFACT Verifiable Trade Documents adopts the W3C VC data model. GLEIF vLEI (ISO 17442-3, 2024) binds entity + person + role into a machine-readable credential.

## Critique

### Right / ahead
- Field-level binding (`document_bindings`, unbound field blocks issuance) implements the ICC DSI "data-first, document-as-view" philosophy; materially ahead of typical tooling.
- Anchoring from day one matches the MDPI 2025 Merkle + RFC 3161 good practice; rare to build in at inception.
- Versioning + signatures + scan log; dependency graph; render in the receiving authority's language.

### Gaps / risks
1. MLETR/eBL: the plan produces authoritative PDFs, not a legally transferable eBL. RFC 3161 + Merkle proves existence-unaltered, not singularity/control/transfer. Cameroon has not adopted MLETR. Do NOT try to be the eBL title registry; generate DCSA BL 3.0-conformant data and hand off issuance to a DCSA-interoperable/IGP&I-approved platform via PINT, storing the reference; or mark Wouri B/Ls as non-negotiable copies.
2. The 26-char code is a closed-loop, single-issuer trust model (a single point of failure; does not travel offline/cross-system). Emit each document as a W3C VC 2.0 credential (UN/CEFACT UNVTD envelope) verifiable WITHOUT calling Wouri; bind the signer via vLEI. Keep the code as the human lookup, put a VC behind the QR.
3. RFC 3161 LTV weakness not addressed: add LTV re-stamping and a second independent anchor.
4. **FLEGT is the wrong assumption for timber; a hard FLEGT dependency would make every Cameroon timber consignment un-issuable.** Replace with EUDR + CITES (species-conditional).
5. Missing docs: EUDR DDS (with geolocation), CITES export permit, cocoa CoA + pre-shipment inspection, VGM as first-class, ICS2/ENS attributes (mandatory from 1 Sept 2025). The "certificate of conformity" is likely a category error for EU-bound goods.
6. `document_dependencies` as a hard boolean is brittle; make it conditional (predicate on commodity, HS, species, destination, Incoterm, exporter status, value, date).
7. Proof-of-origin: encode EUR.1-CMR and the approved-exporter alternative; do NOT default to GSP Form A or a plain chamber CO for EU-preference.

### Improvements (priority)
1. Add the EUDR DDS as a structured, field-bound document with geolocation, legality evidence and the TRACES reference; conditional blocker.
2. Remove the FLEGT gate; replace with EUDR + CITES.
3. Emit documents as W3C VC 2.0; put the VC behind the QR; bind signer with a vLEI/LEI.
4. Decouple the eBL: DCSA BL 3.0 data + PINT handoff + external reference.
5. Harden anchoring: LTV re-stamping + second anchor.
6. Add VGM, CoA/pre-shipment inspection, ICS2/ENS attributes; align field names to KTDDE.
7. Make dependencies conditional.
8. Store, do not re-issue, the ePhyto.
