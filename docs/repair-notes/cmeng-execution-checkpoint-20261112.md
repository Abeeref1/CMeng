# CMeng execution checkpoint, 12 Nov 2026

Branch `fix/owner-rules-20261109`, head fd5be2cb. cmeng-main still runs c485be39 (deployed 9 Nov with owner approval).
The test service `cmeng-verifier-test` runs 2fbed758.

## Fixed in this session (tested, pushed, not yet on cmeng-main)

- Contract AI reading continues past the 8-call limit: answers already returned for the same heading text are kept
  (`contractAiAnswers` on the document) and reused, so a second Finish AI reading asks only the unread headings.
- One shared source-location reader (`source-locations.ts`): Project Review and contract terms show "page 1", "rows 4, 5"
  and the document name, never span codes; money reads with thousands separators.
- Verdict label states the position (Off target, Not fully confirmed, Within the checked target, Not assessable), never a task.
- Shared layout: a line that only says a figure is unknown never opens a page; a page without a verdict keeps its answer on
  the first screen (chart, tiles or main panel), not only buttons; unknown tiles are one line after the known tiles, for every
  tile layout; the engine's own summary line is not promoted as a reason line.
- HSE rate bases read "per 1,000,000 hours".

## Audit

- `audit.cjs` (scratchpad) opens every page of every project in Chromium and checks shared rules; 12 Nov live audit:
  1,180 checks, 0 failed, 0 script errors, no Data Date conflicts, median 1.4 s, 90% within 2.2 s.
- Live findings by mechanism: label as task 193 pages, unknown tiles lead 39, answer hidden behind buttons 26, review codes 13
  projects, review amounts 14 projects (all fixed in the ready release); register not supplied 156 pages (correct by design);
  dash placeholder 48 pages, first open over 5 s 29 pages (open); repeated unknown sentence 10 (partly fixed).
- Report published as an artifact ("CMeng Page Audit").

## Verified

- Full local regression on 459a2264: 2,666 of 2,670; the 4 failures were 2 load timeouts (passed alone and in CI) and 2
  tests fixed since (notice review, R12 cash-flow layout). Browser and layout tests pass on fd5be2cb.
- CI Focused Verification green on 2fbed758.

## Open

- Speed gate (four cold projects in 5 s) still fails: 7 to 9 s on CI; a cold project needs about 2.8 s of CPU alone and the
  profile is flat. Accountability and Actions required pages take 12 to 26 s on first open on the largest projects.
- Dash placeholder in empty cells.

## Next action

Owner takes a Railway volume backup of cmeng-main and approves; deploy fd5be2cb (or later) to cmeng-main; rerun
`audit.cjs` on all 20 projects and republish the report.
