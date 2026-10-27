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

## 27 Oct evening: restore speed-up, candidate 36873462 (not deployed)

Production stays on 84489879. The 5 s gates are still not met, so this candidate was not deployed.

### Change

A save larger than 32 MB is read into one buffer, split at value boundaries, and each bounded value is decoded by the native JSON parser. Before, a token-by-token reader decoded the whole file. The change fingerprint and the save now hand each value below the top levels to the native serializer, falling back to the old encoder when a value is too long. Saves larger than 384 MB still use the old reader.

Values, hashes and saved bytes are identical. This was checked on three real saves (ABB 191 MB, 180 MB, 90 MB):

- the parsed values are deep-equal to the old reader's;
- the fingerprint hash is equal;
- the saved file is byte-identical.

The 545 MB durability gate (upload, retry and restart) passes.

### Measured

ABB, local copy of the real sources (2 CPU machine). The test starts a fresh server with no stored page reads, then opens the first Overview, then the first Dashboard:

| | 84489879 | 36873462 |
| --- | --- | --- |
| Restore of the 191 MB save | 16.0 s | 9.9 s |
| First Overview | 32.8 s | 18.0 s |
| First Dashboard (after Overview) | 22.3 s | 19.6 s |

Four large projects at once, `scripts/release-latency.cjs` on GitHub. Each job ran both builds alternately on the same runner, three times each (workflow run 40565741465). Slowest project in ms:

| Runner | 84489879 | candidate |
| --- | --- | --- |
| Job 1 | 5,837 / 5,860 / 5,880 | 5,291 / 5,260 / 5,267 |
| Job 2 | 9,708 / 9,727 / 9,756 | 8,550 / 8,610 / 8,499 |
| Job 3 | 7,677 / 7,691 / 7,712 | 6,783 / 6,707 / 6,866 |

The gain is in loading each project. The calculation itself is unchanged: 3.8 to 6.9 s per project under four-way load, depending on the runner.

A 96 MB young generation for project workers was measured too. It was 8 to 10 % faster on this machine but showed no gain on GitHub runners, so it is not in the candidate.

### Why 5 s is still not met

1. ABB first Overview still waits for the project to load, about 18 s locally:
   - module load, about 1 s;
   - restore, 9.9 s. This is made up of reading 2.9 s, change fingerprint 2.4 s, time-claim synchronisation 2.4 s and table analysis 2.1 s.
   - two start-up refreshes, 5.0 s. Each computes the change fingerprint again (4.1 s together), even when nothing changes.
   - the Overview itself, 1.9 s.
2. The ABB Dashboard calculation takes 19.6 s locally. On Railway it measured 15.1 s on 84489879; the calculation is unchanged in the candidate. The CPU profile is flat: about 30 functions of 0.5 to 3 s each, and garbage collection is 16 %. No single fix removes a large share.
3. The four-project gate needs about 25 to 40 % less calculation CPU per project. How much depends on the runner.

### Remaining work (not started)

- Compute the change fingerprint only when a migration or refresh actually changes data. This requires restructuring the restore and refresh paths so that each step reports its change before mutating.
- Keep table analyses and claim-to-activity correspondence with the project, keyed by source hash and reader version, instead of recomputing them on every start.
- Dashboard: reuse each module's result across restarts and releases, keyed by its own code fingerprint and input fingerprint, or compute only the modules the Dashboard depends on. This is a structural change to the calculation pipeline.
