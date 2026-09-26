# Live claim trace, 26 September 2026

Trace starts at production `1c4ab9cb7e0d3b7608109c5750e0b2f24f8a3c33`.
The application and health endpoint responded successfully during the reported
outage. This does not disprove a user's intermittent access problem. Railway
recorded ORBIT overview preparation at 25,071 ms and DMM at 17,803 ms during
this investigation; their repeat/health responses were much shorter. The
connection-delay question and first-analysis computation remain separate.

## Findings and shared changes

| Claim | Evidence and disposition |
| --- | --- |
| First analysis is slow when several projects open | Real concern. The earlier performance document does not certify eleven simultaneous first analyses. Four default workers could exceed a small CPU allocation; requesting one or two was previously clamped to at least three. Capacity now respects available parallelism and a smaller requested limit. |
| Slow analysis happens only once, during onboarding | Incorrect as an unconditional statement: worker eviction or restart discarded analysis caches. Completed page reads now survive eviction/restart and require the identical project, release and persisted source version. A project mutation invalidates only that project's retained reads. Missing, changed or incompatible cache entries are recalculated, never served as a fallback. |
| Startup repeats document work even when a fact is absent | Confirmed: full control-PDF extraction during ingestion did not retain an attempt receipt. A missing threshold or productivity statement caused the same native/OCR extraction at subsequent worker startups. Completed attempts now retain a receipt scoped to source hash, reference, requested metric scope, reader version and OCR configuration. "Not found" stays absent; parse/OCR errors remain retryable. Legacy documents need their first receipt generated. |
| Reopening can create repeated migration work | The replay found the older control refresh downgrading canonical-source-v7 to v5. The next worker then migrated it again, incrementing the project version and correctly invalidating the retained analysis. The refresh now preserves completed v5/v6/v7 migrations; restart regression coverage checks the version remains stable. |
| Near-critical count on QA-CPS is too broad to prioritize | The supplied float count is reproducible. The project threshold is not established. Keep the real count, display the five-working-day screening basis and denominator/percentage at the KPI, and disclose when the watchlist covers most of the execution population. Do not choose a smaller threshold to make the result look better. Project-evidenced working-day/hour thresholds continue to govern. |
| Calendar parser fails valid P6 calendars in every project | Not established. The matched source fields below contain labels or incomplete working patterns. Those must stay unresolved. Human-readable complete shifts, overnight periods, structured P6 shifts, exceptions and inherited calendars remain supported. Missing definition messages no longer claim a parenthesis syntax error; malformed structured syntax retains its own diagnostic. |
| Duplicate risk source conflict | Confirmed in RAK and ORBIT. One validation fact was exposed at both risk.validation and sourceInterpretation.riskValidation. The owning producer now supplies a semantic finding key; the shared issue aggregator counts that key and source-row population once while retaining all paths, pages and references. Separate facts or populations remain separate. |
| null near-critical KPI says calculated | Confirmed in RAK. The shared management metric constructor now makes absent/nonfinite values unavailable, including their authority and health. A measured zero remains calculated. |

## Source identity and calendar meaning

The eleven source packs used in the replay contain matching SHA-256 content
for every retained live source document in those projects. Supplemental source
manifests absent from live are excluded from the prepared replay before timing.

| Current project | Source file | SHA-256 |
| --- | --- | --- |
| DMM-HDC-P2 | S03_Current_U02_9800_Activities_2026-08-31.xer | 2ca1a6fc9100a671d9222c6800a57b2002645526d7a5d72dbe328febd5d92f21 |
| RAK-PORT-P4 | S03_Current_U02_6400_Activities_2026-08-31.xer | fbdf2f1cdf03b698c98feb842174e67231dfd1e043410bce7edd900ebaa01f63 |
| ORBIT-JED-PLH-P3 | S03_Current_U02_12800_Activities_2026-08-31.xer | 0394da981a49a17a673539fe12c95819b8570d061a565ce35ea6b4f72747f8a1 |

The separately supplied 7,800-activity DMM source has SHA-256
`7a7527ef68c13670adec88ecd5db6fc4067295e32db1051515422163f379a342`.
It is not the live 9,800-activity source. Live DMM's risk register lacks
probability/impact columns and contains Medium, High, Low and Extreme ratings;
it is not the alleged register with every row rated Extreme. RAK and ORBIT
also have multiple ratings across the complete register, despite the first
rows all reading Extreme. Their genuine conflict is identical source scores
with different supplied ratings. Rating thresholds are never invented.

RAK clndr_data entries include `Sat-Thu`, `Sun-Thu`, `24/7 marine`,
`Tidal window`, `Port access`, and `LOE`. These are not complete shift definitions.
ORBIT's first four calendar definitions are readable; its unresolved permit
calendar says `Authority permit windows` and is not blocking the current CPM.
Live DMM similarly has readable calendars used by the calculation and unresolved
labels such as `Night` and `Utility witness windows`. Count affected activities,
not just all calendar records, when describing the effect on a forecast.

Oracle distinguishes calendar Data (clndr_data) from Work Hours Per Day
(day_hr_cnt). A scalar conversion factor does not supply shift start/finish
times or date-specific exceptions:
https://docs.oracle.com/cd/F74773_01/English/Mapping_and_Schema/xer_import_export_data_map_project/97869.htm

## Verification scope

Regression checks cover retained negative extraction attempts versus retryable reader failures, null versus genuine zero, semantic issue deduplication,
distinct source facts on the same row, disclosed default and explicit project
thresholds, unresolved calendar populations, worker eviction/restart, cache
release/version/project boundaries and invalidation after an upload.

A CPU profile of the real DMM source identified repeated header recognition
for every table cell and repeated parsing of identical dates. Header meaning
is now resolved once per column; pure date parsing uses a bounded memo of exact
input strings. Date semantics and source values are unchanged.

The eleven-project timing observations are recorded separately from upload,
PDF/OCR preparation and the historical production timings. All observations,
including failures and slow samples, are retained. A passing correctness suite
is not a claim that every cold response meets the latency target.

The first two-CPU DMM run with OCR enabled returned HTTP 503 at 120,018 ms,
the existing worker startup limit. Its immediate repeat returned 503 at 11 ms.
Tracing isolated this startup work to control-assertion PDF refresh, before the
overview calculation. These failed observations are retained separately.
The subsequent calculation comparisons disable OCR for both revisions and
therefore do not certify total onboarding time or full document-reading speed.

## Still separate from this patch

The installed-quantity/BOQ classification defect, incomplete full-page reading
receipts, Cost Outlook calculation certification gaps, candidate commercial
memo classification and adoption of draft/future programmes remain tracked
in the 15-project audit. No project-specific numeric edits or automatic calendar
assumptions are used to close these items.

## Two-CPU offline observations

These comparisons use identical prepared source states. OCR was disabled in both comparison revisions to isolate the analysis path; the separate enabled-OCR timeout above remains an open performance observation. Fresh ingestion reconstructs adoption from the pack, rather than cloning every live authority decision. These are local results, not Railway response times.

| Project | Previous first analysis (s) | Patched first analysis (s) | Previous repeat after 11 projects (s) | Patched repeat (s) |
| --- | ---: | ---: | ---: | ---: |
| DMM-HDC-P2 | 33.868 | 13.206 | 15.224 | 0.040 |
| EP-400KV-TL2 | 25.923 | 11.473 | 9.524 | 7.301 |
| JAZ-RTR-T3 | 23.342 | 20.092 | 7.072 | 0.006 |
| JBL-GAUC-EPC1 | 33.544 | 26.183 | 10.719 | 0.028 |
| JED-DWT-S1 | 54.933 | 32.505 | 9.323 | 0.004 |
| RAK-PORT-P4 | 52.849 | 36.412 | 8.678 | 0.004 |
| RUH-TB-P5 | 65.075 | 45.537 | 10.671 | 0.004 |
| RYD-MC-HTA | 68.179 | 48.938 | 10.219 | 0.004 |
| RYD-NME-PKG-C | 83.066 | 59.902 | 11.265 | 0.004 |
| ULA-HRI-P3 | 78.212 | 58.524 | 8.635 | 0.043 |
| ORBIT-JED-PLH-P3 | 113.561 | 78.017 | 16.291 | 0.017 |

The eleven simultaneous first reads completed in 113.565 seconds before and 78.022 seconds after the patch. All 44 analysis/repeat responses returned HTTP 200 with the correct project identity. Ten patched repeats were below 43 ms; EP still took 7.301 seconds and is retained in the table. No outlier was dropped. Health maximums were 29.59 ms before and 21.87 ms after across 2,223 and 824 observations.

The separate single-project DMM run took 14.019 seconds before and 10.438 seconds after. It is reported separately from the concurrent group. Cold latency still exceeds the five-second target. CPU sizing and retained reads improve performance but do not close total onboarding/OCR performance.

The table records the first patched replay, before the migration-version guard was added. Tracing the EP outlier found its version changed from 46 to 47; the cache correctly rejected the old version. The migration guard and the unchanged-version restart behavior passed focused regression checks afterward. The 7.301-second observation is retained rather than replaced with a favourable estimate.

Full raw observations, including the enabled-OCR failure, are in `project-batch-observations-2026-09-26.json`. OCR remains enabled by default and no production OCR setting was changed. OCR-disabled timings cannot certify reading coverage or total onboarding performance.

## OCR-enabled retained reading check

DMM was separately processed with OCR enabled. Its 60-page technical appendix
and 30-page utility requirements document both retained matching source hashes
and complete OCR coverage: 90 OCR pages, zero failed or unresolved pages.
Control-assertion refresh took 62.972 seconds and found no new governed facts;
deferred full-page OCR took 253.779 seconds. These are reader-stage observations
on the available host CPUs, not the two-CPU calculation benchmark.

On restart with OCR still enabled, the same control extraction took 99.634 ms
and the completed deferred-page check took 0.360 ms, with no documents re-read.
The load of the retained project state itself took 2.711 seconds. Missing control
facts remained missing. Full details and file hashes are in
`ocr-retention-observations-2026-09-26.json`. This demonstrates retained reading
coverage, not independent certification of every fact extracted by OCR.
