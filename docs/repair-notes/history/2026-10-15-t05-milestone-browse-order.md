# 15 October 2026 — T05/T09 milestone default browse parity

Defect: first-open milestone previews over 160 rows rank the full source population by management priority. The subsequent source-record browse pages used the original unsorted row order. Browsing from the first preview into later offsets can repeat high-priority milestones and omit lower-priority evidence.

Source correction: the existing shared priority comparator now also ranks default milestone browse pages. Explicit source sort, status filters, full unmodified source rows, project isolation, all established source totals, chart/Ask/export producers and original first-open figures remain intact. This does not apply to non-milestone registers.

Independent regression (existing focused CI suite tests/consultant-response-paging.test.ts): actual first-open source-engine output matches browse page one; 340 unique retained milestones reachable across 14 pages; open-status total, explicit user ordering, source preservation and second project's different priority checked.

This is not closure of T05, T09, SW-01 or any of ten immutable owner finish items. Exact-head six mandatory groups, three unchanged hard T11 runs (including warmup disabled), 23-project owner guard and independent stage acceptance still required. No deploy, merge, roles, source deletion, test waiver or paid AI.
