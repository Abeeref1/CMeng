import type {
  CommandCenterProjection,
  ManagementAlert,
  ManagementDecision,
  ManagementHealth,
  ManagementMetric,
  ManagementSurfacesInput,
  ManagementSurfacesProjection,
  MasterControlProgrammeProjection,
  MasterDashboardProjection,
} from "./types";
import {managementForecastPosition} from './forecast-position';

function healthForSignedVariance(
  value: number | null,
): ManagementHealth {
  if (value === null) {
    return "unavailable";
  }
  if (value > 0) {
    return "attention";
  }
  return "good";
}

function managementDays(
  value: number,
): string {
  const rounded =
    Math.round(value);
  return rounded.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 0,
    },
  );
}

function metric(
  value: Partial<ManagementMetric> &
    Pick<
      ManagementMetric,
      | "key"
      | "label"
      | "value"
      | "state"
      | "authority"
      | "health"
      | "basis"
    >,
): ManagementMetric {
  return {
    unit: null,
    consequence: null,
    action: null,
    owningModule: null,
    ...value,
  };
}

function buildAlerts(
  input: ManagementSurfacesInput,
): ManagementAlert[] {
  const director =
    input.director;
  const alerts:
    ManagementAlert[] = [];
  const add = (
    alert: ManagementAlert,
  ) => {
    alerts.push(alert);
  };

  if (!director) {
    add({
      alertId:
        "management-position-unavailable",
      severity: "critical",
      title:
        "Management position is not established",
      consequence:
        "CMeng cannot establish project-wide management priorities without a current programme position.",
      action:
        "Establish the current programme and rerun the project position.",
      owningModule:
        "pmo-analysis",
      state:
        "evidence_gap",
    });
  } else {
    const variance =
      director.schedule
        .forecastComparisonBasis ===
        "official_adjusted_completion"
        ? director.schedule
            .varianceDaysToOfficialAdjustedCompletion
        : director.schedule
            .forecastComparisonBasis ===
            "contractual_completion"
          ? director.schedule
              .varianceDaysToContractualCompletion
          : director.schedule
              .forecastComparisonBasis ===
              "submitted_programme"
            ? director.schedule
                .varianceDaysToSubmittedProgrammeCompletion
            : null;
    const varianceBasisLabel =
      director.schedule
        .forecastComparisonBasis ===
        "official_adjusted_completion"
        ? "official adjusted completion"
        : director.schedule
            .forecastComparisonBasis ===
            "contractual_completion"
          ? "contract completion"
          : director.schedule
              .forecastComparisonBasis ===
              "submitted_programme"
            ? "submitted programme finish"
            : "governed completion basis";
    if (
      variance !== null &&
      variance > 0
    ) {
      add({
        alertId:
          "forecast-beyond-contract",
        severity: "high",
        title:
          "Calendar recalculation needs reconciliation",
        consequence:
          "Submitted logic recalculated on its own calendars finishes later than the " +
          varianceBasisLabel +
          ".",
        action:
          "Reconcile source dates, duration units, calendars and unapplied constraints. This scenario is not attributable delay or EOT.",
        owningModule:
          "independent-forecast",
        state: "open",
      });
    }

    if (
      director.schedule
        .overdueLookAheadCount >
      0
    ) {
      add({
        alertId:
          "overdue-lookahead",
        severity: "high",
        title:
          "Overdue look-ahead work requires intervention",
        consequence:
          String(
            director.schedule
              .overdueLookAheadCount,
          ) +
          " look-ahead activities are overdue.",
        action:
          "Resolve readiness blockers and assign recovery ownership.",
        owningModule:
          "lookahead-schedule",
        state: "open",
      });
    }

    if (
      director.claims
        .unlinkedClaimIds.length >
      0
    ) {
      add({
        alertId:
          "claims-linkage-gap",
        severity: "high",
        title:
          "Claims need links to the affected activities and delay records",
        consequence:
          String(
            director.claims
              .unlinkedClaimIds
              .length,
          ) +
          " claim(s) lack the complete event/activity chain required for defensible time analysis.",
        action:
          "Confirm each claim, event, notice and affected activity against the supporting records.",
        owningModule:
          "delay-claims",
        state: "open",
      });
    }

    if (
      (director.controls.openCriticalMajorNcrCount ?? 0) >
      0
    ) {
      add({
        alertId:
          "major-ncr-open",
        severity: "critical",
        title:
          "Critical or major NCR exposure is open",
        consequence:
          String(
            director.controls
              .openCriticalMajorNcrCount,
          ) +
          " major/critical NCR item(s) remain open.",
        action:
          "Escalate closure, accountable ownership and evidence of correction.",
        owningModule: "documents",
        state: "open",
      });
    }

    if (
      (director.controls.overdueRfiCount ?? 0) >
      0
    ) {
      add({
        alertId:
          "overdue-rfi",
        severity: "high",
        title:
          "Overdue RFIs can affect delivery",
        consequence:
          String(
            director.controls
              .overdueRfiCount,
          ) +
          " RFI(s) are overdue.",
        action:
          "Escalate the overdue RFI and confirm affected activities.",
        owningModule: "documents",
        state: "open",
      });
    }

    if (
      (director.controls.overduePermitCount ?? 0) >
      0
    ) {
      add({
        alertId:
          "permit-control",
        severity: "high",
        title:
          "Permit issues require resolution",
        consequence:
          String(
            director.controls
              .overduePermitCount,
          ) +
          " permit item(s) are overdue or expired.",
        action:
          "Resolve permit ownership, due dates and delivery dependencies.",
        owningModule: "documents",
        state: "open",
      });
    }

    if (
      (director.controls.expiredBondCount ?? 0) >
      0
    ) {
      add({
        alertId:
          "expired-security",
        severity: "high",
        title:
          "Expired contract security requires attention",
        consequence:
          String(
            director.controls
              .expiredBondCount,
          ) +
          " bond/security item(s) are expired.",
        action:
          "Review renewal, replacement or release requirements against the contract.",
        owningModule:
          "contract-particulars-bonds",
        state: "open",
      });
    }
  }

  if (
    (
      input.commercial
        .overdueUnpaidPayments ??
      0
    ) > 0
  ) {
    add({
      alertId:
        "overdue-unpaid-payment",
      severity: "high",
      title:
        "Overdue certified payment requires attention",
      consequence:
        String(
          input.commercial
            .overdueUnpaidPayments,
        ) +
        " confirmed payment item(s) are overdue and unpaid.",
      action:
        "Review payment due dates, certification evidence and payment responsibility.",
      owningModule: "payments",
      state: "open",
    });
  }

  if (
    (
      input.commercial
        .lateNotices ??
      0
    ) > 0
  ) {
    add({
      alertId:
        "late-notice",
      severity: "high",
      title:
        "Late contractual notice exposure exists",
      consequence:
        String(
          input.commercial
            .lateNotices,
        ) +
        " event notice assessment(s) are late against the confirmed requirement.",
      action:
        "Review notice evidence, contractual consequence and claim strategy.",
      owningModule:
        "commercial-claims-notices",
      state: "open",
    });
  }

  if (
    (
      input.commercial
        .notIssuedNotices ??
      0
    ) > 0
  ) {
    add({
      alertId:
        "notice-not-issued",
      severity: "high",
      title:
        "Required notices are not evidenced as issued",
      consequence:
        String(
          input.commercial
            .notIssuedNotices,
        ) +
        " event(s) have a confirmed notice requirement but no qualifying issued notice.",
      action:
        "Confirm notice evidence and assess time-bar or entitlement consequences.",
      owningModule:
        "commercial-claims-notices",
      state: "open",
    });
  }

  for (
    const gap of
      input.evidenceGaps
  ) {
    if (
      gap.state ===
        "established"
    ) {
      continue;
    }
    add({
      alertId:
        "evidence-gap:" +
        gap.key,
      severity:
        gap.state ===
          "conflicted"
          ? "high"
          : "medium",
      title: gap.label + (gap.key === "board-publication" ? " needs approval" : " requires evidence review"),
      consequence:
        gap.key === "board-publication"
          ? "Board publication cannot be finalized until management evidence review is completed. This output state does not invalidate the underlying source facts."
          : gap.state ===
          "stale"
          ? "The management position relies on an older evidence basis."
          : gap.state ===
              "conflicted"
            ? "Current evidence sources disagree and cannot be silently reconciled."
            : "The current management position is less certain because required evidence is not fully established.",
      action: gap.action,
      owningModule:
        gap.owningModule,
      state: "evidence_gap",
    });
  }

  const rank = {
    critical: 0,
    high: 1,
    medium: 2,
    information: 3,
  } as const;
  return alerts
    .sort(
      (a, b) =>
        rank[a.severity] -
          rank[b.severity] ||
        a.alertId.localeCompare(
          b.alertId,
        ),
    );
}

function buildDecisions(
  input: ManagementSurfacesInput,
): ManagementDecision[] {
  return (
    input.director
      ?.managementActions ??
    []
  ).map(
    (
      description,
      index,
    ) => ({
      decisionId:
        "director-action-" +
        String(index + 1),
      description,
      accountableOwner: null,
      dueDate: null,
      requiredAuthority: null,
      dependencyParty: null,
      state: "not_assigned",
      source:
        "project_director",
    }),
  );
}

function dashboardMetrics(
  input: ManagementSurfacesInput,
): ManagementMetric[] {
  const d = input.director;
  const comparisonBasis =
    d?.schedule
      .forecastComparisonBasis ??
    "none";
  const forecastVariance =
    comparisonBasis ===
      "official_adjusted_completion"
      ? d?.schedule
          .varianceDaysToOfficialAdjustedCompletion ??
        null
      : comparisonBasis ===
          "contractual_completion"
        ? d?.schedule
            .varianceDaysToContractualCompletion ??
          null
        : comparisonBasis ===
            "submitted_programme"
          ? d?.schedule
              .varianceDaysToSubmittedProgrammeCompletion ??
            null
          : null;
  const comparisonLabel =
    comparisonBasis ===
      "official_adjusted_completion"
      ? "official adjusted completion"
      : comparisonBasis ===
          "contractual_completion"
        ? "contract completion"
        : comparisonBasis ===
            "submitted_programme"
          ? "submitted programme finish"
          : "no established comparison basis";
  const metrics:
    ManagementMetric[] = [];

  const finishMetric = (
    key: string,
    label: string,
    value: string | null,
    basis: string,
    authority:
      | "source"
      | "official"
      | "submitted"
      | "calculated"
      | "provisional"
      | "unavailable",
  ) =>
    metric({
      key,
      label,
      value,
      state:
        value
          ? authority === "official" ? "governed" : authority === "source" || authority === "submitted"
            ? "source_current"
            : authority ===
                "calculated"
              ? "calculated"
              : "provisional"
          : "unavailable",
      authority:
        value
          ? authority
          : "unavailable",
      health: "unavailable",
      basis,
      owningModule:
        key ===
          "independent-forecast-finish"
          ? "independent-forecast"
          : key ===
              "official-adjusted-finish"
            ? "eot-assessment"
            : "schedule-analytics",
    });

  metrics.push(
    finishMetric(
      "contract-finish",
      "Contract completion",
      d?.schedule
        .contractualCompletionIso ??
      null,
      "Current contractual completion, including effective amendments; authority follows the confirmed term",
      input.contractualCompletionAuthority ?? "source",
    ),
    finishMetric(
      "official-adjusted-finish",
      "Further adjusted contractual completion",
      d?.schedule
        .officialAdjustedCompletionIso ??
      null,
      "Additional adjustment after the current confirmed amendment; absence does not invalidate the current contract completion",
      "official",
    ),
    finishMetric(
      "submitted-programme-finish",
      "Submitted programme finish",
      d?.schedule
        .submittedProgrammeCompletionIso ??
      null,
      "Current submitted programme/source forecast",
      "submitted",
    ),
    metric({
      key:
        "independent-forecast-finish",
      label:
        "Calendar recalculation finish",
      value:
        d?.schedule
          .independentForecastCompletionIso ??
        null,
      state:
        d?.schedule
          .independentForecastCompletionIso
          ? "calculated"
          : "unavailable",
      authority:
        d?.schedule
          .independentForecastAuthority ===
        "deterministic"
          ? "calculated"
          : d?.schedule
              .independentForecastCompletionIso
            ? "provisional"
            : "unavailable",
      health: "unavailable",
      basis:
        "Submitted logic recalculated on its own calendars; model reconciliation, not delay",
      consequence:
        forecastVariance ===
        null
          ? "No comparison variance is stated because the required confirmed basis is not established."
          : forecastVariance === 0
            ? "Calendar-calculated finish aligns with the " +
              comparisonLabel +
              "."
            : "Calendar-calculated finish is " +
              managementDays(
                Math.abs(
                  forecastVariance,
                ),
              ) +
              " calendar days " +
              (
                forecastVariance > 0
                  ? "later than"
                  : "earlier than"
              ) +
              " the " +
              comparisonLabel +
              ".",
      action:
        forecastVariance !==
          null &&
        forecastVariance > 0
          ? "Open the calendar and source-duration reconciliation."
          : null,
      owningModule:
        "independent-forecast",
    }),
  );

  metrics.push(
    metric({
      key:
        "critical-activities",
      label:
        "Critical activities",
      value:
        d?.schedule
          .criticalCount ??
        null,
      state: d
        ? "source_current"
        : "unavailable",
      authority: d
        ? "source"
        : "unavailable",
      health: (input.negativeFloatCount ?? 0) > 0 ? "attention" : "unavailable",
      basis:
        "Execution activities with source total float ≤ 0; critical-path presence alone is not adverse health",
      consequence: input.negativeFloatCount == null ? "Negative-float exposure is not established; the critical count is inventory only."
        : String(input.negativeFloatCount) + " activities have negative float. Zero-float critical activities are not automatically adverse.",
      owningModule:
        "near-critical",
    }),
  );

  const submitted = d?.schedule.submittedProgrammeCompletionIso;
  const contractual = d?.schedule.contractualCompletionIso;
  const submittedVariance = submitted && contractual
    ? (Date.parse(submitted.slice(0, 10)) - Date.parse(contractual.slice(0, 10))) / 86_400_000 : null;
  for (const [key, label, value, basis] of [
    ["independent-vs-contract", "Calendar scenario vs contract", d?.schedule.varianceDaysToContractualCompletion ?? null, "Calendar-calculated finish minus current confirmed contract completion"],
    ["independent-vs-submitted", "Calendar scenario vs submitted programme", d?.schedule.varianceDaysToSubmittedProgrammeCompletion ?? null, "Calendar-calculated finish minus current submitted programme finish"],
    ["submitted-vs-contract", "Submitted programme vs contract", Number.isFinite(submittedVariance) ? submittedVariance : null, "Current submitted programme finish minus current confirmed contract completion"],
  ] as const) {
    metrics.push(metric({ key, label, value, unit: "calendar days", state: value === null ? "unavailable" : "calculated",
      authority: value === null ? "unavailable" : "calculated", health: key.startsWith("independent-") ? "unavailable" : healthForSignedVariance(value), basis,
      consequence: "Date variance is not attributable delay or EOT entitlement.", owningModule: "independent-forecast" }));
  }

  metrics.push(
    metric({
      key:
        "near-critical",
      label:
        "Near-critical activities",
      value:
        d?.schedule
          .nearCriticalCount ??
        null,
      state: d
        ? "calculated"
        : "unavailable",
      authority: d
        ? "calculated"
        : "unavailable",
      health: "unavailable",
      basis:
        "Strict positive float within the confirmed near-critical threshold; inventory, not a health score",
      consequence: "Review float erosion, upcoming work and driving-path evidence before assigning risk severity.",
      owningModule:
        "near-critical",
    }),
  );

  const current=d?.schedule.progressBases.baselinePlanned.valuePercent??null;
  const snapshot=d?.schedule.progressBases.scheduleSnapshot?.valuePercent??null;
  const comparable=d?.sourceInterpretation?.progressMeasures.scopeComparison;
  metrics.push(metric({key:"progress-position",label:"Progress gap · same tasks, fixed weights",value:comparable?.gapPercentagePoints??null,
    unit:"pp",state:comparable?.gapPercentagePoints!=null?"calculated":"unavailable",authority:"calculated",health:"unavailable",
    basis:comparable?.interpretation??"A matched activity population and common weights are needed before stating a progress gap.",owningModule:"progress-report"}));
  const productivity=managementForecastPosition(d);
  metrics.push(finishMetric("productivity-forecast-finish",productivity.label,productivity.completionIso,productivity.interpretation,"source"));

  metrics.push(
    metric({
      key:
        "claims-linkage",
      label:
        "Fully defensible claim chain",
      value:
        d?.claims
          .claimCount ==
          null
          ? null
          : String(
              d?.claims
                .fullyLinkedClaimCount ??
              0,
            ) +
            " / " +
            String(
              d?.claims
                .claimCount,
            ),
      state:
        d?.claims
          .evidenceState ===
        "established"
          ? "calculated"
          : "unavailable",
      authority:
        d?.claims
          .evidenceState ===
        "established"
          ? "calculated"
          : "unavailable",
      health:
        d?.claims
          .unlinkedClaimIds
          .length
          ? "attention"
          : d?.claims
                .evidenceState ===
              "established"
            ? "good"
            : "unavailable",
      basis:
        "Full chain: claim → event → activity",
      owningModule:
        "delay-claims",
    }),
  );

  metrics.push(
    metric({
      key:
        "open-risk",
      label:
        "Open confirmed risks",
      value:
        d?.controls
          .riskEvidenceState ===
        "established"
          ? d.controls
              .openRiskCount
          : null,
      state:
        d?.controls
          .riskEvidenceState ===
        "established"
          ? "source_current"
          : "unavailable",
      authority:
        d?.controls
          .riskEvidenceState ===
        "established"
          ? "source"
          : "unavailable",
      health: "unavailable",
      basis:
        "Confirmed risk evidence only",
      consequence:
        d?.controls
          .riskEvidenceState !==
        "established"
          ? d?.sourceInterpretation?.riskValidation.explanation ?? "Dated risk status and a rating method are not established."
          : "Open-risk inventory does not establish severity. Overall risk severity is not established without confirmed ratings and mitigation status.",
      action:
        d?.controls
          .riskEvidenceState !==
        "established"
          ? d?.sourceInterpretation?.riskValidation.sourceRecordCount ? "Reconcile the supplied ratings and establish status dates; the register is already loaded." : "Provide a risk register with dated status and a documented rating method."
          : null,
      owningModule: "documents",
    }),
  );

  const firstEvm =
    input.commercial
      .evmByCurrency[0] ??
    null;
  metrics.push(
    metric({
      key: "schedule-spi",
      label: "EVM Schedule Performance Index (SPI)",
      value:
        input.commercial
          .evmByCurrency.length ===
          1
          ? firstEvm?.spi ??
            null
          : null,
      state:
        input.commercial
          .evmByCurrency.length ===
          1 &&
        firstEvm?.spi !==
          null
          ? firstEvm?.state ===
              "established"
            ? "calculated"
            : "partial"
          : "unavailable",
      authority:
        input.commercial
          .evmByCurrency.length ===
          1 &&
        firstEvm?.spi !==
          null
          ? "calculated"
          : "unavailable",
      health:
        !firstEvm ||
        firstEvm.spi === null ||
        input.commercial
          .evmByCurrency.length !==
          1
          ? "unavailable"
          : firstEvm.spi < 1
            ? "attention"
            : "good",
      basis:
        "EV / PV from Cost & Forecast; earned-value schedule efficiency, not critical-path delay; no cross-currency aggregation",
      consequence:
        input.commercial
          .evmByCurrency.length >
        1
          ? "A single portfolio-style SPI is withheld because multiple currency/tax partitions exist."
          : null,
      owningModule:
        "cost-forecast",
    }),
  );

  metrics.push(
    metric({
      key:
        "contract-risk",
      label:
        "Contract risk",
      value: null,
      state: "unavailable",
      authority:
        "unavailable",
      health:
        "unavailable",
      basis:
        "Dedicated confirmed contract-risk assessment",
      consequence:
        "CMeng does not fabricate a composite contract-risk score from unrelated controls.",
      action:
        "A dedicated confirmed contract-risk assessment is not established. Review contract terms and documented exposures.",
      owningModule: "contract-particulars-bonds",
    }),
  );

  return metrics;
}

export function buildManagementSurfaces(
  input: ManagementSurfacesInput,
): ManagementSurfacesProjection {
  const consistency = input.consistency ?? { state: "pending" as const, checkCount: 0, failedCheckIds: [],
    scope: "Cross-module values, populations, Data Date, authority, configuration and version have not been checked." };
  const modules = input.modules.map(item => {
    const validated = item.calculationState === "checked" && item.consistencyState === "pass" &&
      item.evidenceState === "established" && item.professionalState === "defensible" && consistency.state === "pass";
    return { ...item, status: item.status === "blocked" ? "blocked" as const : item.status === "ready" && validated ? "ready" as const : "partial" as const,
      reason: item.reason ?? (validated ? null : "Calculation, evidence and consistency must all be checked before management readiness is established.") };
  });
  const evidenceCoverage = input.evidenceGaps.filter(item => item.key !== "board-publication");
  const evidenceGaps = evidenceCoverage.filter(item => item.state !== "established");
  const governanceGaps = input.evidenceGaps.filter(item => item.key === "board-publication" && item.state !== "established");
  const readiness = {
    ready:
      modules.filter(
        (item) =>
          item.status ===
          "ready",
      ).length,
    partial:
      modules.filter(
        (item) =>
          item.status ===
          "partial",
      ).length,
    blocked:
      modules.filter(
        (item) =>
          item.status ===
          "blocked",
      ).length,
    total:
      input.modules.length,
    calculationAvailable: input.modules.filter(item => item.status !== "blocked").length,
    evidenceGapCount: evidenceGaps.length,
    governanceGapCount: governanceGaps.length,
  };
  const alerts =
    buildAlerts(input);
  const decisions =
    buildDecisions(input);
  const metrics =
    dashboardMetrics(input);

  const masterDashboard:
    MasterDashboardProjection = {
    schemaVersion: "1.0",
    projectionKey:
      "master_dashboard",
    generatedAt:
      input.generatedAt,
    projectId:
      input.projectId,
    metrics,
    readiness,
    consistency,
    variationReconciliation: input.commercial.variationReconciliation ?? [],
    commercialByCurrency:
      input.director
        ?.commercialByCurrency ??
      [],
    evidenceDocumentCount:
      input.evidenceDocumentCount,
    diagnostics: [
      "MASTER_DASHBOARD_CONSUMES_GOVERNED_PRODUCERS_ONLY",
      "MISSING_VALUES_ARE_NOT_RENDERED_AS_ZERO",
      "COMPOSITE_RISK_SCORES_ARE_WITHHELD_UNTIL_GOVERNED_CAPABILITY_EXISTS",
    ],
  };

  const programmePosition =
    metrics.filter(
      (item) =>
        [
          "contract-finish",
          "official-adjusted-finish",
          "submitted-programme-finish",
          "independent-forecast-finish",
          "productivity-forecast-finish",
          "independent-vs-contract",
          "independent-vs-submitted",
          "submitted-vs-contract",
          "critical-activities",
          "near-critical",
          "progress-position",
          "claims-linkage",
        ].includes(
          item.key,
        ),
    );

  const commandCenter:
    CommandCenterProjection = {
    schemaVersion: "1.0",
    projectionKey:
      "command_center",
    generatedAt:
      input.generatedAt,
    projectId:
      input.projectId,
    programmePosition,
    alerts,
    decisions,
    evidenceGaps,
    governanceGaps,
    evidenceCoverage,
    consistency,
    variationReconciliation: input.commercial.variationReconciliation ?? [],
    commercialByCurrency:
      input.director
        ?.commercialByCurrency ??
      [],
    controls:
      input.director
        ?.controls ??
      null,
    diagnostics: [
      "COMMAND_CENTER_PRIORITIZES_CONTROL_EXCEPTIONS_WITHOUT_AUTO_APPROVAL",
      "UNAVAILABLE_SOURCE_DOMAINS_CREATE_EVIDENCE_GAPS_NOT_FALSE_HEALTHY_STATUS",
      "DECISION_OWNERSHIP_AND_DUE_DATES_REMAIN_UNASSIGNED_UNTIL_GOVERNED_SOURCE_EXISTS",
    ],
  };

  const masterControlProgramme:
    MasterControlProgrammeProjection = {
    schemaVersion: "1.0",
    projectionKey:
      "master_control_programme",
    generatedAt:
      input.generatedAt,
    projectId:
      input.projectId,
    scope: {
      programme: null,
      project:
        input.projectId,
      selectedPackage: null,
      programmeMembershipState:
        "not_established",
      projectClassification:
        null,
    },
    revisionAuthority: {
      ...input
        .revisionAuthority,
    },
    wbsControl: {
      ...input.wbsControl,
      observedWbsLabels: [
        ...input.wbsControl
          .observedWbsLabels,
      ],
    },
    specialistPositions:
      modules.map(
        (item) => ({
          ...item,
        }),
      ),
    alerts,
    candidateInbox:
      input.candidates.map(
        (item) => ({
          ...item,
        }),
      ),
    controlHistory:
      input.history.map(
        (item) => ({
          ...item,
        }),
      ),
    evidenceGaps,
    governanceGaps,
    evidenceCoverage,
    consistency,
    diagnostics: [
      "MCP_IS_A_GOVERNANCE_LAYER_NOT_A_SECOND_SOURCE_OF_TRUTH",
      "OBSERVED_WBS_LABELS_DO_NOT_ESTABLISH_OFFICIAL_WORK_PACKAGES",
      "AI_OR_EXTRACTED_CANDIDATES_NEVER_AUTHOR_OFFICIAL_POSITIONS_DIRECTLY",
      "SPECIALIST_MODULES_REMAIN_OWNERS_OF_CORRECTION",
    ],
  };

  return {
    schemaVersion: "1.0",
    projectionKey:
      "management_surfaces",
    generatedAt:
      input.generatedAt,
    projectId:
      input.projectId,
    masterDashboard,
    commandCenter,
    masterControlProgramme,
  };
}
