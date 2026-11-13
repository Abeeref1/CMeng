# P6 schedule parity: the DMCC-UPD2 61-day finish gap, 13 Nov 2026

Branch `fix/p6-schedule-parity-20261113` (from `fix/ai-cost-architecture-20261113` at 44634c42).

## The defect (DMCC-UPD2 page review, critical #1)

DMCC-UPD2 holds one file: Approved Baseline.xer (P6 24.7, 25,630 activities, Data Date 30 Jun 2025, no progress).
CMeng's own finish was 29 Jan 2028 13:00 against P6's 29 Nov 2027 11:00 (+61.08 days), and 2,335 activities
finished more than 14 days away from the P6 dates. On an unprogressed baseline a correct calculation must give
P6's dates.

## How it was found

With the owner's permission the file was downloaded from the live site (SHA-256 3e57d552..., same as stored) and
CMeng's own reader and CPM were run on it locally (`dmcc-tools/cpm-check.cjs`, `parity.cjs` in the session
scratchpad). The local run reproduced the live result exactly (29 Jan 2028 13:00, 2,335 over 14 days).

## Causes and fixes

1. **Lag calendar option not read.** P6 24.x writes "Calendar for scheduling Relationship Lag" in the
   SCHEDOPTIONS table (`sched_calendar_on_relationship_lag = rcal_Predecessor`). The reader looked only at PROJECT,
   found nothing and counted every lag on the successor calendar. Fix: `adapters.ts` reads PROJECT first, else the
   project's SCHEDOPTIONS row. Effect alone: finish 30 Nov 2027 08:00, 0 activities over 14 days.
2. **Zero lag and finish milestones.** A zero lag rolled the event to the next working time of the lag calendar,
   and a finish milestone was placed at the next morning instead of at the close of the working period (29 Nov
   11:00 on a short day; 8 Mar 14:00 before the Eid holidays became 13 Mar). Fix (`schedule-cpm/engine.ts`): a
   zero lag does not move the event; a zero-duration finish milestone stays where its predecessors put it when that
   is working time or the close of a working period, else it moves to the next working time.
3. **FF finish on a nonworking day.** An FF finish falling on a day the successor does not work stayed on that
   day; P6 places it at the successor's next working time (10 activities, e.g. CN-T3-ST-05-SOS-1000: Sat 17:00
   became Mon 08:00 in P6). Fix: FF/SF finish bounds are placed on the successor's working time.
4. **Float basis.** The file states `sched_use_project_end_date_for_float = Y`; P6 counts total float to the
   Must Finish By (PROJECT.plan_end_date, 29 Nov 17:00), not to the calculated finish (11:00). 33 activities on
   7-day calendars had 5 h less float. Fix: when the option is stated Y, the backward pass starts at the declared
   finish; not stated or N, unchanged.

Stored programmes are re-read once from their retained source: XER reader version
`p6-source-aliases-links-finish-lagcal-schedoptions-v6` refreshes the lag calendar and the float option.

## Result on the real file

| | Before | After | P6 |
|---|---|---|---|
| Project finish | 29 Jan 2028 13:00 | 29 Nov 2027 11:00 | 29 Nov 2027 11:00 |
| Activities with the same finish | 15,903 of 25,629 | 25,629 | |
| Over 14 days different | 2,335 | 0 | |
| Starts different | | 0 | |
| Total float different | | 0 | |

## Tests

- `tests/p6-schedule-parity-dmcc.test.ts` (new, 4): SCHEDOPTIONS lag calendar (and PROJECT precedence, and not
  stated), finish milestone at a short-day close and before holidays, FF finish on a nonworking day, float to
  the Must Finish By only when stated. All four fail on the previous code.
- Updated on purpose: `schedule-cpm` (FF finish after working time now lands on the successor's next working
  time, per P6); the T11 frozen reference engine and the independent solver (`tools/independent/cpm-solver.cjs`,
  rule 3b) carry the same P6 rules, so both differential checks keep judging the engine.

## Other projects (live before this change)

Several projects show large CMeng-vs-contractor gaps (ORBIT +560 d, JBL-GAUC-EPC1 +703 d, ABB-100 +9,552 d,
RYD-NME-PKG-C -917 d). Most are progressed updates; their causes are not established here. The same comparison
runs after the deploy (`forecast_snapshot.py`, before: `forecast-before-parity.json`).

## Next action

Full local suite → CI → deploy with the data check → DMCC Completion Forecast on the live link → compare every
project's forecast before and after.
