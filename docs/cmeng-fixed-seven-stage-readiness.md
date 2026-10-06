# CMeng fixed seven-stage readiness agreement

This records the user's controlling readiness agreement. PR numbers, branches,
the historical A–K development batches, suite names and green CI runs do not
replace it. Existing features and the original domain requirements remain in
scope. Dated acceptance receipts retain their historical evidence only.

Acceptance: **Stage 1, open; 0 of 7 stages accepted**. No enterprise readiness
or production handover is certified by this document.

## Execution amendment — 6 October 2026

The user explicitly authorized continuing the engineering and testing for
Stages 2–7 now, with the evidence compiled for independent review later.
Pending Stage 1 historical-origin decisions and independent acceptance no
longer prevent that work. This changes execution order, not the required
coverage, assertions, independence or final acceptance standard.

Track engineering work and acceptance separately. Preserve each stage's
outstanding decisions and findings; do not describe an internally tested stage
as independently accepted. Follow technical dependencies where they matter
(for example, validate a reference calculator before relying on it to certify
CMeng). Other implementation, test design and verification can proceed.
Any defect found is fixed and retested against the affected shared behavior.
Only a demonstrated material defect blocks dependent work: wrong figures or
dates, false authority, source loss, isolation/access failure or unusable core
behavior. Keep unaffected work moving. Historical classification, outstanding
paperwork, minor presentation issues and pending independent decisions remain
on the open-items register without stopping unrelated engineering. They are
not silently waived or relabeled complete.
Do not merge or promote the production release merely because later-stage
engineering has started.

## Rule governing every stage

Every stage receives real regression, adversarial and fresh unseen testing.
After internal acceptance, provide a hard independent-consultant challenge pack
for that same stage. The consultant uses different black-box inputs and unseen
projects, challenges page/lens/report/export/Ask consistency, and attacks
malformed, duplicate, missing, future, conflicting and authority cases. A
consultant finding reopens the same stage. Internal tests cannot stand in for
independent acceptance. No finding can be deferred out of final acceptance.
Engineering may proceed under the execution amendment above while an
independent decision is pending.

A failed blind project permanently becomes regression data. Its project, seed
and input files cannot be counted again as unseen proof. A feature cohort counts
only projects that materially exercise the feature. Product fixes address shared
root causes; project-specific corrections cannot be product logic.

## Stage 1 — Close all known defects

Start from every discovered defect, including remaining strict blind failures.
Reproduce and classify each as a real product defect or a genuinely invalid
fixture/expectation. Fix the generic root cause, add exact regressions and
adversarial/negative cases, and retest on new unseen projects.

Closure requires every known defect fixed or genuinely disproved, a passing
fresh unseen acceptance cohort, and the independent stage challenge. The defect
register must reconcile earlier findings as well as the latest CI failures.

## Stage 2 — Strict-suite root causes and fresh reacceptance

Classify every failure as a real product defect, invalid fixture, incorrect
expectation or deliberately ambiguous evidence. Rerunning familiar tests until
green is not acceptance. Protect evidence identity, source authority, BOQ/source
preservation, routing, semantics, candidate/current authority and fail-closed
behaviour through shared root-cause fixes.

Run full regression and new-seed blind projects, at least ten genuinely fresh
projects for every materially tested feature family. Closure requires no
unexplained strict-suite failures or fresh-cohort cross-page/source-authority
mismatch, plus independent acceptance.

## Stage 3 — Independent truth mechanisms

Verify CMeng against truth calculated outside CMeng: a standalone CPM solver
supporting calendars, FS/SS/FF/SF and lag; an independent CPI/SPI/EVM workbook and
recalculation script; a commercial ledger/reconciliation workbook; a notice/date
calculator; and explicit independent Delivery lifecycle/state tables.

These mechanisms cannot consume CMeng's calculated answers and call that
verification. Claims/EOT matters requiring professional judgment remain
human/domain determinations, with no invented mathematical oracle. Closure
requires canonical facts/calculations to reconcile, legitimate authority/basis
differences explained, fresh adversarial projects and independent acceptance.

## Stage 4 — PMO domain-by-domain certification

Certify feature families separately, rather than treating page coverage as
engineering certification:

- Contract/programme authority.
- CPM, critical/driving paths, float, near-critical and milestones.
- Progress, quantities, resources, manpower and S-curves.
- Forecast and recovery.
- Delay, notice, windows, claims/EOT.
- Commercial, EVM, payments, variations, claims, retention and LD exposure.
- Procurement and long-lead.
- Delivery, design, RFIs, quality/NCR, interfaces, readiness, T&C and handover.
- Applicable risk/HSE and management control functions.

Within each domain check calculations, tables, reconciliation, filters,
search/sort/paging, drill-down, source evidence, revision comparisons, authority
workflows, charts, actions and negative states. Every feature family must
materially work on at least ten fresh unseen projects and receive independent
acceptance.

## Stage 5 — Cross-domain and management integration

Test CMeng as one PMO/PMC system: Contract–Schedule; Schedule–Progress–Resources–
BOQ; Schedule–Procurement–Delivery; Schedule/Delay–Claims/EOT; Claims/EOT–Contract;
EOT–LD; BOQ–Progress–Commercial; and Risk–Delivery–Forecast.

Specialist, Project Controls, Project Director and management consumers must
agree on facts, Data Date, authority, populations, filters, classifications,
actions and conclusions. Closure requires no unexplained contradiction, silent
authority promotion, population mismatch or management distortion, plus
independent acceptance.

## Stage 6 — Ask CMeng, reports, filters and exports

Deterministic/local calculation comes first for CPI/SPI, critical/negative-float/
delayed activities, milestones, Data Date, WBS/Zone, contract dates, claims and
commercial position. AI may explain established facts without inventing them.

Certify WBS/Zone/Location/CBS/package filters; search, sorting, paging, Top-N and
saved views; page/report consistency; applicable PDF/Excel/CSV/Word/JSON/Power BI
outputs; charts/exported figures; source provenance; units, currencies, Data
Date, authority and Not established states. Closure requires screen, Ask,
reports and exports to reproduce the same governed truth, plus independent
acceptance.

## Stage 7 — Operations, final blind certification and exact production acceptance

Certify authentication/RBAC, isolation, concurrency, cold start, scale, restart/
durability, failed writes/retries, backup/restore, rollback, monitoring/graceful
shutdown and large Schedule/BOQ/Delivery workloads. Require 100+ focused cases
for critical feature families and at least 100 completely fresh projects for the
deep final blind run, then full known-real-project regression and complete
browser/management/report/source-preservation acceptance.

The exact release tested must be the exact release deployed. Final readiness
requires no known material wrong-answer defect, false authoritative zero, silent
evidence loss, project-specific product logic or unexplained screen/report
mismatch, with repeated fresh-blind success and independent final acceptance.
It is not defined by a percentage of tests passing.
