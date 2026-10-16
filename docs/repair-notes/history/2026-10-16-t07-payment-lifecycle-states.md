# 16 October 2026 — T07 payment lifecycle evidence states

Exact parent: 5e4e573c97933fba2497c7b75b5468cfed891fab.

The on-page IPC lifecycle fallback used one "not established from a retained payment source" message for two materially different causes: no source register and a retained register with insufficient lifecycle stage evidence. This concealed the correct next review action and failed the existing owner wording regression (ui-workspace.test.ts), while an absent population still needed explicit nonzero/unknown distinction.

The real payment-page source now distinguishes absence of a confirmed payment register, retained payment rows with unresolved stage counts, an established empty current-period population, and a fully evidenced lifecycle with every original bar. All source payments, record counts, dates, certificates, commercial totals, screen functionality and downstream outputs remain unchanged. New independent tests execute the original assembled browser expression for all four cases; earlier regressions stay untouched.

Engineering correction only: T07 and all nine other immutable finish-list items remain unaccepted. Exact-source build, original six CI groups, source/screen/Ask/export reconciliation, full original 23-project owner guard, three unchanged four-cold 5,000-ms first-open dashboard and Accountability runs, seven-stage acceptance and owner deploy remain outstanding. No test relaxation, lost content, partial deployment or paid AI.
