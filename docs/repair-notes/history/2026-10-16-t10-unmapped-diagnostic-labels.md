# 16 October 2026 — T10 internal diagnostic rendering

Parent repair commit: 45b783a980c2a5d6417055c07756b04fc3780db2.

Mandatory regression run 38813931678 showed a real T10 presentation mismatch: the assembled browser produced "Unmapped Internal Engine Token · ABC" as a primary page label, instead of a professional description. The T10 reader-facing humanizer now replaces only genuinely unmapped INTERNAL-prefixed codes with "Additional calculation qualification". Explicit, source-specific diagnostic codes and the existing approved meaning catalog retain their distinct reader labels; the source diagnostic identifier, detail, original files and downstream evidence are not altered. The existing batch-a-closure independent regression stays intact; an additive actual assembled-browser AST regression tests the exception, a known circular-relationship diagnostic and an ordinary source field.

Source repair and independent regression are saved, but exact-head six-group verification and source/screen/Ask/export parity, original 23-project guard, full four-cold five-second three-run gate and owner acceptance remain unverified. No finish-list item certified, no reduced content, no deployment/merge/auth/paid AI.
