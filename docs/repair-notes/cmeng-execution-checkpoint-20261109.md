# CMeng execution checkpoint, 9 Nov 2026 (5-hour shared-rules block)

Branch: `fix/owner-rules-20261109` (based on production d2570e98). Production `cmeng-main` is unchanged.
Test service `cmeng-verifier-test` (also serves cmeng.crossfield-engineering.com) runs this branch, release 6659bb0c.

## Shared rules done in this block

- P1 Project Review universal rule (`applyUniversalReviewRule`, project-actions.ts). An item CMeng already answers is shown as
  "CMeng's answer" with a change control. Missing evidence is a data gap; it keeps its input (contract value, approved EOT,
  Commencement Date) and can take an owner and due date. Only genuine decisions stay required. Save routes and the review
  screen find items in all three lists. Measured on live production items: 338 required (20 projects) to 15
  (8 calendar working weeks, 4 procurement date basis, 2 notice provisions, 1 tax basis).
- P2 forecast credibility (`forecastCredibility`, forecast-control.ts). CMeng's own finish leads only when coverage is at least
  90%, at most 10% of open activities use an assumed calendar, logic problems are at most 1%, and the difference from the
  contractor's finish is within max(90 days, 25% of remaining duration). Otherwise the contractor's programme leads and the
  reason is said once. Dashboard verdict, Time card, forecast page and portfolio read the same gate.
- P3 shared page layout (ui-page-layout.ts). Verdict (the answer) first, then the programme / Data Date line, page content,
  actions, then qualifications and system evidence. Panel method notes follow the panel answer. Unknown values: an
  all-unknown column is one line; a repeated unknown sentence in a column is one line; the same unknown sentence in several
  blocks is shown once. The verdict's finding is the page answer; an open request is the next step.
- P4 AI reading. Finish AI reading discovers CSV and contract documents with no AI history, sends only columns that can carry
  a meaning, applies a validated reading like upload, stops at the cap, never reads a contract as a table. A contract
  uploaded with other documents gets their AI permission. A refused provider call logs its HTTP status only.
- Upload: a programme uploaded on its own (for example a baseline) is analysed provisionally while it stays a candidate.

## Verified

- Full local regression on de11a3a2: 2,660 / 2,660 pass. Focused Verification CI green on de11a3a2, c1216a9b, 6659bb0c.
- CI Verify on 6659bb0c: concurrency, acceptance, independent, raster pass; operations fails on the four-cold-project gate
  (9,248 ms against 5,000 ms). The same gate failed on 2 Nov (9fd75ae7, 8,980 ms). Upload-to-ready 3,832 ms and first
  Dashboard 3,075 ms are within 5,000 ms.
- Fresh browser uploads on the test service: full pack and poor pack, 19 s each to "position checked". Decisions survived two
  restarts. Saving the poor pack's calendar decision made CMeng's own finish reliable (20 Aug 2049) and it now leads.

## Found and open

- The test service disk was full (4.99 of 5 GB): every upload failed at "The project save could not be confirmed". The owner
  resized it to 20 GB on 9 Nov.
- The OpenAI key is rejected (HTTP 401) on both Responses and Chat Completions, also with the cmeng-main key referenced from
  the test service. No validated AI reading is possible until the owner sets a valid key on cmeng-main.

## Next action

1. Owner sets a valid OpenAI key on cmeng-main; restart the test service; run Finish AI reading on PROOF-FULL-1109 and
   PROOF-POOR-1109B and confirm validated steps.
2. Owner approval, then deploy this branch to cmeng-main and decide which service the custom domain serves.
3. Remaining shared items: one reference formatter for source locations in Project Review; verdict label tied to the review
   count; an unknown-only line never leads a page; the four-cold-project timing gate.
