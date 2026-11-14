# Programme gaps by cause, 14 Nov 2026

Every live programme was checked two ways, on the current file of each project (downloaded read-only from the live
site, hashes verified):

- CMeng's CPM against the independent solver (tools/independent/cpm-solver.cjs) on the same reading of the file. Equal
  results mean CMeng calculated what it read.
- CMeng's dates against the contractor's own P6 dates in the file, activity by activity, and against the file's own
  calendars and logic.

Categories: 1 source missing, 2 source inconsistent, 3 parser defect, 4 CPM defect, 5 correctly qualified (the
contractor's finish leads).

| Project | Before | Cause | Category | After |
|---|---|---|---|---|
| DMCC-UPD2 | 25,629 of 25,629 equal | none | - | unchanged |
| KWT-TWR1, QAT-VLC1 | finish within 0.3 day | none | - | unchanged |
| UPTOWN-100 | finish equal; 1,007 activities more than 14 days from P6 | completed activities with an unfinished predecessor (317) did not carry logic | 4 | 0 more than 14 days; finish 2028-01-12 14:00 equal; 241 of 25,628 differ by less than 14 days |
| DMINFRA-101 | finish 08:48 against P6 10:00; 978 more than 14 days | the same (120), and the option "Calculate start-to-start lag from Early Start" was not read | 4 and 3 | 0 more than 14 days; finish 2027-07-08 10:00 equal; 5 of 3,991 differ by less than 14 days; float equal on 2,220 of 2,260 |
| ORBIT-JED-PLH-P3, DMM-HDC-P2, JED-DWT-S1, RUH-TB-P5, ULA-HRI-P3, JBL-GAUC-EPC1 | finish 408 to 702 days from the contractor | calendars read in full; CMeng equals the solver (ORBIT 12,701 of 12,701, DMM 9,505, JED 7,085, ULA 5,594; RUH and JBL differ only at one in-progress activity without an actual start, one completed activity without an actual finish and three milestones at the data date); the contractor's dates advance remaining hours / 10 as calendar days, 7 days a week, against its own Sun-Thu / Sat-Thu calendars | 2, so 5 | contractor's finish leads; asks whether durations are working or calendar days |
| RYD-NME-PKG-C, RAK-PORT-P4, EP-400KV-TL2 | finish 579 to 917 days from the contractor | calendars give only hours a day and a week ("6D-10H": 10 h a day, 60 h a week): no working days, shift times or holidays; dates also follow elapsed days | 1 and 2, so 5 | contractor's finish leads; now names each calendar and what is missing |
| JAZ-RTR-T3 | 147 days | "7D-12H-DAY/NIGHT": 12 h a day, no shift times; the dates use 10 h a day | 1 and 2, so 5 | as above |
| ABB-100 | CMeng 2055 | calendars empty; the contractor's dates break its own FS logic on 6,783 of 6,793 links | 1 and 2, so 5 | contractor's finish leads; CMeng's own finish is not the headline |
| DMMC-112 and three ENGINEERING projects | no programme | nothing to calculate | - | no forecast shown |

## Repairs (categories 3 and 4)

1. Out-of-sequence progress (engine.ts). A completed activity with an unfinished predecessor carries that logic on as
   zero work: a start event (FS/SS predecessors) and a finish event (FF/SF predecessors), never before the data date,
   lags into it counted. Its successors follow from those events without the link's lag; SS/SF use the start event
   only when SS lag counts from Early Start. The backward pass runs through it. Its own dates stay the actual dates.
   The contractor's P6 dates show each part: 73 + 14 + 3 links out of such activities drop the lag; 13 links into them
   keep it; an actual finish after the data date is not used.
2. "Calculate start-to-start lag from" (SCHEDOPTIONS.sched_lag_early_start_flag) is read. With Early Start an SS/SF
   link from an in-progress activity never allows a start before that activity's remaining early start (its lag still
   runs from the actual start), and the backward pass bounds it through those links. Stored programmes are re-read once
   (XER reader v7).

Tests: tests/p6-out-of-sequence-progress.test.ts; tests/t11-cpm-engine-differential.test.ts names the changed case (D3).

## Left as found

- UPTOWN-100: two start points (an FF link ending on a day the successor's calendar does not work; an FF lag from a
  completed activity into an in-progress one) give 241 dates under 14 days apart; float equal on 20,608 of 20,968.
  Treating the first as the previous close made 6,469 dates differ, so the existing rule stays. DMINFRA-101: one start
  point gives 5.
- Synthetic programmes: their dates are generated as elapsed days; no CMeng change can or should match them.

## Live result (ca738611, deployed 14 Nov 2026 17:01 Dubai)

b2edf1da deployed first (16:06), then ca738611 for the three pages the 20-project check still found over 60 sections
(Contract Particulars on ABB-100, DMM-HDC-P2, ORBIT-JED-PLH-P3; Actions required on ORBIT) and the old page name on
the four empty Dashboards. CI on ca738611: regression, raster, concurrency, acceptance, independent and the focused
set passed; operations failed only on the cold-project gate (slowest 7,262 ms against 5,000 ms).

| Check (live) | e9685aa3 | ca738611 |
|---|---|---|
| Data | 20 projects / 472 documents | unchanged, nothing lost |
| DMCC-UPD2 P6 parity | 25,629 of 25,629 | unchanged (547 / 1,059 / 0; finish 29 Nov 2027 11:00) |
| DMCC-UPD2 page defects (27) | 26 | 27 |
| Generic page checks (10 each) | 3 projects checked | all 20 projects pass all 10 |
| Shared facts on 7 pages | 20 consistent | 20 consistent |
| UPTOWN-100 activities > 14 days from P6 | 1,007 | 0 (finish equal) |
| DMINFRA-101 activities > 14 days from P6 | 978 (finish 08:48 vs 10:00) | 0 (finish equal) |

Other forecasts: unchanged headlines. JBL-GAUC-EPC1 8,280 to 8,282 activities differ from the contractor (contractor
leads). ABB-100: CMeng's own (not headlined) finish moved from 2055 to 2284, because the file's logic now carries
through its completed activities with unfinished predecessors; the page states it covers 21.6% of activities, that no
open activity has a calendar, and that it is outside the credibility limit.
