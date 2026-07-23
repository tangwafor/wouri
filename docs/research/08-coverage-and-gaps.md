# Research Track 08: Coverage sweep and honest gaps (2026)

A check of Wouri against what a real Cameroon commodity export actually requires,
so we know what is covered and what is not. Sources 2025-2026. No em-dashes.

## The real Cameroon export process

Everything routes through the **Single Window (GUCE / e-GUCE)** at Douala, which
integrates Customs, SGS, the Treasury, the port, the National Cocoa and Coffee
Board (ONCC/NCCB), and the phytosanitary service. It aims to cut export processing
to about two days.

Documents and references a shipment typically needs:

- **Commercial invoice** and **packing / stuffing certificate** (containers).
- **Certificate of origin** (EUR.1 for the EU under the EPA).
- **Phytosanitary certificate**, now electronic (**ePhyto**, ISPM 12, via e-GUCE /
  TRACES NT).
- **Quality certificate** from an approved control company, certified by NCCB;
  cocoa and timber require an **SGS declaration**.
- **NCCB pre-liquidation form** and an **export declaration + export licence**
  (Treasury).
- **BESC / ECTN** (Bordereau Electronique de Suivi des Cargaisons) from the
  Cameroon Shippers Council, mandatory, attached before loading.
- **Bill of lading**, **cargo manifest**, and a **marine insurance certificate**
  (CIF).
- For regulated goods, a **Certificate of Conformity** via ANOR / TUV Rheinland
  (PECAE program).

Sources: trade.gov Cameroon customs regulations; minepat.gov.cm import/export
guide; USDA Exporter Guide Cameroon 2025; guichetunique.cm; IPPC Cameroon ePhyto
2025.

## EUDR, the wedge (large operators 30 Dec 2026)

A shipment cannot enter the EU without a **DDS reference number** filed in TRACES,
per shipment. The five components: **geolocation** (a **polygon**, GeoJSON, per
plot including smallholder aggregation, not just a point), **production date after
31 Dec 2020**, **legality evidence** (land title, permits, labor and indigenous
rights), **deforestation-free proof** (satellite / land-use history), and a
**risk assessment** (Cameroon is Standard risk). Records kept **5 years**.
Operator EORI and the HS code are also required. Penalties reach 4 percent of EU
turnover.

Sources: Reg (EU) 2023/1115; tracextech, coolset, regilient, meridia, altruistiq
EUDR guides 2026.

## What Wouri covers now

- Custody from the plot (origin unit + effective-dated versions + evidence),
  append-only and tamper-evident, seeded with cocoa, and the harvest event.
- The document set it issues and verifies offline: EUR.1, phytosanitary
  (reference), VGM, quality certificate, each Ed25519-signed and exporter-branded.
- Quality profiles for all commodities; unbound-blocks-issuance; weight
  consistency.
- Settlement and the BEAC repatriation clock; discrepancies block payment.
- Shipment tracking (booked to cleared) and the readiness board deadlines.
- **New in this sweep:** the compliance and reference layer, the EUDR **DDS
  reference** and the **BESC/ECTN** cargo tracking note captured on the
  consignment, a **destination-aware checklist**, and a board blocker when a
  loaded shipment has no BESC.
- The registry stays current as effective-dated data; a real consignment file
  reconciles the bindings (ADR-0030).

## Honest gaps (the next tracks)

1. **Polygon capture.** The field app records a GPS point; walking the plot
   boundary to a GeoJSON polygon is the EUDR standard for most systems.
2. **Legality and deforestation-free evidence.** Land titles/permits as origin
   evidence, and a satellite / land-use check, are not yet modeled.
3. **Formal EUDR risk assessment record** (Article 10) and the DDS submission
   itself (we capture the reference, not the TRACES filing).
4. **The rest of the GUCE set**: SGS declaration, NCCB pre-liquidation, export
   declaration + licence, ANOR/PECAE CoC, insurance and packing certificates as
   first-class documents (we capture insurance as a reference for now).
5. **Single-window integration** (e-GUCE, CAMCIS, TRACES NT) so references flow
   both ways rather than being recorded by hand.
6. **EORI** and full supplier/buyer contact records for the DDS.

None of these block the operator today; they are the roadmap to end-to-end
compliance, and each is data or a capability, not a rebuild.
