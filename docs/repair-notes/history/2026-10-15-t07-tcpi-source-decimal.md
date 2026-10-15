# 15 October 2026 — T07 near-zero source-money TCPI precision

The exact-head independent commercial/EVM GitHub oracle rejected one of 120 randomized cost snapshots: expected TCPI-to-budget -23133.571429 versus calculated -23133.571428. Two binary-floating subtractions of close BAC/EV/AC/EAC monetary source values amplified a cent-level representation error. This is a source-supported shared commercial defect, not a test problem.

The cost-performance producer now computes only TCPI budget and forecast ratios from the original source decimal coefficients using exact scaled differences and signed half-up rounding to six decimals, retaining all source figures, source states, EAC scenarios, historical CPI/SPI calculations and formal authority. Independent Decimal-reference cases include negative/small differences, both forecast/budget ratios, exact zero denominators, and no mutation of source monetary evidence.

Focused owner guard and mandatory six groups are unchanged. New regression is tests/t07-tcpi-source-money-precision.test.ts. Current-HEAD mandatory verification and T11 still required; no finish-list item, T01 item or fixed stage accepted. No deploy, merge, paid AI, auth or content reduction.
