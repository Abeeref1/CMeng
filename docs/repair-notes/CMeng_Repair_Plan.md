# CMeng Repair Plan

13 Oct 2026

Fix every CMeng defect once, in shared code, wording included, and stop each one from coming back. The original seven-stage agreement stays the acceptance standard, T01 to T12 are the work, and the automatic guard protects against defects coming back without replacing engineering acceptance.

## Where we start

The live release is b3c76d6. The repair branch fix/cmeng-systemwide-20261013 is at ddd5bdb6, with 64 saved commits that are not live. Nothing is deployed until the single release candidate. Stage 1 is open; 0 of 7 stages are accepted.

| Item | Position today |
| --- | --- |
| Scope | All 23 existing projects, all 57 pages and tabs per project, plus drawers, documents, portfolio, Ask, reports and downloads |
| Defect records | 274 consultant findings (F01 to F61), 57 system defects (SW-01 to SW-57), 8 open S-items (S02, S06, S07, S17, S21, S32, S35, S45), 641 findings from the 57-page detailed review |
| Automatic check, starting point | 11,822 failing checks out of 43,401 run (33 page rules on 1,311 pages, plus 6 project rules on 23 projects) |
| Rules failing | 36 of 39 fail on at least one project; 20 fail on all 23 projects |
| Read results held back | 548 of 548 documents held as "candidate only"; 171 pages say records wait for confirmation |
| AI | Set up but needs owner permission; not used for reading |
| Speed | Accountability takes 5 to 18 seconds to open on 12 projects (4 projects open at once); Notice Compliance and Cost Outlook went over once each; other pages open in under 1 second. On the repair branch, the fixer's own check measures 9.24 seconds for 4 cold projects at once |

## Rules for all the work

These rules apply to every task and every release.

1. **System-wide only.** Every fix goes into shared code. No fix for one project, no project names in code or tests.
2. **One evidence chain for every defect:** source, reading (and AI), linking, decision, calculation, screen, export. The fix goes where the chain first breaks, and every later step is checked again.
3. **Reading is not the same as authority.** Every fact carries one of three states:
   1. **Read:** taken correctly from a source, with its file and place.
   2. **Used in analysis:** a clearly read fact is used straight away, labelled with its source and document status (contractor submission, draft, superseded, current). No confirmation is asked for clear facts.
   3. **Formally adopted:** an approved programme, a contract term, an awarded EOT. This status is never assumed from reading alone.
4. **Ask only on real conflicts or unsure readings.** Show both values with their sources and what each changes. You pick one, type your own, change it later or undo it. Your choice is saved, survives a restart, and updates every page, role view, Ask answer and download.
5. **AI reads and matches, never calculates.** Each reading step shows whether AI was needed, available, called, worked or blocked. Spending has a monthly cap. Routine test runs use recorded AI answers; one controlled real AI test per release candidate proves the live AI path, within the cap.
6. **Unknown is never 0, "No" or "Good".** Zero, unknown, not applicable and disputed look different and say why. A missing owner or date shows as missing, with a way to set it.
7. **Wording and look are part of every fix.** Labels, buttons, empty messages, tooltips, charts and layout count. Low severity is no reason to leave a defect open. Checks test useful, correct behaviour: nothing is hidden or removed just to pass a check.
8. **Results change only for a reason.** A figure changes only when a source, a decision or the calculation version changes, and the change is recorded with its reason.
9. **Access.** No sign-in, no user accounts and no role control, by the owner's final decision; this replaces the authentication and RBAC item in Stage 7. Projects stay isolated from each other. Role views are views only and show the same facts for the same scope and date.
10. **Speed.** The 5-second gate applies to the release candidate, with 4 projects open at once, cold and warm. It is never lowered.
11. **A defect closes only on evidence** from the live pages, Ask and downloads, never on a test count.

## The seven stages: the acceptance standard

The stages and their closure requirements are the ones in the agreed document (docs/cmeng-fixed-seven-stage-readiness.md), unchanged except for the access item in rule 9. Under the 6 October amendment, engineering for all stages can run side by side; acceptance stays stage by stage, and a finding from the independent challenge reopens its stage.

| Stage | What it requires | Closes when | Main tasks | Guard rules that support it |
| --- | --- | --- | --- | --- |
| 1. Close all known defects | Every known defect reproduced and classed as a real defect or an invalid expectation; shared root cause fixed; exact regression and negative cases added | Every known defect fixed or disproved, the register reconciles all earlier findings, a fresh unseen cohort passes, independent challenge passed | T01, all repair tasks | All rules at their starting point or better |
| 2. Strict-suite root causes and fresh reacceptance | Every suite failure classed; source identity, authority, BOQ preservation, routing and candidate versus current authority protected | No unexplained suite failure or cross-page / source-authority mismatch on at least 10 fresh projects per feature family, independent challenge passed | T02, T03, T04 | R1 to R5, C1, C2, W10 |
| 3. Independent truth mechanisms | CMeng checked against truth worked out outside CMeng: CPM solver (calendars, FS/SS/FF/SF, lag), EVM workbook and script, commercial ledger, notice and date calculator, delivery state tables; judgment calls on claims and EOT stay human | Canonical facts and calculations reconcile, real basis differences explained, fresh adversarial projects pass, independent challenge passed | T06, T07, T08, T12 | Independent reader (T) |
| 4. Domain-by-domain certification | Each feature family certified on its own: contract and programme authority; CPM and float; progress, resources and S-curves; forecast and recovery; delay, notices and EOT; commercial and LD; procurement; delivery, quality and handover; risk and HSE | Every feature family works on at least 10 fresh unseen projects, independent challenge passed | T05 to T10 | N1 to N11, S1 to S4 |
| 5. Cross-domain and management integration | One PMO system: contract with schedule, schedule with progress and BOQ, procurement and delivery, delay with claims and EOT, EOT with LD, risk with forecast; all views agree on facts, Data Date, authority and populations | No unexplained contradiction, silent authority promotion or population mismatch, independent challenge passed | T05, T09 | N4, N5, A1 to A5 |
| 6. Ask, reports, filters and exports | Calculation first, AI only explains; filters, search, sort, paging, saved views; reports and exports match the screen | Screen, Ask, reports and exports give the same facts, independent challenge passed | T10 | W1 to W10, L1 to L6, X1 to X3 |
| 7. Operations and final blind acceptance | Isolation, concurrency, cold start, scale, restart, failed writes, backup and restore, rollback, monitoring; 100+ focused cases per critical family; 100 completely fresh projects; full real-project regression | The exact release tested is the release deployed; no known wrong figure, false zero, evidence loss, project-specific logic or screen/report mismatch; independent final acceptance | T11, T12 | P1, P2, N10, V1, every rule at zero |

## The work: T01 to T12

Twelve tasks cover the whole system. A task is done only when its findings are verified on the live pages and its guard rules are at zero.

| Task | Work | Done when |
| --- | --- | --- |
| T01 Repair record | One board for every finding: the 274 consultant findings (F01 to F61), SW-01 to SW-57, the 8 S-items and the 641 page findings. Each row: cause, shared fix, repair reference, verification method (independent calculator, independent reader, guard rule or expert review) and status. Link overlaps, delete nothing. Record what is live and what is saved but not live. Mark test projects as test. Keep this plan in the repository and point every new session to it (AGENTS.md). Record the no-sign-in decision in the seven-stage document. | The board is shared; every finding has a repair reference and a verification method; the starting point is saved. |
| T02 Source reading | Calendars and hours per day. Programme links whose rows carry no project ID. Duplicate activity IDs. The project finish date in the programme file (SW-57). Contract dates. Current versus older cost report. BOQ IDs. Every register column, including those ignored today (submittal ID, procurement package, location, criticality, cost code, linked letter). Statuses. PDFs. | R1 to R4 at zero; the independent reader's figures match the pages. |
| T03 AI reading and matching | Use AI where fixed rules fail: unfamiliar tables, clauses, file types, ambiguous links. Explicit references first. Full eligible population, resumable, with a spending cap. Show AI status per step. | R5 at zero; cost per project shown before AI is switched on; one controlled real AI test passes within the cap. |
| T04 Decisions and inputs | End the 30 Sep hold: clearly read facts are used in analysis with their source and status, while formal adoption stays separate (rule 3). One decision place for real conflicts and unsure readings: both values, sources and effect; pick, type your own, change, undo; kept after restart; every page updates. No approval requests for clear facts and no blanket confirmation of contract values. Input fields for values you can supply. | C1, C2 and W10 at zero; no clearly read fact is left out of analysis; no fact shows as formally adopted without adoption. |
| T05 Shared facts and totals | Full totals, never the 25-row page. Fix double paging (asks 50 rows, gets 25). Filters against totals. Zero, unknown, not applicable and disputed kept apart. The same measure gives the same value on every page, role view, chart, Ask answer and download. | N1 to N5, N9, N12, S1 and S4 at zero. |
| T06 Programme, progress and resources | Calendar-based dates, activity types, links, float in days, completed work excluded, milestones, baseline comparison, recovery dates. Discipline and location grouping, resource units and capacity, production rates, installed quantities, earned hours, productivity. | N7 at zero; results match the independent CPM solver and the reader. |
| T07 Contracts, commercial and claims | Original and revised completion, EOT included versus extra, overlapping awards, notices and periods, claims, variations, payments against certificates, currency, bonds, sectional LD, current cost report, EAC and overrun. Submitted figures kept apart from calculated ones. | Results match the EVM workbook, commercial ledger and notice calculator; judgment items are shown as such. |
| T08 Procurement, delivery and handover | Need dates, overdue logic, achievable recovery dates, readiness, NCR status (including unclear status), permits, interfaces, asset and handover position from the asset register's status flags, spares over-quantity check. | Results match the delivery state tables and the reader. |
| T09 Actions and navigation | One entry per problem that opens its evidence and the control that fixes it. No loops or duplicates. Owner and due date shown when known, shown as missing with a way to set them when not. Page addresses, back button, correct button targets. | A1 to A5 at zero. |
| T10 Wording, look, Ask and reports | Every visible element: labels, repeated text, false fixed notices, field names, internal code words, long tables, missing or empty charts, contrast, keyboard. The first screen answers the page's question, with detail one click away and nothing removed. Role views give the same facts. Reports and downloads are useful and carry the screen's figures, scope, dates and units. | W1 to W10, L1 to L6, S2, S3 and X1 to X3 at zero. |
| T11 Reliability and speed | Accountability speed first. PDF reading that blocks project start, cold opening, repeated calculation, worker contention, oversized responses, cache. Reading and saved decisions survive restarts and deployments. Separate source, decision and calculation versions. Backup, restore and rollback. | P1, P2, N10 and V1 at zero; 5 seconds with 4 projects open at once. |
| T12 Checks and closure | Build and validate the independent calculators before using them. Keep the independent reader. Run the guard on every build. Run fresh, blind and 100-project tests automatically. Turn every new finding into a check. Close defects on live evidence. | All calculators validated; the guard runs on every build; all rules at zero at final acceptance. |

## How the work is checked

Three layers check the work. The first two prove that results are right; the third stops defects coming back. None of them replaces another.

| Layer | What it proves | How |
| --- | --- | --- |
| 1. Independent truth | Figures and dates are right | Calculators built outside CMeng and validated first: CPM solver, EVM workbook and script, commercial ledger, notice and date calculator, delivery state tables. An independent reader works out register counts, overdue counts, date errors, programme links, calendar hours, project finish dates, contract dates and cost report lines from the source files, finding each file by its columns. None of them use CMeng's answers. Expected answers are never typed into tests. |
| 2. Independent stage challenge | Each stage meets its standard | A reviewer with a clean context makes its own inputs and expected answers before looking at CMeng, uses unseen projects, and attacks missing, duplicate, future, conflicting and authority cases. A finding reopens the stage. |
| 3. The regression guard | Nothing that works breaks again | The 39 automatic checks (below) run on every page of every project on every build. |

**How the guard works.** Today's results are the starting point. A build passes the guard when nothing that passes today starts failing (on any rule, project or page) and the checks for the items in that build are at zero. When a rule reaches zero on all projects, it locks: one failure anywhere then blocks. L4, A2 and P2 are at zero today, so they are locked from day one. Only the owner or the verifier changes the starting point or the rules.

**Every new finding becomes a check.** Before a finding closes, it is added as a rule, a phrase on the do-not-use list, or a case for a calculator or the reader.

**One release candidate.** Nothing is deployed while the work goes on; the guard runs on every build instead. When all work is done and the stages are accepted, one exact revision goes to you to deploy, operate and inspect across all 23 projects. No build is called a completed repair before that.

## The 39 automatic checks

All 39 rules ran read only on all 23 projects at release b3c76d6 on 13 Oct 2026: 33 page rules on 1,311 pages and 6 project rules once per project, 43,401 checks in all, of which 11,822 failed. 36 rules fail on at least one project and 20 fail on all 23, which shows the defects sit in shared code. This is the first full run; any change to a rule goes through the owner or the verifier.

| ID | Group | Rule | Projects failing (of 23) | Pages failing |
| --- | --- | --- | --- | --- |
| N1 | Numbers | A list cut to 25 rows is never counted, totalled or drawn as the whole list. | 16 | 87 |
| N2 | Numbers | An unknown value is never shown as 0, "0 of 0", "No" or "No known". | 23 | 407 |
| N3 | Numbers | A unit is never printed after an unknown word. | 23 | 224 |
| N4 | Numbers | The same measure shows the same value on every page of a project. | 11 | project rule |
| N5 | Numbers | A role view shows the same value as the overall view for the same measure. | 19 | 192 |
| N6 | Numbers | Numbers and dates are formatted for people. | 21 | 218 |
| N7 | Numbers | Durations and float are shown in days with the day type, never in hours. | 23 | 218 |
| N8 | Numbers | No impossible values. | 14 | 20 |
| N9 | Numbers | Paging reaches every row. | 18 | 18 |
| N11 | Numbers | An ID column never repeats one value on every row. | 19 | 96 |
| S1 | States | Every unknown value says why and what is needed. | 23 | 511 |
| S2 | States | An empty table says why it is empty. | 23 | 569 |
| S3 | States | A chart is never drawn empty. | 15 | 29 |
| S4 | States | A good-news badge never sits on a bad number. | 12 | 24 |
| W1 | Wording | No data field names on screen. | 23 | 1,186 |
| W2 | Wording | No internal code words on screen (fallback, deterministic, payload, stub, pointer, session IDs). Engineering terms such as CPM, SPI and EOT are fine. | 23 | 1,042 |
| W3 | Wording | File names are shown as uploaded, never cut or lower-cased. | 12 | 369 |
| W4 | Wording | Plurals and counts agree; no doubled words. | 23 | 483 |
| W5 | Wording | A sentence is said once per page. | 23 | 999 |
| W6 | Wording | Each page has its own headline. | 23 | 217 |
| W7 | Wording | No raw source row lists or ID dumps in text. | 21 | 185 |
| W8 | Wording | No phrase from the do-not-use list (every wording defect found once is added to it). | 23 | 1,020 |
| W9 | Wording | One unknown word per value. | 23 | 252 |
| C1 | Choices | When two values disagree, the page shows both and lets the user pick one or enter another. | 23 | 650 |
| L1 | Look | The first screen answers the page's question; detail stays one click away and nothing is removed. Measured as a default view of 3 screens or less. | 23 | 823 |
| L2 | Look | No raw data sections. | 23 | 1,149 |
| L3 | Look | No overloaded pages. | 23 | 614 |
| L4 | Look | Nothing runs off the screen. | 0 | 0 |
| A1 | Actions | Every button goes to a page that exists. | 7 | 7 |
| A2 | Actions | No button sends the user back to the same page. | 0 | 0 |
| A3 | Actions | An action is listed in one place. | 23 | project rule |
| A4 | Actions | A missing owner or due date shows as missing with a way to set it, never as a placeholder ("not designated", "Suggested"). | 23 | 84 |
| R1 | Reading | Every source column is read or shown to the user as not used. | 13 | project rule |
| R2 | Reading | Every file type is identified from its content. | 19 | project rule |
| R3 | Reading | Every file is read completely or says what part was not read. | 23 | project rule |
| R4 | Reading | Programme links attach to activities. | 3 | 3 |
| R5 | Reading | When reading is incomplete and AI is set up, the screen says so. | 23 | project rule |
| P1 | Speed | Every page opens within 5 seconds. | 14 | 14 |
| P2 | Speed | No load errors. | 0 | 0 |

## Checks still to add

These checks are designed and generic. Each joins the guard when its task starts, and then follows the same ratchet.

| ID | Rule | How it is checked | Added with |
| --- | --- | --- | --- |
| N10 | A large result is never replaced by an empty page. | Server total above 0 while the page shows no rows or an empty box. | T11 |
| N12 | Filter counts add up to the page total. | Sum of each filter option's count against the tile total. | T05 |
| C2 | Every missing value the user can supply has a place to enter it. | An unknown tile with no input or upload control on the page. | T04 |
| W10 | A banner never says something is waiting after it is done. | Banner text against the confirmation state from the server. | T04 |
| A5 | Every page has its own address. | The address changes with the page and reopens the same page on reload; the back button works. | T09 |
| L5 | Every filter has real choices; every table can be sorted. | Filter lists with only "All"; tables with no sort. | T10 |
| L6 | Readable contrast and keyboard access. | Standard accessibility scan of each page. | T10 |
| X1 | Downloads and reports pass the same wording rules as the screen. | Rules W1 to W9 run on each download and on Generate report. | T10 |
| X2 | Every figure on screen is in the download with the same value. | Page figures compared with the downloaded file. | T10 |
| X3 | Chart numbers match the table beside them. | Chart values against table values on the same page. | T10 |
| V1 | Results change only for a recorded reason. | A figure changed with no change of source, decision or calculation version, or with no recorded reason. | T11 |
| V2 | Test projects are marked as test, not live. | Project list flags. | T01 |
| T | Key figures equal independent truth. | Independent reader and validated calculators on every reference project and every fresh project. | T12 |
| D | Each page answers its own question on the first screen. | One design decision per page type, then written down as a rule above. | T10 |

## Order of work and releases

Shared causes go first because every page depends on them. Speed goes first of all, because the release candidate must pass the 5-second gate and cold loading of 4 projects at once fails it today.

1. **T01 board and starting point, and T11 speed.** Accountability speed and the PDF reading that blocks project start are fixed first. The repairs already saved on the repair branch are run through the guard and kept, or redone.
2. **T12 calculators and reader.** Built and validated early, before they are used to judge CMeng.
3. **T02 and T03 reading, then T04 decisions and the hold, then T05 shared facts.** These feed every page.
4. **T06, T07 and T08 domain results** on top of the repaired shared layer, judged against the calculators.
5. **T09 and T10 actions, wording, look, Ask and reports.** These show the repaired results. Wording fixes that need no data change can be done at any time.
6. **One release candidate.** When the stages are accepted, one exact revision goes to you to deploy, operate and inspect in full. Nothing is deployed before that.

## Testing limits

Machines do the repeated testing; people review once per stage. Proof is never cut, only repeated manual rounds are.

- **Automatic, no people needed:** the guard on all 23 projects, the reader and calculators, at least 10 fresh unseen projects per feature family, 100+ focused cases for critical families, the 100-project final blind run, and full regression of the real projects.
- **A failed blind project becomes regression data** and never counts again as unseen proof.
- **Independent stage challenge:** one per stage. Its findings go back as checks and fixes, not as new rounds of manual testing.
- **Twice failed means redesign:** a fix that fails review twice goes back to its cause.
- **Open stays open:** an unresolved failure stays on the register until fixed or disproved; low severity never closes it.
- **AI spend in tests:** routine runs use recorded AI answers; one controlled real AI test per release candidate, within the cap.

## Who does what

| Who | Does | Never does |
| --- | --- | --- |
| Fixer | Builds fixes in shared code, builds the calculators, runs the guard on every build, keeps the T01 board up to date, delivers one release candidate | Edits the rules or the starting point; fixes one project; changes wording only to pass a check; supplies inputs or answers to the independent reviewer |
| Independent reviewer | Runs each stage challenge with a clean context, its own inputs and its own expected answers | Looks at CMeng's outputs before fixing its expected answers |
| Verifier (read only) | Keeps the guard, the reader and the starting point; checks live pages against the sources; reports findings as issues | Changes CMeng, its code or its settings |
| Owner | Approves the plan; makes decisions on real conflicts; approves any change to the rules, the starting point or the stage agreement; operates the integrated release | Confirms clear facts one by one |

## Dates

| Milestone | When |
| --- | --- |
| T01 board and starting point | Within 2 working days of approval |
| Accountability under 5 seconds | Date given by the fixer on the T01 board |
| Release candidate ready for you to deploy | Date given by the fixer on the T01 board |
| Stage acceptance dates | Set from the T01 board, then kept on it |

## All 57 system defects and the 274 consultant findings

The 274 consultant findings (F01 to F61) go on the T01 board, each with its repair reference and verification method. Engineering items among them (independent CPM with mixed calendars and relationships, contractual entitlement, sectional LD, productivity, payment reconciliation, recovery feasibility) are verified by the independent calculators and the stage challenge, not by the guard.

Each of the 57 system defects has a task that fixes it and a check that stops it coming back: 23 checks are running now, 18 use the independent reader or calculators, 11 are still to add, and 5 need one design decision first.

| ID | Defect | Severity | Fixed in | Check | Check status |
| --- | --- | --- | --- | --- | --- |
| SW-01 | Page size counted as the total | Critical | T05 | N1 | Automatic, running |
| SW-02 | Register paging skips rows | Critical | T05 | N9 | Automatic, running |
| SW-03 | Very large results become an empty page | High | T11 | N10 | Automatic, to add |
| SW-04 | Unknown shown as 0, No or clear | Critical | T05 | N2, S4, N3 | Automatic, running |
| SW-05 | Role views blank | Critical | T05, T10 | N5 | Automatic, running |
| SW-06 | Wrong values in columns | High | T02 | N11, reader | Automatic, running |
| SW-07 | Pages contradict each other while the check says Pass | High | T05 | N4, S4 | Automatic, running |
| SW-08 | Key figures held but not shown | High | T02, T05 | reader | Independent reader |
| SW-09 | Programme links do not attach | Critical | T02 | R4, reader | Automatic, running |
| SW-10 | Duplicate activity ids matched silently | High | T02 | reader | Independent reader |
| SW-11 | Files filed by file-name guess and never queued for review | Critical | T02, T03 | R2 | Automatic, running |
| SW-12 | Superseded cost file used as current | Critical | T02, T07 | R2, reader | Independent reader |
| SW-13 | Register columns ignored or not mapped | High | T02 | R1 | Automatic, running |
| SW-14 | Uploaded documents left unread | High | T02, T03 | R3 | Automatic, running |
| SW-15 | Delay events made from the claims register | High | T07 | reader | Independent reader |
| SW-16 | Activity type unknown for every activity | High | T02, T06 | S1 | Automatic, running |
| SW-17 | Procurement need date | Critical | T08 | reader | Independent reader |
| SW-18 | Readiness rules | High | T08 | design rule | Design once, then a rule |
| SW-19 | NCRs with unclear status counted as open | Critical | T08 | reader | Independent reader |
| SW-20 | Fixed default periods instead of contract rules | Critical | T07 | notice calculator | Independent calculator |
| SW-21 | Variation position | High | T07 | commercial ledger | Independent calculator |
| SW-22 | Contract time | Critical | T07 | reader, N4 | Independent reader |
| SW-23 | EOT windows | High | T07 | CPM solver | Independent calculator |
| SW-24 | Recovery options | Critical | T06 | design rule, CPM solver | Design once, then a rule |
| SW-25 | Float trend | Critical | T06 | CPM solver | Independent calculator |
| SW-26 | Filters vs KPIs | High | T05 | N12 | Automatic, to add |
| SW-27 | Grouping | High | T06, T10 | design rule | Design once, then a rule |
| SW-28 | No planned progress without calendars | High | T06 | CPM solver, S1 | Independent calculator |
| SW-29 | Failed recalculation shown as the user's input problem | High | T06, T10 | W8 | Automatic, running |
| SW-30 | Contractor figures called independent checks | High | T10 | W8, design rule | Design once, then a rule |
| SW-31 | Implausible source EAC not challenged | High | T07 | EVM workbook | Independent calculator |
| SW-32 | Delivery risks from the wrong source | Critical | T08 | reader | Independent reader |
| SW-33 | Handover readiness ignores the asset register | High | T08 | delivery state tables | Independent calculator |
| SW-34 | Interface candidates from package pairs | Medium | T08 | design rule | Design once, then a rule |
| SW-35 | HSE rates | Medium | T08 | reader | Independent reader |
| SW-36 | Held values never offered to confirm or choose | Critical | T04 | C1 | Automatic, running |
| SW-37 | No input fields | High | T04 | C2 | Automatic, to add |
| SW-38 | Stale confirmation banner | Medium | T04, T10 | W10 | Automatic, to add |
| SW-39 | Action loop | High | T09 | A3, A2 | Automatic, running |
| SW-40 | Buttons to wrong or empty places | Medium | T09 | A1 | Automatic, running |
| SW-41 | No page addresses | Medium | T09 | A5 | Automatic, to add |
| SW-42 | Packages linked to finished work disappear | High | T08 | delivery state tables | Independent calculator |
| SW-43 | No answer on the first screen | High | T10 | L1, design rule | Automatic, running |
| SW-44 | Very long, repeated pages | High | T10 | L1, L3, W5 | Automatic, running |
| SW-45 | Developer language | High | T10 | W1, W2, W3, W8 | Automatic, running |
| SW-46 | Fixed notices that state false facts | High | T10 | W8, reader | Automatic, running |
| SW-47 | Charts | High | T10 | S3, X3 | Automatic, running |
| SW-48 | Filters and sorting | Medium | T05, T10 | L5 | Automatic, to add |
| SW-49 | Downloads and Generate report are raw dumps | Critical | T10 | X1 | Automatic, to add |
| SW-50 | Screen figures missing from export | High | T10 | X2 | Automatic, to add |
| SW-51 | Contrast and keyboard access | Medium | T10 | L6 | Automatic, to add |
| SW-52 | Versions change with no new source | Medium | T11 | V1 | Automatic, to add |
| SW-53 | Pages fail during deployments | High | T11 | P2 | Automatic, running |
| SW-54 | Speed | High | T11 | P1 | Automatic, running |
| SW-55 | Test data listed as live projects | Medium | T01 | V2 | Automatic, to add |
| SW-56 | AI set-up | High | T03 | R5 | Automatic, running |
| SW-57 | Project finish date in the programme file not read | High | T02, T06 | reader | Independent reader |

SW-57 in full: from the programme file's project table, CMeng reads only the short name and the data date. The project finish date (plan\_end\_date) is never read, even where it moves from one revision to the next while the latest activity finish barely moves.
