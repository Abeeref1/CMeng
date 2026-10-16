# 16 October 2026 — T09 source issue codes retained in routing

Exact parent HEAD: 015debb7744152ada46e3470802f91f332a9cedd.

Source-domain routing previously used only sourceFactKey, evidence paths, summary and detail. A real payment/claim/variation/risk source conflict carrying its domain in the original immutable issue code but only a generic description therefore reached the default generic review. Shared review grouping now includes the original issue code, preserving source receipts, conflict kind and the original matter group rules.

Additive independent T09 test covers four code-only conflict families, exact source receipt and row/hash, actionable group state, generic fallback and source immutability. Original focused workflow already runs this T09 file; no existing test, guard, content or threshold was removed. The separate substring-matched source filename issue in project-actions.ts still requires a subsequent correction.

Partial engineering only. T09, all other owner finish-list items, original 23-project guard, six mandatory groups, three unchanged four-project cold Dashboard+Accountability tests below 5000 ms (one without warm-up), and independent owner acceptance remain unfinished. No deployment, auth, role controls or paid AI.
