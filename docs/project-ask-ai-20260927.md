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

## Verification checkpoint — 2026-09-27

All 761 tests passed before the final project-heading reset, and the focused eight workspace/switching checks passed with that reset. The unchanged release latency gate also passed: a fresh 20,000-activity upload reached a calculated dashboard in 2,885.9 ms; the 12,500-activity, three-revision cold-open case took 4,241.7 ms. GitHub Verify and Scale Certification passed on `b96a5bb`.

The browser switched from ASK-BROWSER-A (required 64, delivered 52, 81.25%) to ASK-BROWSER-B (required 80, delivered 40, 50%), with separate results and saved views. Review exposed a briefly stale project heading during that switch. The final reset now clears the heading, reporting date, suggestions and saved-view name immediately, before any network response.

The browser file-chooser check was interrupted and then the execution environment disconnected. The actual attachment control has not been verified; successful API/OCR tests do not close that browser check. Final browser validation of the corrected review build, responsive review and a real configured model response remain open. No new access-control flow is introduced.

## Ask CMeng inside each project

Ask CMeng is part of the project workspace and project navigation. The main-menu shortcut remains available as requested; it opens Ask for the current project or directs the user to choose a project first. Opening it keeps the active project, reporting date, project switcher and other project pages visible. Returning to a project page restores that page, and switching projects clears the prior conversation, references and downloads before loading the new project. An unloaded or mismatched project cannot open an Ask conversation. No login or permission flow is added.

The interrupted browser attachment action was retried successfully on `6fc0fe8`: the reference PDF attached and both native/scanned pages were read. Its reference-only label and reading disclosure were visible. The earlier final-commit verification rerun passed all 761 tests and the existing performance/durability gates; the first 5.164-second cold-open miss remains recorded in PR 162.

## Accuracy, routing and upload continuity — 2026-09-27 follow-up

This follow-up removes model planning from the request path. Social replies run before schedule/authority production. Recognized facts, arithmetic, counts, filters, rankings, charts and exports use CMeng locally even when a model is configured. Interpretation/composition runs only after the local AnalysisResult exists. Mixed greetings retain the substantive question. Social follow-ups retain the preceding factual analysis for later downloads.

Evidence selection scans the full requested population before ranking. All explicit Top N rows, authority findings, material exceptions, metrics, qualifications and source-basis receipts are mandatory. Ordinary rows are represented by compatible population aggregates and ranked supporting rows. There is no first-eight-findings, first-twelve-rows or first-two-authorities fallback. The coverage manifest records source/applicable populations, direct/aggregate representation, omissions and material coverage; chat and exports retain it. Attachment retrieval scans complete page text across all available pages and discloses partial document review. A generated 100-page reference test finds its relevant passage on page 76, beyond character 3,000.

Large model requests are partitioned into complete evidence batches. Bounded read-only retrieval validates project, project version, Data Date, known fields and record budgets. The model cannot execute SQL, arbitrary URLs or mutations. Structured output checks scope, mandatory evidence acknowledgement, source/evidence correspondence, numerical metric substitutions, named entity substitutions, population claims and causal overstatements. Optional critic rejection preserves the deterministic result. These checks reduce risk; they do not establish that every possible free-language assertion is semantically correct.

Defaults: 48,000 context tokens, 5,000 output tokens reserved, 2,000 safety tokens, 240,000 total estimated input tokens, 12 calls, 2 retrieval rounds and 40 retrieved records per analysis. `CMENG_ASK_CONTEXT_TOKENS`, `CMENG_ASK_OUTPUT_TOKENS`, `CMENG_ASK_TOTAL_INPUT_TOKENS`, `CMENG_ASK_MAX_CALLS`, `CMENG_ASK_RETRIEVAL_ROUNDS`, `CMENG_ASK_RETRIEVAL_RECORDS`, `CMENG_ASK_ATTACHMENT_PASSAGES` and `CMENG_ASK_CRITIC` configure the bounds. The estimator conservatively uses UTF-8 bytes; actual provider usage is recorded separately. Oversized mandatory evidence is disclosed and withheld from AI rather than silently truncated.

Optional model transport accepts `CMENG_ASK_AI_BASE_URL` and `CMENG_ASK_AI_PROTOCOL=responses|chat-completions|none`, with `CMENG_ASK_AI_MODEL` and an optional endpoint key (`CMENG_ASK_AI_API_KEY`). An explicit endpoint supports a customer-hosted compatible service; redirects are rejected. Providers must support the selected structured-output protocol. CMeng's deterministic authorities do not depend on the provider. These settings do not establish deployment data residency; the existing Railway environments remain in their existing region. Wider storage/authentication portability work is separate and is not bundled here.

Fresh checks cover a 140,000-row combined population (100,000 activities, 30,000 BOQ items and 10,000 materials), late-position exceptions, source-order invariance, independent Top N requests, more than 100 mandatory findings across batches, project isolation, evidence replacement/withdrawal, restart, future dates, compatible provider transport, and consistent exports. Model tests use controlled responses. No paid real-model semantic acceptance run is claimed.


The cold-open gate exposed unnecessary PDF-library startup and unconditional snapshot rewrites during unchanged restore. PDF readers now load on use; bounded flat records serialize through a size-checked native path while large containers/text remain streamed; unchanged modern snapshots are not rewritten on read. Save-failure, OCR containment and restart tests remain in the gate. Before these fixes the cold-open measurement was 5,915.9 ms; after deferred loading/bounded encoding it was 5,015.4 ms; after avoiding unchanged restore writes it passed at 4,899.2 ms. The final fresh 20,000-activity upload-to-calculated-dashboard measurement was 3,362.9 ms, with 2,500.8 ms for its first dashboard. The five-second threshold was not relaxed; the cold-open headroom remains narrow.
