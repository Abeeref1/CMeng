# Shared mechanisms A-F, 13 Nov 2026

Branch `fix/shared-mechanisms-20261113`, on top of the P6 parity candidate (f77811a2). Started from the DMCC-UPD2 page
review (27 defects). Each fix is a shared rule, not a DMCC case.

## A. Baseline-only state

`projectFacts.schedule.programmeState` (programme files by content, progress recorded, baseline only, one statement)
is read by every page that compares progress, movement or recovery:

- Dashboard / Command Center / Brief / Progress verdicts and the progress panels: "Only the baseline programme is
  supplied. Progress and programme movement can be measured after the first update." (was "matches baseline plan",
  "0.00 pp level").
- Activity Review, Delay Windows, Variance Trend: "Not measured" instead of a baseline compared with itself.
- Recovery: "No delay to recover" at the source (no open negative float, no finish later than a contract date, a
  programme present); recovery candidates are not offered as the answer.
- Man-Hour S-Curve: planned hours are the answer; spent and earned hours start with the first update.

## B. Unknown is not zero

A count read from a register that was never supplied is "Not supplied" (reading box, tiles, commercial counts, Site
Instructions, payment linkage, Payment / IPC rows); its chart is not drawn. Cash Flow states the certificate count it
holds. Accountability says no owner register is supplied instead of "0 records".

## C. One shared fact per measure

- Brief "reconciled" reads the Completion Forecast reconciliation (`forecastHeadline.reconciled`).
- Programme constraints: one statement for every tile (activity constraints and the Must Finish By date).
- Long lead: the Long Lead page and the Dashboard count the same programme long-lead activities.

## D. Classification

- Testing & Commissioning and Handover task lists: the programme's own WBS section first; names only as a fallback,
  without appointments, subcontracts, approvals and trade-to-trade handovers.
- Codes shown with their programme descriptions ("Marble & Granite (MB)"); identity stays the code.
- One location code type per project (the type carried by the most activities), so Area and Level codes are not
  mixed in one list.
- Master Control Programme stages from the programme's WBS phases first, in delivery order.

## E. Answer-first layout

- The Management brief's conclusion and Actions required's own list lead their pages.
- Links to records owned by another page and the source-record browser follow the answer.
- Readiness cells with nothing linked are plain text (Look-Ahead had 225 closed cells); findings inside an action are
  one list (Actions required had 74 nested sections).

## F. Wording and formatting

No build number, set-up buttons in a Settings menu, singular for one, one date form, whole hours over 1,000 and
separators in counts (one number reader for every page), plain "percentage points", planning float bands, no record
counts on link panels, next steps that name a real document or page.

## G. Performance

Not started. CI operations: four cold project shapes, slowest 5,978 ms against 5,000 ms on f77811a2 and 6,022 ms on
16cfeb85 (earlier runs of the same gate: 6,847, 8,884, 9,179 ms). The T11 cold Dashboard (8,900 activities, owner
limit 10 s) varies between CI runners: 5.3 to 7.4 s before this branch, 7.1 to 10.5 s on runs of this branch (7.5 s
on 16cfeb85); on an idle local machine 7.5 / 8.1 s (f77811a2) against 8.5 / 8.4 s (this branch).

## Checks used

- `defect_check.py` (session scratchpad): the 27 DMCC-UPD2 page defects, read from a capture of every page.
  Live f77811a2 (P6 only): 3 of 27 pass. This branch, local: 26 of 27 on the stored DMCC programme and 26 of 27 on
  a fresh project made by uploading the same file (FRESH-BASELINE-1113). The one left: Actions required still holds
  77 sections in the page when nested and hidden ones are counted (223 before; 20 shown closed at load); Look-Ahead
  45 (247 before; 15 shown closed at load).
- Focused verification set locally: 808 of 809 (the 10-second cold Dashboard timing gate on a 2-core machine).
- `generic_check.py`: build number, singular, set-up buttons, internal wording, hour decimals, count separators,
  answer-first, closed sections, page errors; for any project.
- `headline_consistency.py`: per project, the finish headline, Data Date, criticality and submitted finish read on
  Dashboard, Command Center, Brief, Completion Forecast, Completion History, Cash Flow and Payments. Live f77811a2:
  all 20 projects consistent.

## Live result (24ed6e42, deployed 13 Nov 2026 23:53 Dubai)

CI on 24ed6e42: regression, raster, concurrency, acceptance, independent and the focused set passed; operations
failed only on the cold-project gate (slowest of four 6,946 ms against 5,000 ms). Data check before and after: 20
projects, 472 documents, nothing lost. DMCC XER unchanged; DMCC P6 parity unchanged (25,629 of 25,629, 547 / 1,059 /
0). No project's forecast changed against f77811a2.

| Check (live) | f77811a2 | 24ed6e42 |
|---|---|---|
| DMCC-UPD2 page defects passed (27) | 3 | 26 (#26 partly: Look-Ahead 247 to 45 sections in the page, Actions required 223 to 76; 15 and 19 closed at load) |
| UPTOWN-100 page checks (10) | 2 | 8 (one plural sentence on Near-Critical; Actions required 81 nested sections) |
| QAT-VLC1 page checks (10) | 3 | 7 (one plural sentence on Completion Forecast, "activity(ies)" on Resources, nested sections) |
| Shared facts on 7 pages, 20 projects | 20 consistent | 20 consistent |

## Live result (e9685aa3, deployed 14 Nov 2026 01:15 Dubai)

e9685aa3 adds count agreement at source and in the shared number reader ("1 activity", "activity(ies)").
CI: regression, raster, concurrency, acceptance, independent and the focused set passed; operations failed only on
the cold-project gate (8,937 ms). Data check 20 projects / 472 documents, nothing lost; DMCC XER unchanged; DMCC P6
parity unchanged; no project's forecast changed; shared facts consistent on all 20 projects.

| Check (live) | f77811a2 | 24ed6e42 | e9685aa3 |
|---|---|---|---|
| DMCC-UPD2 page defects (27) | 3 | 26 | 26 |
| UPTOWN-100 page checks (10) | 2 | 8 | 9 |
| QAT-VLC1 page checks (10) | 3 | 7 | 9 |

The one check left on each is the number of sections inside the page when nested and hidden ones are counted
(Actions required 75-81; Look-Ahead 45-64; Contract Particulars 63 on QAT). Closed sections shown at load: 15 to 19.

## 14 Nov 2026 (aed0fea0)

- Actions required: the per-page calculation checks are one table (29 sections, 28 of them hidden behind a picker,
  before). DMCC-UPD2 locally 76 to 48 sections in the page.
- Look-Ahead: labour cells and cells with one or two records show them in the cell (QAT-VLC1 had 43 closed sections).
- Contract Particulars: each obligation's wording and its references are in the row (QAT-VLC1 had 42 closed sections);
  "1 source occurrence", "1 document reference".
- Programme gaps classified and two defects repaired: docs/repair-notes/cmeng-programme-gaps-20261114.md.

## Open

- Locations without a location code are grouped by WBS level 2 (for DMCC, phases such as "Construction"), per the
  SW-27 rule; changing it needs the owner's decision.
- G: the 5-second cold-project gate. Four cold 8,100 to 8,900-activity projects requested together on a 4-core CI
  runner: slowest 6,964 ms (14e59b4a), 7,702 ms (aed0fea0); each project's calculation 5.8 to 6.5 s in the server.
  One cold project alone: 2.6 to 3.4 s locally (bundle 1.6 to 2.0 s across about 30 parts of 30 to 180 ms each,
  module resolution 0.7 to 1.0 s, facts and actions 0.4 s); two at once on two cores: 3.4 to 4.2 s each. The response
  is 6.5 MB. A larger young heap did not help under concurrency. Closing it needs the single-project cold path
  cut by about a third.
