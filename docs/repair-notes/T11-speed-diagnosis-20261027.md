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

## 27 Oct evening: start-up speed-up, candidate 7203382f (not deployed)

Production stays on 84489879. The 5 s gates are still not met, so this candidate was not deployed.

### Changes (results unchanged)

1. Reading a save. A save larger than 32 MB is read into one buffer, split at value boundaries, and each bounded value is decoded by the native JSON parser. Before, a token-by-token reader decoded the whole file. Saves larger than 384 MB still use the old reader.
2. Change fingerprint and save. Each value below the top levels goes to the native serializer, falling back to the old encoder when a value is too long. The fingerprint calls its per-key filter only for values whose text contains a migration receipt code.
3. Start-up refreshes. The two refreshes that run at every project start fingerprint the project at their first change point, not up front. When nothing changes, which is the usual case, the whole project is no longer encoded twice more.

Checks:

- Three real saves were compared: ABB 191 MB, 180 MB and 90 MB. Parsed values are deep-equal to the old reader's, the fingerprint hash is equal, and the saved file is byte-identical.
- The 545 MB durability gate (upload, retry and restart) passes.
- Full regression passes (19 jobs).

### Measured

ABB on a local copy of the real sources (2-CPU machine). Each run starts a fresh server with no stored page reads, then opens the first Overview, then the first Dashboard. Two runs per build:

| | 84489879 | 7203382f |
| --- | --- | --- |
| Restore of the 191 MB save (in process) | 16.1 to 17.8 s | 9.8 to 10.5 s |
| First Overview | 32.8 / 33.0 s | 14.5 / 15.4 s |
| First Dashboard (after Overview) | 22.3 / 21.8 s | 22.0 / 23.2 s |
| Dashboard calculation alone (in process, 4 runs) | 21.0 to 24.5 s | 22.3 to 23.4 s |

The fingerprint takes 3.65 s on 84489879 and 1.56 s on the candidate, with the same hash.

Four large projects at once (`scripts/release-latency.cjs` on GitHub). Each job ran both builds alternately on the same runner, three times each. Slowest project, in ms:

| Runner | 84489879 | 7203382f |
| --- | --- | --- |
| Job 1 | 9,592 / 9,468 / 9,578 | 8,353 / 8,290 / 8,483 |
| Job 2 | 7,106 / 6,275 / 6,310 | 6,442 / 5,489 / 5,529 |
| Job 3 | 9,838 / 9,948 / 9,952 | 8,550 / 8,533 / 8,512 |

That is workflow run 40570749321. An earlier run on other runners (40565741465) gave 5.84 to 9.76 s for 84489879 and 5.26 to 8.61 s for the first candidate step.

The gain is in loading each project. The calculation itself is unchanged: 4.0 to 7.3 s per project under four-way load, depending on the runner. A 96 MB young generation for project workers was also measured. It was 8 to 10 % faster on this machine but showed no gain on GitHub runners, so it is not in the candidate.

### Why 5 s is still not met

1. ABB first Overview (about 15 s locally). The project must still load before the Overview can be served:
   - module load, about 1 s;
   - restore, about 10 s: reading 2.9 s, change fingerprint 1.6 s, time-claim synchronisation 2.4 s, table analysis 2.1 s, plus garbage collection;
   - document register, 0.7 s;
   - the Overview itself, 1.9 s.
2. ABB Dashboard calculation (about 22 s locally; 15.1 s measured on Railway on 84489879; unchanged). The CPU profile is flat: about 30 functions of 0.5 to 3 s each, and garbage collection is 16 %. No single fix removes a large share.
3. Four-project gate. Each project needs about 25 to 40 % less calculation CPU, depending on the runner.

### Remaining work (not started)

- Keep table analyses and claim-to-activity correspondence with the project, keyed by source hash and reader version, instead of recomputing them at every start. Compute the restore fingerprint only when a migration actually changes data.
- Dashboard: reuse each module's result across restarts and releases, keyed by its own code fingerprint and input fingerprint, or compute only the modules the Dashboard depends on. This is a structural change to the calculation pipeline and is needed for both the ABB Dashboard and the four-project gate.
