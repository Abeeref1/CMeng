# CMeng — source audit of the 14 October owner-supplied repair hypotheses

This is an **engineering audit**, not a replacement repair plan, a speed-threshold change or an owner acceptance record. Controlling sources are the original `CMeng_Repair_Plan.md`, `AGENTS.md`, permanent guard archive and the original T01 ledger. Proposed fixes are hypotheses until exact-source/browser parity and independently calculated checks pass.

## A. T11 — confirmed architectural fan-out; proposed shortcut is not independently proven

At head `1fec74c4cca1f39e49d7dfd673b2e7f6ba8379ba`, `packages/runtime-api/src/project-projections.ts:8142-8203` shows `managementSurfacesForProject()` first constructs `buildBundle()`, then calls `resolveProjectModule()` for **all** `certifiedAnalyticalModules`, and certifies cross-module consistency. `resolveProjectModule()` itself produces a complete map the first time, so repeated lookups may be cached but the first full calculation remains expensive. `managementSurfacesForProject` then builds master dashboard, command center and master control. The management/dashboard request path in `server.ts:2838-2929` uses this producer. This is a genuine shared cold-load root, not a rendering-only problem.

**Qualification:** `packages/management-surfaces/src/projector.ts:919-1012` uses **all module states** to calculate `masterDashboard.readiness` and cross-module `consistency`. Simply skipping 29 modules and rendering `positionVerdict` and tiles would omit or silently alter existing fields. The correct engineering change is a dependency-scoped cold dashboard path **with proven output parity** for its established tiles, and honestly `not_evaluated`/unavailable for statuses not calculated; supplier/quality/risk dates and recorded decisions cannot be dropped. Other full modules remain available when their pages open. Do not silently replace a missing module with Ready, zero or a stale result. Require original four concurrent cold HTTP projects <=5,000 ms and dashboard field/date/authority/cross-page/Ask/export regression before calling this speed issue closed. No special hardcoded project behavior, no test workload reduction. Current exact-head T11 on `1fec74c4` run `38550473408`: 8,238.186151 ms (fail); prior `4d978c07` measured 8,822.715170 ms (fail). Differences across runner load cannot prove speed improvement.

## B. Source authority / withheld counts — real issue, but candidate-only field is not the entire story

`project-state-types.ts:289` fixes the immutable `EvidenceDocument.authority` field as `candidate_only`, and five source-ingestion sites preserve it. **However**, `basisState` and recorded decisions (`project-state.ts:5493-5525`) can change the effective source basis; schedule use/adoption remains a separate controlled operation. `delivery-records.ts:143-149` requires confirmed complete register population, and `truth-kernel/src/index.ts:173-190` correctly withholds a complete count unless established.

The genuine defect class is a missing actionable **reader-to-evidence-established transition for individual record families**, not a justification to remove the provenance guard or require blanket approval for every clearly readable source fact. Validate per family and preserve original 548 candidate-only historical documents, existing active/adopted decisions, contradictions, source hashes and restart persistence.

## C. Unknown-to-zero — selectively confirmed, cannot blanket-replace every `??0`

`ui.ts` has legitimate empty-array counts as well as unsupported `??0`/ `||0` display defaults. The confirmed examples were established-register KPIs that use a numeric fallback even when the producer's field is null, and `renderManagementConsistency` showing `0 checks` when the number of checked items was absent.

Saved source fix `4bc80d9f791e88c28d8e3eb69e4086a3a83e9bb1`: explicit governed-count display for several payment/variation KPIs; missing future/undated register counts and missing consistency check totals now show Not established, while real established zero remains zero. Test `tests/t05-governed-screen-counts.test.ts` committed at `5f23c1f4ace440c278f0142f3b3f2eda23b9d167`, wired in `e969344ea8fb90e1d7d3a0a63058c8aaf44aaf69`. Exact-head focused build/checks `38551587604` passed. Do not claim all count fallbacks repaired; every remaining candidate must be source-classified.

## D. Paging — real screen consumer defects, server mechanism already exists

`response-paging.ts:35-44,68-78,185-199` deliberately sends partial *screen previews*, sometimes only 4/12/25 rows, while storing full source. Crucially, `recordDetailPage` at `response-paging.ts:224-265` already supports genuine server-backed query/filter/sort, original population totals and offsets; `server.ts:2451-2490` exposes `/record-page`. `ui.ts:5432-5459` supplies generic source-record retrieval. Some specialist consumers nevertheless count/render just the preview (original ABB source root `RC01`). Fix those consumers and advance/total metadata, not the original source storage or the already working endpoint. Keep the response-size ceiling.

## E. Labels, supplementary sources and float units — presentation repairs still require source semantics

`ui.ts:947-960` falls back to humanizing an unknown key, and `ui.ts:5432-5442` adds generic supplementary evidence groups. Controlled product field names should be statically mapped and tested for label completeness. **Do not** make uploads with arbitrary source file columns fail compilation, suppress data, or overwrite source field names. Float values are retained as source hours in numerous specialist views, including `ui.ts:2344-2369,1487,4955-4957`. One consistent days display must be calculated from the **relevant activity/calendar working-day hours** or explicitly labeled unavailable; dividing every value by 8 would fabricate schedule units. Keep original hour evidence accessible.

## F. Already implemented; do not redo

`packages/schedule-analysis-core/src/adapters.ts:519-530` uniquely reconciles XER `TASKPRED` ends without project ID when the original source identity is unambiguous. `adapters.ts:945` already reads `PROJECT.plan_end_date` as `declaredProjectFinishIso`. These still require original 23-project independent reader parity, but absence of code is not the current shared defect.

## G. Original T01 workbook is substantially pre-mapped; not 765 independent proofs

Owner Library `CMeng_T01_Full_Defect_Traceability_2026-10-14.xlsx`, sheet `04 ABB 641`, SHA-256 `b30041505c92ce20446ba584a44d69e95d02f7fcb7b98e50abc1e40776e4c296`:
- **522 of 579 historical ABB problems** have candidate overlap labels involving **15 distinct SW roots**. A single observation may carry two SW roots; preserve this overlap and check all relevant causes.
- **57 historical ABB problems** still lack a specific SW root; route to an evidenced SW cause or independent domain calculator after source review, never infer a mapping from an approximate name.
- **62 originally correct ABB checks** are separately protected regressions, not defects to “close.”

The original 57 SW checking categories help reduce manual individual confirmation; they are not all already executable and not every independent engineering or rendered-page requirement is covered by one generic check. Source reader, independent CPM/EVM/notice/state calculator and same-date actual visible page, Ask, export checks are still needed where original findings specifically demand them. Formal engineering closure is **code + source-grounded guard + correct consumers**, followed by the one **candidate** for owner live testing. The owner's later live review is not a prerequisite for delivering that candidate.

**Next exact work:** dependency-map management dashboard inputs (readiness counts, official facts, certification, KPI tiles and corresponding pages); implement *bounded* lazy producer behind original parity and guard checks, then repeat the full unchanged T11 benchmark. Independently verify candidate SW-root groups while continuing the remaining 57 unmapped ABB problem cases. No merge/deploy in this audit.
