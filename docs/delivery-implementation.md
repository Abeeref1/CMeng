# Delivery implementation and release record

Status: Delivery deployed in PR 157; production follow-up verification is recorded below. Independent business acceptance and closure of all historical defects are not claimed.

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

## Production follow-up — 26 September 2026

Confirmed production release `29bae17` and the successful 286-response, 13-project read-only acceptance artifact in workflow run `36253211602`. That artifact compares fingerprints during its own run, not the separate pre-deployment snapshot above.

The resumed live walkthrough opened all 22 Delivery pages on JAZ-RTR-T3 and switched to KWT-TWR1. Candidate procurement, design, commissioning and asset records remained outside approved totals; missing HSE exposure and handover populations remained unavailable. KWT's Excel download contained all 180 current risk rows, independently of 25-row screen pagination.

This review found and corrected:

- Delivery Risks used the procurement-package review count as its management headline. It now consumes the existing risk population and dated status, exposes the source risk basis, and lists only Delivery records linked to risks. Its controls direct risk evidence to Documents rather than offering to create a procurement package as a risk.
- Status filters omitted the existing risk `status` field. They now use the displayed row status, including workfront readiness, while retaining raw keys for filtering.
- Delivery tables and chart dates used raw ISO strings and ungrouped amounts. Display formatting preserves source values, record IDs, quantities, dates and machine-readable exports. Review-state labels are readable without changing decision semantics.

Local verification: 718 tests passed, zero failed or skipped, including focused regression cases for risk scope, future risks, linked workfront records, risk filtering, source-reference preservation and small nonzero quantities. These changes require CI and deployed verification before they are described as live.

The historical 1.3–7.8 second first-calculation observations remain open performance evidence. This display and risk-scope correction does not claim to resolve that work.


## Loading and workflow follow-up — 26 September 2026

The live release `adf4652` passed the 13-project / 286-page before-and-after comparison recorded in PR 158. This follow-up addresses measured work inside Delivery and its page display. Network/proxy time is separate: for example, the JBL first Delivery request measured 3,507 ms at the verification client and 1,504 ms in the matching Railway HTTP log. No capacity change is inferred from client elapsed time alone.

A CPU profile of a deterministic multi-register fixture identified repeated canonical-header normalisation in record classification. The identity keys are now normalised once. Explicit per-row record types, foreign-key distinctions, mapping decisions, source receipts and source-file integrity checks are unchanged; there is no new cache of project decisions or source bytes.

The page also rendered the complete contents of closed evidence sections. Those sections now display their nested records when opened, with 25-item pages and a search across the complete set. All nested details and source values remain reachable. Excel and JSON retain the full data. Number/date formatters are reused. The management answer, KPIs and current register still appear immediately.

Clean, sequential local observations using the same 51,700-source-row fixture (21,200 Delivery candidates, 30,000 BOQ rows, 500 risks):

| Measurement | Release adf4652 | Follow-up |
| --- | ---: | ---: |
| First Delivery projection | 1,110.75 ms | 318.83 ms |
| Three subsequent source-record reads | 922.12 / 903.38 / 965.41 ms | 140.86 / 139.84 / 146.96 ms |
| Initial risk evidence HTML generation | 135.57 ms | 0.82 ms |
| Initial risk evidence HTML | 1,017,298 bytes | 1,772 bytes |
| Peak process RSS | 563.41 MiB | 536.88 MiB |

These are isolated synthetic calculation/display observations, not a promise about total browser/network time or a production cold-load measurement. Source preparation is excluded. The earlier profiled diagnostic measured 1,289.82 ms for first projection; the first unprofiled follow-up measured 316.90 ms. The clean comparison above was then run without profiling or concurrent local tests. No failed or slow benchmark sample was removed.

Both clean runs produced exactly the same record fingerprint `1eb1c333423484c3449d9a74d8aee6635a18c5eed59df0083216316a4cae9a12` and complete module fingerprint `b30e77ac2dc1d089485ef600990968440f194b625a8743cc0a7c9ecacb53741c`.

Verification: 721 tests passed, zero failed/skipped. Added coverage checks 50,000 evidence records without eager hidden-field rendering; first/middle/final pages; full-set search and clearing; escaped source text; unchanged source values; and exclusion of previous-project evidence. The existing Delivery tests continue to cover candidate review, programme adoption, BOQ quantities, units/currencies, future dates, lead-time calendars, readiness, HSE exposure, handover evidence, concurrent decisions, restart and exports. A separate CI step preserves the large-Delivery timing artifact and enforces the five-second calculation/read limit plus bounded initial evidence markup.

Review deployment, live workflow checks and final production comparison will be recorded in the follow-up pull request. Functional acceptance is assessed against the specification; no source approval or independent business-owner sign-off is inferred from automated tests.
