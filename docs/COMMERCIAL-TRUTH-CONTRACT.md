# CMeng Commercial Truth Contract

## Purpose

The Commercial workspace is a projection of one governed commercial model. Individual pages do not own independent contract, cost, payment, variation or cash facts.

The canonical flow is:

`source document/register -> extracted candidate -> governed fact/register -> deterministic calculation -> management projection -> report/export`

A page may reorder or summarize facts for a role lens, but it may not change their authority, unit, revision, reporting cutoff or missing-value state.

## Non-negotiable value states

- **established**: supported by source and correct authority.
- **missing**: no defensible value exists.
- **not_applicable**: the concept does not apply.
- **not_assessable**: the question is valid but required inputs are absent.
- **conflicted**: multiple defensible values remain unresolved.

Missing, not assessable and conflicted are never converted to zero.

## Authority layers

Commercial values keep the following layers distinct:

1. source-extracted candidate
2. provisional working position
3. deterministic CMeng calculation
4. governed/approved contract or register fact
5. certified amount
6. paid cash / receipt evidence
7. immutable closeout position

Examples:
- a payment certificate is not proof of cash receipt;
- a variation quotation is not approved contract-sum change;
- a claim assessment is not an Engineer determination;
- an amendment EOT already incorporated in contractual completion is not added again;
- source-reported EVM is not silently replaced by a calculated EVM formula.

## Currency contract

Every money value carries an ISO currency code and VAT basis where evidenced.

Arithmetic is permitted only when:
- all operands share one currency; or
- a governed FX rate, source and effective date explicitly convert them.

No cross-currency summation is permitted by default.

## Contract precedence

- The main contract remains effective for unamended terms.
- An amendment overrides only terms it explicitly changes.
- The latest effective amendment controls a term where multiple amendments alter the same term.
- Appendices and correspondence do not silently supersede contract terms.
- Engineer determinations govern the determinations they expressly decide; they do not rewrite unrelated contract terms.

## Core commercial lineage

### Contract / terms
`main contract -> amendment -> effective term -> obligation / LD / payment / notice / bond / insurance rule`

### Cost
`BOQ / control budget -> CBS -> commitment -> accrual / actual -> ETC -> EAC -> VAC`

### Payment
`application -> Engineer assessment -> certification -> deduction/recovery -> cash receipt`

### Variation
`instruction -> notification -> quotation -> assessment -> agreement -> approval -> certification -> amendment/payment linkage`

### Cash
`certified income + paid income + expenditure + forecast -> cash position / funding requirement`

## Required mappings

The system must expose completeness for:
- BOQ -> CBS
- payment -> CBS
- WBS -> CBS
- commitment -> CBS
- variation -> instruction / amendment / payment
- cost -> source period / CBS
- risk -> contingency/reserve where used

Unmapped populations remain visible and do not silently roll into "Other".

## Commercial modules

### Foundation
Commercial Terms; Contract Amendments; Cost Register; Payment Register (IPC); CBS Breakdown.

### Control
Cost Control; EVM Curves & Performance; Cash Flow Register; Cost S-Curve; Variations; Site Instructions; Contract Obligations; Liquidated Damages; Bonds & Insurance; Retention Calendar.

### Assurance
Final Account / Closeout; Earned Schedule; EVM by WBS; Risk Register; Monte Carlo Risk; Contract Risk; Tender Readiness.

### Governance
Commitment Tracking; Accruals; Contingency & Management Reserve; Escalation & Price Adjustment; VAT & Tax; Multi-Currency; Cost Audit Trail; Reconciliation Report; Cost Position.

A registered module may be **blocked** or **partial** when source evidence is absent. Registration does not authorize fabrication.

## EVM contract

Documented EVM and calculated EVM remain separate.

For a source snapshot:
- SPI check = EV / PV
- CPI check = EV / AC
- bottom-up EAC check = AC + ETC

A source EAC is not replaced merely because a formula yields another value. A variance is surfaced for governance.

A time-phased EVM curve, Earned Schedule and trend analysis require multiple governed dated snapshots. CMeng does not manufacture history from one point.

## Payment contract

Application, assessment, certification and receipt are separate event stages. Each stage has its own timestamp and authority.

Advance recovery, retention, tax, other deductions and net certified are distinct amounts.

Late-payment interest requires:
- due-date rule,
- trigger,
- rate,
- day-count basis,
- unpaid balance,
- claimed/assessed/awarded authority.

## Final account contract

Closeout can be frozen only when mandatory commercial contradictions are resolved and the required closeout conditions are established. Draft/review values never become immutable merely because a page was generated.

## Release certification

A release is blocked when any material module:
- contradicts the controlled source fixture;
- changes Data Date/revision identity;
- changes currency or VAT basis without governed conversion;
- treats missing as zero;
- loses authority/source receipts;
- produces a report/export that differs from the screen/module JSON;
- double-counts amendment/EOT/variation effects.

The ORBIT 120-question golden contract is the first permanent cross-module fixture. Additional blind fixtures must use materially different calendars, currencies, languages and evidence structures to prevent fixture-specific hardcoding.
