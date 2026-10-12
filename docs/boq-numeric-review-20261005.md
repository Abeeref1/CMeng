# BOQ numeric review — 5 October 2026

Stage 1 remains open. This change implements the missing way to resolve retained
BOQ readings; it does not certify OCR accuracy or close any readiness stage.

## User workflow

Normal native spreadsheet/native PDF values retain their automatic path. The
existing shared guard still withholds unconfirmed scan readings and arithmetic
conflicts. One BOQ action opens a consolidated review of the remaining sources.
The user can inspect the retained original, edit questionable figures, select
reviewed consistent rows together, and save the reviewed batch once. Unpriced
fields remain absent; zero remains a real number. Drafts and selections survive
paging and failed saves. The interface never performs a silent decimal repair.

The confirmed overlay is bound to project, source hash, revision, item and reading
fingerprint. It feeds the shared BOQ selection used by quantity mapping, S-curves,
scope intelligence, Ask and reports. Original files, parser receipts and readings
are preserved. This does not adopt documents, approve contract scope, establish
complete source coverage or certify installations. Decisions survive restart and
are not requested again for the same unchanged source/reading. Changed sources
cannot inherit stale decisions. Native sources do not enter this review.

Batch validation is all-or-nothing. A duplicate request reuses its recorded result;
reusing the same request identity with different values fails. Source changes and
competing decisions invalidate the review token; unrelated project changes do not.
Arithmetic checks use the existing parser tolerance. The caller's audit session is
recorded honestly; this change does not add app-wide authentication or RBAC.

## Verification scope

Permanent tests cover ten fresh generated projects per run, numeric zero,
unpriced quantities, complete and partial batches, source/reading changes,
cross-project isolation, duplicate/conflicting requests, restart, failed saves,
source-byte preservation, S-curves, real HTTP, deterministic Ask, JSON and Excel.
The ten-project workflow test injects deliberately wrong OCR into independently
drawn source PDFs. It verifies review propagation; it is not an OCR accuracy test
or independent external-project acceptance. Cohort IDs, original source hashes
and independent numeric truth are printed with the test receipt.

UI component tests execute the actual browser script for grouped selection,
paging, draft retention, explicit source attestation, retries and project changes.
They are not a substitute for hosted browser acceptance. Current-version full
regression, scale, release gates, hosted proof, fresh external projects and
independent acceptance remain required and must be recorded against the exact
candidate. Earlier successful 169c419 workflows do not certify this change.

## Remaining limitation

Scanned numbers are not automatically certified solely because OCR agrees with
itself or the arithmetic balances. Scans without independent support still need a
single consolidated source review. This change removes per-field/per-page repeat
confirmations; it does not claim that every poor scan can be resolved automatically.
