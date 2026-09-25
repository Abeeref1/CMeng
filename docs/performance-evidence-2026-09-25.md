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
