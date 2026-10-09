# BOQ numeric trust correction — 5 October 2026

Stage 1 remains open. This is engineering evidence for a shared defect class,
not an independent acceptance receipt or a production-readiness declaration.

## Failure class and policy

The 3.00-to-300 and 4.00-to-400 readings demonstrate the same failure class.
Repeated passes of the same OCR engine can agree on a wrong number. A confidence
score, an exact span in OCR text, balanced quantity/rate/amount arithmetic, or
adoption of the document does not establish the accuracy of its numeric readings.

Ingestion now separates numeric observations from canonical calculation fields.
OCR quantity, rate and amount remain null in the canonical BOQ, while
`sourceNumericReadings`, source cell images/bounds, original OCR interpretations,
hashes and locators preserve the available evidence. PDF receipts without native
page-reading provenance are also withheld. Arithmetic conflicts quarantine the
numeric triple across PDF, CSV and spreadsheets. Native readings without that
conflict retain their existing behavior, including an explicit zero.

The same rule applies when restoring old state, selecting a source, rebuilding
cached quantities, displaying supplied figures and preparing Ask/report outputs.
Retained allocations cannot reintroduce quarantined quantities into planned or
forecast S-curves. Separately dated installed measurements remain available.
Unknown calculation inputs are not authoritative zeros.

This change does not introduce a numeric confirmation workflow. Source review or
a readable structured source is still needed before uncertain scan readings can
become usable calculation data. Native PDF text extraction is source-reading
provenance, not a guarantee that a document's contents are true. There is no
claim that OCR has become error-free or that the complete BOQ is certified.

## Bounded source-reader correction

Generic table geometry now handles small skew, uneven header boundaries,
interrupted vertical rules, faint horizontal rules and initially unreadable
numeric cells. Physical line items remain in the population when their numeric
glyphs cannot be read. Shading and blank price cells do not supply values.
Original page files and source hashes are retained as regression evidence;
there are no project IDs, source-specific numbers or corrections in product logic.

The three retained original BOQs contain 28 pages and 340 visually transcribed
item rows: building 224, flood 24 and electrical 92. The final source replay
retains all 340 rows, with matching counts on every page and all three original
hashes unchanged. There are 295 retained candidate quantity readings matching
the assistant's visual transcription and 45 unresolved quantities. All scan
numeric observations remain excluded from canonical calculation fields.
The assistant transcription is not independent consultant acceptance. These
previously used projects are permanently known regression evidence, never fresh.

## Evidence and remaining gates

The new trust tests inject 100 different correlated decimal-loss cases with
high confidence, exact OCR spans and balanced arithmetic. None becomes a
canonical numeric fact. Positive native/zero cases, adopted/restored state,
cached quantities, S-curves and actual Ask/JSON/Excel output paths are covered.
Three trust tests fail meaningfully on the preceding product modules; the native
positive case passes there. Seven source-geometry cases likewise fail before the
correction. The added row-retention case protects unreadable physical items.

Focused evidence: 141 relevant regressions passed before the additional
Ask/JSON/Excel case, and all five numeric-trust cases pass including that output
integration. The whole original-source replay passes its population/hash checks.
Full current-candidate regression and release gates must finish before claiming
this candidate has passed them.

The full run exposed one legacy test that expected high-confidence, balanced OCR
to produce `complete: true` and one verified row. That is precisely the automatic
promotion removed by this policy. Its expected certification is changed to
unresolved, while its exact observed quantity/rate/amount (100, 20, 2000), source
page and absence of an arithmetic conflict remain asserted. This is an explicit
contract change, not a change to the correct source numbers or a relaxed numeric
tolerance. The first full run's failure is retained as evidence; it is not counted
as a passing run.

Previous candidate bdf936f passed GitHub Verify 2237 and Scale 2122: 1,096
regressions, a separate internal 100-project cohort, the unchanged 5,000 ms cold
dashboard gate (4,771.202 ms), 20k upload-to-ready (3,677.866 ms), durability and
Delivery gates. Those receipts do not certify this follow-up. Internal generated
cohorts do not replace fresh external projects or independent stage acceptance.

The activity register preserves the remaining gates: exact current-code checks,
fresh materially exercised cohorts, review deployment/hosted proof, historical
source provenance and independent Stage 1 challenge. No production deployment or
stage acceptance is implied by this correction.
