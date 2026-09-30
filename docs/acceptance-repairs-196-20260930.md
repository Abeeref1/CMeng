# PR #196 — verified shared repairs, 30 September 2026

## Current decision

Application repairs are committed as `7e4f1452a8efd15de9b3d28e91a9036caf2be0da`. They are **not merged or deployed**. No full Batch A, B or C acceptance is granted by this receipt. Batch D remains paused in its existing draft; no D code was changed.

This receipt supplements, rather than replaces, the unchanged 66-task plan and the earlier [A–D scope reconciliation](acceptance-a-d-20260930.md). References there to these defects remaining unpatched describe the earlier audit snapshot; the code-level status of the specific fixes below is now superseded by this receipt.

## Application changes actually saved

| Shared defect | Corrected behaviour | Remaining acceptance |
|---|---|---|
| Sparse Accountability response misreported as a loading error | A structured, matching HTTP 409 blocked position renders its available result. Genuine request failures remain failures. Wrong-project, wrong-page and malformed responses remain rejected. | Live browser replay after a controlled release. |
| Programme Changes compares source-row counts with distinct activity identities | Distinct identities and retained source rows reconcile separately. Duplicate source rows and their ambiguity diagnostic remain visible. Missing/invented added rows, wrong membership and corrupted counts fail checks. | Real-project source-to-screen reconciliation on the released version. |
| Unassigned eligible records disappear from Accountability | Eligible actions are retained before ownership grouping, preserving issue, scope, source references and due dates. Missing ownership is explicit with an assignment action. | Page-first real-project usefulness review, including unassigned cases. |
| Unassigned overdue actions lose escalation | Overdue evaluation includes the retained source record, not only ownership-group details. An unassigned overdue NCR keeps its escalation. | Live display confirmation; full threatened-milestone functionality is not claimed complete. |

## Verification receipts

Successful repair run: [36684633298](https://github.com/Abeeref1/CMeng/actions/runs/36684633298).

Artifact: `shared-acceptance-repair-36684633298`, artifact ID `11083357174`.

The job checked original source hashes, proved the original failures, applied corrections, ran the checks below and only then committed and pushed the six application/test files to the existing repair branch. It did not merge the PR or contact production.

| Check | Observed result |
|---|---|
| Full `npm run verify` | Typecheck/build successful; **936 passed, 0 failed, 0 skipped**. |
| Focused repair checks | **11 passed, 0 failed**; these are included in the full-suite count, not an additional 11 independent tests. |
| `npm run test:stress` | **4 passed, 0 failed**. |
| Cold dashboard and upload-to-ready gate | Passed the existing 5-second thresholds. These are controlled test measurements, not production response-time claims. |
| Large snapshot upload / retry / restart | Passed: 545,265,069-byte synthetic snapshot; one retained revision before/after restart; other project and health checks successful. |
| Large Delivery calculation / evidence presentation | Passed the existing thresholds with 21,200 Delivery candidates, 30,000 BOQ items and 500 risks. Synthetic fixture, not a real-project acceptance audit. |

The first repair execution, [36684151676](https://github.com/Abeeref1/CMeng/actions/runs/36684151676), passed 935/936 tests and exposed the missing unassigned escalation. It committed no application changes. The second execution added that source calculation; it did not remove or weaken the escalation assertion. An existing request mock was given the actual HTTP 409 status to reflect the API contract; its behavioural assertions were retained.

Raw evidence contains `red-before.log`, `green-after.log`, `verify.log`, `scale.log`, performance/durability JSON, the repair diff, and `source-after.txt` identifying the committed source.

## What is still open

- Batch A: full cross-domain fact/population/best-available adoption and task-level acceptance beyond these scoped changes.
- Batch B: full original Dashboard/Command Center/Accountability/MCP requirements and page-first live acceptance across every real project, ORBIT last.
- Batch C: remaining milestone authority/forecast/owner/category requirements, genuine comparable-revision float erosion and complete task-level/live acceptance. Existing Look-Ahead and Near-Critical visibility fixes remain in this same draft.
- Batch D: existing draft retained, not advanced.

A green technical run is evidence for these checked repairs, **not** full batch acceptance. The earlier screenshot's run had 927 passes and four behavioural failures after successful compilation; the prior chat claim that it stopped on four TypeScript errors was incorrect.
