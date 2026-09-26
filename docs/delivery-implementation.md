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
