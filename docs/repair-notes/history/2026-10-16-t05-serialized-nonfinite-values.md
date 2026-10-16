# 16 October 2026 — T05 text-serialized nonfinite quantities

Exact parent HEAD: 2e5acc77abce59e48385c59f78190adaa1d4a21d.

Original T05 management-value state correctly blocked numeric NaN/Infinity, but a source reader that serialized exactly those nonfinite tokens as a string could still show "NaN working days" or "Infinity SAR" as a measured fact, even with an explicitly known-value wrapper. The shared renderer now treats only the exact trimmed numeric sentinel strings NaN, signed Infinity as not-calculable and textual null/undefined as not-established. Legitimate zero, decimals, IDs, programme tokens, source files and authority remain unchanged. The independent existing T05 state-and-display regression has additive adversarial string and legitimate-ID cases.

Engineering only, no full T05/other finish item closure: source/screen/Ask/download reconciliation, original complete 23-project owner guard, mandatory six-group CI, hard full Dashboard+Accountability four-cold under 5000ms repeated three times including warm-up-off, all stage challenges and original inventory remain unfinished. No deploy, removed content, auth or paid AI.
