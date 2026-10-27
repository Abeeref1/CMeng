# T11 speed: diagnosis, 27 Oct

Gate: `scripts/release-latency.cjs` (CMeng Verify, group operations). Four large projects (8,100 to 8,900 activities, 3 to 4 revisions, 4 to 7 calendars, BOQ and registers) open their first Dashboard at the same time on a fresh server; each must be ready within 5 s.

## Is it a regression? No.

The same script was run three times on each of 14 builds from bd851ecc (16 Oct, the one passing run) to d35da977, in parallel on GitHub runners (workflow run 40505796155). Four-project cold maximum in ms, three runs each:

| Build | Runs |
| --- | --- |
| bd851ecc (passed 4,848 ms on 16 Oct) | 8,000 / 8,143 / 8,162 |
| b354c596 | 5,870 / 5,948 / 5,955 |
| ae359263 | 8,446 / 8,562 / 8,423 |
| 540fa919 | 8,558 / 8,642 / 8,708 |
| 09e78a53 | 6,488 / 6,349 / 6,680 |
| 00dc3391 | 8,378 / 8,347 / 8,443 |
| 3de16d6a | 9,236 / 9,046 / 9,448 |
| 9ce68822 | 9,177 / 9,365 / 9,258 |
| 7c5501f7 | 8,875 / 8,829 / 9,025 |
| 5da3be8f | 8,714 / 8,847 / 8,728 |
| 5ec4187c | 6,162 / 5,810 / 6,273 |
| 0c7862aa | 8,548 / 8,658 / 8,568 |
| e55facaa | 8,955 / 9,071 / 8,970 |
| d35da977 | 8,252 / 8,204 / 8,181 |

The build that passed on 16 Oct takes 8.0 to 8.2 s today, the same as the final build (8.2 s). Runs within one job agree to about 2 %; the spread between jobs (5.8 s versus 8 to 9 s) follows the runner machine, not the code.

## Where the time goes

- Calculation (CPU), with contention. One large project alone: about 3.3 s cold (12,500 activities, prior cold gate). Four at once on a 4-CPU runner: each about 8 s, about the sum of the four. The four calculations share the same CPUs.
- Not start-up: start-up analysis finishes before readiness and is measured apart (preparation 5.3 s, not in the 5 s figure).
- Not I/O: the warm Dashboard is under 0.15 s; disk is not on the path of a repeated request.
- Not storage: more disk does not change the calculation time.

## On Railway (the production platform, up to 24 vCPU)

Three 8,900-activity projects uploaded and opened at once: 3.0 to 3.8 s each (20 to 27 Oct). Normal Dashboard pages: guard P1 zero (every page within 5 s with three projects read at once).

## Not met

The 5 s gate on a 4-CPU GitHub runner with four large projects at once is not met by any build since at least 16 Oct on today's runners. Meeting it there needs the four cold calculations to use about 40 % less CPU each; that is engineering work on the calculation itself, not a configuration or storage change.
