# System-wide repair implementation record

Work branch: `fix/cmeng-systemwide-20261013`, based on production source `b3c76d6ca6b2dfb2c98ae195270c7b81feb1602e`.

The requested scope remains the whole CMeng system and all 23 existing projects. ABB is evidence of shared defects, not a project-specific configuration target. The workbook reports 579 problems and 62 successful checks; this record does not mark that inventory complete. No new closure policy or deployment gate has been added. No deployment or live-project acceptance review has been performed during this repair work.

## Implemented shared changes

- XER links with omitted project fields can resolve unique tasks within a single-project file. Explicit external links and multi-project ambiguity remain separate.
- Explicit calendar conversion aliases are read. Conflicting declarations remain unresolved; a calendar name alone cannot establish a timetable.
- Existing stored XER revisions and phase schedules are refreshed from retained, hash-verified source bytes on startup. Calendar and activity identities must match. Only unresolved unscoped relationship endpoints are repaired; dates, durations, approvals and source bytes are retained. The refresh records its version and repaired-link count and is idempotent.
- Table AI can address populated unread columns even when the basic table type was recognized. Existing owner permission, per-file limits and source-bound caching remain in force. CSV and worksheet failures are recorded; no paid AI calls were used for the checks below.
- Role views use facts, actions, completion, network and progress context already present in the open page instead of relying exclusively on the empty overview context.
- Programme summaries use retained full-population totals. Activity paging no longer drops the second half of a 50-row page, and the activity pressure matrix is aggregated before paging.
- Oversized responses preserve module structure, at least one register row and full detail pointers instead of returning an empty module. An unusually large irreducible fact core can still exceed the response target; this is not a claim of bounded size for every input.
- Source claim charts use counts calculated before paging and preserve the source status wording. Dated lifecycle conclusions remain separate.
- Detailed-claim deadlines use the uniquely applicable official contract rule and its recorded starting event. There is no implicit 42-day rule. Missing or conflicting rules/triggers leave the deadline unresolved. This is not an entitlement determination.
- Procurement recovery does not treat a past need date as an achievable future target or count historical lateness as recoverable days.
- Procurement tables show register required-on-site dates, linked programme dates and the earlier screening date separately. The overdue message identifies the date it used. A user-selected governing-date workflow is not implemented by this presentation change.
- Missing driving-network results remain unknown through Look-Ahead and delivery projections.
- Unclear quality statuses are excluded from known open counts and displayed separately.
- Undated supplied risk records remain visible in the main risk register. Reported source status and dated reporting position remain distinct; BOQ candidates do not replace an existing register.
- Unknown activity types qualify milestone identification. An unidentified milestone population does not produce a green zero-exception screen. Progress Status carries the same qualification.
- Float trends compare the share of unfinished execution activities; raw counts remain in revision details. Completing activities alone no longer creates an apparent percentage improvement.
- Currency-denominated cost headings, such as `Value SAR`, are recognized and consumed without treating CPI/SPI as money. The register-reader upgrade can recover eligible tabular cost reports misfiled as schedules, replaying their existing upload intent and family history. Genuine linked schedule revisions remain on the schedule path.
- Affected wording distinguishes recorded contract dates from an unproven original date, calculated forecasts from source values, and unresolved readiness from an absence of blockers.

## Continued shared repairs

- Completion reading now accepts explicit month-first English dates and separates historical original dates quoted in amendments from their current revised dates. Invalid dates remain unresolved. Amendment reconciliation uses the same reader and retains whether a matching source passage was read deterministically.
- The EOT page no longer overwrites its independently sourced original completion with the current amended completion during shared fact binding. Its explanation no longer implies every current completion is simply original plus all awards.
- An amendment date is no longer substituted for a missing original date in the provisional EOT comparison, preventing a second addition of already-incorporated days.
- Programme Changes derives its repeated-movement warning and top float changes from the complete comparison before paging. Changed rows are ordered before paging, and engineering/detail counts use full response populations. The bounded float chart series remains intact through response compaction.
- Variation status distribution is produced before paging. Contract clause/amendment totals and future/undated insurance and retention counts use full response populations.
- Navigation preserves a completed specialist result with no warning instead of replacing its null warning with an incorrect “not yet recorded” message.

## Evidence and checks

The changes were traced to the retained ABB page-by-page workbook and shared implementation paths, including its paging, role-view, claim-rule, recovery, procurement, risk, quality and cost-reading findings.

`npm run build` passes, including browser script parsing. Focused checks pass for register refresh, persisted XER recovery and hash refusal, source link scope, aggregate uncertainty, full-population paging, role facts, contract deadline triggers, recovery feasibility, AI failure diagnostics, cost currency handling, quality status and undated risk visibility. These checks establish those implementation behaviours only. They are not substitutes for the requested live review across 23 projects.

The continued-repair build passes with calculation fingerprint `2b09edcdeead4ba9`. The focused contract/source, reporting, revision, commercial and response-paging run passes 173 checks. This is implementation verification, not live acceptance.

A prior broader UI suite reported two pre-existing wording assertions expecting “Assign to” while the UI says “Responsible role”. Those assertions were not weakened to report an all-green suite.

## Work not represented as complete

The remaining workbook findings still require implementation review, including confirmation workflows, other paged chart populations, source-reader/OCR coverage, report/export presentation, action navigation, and the complete wording/layout review. AI availability and real paid-provider behaviour have not been verified against live project data. Existing projects have not yet run these new migrations in production. Deployment remains separate from this saved implementation work.
