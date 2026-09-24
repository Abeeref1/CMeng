# System release gates

The September 2026 follow-up changes shared producers and consumers. It contains no project IDs, fixed certificate counts, claim totals, completion dates or special-case financial corrections.

| Reported defect | Cause and system correction | Regression evidence |
| --- | --- | --- |
| Cross-page contradictions | Domain checks did not compare the final management consumers and exported page values. `page-value-checks.ts` compares the actual outputs for dates, scope, progress, claims, certificates, currencies, operations, HSE and forecast authority. | Distinct project fixtures; all 29 specialist and 3 management outputs and JSON reports; a corrupted consumer amount must fail. |
| Source gaps appeared as system defects | A single count combined categories and repeated the same issue across pages. Shared issue grouping retains affected pages; Source Quality separates source requests, failed system checks, review actions and pending checks. | Shared issue tests and Source Quality consumer checks. |
| No consistent verdict | Page renderers lacked a common position contract. `position-review.ts` produces the verdict, status vocabulary, next action and owner for pages and reports. | Missing and complete quantity/cash evidence and a separate schedule scenario. |
| Claims pages lacked checks | No integrity branches covered Notices or Delay Windows. Population, retained claimed days, timing rules, window date movements and net movements now have explicit checks. | Runtime fixtures with future and undated records; production-source calculation probe. |
| Audit actor always blank | History views hard-coded null and mutations had no request identity. Signed anonymous sessions and background-process identities are recorded at persistence. | Async session isolation, spoofed-header rejection and restart persistence. Legacy history remains unattributed. |
| LOE disappeared from the matrix | The renderer received execution rows only. It now counts the full input and displays LOE/WBS exclusions separately. | Matrix population test. |
| Cash chart used two axes | One SVG placed certificate bars and cumulative values on different axes. Two aligned, separately labelled single-axis charts now preserve dates, negatives, future plans and the Data Date marker. | Credit geometry, currency/tax separation, scope and axis tests. |
| Guessed staffing defaults | The shared delivery producer inserted 4/6/8 without supplied assumptions. Defaults are now empty; only explicit caller scenarios are allowed. | Delivery and runtime tests assert no default scenarios. Source-hours comparisons remain available. |
| Future records were inconsistently disclosed | Registers had a shared date contract but inconsistent visible summaries. Every page now renders the available date partitions and excluded future/undated populations. | Date-boundary and scope rendering tests. |
| Cold dashboard performed the full analysis | Repeated sort construction, token comparisons and source calculations consumed request time. Shared comparators, exact indexed scoring and versioned reuse reduce calculation cost; current positions are prepared before readiness. | `npm run test:release:latency`: fresh process, three 12,500-activity revisions, first shell/portfolio/overview/dashboard requests, five-second hard target. Startup preparation is separately measured, capped at 60 seconds, and never counted as passed request latency. |
| Dashboard lacked management hierarchy | Position now leads with a verdict, followed by record exceptions, a submitted-completion trend and decisions. NCR/RFI actions retain source owners/dates and sort by severity, overdue days and age. | Operational sorting/age tests and live role review before closure. |
| Empty projects showed a quantity system failure | The new cross-page fixture exposed a missing `unitKeyed` field in the empty quantity response. The default schema now satisfies the same contract as populated projects. | New-project cross-page fixture with no BOQ. |

Run `npm run test:release` before deployment. The CI verification workflow includes the cold-dashboard gate. Live browser inspection of all pages, all six specialist role lenses and report previews remains a release acceptance step. A passed calculation does not validate absent source evidence or contractual entitlement.

Live acceptance found two further shared presentation problems: record-level references expanded into hundreds of near-identical source rows, and full date-scope prose displaced the dashboard figures. Identical correction requests now retain the union of all source references and affected pages while counting once. Source Quality groups the requests behind disclosures; each register retains its full date-partition table. Dashboard decisions avoid repeating the same NCR/RFI record already shown in delivery exceptions.

The verification review also added count, identity, partition and date-arithmetic checks for Programme Changes, Revision History, Variance Trend, Installed Quantities, Milestones, Forecast History, Independent Forecast and Contract Particulars. Operational source partitions are checked explicitly. Missing independent comparisons retain a precise evidence dependency; genuinely unexplained calculation gaps remain assigned to CMeng. An official award remains a source authority, never a manufactured independent award. Submitted float and unconstrained calendar calculations retain explicit adoption review.

A live Update position check found that its receipt certified raw state while normal pages certified the data-date reporting view. Rerun certification now consumes the same reporting view. The persistence layer also records actors against evidence, publication and rerun source records, so their secondary history rows use the captured request actor; existing unattributed history remains explicitly legacy. A future-dated NCR fixture verifies receipt/page consistency and actor retention without mutating the raw controls.

### Live review follow-up: verdict population

The deployed Claims & Notices table showed 143 missing event dates while its
verdict showed 145. The summary independently counted correspondence records,
including two determinations. It now consumes the same assessed-event count as
the table. The global page-value gate additionally compares both claims pages'
assessed counts and verdict facts, and an intentional verdict-only mutation must
fail. Synthetic three- and seven-event cases include extra determinations.

The same review found that a shared source interpretation could replace a
commercial verdict with a schedule-progress sentence. Progress verdicts now only
apply to progress and management pages; other domains keep their own verdict.
