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

Not started. CI operations: four cold project shapes, slowest 5,978 ms against 5,000 ms. The T11 cold Dashboard
(8,900 activities, owner limit 10 s) varies between CI runners: 5.3 s on f77811a2, 9.2 s and 10.5 s on two runs of
this branch; locally the two builds measure the same within noise (11.6-13.5 s against 12.7-14.3 s under load).

## Checks used

- `defect_check.py` (session scratchpad): the 27 DMCC-UPD2 page defects, read from a capture of every page.
  Live f77811a2 (P6 only): 3 of 27 pass. This branch, local, stored DMCC programme: 26 of 27 (closed sections on
  Actions required still above the check's limit when nested sections are counted; 20 shown closed at load).
- `generic_check.py`: build number, singular, set-up buttons, internal wording, hour decimals, count separators,
  answer-first, closed sections, page errors; for any project.
- `headline_consistency.py`: per project, the finish headline, Data Date, criticality and submitted finish read on
  Dashboard, Command Center, Brief, Completion Forecast, Completion History, Cash Flow and Payments. Live f77811a2:
  all 20 projects consistent.
