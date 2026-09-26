# Project Ask AI implementation

Ask CMeng now prepares project analyses and populated deliverables from CMeng's existing authorities. It does not change source evidence, programme adoption, BOQ selections or Delivery decisions. Per the user's explicit instruction, this change adds **no login, role, grant or project-membership flow**. It uses CMeng's existing anonymous session for conversation and reference-file continuity; shared saved views are available to existing project users.

## Architecture

- The authority catalogue registers schedule, BOQ, measured quantity, productivity, commercial, claims and Delivery producers. New producers can register typed metrics and tables without adding a question-specific report branch.
- An analysis plan chooses authorities and reusable filters, grouping, ranking and scenario operations. Current page scope travels with the request. Project switching discards the previous conversation and pending UI results.
- One retained `AnalysisResult` owns its scope, Data Date, programme revision, tables, chart definitions, findings, traces and source hash. Chat, Excel, PDF, Word, CSV and Power BI-ready data use that same result. A saved live view retains the plan and refreshes against current project evidence.
- Ask artifacts are separate files under each project worker's data directory. They do not enlarge or rewrite the governed project snapshot. The existing session signing key is retained in the deployment data directory so conversations remain usable after restart.
- Reference PDFs, Word files, spreadsheets and text remain reference only. PDF reading reuses the contained OCR provider. Their content never becomes an instruction, a governed source or an adoption action.
- Model requests are stateless structured requests. Plans use registered authority IDs and fields. Existing page filters survive model interpretation. Commentary may cite only existing traces and substitute only existing metric values; numerical inventions and fabricated citations are rejected.

## Reporting rules

Unknown values remain unknown. Units, currencies and tax bases remain separate. Group totals require every component. Filtered project totals are withheld when no authoritative subset calculation exists. Future completion events remain subject to Delivery's existing event-date gates. Scenario manufacturing durations rerun the existing lifecycle engine against a cloned state. Historical programme questions use the dated adopted source rather than today's cached projection; historical non-schedule domains remain unavailable when a governed historical snapshot is absent.

Excel and structured exports retain all result rows. Browser tables show the first 50 with counts. PDF shows up to 40 rows per table and Word up to 100, both explicitly disclosing that all rows are available in Excel/structured exports. Power BI export is a populated UTF-8 CSV dataset with schema, project/analysis keys and provenance, **not a PBIX file**. Charts use table cells and retain their units, dates and populations.

## Provider configuration

Set `CMENG_ASK_AI_API_KEY` and `CMENG_ASK_AI_MODEL` on the CMeng service to enable language-model planning and commentary. Never put the key in source control or a browser form. No provider key or model was configured on the production or review service during implementation. Without those settings, the application explicitly says **Deterministic CMeng Summary**; it supports the deterministic question vocabulary and follow-ups without claiming model reasoning. Provider outages preserve the deterministic result and disclose the unavailable commentary.

The model boundary is implemented and tested with structured successful, outage, invalid-citation and fabricated-number responses. A real provider response requires service configuration and is not claimed as verified. Deterministic Arabic intent recognition and Arabic headings are present; full Arabic prose and broader free-form interpretation depend on the configured model. Arbitrary organization logos, complete historical reconstructions for every domain, and executable PBIX generation are not claimed.

## Fresh scenarios

`tests/project-ask.test.ts` covers distinct projects and sessions; EV 720 / AC 900 = CPI 0.8; required 64 / delivered 52 = 81.25%; four delivered units above the order; exact coverage threshold boundaries; governed programme need dates; future verification; context-preserving critical/discipline/value-curve/executive/branding/export follow-ups; inert references; live-view refresh with unchanged original downloads; compatible-unit grouping; absent historical year; historical source replacement; 22-week manufacturing with a 134-day change from the original duration; a BOQ-only project; complete 75-row exports; full-package Excel; structured model restrictions; and gateway restart continuity without login.

The full-package and visual checks found and corrected an empty-register Excel crash and PDF footers creating blank pages. Existing project-switching assertions remain intact, with their harness updated to execute the new reset functions.

Browser review and deployment details are recorded below once performed.

## Browser and export review

On review commit `7deaf6102634953f5d7a485b634c0c95de54f26a`, a fresh governed `ASK-BROWSER-A` project produced CPI 0.8 and materials required 64 / ordered 48 / delivered 52 / coverage 81.25%. Excel, PDF, Word and JSON were downloaded through the actual browser controls and independently compared; the numbers and analysis identity matched. Saving and reopening a personal live view worked without a login prompt.

Browser review found a structured Commercial calculation basis rendering as `[object Object]`; the adapter now retains its method, reporting date and source references as readable text. It also found the old sample-project overview waiting for a portfolio entry from which samples are intentionally excluded; the gateway now opens sample overviews directly. Both corrections have focused regressions. Wide analysis tables now show useful primary columns, with every field expandable and retained in exports. Reference attachments can be removed from the next request.

Two further scenarios verify a mixed native/scanned PDF through real contained OCR, including per-page reading receipts and an inert malicious instruction, and withdrawing a governed package while preserving an independent project's results and the original saved snapshot. The PDF assertion CPI 1.5 remains a reference discrepancy against governed CPI 0.8.
