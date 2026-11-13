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

## Deployed: b5ace23c (deployment 7687315f)

Data check before and after (every document paged, not the first 25): 20 projects, 472 documents, saved decisions
identical. PASS. Rollback point: bd0fa164 (fc35588b).

Correction to the earlier report: on 13 Nov the first Finish run also started on DMM-HDC-P2 (the script stopped
waiting after 16 s; the server finished). One CSV became delay_eot_claims_register (AI validated); answers 14 to
13, gaps 6 to 7. Told to the owner.

## Estimate fix (df9b0122)

Live estimate for ORBIT on b5ace23c: 292 contract headings, 1 unique structure, 1 call. The 292 are one sentence
repeated through the PDF ("Clause 20.2.1 is amended so that the initial notice of claim shall be given within 21
days after the"). A heading is asked with its preceding section, and a validated heading becomes the next heading's
preceding section, so the reading asks that sentence at least twice. The plan answered "unresolved" and froze the
section, so it could count fewer calls than the reading makes (A, B, A: plan 2, reading 3).

- Planning model: a contract heading is answered by a validated stand-in whose identity depends on its text, so
  the plan moves the preceding section as the reading does. Stand-ins are never stored in the shared cache.
- Approval is the most the reading can cost (every pending part called alone); expected calls are a forecast and
  can be a few more when AI names the same heading differently under different sections (the first reading named
  clause 20.2.1 two ways) or when a reuse fails validation.
- Test 1d: planned calls equal the reading's calls (A,B,A; six identical headings: 2; two identical documents).

## Gateway log (fbd4af9e)

A failed project request (the 503) and a project process error are now logged with project, method, path and
error message, so the ORBIT 503 can be diagnosed if it recurs.

## fbd4af9e live and the ORBIT run (13 Nov, 13:25 UTC)

- CI on fbd4af9e: every job green except Verify operations (speed gate only). Deployed (pinned). Data check before
  and after: 20 projects, 472 documents, saved decisions identical. PASS. Rollback point: b5ace23c (7687315f).
- ORBIT estimate sent to the owner before the run: 292 parts, 2 unique structures, 2 calls after reuse, expected
  669/310 tokens, USD 0.0008; ceiling USD 0.02; worst case USD 2.65; month USD 0.06 of 20, USD 19.94 left.
- Run (approved against the worst case): HTTP 200 in 7.4 s, 1 paid call (ledger 51 to 52 calls, USD 0.0623 to
  0.0626). The answer under the preceding section matched that section, so the second planned question was a reuse.
  300 heading steps validated (8 earlier answers, 1 call, 291 reuses each checked against its own span).
  Pending parts now 0. Data check after the run: PASS, no other project changed.

## Next action

The other projects' Finish AI reading with the estimate first; DMCC-UPD2 defects; speed gate.
