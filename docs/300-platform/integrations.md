# Platform: integrations (feed the government systems)

Traces to ADR-0009. Wouri feeds government systems, it does not replace them. No em-dashes.

## The rule
For any artifact a government system legally issues, Wouri stores the authoritative external reference, never a self-minted substitute. Wouri is the exporter's consolidated record that reconciles against the government systems and produces their inputs.

## The connectors (registry-driven)
Each government endpoint is a row in `integration_connectors`: endpoint, auth mode, message format, field mapping, and an effective-dated status. This keeps the "everything is a dated registry row" philosophy while acknowledging Wouri feeds these systems.

| System | Owns | Format | Wouri does |
|---|---|---|---|
| **EU TRACES** | the EUDR DDS reference number | published API | assemble the DDS, submit, store the reference and verification numbers |
| **e-GUCE** | the coverage circuit, packing certificate, export declaration, e-payment | portal + e-BUSINESS (system-to-system) + SIAT XML | export a valid e-GUCE input package; store references |
| **CAMCIS** | the customs declaration (SAD) | operator portal | produce the SAD input; store the declaration reference (not SYDONIA, retired) |
| **SIGIF 2** | the legal timber waybill + worksite notebook (barcode to stump) | national system | ingest and mirror the SIGIF 2 waybill barcode; reconcile, never re-mint |
| **ONCC / NCCB lab** | the cocoa grade certificate (Grade I/II) | lab process | store the grade certificate reference |
| **ePhyto (GUCE/SIAT)** | the phytosanitary certificate (EU-accepted since 2022) | XML, ISPM 12 | store the ePhyto/TRACES reference; do not re-issue |

## Sequencing
Start with read/mirror and document-handoff (export a valid input package, ingest the SIGIF 2 barcode, store the DDS reference) before attempting write-back, since e-GUCE has no open public API and access goes through the e-BUSINESS partnership channel. TRACES has a published API and can be automated earliest.

## Status is data
A connector's readiness is an effective-dated status ("SIGIF 2 FLEGT issuance: not EU-recognized"; "TRACES API: live"), so the app reflects reality without a redeploy.
