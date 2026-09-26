# Delivery calculation and evidence corrections

This change fixes shared rules and re-evaluates retained records. It does not edit a project's source quantities, source dates, evidence files or programme adoption decisions.

## Corrected behavior

- Spares retains signed remaining quantities and discloses excess quantities throughout the delivery, acceptance, storage and handover chain. Negative or nonnumeric quantities cannot be governed. Invalid retained values remain visible, with affected calculations withheld.
- HSE validates each injury count as a non-negative integer before aggregation. Invalid retained counts cannot offset valid incidents or establish a frequency rate.
- Material Tracking uses compatible BOQ units and full, unshared item scope for item-level installed measurements. Partial or shared allocations require a governed measured split; neither the table nor its curve invents that split or a proportional quantity.
- Review-duration counts and means use the same dated, nonnegative intervals, ending on or before the programme Data Date.
- A current requirement is distinct from a current completion. Raised dates establish population scope; individual approval, outcome, verification, acceptance and closure dates independently gate their events. Future requirements are excluded from current closure denominators. Unverified current completion prevents a definitive closure percentage.
- Handover acceptance and snag closure require an explicit Verified decision, current supporting evidence and a verification date on or before the Data Date. Typing dates into a Reviewed record cannot establish verified completion. The editor can attach evidence to an existing record.
- Mixed native/OCR PDF packets use page identities while protecting the document's matching identity from foreign relationship IDs. Changed record classification retains previous decisions and requires a fresh review. Explicit field mapping remains authoritative.
- Spares shows remaining quantities and discrepancy text in its main table. BOQ allocation controls show descriptions and units. Commissioning labels distinguish test pass rate from system acceptance.

## Independent new scenarios

The new fixtures use an April 2034 programme and inputs distinct from the original audit.

| Scenario | Expected calculation or protection |
|---|---|
| Seven injuries, 125,000 hours, basis 1,000,000 | 56; Arabic digits supported |
| Zero injuries in another project with identical references | 0, unchanged by invalid inputs in the first project |
| Negative, fractional, percentage or nonnumeric injury counts | New review rejected; retained invalid counts withhold total and rate |
| Spares 25 required, 30 delivered, 32 accepted, 35 stored, 38 handed over | Remaining -13, with nine excess checks |
| Equal quantities; fractional physical quantities; future handover | 0; 12.5 - 7.25 = 5.25; future quantity excluded |
| BOQ 80 + 120 kg, measured 30 + 45 kg | 200 required, 75 installed, 125 remaining, 37.5% |
| Partial/zero allocations, shared item, kg plus square metres | Installed table and curve withheld; no invented proportional split or mixed-unit sum |
| Review intervals 18 days and same day, alongside reversed/future responses | Two eligible reviews, mean 9 days |
| Dated handover/closure without Verified decision or receipt | Cannot report verified completion |
| Add evidence, verify, restart, supersede the source | Completion established only with current evidence; affected closure withdrawn; unrelated handover stays valid |
| Six-kind future-event matrix across two independent projects | Early raised date does not grant future completion, approval or test outcome; 1/2 current completed = 50% |
| Advance only one project's adopted programme | Its eligible completion becomes 100%; second project stays at 50% |
| Native and image-only mixed PDF packets | Submittal, spare and permit retain their own identities, physical pages and hashes |
| Reclassify previously reviewed PDF page | Prior decision retained, stale until re-reviewed |
| OCR connection reset, corrupt model and malformed queued image | Failure contained; subsequent valid recognition succeeds |
| Directory sync fails after snapshot replacement | 503 explicitly says save unconfirmed; register reflects disk state; retry and restart retain exactly one upload |

The pre-existing release gates also cover a 545,264,937-byte project snapshot, HTTP retry and restart, the 20,000-activity cold upload/dashboard target, and the 51,700-source-row Delivery target. These are bounded release checks, not claims of unlimited storage capacity.

## Release verification and limits

Browser review and release identity are recorded with the pull request. The source tests include positive cases, rejected new edits, retained legacy values, source lifecycle and cross-project checks. Passing these cases does not certify every real PDF, Arabic or low-quality scan. No live programme is adopted by this change. Per-project snapshots still rewrite a complete project snapshot; the bounded writer removes the former single-string ceiling but is not a database or capacity guarantee.
