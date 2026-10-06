# BOQ source page review

Stage 1 remains open. Saved source review provides a bounded way to account for
scanned or otherwise unresolved PDF pages. It is not an OCR-accuracy claim,
contract-scope adoption, installed-work certification or stage acceptance.

## Fixed operation families

1. Add a source item at the chosen position.
2. Edit an item's description, identification, unit and figures. An extracted
   heading can be retained as non-item source text with an explanation.
3. Split or combine fragments on the same page. Re-enter figures from the
   source after either operation; do not infer an arithmetic allocation.
4. Confirm the entire source page against the retained original.
5. Reopen a saved confirmation, withdrawing its completeness while retaining
   its correction history and draft for another source check.

The original PDF is displayed beside the page items. Every physical PDF page
is offered, including a page with zero extracted items. Missing quantities stay
null. A page with no BOQ items needs a reason. Every original extracted item
must remain accounted for through a retained row, combined origin or explained
non-item. The five operation families above define this implementation's scope.

## Evidence and saved decisions

Decisions bind to project, ingestion, original SHA-256, revision, source page,
original item fingerprints and the review version. Stale or foreign-source
requests are rejected. Confirmation also verifies the retained source bytes.
Request identifiers make an identical retry safe. Failed durable writes restore
the previous saved state. Audit identity comes from the authenticated request
context; the input cannot choose its reviewer identity.

Original evidence and reader results remain unchanged. The effective BOQ is an
overlay reused by the existing source selector, quantity consumers, Ask and
reports. Reopening withdraws that page's overlay. Scope-changing corrections
receive new item identities so incompatible old quantity links cannot silently
carry across a split or merge. An unchanged one-to-one item may retain its ID.
A review does not change source adoption or contract authority.

## Separate populations and completion

- `automaticItemCount`: original reader population.
- `addedItemCount`: saved item rows with no original extracted origin.
- `reviewedItemCount`: item population on confirmed pages, including corrections.
- `coveragePercent`: original extractor metric, unchanged by review.
- `sourceReview.coveragePercent`: pages accounted for by original complete-page
  evidence or saved confirmations, with reopened pages explicitly pending.

Split/combined rows are represented by their original origins, rather than
being counted as newly discovered missing items. Reviewed page coverage can
reach 100 while a missing quantity keeps the effective BOQ incomplete. Partial
source population prevents a complete quantity-mapping claim, even if every
currently extracted row has an allocation. Known values remain available.

## Verification scope

Added checks exercise ten freshly generated source projects with deliberately
injected extraction faults, a completely missing page, explicit zero and negative
values, split/merge identity and order, invalid arithmetic, source/revision and
project isolation, stale/retried requests, reopen, durability failure/restart,
HTTP, deterministic Ask, JSON, Excel and original-byte preservation. UI checks
exercise the corresponding controls and failed-save drafts. A generated 50,000
item workload checks that page review retains all items and an empty page.

Generated fault-injection tests verify the workflow, not recognition accuracy.
Retained parser assertions and scan fixtures are unchanged. Exact-candidate
full CI, genuinely unused external sources and hosted browser evidence are
separate gates. Independent consultant acceptance follows internal completion
and is arranged by the user; no consultant sign-off is inferred from these tests.
