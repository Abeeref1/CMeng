# Upload durability and OCR containment — 26 September 2026

The audit against release `c8b047d6ff7bbfcd95225aa76996a6912f1edb09` reproduced two defects. Tesseract model-loading failures could escape its promise API and terminate the direct server or the production gateway's project worker. A snapshot serialization failure could leave an uploaded revision visible in memory and eligible for duplicate acknowledgement even though it would disappear after restart. The production gateway already isolates project state and worker failures; the audit did not reproduce an outage of the entire production gateway or a single shared snapshot across its projects.

## Changes

- Run Tesseract inside a disposable OCR worker. Initialization, recognition, unexpected exit, and timeout failures reject the affected OCR operation and retain a failed-page receipt. A later operation can create a fresh worker. English and Arabic models are pinned application dependencies and load locally; explicit model paths and other configured languages retain their existing support.
- Write and restore snapshots in bounded chunks while retaining the existing schema-1 JSON format and every source value. Large snapshots no longer require one complete JavaScript string. Legacy import uses the same reader and writer.
- Atomically write and synchronize original upload bytes and snapshots. Restore the last saved project position and invalidate derived results when a save fails. Return HTTP 503 with an explicit unconfirmed-save message. A retry cannot acknowledge a revision that exists only in memory. If reopening the saved snapshot fails, reject project access instead of exposing uncertain state.
- Commit document-register deletion before removing original files, so a failed commit preserves the retained source.

Snapshot writes still cover the complete state of the affected project. This change removes the aggregate string-length ceiling; it does not introduce a database or claim constant-time writes or unlimited memory capacity. A failure after an atomic replacement may leave a committed revision, so the response instructs the caller to check the register before retrying. Duplicate detection then uses the restored saved position.

## Verification

Local `npm run verify`: **731 tests passed, none failed or skipped**. Added tests exercise real Tesseract HTTP 403 responses, a stalled model request, malformed image recovery, locally bundled English/Arabic models, failed PDF-page receipts, failed source/snapshot writes, repeated failed upload attempts, deletion failure, Unicode and escaped JSON boundaries, large-file restore, and truncated-file rejection. Gateway coverage verifies another project remains available and a successful retry survives a process restart.

`scripts/upload-durability-scale.cjs` creates only synthetic data. It saves a **545,264,937-byte** snapshot, larger than the tested Node string ceiling of 536,870,888 characters, verifies duplicate retry identity, keeps another project available, and verifies the saved revision after a full gateway restart. The complete local scenario took 6,984 ms; this is not a single-upload latency measurement. CI runs the same scenario and retains its result.

The existing cold release gate passed: a fresh 20,000-activity HTTP upload reached its calculated dashboard in **2,676 ms**, against the five-second limit. The existing 51,700-source-row Delivery fixture calculated its first projection in **333 ms** and retained the same complete record and module fingerprints as the preceding release.

Before deployment, read-only checks recorded source/adoption fingerprints and canonical results for **13 existing projects and all 286 Delivery pages**, with no failures. The pull request records the CI result, deployed release, review upload checks, and the matching post-deployment comparison. No real project source or programme decision is changed by this release verification.

## Upload size correction — 27 September 2026

Project file uploads now allow **200 MB per file** (209,715,200 bytes), including programme, phase-programme, BOQ and general evidence uploads. `CMENG_MAX_UPLOAD_BYTES` remains configurable for each installation; invalid non-positive or non-integer values are rejected. The health response publishes the effective limit as `uploadLimits.maxFileBytes`.

Previously the shared request reader rejected files after 50 MB and displayed only `UPLOAD_TOO_LARGE`. A declared oversized upload is now rejected before buffering its contents. Both declared and chunked requests retain a bounded byte check and return HTTP 413 with the limit and a plain-language explanation. Chunked rejection preserves the response socket so the browser receives that explanation. The stable error code is retained.

Verification covers the exact 200 MB boundary, the first byte beyond it, configured limits, readable HTTP errors and a successful request after rejection. An isolated HTTP upload of the supplied 58,678,830-byte XER completed in 7.3 seconds, preserving all 25,630 activities, 97,230 relationships and 87,625 resource assignments. The revision survived a restart unchanged. This is an upload-and-retention check; the file's programme logic has not been certified. No production project was changed or programme adopted by this test.
