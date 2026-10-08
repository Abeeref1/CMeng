# CMeng system-wide closure board

Review: `tests/fixtures/reem-112-review.json`, 62 pages, 266 findings. The historical 58-page internal registry gate remains in force; it does not replace the 62-page consultant walk (which includes project, document and drawer surfaces).

No root cause is closed by this implementation checkpoint. Completion requires shared behavior, all stored projects, 100 fresh blind projects, REEM known answers, and a live walk of the review surfaces. A new consultant finding reopens its affected root and page. Production promotion is not accepted with unresolved Critical or High findings.

| Root | Implemented in this checkpoint | Still requires closure evidence / further work |
|---|---|---|
| 1 Facts | Explicit current-fact consumer bindings, renderer-value mutation detection, Ask and management date/count wiring, missing-register handling | Complete equivalence inventory including actions, money and every displayed consumer; stored-project and blind gates |
| 2 Reading | Header-first delivery classification, old reference-file eligibility, visible column receipts, baseline activity correspondence | Native HSE table now parsed from retained reading; all original-file values still need live verification |
| 3 Evidence states | Clean delivery rows and dated procurement used immediately; completeness separate from row certification | Complete CPM calculations retained with qualifications; explicit unpaid zeros fixed. All field-level behavior still needs live verification |
| 4 Routes | Prominent one-click register-completeness action, exact unresolved record errors | All action items prefilled and field-level correction routes checked live |
| 5 PMC rules | P6 constraints in runtime CPM, completed work excluded from live float counts, source required-on-site fallback, plot/stage parsing, individual-item quantity populations, optional advance dependency | Shared programme checks, item curves, BOQ/WBS scope links and plot-crew sensitivities implemented; source-answer and live validation outstanding |
| 6 Priority | Source-record identity, duplicate merging, linked float/path/milestone ranking, retained register owners | Currency-aware monetary consequence implemented; named REEM blocker ordering still needs live verification |
| 7 Presentation | Plain register state, lazy paged float details, compact empty register, column receipt | Complete vocabulary audit, one-screen briefs and duplicate-navigation consolidation |
| 8 Platform | Empty delivery module HTTP 200; server-filtered activity pages and 50-row browser table | Browser view now excludes full activity rows and duplicate scope rows; empty module reads return HTTP 200. Other large tables and all empty-domain routes still need live validation |
| 9 Acceptance | Original review fixture, REEM expected values, adversarial visible-field test, retained 100-project equality suite | Exact-commit full regression, independent live 62-page answer walk and all-project evidence |

Test expectation changes are intentional: live float denominators exclude completed activities; the user-requested register label replaces “Awaiting review”. Fixture corrections add a missing WBS array, align controlled dates, read the canonical submitted-date header, and clone fetch responses before diagnostic reads. Test population sizes and deadlines are unchanged.

Additional tests assert retained REEM HSE table answers, ten independent mixed-security projects, explicit unpaid versus missing cash, constrained versus unconstrained forecast qualification, BEI/CPLI and screening populations, local plot-crew scenarios, distinct item curves and server register views. Full regression is in progress. No release closure is asserted.

## Live follow-up, 8 October 2026

The first browser walk covered all 62 review surfaces on release `93c383e356a85ab0dda1d98f1cc23e787a65ff14`. It reopened shared producers and consumers for completed-versus-open delay populations, full driving networks, procurement timing and actual milestones, permit validity, supplier identity, individual material measurements, formal risk populations, net certified receivables, current EVM comparisons, sectional milestones, resource coverage, recovery targets, and document receipts. The fixes apply to retained imports and future projects; no REEM-specific production branch was added.

Ask failed during that walk. Railway reported ENOSPC on its 2 GiB review volume. The derived read cache accumulated across releases without a size bound. This candidate clears disposable read caches at startup, bounds each project's cache, reserves storage for durable records, and cleans failed atomic summary writes. Source documents, project snapshots and saved Ask results are outside that cleanup.

The focused follow-up checks pass (90 tests). The prior full regression had 1,218 passes and nine failures: seven isolated-render helper/label assertions and two old expectations for receipts-only curves and unfinished-work populations. Those expectations now check the requested behavior, and all focused checks pass. The full regression, raster suite and fresh 100-project suite are running again. An expanded REEM answer key covers the live failures; exact-release all-project checks and a second 62-surface walk remain required. None of the nine roots is marked closed at this point.
