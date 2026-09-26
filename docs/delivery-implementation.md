# Delivery implementation and release record

Status: development review; production acceptance is not yet complete.

The controlling requirements are in `delivery-specification.md`. This record describes executable work and its verification; it is not a declaration that a navigation entry passes acceptance.

## Programme foundation

C3/C4 were published in PR 156 before Delivery development. Uploading for review retains candidate authority. Every consuming page receives the programme-review context, including blocked pages. The action to adopt is explicit. Pending revisions include same-date, earlier-date and missing-date submissions; `newerUnadoptedSchedules` remains restricted to genuinely later Data Dates.

The supplied C4 reconciliation XERs all contained the same internal Data Date, including files named for later months. The exact files reproduced the earlier narrow-field result; changing only the internal Data Dates produced 1/2/3 newer revisions. The broader pending-review list addresses the genuine omission without inventing chronology from filenames.

The live new-project walkthrough also exposed unavailable pages missing reporting metadata and empty notice/overdue populations becoming zero. The current development changes preserve shared metadata on unavailable pages and keep unavailable populations null. An unavailable curve is not certified as a calculated curve merely because reporting metadata exists.

## Delivery contracts

- `delivery-core`: record kinds, stable relationships, explicit decision states, applicable lifecycle templates and field definitions.
- `delivery-records`: CSV/XLSX candidate extraction using retained source hashes and row receipts; explicit field mapping; manual working records with page/row evidence links; reviewed revisions and supersession; scoped population confirmation; optimistic project-version checks.
- `delivery-projections`: existing BOQ, Installed Quantities, programme/calendar and WBS Progress consumers; dated procurement reconciliation, backward lead-time actions, readiness gates, separate curve types and handover denominators. Existing project risk positions are consumed without another scoring formula.
- `delivery-api`: project-scoped records, source mapping and relationship catalogues. Mutations use the existing per-project worker and persistence mechanism.
- `ui-delivery`: management position, exceptions, review actions, metric basis, chart points, searchable/sortable/paginated registers, record decisions, stable-ID links, scope allocations, mapping and exports.
- `delivery-export`: normalized project-scoped Excel tables, including every nested chart point and source/review rows. JSON retains the complete report structure.

No schedule dates, physical progress, contract value, EOT entitlement or risk scores are independently recreated by Delivery. Quantity and currency series stay separate. PDF candidates reuse retained native/OCR pages for explicit tables or labelled fields, with physical page/line receipts; unread pages remain disclosed. Unstructured prose still requires reviewed capture. Narrative/PDF evidence retains the existing document-reading/OCR workflow; structured-record coverage must not be claimed from page-reading coverage alone.

## Verification

Automated acceptance cases cover first-upload adoption, pending revisions, candidate exclusion, BOQ and installed authority, over-installation, split quantities, missing lead-time basis, scoped readiness, future approvals, rectification versus closure, unknown inspection outcomes, absent HSE exposure, handover population review, weighted chart points, multiple currencies, source mapping, revision history, restart, concurrent edits, project isolation, exports beyond 20 rows and UI filtering.

Before certification, record the final suite result, representative source-project results, browser findings for every page, chart and export checks, live deployment SHA and production project-switching result. A successful build is insufficient.

## Release-candidate evidence — 26 September 2026

- Full verification: 716 tests passed, zero failed/skipped. GitHub verification, BOQ 50k, XER 100k and Schedule 50k plus durable 10k checks passed on review commit `f883d20`.
- Read-only replay of 11 retained source projects: 242 Delivery page responses, 263,100 extracted candidate records, no project-state mutation and no null metric marked calculated. First Delivery projection took 1.3–7.8 seconds locally; these source-processing timings are not warm page timings or production measurements.
- Isolated release latency gate: 20,000-activity HTTP upload to first calculated dashboard in 2,867 ms; first dashboard request 2,251 ms. A separate 12,500-activity, three-revision cold gate took 3,778 ms. Earlier concurrently run samples are not the isolated benchmark.
- Actual JAZ PDF reader run: image-only technical appendix, 12/12 OCR pages; searchable HSE report, 12/12 native pages; zero failed or unresolved pages in those two files. This verifies those page receipts, not every PDF or extraction of every structured fact.
- Live review fixture: 83 governed test records across 17 kinds, 63 submittals, two currencies and two incompatible quantity units. The browser walkthrough opened every page below. Synthetic review decisions are not client approvals.
- Browser pagination reached rows 51–63; searching SUB-062 showed one matching row. Excel still contained all 63 submittals in the current rows, source rows and review history sheets.
- Browser edits retained decisions, rejected a stale concurrent save, and required population confirmation before handover became 100%. Switching to an empty project cleared the previous project's records and values, and switching back restored its own position.

| Page | Inspected behavior |
| --- | --- |
| Delivery Control | Cross-package exceptions and separate BOQ currency values |
| Procurement Packages | Programme need date, dated lifecycle stage and late delivery |
| Material Tracking | 100 m³ required / 150 installed / −50 remaining, with over-installation flags; metres remain separate |
| Long Lead | Latest PO 5 September from 30 September need date and 25 governed calendar days |
| Submittals | 40 approvals through Data Date; 23 later approvals do not improve the current position; 63-row pagination |
| Procurement S-Curves | Separate count, currency, material and weighted series; actual weighted points 25/50/75% |
| Suppliers & Subcontractors | Two linked packages, one known late package |
| RFI & Design | Dated overdue response remains open |
| Discipline Progress | Existing progress producer and a confirmed material gate blocker |
| Location / Floor / Zone | Governed location relationships and the same workfront blocker |
| Construction Readiness | One blocked workfront; complete applicable gate denominator |
| Procurement Readiness | One ready package and one unresolved package; incomplete gate totals withheld |
| Quality & Inspections | Rectified NCR stays open; one passed inspection and one unknown outcome disclosed |
| Permits & Authorities | Issued permit is expired, independently of its later required-by date |
| Construction HSE | 100,000 exposure hours, one LTI, frequency rate 10 per million matching hours |
| Testing & Commissioning | Failed test, planned/forecast/performed dates and unknown readiness remain separate |
| Asset & System Handover | Installation shown; future commissioning and absent taking-over dates withheld |
| Snag & Closeout | Rectification does not establish verified closure |
| Spares & Special Tools | Required 5 / delivered 4 / accepted 3 / stored 3 / handed over 2 |
| Handover Readiness | Unresolved denominator until explicit confirmation; then 1 accepted of 1 verified requirement |
| Weather / Disruption Evidence | Recorded event and impact hours; no inferred EOT or causation |
| Delivery Risks | Existing risk score 1.2 and governed Delivery relationships |

Walkthrough corrections include preserving supersession through re-review, rejecting revision cycles, recognizing explicit mixed Delivery schemas, separating per-kind reading coverage, invalidating populations when reading becomes incomplete, withholding unknown gate counts, scoping package chart coverage, putting the named chart first, making expired/failed/overdue actions visible, and keeping absent Notice Compliance populations unresolved across management/commercial consumers.

The separate Railway review environment contains synthetic fixtures only. Automatic approval review declined uploading actual project documents to that separate destination. Production real-project verification must use documents already retained in the existing CMeng production service. No real project is adopted or reclassified by the Delivery walkthrough.

Production acceptance remains a separate record. The 13 non-QA projects currently returned by production were fingerprinted before deployment; this is not a claim that all 15 previously discussed projects were present or tested. This evidence does not claim independent human business sign-off.
