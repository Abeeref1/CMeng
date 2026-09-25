# Aggregate completeness review

Reviewed against `1d251e63806a48a0d784cb6e7f80f3d603cc001b` on 25 September 2026.

## Evidence and history correction

The Activity Review defect exists in the baseline: filtering for `near_critical`
or `floatRiskWatchlist === true` silently drops unresolved rows from headline
counts. This is an aggregate-completeness defect, not merely a missing label.

The supplied history attribution was incorrect. With the full Git history:

- `9563dd4` merges PR #123 about verdict populations. It did not introduce these counts.
- `3a1425f` introduced the Activity Review near-critical count.
- `b5e99f2` added the separate float-risk count.
- `c627f30` added the unknown and noncritical classification buckets.
- `e3321a8` changed these counts to the execution-activity population.
- The current counting expressions still lacked a completeness guard. Later label
  improvements did not establish complete aggregate semantics.

Reproduce this history with `git log -L` on the Activity Review near/float-risk
declarations in `packages/runtime-api/src/ui.ts`. A shallow clone is insufficient
to establish when a line originated.

## Counting contract

`aggregateCount` takes a predicate returning true, false or unresolved. It retains
the known matching count and unresolved-member count separately. Its headline
value is null whenever a member cannot be assessed. A known empty population or
a completely assessed population with no matches legitimately has count zero.
An absent population has no established count.

`completeSum` withholds a total if any contributing observation is unavailable or
no observations exist. Measured zero is retained. A known subtotal must be labelled
as a subtotal, with the missing population disclosed; it is not a complete total.

## Targeted sweep

Run `npm run audit:counts` for the AST inventory of direct `.filter(...).length`
expressions, including multiline TypeScript and the generated browser script.
Also inspect aliases such as `const known = rows.filter(...); known.length`,
reducers, guards and the display population. The inventory itself does not prove
that an expression is defective or safe.

| Family | Disposition |
| --- | --- |
| Activity near-critical, float-risk and late-count KPIs | Complete totals withheld; API carries known/unresolved population counts; renderer preserves them. |
| Shared near-critical, WBS and comparison calculations | Missing float as well as unresolved thresholds withhold totals. Known classified rows remain accessible. |
| Milestone float and due-date counts | Nullable aggregates; missing dates, float or open/completed status cannot become zero. Renderer respects producer nulls. |
| BOQ and manpower populations | No BOQ population means unresolved item/unmapped/calculation counts. Known source rows and measured zero quantities remain visible. |
| Window movement totals and delay/EOT consumers | Missing windows no longer contribute invented zeroes; incomplete totals and derived differences remain null. |
| Weekly resource exception counts | Missing demand, usage or capacity withholds the period count. |
| Parser coverage, known source classifications, explicit unknown buckets | Retain counts of observed records. These measure parsing/classification outcomes, not an unmeasured business total. |
| Operational dated counts, bond expiry and retention-overdue gates | Retain existing completeness guards and explicit coverage/source scopes. |
| Resource comparison denominators and known-subset checks | Retain explicitly comparable resource-week populations; they do not certify all missing periods. |
| Graph records, revision changes, diagnostics and issue counts | Retain known collection sizes and control counters. |

Do not replace every zero, false or filtered count mechanically. For each public
aggregate, establish its population, predicate completeness, unknown bucket and
display basis. New aggregate tests must include: complete zero, complete positive,
all unknown, mixed known/unknown and absent versus known-empty populations.

## Other reproduced corrections

- BOQ pointer validation examines all linked documents, including reclassified
  and superseded records. A candidate pointer cannot displace an active BOQ.
- Commercial adjusted completion requires calendar-day EOT basis before using
  calendar arithmetic, matching the existing EOT assessment rule.
- Readiness and issue assessment share comparison applicability.
- Register-date issues affect declared dependent modules; project-wide source
  review retains the complete diagnostic set.
- Trend and named chart pages put their result ahead of supporting source detail;
  financial claims lead with currency exposure; security counts are prominent.

The regression suite exercises the predicates and actual generated renderers.
Layout ordering tests are not a claim that the edited build has been deployed or
that a production screenshot of it has been taken.
