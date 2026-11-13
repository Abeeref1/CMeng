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

## 13 Nov: d8e00cc1 live, audit and the next fixes

- d8e00cc1 deployed to cmeng-main (deployment 0da2fdc3). CI: every job green except Verify operations (speed gate only).
  Data check against the 12 Nov snapshot: 20 projects, 337 documents, saved decisions identical. PASS.
- Audit on d8e00cc1: 1,180 checks; label-as-task 0 (193 before), answer behind buttons 0 (26), Project Review codes 0,
  HSE separators 0, first open over 5 s 0 after a one-at-a-time recheck (the audit's own Chromium crashed twice with three
  pages open; 11 pages rechecked, slowest 4.4 s). Report republished.
- Found and fixed in the next commit:
  - The Activity Review table asks for its first page as the page opens; that request was never prepared (13 to 20 s on
    first open of ORBIT and DMM-HDC-P2). `activityRegisterParams`/`activityRegisterRoute` are shared by the browser and
    `pageOpenRoutes`, which release preparation saves. Test runs the real browser loader and checks the request is prepared.
  - Recovery & Acceleration on 4 projects opened with unknown lines: its position statement now leads
    (`data-page-answer="position"`), and an unknown driving chain is stated once (no "Of these, Not established have").
- Local: J8 blind acceptance 9/9, r17, p3 15/15, planning-ui-evidence, recovery tests, ui-management-experience pass.

## 13 Nov: fc35588b live (current)

- CI on fc35588b: every job green except Verify operations (speed gate only). Data check before and after the deploy:
  20 projects, 337 documents, saved decisions identical. PASS. Rollback point: deployment 0da2fdc3 (d8e00cc1).
- Activity Review table first open: 0.2 s on ORBIT, DMM-HDC-P2, ABB-100 (was 13 to 20 s).
- Audit on fc35588b (concurrency 2): 1,180 checks, 0 failed, no Data Date conflicts, median 1.0 s, 90% within 1.25 s.
  Label as task 0 (193 before), answer behind buttons 0 (26), unknown tiles leading 0 (39), Project Review codes 0 (13),
  HSE separators 0. One page over 5 s once (RAK-PORT-P4 Locations 6.6 s; 0.9 s when opened again). Report republished.
- Also in fc35588b: a block whose tiles were all stated once as an unknown line counts as unknown-only (p3 test 15).

## Open

- Speed gate (four cold projects in 5 s): fails in CI; needs its own workstream.
- Long dash as empty-cell placeholder (48 pages); same unknown sentence twice on 11 pages (mostly two rows with the same
  text); "What this page shows: Not yet established" leads Resources on 3 projects with no resource data.

## Next action

Owner review of the live pages. Speed gate workstream next.
