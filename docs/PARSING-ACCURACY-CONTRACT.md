# CMeng Parsing Accuracy Contract

## Objective

CMeng does not claim that every malformed real-world source can always be converted into canonical data.

CMeng makes a stricter, auditable claim:

> No source unit may become verified canonical project data unless CMeng can prove what it read, where it came from, how it was interpreted, and whether anything remained unresolved.

The target is 100% verified accuracy. When 100% verified extraction is not possible, CMeng reports incomplete coverage rather than guessing.

## Four independent claims

1. Physical coverage: all source bytes/pages/sheets/records expected were inventoried.
2. Syntactic parsing: every source record was mapped to the source-declared schema without positional guessing.
3. Structural integrity: identifiers, references, row counts and required structures reconcile.
4. Semantic verification: dates, units, calendar rules, values and business meanings are interpreted correctly.

A file may pass one layer and fail another.

## XER rules implemented

### Encoding

CMeng currently detects and preserves UTF-8, UTF-8 BOM, UTF-16LE, UTF-16BE, inferred UTF-16 without BOM, Windows-1256 fallback for Arabic, and mixed UTF-8/Windows-1256 at line level.

### Schema drift

CMeng does not assume a fixed TASK column count for a P6 release. Each %F record defines the active schema for following %R records. Unknown or new fields are retained and reordered fields are mapped by field name.

If source row value count differs from the source-declared field count, the row becomes unresolved. CMeng does not shift values to make the row fit.

### Table order

Cross-reference integrity is evaluated after the full source is read. TASKPRED may appear before TASK and CALENDAR may appear before or after TASK.

### Missing optional tables

Missing RSRC, TASKRSRC, UDFVALUE or other optional tables do not crash the parser.

### Truncation

A missing %E terminal marker prevents complete status.

### Duplicates and references

CMeng currently detects duplicate TASK.task_id, duplicate project/activity-code keys, missing predecessor or successor task references, missing WBS references and missing calendar references.

### Date ambiguity

ISO, MDY and DMY forms are recognized. A value such as 03/04/2026 is not silently guessed; it remains ambiguous until context resolves it.

### Units

Known P6 hour fields retain hour semantics, including total float, free float, durations and relationship lag. CMeng does not automatically convert hours to days without the governing calendar.

### AI

AI is a second-reader and anomaly assistant, not an authority that can overwrite parsing evidence. An AI repair proposal remains non-authoritative until deterministic checks or governed review confirm it.

## Coverage

Every %R record is counted. Parsed rows plus unresolved rows must equal source rows seen. Coverage is reported at whole-file and table level.

Cross-source activity matching reports baseline count, current count, matched count, current-only IDs, baseline-only IDs, duplicate stable IDs and exact coverage percentage.

Example: 10,000 matched out of 10,800 current activities = 92.5926% coverage and 800 current-only activities. The 800 must remain visible.

## Current verified automated boundary

- Arabic UTF-8
- Arabic Windows-1256
- mixed UTF-8/Windows-1256
- UTF-16LE BOM
- UTF-8 BOM
- arbitrary table order
- dynamic %F schema mapping
- optional table absence
- calendar reference integrity
- ambiguous dates
- duplicate IDs
- missing relationships
- truncated XER
- embedded-tab field-count mismatch
- explicit hour semantics
- AI non-authority
- 10,000 vs 10,800 activity population reconciliation
- 100,000-activity parsing and integrity counting
- row-level coverage denominator

## Not yet certified

- full CALENDAR.clndr_data semantic decoding including complex work patterns, exceptions and DST effects
- resource and role semantic integrity beyond raw table preservation
- UDF semantic typing across P6 releases
- cost/account/resource curve semantics
- malformed ZIP/container recovery
- real customer XER corpus across multiple P6 releases
- cross-project and external relationship edge cases
- field-level byte offsets in addition to line/source-row provenance
- every historic P6/Contractor XER variant

These remain Gate 01B work items and must not be represented as complete.