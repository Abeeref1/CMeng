# CMeng Analysis Durability Contract

## Purpose

CMeng must not recompute a project's analytical modules merely because a user opens or revisits a page.

Parsing, mapping and analysis are versioned project operations. UI navigation is a read/watch operation.

This contract is a hard prerequisite for implementing PMO Analysis, Schedule Analytics, Activity Analytics, Resource Utilization, Look-Ahead, S-Curves, forecasting, claims and all other specialist modules.

## 1. Immutable analysis identity

A project analysis run is uniquely determined by:

- project ID
- evidence revision ID and evidence fingerprint
- mapping version
- parser version
- analysis engine version
- analysis-plan version
- project configuration fingerprint

If these inputs have not changed, the analysis run ID does not change.

Time elapsed, page navigation, browser refresh and repeated module opens are not analysis inputs.

## 2. Upload and full-analysis lifecycle

A completed upload creates or selects an immutable evidence revision.

Entering the project or opening PMO Analysis calls ensureProjectAnalysis for that evidence revision. This queues the full durable projection plan once.

The queue operation is idempotent. Calling it again with the same input fingerprint does not create a second run and does not duplicate projection jobs.

## 3. Durable projection plan

The default analysis plan materializes all current module projections, including:

- PMO Analysis
- Schedule Analytics
- Activity Analytics
- Resource Utilization
- Look-Ahead Schedule
- Progress Report
- Schedule Change Report
- Revision Trend
- Variance Trends
- Progress S-Curve
- Quantity Installed S-Curve
- Progress Breakdown
- Milestones
- Near-Critical Activities
- Man-Hour S-Curve
- Forecast History
- Independent Forecast
- Delay & Claims
- Notices, EOT & Claims
- Windows Analysis
- EOT Assessment
- Challenge the Contract

Each projection is keyed by the same analysis run and evidence revision.

## 4. Page-open rule

Opening a module never starts a new analysis merely because the page was opened.

A module read has only these user-facing states:

- preparing: first current-revision projection is still materializing
- updating: a new evidence revision exists and this projection is not ready yet
- ready: this projection is ready for the desired evidence revision
- retrying: the current projection is being retried after infrastructure failure

There is no normal unavailable state for a projection that is being prepared.

When a current-revision projection becomes ready, the watching page may display it immediately even if slower projections in the same full analysis run are still preparing.

The complete run also receives an atomic published pointer once all required projections are ready.

## 5. No stale-data contamination

Old projection artifacts are immutable and remain stored for revision history.

They are never returned as the current result for a newer desired evidence revision.

While a new projection is preparing, the read model may identify the previous published run for history/status purposes, but its artifact is not substituted as the new result and cannot feed the new analysis.

All calculation jobs are bound to a single immutable run ID and evidence revision ID.

## 6. Worker termination and bounded execution

CMeng assumes workers may be terminated around 37 seconds.

The default worker contract therefore uses:

- a 30-second lease
- a 20-second projection slice budget
- one bounded chunk per worker execution
- durable checkpoint commit before queue acknowledgement

Projection implementations must divide long calculations into deterministic, idempotent chunks.

If a worker disappears:

1. the lease expires
2. another worker reacquires the same durable job
3. the latest committed checkpoint is loaded
4. processing resumes from that checkpoint

If the worker dies before committing the current chunk, that chunk may be rerun. Chunks must therefore be idempotent.

## 7. Database outage during materialization

Projection payload durability must not depend on the primary analysis metadata database.

CMeng separates:

- analysis metadata
- immutable projection artifacts
- durable checkpoints
- durable job queue

A worker may continue to compute and checkpoint when the metadata DB endpoint is unavailable.

When a final projection artifact has been written successfully but metadata publication fails:

1. the immutable artifact is retained
2. the job changes to publish phase
3. the queue retries publication only
4. the projection calculation is not run again
5. the prior published analysis pointer remains untouched

Recovery writes must not depend on the same unavailable DB endpoint.

## 8. Two-phase projection publication

Projection completion occurs in this order:

1. compute bounded chunk
2. persist checkpoint
3. materialize final immutable artifact
4. verify artifact hash
5. attach artifact to projection metadata
6. expose current-revision projection as ready
7. atomically publish the whole run after all required projections are ready

A partial artifact cannot replace a ready projection.

A partially completed new run cannot replace the prior whole-run published pointer.

## 9. Calculation policy

CMeng must calculate anything that is directly or indirectly calculable from the available project model.

Manual approval is not a prerequisite for calculation.

Every value carries an origin:

- source
- deterministic_derived
- model_derived
- scenario_assumption

Derived values carry their formula or method, source references, confidence where applicable and assumptions.

The system may withhold a value only when indispensable inputs are genuinely unavailable or the computation is invalid. It must not block a calculable output merely because there is no separate approved value.

## 10. Version invalidation

A new run is required only when a material input changes, including:

- evidence revision/fingerprint
- mapping rules
- parser version
- analysis-engine version
- analysis-plan version
- project configuration that affects calculations

UI code, page navigation, elapsed time or repeated reads do not invalidate analysis.

## 11. Required acceptance tests

Before specialist modules are accepted, CMeng must prove:

- repeated project/module opens create zero extra analysis runs
- repeated reads create zero projection jobs
- a new evidence revision never returns an old artifact as its current result
- a ready projection becomes visible without waiting for unrelated slow projections
- the full-run published pointer changes only after all required projections are ready
- worker lease expiry allows another worker to resume
- durable checkpoints survive worker replacement
- metadata DB outage after artifact creation causes publish-only retry
- publish-only retry causes zero calculation calls
- old published data remains intact when a new run fails
- deterministic derived values are not blocked for manual approval
