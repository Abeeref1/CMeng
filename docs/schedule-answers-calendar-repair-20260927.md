# Programme calendars and direct schedule answers — 27 September 2026

The reported DMINFRA-101 problems exposed separate faults: P6 calendar record separators were rejected, display conversion factors could invalidate otherwise readable timetables, and Ask CMeng matched “delayed activities” to the claims register. “Full list” also lost the previous question and the browser offered only a 50-row preview.

## Changes

- Accept native P6 DEL record separators between structured calendar nodes. Keep source bytes, dates, shift times, exceptions and validation intact. Retain hours-per-day/week display factors separately from actual working patterns.
- Re-read affected stored XER calendars from the original retained bytes, after checking their SHA-256 and calendar identities. Recover whole-project and phase revisions, including pending candidates, without changing adoption or any activity, WBS, relationship, source identity or approval. Missing or changed originals remain disclosed.
- Show known critical and negative float even when other activities lack float or calendar-based bands remain unresolved. Preserve the existing near-critical/watchlist definitions and withhold incomplete whole-population totals.
- Publish missed starts and overdue finishes from one activity-date calculation shared by Activity Review and Look-Ahead. Ask and Master Dashboard consume the same activity producer. Use the programme Data Date, not today's clock. Unknown status, future actual dates and missing dates do not become confirmed zeroes. Summary and level-of-effort rows are excluded.
- Route ordinary delayed-activity questions to activity records. Keep delay events and entitlement under their existing claims authorities. Critical-path questions return the existing CPM calculation's critical activities when complete; otherwise show the labelled known source-float list. A critical-activity list is not a validated single ordered path or proof of delay causation.
- Keep short follow-ups such as “full”, “give me the full list” and “make it simple” in the same scope. Full-list requests remove Top N and refresh the adopted project version; old exports retain their snapshot.
- Start answers with plain text and activity IDs/names, show dates/progress/float in the table, and collapse supporting evidence detail. Add bounded, session- and project-scoped table paging. Every result row remains available in exports.
- Keep built-in Ask and the provider-neutral external gateway separate over the same authorities. Deterministic questions and their full/simple follow-ups invoke neither model method.

## Verification

The automated suite passed 824 tests before release. Focused new cases cover five-, six- and seven-day calendars, night shifts, holidays, unequal P6 display factors, exact near-critical boundaries, corrupted retained sources, restart idempotence, pending revisions and independent phase/project state.

Hand-checked schedule cases cover missed starts, overdue finishes, both together, completed work, future work, missing finish dates, unknown status, future actual completion, exact reporting-time boundaries, excluded summary rows, and dashboard/Ask equality. A two-activity calculation deliberately disagrees with source float and verifies that the calculated critical list contains the two-day activity rather than the one-day activity. Paging reaches all 73 records; a separate 75-row scenario checks Top 20 → full list → candidate upload → adopted replacement, with another project's answer unchanged. Cross-project and other-session table requests are rejected by the existing session controls.

The user's 58,678,830-byte P183 XER was re-read locally: 25,630 activities, 97,230 relationships and all eight calendars were retained and readable, including 40-, 48- and 56-hour weeks and calendar exceptions. No calendar-semantics blocking diagnostic remained.

Oracle P6 documents hours per time period as conversion factors for duration/work-unit input and display, which can differ from the underlying calendar timetable: https://docs.oracle.com/cd/F88969_01/English/p6_eppm/11748.htm and https://docs.oracle.com/cd/F25600_01/English/User_Guides/p6_pro_user/defining_default_hours_per_time_period_in_calendars.htm.

## Limits

No contract completion date, baseline, actual progress, missing float or causal claim is invented. A readable calendar cannot repair missing activity links, unsupported constraints, contradictory actual dates or other source defects. Known matches remain visible while incomplete totals stay qualified. The release does not claim that every possible natural-language phrasing or every client source file has been tested.
