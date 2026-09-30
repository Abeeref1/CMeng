# CMeng A–D acceptance reconciliation — 30 September 2026

## Decision

Development reached Batch D; acceptance did not close A–C. The user's 66-task, A–K baseline and task numbers are unchanged. Preserve implemented work. Do not call C complete or promote D while earlier gates remain open.

| Batch | Implementation / release | Acceptance |
|---|---|---|
| A, Tasks 01–07 | Foundation and closure changes merged; full cross-domain adoption is incomplete. | NOT ACCEPTED TO FULL SCOPE |
| B, Tasks 08–13 | Management views merged; focused live checks fail; ownerless-record loss reproduced. | NOT ACCEPTED |
| C, Tasks 14–20 | PR #193 merged and deployed; live failures and missing required fields remain. | NOT ACCEPTED |
| D, Tasks 21–28 | PR #195 is a partial draft; latest Verify and Scale fail before tests. | NOT ACCEPTED / NOT DEPLOYED |

Railway's latest production deployment when checked: `cd4ebc40-3e4e-4573-85e0-3d6d6329c369`, SUCCESS, exact main commit `a5f85338565ce4e0bcdb669bb72c0c20a2842db3`. This is the C release, not D or repair PR #196.

D head inspected: `94005847b75a967d11fc998d8af811c10bffb7c7`. Repair head inspected: `9b17749988abbfd01caa5cb65e34b55e4b74af48`. Later audit-document/temporary-workflow-cleanup commits do not constitute an application repair.

## Evidence inspected

- [A/B acceptance #237 / 36672538844](https://github.com/Abeeref1/CMeng/actions/runs/36672538844), release `796d14c01e8cd196b9741e2a648647beff5404fe`: saved reports contain 19 projects, 4,362 passing runtime checks and 3,896 passing browser checks, no failed checks. Overall job conclusion is CANCELLED. Both broad scripts omitted Accountability. This is not full Batch B acceptance.
- [C acceptance #238 / 36675790332](https://github.com/Abeeref1/CMeng/actions/runs/36675790332): 4,362 runtime checks pass; browser checks are 3,878 pass / 18 fail. All 18 failures concern visible Near-Critical threshold authority.
- [Focused B audit / 36677458483](https://github.com/Abeeref1/CMeng/actions/runs/36677458483): page-first Dashboard → Command Center → Accountability → MCP across 19 projects, ORBIT last. 76 observations attempted, 74 rendered, 2 timed out; 353 checks pass / 5 fail. Three flags are one shared Programme Changes reconciliation failure; two timeouts are the sparse Accountability response issue. They are not five distinct root causes.
- [Read-only live trace / 36678831092](https://github.com/Abeeref1/CMeng/actions/runs/36678831092): exact production release and unchanged source identities/hashes; confirms valid blocked Accountability responses and a Programme Changes population check comparing 8,803 with 8,802.
- [D Verify / 36676390789](https://github.com/Abeeref1/CMeng/actions/runs/36676390789) and [D Scale / 36676390667](https://github.com/Abeeref1/CMeng/actions/runs/36676390667): FAIL. The S-Curve projector does not populate new required fields `currentSchedulePhasingPercent` and `currentSeriesMeaning`; compilation stops before tests.
- [Attempted B repair / 36679329694](https://github.com/Abeeref1/CMeng/actions/runs/36679329694): red-before tests reproduced failures; the automated patch step failed and verification/commit steps were skipped. That run did not commit or deploy the proposed repair. The temporary branch-only repair workflow has been removed; original run evidence is retained.

## Additional controlled reproduction

The exact production Accountability producer was tested locally with one open overdue major NCR linked to an activity. With its owner missing, it returns zero actions and a blocked/no-ownership position. With the same record and an owner present, it returns one action. This violates the requirement to show unassigned actions. It is a controlled producer test, not a claim that this particular test NCR exists in a real project.

Tested source blob: `46aee6c6c6a8cdd9069514cebd40233401c527d8`, matching `packages/runtime-api/src/accountability-intelligence.ts` at the deployed main commit. Records currently enter the action population through non-empty dimension rows; missing ownership can erase otherwise eligible operational records.

## Task-level status

These statuses distinguish present code from full acceptance. No full task sign-off is granted by this reconciliation alone. Missing acceptance evidence is not automatically a software defect.

| Task | Requirement | Verified position / closure still required |
|---|---|---|
| 01 | Existing Truth Kernel enforcement | Partial: management state extensions exist, but the shared fact view lacks explicit Data Date/population/diagnostic fields and all-domain enforcement is not established. |
| 02 | Population authority | Partial: helpers and Delivery consumers exist; every required count/rate/percentage consumer is not accepted. |
| 03 | Best Available Position | Partial: one production call to the shared resolver selects Long Lead. Equivalent shared adoption for the other specified domains is not demonstrated. |
| 04 | Cross-module intelligence | Partial: context contains programme stages, BOQ and domain summaries, not the full specified dependency/milestone/interface/action access. |
| 05 | Canonical Management Action | Partial: used by Command Center/Accountability; ownerless-record loss is confirmed and Accountability milestone arrays remain empty. |
| 06 | Conditional feature states | Helper, adapters and selected UI consumers exist; full real-project state/usefulness acceptance remains open. |
| 07 | Business-language diagnostics | Known translations and unknown-code fallback exist; primary-page coverage acceptance remains open. |
| 08 | Dashboard prioritisation | Partial: cards sort by tone and gaps are secondary; material-exposure ordering is not implemented in that sort. |
| 09 | Dashboard false-zero/state presentation | Partial: Long Lead and retained evidence handling exist, but all-domain state acceptance is open and focused live Dashboard checks still fail. |
| 10 | Consolidated Dashboard priorities | Reason/WBS grouping exists; complete driver-chain/package/milestone-consequence grouping is not accepted. |
| 11 | Command Center | Action-first table exists; live consistency failure and incomplete Accountability input remain. |
| 12 | Accountability | NOT ACCEPTED: sparse responses fail to render and ownerless operational records can disappear. Preserve eligible issues before ownership grouping. |
| 13 | MCP | Partial: observed stage groups, driving activities and dependency panels exist. The primary stage table does not deliver the full package/dependency/readiness/owner/current-versus-forecast requirement. |
| 14 | Management Brief | Narrative sections and grouped drivers exist; heading tests do not establish source-to-screen management acceptance. |
| 15 | Programme versus Activity Review | Distinct rendering paths exist; real-project usefulness/filter acceptance remains open. |
| 16 | Split Look-Ahead populations | Live implementation misses overdue starts. Draft PR #196 corrects start/finish backlog and lateness; not deployed. |
| 17 | Look-Ahead management view | Panels exist; draft repairs address backlog contamination of forward counts. Full blocker/owner/milestone/required-by acceptance remains open. |
| 18 | Milestones | Required Authority, separate Forecast and Owner columns are absent from the primary control table; required category separation is incomplete. |
| 19 | Near-Critical | 18 live visibility failures; draft visibility repair not deployed. Lowest float/later-than-baseline counts are not float erosion between revisions. |
| 20 | Changes / History / Trend | Distinct views and minimum-point guards exist; current Programme Changes identity/source-row reconciliation fails. |
| 21 | Resource classification | Draft business classifier/eligibility filters exist; no successful D build or D-specific test-file additions at inspected head. |
| 22 | Resources management | Partial draft gap/peak/WBS/action fields and table exist; more work than the stale Task-21-only checklist implied, but not verified. |
| 23 | Progress taxonomy | Not completed by D: existing progress bases are preserved; separate EV progress is absent from the Progress Report basis object. |
| 24 | Progress Status | Still derives currentSchedulePercent from S-Curve currentForecastPercent; D has not corrected the producer. |
| 25 | Progress S-Curve | Required types added without corresponding producer values; current D build blocker. Complete semantics, not just optional typing. |
| 26 | Progress Breakdown | No implementation change in the D diff; full integrated schedule/progress/procurement/design/owner requirement remains open. |
| 27 | Installed Quantities | No implementation change in the D diff; preserve existing evidence but do not claim the full BOQ-to-forecast chain is accepted. |
| 28 | Man-Hour S-Curve | Draft classifier-based labour filter added; compatible-unit and actual-hour evidence acceptance remains open. |

## Why previous completion labels were unreliable

Implementation, passing selected tests, merge, successful deployment and requirement acceptance were conflated. Broad acceptance omitted a Batch B page. Several Batch C tests check headings/string order rather than complete behaviour. PR summaries became stale or overclaimed completion. Post-deployment acceptance was not treated as a stop condition before starting the next batch.

## Continuation gate

Close residual A adoption → B behaviour and page-first acceptance → C missing requirements and exact-release acceptance → resume the existing D draft. No restart, no discarded working features, no change to the 66-task baseline, and no advance to E.

Every closure needs task, exact tested/live commit, source/input, expected and actual output, regression evidence, real-page evidence and outstanding qualifications. Review each page across all projects, ORBIT last. Never count an unexecuted test, a heading assertion, a cancelled workflow or a successful deployment as full task acceptance.

This is a dated evidence reconciliation, not a fresh full all-page human acceptance audit or an automatically updating monitor. No application changes were merged/deployed and no project data was edited during this check.
