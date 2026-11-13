# AI cost architecture, 13 Nov 2026

Owner brief: reduce duplicate AI work, never AI quality. Do not reduce quality, lower the 0.90 threshold,
downgrade the model, skip documents or raise the USD 20 cap. Branch `fix/ai-cost-architecture-20261113`.

## What was wrong

- The documents line quoted "parts x USD 0.0272": the per-call safety ceiling (48,000 input and 5,000 output
  tokens), not the cost. ORBIT showed USD 0.57 before its first run (21 documents, one call each assumed);
  after it, "292 parts, up to USD 7.94".
- The 292 parts are contract headings in one file (C02_Amendment_01_Searchable_50_Pages.pdf): the first run
  stopped at the 8-call per-file limit. The run made 19 paid calls (11 tables, 8 headings); upper bound USD 0.52.
- The second ORBIT call returned 503 "project could not finish its request" (gateway lost its worker 7 s after
  the first call finished). Server logs for that minute are empty; container memory peaked at 9 of 24 GB. Cause
  not established.

## Changes (shared, tested)

1. One call per unique structure (tables: normalized header row, asked columns with shape family, candidate
   type, reader version; contract headings: text and preceding section). Reuse only after the same validation
   against the sheet's own columns or the exact span. An identical structure AI could not validate is not asked again.
2. Shared validated cache `<AI usage dir>/semantic-cache`, keyed by fingerprint + reader version (prompt, answer
   schema, schema catalogue). Only validated answers; every reuse validated again.
3. Deterministic-first unchanged (only unconsumed columns are sent).
4. Rules-routed tables send only the routed schema (the only type validation accepts); otherwise the full catalogue.
5. `GET /api/projects/:id/evidence/ai-reading/estimate`: planning mode records every request as it would be sent.
   Parts, unique structures, calls after reuse, expected tokens and cost, ceiling for these calls, no-reuse worst
   case, month-to-date spend, remaining cap. The UI shows it; the paid run starts only on confirm and is refused
   (409) if the ceiling grew past the approved one.
6. Each call reserves its own ceiling (payload + full output allowance); released when the request never left the
   server, kept when it may have been sent with unknown usage.
7. The owner-approved Finish reads every pending part; the per-file limit still bounds automatic upload reading.

Tests: `tests/ai-cost-architecture.test.ts` (9), updated P4, M16.1, T03.

## Next action

CI green (speed gate aside) → deploy to cmeng-main with the data check → GET the ORBIT estimate and send the owner:
292 parts, unique structures, calls after reuse, expected cost, worst case, month spend → run only after that.
