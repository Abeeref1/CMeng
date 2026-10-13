# CMeng ongoing system-wide repair — durable execution checkpoint
Updated 2026-10-13. Canonical working branch: `fix/cmeng-systemwide-20261013`.
Source baseline: `8a34a6f6972b8c950ad46fd7b64995fdf3f344fb`. Do not use `main` as the current engineering candidate.

## Owner instructions, unchanged
- Complete the **entire** known CMeng defect inventory (original T01–T12, SW-01–SW-57, F01–F61 / 274 findings, original S-items, ABB findings and the original seven stages) by repairing the shared engines and all consumers.
- Work on all 23 existing projects as a product-wide baseline, not by implementing project-specific special cases.
- Do **not** require sign-in, new account permissions or new user-role administration now. Existing professional viewing lenses remain views only. Do not change access policy in this repair.
- **No intermediate or partial deployment.** Complete the known defects and consolidated technical checks on one exact candidate; then provide **one link / exact revision for the owner to deploy**.
- The owner will then run **real live parsing and optional paid AI** within the spending cap, inspect actual data on the 23 projects, and verify conclusions. Do not declare owner acceptance for them.
- Preserve originals, authority, hashes, source fields, saved decisions and imported records. AI may assist extraction/matching, not replace governed calculations. Unknown must not silently become zero or approval.
- An unrelated pasted project dashboard from the 2026-10-13 discussion is **not confirmed CMeng evidence**. Do not add its numbers or findings without verified source identity.

## Work completed in this commit — T11 shared worker-startup defect
- Original defect: `project-http-worker.ts` awaited `refreshDeferredPdfReads()` across all saved PDF evidence before binding its HTTP listener. A large or unprocessable scan could keep a project unavailable, even though uploaded source and prior reading checkpoints were already durable.
- Change: bind the project HTTP listener after existing lightweight derived refreshes; defer PDF/OCR work to the idle worker scheduler. Process one source PDF per idle turn; foreground requests stop **new** deferred work from starting. No OCR source text, hash, authority, decisions or adoption is modified by the scheduler.
- `refreshDeferredPdfReads` accepts an optional exact document ID; the existing unfiltered API remains backward compatible. Use the same original PDF reader and durable per-page checkpoints, not a second parser.
- New focused tests: deferral during foreground reads, serial one-at-a-time work, cancellation and failure containment.
- Limit: already-running OCR on one large PDF is not preempted mid-page; this does not certify the full responsiveness target or all document-reading coverage.
- Status: **code saved; CI/build, integrated workload and live project acceptance not yet established**. No deployment.

## Mandatory resumption, never restart the plan
1. Read this checkpoint and `docs/acceptance/system-wide-closure.md`, `docs/acceptance/cmeng-f01-f61-274-defect-plan.md`, `docs/cmeng-fixed-seven-stage-readiness.md`, and `docs/repair-notes/systemwide-20261013.md`. Do not rename or waive historical findings.
2. Check the exact saved branch commit and GitHub CI output. Fix TypeScript/regression errors; never weaken real checks to manufacture a pass.
3. Continue T11 worker/large-pack responsiveness and source/decision/calculation cache integrity, then T02/T03 source coverage and real AI route; T04 decisions; T05 shared facts; T06–T08 domain engines; T09 actions/navigation; T10 text/visuals/Ask/reports; T12 consolidation, with independent repairs parallel where safe.
4. Update this checkpoint with **actual** implementation, evidence, unresolved issues and the precise next action, on the same branch, before a session ends.
5. Do not deploy until full known-defect implementation and the single consolidated release candidate are ready for the owner's hands-on review.

## Current acceptance
No T01–T12 task, stage, SW root or full defect inventory is represented as closed by this checkpoint. No new user approvals have been made.

## Continued repair — T05 / R1 / R8 project Overview stability
- Identified directly from existing failing regression `tests/project-gateway-preservation.test.ts` in the exact previous release CI: the Overview's `issueAssessment` and navigation status changed after visiting specialist pages despite no source/version change.
- Shared root cause: `overviewForProject` read volatile resolved/management projection caches whose population depended on page-opening order.
- Correction: current-version **saved certification receipts** alone determine lightweight Overview readiness; specialist and management pages still provide their own independently calculated live position. The Overview never treats a transient warm result as adopted or confirmed project state.
- Existing regression remains unchanged and must pass on the next integrated candidate; no source records, roles, login settings, decisions or contractual authority changed.
- Status: code saved; automated verification still pending, not yet independently accepted or deployed.
