# CMeng — single system-wide closure board
**Control baseline:** Original CMeng Page Review / REEM 112 at release `47cd8029856ab6447497a9f922a2705460406a56` (Data Date `2026-08-31`). **All 62 pages and all 266 individual findings remain in `tests/fixtures/reem-112-review.json`, not in chat messages.**

> **CURRENT FORMAL ACCEPTANCE: 0 of 9 root causes closed; no CMeng release accepted.** Code changes and partial automated passes are implementation evidence, not acceptance. Baseline defect counts below are **original classifications, NOT a claim that those exact numbers remain unfixed in the newest branch**. Never subtract a defect without an exact defect-ID/source-answer/live-UI retest.

## 1. Numbers and identity — no scope replacement

- 62 reviewed CMeng surfaces: **27 misleading; 20 not useful; 14 partly useful; 1 not tested (read-only Ask)**. **0 fully useful** on the *original reviewed release*.
- **266 unique recorded defects**: **28 Critical, 103 High, 90 Medium, 45 Low**. Critical + High in that baseline = **131**, not an assertion that 131 still persist.
- **Eight repair-root buckets = 266 original defects**; **R9 is a cross-cutting test/design-control failure and has no additional counted defects**.
- This is CMeng / REEM 112, **not PMOSys**, and REEM is a diagnostic witness for system-wide rules, not a REEM-specific production feature.
- User's five-person acceptance team: **Planning Engineer, Project Controls Manager, Construction Manager, PMC/Consultant, Project Manager**. An accepted page must give **Position → Cause → Consequence → Action → Accountable role/owner → Due date → Source/authority → Drill-down** faster and more defensibly than the raw source register/programme.

## 2. Original root IDs vs execution order — IMPORTANT

The **original 266-defect fixture** uses `R4` for **source/column reading (43)**, `R2` for **non-blocking evidence states (27)**, and `R3` for **user correction and approval gates (9)**. Some earlier chat recaps mistakenly assigned 2/3/4 by **work order** rather than the actual fixture IDs. **Do not renumber `defect.root` in the fixture**; that would break the original evidence chain.

**No new plan:** agreed dependency order by workstream is **one facts producer (R1) → preserved reading (R4) → non-blocking evidence and explicit correction routes (R2 and R3) → PMC rules (R5) → action priorities (R6) → page usability (R7) → stability/performance (R8)**; independent answer testing (R9) runs during every workstream. Work across independent domains may proceed in parallel. Historical Stage 1 provenance and paperwork cannot stop unrelated Stages 2–7 engineering; only demonstrated material defects block the domain they affect.

| Canonical original root | Original defects | What must be repaired at shared-engine level | Root formally accepted |
|---|---:|---|---|
| **R1 Project facts** | **49** | A single authoritative, Data-Date-scoped producer for contract/EOT, programme, progress, RFI/NCR, procurement, claims, bonds/insurance, EVM, commercial values and management actions; every page/Ask/export must reconcile with it | **NO** |
| **R4 Source reading/retention** | **43** | Headers first, full source rows, correct register type, dates, section/discipline/WBS/cost fields, responsibility/awareness/impact/score/actual usage; never invent or silently discard supplied evidence | **NO** |
| **R2 Non-blocking evidence states** | **27** | Available source values remain visible with source qualification; clean candidates are not imaginary approvals; keep true conflict, pending determination, unavailable value and source-vs-CMeng disagreements distinct | **NO** |
| **R3 User routes** | **9** | Inline field-level resolution only for genuine conflict, missing item, actual adoption/approval or override; correct owner and actionable target, not endless upload/approval prompts | **NO** |
| **R5 Engineering/PMC rules** | **71** | Independent CPM/calendars/constraints/driving network, true contract vs awarded-EOT dates, sectional LD, claim/notice eligibility, completion/progress/EVM, resources/quantities, BOQ/WBS, procurement status/need dates, permits, security, payments, cash and forecast authority | **NO** |
| **R6 Risk-based action priority** | **2** | One action per source record/shared causal chain; ranking from critical schedule path/float, contractual milestone, money, workfront/safety consequence, owner/due then age; duplicates prevented | **NO** |
| **R7 Management presentation** | **53** | One clear answer-first page, role-specific decisions and human wording, count/label/date/basis consistency, no hidden main action, no giant duplicate data dumps | **NO** |
| **R8 Platform/runtime** | **12** | Empty-module handling, paged queries, bounded derived cache, no loss of documents or saved decisions, restart durability, responsive 62 pages and strict published performance thresholds | **NO** |
| **R9 Independent acceptance** | **Cross-cutting** | Original REEM source-answer comparison, actual rendered pages, all retained projects, 100 fresh blind projects/58 automatic pages, 62 live consultant surfaces, fresh adverse tests, error/performance gate | **NO** |

**The six October 8 fixes are located inside those roots** (procurement lateness R5/R1, false approvals R2/R3, action owner R4/R7, vocabulary R7, heavy quantity context R8, missed visual assertions R9). They do not supersede the other 260 historical findings or allow any root to be closed.

## 3. Exact original 62-page coverage — no department omitted

| Area | Original pages | Original defects |
|---|---:|---:|
| Management Control | 4 | 43 |
| Programme & Planning | 8 | 51 |
| Progress & Resources | 7 | 29 |
| Forecast & Finish | 4 | 15 |
| Delay & Time Entitlement | 4 | 20 |
| Commercial | 7 | 37 |
| All Delivery disciplines together: Delivery Control, Procurement & Long Lead, Design & Interfaces, Construction Control, Quality & HSE, Testing & Handover, Delivery Risk | 23 | 55 |
| Project workspace (including documents) | 4 | 11 |
| Portfolio | 1 | 5 |
| **Total** | **62** | **266** |

No page is removed from acceptance because it is empty, blank, unsupported, partially fixed or overlaps another module. Ask is still subject to its own independent tests even if the consultant's original surface was read-only.

## 4. What the latest commits DO and DO NOT prove — 8 October 2026

- Engineering code is on **PR #214**, branch `fix/cmeng-system-wide-20261007`, inspected head `c5679d1ffe3b87c3220db4aa0d7f09698e1c4d6b` (draft, **not merged**). Earlier Stages 1–7 work is on **PR #213**; do not discard/restart it.
- Latest review deployment independently checked at `aadd8d4c1559a011cc7ea8f07f52c130b71b05a9` and main production at `828b4ad9dc0a628b19c64d83b865b4e95244ec0f`: neither is the newest PR #214 head. **Therefore latest corrections are not live verified**.
- **Exact-head Scale Certification #2253 passed**: BOQ 50k, XER 100k, Schedule 50k + durable 10k. **Verify #2368 FAILED**: full regression **1,248 passed / 8 failed of 1,256**, operations **failed**; independent, raster and 100-blind-project acceptance jobs passed. Do not conflate successful subgroup checks with overall release acceptance.
- The eight failed regressions concern delivery consequence/source wording, isolated delivery renderer using `humanizeKey` without its dependency (four tests), an outdated owner assertion, a vocabulary renderer test, and inconsistent readiness summary text. **Investigate and preserve meaningful assertions; do not simply modify expectations to force green.**
- **Operational failure, unchanged 5,000ms threshold:** cold workflow **7,208.91ms**; 20,000-activity upload→ready **5,936.85ms**; first dashboard **5,114.35ms**. Profile the shared cold module/resolution and management issue/action producers, reduce repeated work; **never increase gate, shrink test population or suppress output**.
- Historical 2 GiB review disk reached ~2.04GB with ENOSPC; cache bounding reduced usage to ~0.70GB at a prior check but **restart and retained-data integrity must still be proven**. Never delete user source evidence, saved snapshots or Ask decisions to free space.
- Current recent code edits cover source-reported Delivered without fake delivery dates, false approvals, visible role owner, lightweight quantity context, and some shared status labels. These edits are **partial implementation**, not accepted defect closures.
- REEM reference numbers currently under formal source comparison include original contract finish **08 Sep 2027**, **13 approved EOT days**, adjusted contract date **21 Sep 2027**, submitted **06 Oct 2027**; reported **17 late packages / 27 source-status Delivered without actual dates** are consultant expectations to confirm from source, not values to hard-code in production.

## 5. Only valid next action sequence — same original plan

**A. Repair current exact-head failures (without changing requirements).** Triage eight regression failures by genuine renderer defect vs correct new behavior, fixing underlying code and test harness where needed. Profile and fix 5,000ms operational failures. Rerun complete unchanged CI and scale on the **same final commit**. Do not redeploy every intermediate commit.

**B. Finish each repair root across ALL modules and all stored projects.** One shared cause → all affected producer and consumer paths → preserved source receipts/authority → stable restart/rebuild → cross-page consistent answer. Continue existing R1→R4→R2/R3→R5→R6→R7→R8 dependencies, R9 always. Fix material independent findings wherever they occur; no REEM-specific branch or project-specific hard-coded number.

**C. Certify the seven existing stages, not a replacement plan.** Stage 1 historical provenance 1.09, independent challenge 1.18, formal closure 1.19 remain separately tracked. Stage 2 strict source/authority tests; Stage 3 domain truth; Stage 4 cross-domain consistency; Stage 5 integration; Stage 6 Ask/filters/exports; Stage 7 operations and live readiness. Formal stage acceptance requires independent evidence; pending historical classification is not a reason to stop unrelated root-cause fixes.

**D. Test independently and then visually.** Keep a REEM per-page answer key with original source references and known values; check full preserved page fields *and the rendered text/actions*; independently verify all stored projects; run 100 **fresh unseen** projects, 58 automatic pages each (5,800 page checks) plus 200 deterministic Ask checks; restart/rebuild; then 62-page visible live walk by the five-role engineering team. Clear Critical/High findings before production promotion.

**E. Deploy only accepted revisions.** Deploy **exact passing SHA** to review, inspect actual UI and source answers, address any reopened root, rerun gates, then permit production only with documented zero unresolved Critical/High and accepted operational performance. Keep rollback and original records available.

Every one of the 266 original defect entries remains represented by the unedited source fixture. Track each using: original page + severity + root ID + expected source answer + actual observed result + fix commit + same-head test + rendered/live proof + acceptance; mark **Closed** only after all proof is present. Unknown, missing or conflicting evidence is never silently converted to zero or declared fully approved.

---

# Previous checkpoints and engineering history

Review: `tests/fixtures/reem-112-review.json`, 62 pages, 266 findings. The historical 58-page internal registry gate remains in force; it does not replace the 62-page consultant walk (which includes project, document and drawer surfaces).

No root cause is closed by this implementation checkpoint. Completion requires shared behavior, all stored projects, 100 fresh blind projects, REEM known answers, and a live walk of the review surfaces. A new consultant finding reopens its affected root and page. Production promotion is not accepted with unresolved Critical or High findings.

| Root | Implemented in this checkpoint | Still requires closure evidence / further work |
|---|---|---|
| R1 Facts | Explicit current-fact consumer bindings, renderer-value mutation detection, Ask and management date/count wiring, missing-register handling | Complete equivalence inventory including actions, money and every displayed consumer; stored-project and blind gates |
| R4 Reading | Header-first delivery classification, old reference-file eligibility, visible column receipts, baseline activity correspondence | Native HSE table now parsed from retained reading; all original-file values still need live verification |
| R2 Evidence states | Clean delivery rows and dated procurement used immediately; completeness separate from row certification | Complete CPM calculations retained with qualifications; explicit unpaid zeros fixed. All field-level behavior still needs live verification |
| R3 Routes | Prominent one-click register-completeness action, exact unresolved record errors | All action items prefilled and field-level correction routes checked live |
| R5 PMC rules | P6 constraints in runtime CPM, completed work excluded from live float counts, source required-on-site fallback, plot/stage parsing, individual-item quantity populations, optional advance dependency | Shared programme checks, item curves, BOQ/WBS scope links and plot-crew sensitivities implemented; source-answer and live validation outstanding |
| R6 Priority | Source-record identity, duplicate merging, linked float/path/milestone ranking, retained register owners | Currency-aware monetary consequence implemented; named REEM blocker ordering still needs live verification |
| R7 Presentation | Plain register state, lazy paged float details, compact empty register, column receipt | Complete vocabulary audit, one-screen briefs and duplicate-navigation consolidation |
| R8 Platform | Empty delivery module HTTP 200; server-filtered activity pages and 50-row browser table | Browser view now excludes full activity rows and duplicate scope rows; empty module reads return HTTP 200. Other large tables and all empty-domain routes still need live validation |
| R9 Acceptance | Original review fixture, REEM expected values, adversarial visible-field test, retained 100-project equality suite | Exact-commit full regression, independent live 62-page answer walk and all-project evidence |

Test expectation changes are intentional: live float denominators exclude completed activities; the user-requested register label replaces “Awaiting review”. Fixture corrections add a missing WBS array, align controlled dates, read the canonical submitted-date header, and clone fetch responses before diagnostic reads. Test population sizes and deadlines are unchanged.

Additional tests assert retained REEM HSE table answers, ten independent mixed-security projects, explicit unpaid versus missing cash, constrained versus unconstrained forecast qualification, BEI/CPLI and screening populations, local plot-crew scenarios, distinct item curves and server register views. Full regression is in progress. No release closure is asserted.

## Live follow-up, 8 October 2026

The first browser walk covered all 62 review surfaces on release `93c383e356a85ab0dda1d98f1cc23e787a65ff14`. It reopened shared producers and consumers for completed-versus-open delay populations, full driving networks, procurement timing and actual milestones, permit validity, supplier identity, individual material measurements, formal risk populations, net certified receivables, current EVM comparisons, sectional milestones, resource coverage, recovery targets, and document receipts. The fixes apply to retained imports and future projects; no REEM-specific production branch was added.

Ask failed during that walk. Railway reported ENOSPC on its 2 GiB review volume. The derived read cache accumulated across releases without a size bound. This candidate clears disposable read caches at startup, bounds each project's cache, reserves storage for durable records, and cleans failed atomic summary writes. Source documents, project snapshots and saved Ask results are outside that cleanup.

The focused follow-up checks pass (90 tests). The prior full regression had 1,218 passes and nine failures: seven isolated-render helper/label assertions and two old expectations for receipts-only curves and unfinished-work populations. Those expectations now check the requested behavior, and all focused checks pass. The full regression, raster suite and fresh 100-project suite are running again. An expanded REEM answer key covers the live failures; exact-release all-project checks and a second 62-surface walk remain required. None of the nine roots is marked closed at this point.

The second candidate (`700646d`) cleared 1,775,861,760 bytes of available storage and Ask completed its analysis. Further live answer checks reopened certification completeness for the source status “Applied”, current EVM values conflicting with unconfirmed history, and Ask presentation/summary coverage. These now use the approved current EVM figures with a history reconciliation diagnostic, exclude uncertified applications, and retain readable source names plus every requested headline fact. Command Center contract comparisons now use the same awarded-EOT date as the shared facts.

Source reconciliation corrected three answer-key assumptions: the original-date recovery target is 160 hours / 20 days on the completion calendar; the source EAC is QAR 218,403,148 (QAR 3,372,852 below the current contract); and 69 permits have validity dates while PMT-0069 is pending with blank dates. Blank pending-permit dates remain blank. New checks also assert EV 187,206,039 and AC 194,697,087 from the active report, with the differing unconfirmed history retained. Focused follow-up suites pass (85 checks, then 58 checks including shared date consumers). Exact-candidate release checks are still required.

Release `2b06351` passes all 251 expanded REEM API answer checks. Restart testing then corrected cache cleanup to retain same-release entries while deleting obsolete release entries. Ten platform checks pass, including two simultaneous 30,000-activity uploads and restart in 79.2 seconds with unchanged latency/deadline assertions. This capacity test now runs as its own required phase, like raster and 100-project capacity acceptance; no test or deadline is removed. The portfolio wording assertion now matches the actual “Finish dates available” metric instead of the obsolete certification label.
