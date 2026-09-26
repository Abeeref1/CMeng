import test from "node:test";
import assert from "node:assert/strict";

import {
  cmengUatHtml,
} from "../packages/runtime-api/src/ui";

test("CMeng workspace keeps the active module primary and browser script parseable", () => {
  const html =
    cmengUatHtml();

  const moduleIndex =
    html.indexOf(
      'class="card module-panel module-workspace"',
    );
  const evidenceIndex =
    html.indexOf(
      'id="evidenceControlDrawer"',
    );

  assert.ok(
    moduleIndex >= 0,
    "active module workspace must exist",
  );
  assert.ok(
    evidenceIndex > moduleIndex,
    "active module workspace must render before evidence control",
  );

  for (
    const id of [
      "scheduleIntent",
      "boqIntent",
      "contractIntent",
      "evidenceIntent",
    ]
  ) {
    assert.match(
      html,
      new RegExp(
        'id="' + id + '"',
      ),
      id,
    );
  }

  assert.match(
    html,
    /Conflicting project information · all defensible positions retained/,
  );
  assert.match(
    html,
    /Management decision required/,
  );
  assert.match(
    html,
    /id="focusMode"/,
    "focus-mode control must remain available",
  );
  assert.match(
    html,
    /class="visual-focus-button"/,
    "every primary visual panel must expose a section-level expand control",
  );
  assert.match(
    html,
    /function setVisualPanelFocus/,
    "section focus must be implemented as a controlled analysis workspace rather than browser zoom",
  );
  assert.match(
    html,
    /id="moduleReport"/,
    "every submodule must expose a report-generation control",
  );
  assert.match(
    html,
    /id="roleViewSelector"/,
    "every project-control page must expose the confirmed review-lens selector",
  );
  for (
    const roleView of [
      "Overall Detailed",
      "Planning Engineer",
      "Project Controls Manager",
      "Project Director",
      "Program Director",
      "Executive / CEO",
    ]
  ) {
    assert.equal(
      html.includes(roleView),
      true,
      "six-view architecture must include: " +
        roleView,
    );
  }
  assert.match(
    html,
    /selectedRoleView=.*"overall"/,
    "Overall Detailed must be the safe default review lens",
  );
  assert.match(
    html,
    /cmeng-role-view/,
    "selected review lens must persist between page loads",
  );
  assert.match(
    html,
    /function renderRoleContent/,
    "all specialist modules must pass through one confirmed role-presentation layer",
  );
  assert.match(
    html,
    /Displayed metric checks passed/,
    "The role lens must report the checked consistency state without claiming complete truth",
  );

  assert.match(
    html,
    /role-lens-compact-strip/,
    "Overall Detailed review context must stay compact instead of consuming a six-card preamble before the actual module.",
  );
  assert.equal(
    html.includes(
      "Open all technical charts, registers and supporting detail for this module",
    ),
    false,
    "leadership lenses must not duplicate the same full module a second time inside another details panel.",
  );
  assert.match(
    html,
    /Save PDF \/ Print/,
    "module report preview must support PDF/print output",
  );
  assert.match(
    html,
    /reportDownloadUrl\("xlsx"\)/,
    "module report preview must provide an Excel download",
  );
  assert.match(
    html,
    /reportDownloadUrl\("json"\)/,
    "module report preview must provide a confirmed data download",
  );
  assert.match(
    html,
    /<span>Review lens<\/span>/,
    "generated module reports must identify the selected review lens",
  );
  for (
    const uploadControl of [
      "openEvidenceTop",
      "openLibraryQuick",
    ]
  ) {
    assert.match(
      html,
      new RegExp(
        'id="' +
          uploadControl +
          '"',
      ),
      uploadControl,
    );
  }
  assert.equal(
    html.includes(
      'id="evidenceControlDrawer" open',
    ),
    false,
    "document controls must stay out of the main analysis canvas until the user opens them",
  );
  assert.match(
    html,
    /class="workspace-drawer auxiliary-drawer" id="evidenceControlDrawer"/,
    "document controls must open as an auxiliary overlay rather than consume the project-control page",
  );
  assert.ok(
    html.indexOf(
      'id="evidenceControlDrawer"',
    ) <
      html.indexOf(
        'id="directorDrawer"',
      ),
    "evidence upload workspace must appear before Project Director",
  );
  assert.match(
    html,
    /const primaryView=\(resultFirst\?"":renderClaimsReporting\(data.claimsReporting,result.key\)\)/,
    "specialized module view must replace duplicate generic dashboard layers",
  );
  assert.match(
    html,
    /function renderModuleBasis/,
    "module evidence-basis context must remain rendered",
  );
  assert.match(
    html,
    /id="topbarModule"/,
    "active module must remain visible in the top bar",
  );
  assert.match(
    html,
    /id="moduleSubtitle"/,
    "loadModule must have a real subtitle DOM target before it updates the selected view",
  );
  assert.match(
    html,
    /id="releaseStatus"/,
    "production release state must remain visible",
  );
  assert.match(
    html,
    /replace_current_basis/,
  );
  assert.match(
    html,
    /aria-label="CMeng logo"/,
    "CMeng logo must remain visible in the shell",
  );
  assert.match(
    html,
    /class="cmeng-emblem"/,
    "CMeng must use the blue C and four-direction emblem",
  );
  assert.match(
    html,
    /--accent:#4f7fb4/,
    "CMeng executive blue accent must remain in the production theme",
  );
  assert.match(
    html,
    /--slate:#22364d/,
    "CMeng dark slate identity must remain in the production theme",
  );
  assert.match(
    html,
    /--ivory:#ffffff/,
    "CMeng white surface tone must remain in the production theme",
  );
  assert.match(
    html,
    /"Montserrat","Avenir Next","Segoe UI"/,
    "CMeng headings must retain the approved theme typography",
  );
  assert.match(
    html,
    /id="cmengBlue"/,
    "CMeng C must use the approved blue treatment",
  );
  assert.match(
    html,
    /Turning complexity into confidence\./,
    "CMeng sidebar must retain the approved brand message",
  );
  assert.match(
    html,
    /class="btn primary" id="openEvidenceTop">Add documents<\/button>/,
    "project document action must remain prominent without taking space from the analysis canvas",
  );
  assert.match(
    html,
    /id="openLibraryQuick">Documents<\/button>/,
    "document register must be available from a compact header action",
  );
  assert.match(
    html,
    /id="runAfterUpload" checked/,
    "evidence intake should rerun analysis after upload by default",
  );
  assert.match(
    html,
    /let moduleRequestSeq=0/,
    "module rendering must ignore stale responses when the user changes views quickly",
  );
  assert.match(
    html,
    /requestSeq===moduleRequestSeq&&projectRequestIsCurrent/,
    "only the latest selected module may update the screen",
  );
  assert.match(
    html,
    /Promise\.allSettled\(\[\s*loadModule\(selected\),\s*loadEvidence\(\)/,
    "project refresh must load the specialist module independently from the document register",
  );
  assert.match(
    html,
    /overview=loadedOverview;\s*projectLoadState="ready";\s*localStorage\.setItem\("cmeng-project",projectId\)/,
    "a valid overview must establish the active project before secondary panels load",
  );
  assert.equal(
    html.includes("Production · "),
    false,
    "release hashes must not be exposed in the normal management interface",
  );

  for (
    const documentControl of [
      "deleteProjectDocument",
      "document-delete",
      "queue-remove",
      "Full document name",
      "This programme is",
      "This contract document is",
      "Replacement / Restated contract",
      "project position needs refresh",
      "Delete selected",
      "evidenceSelectAll",
      "deleteSelectedDocuments",
      "selectedEvidenceDocuments",
      "upload-progress-fill",
      "XMLHttpRequest",
      "x-upload-id",
      "evidence/upload-progress/",
      "Last uploaded / updated",
      "formatDocumentTime",
      "How to read these document statuses",
      "Current / used now",
      "Previous version",
      "Needs review before current",
      "Adds to current record",
      "Reference only",
      "Scenario only",
      "Reading result",
      "Full OCR required",
      "Missing submitted values",
      "Other scenarios",
      "What needs attention",
      "Updated",
      "Preparing the latest project position",
    ]
  ) {
    assert.equal(
      html.includes(
        documentControl,
      ),
      true,
      "document workflow control must remain visible: " +
        documentControl,
    );
  }
  assert.equal(
    html.includes(
      "text-overflow:ellipsis;white-space:nowrap}.queue-name",
    ),
    false,
    "upload filenames must not be truncated with ellipsis",
  );
  assert.equal(
    html.includes(
      "Current position and the items that need attention are shown below",
    ),
    false,
    "successful specialist views should not waste the first viewport on a redundant status sentence",
  );
  assert.match(
    html,
    /planning-view \.table-wrap\{max-height:620px;overflow:auto\}/,
    "large planning tables must scroll inside their analysis panel rather than extend the entire page",
  );
  for (
    const platformView of [
      "portfolioView",
      "projectsView",
      "projectWorkspace",
      "aiView",
    ]
  ) {
    assert.match(
      html,
      new RegExp(
        'id="' +
          platformView +
          '"',
      ),
      platformView,
    );
  }
  assert.match(
    html,
    /id="runAnalysisTop"/,
    "Project Controls must expose an explicit update-position action",
  );
  assert.match(
    html,
    /id="openAiTop"/,
    "Ask CMeng must be directly accessible from project workspace",
  );

  for (
    const developerPhrase of [
      "Active module",
      "Project Control Workspace",
      ">Grounding<",
      "Technical payload",
      ">Parser<",
      "Ready modules",
      "evidence docs",
      "Legacy project requires analysis refresh",
      "Available control views",
      "Core records complete",
    ]
  ) {
    assert.equal(
      html.includes(
        developerPhrase,
      ),
      false,
      "normal CMeng interface must not expose developer wording: " +
        developerPhrase,
    );
  }

  for (
    const projectControlPhrase of [
      "Portfolio Overview",
      "Project Controls",
      "Current view",
      "Documents",
      "Documents and activity links",
      "CMeng AI",
      "Management decision required",
      "Current positions",
      "Need attention",
      "Productivity forecast",
      "Portfolio attention",
    ]
  ) {
    assert.equal(
      html.includes(
        projectControlPhrase,
      ),
      true,
      "CMeng interface should use project-controls wording: " +
        projectControlPhrase,
    );
  }

  const dedicatedModuleViews = [
    "pmo-analysis",
    "schedule-analytics",
    "activity-analytics",
    "resource-utilization",
    "lookahead-schedule",
    "progress-report",
    "schedule-change-report",
    "revision-trend",
    "variance-trends",
    "progress-scurve",
    "quantity-scurve",
    "progress-breakdown",
    "milestones",
    "near-critical",
    "manhour-scurve",
    "forecast-history",
    "independent-forecast",
    "delay-claims",
    "notices-claims",
    "windows-analysis",
    "eot-assessment",
  ];

  for (
    const key of dedicatedModuleViews
  ) {
    assert.match(
      html,
      new RegExp(
        'key==="' +
          key +
          '"',
      ),
      key,
    );
  }

  for (
    const planningVisual of [
      "Finish-date position",
      "Programme health",
      "Finish movement & float matrix",
      "6-week execution view",
      "Readiness matrix",
      "Largest finish movements",
      "Finish-date movement",
      "Milestone movement",
      "Float-risk distribution",
      "Float-Risk Watchlist",
      "Comparison with the submitted position",
    ]
  ) {
    assert.equal(
      html.includes(
        planningVisual,
      ),
      true,
      "Programme & Planning visual must be present: " +
        planningVisual,
    );
  }

  assert.match(
    html,
    /class="planning-kpi-grid"/,
    "Programme & Planning views must use the management KPI hierarchy",
  );
  assert.match(
    html,
    /class="reconciliation-panel"/,
    "submitted-vs-CMeng reconciliation must be secondary to the specialist visual",
  );
  for (
    const cashFlowVisual of [
      "Cash Flow & Funding",
      "Observed receipts less expenditure",
      "Observed receipts less expenditure",
      "Net cash requires dated receipts and expenditure.",
      "Actual cash receipts",
      "Actual cash expenditure",
      "Observed cash history",
      "Actual cash history needs at least two comparable receipt and expenditure observations.",
      "Certificate amounts · ",
      "Confirmed dated cash-flow register",
      "Calculation trace",
      "Documents and approvals",
    ]
  ) {
    assert.equal(
      html.includes(
        cashFlowVisual,
      ),
      true,
      "Cash Flow evidence-first view must expose: " +
        cashFlowVisual,
    );
  }
  assert.equal(
    html.includes(
      "Cash & Certification Position by Currency",
    ),
    false,
    "Cash Flow must not lead with the generic Commercial summary after the dedicated cash position.",
  );
  assert.equal(
    html.includes(
      "Full confirmed dated register; no presentation-only row cap.",
    ),
    false,
    "Cash Flow register must be collapsed into source drill-down rather than consume the main management canvas.",
  );
  assert.equal(
    html.includes(
      "(row.entries||[]).slice(0,150)",
    ),
    false,
    "Cash Flow must not silently cap the confirmed register at 150 rows",
  );
  assert.match(
    html,
    /renderCashMovementBars/,
    "Cash Flow must use a cash-semantic period movement visual",
  );

  assert.match(
    html,
    /const sourceReadiness=row\.sourceReadiness\|\|null/,
    "Cash Flow UI must consume producer-owned source readiness rather than infer management readiness from rendered findings.",
  );
  assert.match(
    html,
    /sourceReadiness\.fundingCurveReady===true/,
    "funding S-curve visibility must be gated by the producer-certified funding-curve state.",
  );
  assert.equal(
    html.includes(
      'const missingCore=[',
    ),
    false,
    "Cash Flow UI must not maintain its own parallel missing-cash decision logic.",
  );

  assert.match(
    html,
    /function managementMetricDisplay/,
    "Master Dashboard must use presentation-safe value formatting instead of dumping raw machine values.",
  );
  assert.match(
    html,
    /planningShortDate\(value\)/,
    "ISO management dates must render as human dates rather than raw timestamps.",
  );
  assert.match(
    html,
    /if\(state===authority\)return managementAuthorityBadge\(state\)/,
    "identical state and authority must collapse to one badge instead of duplicate CALCULATED pills.",
  );
  assert.equal(
    html.includes(
      '<div class="management-metric-value date">'+
      '2033-05-15T16:00:00.000Z',
    ),
    false,
    "management cards must never hard-code or display raw ISO timestamps as their primary value.",
  );

  for (
    const managementControlFeature of [
      "Master Dashboard",
      "Command Center",
      "Master Control Programme",
      "Project position",
      "Management Priorities",
      "Action Suggestions — Awaiting Assignment",
      "Programme control",
      "WBS & Work-Package Control",
      "Suggested updates for review",
      "Control History",
      "WBS names come from the programme.",
      "Use the relevant page to approve, reject or defer it before it changes the project position.",
    ]
  ) {
    assert.equal(
      html.includes(
        managementControlFeature,
      ),
      true,
      "Management Control surface must expose: " +
        managementControlFeature,
    );
  }

  assert.equal(
    html.includes(
      "/management-control/",
    ),
    false,
    "management views must use the canonical first-class management route, not the obsolete prototype endpoint",
  );
  assert.match(
    html,
    /\/management\/"\+encodeURIComponent\(apiKeys\[key\]\|\|key\)/,
    "management views must load the server-owned ModuleRuntimeResult",
  );
  assert.match(
    html,
    /\/management\/"\+encodeURIComponent\(selected\)\+"\/report\."/,
    "management views must use the same report-generation pattern as specialist modules",
  );
  assert.match(
    html,
    /selected="master-dashboard"/,
    "a newly opened CMeng project should lead with the executive Master Dashboard",
  );

  for (
    const commercialManagementVisual of [
      "Executive Commercial Position",
      "Cost Snapshot & Forecast Position",
      "EVM Curves & Performance Indices",
      "Cost Control Management Position",
      "EAC scenario range",
      "Variance decomposition",
    ]
  ) {
    assert.equal(
      html.includes(
        commercialManagementVisual,
      ),
      true,
      "Commercial management presentation must expose: " +
        commercialManagementVisual,
    );
  }

  assert.match(
    html,
    /commercial-overview-enterprise/,
    "Commercial Overview must use its executive information hierarchy",
  );

  for (
    const changePaymentVisual of [
      "Variations & Change Management Position",
      "Variation lifecycle distribution",
      "Pending and unknown-stage aging",
      "Contract value & change bridge",
      "Site Instruction conversion & quotation pressure",
      "Payments & IPC Management Position",
      "IPC lifecycle completion",
      "Payment SLA & aging position",
      "Source certificate rows remain available beneath the confirmed payment lifecycle; values are not re-summed in the browser.",
    ]
  ) {
    assert.equal(
      html.includes(
        changePaymentVisual,
      ),
      true,
      "Variations / Payments enterprise view must expose: " +
        changePaymentVisual,
    );
  }

  for (
    const enterpriseClass of [
      "variations-enterprise",
      "payments-enterprise",
      "cash-flow-enterprise",
    ]
  ) {
    assert.equal(
      html.includes(
        enterpriseClass,
      ),
      true,
      "Commercial specialist page must have deliberate hierarchy: " +
        enterpriseClass,
    );
  }

  assert.match(
    html,
    /renderCommercialValueBridge/,
    "Variation value movement must use a dedicated producer-fed contract bridge",
  );
  assert.equal(
    html.includes(
      "invoiceGroups",
    ),
    false,
    "Payments and Cash Flow must not re-sum raw invoice rows in the browser",
  );
  assert.equal(
    html.includes(
      "(foundation.paymentRegister?.rows||[]).slice(0,100)",
    ),
    false,
    "Payment lifecycle drill-down must not have a hidden 100-row presentation cap",
  );
  assert.match(
    html,
    /cost-forecast-enterprise/,
    "Cost & Forecast must use its specialist management hierarchy",
  );

  for (
    const finalCommercialVisual of [
      "Financial claim review",
      "Source claim lifecycle distribution",
      "Notice timeliness position",
      "Notice / correspondence lifecycle",
      "Contract Particulars, Securities & Obligations Management Position",
      "Contract obligation control",
      "Security & insurance monitoring",
      "Retention release control",
      "LD scenario exposure",
    ]
  ) {
    assert.equal(
      html.includes(
        finalCommercialVisual,
      ),
      true,
      "Final Commercial management view must expose: " +
        finalCommercialVisual,
    );
  }

  for (
    const enterpriseClass of [
      "commercial-claims-enterprise",
      "contract-particulars-enterprise",
    ]
  ) {
    assert.equal(
      html.includes(
        enterpriseClass,
      ),
      true,
      "Final Commercial specialist page must have deliberate hierarchy: " +
        enterpriseClass,
    );
  }

  assert.equal(
    html.includes(
      "No controlled obligation register is established. Open, overdue and complete counts are not confirmed.",
    ),
    true,
    "Contract Particulars must not render zero compliance counts when the controlled obligation register is absent",
  );
  assert.equal(
    html.includes(
      "Overdue retention is not assessable until release due dates or contractual release triggers are established.",
    ),
    true,
    "Retention overdue must be explicitly unassessable when release timing evidence is incomplete",
  );
  assert.equal(
    html.includes(
      '["Records",ret.recordCount||0,"all evidence origins"]',
    ),
    false,
    "Retention detail must not reintroduce zero counts when no retention register is established",
  );
  assert.equal(
    html.includes(
      "Actual overloads through DD",
    ),
    true,
    "PMO must label weekly resource-capacity exceedance precisely",
  );
  assert.equal(
    html.includes(
      "Evidence & technical trace",
    ),
    true,
    "Claims & Notices must move technical evidence references behind a trace drawer",
  );
  assert.equal(
    html.includes(
      'table(["Claim","Title","State","Submitted","Claimed days","Assessed days","Assessment authority","Events","Clauses","Evidence"]',
    ),
    false,
    "Claims & Notices main lifecycle table must not expose evidence hashes",
  );
  assert.match(
    html,
    /humanizeIsoText/,
    "Delivery Challenge must humanize ISO timestamps in user-facing text",
  );
  assert.match(
    html,
    /planningShortDate\(p\.forecast\.independentCompletionIso\)/,
    "PMO must show calendar recalculation as a dated model review",
  );

  assert.equal(
    html.includes(
      "claimGroups",
    ),
    false,
    "Commercial Claims must not aggregate raw financial claim rows in the browser",
  );

  assert.equal(
    html.includes(
      "weeklyComparable||weeklyRows",
    ),
    false,
    "Resources must never relabel all weekly rows as rows with both capacity and demand",
  );
  assert.equal(
    html.includes(
      "Approved weekly usage history",
    ),
    true,
    "Man-Hour must label approved weekly actual usage by its real source basis",
  );
  assert.equal(
    html.includes(
      "p.nearCriticalFloatThresholdHours??40",
    ),
    false,
    "Milestones must not explain a calendar-aware near-critical rule with a hard-coded 40-hour fallback",
  );
  assert.equal(
    html.includes(
      '{label:"Unknown",value:unknownCriticality',
    ),
    true,
    "Activity Review must keep unknown criticality separate from non-critical activities",
  );
  assert.equal(
    html.includes(
      '?p.observedProgrammeMovementDays:0',
    ),
    false,
    "EOT bridge must not plot a missing analytical value as zero",
  );
  assert.equal(
    html.includes(
      '?variance:0',
    ),
    false,
    "Independent Forecast bridge must omit missing comparison values instead of plotting zero",
  );
  assert.equal(
    html.includes(
      "No retention register or confirmed balance records are established.",
    ),
    true,
    "Contract Particulars must not render retention held/released/due zeros without a retention population",
  );
  assert.equal(
    html.includes(
      "Payment register is not confirmed. Lifecycle counts are not confirmed.",
    ),
    true,
    "Payments must not render lifecycle zeros when the payment register is absent",
  );
  assert.match(
    html,
    /Project completion movement/,
    "Portfolio must distinguish net project completion movement from gross window movement",
  );
  assert.match(
    html,
    /planningShortDate\(p\.latestDataDateIso\)/,
    "Portfolio must render the project data date as a human date",
  );

  assert.equal(
    html.includes(
      'fmt(foundation.costRegister?.recordCount||0)+" records"',
    ),
    false,
    "Commercial Foundation must not pair a missing source state with a false zero record count",
  );
  assert.equal(
    html.includes(
      "No confirmed claim lifecycle population is established. Lifecycle counts are not confirmed.",
    ),
    true,
    "Commercial Claims must not render an all-zero lifecycle chart when no confirmed claim population exists",
  );
  assert.equal(
    html.includes(
      "Notice timeliness is not assessable until confirmed event, requirement and notice-date evidence is established.",
    ),
    true,
    "Notice timeliness must remain unassessable when its evidence population is absent",
  );
  assert.equal(
    html.includes(
      "payment register not confirmed",
    ),
    true,
    "Cash Flow source summary must describe an absent payment basis instead of presenting it as zero",
  );
  for (const disclosure of [
    "complete confirmed population is available through Download Excel / Download data",
    "complete population is available through Download Excel / Download data",
  ]) {
    assert.equal(
      html.includes(disclosure),
      true,
      "Capped detail surfaces must disclose that the full population remains available: " + disclosure,
    );
  }
  assert.equal(
    html.includes(
      "(terms.clauses||[]).slice(0,100)",
    ),
    false,
    "Contract Particulars must not silently hide clauses after row 100",
  );

  const costCurvePosition =
    html.indexOf(
      "Cost Snapshot & Forecast Position",
    );
  const costExecutivePosition =
    html.indexOf(
      "Cost outlook summary",
    );
  assert.ok(
    costCurvePosition >= 0 &&
      costExecutivePosition >= 0 &&
      costCurvePosition <
        costExecutivePosition,
    "Cost & Forecast must lead with the analytical cost S-curve before the supporting executive currency position",
  );
  assert.match(
    html,
    /planningMilestoneTimeline/,
    "milestones must have a real timeline visual",
  );
  for (
    const milestoneChartFeature of [
      "Milestone movement & criticality",
      "common calendar axis",
      "Controlled baseline",
      "Current forecast",
      "Submitted float critical",
      "priority representatives from",
      "All milestone records remain below.",
    ]
  ) {
    assert.equal(
      html.includes(milestoneChartFeature),
      true,
      "professional milestone chart must expose: " +
        milestoneChartFeature,
    );
  }
  assert.match(
    html,
    /planningLookAheadTimeline/,
    "look-ahead must have a timeline visual",
  );
  assert.equal(
    html.includes(
      'const asOf=root.dataDateIso||root.asOfIso||root.generatedAt||null',
    ),
    false,
    "generated-at timestamp must never be shown as the project data date",
  );
  assert.match(
    html,
    /Known blocker/,
    "look-ahead must distinguish a known blocker from missing readiness evidence",
  );
  assert.match(
    html,
    /Exact submitted total-float values/,
    "near-critical float chart must show exact discrete source values when possible",
  );
  assert.match(
    html,
    /Revision values/,
    "revision history must expose exact values as well as charts",
  );
  assert.match(
    html,
    /planningActivityPressure/,
    "activity and near-critical modules must have schedule-pressure visuals",
  );

  assert.match(
    html,
    /key==="challenge-contract"&&renderDeliveryChallenge/,
    "Delivery Challenge keeps its specialist renderer",
  );

  for (
    const evidenceSafePhrase of [
      "Per-hour overload is not 0; it is not assessable.",
      "The programme contains a percentage-complete snapshot, but certified/contractor physical progress is not confirmed.",
      "schedule-revision progress history",
      "Actual man-hours are not confirmed.",
      "No confirmed quantity curve is available.",
      "Notice performance is not zero; it is not assessable.",
      "Schedule movement is not an EOT time-impact assessment.",
      "Source forecast history is available.",
      "Independent forecast requires reconciliation before management use.",
    ]
  ) {
    assert.equal(
      html.includes(
        evidenceSafePhrase,
      ),
      true,
      "specialist modules must preserve evidence-safe semantics: " +
        evidenceSafePhrase,
    );
  }

  assert.equal(
    html.includes(
      "CMeng Completion Forecast",
    ),
    false,
    "the navigation must use Completion Forecast rather than ambiguous CMeng Completion Forecast wording",
  );
  assert.equal(
    html.includes(
      "Completion Forecast History",
    ),
    false,
    "the navigation must use Completion History rather than ambiguous completion wording",
  );

  const script =
    html.match(
      /<script>([\s\S]*?)<\/script>/,
    )?.[1];

  assert.ok(
    script,
    "embedded browser script must exist",
  );

  assert.doesNotThrow(
    () =>
      new Function(
        script,
      ),
    "embedded browser script must parse",
  );
});
