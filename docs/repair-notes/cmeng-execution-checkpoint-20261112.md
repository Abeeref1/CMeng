# CMeng execution checkpoint, 12 Nov 2026

Branch `fix/owner-rules-20261109`.

## Deploy 1 (12 Nov, owner delegated: "you take care of every ting")

- cmeng-main moved from c485be39 (deployment 954cbc09, kept as the rollback point) to fd5be2cb (deployment f32cc3bc).
- A Railway volume backup cannot be created from this session (no backup tool in the Railway connector). Instead every
  project, its documents (id, content hash, type, superseded flag) and its review counts were recorded before the deploy
  and compared after it (`integrity.py`, `compare_integrity.py` in the session scratchpad): 20 projects, 337 documents,
  15 required decisions, identical before and after. Loss check PASS.
- CI on fd5be2cb: every CMeng Verify job green (regression, acceptance, concurrency, independent, raster) except
  Verify operations, which fails on the speed gate only.

## After-deploy audit (fd5be2cb live)

`audit.cjs` opened all 58 pages of all 20 projects plus Project Review: 1,180 checks, 0 failed, 0 script errors, no Data
Date conflicts, median 1.2 s, 90% within 1.8 s.

- Gone live: verdict label as a task word (193 pages before, 0 after); Project Review span codes (13 projects, 0 after);
  HSE rate base separators (2, 0 after).
- Still seen, root cause found and fixed in 88b6180a:
  - Release preparation saved 42 of 58 pages under their internal key ("near-critical") while the browser asks for the page
    key ("near-critical-and-float-risk", "accountability", "actions-required"). Saved results are keyed by exact route, so
    Accountability and Actions required were calculated again on first open: 15 to 25 s on large projects (28 pages).
    Fix: one `pageDataRoute()` in registry.ts used by the browser page loader and by release preparation
    (`projectPageRoutes`). Test `page-data-route-prepared` fails on the previous code; r17 now checks every browser route.
  - Delivery Control and Procurement S-Curves opened with only buttons (26 pages): the delivery renderer now names its
    position statement, chart and action table as the page answer (`data-page-answer`); a position statement ranks like
    the reading box. p3 tests 12 and 13.
  - Recovery tiles whose value says why ("Missing working-time basis") were not unknown tiles (4 pages). p3 test 14.
  - Project Review counts without separators ("5841 WBS candidates"): all counts in review text use `readableAmount`.
- CI on 88b6180a: 12 regression tests failed. They load the real browser page loader by function name and did not
  include the new shared route function. The route is now a function declaration in the browser script, the loader keeps
  its inputs (apiKeys, management keys), and the four harnesses load pageDataRoute with it (fixed in the next commit).
- Open: long dash as empty-cell placeholder (48 pages); repeated unknown sentence (11, mostly two rows with the same
  text); "Shortfall: Not established" inline on Resources (3); speed gate (four cold projects in 5 s).

## Next action

CI green on the follow-up commit (speed gate aside) → deploy it to cmeng-main with the same before/after data check → rerun
`audit.cjs` on all 20 projects → republish the "CMeng Page Audit" report.
