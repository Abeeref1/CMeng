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

## Live result (f77811a2, deployed 13 Nov 2026 21:47 Dubai)

CI on f77811a2: regression, raster, concurrency, acceptance and independent passed; operations failed only on the
existing 5-second cold-project gate (four cold project shapes, slowest 5,978 ms against 5,000 ms). Local full suite on
the same commit: regression cohort 2,695 of 2,695 passed (other phases running at the time of writing).

Data check before and after the deploy: 20 projects, 472 documents, all read, nothing lost. The stored DMCC XER was
not touched: same document (evidence_b9173e948d29e05f06f5c1f2), same revision (schedrev_3e57d55274bab41224969fd5),
streamed SHA-256 3e57d552...d4d4 before and after. The stored programme was re-read on start: the page now says
"lag calendar stated in the programme: predecessor activity calendar" (it said "not stated" before).

Live DMCC-UPD2, every activity read from the live pages (`dmcc_parity_live.py`):

| | Live before (fbd4af9e) | Live after (f77811a2) |
|---|---|---|
| P6 finish | 29 Nov 2027 11:00 | 29 Nov 2027 11:00 |
| CMeng finish | 29 Jan 2028 13:00 | 29 Nov 2027 11:00 |
| Activities compared | 25,629 | 25,629 |
| Finish different | 9,726 | 0 |
| Start different | 9,716 | 0 |
| Total float different | 22,531 | 0 (4 differ only in the 7th decimal of the printed hours) |
| Over 14 days different | 2,335 | 0 |
| Critical / near-critical / negative float | 404 / 674 / 42 (P6 547 / 1,059 / 0) | 547 / 1,059 / 0 |
| Forecast checks | divergence review required | all passed; nothing qualifies the finish |

Dashboard, Command Center, Management Brief, Completion Forecast and Completion History all carry 2027-11-29T11:00 as
the project finish (other dates on those pages are individual driving activities and the calendar sensitivity case).

## Every project, before and after (live)

| Project | CMeng finish before | after | Gap before (d) | after (d) | Activities >14 d before | after |
|---|---|---|---|---|---|---|
| DMCC-UPD2 | 2028-01-29 | 2027-11-29 | +61.08 | 0 | 2,335 | 0 |
| UPTOWN-100 | 2028-01-12 | 2028-01-12 | 0 | 0 | 1,012 | 1,007 |
| DMINFRA-101 | 2027-07-08 | 2027-07-08 | -0.05 | -0.05 | 978 | 978 |
| QAT-VLC1 | 2027-10-06 | 2027-10-06 | -0.25 | -0.25 | 0 | 0 |
| KWT-TWR1 | 2028-06-06 | 2028-06-06 | -0.29 | -0.29 | 0 | 0 |
| ORBIT-JED-PLH-P3 | 2032-01-11 | 2032-01-11 | +560 | +560 | 10,933 | 10,933 |
| JBL-GAUC-EPC1 | 2033-05-23 | 2033-05-22 | +702.96 | +702.38 | 8,280 | 8,280 |
| DMM-HDC-P2 | 2031-07-14 | 2031-07-13 | +508.96 | +508.38 | 7,717 | 7,717 |
| RUH-TB-P5 | 2031-05-28 | 2031-05-27 | +494.96 | +494.38 | 6,721 | 6,721 |
| JED-DWT-S1 | 2031-01-22 | 2031-01-21 | +458.96 | +458.38 | 5,657 | 5,657 |
| ULA-HRI-P3 | 2030-07-29 | 2030-07-28 | +408.96 | +408.38 | 4,349 | 4,349 |
| ABB-100 | 2055-02-27 | 2055-02-27 | +9,552 | +9,552 | 0 | 0 |
| RYD-NME-PKG-C | 2028-06-16 | 2028-06-16 | -916.6 | -916.6 | 0 | 0 |
| RAK-PORT-P4 | 2027-11-09 | 2027-11-09 | -608.6 | -608.6 | 0 | 0 |
| EP-400KV-TL2 | 2027-10-19 | 2027-10-19 | -578.9 | -578.9 | 0 | 0 |
| JAZ-RTR-T3 | 2026-12-15 | 2026-12-15 | -147.4 | -147.4 | 0 | 0 |
| DMMC-112, ENGINEERING-26-BLDG-00100, OCM-CDF(ENGINEERING)-26-FLOOD-00074, ENGINEERING-26-ELEC-00075B | no programme forecast | no programme forecast | | | | |

## Remaining gaps, classified separately (not assumed to share the DMCC cause)

- **ORBIT +560, JBL +702, DMM +508, RUH +494, JED +458, ULA +408** (progressed updates, 1,954 to 3,067 actual events).
  Every compared completed task spans calendar days, not its assigned working calendar (ORBIT 1,060 of 1,060; JBL
  1,086; DMM 1,268; RUH 1,203; JED 1,007; ULA 868). Counting durations as elapsed days moves CMeng's finish earlier by
  327 / 410 / 297 / 288 / 267 / 238 days, so the calendar basis explains about 58-60% of each gap. The rest is not
  established. Each file also has calendars whose working intervals CMeng cannot read (ORBIT calendar 5; JBL 4-6).
  ORBIT differs from the others: CMeng negative float 11,541 activities against 345 submitted (others 0 against
  69-114), and 25 source constraints applied. Next: per project, compare the P6 remaining durations and progress
  handling (retained logic or progress override) on a sample of open activities.
- **ABB +9,552.** Calendars 1-3 have neither data nor a base calendar (assumed 24-hour working), duplicate activity
  TIT-00701 left out with its links, 2 loop links opened, 12 unresolved relationship ends; only 21.6% of activities
  calculated. Continuous working would make the finish earlier, not 26 years later, so the cause is in the network
  repair or the unresolved links, not established yet.
- **RYD -917, RAK -609, EP -579, JAZ -147.** All open activities (4,565 to 7,438) have calendars whose working
  intervals are not defined in the file text; CMeng assumed continuous working, which brings the finish earlier.
  15-18% of activities calculated. RYD also has a duplicate ID and a loop link; JAZ a loop link.
- **UPTOWN-100 (finish matches, 1,007 activities >14 d) and DMINFRA-101 (finish -0.05 d, 978):** calendars whose
  hours per week differ from their day pattern (48 or 56 h against 40 h); 108 and 6 completed tasks follow elapsed
  days.
- **QAT-VLC1, KWT-TWR1:** within 0.3 day, no activity over 14 days.

The P6 mechanism is closed on DMCC-UPD2. None of the remaining gaps is reported as fixed.
