# Performance evidence correction, 25 September 2026

Deployment: `ce77ff5d-a3fc-4c9c-b18f-9b63025b13ba`.
Source commit: `1d251e63806a48a0d784cb6e7f80f3d603cc001b`.

The audit client measured roughly 12–20 seconds end to end. That measurement
must not be described as proven application/serving time. Matching Railway HTTP
logs report the following durations, in milliseconds. All listed responses were
HTTP 200. No observations in these groups were dropped.

| UTC time | Health duration, ms |
| --- | ---: |
| 18:57:28.596 | 2 |
| 18:59:04.594 | 1 |
| 18:59:42.058 | 1 |

| Project dashboard | Sequential group, ms | Concurrent group, ms |
| --- | ---: | ---: |
| DMM-HDC-P2 | 183 | 246 |
| KWT-TWR1 | 347 | 197 |
| ORBIT-JED-PLH-P3 | 228 | 259 |
| QA-CPS-2026 | 16 | 10 |
| QA-P1-WADI-20260924 | 23 | 17 |
| QAT-VLC1 | 36 | 44 |

Sequential requests were recorded at 18:57:40–18:58:52 UTC. The concurrent audit
group reached Railway in two clusters, at 18:59:16 and 18:59:29 UTC. Consequently
that client run is not evidence that all six requests reached the service at the
same instant.

Railway documents `totalDuration` in milliseconds:
https://docs.railway.com/cli/logs#http-logs

The two-hour metrics inspected during the investigation showed peak CPU about
0.42 vCPU and peak memory about 2.41 GB, against reported limits of 24 vCPU and
24 GB. These samples do not indicate saturation.

Conclusion: the earlier claim that even the health handler takes 12–20 seconds
is not supported by the matched serving logs. The discrepancy lies outside the
recorded Railway duration; its exact cause remains unestablished. Client request
queuing, network/proxy delay and browser rendering need separate timing evidence.
Do not change capacity or calculation algorithms on the basis of the audit
client's wall-clock figure alone. No infrastructure configuration is changed by
this patch.

The existing release-latency script remains a separate local single-user gate,
including startup, a 12,500-activity cold workload and a 20,000-activity upload.
Local gate results are not production or concurrent-load measurements.

## Patch validation

One local single-user release-gate run (all observations retained):

| Measurement | Milliseconds |
| --- | ---: |
| Startup preparation | 864.54 |
| Cold workflow, 12,500 activities across 3 revisions | 3837.11 |
| Upload response, 20,000 activities | 483.98 |
| Upload to calculated dashboard | 3272.13 |
| First dashboard after that upload | 2788.15 |

The gate's 5,000 ms thresholds passed. Peak sampled RSS was 788.01 MiB.
These are local results, separate from the production log timings above.

## CI failure and follow-up

The first PR verification run, `36184839552` on head `696a8c7`, passed all
640 correctness tests but failed the cold gate. Separate scale jobs passed.
The failed result is retained here; the 5,000 ms target is unchanged.

| Measurement | Initial GitHub runner, ms | Follow-up local run, ms |
| --- | ---: | ---: |
| Startup preparation | 796.96 | 921.73 |
| Cold workflow, 12,500 activities across 3 revisions | **5198.70** | 3349.15 |
| Upload response, 20,000 activities | 531.31 | 427.86 |
| Upload to calculated dashboard | 4607.33 | 2560.78 |
| First dashboard after that upload | 4076.02 | 2132.92 |
| Peak sampled RSS, MiB | 823.15 | 879.25 |

A separate local CPU-profile diagnostic run preceded the follow-up. Its cold,
upload-response, upload-to-ready and first-dashboard times were 3780.81,
445.87, 3254.09 and 2808.23 ms; startup was 933.55 ms and peak RSS 863.63 MiB.
Profiling was enabled, so this observation is diagnostic, not a clean benchmark.

The profile identified repeated schedule analytics and revision correspondence
work in the planning-page builders. The follow-up shares that analysis within
the same governed reporting view and project version. It also calculates history
progress directly with the existing progress function instead of calculating
unrelated graph and float metrics to obtain that same progress value. Module
results still undergo their own integrity and cross-module checks. A regression
test changes baseline authority and makes float unresolved after the first read,
then checks that both Activity Review and Schedule Analytics refresh correctly.

The local before/after observations are 3837.11 to 3349.15 ms for cold loading,
and 3272.13 to 2560.78 ms for upload-to-ready. These individual observations are
not a statistical performance guarantee. The GitHub runner must independently
pass the existing gate; local and CI timings must not be pooled.
