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
  return {
    metric,
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
    ...(input.diagnostics
      ? {
          diagnostics: [
            ...input.diagnostics,
          ],
        }
      : {}),
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
        " is not supported by the independent calculation."
      ),
    consequenceWhenMissing:
      input.consequenceMissing ??
      (
        "The contractor has not provided a comparable " +
        label.toLowerCase() +
        ", so the independent position cannot be reconciled against a submitted assumption."
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
        "Submit the contractor basis for " +
        label.toLowerCase() +
        " with traceable supporting evidence."
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
      const parsed = Date.parse(value);
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
      const parsed = Date.parse(value);
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
          numberOrNull(
            schedule?.result
              ?.progress
              ?.durationWeightedPercentComplete
              ?.value,
          ),
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
          "Overall progress",
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
          numberOrNull(
            progress?.progress
              ?.durationWeightedProgressPercent,
          ),
          "%",
          "derived",
          [sourceRef],
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
            tolerance: 0.01,
            consequenceDifferent:
              "Certified progress and independently derived progress are not aligned.",
            actionDifferent:
              "Reconcile certified quantities/progress basis against the activity and physical evidence.",
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
          "Project completion variance",
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
      const points =
        scurve?.points;
      const latest =
        Array.isArray(points) &&
        points.length > 0
          ? points[
              points.length - 1
            ]
          : null;
      return [
        spec(
          "progress_percent",
          "Latest progress",
          numberOrNull(
            latest
              ?.actualProgressPercent,
          ) ??
          numberOrNull(
            progress?.progress
              ?.durationWeightedProgressPercent,
          ),
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
      const mappingCoverage =
        delivery.mapping
          ?.quantityCoveragePercent ??
        delivery.mapping
          ?.itemCoveragePercent ??
        null;
      return [
        spec(
          "quantity_mapping_coverage",
          "BOQ-to-schedule mapping coverage",
          mappingCoverage,
          "%",
          delivery.mapping
            ? delivery.mapping
                .scenarioLinkCount >
              0
              ? "scenario"
              : "derived"
            : "not_derivable",
          [
            "BOQ",
            sourceRef,
          ],
          {
            consequenceMissing:
              "Quantity-based progress cannot be fully substantiated until a BOQ/quantity basis exists, but this does not suppress the rest of the project analysis.",
            actionMissing:
              "Provide the BOQ/quantity evidence or confirm the inferred BOQ-to-activity crosswalk.",
          },
        ),
      ];
    }

    case "progress-breakdown":
      return [
        spec(
          "progress_percent",
          "Project progress represented by WBS breakdown",
          numberOrNull(
            schedule?.result
              ?.progress
              ?.durationWeightedPercentComplete
              ?.value,
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
      const threshold =
        numberOrNull(
          nearCritical
            ?.nearCriticalThresholdHours,
        ) ?? 40;
      const criticalThreshold =
        numberOrNull(
          nearCritical
            ?.criticalThresholdHours,
        ) ?? 0;
      const independentCount =
        forecast.activities.filter(
          (activity) =>
            activity
              .independentTotalFloatHours !==
              null &&
            activity
              .independentTotalFloatHours >
              criticalThreshold &&
            activity
              .independentTotalFloatHours <=
              threshold,
        ).length;
      return [
        spec(
          "near_critical_count",
          "Near-critical activity count",
          independentCount,
          "activities",
          "calculated",
          [
            "independent-cpm",
          ],
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
          "Forecast completion",
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
          "Completion date",
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
                "Contractor/source programme forecast completion.",
              ),
            consequenceDifferent:
              "The contractor completion date is not reproduced by CMeng's independent CPM calculation.",
            actionDifferent:
              "Demonstrate the logic, calendars, productivity and resource assumptions required to support the contractor completion date.",
          },
        ),
      ];

    case "delay-claims":
      return [
        spec(
          "claimed_delay_days",
          "Delay days",
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
          ),
          "days",
          (
            numberOrNull(
              delay
                ?.observedPositiveProgrammeMovementDays,
            ) ??
            numberOrNull(
              windows
                ?.positiveProgrammeMovementDays,
            )
          ) !== null
            ? "derived"
            : delay ||
                windows
              ? "scenario"
              : "not_derivable",
          [
            "schedule-windows",
            "programme-movement",
          ],
          {
            submittedOverride:
              claimedDays,
            consequenceMissing:
              "No contractor delay claim was identified. CMeng still reports independently observed schedule movement, without assigning legal causation.",
            actionMissing:
              "Provide delay-event/claim evidence if the contractor attributes the observed movement to a compensable event.",
          },
        ),
      ];

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
      const timeImpact =
        numberOrNull(
          eot
            ?.analyticalTimeImpactCandidateDays,
        ) ??
        numberOrNull(
          windows
            ?.positiveProgrammeMovementDays,
        );

      return [
        spec(
          "claimed_eot_days",
          "Claimed versus assessed/time-impact days",
          assessed ??
          timeImpact,
          "days",
          assessed !== null
            ? "derived"
            : timeImpact !== null
              ? "scenario"
              : "not_derivable",
          [
            ...(assessed !==
            null
              ? [
                  "notice-claim-evidence",
                ]
              : []),
            ...(timeImpact !==
            null
              ? [
                  "programme-movement",
                ]
              : []),
          ],
          {
            submittedOverride:
              claimedDays,
            note:
              assessed !== null
                ? "Independent assessed/candidate claim position from claim and notice evidence."
                : timeImpact !== null
                  ? "No governed assessed-EOT position exists. The independent value shown is the carried-forward analytical time-impact candidate, not entitlement or award."
                  : undefined,
            consequenceMissing:
              timeImpact !== null
                ? "No contractor/approved assessment is established, but CMeng still carries the observed programme movement forward as an analytical time-impact candidate."
                : "No claim or assessable notice record was submitted and no defensible programme movement is established.",
            actionMissing:
              timeImpact !== null
                ? "Link the relevant events, notices, clauses and affected activities so CMeng can test how much of the time-impact candidate is attributable and potentially EOT-eligible."
                : "Provide the claim, notice, event chronology and schedule evidence required for assessment.",
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
          numberOrNull(
            latest
              ?.strongestProgrammeMovementDays,
          ) ??
          numberOrNull(
            latest
              ?.independentForecastMovementDays,
          ) ??
          numberOrNull(
            latest
              ?.sourceForecastMovementDays,
          ) ??
          numberOrNull(
            latest
              ?.scheduleBoundaryMovementDays,
          ),
          "days",
          latest
            ? "calculated"
            : "not_derivable",
          [
            "schedule-revision-history",
          ],
          {
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
        ) ??
        numberOrNull(
          windows
            ?.positiveProgrammeMovementDays,
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
                ? "Programme movement is carried forward as a time-impact candidate even when causation or entitlement is not yet established."
                : undefined,
            consequenceMissing:
              analyticalTimeImpact !==
                null
                ? "No reliable contractor claim total is established, but CMeng still has a quantified time-impact candidate for further causation testing."
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
                  ? "Movement exists but attribution is not established; CMeng therefore preserves the movement instead of converting it to zero EOT."
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
          officialAward,
          "days",
          officialAward !==
            null
            ? "calculated"
            : "not_derivable",
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
          "Completion date",
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
                "Contractor proposed programme completion.",
              ),
          },
        ),
        spec(
          "manpower_average",
          "Average manpower",
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
          numberOrNull(
            schedule?.result
              ?.progress
              ?.durationWeightedPercentComplete
              ?.value,
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
