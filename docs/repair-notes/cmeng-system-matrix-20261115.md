# System defect matrix, 15 Nov 2026

Unit of repair: the shared CMeng mechanism. Projects are reproducers only.
No project ID, project name or one-project condition is used in any fix.

## Method

- Every page of every live project (20 projects x 58 pages = 1,160 pages) is
  opened in a browser and read as shown. The canonical facts each page
  received are recorded with it (tools/system-matrix/capture2.cjs).
- tools/system-matrix/invariants.py checks every page against the shared
  invariants and maps each failure to one mechanism (M1-M14).
- Fresh-project test: a new local server on an empty data folder, one project
  per programme kind, each made by uploading its file (fresh.sh).
- A manifestation is one page showing one failure. Many manifestations can
  come from one root defect. Only root defects are counted as defects.

## Root defects found and fixed

| # | Mechanism | Root defect | Blast radius before | Fix |
|---|---|---|---|---|
| 1 | M3 forecast publication | CMeng published and compared its own finish when no open activity had a readable working calendar | 27 page manifestations, 5 projects | Global rule in the independent forecast: the finish stays diagnostic only; no headline, management, contract or recovery comparison |
| 2 | M4 baseline-only state | The current programme was compared with itself (0% vs 0%, 0 days movement) | 10 page manifestations, 1 project | One rule for the comparison baseline (never the same revision or file), used by the producers and by the shared reporting view |
| 3 | M5 unknown vs zero | A programme that records no progress was reported as 0% progress and 0 h actual labour | part of the 10 above, plus fresh baseline | Programme progress and actual labour stay not established until progress is recorded |
| 4 | M6/M13 upload and canonical Data Date | A newly uploaded baseline awaiting adoption raised a false "Figures disagree between pages" system failure | 29-32 pages on every fresh baseline upload | One reporting date rule: governed Data Date, or the Data Date of the programme the figures are calculated from |
| 5 | M1/M12 calendar coverage | Coverage counted non-execution records; the request did not name the calendars | 2 manifestations, 1 project | Coverage over open execution activities; the request names the calendars |
| 6 | M11 shared reader | "pp", internal keys, counts without separators, "1 days", "(s)", repeated words, UPPER_SNAKE codes | 330 manifestations, 20 projects | Shared reader rules in the page layout, applied to every page |
| 7 | M11/M12 raw objects and reader scores | Raw data objects and reader confidence scores printed | 50 manifestations, 20 projects | Check values written in words; reader scores removed |

Regressions found and fixed:
- Fix 2 first made a baseline-only project carry an unresolved baseline while
  its rows still held the programme's own baseline dates, so the cross-page
  check reported a system failure on 5 pages. The shared reporting view now
  gives the current programme no baseline dates when it is the baseline itself.
- With no baseline dates, the delay programme context then read "Pressured
  milestones: not established" and asked for 25,629 baseline dates on the
  three delay pages (DMCC review #10 reopened). With only the baseline
  supplied, it now names the critical milestones and says lateness is
  measured from the first update.

## Results

| Run | Pages | Manifestations |
|---|---|---|
| Live ca738611 (before) | 1,160 | 419 |
| Live 6486faa0 | 1,160 | 13 |
| Live 28058619 | 1,160 | 0 before the delay wording check was added; 4 after (fixed next) |
| Fresh projects, 5 programme kinds, 28058619 | 290 | 0 |
| Fresh adopted baseline, 28058619 | 58 | 0 |

Calendar rule on live 6486faa0: exactly the 5 projects with no readable
calendar lost the CMeng date; no other project's forecast changed.
DMCC P6 parity: 25,629 activities, 0 finish, start or float differences.
Data: 20 projects and 472 documents before and after; no loss.

## Not fixed

- M14 performance: the cold speed gate (4 cold 8,100-8,900 activity projects
  together, each 5 s or less) still fails at about 8.9 s per project. The
  profile is flat: building every page's calculation for one dashboard costs
  about 3.2 s per project alone. Closing it needs per-revision results kept
  after upload and a dashboard that reads only what it shows.
