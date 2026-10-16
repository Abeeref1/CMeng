# 16 October 2026 — T08 procurement-source timestamp and status validation

Starting parent: `743668bd3d9074493fb568414f2aae11e6782de5`. Continue the original T01–T12, ten owner finish requirements and unchanged acceptance gate.

Shared source defect: source timestamps containing UTC offsets exceeding ±14:00 could be treated as valid dates and establish overdue/physical-delivery evidence. Nullable status cells could throw at `trim()`, while expressly unknown/disputed statuses were treated as known non-delivery. The common procurement timing reader now validates the time-zone offset boundary and distinguishes unknown status from positive open/pending status. A dated future actual remains effective as evidence of non-delivery as of the reporting date. Inputs are not modified. Valid leap-day and ±14:00 source local dates remain valid.

Independent T08 regression checks invalid and valid boundary offsets, nullable and disputed raw statuses, true open overdue and future actual evidence. No original tests, views, source documents, guard rules or calculation thresholds were removed or weakened. This is a partial shared T08/T02 repair, not completion of T08, T02, T01 or any other owner finish-list item.

At authorship, exact-head focused/full six-group CI, original 23-project 39-rule guard, source-screen-Ask-download alignment and full 4-cold-project <=5000 ms proof remain outstanding. No deployment, paid AI or authentication change.
