# CMeng Delivery
## Construction Delivery, Procurement, Assurance, Commissioning & Handover

### STATUS OF THIS SPECIFICATION

This document defines **new CMeng functionality to be implemented**.

It does NOT describe functionality that already exists.

Nothing in this document may be treated as completed, production-ready, tested or available merely because it appears in this specification.

Every capability described below requires:

- a real backend producer;
- a governed data model;
- deterministic calculation logic where calculation is required;
- a project-scoped API/read model;
- a functional user interface;
- evidence/source traceability;
- export where specified;
- unit and integration tests;
- real multi-project testing;
- human page-by-page verification;
- live-production verification.

A route, page shell, placeholder, API stub, test fixture or green automated test does not prove implementation.

---

# 0. PURPOSE AND SYSTEM BOUNDARY

CMeng already controls Schedule/Planning, Progress/Resources, Forecast/Finish, Delay/Claims and Commercial.

This new Delivery area extends CMeng through the construction execution chain:

**BOQ / scope requirement**

→ Design

→ Technical approvals

→ Procurement

→ Material/equipment supply

→ Workfront readiness

→ Construction

→ Inspection and quality

→ Testing and commissioning

→ Closeout

→ Handover

The Delivery area shall use existing CMeng authorities rather than creating competing calculations.

CMeng remains a **construction project controls and delivery intelligence platform**.

It shall NOT become an operational FM, CAFM or CMMS platform.

The functional boundary is controlled construction handover.

---

# 1. NON-NEGOTIABLE CMENG AUTHORITY MODEL

Before implementing any Delivery module, the agent shall preserve the following authority rules.

## 1.1 BOQ authority

The current controlled CMeng BOQ remains authoritative for:

- scope;
- item quantities;
- units;
- rates;
- amounts;
- BOQ sections;
- BOQ revisions;
- commercial quantity basis.

Delivery may classify, map, reconcile and analyse the BOQ.

Delivery must not create a second independent BOQ database.

---

## 1.2 Schedule authority

The existing controlled CMeng programme remains authoritative for:

- Data Date;
- activity dates;
- WBS;
- milestones;
- calendars;
- float;
- baseline comparison;
- current programme dates;
- forecast dates;
- near-critical/critical position.

Delivery must consume these values.

It must not calculate its own competing programme dates or float.

---

## 1.3 Progress authority

Existing CMeng Progress and Installed Quantities remain authoritative for:

- physical progress where established;
- installed quantities;
- planned progress;
- current progress;
- quantity history;
- progress basis.

Delivery may reconcile procurement, delivery and installation against those positions.

It must not create a second progress engine.

---

## 1.4 Commercial authority

Existing CMeng Commercial remains authoritative for:

- contract values;
- cost;
- budget;
- EVM;
- PV;
- EV;
- AC;
- SPI;
- CPI;
- payments;
- variations;
- claims;
- cash flow;
- bonds.

Delivery may use commercial values for weighting and exposure.

It must not create a competing commercial calculation.

---

## 1.5 Claims and entitlement authority

Existing CMeng Delay / Notices / EOT / Claims remains authoritative for:

- delay analysis;
- notices;
- causation;
- EOT;
- contractual entitlement.

Delivery can identify a potential delivery consequence.

Delivery must never convert that automatically into delay entitlement.

---

# 2. DELIVERY DATA STATES

All Delivery modules shall maintain explicit distinction between:

1. **Source Evidence**
2. **Extracted Candidate**
3. **Working Record**
4. **Governed Record**
5. **Verified / Approved Record**
6. **Calculated Position**
7. **Scenario / Assumption**
8. **Conflicting Evidence**
9. **Stale Evidence**
10. **Not Established**

These are not interchangeable.

### Mandatory rules

Candidate ≠ official.

Linked ≠ approved.

Extracted ≠ verified.

Calculated ≠ contractual.

Forecast ≠ actual.

Delivered ≠ accepted.

Accepted ≠ installed.

Installed ≠ certified.

Rectified ≠ closed.

Complete ≠ accepted.

Missing ≠ zero.

---

# 3. DELIVERY CONTROL

## Purpose

Provide the senior construction-management view of whether each major work package can progress from scope requirement through construction and handover.

It is an orchestration and exception-control page, not another source database.

## Delivery package chain

A package may link across:

1. BOQ / scope requirement
2. Discipline
3. Work package
4. WBS
5. Location / zone
6. Programme activity
7. Design requirement
8. RFI / technical query
9. Shop drawing
10. Material/technical submittal
11. Approval / IFC
12. Permit
13. Procurement requirement
14. RFQ / tender
15. Technical evaluation
16. Commercial evaluation
17. Recommendation / award
18. Purchase order
19. Manufacturing
20. FAT where applicable
21. Shipping/logistics/customs where applicable
22. Delivery
23. MIR / acceptance
24. Workfront release
25. Installation
26. WIR / inspection
27. NCR / rectification where applicable
28. Testing
29. Commissioning
30. Snag / punch list
31. As-built
32. O&M documentation
33. Training
34. Spares/special tools
35. Asset/system handover
36. Taking-over/handover acceptance

Not every package uses every stage.

The applicable chain must be determined by package type.

---

# 4. PACKAGE LIFECYCLE TEMPLATES

Do not force one generic procurement/construction workflow onto every scope item.

CMeng shall support governed lifecycle templates.

Examples:

## Bulk local material

Requirement  
→ Approval  
→ PO  
→ Delivery  
→ MIR  
→ Released  
→ Installation

## Imported long-lead equipment

Requirement  
→ Technical Submittal  
→ Approval  
→ Tender  
→ Award  
→ PO  
→ Manufacturing  
→ FAT  
→ Shipping  
→ Customs  
→ Delivery  
→ Installation  
→ SAT/T&C

## Specialist subcontract

Scope  
→ Tender  
→ Technical Evaluation  
→ Commercial Evaluation  
→ Recommendation  
→ Award  
→ Mobilisation  
→ Execution  
→ Inspection  
→ Testing/Handover

## Architectural finish

Requirement  
→ Sample  
→ Mock-up where required  
→ Approval  
→ PO  
→ Manufacture  
→ Delivery  
→ Installation  
→ Inspection

The system must not create fake milestones simply because a generic template contains them.

---

# 5. BOQ DELIVERY INTELLIGENCE

This closes a major gap.

Delivery Control shall use the existing BOQ to establish the **scope denominator** against which programme, procurement and construction are cross-checked.

## Show

- Total active BOQ items
- Total BOQ value
- Value by discipline
- Value by major work package
- Value by location where available
- Top 20 BOQ cost drivers
- Top BOQ packages by value
- High-value specialist packages
- Quantity populations by compatible unit
- BOQ mapped to programme
- BOQ mapped to procurement
- BOQ mapped to work packages
- BOQ mapped to locations
- BOQ mapped to quantity tracking
- Unmapped BOQ scope
- Unmapped BOQ value

## BOQ cross-check exceptions

CMeng shall identify:

- BOQ scope with no programme representation where one should exist;
- BOQ scope requiring procurement with no procurement package;
- procurement package without identified scope basis;
- BOQ quantity and procurement requirement mismatch;
- procurement quantity lower than required quantity;
- ordered quantity materially above controlled requirement;
- delivered quantity above ordered quantity;
- accepted quantity above delivered quantity;
- installed quantity above delivered/accepted quantity where applicable;
- installed quantity above controlled BOQ quantity;
- conflicting BOQ-to-WBS mapping;
- conflicting BOQ-to-location mapping;
- high-value BOQ scope without accountable work package;
- high-value scope with no procurement or construction status.

These are reconciliation findings.

They are not automatic declarations that one source is wrong.

---

# 6. PROCUREMENT & MATERIAL REGISTER

## Purpose

Control procurement from requirement through installation readiness.

## Core identity

Each procurement record shall support:

- Procurement/package ID
- Item/package name
- Description
- Discipline
- Work package
- BOQ item references
- WBS
- Location
- Supplier
- Subcontractor
- Responsible owner
- Procurement type
- Lifecycle template
- Currency
- Package value
- BOQ value
- Linked programme activity/activity set
- Required-on-site date
- Programme need date
- Current stage
- Evidence state

---

# 7. PROCUREMENT LIFECYCLE

Track separate dates/states for:

- Requirement identified
- RFQ planned
- RFQ issued
- Bid return
- Technical evaluation
- Commercial evaluation
- Recommendation
- Award
- PO
- Technical submittal
- Approval
- Manufacturing start
- Manufacturing progress
- FAT planned
- FAT actual
- Ex-works
- Shipping
- Customs
- Site delivery
- MIR/acceptance
- Released to workfront
- Installation

For every relevant milestone retain separately:

- planned date;
- forecast date;
- actual date.

Never overwrite one with another.

Never use a forecast date as an actual date.

---

# 8. MATERIAL QUANTITY TRACKING

Procurement shall contain a dedicated Material Tracking view.

It must consume the existing CMeng BOQ and Installed Quantities authorities.

## Track

| Measure | Authority |
|---|---|
| Required Quantity | BOQ / approved revised scope |
| Ordered Quantity | PO/procurement evidence |
| Manufactured Quantity | supplier/manufacturing evidence |
| Shipped Quantity | shipping/logistics evidence |
| Delivered Quantity | GRN/delivery evidence |
| Accepted Quantity | MIR/inspection evidence |
| Released Quantity | site/workfront evidence |
| Installed Quantity | existing CMeng Installed Quantities |
| Remaining to Order | calculated |
| Remaining to Deliver | calculated |
| Remaining to Install | calculated |

## Separate percentages

### Procurement Coverage

Ordered ÷ Required

### Manufacturing Coverage

Manufactured ÷ Required

### Delivery Coverage

Delivered ÷ Required

### Acceptance Coverage

Accepted ÷ Required

### Installation Completion

Installed ÷ Required

These must remain separate.

Do NOT create one ambiguous overall material percentage.

---

# 9. LONG-LEAD INTELLIGENCE

Long-lead analysis shall be a real calculation, not only a Yes/No field.

## Candidate identification

CMeng may identify candidate long-lead packages from BOQ descriptions and procurement information.

Examples may include:

- elevators;
- façade;
- switchgear;
- transformers;
- generators;
- chillers;
- AHUs;
- FCUs;
- specialist pumps;
- BMS;
- fire alarm;
- specialist equipment;
- structural steel;
- stone;
- specialist architectural finishes.

Candidate classification is not confirmation.

## Lead-time components

Where available:

- design duration;
- technical submittal duration;
- approval duration;
- RFQ period;
- tender period;
- technical evaluation;
- commercial evaluation;
- award period;
- manufacturing;
- FAT;
- shipping;
- customs;
- transport;
- site acceptance;
- pre-installation period.

Each component shall disclose its basis:

- contract;
- supplier;
- approved procurement plan;
- historical/benchmark assumption;
- controlled user assumption;
- not established.

---

# 10. LONG-LEAD BACKWARD SCHEDULING

Using the existing controlled programme need date, CMeng shall calculate where supported:

Required-on-site

minus site preparation

minus delivery/logistics

minus customs

minus shipping

minus FAT

minus manufacturing

minus approval

minus tender/evaluation

=

latest procurement actions.

Show:

- Latest RFQ date
- Latest tender-return date
- Latest technical evaluation date
- Latest award date
- Latest PO date
- Current stage
- Forecast delivery
- Required-on-site
- Days ahead/behind requirement
- Procurement headroom
- Programme float where relevant
- Risk position

Where any required duration is not established:

**Latest order date not established**

Do not invent a date.

---

# 11. PROCUREMENT S-CURVES AND TRENDS

The original record-count Procurement S-Curve must not be presented as procurement progress.

The new page shall contain distinct views.

## 11.1 Procurement Activity / Throughput Trend

Count-based.

Show cumulative:

- RFQs
- tender returns
- awards
- POs
- deliveries
- submittals
- approvals

Label clearly:

**Activity / Throughput**

Do not label:

**Procurement Progress**

unless an appropriate weighting basis is established.

---

## 11.2 Procurement Value S-Curve

Where value basis exists, show cumulative:

- planned commitment value;
- actual committed value;
- forecast committed value.

Optional where valid:

- delivered value;
- accepted value.

Do not combine currencies without an approved/common conversion basis.

---

## 11.3 Weighted Procurement Progress S-Curve

Provide weighted package progress only when:

- package denominator is known;
- package weighting basis is known;
- lifecycle stage weighting is governed;
- sufficient package coverage exists.

Possible weighting basis:

1. controlled package value;
2. approved procurement budget;
3. controlled management package weighting;
4. homogeneous quantity weighting.

Each package lifecycle may have different stage weights.

Do not use one arbitrary lifecycle weighting for:

- chillers;
- concrete;
- façade;
- loose furniture;
- structural steel;
- local materials;
- subcontract packages.

The page must disclose:

- weighting basis;
- lifecycle template;
- number/value of packages included;
- packages excluded;
- coverage %;
- unresolved weighting.

If the denominator or weighting basis is inadequate:

**Weighted procurement progress not established.**

---

# 12. MATERIAL QUANTITY S-CURVES

Where compatible quantities exist, provide cumulative curves for:

- Required
- Ordered
- Manufactured
- Delivered
- Accepted
- Installed

Do not sum unlike units.

Never produce:

m + m² + m³ + tonnes + No. = total quantity.

Separate curves by:

- unit;
- discipline;
- package;
- material class;
- location where appropriate.

---

# 13. SUBMITTAL S-CURVES

Separate from procurement progress.

Show count-based:

- Planned submissions
- Actual submissions
- Reviewed
- Approved
- Rejected
- Resubmission required

This is a design/approval throughput curve.

It is not physical construction progress.

---

# 14. SUPPLIERS & SUBCONTRACTORS

Track:

- supplier/subcontractor ID;
- company;
- package;
- scope;
- BOQ scope;
- package value;
- currency;
- mobilisation;
- procurement status;
- physical progress;
- programme position;
- commercial position;
- quality;
- HSE;
- risk;
- responsible contacts;
- required dates;
- forecast dates;
- evidence completeness;
- current performance position.

## Mandatory relationship rule

Do not repeat the PMOSys text-link problem.

Supplier/subcontractor ↔ procurement package relationships must use stable governed IDs.

Text matching alone is not an authoritative relationship.

---

# 15. RFI, DESIGN & SUBMITTALS

## Control

- RFI
- design deliverable
- technical query
- shop drawing
- material submittal
- sample
- mock-up
- revision
- IFC status

## Track

- reference;
- discipline;
- package;
- location;
- responsible party;
- submission date;
- required response date;
- response date;
- approval date;
- revision;
- superseded/current status;
- linked BOQ;
- linked programme activity;
- linked procurement package;
- linked variation/claim;
- potential time exposure;
- potential commercial exposure;
- evidence state.

## Management analysis

- total required;
- due;
- submitted;
- approved/IFC;
- rejected;
- resubmission;
- overdue;
- average review period;
- repeated review cycles;
- design blocking procurement;
- design blocking workfront;
- design affecting critical/near-critical activities.

Current revision must be governed.

Do not infer that the last uploaded revision is automatically the current approved revision.

---

# 16. CONSTRUCTION WORKFRONT CONTROL

Add a construction-facing view so CMeng covers the management need behind the friend's construction-tracking matrix.

Do not create another progress calculation.

Consume existing CMeng progress.

## Discipline matrix

Show, where supported:

| Discipline | Planned | Actual | Variance | Readiness | Main Blocker | Status |
|---|---:|---:|---:|---|---|---|

Disciplines may include:

- Substructure
- Superstructure
- Façade
- Architectural
- Mechanical
- Electrical
- Plumbing
- Fire Fighting
- ELV
- External Works
- Infrastructure

Project-specific discipline structures must also be supported.

---

# 17. LOCATION / FLOOR / ZONE TRACKING

Do not hard-code a tower-only solution.

Use a generic location hierarchy:

Project

→ Area

→ Building

→ Zone

→ Level / Floor / Section / Chainage

→ Workfront

→ Discipline

→ Work package/activity.

For towers, CMeng may render:

| Floor | Structure | Blockwork | MEP 1st Fix | Plaster | Ceiling | MEP 2nd Fix | Testing | Completion |
|---|---:|---:|---:|---:|---:|---:|---:|---:|

For infrastructure it may instead render:

Zone / Section / Chainage / Utility / Workfront.

The view must be derived from governed mappings.

No project-specific hardcoding.

---

# 18. CONSTRUCTION READINESS

Use CMeng's existing readiness philosophy.

Potential applicable gates include:

- predecessor complete;
- IFC/design available;
- RFI resolved;
- material available;
- material accepted;
- permit available;
- access available;
- workfront released;
- resources available;
- plant/equipment available;
- quality prerequisite complete;
- HSE prerequisite complete;
- commercial constraint resolved.

For each activity/workfront show:

- Ready
- At Risk
- Blocked
- Unknown

## Construction Readiness Index

Only calculate when the applicable denominator is established.

Numerator:

confirmed satisfied applicable gates.

Denominator:

all applicable confirmed gates.

Never use a universal denominator if some gates do not apply.

Missing evidence does not equal failed.

Unknown does not equal zero.

---

# 19. PROCUREMENT READINESS

Applicable package gates may include:

- scope established;
- technical specification available;
- supplier strategy;
- RFQ complete;
- technical evaluation;
- commercial evaluation;
- award;
- PO;
- technical approval;
- manufacturing on plan;
- FAT where required;
- logistics protected;
- delivery forecast before need date;
- quantity coverage adequate.

Show by:

- project;
- package;
- discipline;
- supplier;
- long-lead class.

Again:

unknown ≠ failed.

non-applicable ≠ failed.

---

# 20. QUALITY & INSPECTION

Construction-stage Quality shall include:

- NCRs;
- WIR;
- MIR;
- inspections;
- ITP/test points where provided;
- test packs;
- snagging;
- punch lists;
- defects;
- audits;
- rework.

Track:

- record ID;
- type;
- description;
- location;
- discipline;
- package;
- contractor;
- responsible party;
- severity;
- raised date;
- due date;
- rectified date;
- verification date;
- closed date;
- root cause;
- corrective action;
- preventive action;
- linked programme activity;
- linked BOQ/work package;
- linked procurement/material;
- rework hours;
- rework cost;
- programme consequence;
- handover blocker;
- evidence.

## Metrics

Only where denominator/evidence exists:

- open NCRs;
- overdue NCRs;
- closure rate;
- inspection pass rate;
- MIR acceptance rate;
- rework;
- blocking snags;
- defects by location;
- defects by discipline;
- defects by contractor;
- handover blockers.

Inspection pass rate must exclude records without a known accepted/rejected outcome.

---

# 21. PERMITS & AUTHORITIES

Construction-stage only.

Track:

- permit ID;
- permit type;
- authority;
- responsible owner;
- submission;
- review;
- issue;
- validity;
- expiry where relevant;
- renewal required before handover;
- location;
- activity;
- workfront;
- required-by date;
- float/headroom;
- evidence;
- current status;
- blocker status.

A text value saying "approved" is not sufficient where governed approval/evidence is required.

---

# 22. HSE — CONSTRUCTION STAGE ONLY

Include:

- incidents;
- near misses;
- construction inspections;
- audits;
- training;
- competency;
- PTW;
- toolbox talks;
- emergency drills;
- manhours/exposure;
- corrective actions;
- programme/cost consequences.

Rates require proper denominators.

Do not show a zero frequency/rate because manhours were not provided.

Direct source facts remain visible even when a derived performance rate cannot be calculated.

---

# 23. TESTING & COMMISSIONING

Add this explicitly rather than leaving commissioning as only a stage name.

Control:

- systems;
- subsystems;
- test packs;
- pre-commissioning;
- commissioning;
- integrated testing;
- SAT where applicable;
- authority testing;
- failed tests;
- retests;
- dependencies;
- punch items;
- responsible party;
- planned date;
- forecast date;
- actual date;
- linked activities;
- linked assets;
- linked handover requirements;
- evidence.

Provide:

- systems requiring T&C;
- started;
- passed;
- failed;
- retest required;
- commissioned;
- blocked;
- evidence completeness;
- commissioning readiness.

---

# 24. ASSET & SYSTEM HANDOVER

Replace the proposed **FM Asset Register** with:

## Asset & System Handover Register

This is construction-to-handover only.

Track:

- asset/system tag;
- asset/system name;
- category;
- criticality;
- manufacturer;
- make/model;
- serial number;
- location;
- BOQ relationship;
- procurement relationship;
- installation activity;
- installation date;
- inspection acceptance;
- commissioning;
- T&C evidence;
- O&M manual;
- as-built;
- warranty;
- training;
- spare parts;
- special tools;
- snag position;
- handover status;
- taking-over date.

### Explicitly excluded

Do not implement:

- PPM scheduling;
- next maintenance;
- last maintenance;
- preventive maintenance;
- reactive maintenance;
- operational work orders;
- CAFM;
- FM helpdesk;
- operational SLA management.

---

# 25. SNAG, PUNCH LIST & CLOSEOUT

Do not implement the proposed standalone operational DLP module.

Instead implement construction closeout:

- snags;
- punch list;
- incomplete works;
- outstanding works;
- defects before handover;
- commissioning defects;
- rectification;
- verification;
- acceptance;
- handover blockers.

Warranty and DLP dates may be recorded as handover information.

CMeng does not become the post-handover DLP work-order system.

---

# 26. SPARES & SPECIAL TOOLS

Track separately:

- required quantity;
- delivered quantity;
- accepted quantity;
- stored quantity;
- asset/system-linked quantity;
- handed-over quantity.

Also:

- part;
- description;
- supplier;
- system;
- asset;
- storage location;
- required date;
- evidence;
- status.

Do not collapse:

Delivered = Accepted = Stored = Handed Over.

They are different positions.

---

# 27. HANDOVER READINESS

Provide a governed handover requirement register.

Requirements may cover:

- testing;
- commissioning;
- integrated testing;
- authority approvals;
- as-builts;
- O&M manuals;
- training;
- warranties;
- spares;
- special tools;
- asset information;
- test certificates;
- snag closure;
- taking-over requirements;
- contract closeout deliverables.

Each requirement shall include:

- requirement;
- type;
- package/system/asset;
- location;
- owner;
- due date;
- status;
- blocking issue;
- required evidence;
- evidence state;
- verification;
- acceptance.

## Handover percentage

Only calculate where the requirement population/denominator is established.

Show denominator coverage.

Do not claim 80% handover readiness if the system does not know whether all required handover obligations have been captured.

---

# 28. WEATHER & SITE DISRUPTION EVIDENCE

Weather may remain available as a construction-stage supporting register.

Track:

- event;
- date/time;
- duration;
- location;
- activity;
- workfront;
- weather/source evidence;
- operational disruption;
- recorded working impact;
- notice reference;
- claim/EOT reference.

However:

Weather event ≠ delay entitlement.

Recorded delay days ≠ approved EOT.

The existing CMeng Delay/Notice/EOT authority owns entitlement analysis.

Delivery only provides the underlying construction event/evidence and linked disruption.

---

# 29. DELIVERY RISK LENS

Do not create another independent risk engine.

Use the governed project risk basis.

Delivery shall allow filtering and management views for:

- Design Risks
- Procurement Risks
- Construction Risks
- Quality Risks
- HSE Risks
- Commissioning Risks
- Handover Risks

Provide:

- Top Procurement Risks
- Top Construction Risks
- Top Design Risks
- Risks affecting long-lead packages
- Risks affecting next-period workfronts
- Risks linked to critical/near-critical programme activities
- Handover blockers

Do not invent a second probability × impact formula.

---

# 30. EXECUTIVE DELIVERY DASHBOARD CONTRIBUTION

Feed selected additional KPIs into the existing CMeng Master Dashboard.

Possible Delivery KPIs:

- BOQ scope mapped to procurement %
- BOQ value mapped to procurement %
- Critical long-lead packages
- Late procurement packages
- Procurement Readiness
- Construction Readiness
- Ordered vs required
- Delivered vs required
- Installed vs required
- Design approvals blocking work
- Procurement packages threatening programme need dates
- Next-period blocked workfronts
- Open blocking NCRs
- Commissioning readiness
- Handover readiness

Do not reproduce existing:

- SPI;
- CPI;
- EVM;
- programme forecast;
- commercial position;
- cash flow;
- EOT;
- claims;

inside Delivery using a separate calculation.

Reference their existing CMeng authority.

---

# 31. EXPORT / POWER BI READINESS

The user shall be able to export:

- Procurement Register
- Long Lead Register
- Material Tracking
- Procurement S-Curve datasets
- Supplier/Subcontractor Register
- RFI/Design Register
- Submittal Register
- Discipline Progress Matrix
- Location/Floor/Zone Matrix
- Construction Readiness
- Procurement Readiness
- Quality/NCR
- Permit Register
- HSE
- T&C
- Asset/System Handover
- Snag/Closeout
- Spares
- Handover Checklist
- Delivery Risks

Power BI-ready data must use stable dimensions/keys.

Minimum common IDs where applicable:

- project ID;
- BOQ item ID;
- work package ID;
- WBS ID;
- location ID;
- activity ID;
- procurement package ID;
- supplier ID;
- subcontractor ID;
- material/item ID;
- design/submittal ID;
- quality record ID;
- asset/system ID;
- risk ID;
- handover requirement ID.

Power BI/Excel exports are consumers of CMeng's governed data.

They must not become competing sources of truth.

---

# 32. WHAT MUST NOT BE BUILT

Do not implement inside CMeng Delivery:

- operational FM work orders;
- preventive maintenance;
- corrective maintenance after handover;
- CAFM;
- FM helpdesk;
- PPM planning;
- operational SLA management;
- post-handover asset maintenance;
- post-handover DLP work-order operations.

Also do not create:

- second schedule engine;
- second progress engine;
- second installed-quantity engine;
- second BOQ;
- second commercial engine;
- second EVM calculation;
- second risk score;
- second claims/EOT engine.

---

# 33. PMOSYS LESSONS — NON-NEGOTIABLE IMPLEMENTATION WARNINGS

These rules exist specifically to avoid repeating the defects previously encountered in PMOSys.

## 33.1 A page loading is NOT a PASS

Never certify a module merely because:

- route returns 200;
- screen loads;
- cards appear;
- API responds;
- build passes;
- unit tests pass.

For every page verify:

- displayed values;
- rows;
- totals;
- labels;
- dates;
- source;
- authority state;
- filters;
- drilldowns;
- chart points;
- pagination;
- project switching;
- export;
- empty states;
- unavailable states.

Human review is mandatory.

---

# 34. POPULATED SOURCE MUST NOT DISPLAY AS EMPTY

This occurred previously.

The system must distinguish:

### No source provided

from:

### Source uploaded but not parsed

from:

### Source parsed but mapping failed

from:

### Source parsed but no records exist

from:

### Records exist but none are current at Data Date

from:

### Records exist but are excluded by filter

from:

### Records exist but are candidates only

Never display all of these as:

**0 records**

or:

**No data**

---

# 35. ZERO / UNAVAILABLE RULE

Never use zero because the system could not calculate something.

Examples:

No HSE manhours → rate unavailable, not 0.

Unknown required material quantity → procurement coverage unavailable, not 0%.

Unknown handover denominator → handover % unavailable.

Missing inspection outcomes → pass rate unavailable.

No current risk population established → open risks not established, not 0.

No evidence of rework cost → rework cost unavailable, not zero.

---

# 36. FUTURE-DATED RECORD CONTROL

Every Delivery register must respect CMeng's Data Date.

Future:

- approvals;
- deliveries;
- certificates;
- closures;
- commissioning;
- handovers;
- procurement milestones;

must not leak into the current position.

Future records may be shown separately as:

**Future / forecast / after Data Date**

but must not improve current completion.

---

# 37. HISTORICAL STATUS PROBLEM

A current status written in a register cannot automatically be projected backwards.

Example:

A submittal currently marked Approved does not prove it was approved at the historical Data Date.

Historical state requires:

- actual lifecycle dates;
- status-as-of evidence;
- dated snapshots;
- or another defensible dated basis.

Apply the same rule to:

- procurement;
- design;
- quality;
- permits;
- HSE;
- commissioning;
- handover.

---

# 38. CANDIDATE VS GOVERNED RECORD

PMOSys previously blurred extracted candidates and official records.

CMeng must never do this.

AI/document extraction may create:

**Candidate**

A human/governed process may promote it to:

**Working/Governed**

Approval may make it:

**Verified/Approved**

Candidates may be visible for review.

Candidates must not silently affect:

- KPIs;
- percentages;
- S-curves;
- readiness;
- risk;
- handover;
- completion.

---

# 39. RECORD-COUNT CURVE PROBLEM

A count of procurement records is not procurement progress.

A count of submittals is not construction progress.

A count of assets is not handover progress.

Every curve must state:

- population;
- denominator;
- unit;
- weighting;
- period;
- source;
- Data Date;
- included/excluded records.

Never label a count curve as progress without a valid weighting basis.

---

# 40. DENOMINATOR CONTROL

Before any percentage is shown, CMeng must know:

1. numerator;
2. denominator;
3. population;
4. applicable exclusions;
5. Data Date;
6. evidence authority.

Examples:

Procurement completion requires a defined procurement package population.

Handover completion requires a complete requirement population.

Inspection pass rate requires inspections with known outcomes.

Training completion requires required-person population.

No denominator → no percentage.

---

# 41. NO INCOMPATIBLE AGGREGATION

Never aggregate:

- different quantity units;
- different currencies without an approved conversion basis;
- count and value;
- records and packages;
- schedule progress and physical progress;
- planned, forecast and actual values;
- candidate and approved records.

---

# 42. STABLE RELATIONSHIPS — NO TEXT-ONLY LINKS

PMOSys allowed some relationships to remain text references.

Do not repeat this.

Use stable IDs for:

- BOQ ↔ package;
- package ↔ procurement;
- procurement ↔ supplier;
- procurement ↔ submittal;
- procurement ↔ activity;
- activity ↔ workfront;
- quality ↔ package/activity;
- asset ↔ procurement/activity;
- handover ↔ asset/system/package.

Text may be displayed.

Text is not the relationship key.

---

# 43. NO DUPLICATE MANUAL ENTRY

If CMeng already knows:

- BOQ quantity;
- activity date;
- float;
- supplier from procurement;
- installed quantity;
- contract value;
- variation;
- risk;
- NCR;

do not ask users to type it again into another module.

Reference the authoritative record.

Allow explicit user override only where a governed process and audit trail exist.

---

# 44. SOURCE CHANGE / REVISION CONTROL

Procurement, design, submittals and other registers may have revisions.

Never silently replace history.

Maintain:

- revision;
- current/superseded state;
- evidence source;
- effective date;
- uploaded date;
- Data Date applicability;
- lineage.

---

# 45. CROSS-PROJECT ISOLATION

This must be tested aggressively.

Uploading, refreshing or analysing evidence in Project A must not:

- change Project B;
- block Project B;
- refresh Project B with Project A data;
- leak Project A registers;
- leak charts;
- leak cached results;
- leak source documents;
- leak AI context;
- leak exports.

Multiple projects may be active or processing simultaneously.

Project isolation is a release gate.

---

# 46. LARGE UPLOAD / PROCESSING UX

PMOSys previously made large uploads appear frozen because the user saw only a final result.

CMeng must display useful processing state, such as:

- files queued;
- files uploaded;
- files being identified;
- parsed;
- failed;
- records detected;
- candidate records created;
- records requiring review;
- evidence missing;
- processing error.

Do not show an endless spinner with no explanation.

Errors must remain visible and actionable.

---

# 47. DO NOT CONFUSE CLASSIFICATION WITH ANALYSIS

"Automatically determine" must mean more than:

**This is a procurement file.**

After classification, CMeng must:

- parse;
- identify records;
- map fields;
- validate;
- establish evidence state;
- identify missing fields;
- generate candidates;
- build/rebuild relevant read models;
- surface review requirements.

File classification alone is not Delivery analysis.

---

# 48. DO NOT BURY THE MANAGEMENT ANSWER

PMOSys sometimes exposed evidence machinery before answering the manager's question.

Each Delivery page should display in this order:

1. Current management position
2. Main exceptions
3. Immediate required actions
4. Main KPIs
5. Visuals
6. Detailed register
7. Calculation/evidence basis
8. Source trace

The senior user should not need to understand backend/evidence terminology before understanding the project's position.

---

# 49. EVIDENCE DETAIL MUST STILL EXIST

Management-first does not mean hiding traceability.

Every important KPI or exception must be drillable to:

- contributing records;
- calculation basis;
- source;
- Data Date;
- exclusions;
- assumptions;
- authority state.

---

# 50. PAGINATION / FILTER INTEGRITY

Do not certify tables without testing:

- first page;
- middle pages;
- final page;
- filters;
- clearing filters;
- search;
- sorting;
- export.

Records must not disappear, duplicate or change totals because the table is paginated.

Dashboard totals must relate to the full population, not only the currently visible page.

---

# 51. S-CURVE VALIDATION

For every S-curve test independently:

- plotted points;
- cumulative math;
- dates;
- order;
- denominator;
- weighting;
- excluded records;
- forecast/current distinction.

Do not test only that the SVG/chart rendered.

A visually correct curve can still contain wrong data.

---

# 52. NO FALSE CAUSATION

Delivery can report:

**Procurement package forecast delivery is later than activity need date.**

It cannot automatically state:

**This procurement caused 40 days EOT.**

Quality can report:

**NCR linked to activity and activity slipped.**

It cannot automatically claim:

**NCR caused the delay.**

Weather can report disruption.

It does not establish entitlement.

---

# 53. NO HARDCODED PROJECT FIXES

No logic may be written to make one pilot project look right.

Do not hard-code:

- activity IDs;
- BOQ descriptions;
- specific floors;
- project names;
- suppliers;
- dates;
- quantities;
- category names;
- risk thresholds;
- document filenames.

Every rule must generalise to different projects.

---

# 54. PROJECT TYPE AGNOSTIC

Do not design Delivery only for towers.

Support:

- buildings;
- high-rise;
- airports;
- infrastructure;
- industrial;
- transport;
- mixed-use;
- mega-projects.

Floor tracking is one view of the generic location/workfront model.

---

# 55. CURRENT / FORECAST / ACTUAL MUST REMAIN SEPARATE

Across every module use separate fields and labels.

Do not overwrite:

planned with forecast;

forecast with actual;

source reported with calculated;

current with historical.

---

# 56. RELEASE TESTING MUST USE REALISTIC MULTI-SOURCE PROJECTS

Do not only test clean synthetic examples.

Use cases containing:

- missing documents;
- conflicting registers;
- future records;
- duplicate records;
- stale records;
- revised records;
- rejected submittals;
- partial deliveries;
- split BOQ mappings;
- multiple currencies;
- different units;
- incomplete handover populations;
- missing HSE denominators;
- unmapped procurement;
- multiple suppliers;
- mixed project types.

The system must remain truthful when the data is imperfect.

---

# 57. FALSE-CERTAINTY TESTS

Explicitly test that CMeng refuses to invent:

- approval;
- procurement completion;
- delivery completion;
- physical completion;
- quality closure;
- HSE rate;
- permit issue;
- commissioning completion;
- handover acceptance;
- delay causation;
- EOT;
- cost impact.

A release passes when the system is correct, including when the correct result is:

**Not established.**

---

# 58. LIVE ENVIRONMENT VERIFICATION

Local passing tests do not prove production.

Before release:

- verify production deployment;
- open every new Delivery page;
- switch between real projects;
- upload real supporting evidence;
- validate calculated values;
- inspect charts;
- inspect exports;
- verify session behaviour;
- verify errors are visible;
- verify refresh/reload;
- verify project isolation.

No release may be certified only from local/unit/CI results.

---

# 59. HUMAN PAGE AUDIT

Every Delivery page must receive the same human review standard used for CMeng:

For each real test project inspect:

- Does the page answer the management question?
- Are values believable?
- Is the Data Date clear?
- Is the denominator clear?
- Is the source/basis clear?
- Are missing values honest?
- Are future values separated?
- Are tables readable?
- Are charts meaningful?
- Are actions useful?
- Is technical detail available without dominating the page?
- Does switching project fully replace the previous project context?
- Can a Planning Manager / Project Controls Manager / Commercial Manager / Project Director understand it without software terminology?

---

# 60. DELIVERY RELEASE GATE

Delivery is not ready merely because every module exists.

Release requires:

### Data integrity

- no fake zeros;
- no fake percentages;
- no future leakage;
- no incompatible aggregation;
- no cross-project leakage;
- no silent source substitution;
- no hardcoded project logic.

### Authority integrity

- BOQ authority preserved;
- schedule authority preserved;
- progress authority preserved;
- commercial authority preserved;
- claims authority preserved.

### Relationship integrity

- stable governed IDs;
- no critical text-only relationship;
- revisions retained;
- lineage retained.

### UX integrity

- management answer visible first;
- detailed basis available;
- no misleading terminology;
- responsive usable pages;
- visible processing state;
- errors actionable.

### Testing integrity

- unit;
- integration;
- multi-project;
- real-source;
- chart-value;
- pagination;
- export;
- false-certainty;
- production/live;
- human page audit.

Only after all of the above may the new CMeng Delivery area be called implemented.

---

# FINAL CMENG DELIVERY NAVIGATION

## Delivery Control

Cross-package management position and BOQ/schedule/procurement/construction/handover reconciliation.

## Procurement & Materials

### Packages
Full procurement lifecycle.

### Materials
Required / Ordered / Manufactured / Shipped / Delivered / Accepted / Installed.

### Long Lead
Backward scheduling and need-date exposure.

### Submittals
Procurement-related technical approvals.

### Procurement S-Curves
- Throughput
- Value
- Weighted Progress
- Material Quantity
- Submittal Approval

## Suppliers & Subcontractors

Package delivery and performance.

## RFI & Design

Design readiness and information flow.

## Construction Workfronts

### Discipline
### Location / Floor / Zone
### Construction Readiness

## Quality & Inspections

NCR / WIR / MIR / test packs / snags / rework.

## Permits & Authorities

Construction permits and blockers.

## HSE

Construction-stage HSE only.

## Testing & Commissioning

System and subsystem readiness and completion.

## Asset & System Handover

Construction asset/system information up to handover.

## Snag & Closeout

Construction defects and outstanding works before handover.

## Spares & Special Tools

Obligation through acceptance and handover.

## Handover Readiness

Controlled denominator-based handover position.

## Weather / Disruption Evidence

Construction evidence linked to existing Delay/Claims authority.

---

# EXPLICITLY NOT PART OF CMENG DELIVERY

Do not create:

**FM Work Orders**

**Preventive Maintenance**

**Reactive Maintenance**

**PPM**

**CAFM Helpdesk**

**Operational FM SLA**

**Post-handover Maintenance**

**Operational DLP Management**

CMeng ends at controlled construction handover.