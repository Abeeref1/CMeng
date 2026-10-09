# CMeng — consultant F01–F61 closure register

**Source:** CMeng Page Review, REEM 112, review release `47cd802`, read-only recheck `aadd8d4` (8 October 2026). **274 distinct findings: 266 original `D-001`–`D-266` plus eight `N-1`–`N-8`.** Each is assigned to exactly one of these 61 tasks.

**Status discipline:** The consultant's **Fixed** means *observed correct on the older live review*, **not formally accepted**. All 61 tasks remain in the engineering closure register until their own expected-answer checks and final visible consultant acceptance pass on the same verified release. Do not delete tasks marked Fixed.

The full historical defect texts, severity and page evidence remain in [`tests/fixtures/reem-112-review.json`](../../tests/fixtures/reem-112-review.json); the new N-1–N-8 texts, full F descriptions and crosswalk are in [`cmeng-f01-f61-274-defect-plan.json`](cmeng-f01-f61-274-defect-plan.json). Neither source has been replaced by the other.

## Step 0 — Independent visible-answer tests and release gate

### F01 — Tests read the screen, with independent answers

**Consultant observation on aadd8d4:** Open — Answer key exists (251 checks) but reads API data only..

**Shared fix:** Add a browser test that opens every REEM page (all 50 menu pages, the 7 tabs, project review, documents, director drawer, portfolio) and compares the displayed text with the answer key. Add three more checks: one fact = one value across pages; banned words; page data size. Expected values come only from source files or consultant sign-off, never from CMeng output (remove actions.openCount 276 as an "expected" value).

**Code/owner area:** scripts/reem-golden-facts.mjs, tests/fixtures/reem-112-golden-facts.json.

**Defects covered:** N-8.

**Required independent proof:** All four checks run on the exact release commit and pass before any deploy to the review site.

## Step 1 — One canonical facts calculation

### F02 — Securities from one rule

**Consultant observation on aadd8d4:** Fixed — Contract page: APG expired, CAR policy expired; 21M active on all 9 pages that carry it..

**Shared fix:** Active / expired / expiring is decided once from expiry date vs data date; insurance kept separate from bonds; every page shows that result.

**Code/owner area:** commercial-contract-controls, security-validity.ts.

**Defects covered:** D-002, D-018, D-021.

**Required independent proof:** Active bonds 1 (PB 21M); expired 1 (APG 21M, 25 Jul 2026); CAR insurance 210M expired 01 Aug 2026; same on Dashboard, Commercial Overview, Contract page, Director drawer.

### F03 — Schedule counts from one calculation

**Consultant observation on aadd8d4:** Partly — Revision History 41 / 7 / 41; Progress Breakdown Villa Type B 40 / 40. Delay pages not re-checked..

**Shared fix:** Critical, near-critical, negative float and delayed-open counts come from one calculation over open execution activities; every schedule page, chart and area table reads it.

**Code/owner area:** project-facts.ts; duplicate counts in progress-breakdown, schedule-analysis-core, near-critical-analysis.

**Defects covered:** D-009, D-012, D-052, D-069, D-084, D-136, D-187.

**Required independent proof:** 41 critical, 7 near-critical, 41 negative float, 192 delayed open; Villa Type B 40 critical; same on every page.

### F04 — RFI and NCR counts from one register reading

**Consultant observation on aadd8d4:** Partly — 53 and 29 shown; "Not established" still in 83 row cells on RFI & Design..

**Shared fix:** Register pages and the dashboard read the same open / overdue / severity counts.

**Code/owner area:** operationalReporting, delivery-projections.ts.

**Defects covered:** D-026, D-027, D-030.

**Required independent proof:** 53 open / 44 overdue RFIs; 29 major or critical NCRs; same on Dashboard, RFI & Design, Quality.

### F05 — One action register

**Consultant observation on aadd8d4:** Fixed — 276 on Command Center, Accountability and Portfolio..

**Shared fix:** One record = one action; same total everywhere; RFI / NCR not duplicated as activity actions.

**Code/owner area:** project-actions.ts, action-priority.ts.

**Defects covered:** D-038, D-042, D-131.

**Required independent proof:** Same action total on Command Center, Accountability, Project review, Portfolio; no record appears twice.

### F06 — Claims and EOT facts shared

**Consultant observation on aadd8d4:** Partly — Notice Compliance 14 / 2; Delay Event Register "event date missing 0". EOT page still shows "Independent comparison not confirmed"..

**Shared fix:** Events, notice timing, determinations and claim days are worked out once and read by every claims page.

**Code/owner area:** canonical-time-claims.ts, claimsReporting.

**Defects covered:** D-040, D-047, D-083, D-088, D-101, D-188.

**Required independent proof:** 16 events, 0 event dates missing, 14 timely / 2 late notices, 13 d awarded, 75 claimed / 34 assessed on every claims page.

### F07 — Shared inputs and prerequisites

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** Calendars, quantities, CPM coverage, capacity, installed quantities, discipline list, risk owners and row counts are one shared status, not re-decided per page.

**Code/owner area:** project-facts.ts.

**Defects covered:** D-064, D-078, D-107, D-178, D-209, D-215, D-216.

**Required independent proof:** A prerequisite confirmed on one page is confirmed on all; risk register 110 rows; capacity shown for all 12 trades.

### F08 — One programme state and a real consistency check

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** Update02 has one state on every page; the "cross-module consistency" check compares the values actually displayed.

**Code/owner area:** project-state.ts, projection-integrity.ts.

**Defects covered:** D-036, D-125.

**Required independent proof:** Update02 "current" on every page including Documents; the consistency check fails when any page shows a different value.

### F09 — Portfolio uses the same rules for every project

**Consultant observation on aadd8d4:** Fixed — Portfolio data: REEM furtherAdjustedCompletion 2027-09-21..

**Shared fix:** Portfolio cards read each project's shared facts.

**Code/owner area:** portfolio projection.

**Defects covered:** D-129.

**Required independent proof:** REEM 112 card shows extended date 21 Sep 2027 like every other project.

### F10 — One page per question, no duplicate blocks

**Consultant observation on aadd8d4:** Partly — 7 pages merged into 3 tabbed workspaces (57 to 50 menu items). Duplicate blocks not re-checked..

**Shared fix:** Each topic has one owner page; other pages link to it instead of copying its blocks.

**Code/owner area:** ui.ts moduleWorkspaces and page renderers.

**Defects covered:** D-115, D-137, D-170, D-172, D-185, D-193, D-198, D-205, D-206, D-207, D-241, D-244, D-245, D-249.

**Required independent proof:** No block appears on two pages; merged pages are tabs of one workspace.

### F11 — Director drawer and Ask CMeng read the same facts

**Consultant observation on aadd8d4:** Not checked — Ask not tested (read-only rule: no questions asked)..

**Shared fix:** Both read the shared facts only.

**Code/owner area:** project-director, project-ask.

**Defects covered:** D-128, D-219.

**Required independent proof:** Director drawer figures equal the dashboard; each suggested Ask question gives the answer-key value.

## Step 2 — Source reading, classification and retained fields

### F12 — Owners from the registers, never hard-coded

**Consultant observation on aadd8d4:** Partly — Quality page shows owners (Package Manager, QA/QC Manager); "Not assigned" still 504 times on 30 pages..

**Shared fix:** Owner = the register's responsible column; if none, the PMC role for that domain. Remove the hard-coded "Not assigned".

**Code/owner area:** position-review.ts line 92; register column maps.

**Defects covered:** D-005, D-037, D-133, D-156, D-175, D-226, D-247, N-4.

**Required independent proof:** NCR-0042 owner MEP Coordinator; NCR-0259 QA/QC Manager; risk owners shown; no "Not assigned" where a name exists.

### F13 — Claims register fully read

**Consultant observation on aadd8d4:** Partly — 75 / 34 / 13 and notices 14 / 2 shown; responsibility column not re-checked..

**Shared fix:** Event date, awareness date, responsibility claimed, claimed / assessed days, status and determinations all carried through.

**Code/owner area:** canonical-time-claims.ts, register-schema.ts.

**Defects covered:** D-015, D-016, D-029, D-082, D-181.

**Required independent proof:** Delay Event Register shows 75 claimed, 34 assessed, status 8 / 6 / 2, EOT 13 d, responsibility per claim.

### F14 — Procurement register fully read; status drives delivered

**Consultant observation on aadd8d4:** Partly — Register read (90, 30 long-lead); PKG-0056 / PKG-0004 in actions; but "44 known late" counts 27 delivered packages (N-1)..

**Shared fix:** Read all 90 packages, long-lead flag, vendor and status. A terminal status (Delivered, Installed, Closed) means delivered even without an actual date. Undelivered packages on finished work go to register clean-up.

**Code/owner area:** truth-kernel/src/procurement-timing.ts; delivery-projections.ts line 650.

**Defects covered:** D-004, D-031, D-045, D-080, D-106, D-109, D-203, N-1.

**Required independent proof:** 90 packages, 30 long-lead, 68 delivered, 22 not delivered, 17 late; PKG-0056 and PKG-0004 in top actions; suppliers from vendor field.

### F15 — Risk register fully read

**Consultant observation on aadd8d4:** Fixed — Risks page: 73 open..

**Shared fix:** Impact, Score, Last Reviewed, Action Due Date and Closed status used.

**Code/owner area:** register-schema.ts.

**Defects covered:** D-041, D-121, D-122.

**Required independent proof:** Scores for 110 rows; 73 open; 37 closed.

### F16 — Resource register actual hours

**Consultant observation on aadd8d4:** Partly — Actual utilization 30.48% shown; recorded-hours fields still "Unresolved" (41 times on Resources)..

**Shared fix:** Actual Approved Usage read by week and linked to the look-ahead.

**Code/owner area:** resource-support-evidence.ts.

**Defects covered:** D-011, D-158.

**Required independent proof:** Actual hours by trade and week; Look-Ahead resources column filled.

### F17 — Classify files by header, not file name

**Consultant observation on aadd8d4:** Partly — Both files classified correctly in the data; curves on pages not re-checked..

**Shared fix:** Permit register and EVM history recognised as registers and used.

**Code/owner area:** document-identification.ts.

**Defects covered:** D-092, D-116, D-126, D-171.

**Required independent proof:** Permit register drives Permits; monthly EVM history drives the cost trend and progress curve.

### F18 — Bond register instrument column

**Consultant observation on aadd8d4:** Fixed — APG-VLC1-0202 shown as Advance Payment; CAR as insurance policy..

**Shared fix:** Instrument column sets the instrument type.

**Code/owner area:** commercial-contract-controls.

**Defects covered:** D-103.

**Required independent proof:** APG recognised as the advance payment security; CAR as insurance.

### F19 — VO and IPC registers

**Consultant observation on aadd8d4:** Partly — VO-026 rejected, pending 0. Payment linkage not re-checked..

**Shared fix:** VO status from the register; IPC variations column links VOs to payment.

**Code/owner area:** commercial-foundation, contract-commercial.

**Defects covered:** D-019, D-195.

**Required independent proof:** VO-026 rejected; pending 0; payment linkage 100% (11,776,000 certified by IPC-023).

### F20 — Commercial terms and dated payments

**Consultant observation on aadd8d4:** Partly — Payments shows advance balance 1,396,548. Brief and cash series not re-checked..

**Shared fix:** Advance amount from Sub-Clause 14.2 less recoveries; payment dates make a dated cash series; brief carries cost line; three progress measures side by side.

**Code/owner area:** commercial-performance, commercial-control.

**Defects covered:** D-066, D-096, D-098, D-149.

**Required independent proof:** Advance outstanding 1,396,548; dated cash curve; brief shows CPI 0.96, EAC 218.4M, unpaid 9.9M; EVM 89.1% / certified 87.7% / schedule 88.6% together.

### F21 — BOQ to programme mapping

**Consultant observation on aadd8d4:** Partly — Mapping 100% in data; Progress Breakdown shows three progress columns. Package link not checked..

**Shared fix:** BOQ WBS Code maps sections to the 14 WBS areas; physical and certified progress by area.

**Code/owner area:** quantity-progress-core, boq-ingestion.

**Defects covered:** D-072, D-174, D-204.

**Required independent proof:** Mapping 100%; Progress Breakdown physical and certified columns filled; BOQ items linked to packages where the register allows.

### F22 — Programme (XER) fields

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** Baseline dates from the baseline file; discipline from the programme; plot and zone parsed from names; clean filter values.

**Code/owner area:** xer-parser, schedule-revision-core.

**Defects covered:** D-113, D-114, D-152, D-230.

**Required independent proof:** Baseline start differs from current start where the baseline says so; plot filter (Plot B 42 ...); discipline list matches the programme.

### F23 — Programme fallback for empty delivery registers

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** When no register exists, use programme testing, snagging and handover activities and disruption claims, labelled as programme-based.

**Code/owner area:** delivery-projections.ts.

**Defects covered:** D-211, D-212, D-213, D-214.

**Required independent proof:** Testing, Snag, Handover and Weather pages show the programme activities and claims.

### F24 — HSE report fields

**Consultant observation on aadd8d4:** Fixed — Dashboard shows LTIFR 1.2, TRIR 1.68..

**Shared fix:** Native-text HSE report values extracted.

**Code/owner area:** hse-report-evidence.ts.

**Defects covered:** D-120.

**Required independent proof:** Man-hours 831,000, LTI 1, LTIFR 1.2, TRIR 1.68.

## Step 3 — Non-blocking evidence plus actual correction routes

### F25 — Clean registers used immediately

**Consultant observation on aadd8d4:** Partly — Figures now shown; "Confirm these records are complete" still at the top of 5 pages..

**Shared fix:** Clean rows are used at once with the label "From register". Completeness confirmation only adds percentages; it never hides figures.

**Code/owner area:** evidence-control.ts, delivery-projections.ts.

**Defects covered:** D-023, D-024, D-025, D-108, D-110, D-111, D-117, D-157, D-221.

**Required independent proof:** Procurement, design, permit and readiness figures shown with no gate; no "confirm complete" banner in front of numbers.

### F26 — A normal constraint does not block CPM or the forecast

**Consultant observation on aadd8d4:** Fixed — "Independent CPM not established" gone (3,032 hits to 0); P50 +17 d, P80 +46 d, P90 +62 d shown..

**Shared fix:** Apply source constraints as P6 does and also run without them; publish both.

**Code/owner area:** schedule-cpm/engine.ts.

**Defects covered:** D-013, D-044, D-049, D-051, D-077.

**Required independent proof:** CMeng CPM computed for all open activities; P50 / P80 / P90 shown; stage forecast finishes shown.

### F27 — Arithmetic is shown, not withheld

**Consultant observation on aadd8d4:** Partly — Unpaid, extended date, pending 0 and notices shown. Actual-hours point not re-checked..

**Shared fix:** Sums and date additions are shown with their basis: extended date, unpaid, pending VOs, notice proxy, actual hours.

**Code/owner area:** commercial-canonical.ts, project-facts.ts.

**Defects covered:** D-035, D-074, D-085, D-087, D-090, D-095, D-190, D-194.

**Required independent proof:** Unpaid 9,899,013; extended date 21 Sep 2027; pending VOs 0; notice days for CLM-003 (44) and CLM-004 (42); actual 755,452 h plotted.

### F28 — Candidate values do not create approval requests

**Consultant observation on aadd8d4:** Open — "approval needed" 37 to 104; "Review and promote" 5 to 15..

**Shared fix:** A value read cleanly from the contract or a register is "From source". Approval is raised only when two sources disagree or a user overrides a value. One prompt per fact, not one per page.

**Code/owner area:** module-issues.ts line 146; contract term states (LD rate and cap "candidate").

**Defects covered:** D-124, N-2, N-3.

**Required independent proof:** "approval needed" only on real conflicts; LD cap and APG not requested again on the page that shows them.

### F29 — Best-available analyses instead of all-or-nothing

**Consultant observation on aadd8d4:** Partly — Paid late 11 / on time 10 shown. Cash forecast "No source rows"; crew acceleration candidates 0..

**Shared fix:** Run the feasibility check, recovery scenarios, cash forecast and late-payment test with the data held.

**Code/owner area:** delivery-challenge, recovery-acceleration.ts, commercial-performance.

**Defects covered:** D-079, D-097, D-099, D-180.

**Required independent proof:** Plaster-chain feasibility shown; recovery scenarios generated; cash forecast from remaining value on the programme; 11 of 21 IPCs paid late.

### F30 — Every gap has a named route, or it is not an action

**Consultant observation on aadd8d4:** Partly — Completeness button now prominent; "Information needed" still 342 times on 29 pages..

**Shared fix:** Each gap names the missing field, the file and column that would supply it, the owner and one button. Gaps without a route go to a data-gaps list. No re-upload requests for correct files.

**Code/owner area:** position-review.ts, ui-project-actions.ts.

**Defects covered:** D-028, D-105, D-118, D-145, D-179, N-6.

**Required independent proof:** No action without a route; unlock steps on the page headline; no "Source productivity forecast" request on management pages.

### F31 — Normal contract structure is not a problem

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** Two sections with their own dates and damages are normal; do not raise them.

**Code/owner area:** contract-parser, project-contract-sections.ts.

**Defects covered:** D-217.

**Required independent proof:** No "section numbers repeat" item in Project review.

### F32 — Stale schedule footer

**Consultant observation on aadd8d4:** Fixed — Footer on 0 of 50 pages (was 56 of 57)..

**Shared fix:** Footer only when a schedule is really awaiting review.

**Code/owner area:** ui.ts.

**Defects covered:** D-223, D-224, D-225.

**Required independent proof:** No "newly uploaded schedule needs your review" after adoption.

## Step 4 — PMC/engineering rules

### F33 — Contract time: extended date everywhere

**Consultant observation on aadd8d4:** Partly — Dashboard and Completion Forecast show 21 Sep 2027 and 15 days; charts not re-checked..

**Shared fix:** Extended date = contract + awarded EOT on every page and chart; days late against it; the completion constraint that gives -88 h is named.

**Code/owner area:** project-facts.ts time facts; chart renderers.

**Defects covered:** D-001, D-010, D-048, D-050, D-060, D-075, D-076, D-147.

**Required independent proof:** 21 Sep 2027 and 15 days late on Dashboard, Brief, Milestones, Completion History, Completion Forecast; contract and extended lines on finish charts.

### F34 — Sectional completion and delay damages

**Consultant observation on aadd8d4:** Partly — Section table correct on Contract page and Milestones; Contract page shows 1,680,000 / 900,000 but marked "Needs review"; not on Dashboard or Financial Claims..

**Shared fix:** Section 1 and Section 2 each with date, rate and cap; LD exposure with cap; never a "conflict".

**Code/owner area:** project-contract-sections.ts, commercial-contract-controls.

**Defects covered:** D-034, D-046, D-061, D-100, D-102, D-208.

**Required independent proof:** Section 1 35,000/day; Section 2 60,000/day, cap 21M; LD 0.90M (extended) / 1.68M (original) on Dashboard, Contract, Financial Claims; Section 1 to 2 interface.

### F35 — Securities and insurance validity

**Consultant observation on aadd8d4:** Fixed — CAR expired with escalation; PB defects-period warning shown..

**Shared fix:** Check cover to completion plus defects period; flag expired insurance.

**Code/owner area:** security-validity.ts.

**Defects covered:** D-022, D-104.

**Required independent proof:** CAR expired flagged; PB to 31 Dec 2027 flagged as ending 86 days after forecast finish and before the defects period ends.

### F36 — Payment rules

**Consultant observation on aadd8d4:** Partly — Payments shows gross, net and advance correctly. Ratio and due-date basis not re-checked..

**Shared fix:** Gross vs net; applications are not certified; advance outstanding; 1-riyal rounding is not a failure; due date vs Sub-Clause 14.7; like-for-like ratios.

**Code/owner area:** commercial-performance, commercial-canonical.ts.

**Defects covered:** D-017, D-020, D-091, D-189, D-191, D-192, D-196, D-197.

**Required independent proof:** Gross 196,034,538; net 166,629,358; IPC-024 excluded; advance 1,396,548; rounding passes; due-date basis shown.

### F37 — Cost rules

**Consultant observation on aadd8d4:** Partly — Shows "EAC vs current contract below by 3.37M" but headline still "ADVERSE FORECAST 8.4M above original budget"..

**Shared fix:** Compare EAC with the current contract, not only the original budget; query positive "omissions"; query register value above the contract sum.

**Code/owner area:** commercial-performance, ui.ts cost tile.

**Defects covered:** D-033, D-093, D-094, D-202.

**Required independent proof:** Headline: EAC 218.4M is 3.37M below current contract 221.78M; 4 omission VOs queried; 292.5M package value queried.

### F38 — CPM, driving path and programme quality checks

**Consultant observation on aadd8d4:** Not checked — BEI present in data..

**Shared fix:** Correct driving chain; stage classification; DCMA-type checks, BEI, CPLI; float erosion rate; criticality definition stated.

**Code/owner area:** schedule-cpm, pmc-schedule-rules.ts.

**Defects covered:** D-006, D-008, D-032, D-165, D-234.

**Required independent proof:** Driving chain 34 activities (Plot B42 to B70, MEP, painting, snagging, PC); constraints / lags / relationship checks; BEI and CPLI; "turns critical by" date.

### F39 — Finished work is not open work

**Consultant observation on aadd8d4:** Partly — RFI and NCR rows marked "Completed linked work"; close-out counts in data..

**Shared fix:** Counts and warnings use open work; finished areas are not blocked; RFIs and NCRs on finished work are close-out.

**Code/owner area:** activity-float-reconciliation.ts, delivery-projections.ts.

**Defects covered:** D-073, D-112, D-139, D-150, D-151, D-154, D-155, D-162, D-164.

**Required independent proof:** 192 delayed open; no "1,837 awaiting classification"; 44 RFIs and 67 NCRs listed as close-out; finished milestones show no float.

### F40 — Programme change analysis

**Consultant observation on aadd8d4:** Partly — 427-day gap and 17-day movement in data; pages not re-checked..

**Shared fix:** Completion movement on the comparison page; cause split; update gap flagged; slip rate; driving activities per window; plot filter.

**Code/owner area:** schedule-change-report, windows-analysis, revision-trend.

**Defects covered:** D-056, D-057, D-058, D-086, D-153, D-160, D-161, D-169, D-186.

**Required independent proof:** +17 d (Update01 to 02) and +32 d (baseline to 01) stated; logic / lag / duration / constraint split; 427-day gap flagged; slip rate; window driving activities.

### F41 — Float trend charts

**Consultant observation on aadd8d4:** Partly — Revision History shows 41 / 7 / 41; chart lines not re-checked..

**Shared fix:** Unknown values are gaps, never plotted as zero.

**Code/owner area:** revision-trend.

**Defects covered:** D-059.

**Required independent proof:** Charts show 0 critical at baseline and 41 now.

### F42 — Look-ahead blockers

**Consultant observation on aadd8d4:** Partly — Quality page lists NCR-0259 as the first required action. Look-Ahead not re-checked..

**Shared fix:** A late long-lead package or open RFI / NCR on a driving activity is a named blocker; float column in the window.

**Code/owner area:** lookahead, construction readiness.

**Defects covered:** D-054, D-055, D-119, D-232.

**Required independent proof:** VLC-10-428 shows PKG-0056 as blocker; float and driving flag per activity; NCR-0259 singled out; RFI-0680 / 0677 shown with due date.

### F43 — Recovery options

**Consultant observation on aadd8d4:** Partly — Recovery target shown; "Crew acceleration candidates 0" and "Late procurement packages 44" (N-1)..

**Shared fix:** State the recovery target and generate the first options a planner tests: second crew, sixth working day.

**Code/owner area:** recovery-acceleration.ts, plot-crew-scenarios.ts.

**Defects covered:** D-014, D-081.

**Required independent proof:** Target 11 working days (extended) / 20 (original); second-crew and six-day scenarios for the plaster chain.

### F44 — EOT pending pipeline

**Consultant observation on aadd8d4:** Fixed — EOT page: "completion moves to Oct 12, 2027"..

**Shared fix:** Show the pending claims scenario.

**Code/owner area:** project-facts.ts claims pipeline.

**Defects covered:** D-089.

**Required independent proof:** 8 pending, 21 assessed days, scenario date 12 Oct 2027.

### F45 — Progress and quantity rules

**Consultant observation on aadd8d4:** Partly — Per-item curves replace unit sums, but they now load on every management page (N-5)..

**Shared fix:** Progress by area; period and required rate; no cross-item unit sums; query fractional LS; installed value vs certified; earned hours; % installed.

**Code/owner area:** quantity-scurve, progress-report, manhour-scurve.

**Defects covered:** D-067, D-070, D-071, D-168, D-173, D-176, D-240, D-250.

**Required independent proof:** Villa Type B progress shown separately; 132 LS items queried; installed value vs 184.26M certified; earned hours about 752,200 vs 755,452 spent.

### F46 — Resources against the driving chain

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** Hours, shortfall and trade for the plaster chain.

**Code/owner area:** resource-utilization.

**Defects covered:** D-065.

**Required independent proof:** Plasterer / mason hours needed vs available for Villa Type B.

### F47 — Detailed-claim time bar check

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** Check Sub-Clause 20.2.4 (42 days) per claim.

**Code/owner area:** notices-claims.

**Defects covered:** D-184.

**Required independent proof:** Each claim shows days from notice to detailed claim against 42.

### F48 — Permits against the programme

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** Link each expired permit to open or finished work.

**Code/owner area:** delivery permits.

**Defects covered:** D-210.

**Required independent proof:** 37 expired permits, none on open work, stated.

### F49 — Completed-late milestones

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** List milestones that finished late.

**Code/owner area:** milestones.

**Defects covered:** D-163.

**Required independent proof:** Landscaping +26 d, Villa Type C +9 d listed.

### F50 — Portfolio card content

**Consultant observation on aadd8d4:** Partly — Data has forecast and extended dates; card text not re-checked..

**Shared fix:** Card leads with forecast vs extended date, days late, cost position, top threat.

**Code/owner area:** portfolio UI.

**Defects covered:** D-130.

**Required independent proof:** REEM card: forecast 06 Oct 2027, extended 21 Sep 2027, 15 days late, CPI, top threat.

## Step 5 — Priority by real consequence

### F51 — Priority by consequence, one action per chain

**Consultant observation on aadd8d4:** Fixed — Top actions: one recovery action for 41 linked activities, then PKG-0056, PKG-0004, RFI-0680..

**Shared fix:** Rank by driving path, float, milestone and money, then age; one action for a chain.

**Code/owner area:** action-priority.ts.

**Defects covered:** D-003, D-138, D-140.

**Required independent proof:** Top actions: driving chain recovery, PKG-0056, PKG-0004, RFI-0660 / 0680, NCR-0259; not every row HIGH.

## Step 6 — Concise, role-useful page answers

### F52 — Summary pages open with the answer

**Consultant observation on aadd8d4:** Partly — 500-row "CPM not established" table gone; Management Brief still opens with a 220-row float comparison table..

**Shared fix:** No activity tables at the top of summary pages; the brief and the director view fit one screen.

**Code/owner area:** ui.ts page renderers.

**Defects covered:** D-007, D-053, D-062, D-063, D-127.

**Required independent proof:** Management Brief, Activity Review, Milestones, Near-Critical and Director drawer open with the position, not a table.

### F53 — No internal IDs, codes or data paths on screen

**Consultant observation on aadd8d4:** Partly — Internal IDs 2,779 to 614 hits (27 to 7 pages); codes 44 to 12..

**Shared fix:** Readable names for revisions, documents and clauses; codes stay in logs.

**Code/owner area:** ui.ts, position-review.ts STATUS_LABELS.

**Defects covered:** D-068, D-123, D-132, D-144, D-146, D-182, D-200, D-222, D-236.

**Required independent proof:** Zero hash IDs, data paths, API paths or UPPER_SNAKE codes in page text.

### F54 — Name the record, the blocker and the issue

**Consultant observation on aadd8d4:** Not checked.

**Shared fix:** Issue column states the defect; actions name the RFI / NCR / package, not just the activity.

**Code/owner area:** project-actions.ts, ui.ts.

**Defects covered:** D-039, D-134, D-141, D-143, D-148, D-251.

**Required independent proof:** NCR-0042 "Waterproofing defect" as issue; blockers named (NCR-0259, RFI-0660, RFI-0680).

### F55 — Accountability grouped by owner

**Consultant observation on aadd8d4:** Partly — Page shows ownership concentrations; grouping not re-checked..

**Shared fix:** Group actions by owner with counts and overdue.

**Code/owner area:** accountability-intelligence.ts.

**Defects covered:** D-043.

**Required independent proof:** One block per owner.

### F56 — Precision and formats

**Consultant observation on aadd8d4:** Open — "-0.25 d" still on Completion Forecast; CPI 0.961525..

**Shared fix:** Round to what a manager uses; one date format; no repeated lists.

**Code/owner area:** ui.ts formatters.

**Defects covered:** D-135, D-177, D-227, D-237, D-246, D-248, D-266, N-7.

**Required independent proof:** No "-0.25 days"; CPI 0.96; no cents next to whole amounts; one date format; retention stated once.

### F57 — Plain state words and empty states

**Consultant observation on aadd8d4:** Partly — "not established" 7,894 to 1,445 hits, still on 41 of 50 pages..

**Shared fix:** Use one plain word list (STATUS_LABELS already exists) for every page; one line for an empty register; no caveat walls.

**Code/owner area:** position-review.ts STATUS_LABELS; the 49 files that write their own wording.

**Defects covered:** D-142, D-159, D-166, D-167, D-183, D-199, D-201, D-228, D-229, D-233, D-235, D-238, D-239, D-242, D-243, D-252, D-259, D-262.

**Required independent proof:** Zero "not established", "candidate", "qualified", "Unresolved" where the value is known; one empty-state line per empty register.

### F58 — Documents page shows fields used and ignored

**Consultant observation on aadd8d4:** Not checked — Column usage exists in the data (0 ignored)..

**Shared fix:** Per file: columns mapped and columns ignored.

**Code/owner area:** ui documents view.

**Defects covered:** D-218.

**Required independent proof:** Column usage visible for each of the 22 documents.

### F59 — Test projects out of the live portfolio

**Consultant observation on aadd8d4:** Open — 84 test projects still in the portfolio..

**Shared fix:** Separate test projects from real projects.

**Code/owner area:** portfolio.

**Defects covered:** D-220.

**Required independent proof:** Portfolio shows real projects only, with a separate test list.

## Step 7 — Platform reliability, response size and performance

### F60 — Empty modules load normally

**Consultant observation on aadd8d4:** Fixed — No HTTP errors or console errors on any of 50 pages..

**Shared fix:** Empty modules return a normal response and one empty-state line.

**Code/owner area:** server.ts.

**Defects covered:** D-253, D-254, D-255, D-256, D-257, D-258, D-260, D-261, D-263, D-264, D-265.

**Required independent proof:** No HTTP 409 on any page.

### F61 — Page weight

**Consultant observation on aadd8d4:** Partly — Activity Review text 31,708 characters (was about 210,000); management pages now 16.5 to 17.8 MB (N-5)..

**Shared fix:** Server-paged tables; management pages get summaries, not the 896 item curves; each page under 2 MB of data.

**Code/owner area:** management-context.ts crossModule.quantities.series; server paging.

**Defects covered:** D-231, N-5.

**Required independent proof:** Every page data under 2 MB; Activity Review paged.

## Formal closure conditions

No test threshold may be reduced, no missing value may be changed to zero, and a non-official scenario may not be promoted to a determination. All 61 tasks must pass their exact test on one deployment commit, then every original and new finding must be visibly rechecked by the five-role engineering team. All retained projects, 100 fresh blind projects, Ask, filters, exports and restart/rebuild durability remain in the original seven-stage acceptance programme. No open Critical or High finding may be promoted to production.
