import { parseScheduleTime, activityNearCriticalThresholdHours, isExecutionActivity, scheduleProgress } from "../../schedule-analysis-core/src";
import { projectScheduleControlBasis } from "./schedule-control-basis";
import type {
  ChallengeValue,
  DocumentAssertion,
  IndependentMetricSpec,
  ModuleChallengeEnvelope,
} from "../../module-challenge/src";
import {
  buildModuleChallenge,
} from "../../module-challenge/src";
import type {
  DeliveryChallengeProjection,
} from "../../delivery-challenge/src";
import type {
  IndependentForecastProjection,
} from "../../independent-forecast/src";
import type {
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import type {
  ProjectRuntimeState,
  ModuleRuntimeResult,
} from "./project-state-types";

interface ChallengeContext {
  state: ProjectRuntimeState;
  generatedAt: string;
  model: CanonicalScheduleModel;
  independentForecast:
    IndependentForecastProjection;
  deliveryChallenge:
    DeliveryChallengeProjection;
  modules:
    Map<string, ModuleRuntimeResult>;
}

function allAssertions(
  state: ProjectRuntimeState,
): DocumentAssertion[] {
  return state.evidenceDocuments
    .flatMap(
      (document) =>
        (
          document.assertions ??
          []
        ).map(
          (assertion) => ({
            ...assertion,
            documentId:
              document.documentId,
            evidenceBasisState:
              document.basisState,
            uploadedAt:
              document.uploadedAt,
            basisRevisionId:
              document
                .linkedArtifactId ??
              null,
            sourceAuthority:
              document.basisState ===
                "active"
                ? "governed"
                : document.basisState ===
                    "additive"
                  ? "candidate"
                  : document.basisState ===
                      "superseded"
                    ? "submitted"
                    : document.basisState ===
                        "scenario"
                      ? "scenario"
                      : "candidate",
          }),
        ),
    );
}

function submitted(
  value:
    | number
    | string
    | null,
  unit: string | null,
  sourceRefs: string[],
  note: string,
  input: {
    basisRevisionId?:
      string | null;
    coveragePercent?:
      number | null;
    asOfIso?:
      string | null;
    confidence?:
      number | null;
    authority?:
      ChallengeValue["authority"];
  } = {},
): ChallengeValue {
  return value === null
    ? {
        state:
          "not_submitted",
        value: null,
        unit,
        authority:
          "missing",
        sourceRefs,
        basisRevisionId:
          input
            .basisRevisionId ??
          null,
        coveragePercent:
          input
            .coveragePercent ??
          null,
        asOfIso:
          input.asOfIso ??
          null,
        confidence: null,
        diagnostics: [
          "SUBMITTED_VALUE_NOT_ESTABLISHED",
        ],
        note,
      }
    : {
        state: "submitted",
        value,
        unit,
        authority:
          input.authority ??
          "submitted",
        sourceRefs,
        basisRevisionId:
          input
            .basisRevisionId ??
          null,
        coveragePercent:
          input
            .coveragePercent ??
          null,
        asOfIso:
          input.asOfIso ??
          null,
        confidence:
          input.confidence ??
          1,
        diagnostics: [],
        note,
      };
}

function dataOf(
  modules:
    Map<string, ModuleRuntimeResult>,
  key: string,
): any {
  return modules.get(key)
    ?.data as any;
}

function numberOrNull(
  value: unknown,
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

function stringOrNull(
  value: unknown,
): string | null {
  return typeof value ===
    "string"
    ? value
    : null;
}

function spec(
  metric: string,
  label: string,
  value:
    | number
    | string
    | null,
  unit: string | null,
  state:
    IndependentMetricSpec["state"],
  sourceRefs: string[],
  input: {
    comparisonBasisEstablished?: boolean;
    submittedOverride?:
      ChallengeValue | undefined;
    tolerance?:
      number | undefined;
    note?:
      string | undefined;
    consequenceDifferent?:
      string | undefined;
    consequenceMissing?:
      string | undefined;
    actionDifferent?:
      string | undefined;
    actionMissing?:
      string | undefined;
    submittedReasonableMin?:
      number | undefined;
    submittedReasonableMax?:
      number | undefined;
    submittedReasonablenessNote?:
      string | undefined;
    authority?:
      ChallengeValue["authority"] | undefined;
    basisRevisionId?:
      string | null | undefined;
    coveragePercent?:
      number | null | undefined;
    asOfIso?:
      string | null | undefined;
    confidence?:
      number | null | undefined;
    diagnostics?:
      string[] | undefined;
  } = {},
): IndependentMetricSpec {
  const requirements:Record<string,string>={
    manpower_average:'A periodised headcount plan, confirmed hours per person and a reconciled remaining-work scope are needed for an independent manpower requirement.',
    manpower_peak:'A periodised headcount and shift plan is needed to establish peak people. Resource hours alone do not establish people.',
    remaining_manhours:'Remaining quantities, unit productivity and schedule links on a common scope are needed for an independent remaining-hours estimate. XER and weekly-register source hours remain separate.',
    certified_progress_percent:'An independent certified quantity and valuation basis is needed. Schedule percentage is not a certification measurement.',
    claimed_delay_days:'Event dates, affected-activity links, responsibility and causal time impact are needed to independently assess the submitted claimed days.',
    claimed_eot_days:'Event dates, affected-activity links, responsibility and the applicable contract evidence are needed for an independent time-impact assessment.',
    attributable_eot_candidate_days:'Eligible causal events, affected activities, notice evidence and responsibility are needed before time impact can be attributed.',
  };
  const dependency=state==='not_derivable'&&value===null?requirements[metric]:undefined;
  const sourceAuthorityOnly=state==='not_derivable'&&metric==='official_awarded_eot_days';
  return {
    metric,
    ...(input.comparisonBasisEstablished!==undefined?{comparisonBasisEstablished:input.comparisonBasisEstablished}:{}),
    label,
    value,
    unit,
    state,
    sourceRefs,
    basisRevisionId:
      input.basisRevisionId ??
      (
        sourceRefs.some(
          (ref) =>
            ref.startsWith(
              "schedule-revision:",
            ),
        )
          ? sourceRefs
              .find(
                (ref) =>
                  ref.startsWith(
                    "schedule-revision:",
                  ),
              )
              ?.slice(
                "schedule-revision:"
                  .length,
              ) ??
            null
          : null
      ),
    coveragePercent:
      input.coveragePercent ??
      null,
    asOfIso:
      input.asOfIso ??
      null,
    ...(input.authority
      ? {
          authority:
            input.authority,
        }
      : {}),
    ...(input.confidence !==
    undefined
      ? {
          confidence:
            input.confidence,
        }
      : {}),
    diagnostics:[...(input.diagnostics??[]),...(dependency?['COMPARISON_INPUT_REQUIRED:'+dependency]:[]),...(sourceAuthorityOnly?['SOURCE_AUTHORITY_ONLY']:[])],
    ...(input.submittedOverride
      ? {
          submittedOverride:
            input.submittedOverride,
        }
      : {}),
    ...(input.tolerance !==
    undefined
      ? {
          tolerance:
            input.tolerance,
        }
      : {}),
    ...(input.note
      ? { note: input.note }
      : {}),
    ...(input.submittedReasonableMin !==
    undefined
      ? {
          submittedReasonableMin:
            input.submittedReasonableMin,
        }
      : {}),
    ...(input.submittedReasonableMax !==
    undefined
      ? {
          submittedReasonableMax:
            input.submittedReasonableMax,
        }
      : {}),
    ...(input.submittedReasonablenessNote
      ? {
          submittedReasonablenessNote:
            input.submittedReasonablenessNote,
        }
      : {}),
    consequenceWhenDifferent:
      input.consequenceDifferent ??
      (
        "The submitted " +
        label.toLowerCase() +
        " differs from the calculation on the stated comparison basis; investigate the source and method before deciding which position is supportable."
      ),
    consequenceWhenMissing:
      input.consequenceMissing ??
      (
        "No separate submitted report value is established for " +
        label.toLowerCase() +
        ". Available source records and the derived result remain valid on their stated basis; a like-for-like report comparison is pending."
      ),
    actionWhenDifferent:
      input.actionDifferent ??
      (
        "Reconcile the submitted " +
        label.toLowerCase() +
        " to the underlying project evidence and explain the variance."
      ),
    actionWhenMissing:
      input.actionMissing ??
      (
        "Reconcile the source fields, population, definition and reporting date for " +
        label.toLowerCase() +
        ". Obtain a separate report value only if an external comparison is required."
      ),
  };
}

function latestPoint(
  value: any,
): any | null {
  const points =
    value?.points;
  return Array.isArray(points) &&
    points.length > 0
    ? points[
        points.length - 1
      ]
    : null;
}

function scheduleSpanDays(
  model: CanonicalScheduleModel,
): number | null {
  let earliest: number | null = null;
  let latest: number | null = null;

  for (const activity of model.activities) {
    const starts = [
      activity.baselineStartIso,
      activity.currentStartIso,
      activity.actualStartIso,
      activity.forecastStartIso,
    ];
    const finishes = [
      activity.baselineFinishIso,
      activity.currentFinishIso,
      activity.actualFinishIso,
      activity.forecastFinishIso,
    ];

    for (const value of starts) {
      if (!value) continue;
      const parsed = parseScheduleTime(value);
      if (!Number.isFinite(parsed)) {
        continue;
      }
      earliest =
        earliest === null
          ? parsed
          : Math.min(
              earliest,
              parsed,
            );
    }

    for (const value of finishes) {
      if (!value) continue;
      const parsed = parseScheduleTime(value);
      if (!Number.isFinite(parsed)) {
        continue;
      }
      latest =
        latest === null
          ? parsed
          : Math.max(
              latest,
              parsed,
            );
    }
  }

  if (
    earliest === null ||
    latest === null ||
    latest <= earliest
  ) {
    return null;
  }

  return Number(
    (
      (latest - earliest) /
      86_400_000
    ).toFixed(6),
  );
}

function claimedDaysOverride(
  state: ProjectRuntimeState,
  model: CanonicalScheduleModel,
): ChallengeValue | undefined {
  const claims =
    state.controls
      .delayClaims?.claims ??
    [];

  const known =
    claims
      .filter(
        (claim) =>
          typeof claim.claimedDays ===
            "number" &&
          Number.isFinite(
            claim.claimedDays,
          ),
      )
      .map(
        (claim) => ({
          claimId:
            claim.claimId,
          days:
            claim.claimedDays!,
          sourceRefs:
            claim.evidenceRefs
              .map(
                (ref) =>
                  [
                    ref.sourceType,
                    ref.sourceId,
                    ref.locator,
                  ].join(":"),
              ),
        }),
      );

  if (known.length === 0) {
    return undefined;
  }

  const rawSum =
    Number(
      known
        .reduce(
          (sum, claim) =>
            sum +
            claim.days,
          0,
        )
        .toFixed(6),
    );

  const span =
    scheduleSpanDays(model);
  const maximumReasonable =
    span === null
      ? 3650
      : Math.max(
          365,
          span * 2,
        );

  const alternatives =
    known
      .map(
        (claim) => {
          const outlier =
            claim.days < 0 ||
            claim.days >
              maximumReasonable;
          return {
            value:
              claim.days,
            unit: "days",
            authority:
              "submitted" as const,
            sourceRefs:
              claim.sourceRefs.length >
              0
                ? [
                    ...claim
                      .sourceRefs,
                  ]
                : [
                    "claim:" +
                      claim.claimId,
                  ],
            basisRevisionId:
              state.controls
                .delayClaims
                ?.evidenceRevisionId ??
              null,
            asOfIso: null,
            confidence:
              outlier
                ? 0.25
                : 1,
            supportCount: 1,
            evidenceScore:
              outlier
                ? 5
                : 30,
            reasons: [
              "Submitted claim " +
                claim.claimId +
                " states " +
                claim.days +
                " days.",
              ...(outlier
                ? [
                    "This value fails the project-duration reasonableness check.",
                  ]
                : [
                    "This value is within the project-duration reasonableness envelope.",
                  ]),
            ],
          };
        },
      )
      .sort(
        (a, b) =>
          (
            b.evidenceScore ??
            0
          ) -
            (
              a.evidenceScore ??
              0
            ) ||
          a.value -
            b.value,
      );

  const recommended =
    alternatives[0]!;
  const anyOutlier =
    alternatives.some(
      (candidate) =>
        candidate.confidence !==
          null &&
        candidate.confidence <
          1,
    );
  const rawSumOutlier =
    rawSum >
    maximumReasonable;

  if (
    known.length > 1 ||
    anyOutlier ||
    rawSumOutlier
  ) {
    return {
      state:
        "conflicted",
      value:
        recommended.value,
      unit: "days",
      authority:
        "submitted",
      sourceRefs: [
        ...new Set(
          alternatives.flatMap(
            (candidate) =>
              candidate
                .sourceRefs,
          ),
        ),
      ],
      basisRevisionId:
        state.controls
          .delayClaims
          ?.evidenceRevisionId ??
        null,
      coveragePercent:
        null,
      asOfIso: null,
      confidence:
        recommended.confidence,
      diagnostics: [
        "CLAIM_TOTAL_REQUIRES_DEDUPLICATION_AND_OVERLAP_REVIEW",
        ...(anyOutlier ||
        rawSumOutlier
          ? [
              "CLAIM_VALUE_REASONABLENESS_FAILED",
            ]
          : []),
        "CONFLICT_RECOMMENDATION_IS_NOT_GOVERNED_UNTIL_USER_DECISION",
      ],
      note:
        "The claim register contains multiple/contradictory day values. Raw arithmetic sum=" +
        rawSum +
        " days is retained for audit only and is not treated as project EOT because claims may overlap or duplicate events. CMeng evaluates every claim value separately against the independent time-impact result.",
      resolution:
        "unresolved_conflict",
      alternatives,
    };
  }

  return {
    state:
      "submitted",
    value:
      recommended.value,
    unit: "days",
    authority:
      "submitted",
    sourceRefs: [
      ...recommended
        .sourceRefs,
    ],
    basisRevisionId:
      state.controls
        .delayClaims
        ?.evidenceRevisionId ??
      null,
    coveragePercent:
      null,
    asOfIso: null,
    confidence: 1,
    diagnostics: [],
    note:
      "Single submitted claim value. This remains a claimed position, not an assessed or awarded EOT.",
    resolution: "single",
    alternatives,
  };
}

function baseCrewScenario(
  challenge:
    DeliveryChallengeProjection,
) {
  return (
    challenge
      .manpowerChallenge
      .scheduleDerivedScenarios
      .find(
        (row) =>
          row.crewSize === 6,
      ) ??
    challenge
      .manpowerChallenge
      .scheduleDerivedScenarios[0] ??
    null
  );
}

function metricsFor(
  key: string,
  ctx: ChallengeContext,
): IndependentMetricSpec[] {
  const {
    state,
    model,
    modules,
    independentForecast:
      forecast,
    deliveryChallenge:
      delivery,
  } = ctx;

  const schedule =
    dataOf(
      modules,
      "schedule-analytics",
    );
  const progress =
    dataOf(
      modules,
      "progress-report",
    );
  const milestones =
    dataOf(
      modules,
      "milestones",
    );
  const nearCritical =
    dataOf(
      modules,
      "near-critical",
    );
  const lookAhead =
    dataOf(
      modules,
      "lookahead-schedule",
    );
  const resource =
    dataOf(
      modules,
      "resource-utilization",
    );
  const manhour =
    dataOf(
      modules,
      "manhour-scurve",
    );
  const quantity =
    dataOf(
      modules,
      "quantity-scurve",
    );
  const revision =
    dataOf(
      modules,
      "revision-trend",
    );
  const variance =
    dataOf(
      modules,
      "variance-trends",
    );
  const scurve =
    dataOf(
      modules,
      "progress-scurve",
    );
  const history =
    dataOf(
      modules,
      "forecast-history",
    );
  const delay =
    dataOf(
      modules,
      "delay-claims",
    );
  const notices =
    dataOf(
      modules,
      "notices-claims",
    );
  const windows =
    dataOf(
      modules,
      "windows-analysis",
    );
  const eot =
    dataOf(
      modules,
      "eot-assessment",
    );
  const change =
    dataOf(
      modules,
      "schedule-change-report",
    );
  const pmo =
    dataOf(
      modules,
      "pmo-analysis",
    );

  const sourceRef =
    "schedule-revision:" +
    ctx.model.sourceRevisionId;
  const sourceRevisionId =
    ctx.model.sourceRevisionId;
  const dataDateIso =
    ctx.model.dataDateIso;
  const contractorProgress =
    progress?.progressBases
      ?.contractorReported;
  const certifiedProgress =
    progress?.progressBases
      ?.certified;
  const baseCrew =
    baseCrewScenario(
      delivery,
    );
  const claimedDays =
    claimedDaysOverride(
      state,
      ctx.model,
    );

  switch (key) {
    case "schedule-analytics":
      return [
        spec(
          "activity_count",
          "Activity count",
          numberOrNull(
            schedule?.result
              ?.activityCount,
          ),
          "activities",
          "calculated",
          [sourceRef],
        ),
        spec(
          "relationship_count",
          "Relationship count",
          numberOrNull(
            schedule?.result
              ?.relationshipCount,
          ),
          "relationships",
          "calculated",
          [sourceRef],
        ),
        spec(
          "critical_count",
          "Critical activity count",
          numberOrNull(
            schedule?.result
              ?.float
              ?.criticalCount,
          ),
          "activities",
          "calculated",
          [sourceRef],
        ),
        spec(
          "near_critical_count",
          "Near-critical activity count",
          numberOrNull(
            schedule?.result
              ?.float
              ?.nearCriticalCount,
          ),
          "activities",
          "calculated",
          [sourceRef],
        ),
        spec(
          "negative_float_count",
          "Negative-float activity count",
          numberOrNull(
            schedule?.result
              ?.float
              ?.negativeFloatCount,
          ),
          "activities",
          "calculated",
          [sourceRef],
        ),
      ];

    case "activity-analytics":
      return [
        spec(
          "activity_count",
          "Activity population",
          numberOrNull(
            dataOf(
              modules,
              key,
            )?.activityCount,
          ),
          "activities",
          "calculated",
          [sourceRef],
        ),
        spec(
          "progress_percent",
          "Duration-weighted activity progress",
          scheduleProgress(model.activities).value,
          "%",
          "derived",
          [sourceRef],
          {
            note:
              "Independent aggregate derived from activity durations and activity progress evidence.",
          },
        ),
      ];

    case "resource-utilization":
      return [
        spec(
          "manpower_average",
          "Average manpower required",
          delivery
            .manpowerChallenge
            .requiredAverageManpowerToContract ??
          baseCrew
            ?.averageManpower ??
          null,
          "people",
          delivery
            .manpowerChallenge
            .requiredAverageManpowerToContract !==
            null
            ? "derived"
            : baseCrew
              ?.averageManpower !==
                null &&
                baseCrew
                  ?.averageManpower !==
                  undefined
                ? "scenario"
                : "not_derivable",
          [
            sourceRef,
            "delivery-challenge",
          ],
          {
            submittedOverride:
              submitted(
                delivery
                  .manpowerChallenge
                  .submittedAverageManpower,
                "people",
                state
                  .submittedManpowerPlan
                  ?.sourceRefs ??
                [],
                "Contractor submitted manpower plan.",
              ),
            consequenceMissing:
              "No contractor manpower plan was submitted; CMeng has still derived the strongest supportable manpower requirement/scenario.",
            actionMissing:
              "Submit a periodised manpower plan by trade/work front and reconcile it to the independent requirement.",
          },
        ),
        spec(
          "manpower_peak",
          "Peak manpower",
          baseCrew
            ?.peakManpower ??
          delivery
            .manpowerChallenge
            .submittedPeakManpower ??
          null,
          "people",
          baseCrew
            ?.peakManpower !==
              null &&
              baseCrew
                ?.peakManpower !==
                undefined
            ? "scenario"
            : "not_derivable",
          [
            sourceRef,
            "delivery-challenge",
          ],
          {
            submittedOverride:
              submitted(
                delivery
                  .manpowerChallenge
                  .submittedPeakManpower,
                "people",
                state
                  .submittedManpowerPlan
                  ?.sourceRefs ??
                [],
                "Contractor submitted peak manpower.",
              ),
          },
        ),
      ];

    case "lookahead-schedule":
      return [
        spec(
          "lookahead_activity_count",
          "Look-ahead activity count",
          Array.isArray(
            lookAhead?.rows,
          )
            ? lookAhead.rows.length
            : null,
          "activities",
          "calculated",
          [sourceRef],
          {
            consequenceMissing: "The schedule-derived look-ahead is established; a separate submitted look-ahead register is not available for an identity-level comparison.",
            actionMissing: "If a submitted look-ahead register is required, reconcile its activity IDs, window dates and readiness evidence with this view.",
            consequenceDifferent:
              "The contractor look-ahead does not represent the same activity population as the schedule-derived look-ahead.",
            actionDifferent:
              "Reconcile omitted/extra look-ahead activities against the current schedule and readiness evidence.",
          },
        ),
      ];

    case "progress-report":
      return [
        spec(
          "progress_percent",
          "Schedule progress",
          numberOrNull(
            progress?.progress
              ?.durationWeightedProgressPercent,
          ),
          "%",
          "derived",
          [sourceRef],
          {
            submittedOverride:
              contractorProgress
                ?.state ===
                "established"
                ? submitted(
                    contractorProgress
                      .valuePercent,
                    "%",
                    contractorProgress
                      .sourceRefs ??
                      [],
                    "Contractor-reported progress.",
                  )
                : undefined,
            tolerance: 0.01,
          },
        ),
        spec(
          "certified_progress_percent",
          "Certified progress",
          null,
          "%",
          "not_derivable",
          [],
          {
            submittedOverride:
              certifiedProgress
                ?.state ===
                "established"
                ? submitted(
                    certifiedProgress
                      .valuePercent,
                    "%",
                    certifiedProgress
                      .sourceRefs ??
                      [],
                    "Certified progress evidence.",
                  )
                : undefined,
            note:
              "CMeng does not relabel schedule-derived percentage complete as an independent certified-progress measurement.",
            consequenceMissing:
              certifiedProgress
                ?.state ===
                "established"
                ? "Certified progress exists as a governed source position, but no separate independent certification measurement is available for a like-for-like check."
                : "Certified progress has not been provided.",
            actionMissing:
              certifiedProgress
                ?.state ===
                "established"
                ? "Retain the certified source value as the certified position and reconcile it separately to schedule and physical-progress evidence."
                : "Provide the certified progress record if certification is required for the management position.",
          },
        ),
      ];

    case "schedule-change-report": {
      const independentChanges =
        numberOrNull(
          change
            ?.addedActivityCount,
        ) !== null
          ? (
              (change
                .addedActivityCount ??
                0) +
              (change
                .removedActivityCount ??
                0) +
              (change
                .modifiedActivityCount ??
                0)
            )
          : null;
      return [
        spec(
          "schedule_change_count",
          "Schedule changes disclosed",
          independentChanges,
          "changes",
          independentChanges ===
            null
            ? "not_derivable"
            : "calculated",
          [
            "schedule-revision-history",
          ],
          {
            consequenceMissing:
              change?.state ===
                "insufficient_history"
                ? "A second schedule revision is required to independently test schedule changes."
                : "The contractor did not provide a comparable disclosure of schedule changes; CMeng has independently identified the actual changed population.",
            actionMissing:
              change?.state ===
                "insufficient_history"
                ? "Provide a second schedule revision."
                : "Submit the contractor change narrative/register and reconcile it to the field-level revision comparison.",
          },
        ),
      ];
    }

    case "revision-trend": {
      const latest =
        latestPoint(
          revision,
        );
      return [
        spec(
          "completion_date",
          "Latest forecast completion",
          forecast
            .independentForecastCompletionIso,
          null,
          forecast
            .independentForecastCompletionIso
            ? "calculated"
            : "not_derivable",
          [sourceRef],
          {
            submittedOverride:
              submitted(
                stringOrNull(
                  latest
                    ?.forecastCompletionIso,
                ) ??
                forecast
                  .sourceForecastCompletionIso,
                null,
                [sourceRef],
                "Forecast date carried by the contractor programme.",
              ),
          },
        ),
      ];
    }

    case "variance-trends": {
      const latest =
        latestPoint(
          variance,
        );
      return [
        spec(
          "schedule_variance_days",
          "Project finish-date movement",
          numberOrNull(
            latest
              ?.projectCompletionVarianceDays,
          ),
          "days",
          "calculated",
          [
            "schedule-revision-history",
          ],
        ),
      ];
    }

    case "progress-scurve": {
      return [
        spec(
          "progress_percent",
          "Duration-weighted schedule snapshot",
          scheduleProgress(model.activities).value,
          "%",
          "derived",
          [
            sourceRef,
            "progress-scurve",
          ],
          {
            submittedOverride:
              contractorProgress
                ?.state ===
                "established"
                ? submitted(
                    contractorProgress
                      .valuePercent,
                    "%",
                    contractorProgress
                      .sourceRefs ??
                      [],
                    "Contractor reported progress.",
                  )
                : undefined,
          },
        ),
      ];
    }

    case "quantity-scurve": {
      const mappingCoverage = numberOrNull(quantity?.itemLinkCoveragePercent);
      return [spec("quantity_mapping_coverage", "BOQ item-to-schedule link coverage", mappingCoverage, "%",
        quantity?.mappingBasis === "candidate_scenario" ? "scenario" : mappingCoverage === null ? "not_derivable" : "derived",
        ["BOQ", sourceRef], {
          consequenceMissing: state.quantities ? "BOQ quantities are loaded. A separate submitted crosswalk coverage statement is absent; candidate links remain scenarios." : "A BOQ quantity basis is not established.",
          actionMissing: state.quantities ? "Review candidate links and govern a quantity-to-activity crosswalk. Dated installed measurements may be assessed independently of that mapping." : "Provide the BOQ quantity ledger and its source units.",
        })];
    }

    case "progress-breakdown":
      return [
        spec(
          "progress_percent",
          "Project progress represented by WBS breakdown",
          scheduleProgress(model.activities).value,
          "%",
          "derived",
          [sourceRef],
          {
            consequenceMissing: "The WBS schedule snapshot is calculated from submitted activities. A separate WBS progress report is not established.",
            actionMissing: "Obtain a separate WBS progress report only for an external comparison; retain its measurement, coverage and authority separately from schedule progress.",
            submittedOverride:
              contractorProgress
                ?.state ===
                "established"
                ? submitted(
                    contractorProgress
                      .valuePercent,
                    "%",
                    contractorProgress
                      .sourceRefs ??
                      [],
                    "Contractor reported progress.",
                  )
                : undefined,
          },
        ),
      ];

    case "milestones":
      return [
        spec(
          "milestone_count",
          "Milestone count",
          numberOrNull(
            milestones
              ?.milestoneCount,
          ),
          "milestones",
          "calculated",
          [sourceRef],
        ),
        spec(
          "late_milestone_count",
          "Late open milestones",
          numberOrNull(
            milestones
              ?.lateOpenCount,
          ),
          "milestones",
          "calculated",
          [sourceRef],
        ),
      ];

    case "near-critical": {
      const config = projectScheduleControlBasis(state).analysisConfig;
      const sourceById = new Map(model.activities.filter(isExecutionActivity).map(a=>[a.activityId,a]));
      const independentRows = forecast.activities.filter(row=>sourceById.has(row.activityId));
      const independentCount = !forecast.complete || !independentRows.length || independentRows.some(row=>row.independentTotalFloatHours===null||activityNearCriticalThresholdHours(model,sourceById.get(row.activityId)!,config)===null) ? null : independentRows.filter(row=>{
        const activity = sourceById.get(row.activityId)!;
        const threshold = activityNearCriticalThresholdHours(model, activity, config);
        return threshold !== null && row.independentTotalFloatHours !== null && row.independentTotalFloatHours > config.criticalFloatThresholdHours && row.independentTotalFloatHours <= threshold;
      }).length;
      return [
        spec(
          "near_critical_count",
          "Near-critical activity count",
          independentCount,
          "activities",
          independentCount === null
            ? "not_derivable"
            : "calculated",
          [
            "independent-cpm",
          ],
          {
            submittedOverride: submitted(numberOrNull(nearCritical?.nearCriticalCount), "activities", [sourceRef],
              "Strict near-critical count recalculated from submitted float under the governed threshold. The source-labelled watchlist is reconciled separately.", { authority: "derived", basisRevisionId: model.sourceRevisionId, asOfIso: model.dataDateIso }),
            note:
              independentCount === null
                ? "An independently comparable CPM classification is not established; submitted float remains visible."
                : undefined,
          },
        ),
      ];
    }

    case "manhour-scurve": {
      const durationDays =
        delivery
          .scheduleChallenge
          .remainingDurationDays;
      const baseManpower =
        baseCrew
          ?.averageManpower ??
        null;
      const scenarioHours =
        durationDays !== null &&
        durationDays > 0 &&
        baseManpower !== null
          ? Number(
              (
                durationDays *
                baseManpower *
                8
              ).toFixed(4),
            )
          : null;
      return [
        spec(
          "remaining_manhours",
          "Remaining labor-hours",
          delivery
            .manpowerChallenge
            .evidenceRemainingLaborHours ??
          scenarioHours,
          "hours",
          delivery
            .manpowerChallenge
            .evidenceRemainingLaborHours !==
            null
            ? "derived"
            : scenarioHours !==
                null
              ? "scenario"
              : "not_derivable",
          [
            sourceRef,
            "delivery-challenge",
          ],
          {
            submittedOverride:
              manhour &&
              typeof manhour
                .remainingHoursKnown ===
                "number"
                ? submitted(
                    manhour
                      .remainingHoursKnown,
                    "hours",
                    [
                      "resource-assignments",
                    ],
                    "Remaining labor hours carried by contractor resource assignments.",
                  )
                : undefined,
            note:
              scenarioHours !== null
                ? "Fallback assumes 8 hours/person/day and the base 6-person concurrent-work-front scenario."
                : undefined,
          },
        ),
      ];
    }

    case "forecast-history": {
      const latest =
        latestPoint(
          history,
        );
      return [
        spec(
          "completion_date",
          "Forecast finish",
          stringOrNull(
            latest
              ?.independentForecastCompletionIso,
          ),
          null,
          latest
            ?.independentForecastCompletionIso
            ? "calculated"
            : "not_derivable",
          [
            "independent-forecast-history",
          ],
          {
            submittedOverride:
              submitted(
                stringOrNull(
                  latest
                    ?.sourceForecastCompletionIso,
                ),
                null,
                [sourceRef],
                "Contractor forecast from the source schedule revision.",
              ),
          },
        ),
      ];
    }

    case "independent-forecast":
      return [
        spec(
          "completion_date",
          "Finish date",
          forecast
            .independentForecastCompletionIso,
          null,
          forecast
            .independentForecastCompletionIso
            ? "calculated"
            : "not_derivable",
          [
            "independent-cpm",
          ],
          {
            submittedOverride:
              submitted(
                forecast
                  .sourceForecastCompletionIso,
                null,
                [sourceRef],
                "Contractor/source programme forecast finish.",
              ),
            consequenceDifferent:
              "The submitted finish date is not reproduced by CMeng's independent CPM calculation.",
            actionDifferent:
              "Reconcile logic, calendars, remaining durations and constraints before relying on either finish date for management decisions.",
          },
        ),
      ];

    case "delay-claims": {
      const observedMovement =
        numberOrNull(
          delay
            ?.observedPositiveProgrammeMovementDays,
        ) ??
        numberOrNull(
          windows
            ?.positiveProgrammeMovementDays,
        ) ??
        numberOrNull(
          delay
            ?.observedPositiveIndependentMovementDays,
        ) ??
        numberOrNull(
          windows
            ?.positiveIndependentMovementDays,
        );

      return [
        spec(
          "observed_programme_movement_days",
          "Observed programme movement",
          observedMovement,
          "days",
          observedMovement !== null
            ? "derived"
            : "not_derivable",
          [
            "schedule-windows",
            "programme-movement",
          ],
          {
            note:
              "Observed programme movement is a schedule comparison only. It is not a finding of delay causation, responsibility or entitlement.",
            consequenceMissing:
              "A comparable contractor programme-movement position was not submitted.",
            actionMissing:
              "Use delay events and affected-activity links to test causation separately from the observed schedule movement.",
          },
        ),
        spec(
          "claimed_delay_days",
          "Claimed delay days",
          null,
          "days",
          "not_derivable",
          [],
          {
            submittedOverride:
              claimedDays,
            note:
              "Claimed days remain a submitted claim position until governed delay events, responsibility and affected activities support an independent assessment.",
            consequenceMissing:
              claimedDays?.value !== null &&
              claimedDays?.value !== undefined
                ? "Claimed days are recorded, but no like-for-like independent assessed delay value is established from the current event linkage."
                : "No claimed-delay value is established.",
            actionMissing:
              "Link each claim to governed delay events and affected programme activities before comparing claimed days with an independent assessment.",
          },
        ),
      ];
    }

    case "notices-claims": {
      const assessed =
        numberOrNull(
          notices
            ?.officialAssessedDaysTotal,
        ) ??
        numberOrNull(
          notices
            ?.provisionalOrCandidateAssessedDaysTotal,
        );

      return [
        spec(
          "claimed_eot_days",
          "Claimed versus assessed claim days",
          assessed,
          "days",
          assessed !== null
            ? "derived"
            : "not_derivable",
          assessed !== null
            ? [
                "notice-claim-evidence",
              ]
            : [],
          {
            submittedOverride:
              claimedDays,
            note:
              assessed !== null
                ? "Assessed/candidate claim days come from claim assessment evidence. Schedule movement is deliberately not substituted as a notice/claim assessment."
                : "No governed or candidate assessed-days value is established. Schedule movement is not used as a replacement for claim assessment.",
            consequenceMissing:
              "Claimed days cannot be compared with a like-for-like assessed claim value from the current notice/claim evidence.",
            actionMissing:
              "Provide or govern the claim assessment and link the claim to applicable events, notices and clauses.",
          },
        ),
      ];
    }

    case "windows-analysis": {
      const latest =
        Array.isArray(
          windows?.windows,
        ) &&
        windows.windows.length >
          0
          ? windows.windows[
              windows.windows
                .length - 1
            ]
          : null;
      return [
        spec(
          "window_movement_days",
          "Latest window forecast movement",
          numberOrNull(latest?.independentForecastMovementDays),
          "days",
          latest
            ? "calculated"
            : "not_derivable",
          [
            "schedule-revision-history",
          ],
          {
            comparisonBasisEstablished:false,
            submittedOverride:
              latest
                ? submitted(
                    numberOrNull(
                      latest
                        .sourceForecastMovementDays,
                    ),
                    "days",
                    [
                      "source-schedule-revisions",
                    ],
                    "Movement of the contractor/source forecast across the same window.",
                  )
                : undefined,
            note: "Numeric equality is a diagnostic only. No approved window materiality tolerance or common calendar basis is established by this comparison.",
            consequenceDifferent: "Source and independent window movement differ; materiality and causation require review against an approved tolerance and common time basis.",
            actionDifferent: "Reconcile the source and independent window time bases and establish the approved materiality tolerance before accepting or rejecting the submitted movement.",
            consequenceMissing:
              "A comparative window cannot be calculated until at least two schedule revisions exist.",
            actionMissing:
              "Provide the previous/current programme revisions required for window comparison.",
          },
        ),
      ];
    }

    case "eot-assessment": {
      const analyticalTimeImpact =
        numberOrNull(
          eot
            ?.analyticalTimeImpactCandidateDays,
        );
      const attributableCandidate =
        numberOrNull(
          eot
            ?.attributableCandidateEotDays,
        ) ??
        numberOrNull(
          eot
            ?.candidateAdditionalEotDays,
        );
      const officialAward =
        state.controls
          .contractTimeBasis
          ?.officialApprovedEotDays ??
        null;

      return [
        spec(
          "claimed_eot_days",
          "Claimed EOT vs analytical time impact",
          analyticalTimeImpact,
          "days",
          analyticalTimeImpact !==
            null
            ? "scenario"
            : "not_derivable",
          [
            "programme-movement",
            "schedule-windows",
          ],
          {
            submittedOverride:
              claimedDays,
            note:
              analyticalTimeImpact !==
                null
                ? "Analytical time impact is shown only where causal event evidence supports a candidate assessment; it is not an official award."
                : undefined,
            consequenceMissing:
              analyticalTimeImpact !==
                null
                ? "A quantified analytical time-impact candidate exists for further causation and entitlement testing."
                : "Neither a reliable claimed-EOT position nor a defensible time-impact candidate is currently established.",
            actionMissing:
              analyticalTimeImpact !==
                null
                ? "Provide/link event, notice, clause and affected-activity evidence so CMeng can test causation, concurrency and entitlement against the quantified movement."
                : "Provide the schedule revisions and event evidence required to calculate movement.",
          },
        ),
        spec(
          "attributable_eot_candidate_days",
          "Attributable analytical EOT candidate",
          attributableCandidate,
          "days",
          attributableCandidate !==
            null
            ? "derived"
            : analyticalTimeImpact !==
                null
              ? "scenario"
              : "not_derivable",
          [
            "programme-movement",
            "delay-event-evidence",
            "notice-evidence",
          ],
          {
            submittedOverride:
              claimedDays,
            note:
              attributableCandidate !==
                null
                ? "This is an analytical entitlement candidate, not an official award."
                : analyticalTimeImpact !==
                    null
                  ? "An analytical time-impact candidate exists, but attribution is not established; CMeng does not convert observed schedule movement into entitlement."
                  : undefined,
            consequenceMissing:
              analyticalTimeImpact !==
                null
                ? "The programme impact is quantified, but the evidence needed to attribute it to an EOT-eligible event remains incomplete."
                : "No defensible time-impact basis exists yet.",
            actionMissing:
              "Link events to affected activities and provide the contemporaneous/contract evidence required for causation and notice testing.",
          },
        ),
        spec(
          "official_awarded_eot_days",
          "Official awarded EOT",
          null,
          "days",
          "not_derivable",
          state.controls
            .contractTimeBasis
            ?.sourceRefs ??
          [],
          {
            submittedOverride:
              officialAward !==
                null
                ? submitted(
                    officialAward,
                    "days",
                    state.controls
                      .contractTimeBasis
                      ?.sourceRefs ??
                    [],
                    "Governed official EOT award/determination.",
                  )
                : undefined,
            note: "Source determination retained; no independent award is calculated or self-reconciled.",
            consequenceMissing:
              "CMeng cannot manufacture an official contractual award. Analytical time impact and EOT candidates remain visible separately.",
            actionMissing:
              "Provide the formal EOT determination/award to establish the official adjusted completion date.",
          },
        ),
      ];
    }

    case "challenge-contract":
      return [
        spec(
          "completion_date",
          "Finish date",
          delivery
            .scheduleChallenge
            .independentCompletionIso,
          null,
          delivery
            .scheduleChallenge
            .independentCompletionIso
            ? "calculated"
            : "not_derivable",
          [
            "independent-forecast",
          ],
          {
            submittedOverride:
              submitted(
                delivery
                  .scheduleChallenge
                  .contractorSubmittedCompletionIso,
                null,
                [sourceRef],
                "Contractor proposed programme finish.",
              ),
          },
        ),
        spec(
          "manpower_average",
          "Average manpower requirement / scenario",
          delivery
            .manpowerChallenge
            .requiredAverageManpowerToContract ??
          baseCrew
            ?.averageManpower ??
          null,
          "people",
          delivery
            .manpowerChallenge
            .requiredAverageManpowerToContract !==
            null
            ? "derived"
            : baseCrew
              ?.averageManpower !==
                null &&
                baseCrew
                  ?.averageManpower !==
                  undefined
                ? "scenario"
                : "not_derivable",
          [
            "delivery-challenge",
          ],
          {
            submittedOverride:
              submitted(
                delivery
                  .manpowerChallenge
                  .submittedAverageManpower,
                "people",
                state
                  .submittedManpowerPlan
                  ?.sourceRefs ??
                [],
                "Contractor submitted average manpower.",
              ),
          },
        ),
      ];

    case "pmo-analysis":
      return [
        spec(
          "progress_percent",
          "Overall progress",
          numberOrNull(
            pmo?.progress
              ?.durationWeightedProgressPercent,
          ) ??
          scheduleProgress(model.activities).value,
          "%",
          "derived",
          [sourceRef],
          {
            submittedOverride:
              contractorProgress
                ?.state ===
                "established"
                ? submitted(
                    contractorProgress
                      .valuePercent,
                    "%",
                    contractorProgress
                      .sourceRefs ??
                      [],
                    "Contractor management/progress narrative.",
                  )
                : undefined,
          },
        ),
        spec(
          "completion_date",
          "Completion forecast",
          pmo?.forecast
            ?.independentCompletionIso ??
          forecast
            .independentForecastCompletionIso,
          null,
          forecast
            .independentForecastCompletionIso
            ? "calculated"
            : "not_derivable",
          [
            "independent-forecast",
          ],
          {
            submittedOverride:
              submitted(
                pmo?.forecast
                  ?.sourceCompletionIso ??
                forecast
                  .sourceForecastCompletionIso,
                null,
                [sourceRef],
                "Contractor/source programme forecast.",
              ),
          },
        ),
        spec(
          "critical_count",
          "Critical activity count",
          numberOrNull(
            pmo?.schedule
              ?.criticalCount,
          ) ??
          numberOrNull(
            schedule?.result
              ?.float
              ?.criticalCount,
          ),
          "activities",
          "calculated",
          [sourceRef],
        ),
      ];

    default:
      return [
        spec(
          "module_position",
          "Independent module position",
          "Independent analysis generated from the available project evidence.",
          null,
          "derived",
          [
            "module:" + key,
          ],
          {
            consequenceMissing:
              "The contractor did not submit a directly comparable module position; CMeng still provides the independent specialist analysis.",
            actionMissing:
              "Provide the contractor's corresponding report/position if a direct reconciliation is required.",
          },
        ),
      ];
  }
}

function attach(
  result: ModuleRuntimeResult,
  challenge:
    ModuleChallengeEnvelope,
): ModuleRuntimeResult {
  const original =
    (
      result.data &&
      typeof result.data ===
        "object" &&
      !Array.isArray(
        result.data,
      )
    )
      ? result.data as
          Record<
            string,
            unknown
          >
      : {};

  return {
    ...result,
    status:
      result.status ===
        "blocked"
        ? "partial"
        : result.status,
    reason:
      result.status ===
        "blocked"
        ? (
            result.reason
              ? result.reason +
                " Independent/scenario challenge output is shown below instead of suppressing the module."
              : "Independent/scenario challenge output is available from the evidence that exists."
          )
        : result.reason,
    data: {
      ...original,
      challenge,
    },
  };
}

export function applyUniversalModuleChallenges(
  ctx: ChallengeContext,
): void {
  const assertions =
    allAssertions(
      ctx.state,
    );

  for (
    const [
      key,
      result,
    ] of ctx.modules.entries()
  ) {
    const metrics =
      metricsFor(
        key,
        ctx,
      );
    const challenge =
      buildModuleChallenge({
        moduleKey: key,
        generatedAt:
          ctx.generatedAt,
        assertions,
        metrics,
        diagnostics: [
          ...(result.status ===
          "blocked"
            ? [
                "MODULE_CORE_PROJECTION_BLOCKED_BUT_CHALLENGE_FALLBACK_EMITTED",
              ]
            : []),
        ],
      });

    ctx.modules.set(
      key,
      attach(
        result,
        challenge,
      ),
    );
  }
}
