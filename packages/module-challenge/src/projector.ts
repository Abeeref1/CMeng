import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  ChallengeValue,
  DocumentAssertion,
  ModuleChallengeEnvelope,
  ModuleChallengeItem,
} from "./types";

export interface IndependentMetricSpec {
  metric: string;
  comparisonBasisEstablished?: boolean;
  label: string;
  value:
    | number
    | string
    | null;
  unit: string | null;
  state:
    | "calculated"
    | "derived"
    | "scenario"
    | "not_derivable";
  sourceRefs: string[];
  authority?:
    ChallengeValue["authority"];
  basisRevisionId?:
    string | null;
  coveragePercent?:
    number | null;
  asOfIso?: string | null;
  confidence?: number | null;
  diagnostics?: string[];
  note?: string | null;
  consequenceWhenDifferent:
    string;
  consequenceWhenMissing:
    string;
  actionWhenDifferent: string;
  actionWhenMissing: string;
  consequenceWhenIndependentUnavailable?: string;
  actionWhenIndependentUnavailable?: string;
  tolerance?: number;
  submittedOverride?:
    ChallengeValue;
  submittedReasonableMin?:
    number;
  submittedReasonableMax?:
    number;
  submittedReasonablenessNote?:
    string;
}

function assertionSet(
  assertions:
    readonly DocumentAssertion[],
  metric: string,
): DocumentAssertion[] {
  return assertions
    .filter(
      (assertion) =>
        assertion.metric ===
        metric,
    )
    .sort(
      (a, b) =>
        b.confidence -
          a.confidence ||
        a.assertionId.localeCompare(
          b.assertionId,
        ),
    );
}

function authorityWeight(
  authority:
    DocumentAssertion["sourceAuthority"],
): number {
  switch (authority) {
    case "official":
      return 60;
    case "governed":
      return 50;
    case "deterministic":
      return 45;
    case "derived":
      return 35;
    case "submitted":
      return 25;
    case "candidate":
      return 18;
    case "scenario":
      return 10;
    default:
      return 0;
  }
}

function basisWeight(
  state:
    DocumentAssertion["evidenceBasisState"],
): number {
  switch (state) {
    case "active":
      return 50;
    case "additive":
      return 35;
    case "candidate":
      return 20;
    case "scenario":
      return 10;
    case "historical":
      return 8;
    case "superseded":
      return 2;
    default:
      return 0;
  }
}

function assertionCanonicalKey(
  assertion: DocumentAssertion,
): string {
  const value =
    typeof assertion.value ===
    "number"
      ? String(
          Number(
            assertion.value.toFixed(
              8,
            ),
          ),
        )
      : assertion.value;
  return [
    value,
    assertion.unit ?? "",
  ].join("|");
}

function submittedValue(
  assertions:
    readonly DocumentAssertion[],
  metric: string,
): ChallengeValue {
  const matches =
    assertionSet(
      assertions,
      metric,
    );

  if (
    matches.length === 0
  ) {
    return {
      state:
        "not_submitted",
      value: null,
      unit: null,
      authority:
        "missing",
      sourceRefs: [],
      basisRevisionId:
        null,
      coveragePercent:
        null,
      asOfIso: null,
      confidence: null,
      diagnostics: [
        "SUBMITTED_VALUE_NOT_IDENTIFIED",
      ],
      note:
        "No submitted value was identified in the available contractor evidence.",
      resolution:
        "missing",
      alternatives: [],
    };
  }

  const grouped =
    new Map<
      string,
      DocumentAssertion[]
    >();

  for (const match of matches) {
    const key =
      assertionCanonicalKey(
        match,
      );
    const list =
      grouped.get(key) ??
      [];
    list.push(match);
    grouped.set(
      key,
      list,
    );
  }

  const latestUploadedAt =
    matches
      .map(
        (match) =>
          match.uploadedAt,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      )
      .sort()
      .at(-1) ??
    null;

  const alternatives =
    [...grouped.values()]
      .map((group) => {
        const exemplar =
          group
            .slice()
            .sort(
              (a, b) =>
                (
                  b.confidence -
                  a.confidence
                ) ||
                (
                  (
                    b.uploadedAt ??
                    ""
                  ).localeCompare(
                    a.uploadedAt ??
                    "",
                  )
                ),
            )[0]!;
        const supportCount =
          group.length;
        const bestAuthority =
          Math.max(
            ...group.map(
              (item) =>
                authorityWeight(
                  item.sourceAuthority,
                ),
            ),
          );
        const bestBasis =
          Math.max(
            ...group.map(
              (item) =>
                basisWeight(
                  item.evidenceBasisState,
                ),
            ),
          );
        const bestConfidence =
          Math.max(
            ...group.map(
              (item) =>
                item.confidence,
            ),
          );
        const recencyBonus =
          latestUploadedAt &&
          group.some(
            (item) =>
              item.uploadedAt ===
              latestUploadedAt,
          )
            ? 10
            : 0;
        const corroborationBonus =
          Math.min(
            20,
            Math.max(
              0,
              supportCount - 1,
            ) * 5,
          );
        const evidenceScore =
          Number(
            (
              bestAuthority +
              bestBasis +
              bestConfidence *
                20 +
              recencyBonus +
              corroborationBonus
            ).toFixed(4),
          );

        const reasons: string[] =
          [];
        if (bestBasis >= 50) {
          reasons.push(
            "Supported by the active evidence basis.",
          );
        }
        if (bestAuthority >= 50) {
          reasons.push(
            "Supported by governed/official authority.",
          );
        }
        if (supportCount > 1) {
          reasons.push(
            "Corroborated by " +
              supportCount +
              " source assertions.",
          );
        }
        if (recencyBonus > 0) {
          reasons.push(
            "Appears in the latest uploaded evidence among the competing values.",
          );
        }

        return {
          value:
            exemplar.value,
          unit:
            exemplar.unit,
          authority:
            exemplar.sourceAuthority ??
            "submitted" as const,
          sourceRefs:
            group.map(
              (item) =>
                item.sourceRef,
            ),
          basisRevisionId:
            exemplar.basisRevisionId ??
            null,
          asOfIso:
            exemplar.uploadedAt ??
            null,
          confidence:
            bestConfidence,
          supportCount,
          evidenceScore,
          reasons,
        };
      })
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
          String(a.value)
            .localeCompare(
              String(
                b.value,
              ),
            ),
      );

  const recommended =
    alternatives[0]!;
  const sourceRefs =
    matches.map(
      (match) =>
        match.sourceRef,
    );

  if (
    alternatives.length === 1
  ) {
    return {
      state: "submitted",
      value:
        recommended.value,
      unit:
        recommended.unit,
      authority:
        recommended.authority,
      sourceRefs,
      basisRevisionId:
        recommended
          .basisRevisionId,
      coveragePercent:
        null,
      asOfIso:
        recommended.asOfIso,
      confidence:
        recommended.confidence,
      diagnostics: [],
      note:
        (
          recommended.supportCount ??
          1
        ) > 1
          ? "The submitted value is corroborated by multiple sources."
          : matches[0]!
              .sourceText,
      resolution:
        (
          recommended.supportCount ??
          1
        ) > 1
          ? "corroborated"
          : "single",
      alternatives,
    };
  }

  return {
    state: "conflicted",
    value:
      recommended.value,
    unit:
      recommended.unit,
    authority:
      recommended.authority,
    sourceRefs,
    basisRevisionId:
      recommended
        .basisRevisionId,
    coveragePercent:
      null,
    asOfIso:
      recommended.asOfIso,
    confidence:
      recommended.confidence,
    diagnostics: [
      "SUBMITTED_VALUES_CONFLICT",
      "CONFLICT_RECOMMENDATION_IS_NOT_GOVERNED_UNTIL_USER_DECISION",
    ],
    note:
      "Conflicting submitted values were retained. The displayed value is the strongest-supported recommendation only; every candidate remains available for parallel calculation.",
    resolution:
      "unresolved_conflict",
    alternatives,
  };
}

function independentValue(
  spec:
    IndependentMetricSpec,
): ChallengeValue {
  const authority:
    ChallengeValue["authority"] =
    spec.authority ??
    (
      spec.state ===
        "calculated"
        ? "deterministic"
        : spec.state ===
            "derived"
          ? "derived"
          : spec.state ===
              "scenario"
            ? "scenario"
            : "missing"
    );

  const confidence =
    spec.confidence ??
    (
      spec.state ===
        "calculated"
        ? 1
        : spec.state ===
            "derived"
          ? 0.9
          : spec.state ===
              "scenario"
            ? 0.65
            : null
    );

  return {
    state: spec.state,
    value: spec.value,
    unit: spec.unit,
    authority,
    sourceRefs: [
      ...spec.sourceRefs,
    ],
    basisRevisionId:
      spec.basisRevisionId ??
      null,
    coveragePercent:
      spec.coveragePercent ??
      null,
    asOfIso:
      spec.asOfIso ?? null,
    confidence,
    diagnostics: [
      ...(spec.diagnostics ??
        []),
    ],
    note:
      spec.note ?? null,
  };
}

function dateMs(
  value:
    | number
    | string
    | null,
): number | null {
  if (
    typeof value !==
      "string" ||
    !value
  ) {
    return null;
  }
  const parsed =
    Date.parse(value);
  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function gapValue(
  submitted:
    ChallengeValue,
  independent:
    ChallengeValue,
  unit: string | null,
): ChallengeValue {
  if (
    submitted.state ===
      "not_submitted" && independent.state !== "not_derivable" && independent.value !== null
  ) {
    return {
      state: "derived",
      value: null,
      unit,
      authority:
        "derived",
      sourceRefs: [],
      basisRevisionId:
        independent
          .basisRevisionId,
      coveragePercent:
        independent
          .coveragePercent,
      asOfIso:
        independent.asOfIso,
      confidence:
        independent
          .confidence,
      diagnostics: [],
      note:
        "Gap is that the contractor did not submit a comparable value; the independent result is still shown.",
    };
  }

  if (
    independent.state ===
      "not_derivable" ||
    independent.value ===
      null
  ) {
    return {
      state:
        "not_derivable",
      value: null,
      unit,
      authority:
        "derived",
      sourceRefs: [],
      basisRevisionId:
        independent
          .basisRevisionId,
      coveragePercent:
        independent
          .coveragePercent,
      asOfIso:
        independent.asOfIso,
      confidence:
        independent
          .confidence,
      diagnostics: [],
      note:
        "Independent comparison not established. CMeng cannot defensibly derive the independent value from current evidence.",
    };
  }

  if (!compatibleUnit(submitted.unit, independent.unit)) {
    return { ...independent, state: "not_derivable", value: null, diagnostics: ["INCOMPATIBLE_COMPARISON_UNITS"],
      note: "Comparison withheld because units differ and no governed conversion is established." };
  }

  if (
    typeof submitted.value ===
      "number" &&
    typeof independent.value ===
      "number"
  ) {
    return {
      state: "calculated",
      value:
        Number(
          (
            independent.value -
            submitted.value
          ).toFixed(8),
        ),
      unit,
      authority:
        "derived",
      sourceRefs: [],
      basisRevisionId:
        independent
          .basisRevisionId,
      coveragePercent:
        independent
          .coveragePercent,
      asOfIso:
        independent.asOfIso,
      confidence:
        independent
          .confidence,
      diagnostics: [],
      note:
        submitted.state ===
          "conflicted"
          ? "Independent minus the strongest-supported submitted candidate. See candidate comparisons for all contradictory values; user decision is still required."
          : "Independent minus submitted.",
    };
  }

  const submittedDate =
    dateMs(
      submitted.value,
    );
  const independentDate =
    dateMs(
      independent.value,
    );

  if (
    submittedDate !== null &&
    independentDate !== null
  ) {
    return {
      state: "calculated",
      value:
        Number(
          (
            (
              independentDate -
              submittedDate
            ) /
            86_400_000
          ).toFixed(6),
        ),
      unit: "days",
      authority:
        "derived",
      sourceRefs: [],
      basisRevisionId:
        independent
          .basisRevisionId,
      coveragePercent:
        independent
          .coveragePercent,
      asOfIso:
        independent.asOfIso,
      confidence:
        independent
          .confidence,
      diagnostics: [],
      note:
        submitted.state ===
          "conflicted"
          ? "Independent date minus the strongest-supported submitted candidate date. All contradictory dates are evaluated separately below."
          : "Independent date minus submitted date.",
    };
  }

  if (
    String(
      submitted.value,
    ) ===
    String(
      independent.value,
    )
  ) {
    return {
      state: "calculated",
      value: 0,
      unit,
      authority:
        "derived",
      sourceRefs: [],
      basisRevisionId:
        independent
          .basisRevisionId,
      coveragePercent:
        independent
          .coveragePercent,
      asOfIso:
        independent.asOfIso,
      confidence:
        independent
          .confidence,
      diagnostics: [],
      note:
        "Submitted and independent values agree.",
    };
  }

  return {
    state: "derived",
    value:
      String(
        independent.value,
      ) +
      " vs " +
      String(
        submitted.value,
      ),
    unit,
    authority:
      "derived",
    sourceRefs: [],
    basisRevisionId:
      independent
        .basisRevisionId,
    coveragePercent:
      independent
        .coveragePercent,
    asOfIso:
      independent.asOfIso,
    confidence:
      independent
        .confidence,
    diagnostics: [],
    note:
      submitted.state ===
        "conflicted"
        ? "Comparison shown against the strongest-supported submitted candidate. All contradictory candidates are preserved and assessed separately."
        : "Non-numeric comparison.",
  };
}

function compatibleUnit(
  submittedUnit: string | null,
  independentUnit: string | null,
): boolean {
  if (
    submittedUnit === null ||
    independentUnit === null
  ) {
    return true;
  }
  return (
    submittedUnit
      .trim()
      .toLowerCase() ===
    independentUnit
      .trim()
      .toLowerCase()
  );
}

function candidateGap(
  alternative:
    NonNullable<
      ChallengeValue["alternatives"]
    >[number],
  independent:
    ChallengeValue,
): {
  comparable: boolean;
  gapValue:
    number | string | null;
  gapUnit: string | null;
  note: string;
} {
  if (
    independent.value === null ||
    independent.state ===
      "not_derivable"
  ) {
    return {
      comparable: false,
      gapValue: null,
      gapUnit:
        independent.unit,
      note:
        "Independent result is not mathematically established, so this candidate cannot be gap-tested yet.",
    };
  }

  if (
    !compatibleUnit(
      alternative.unit,
      independent.unit,
    )
  ) {
    return {
      comparable: false,
      gapValue: null,
      gapUnit: null,
      note:
        "Candidate and independent result use incompatible units; CMeng will not convert or cross-subtract them without a governed conversion basis.",
    };
  }

  if (
    typeof alternative.value ===
      "number" &&
    typeof independent.value ===
      "number"
  ) {
    return {
      comparable: true,
      gapValue:
        Number(
          (
            independent.value -
            alternative.value
          ).toFixed(8),
        ),
      gapUnit:
        independent.unit ??
        alternative.unit,
      note:
        "Independent minus this submitted candidate.",
    };
  }

  const submittedDate =
    dateMs(
      alternative.value,
    );
  const independentDate =
    dateMs(
      independent.value,
    );
  if (
    submittedDate !== null &&
    independentDate !== null
  ) {
    return {
      comparable: true,
      gapValue:
        Number(
          (
            (
              independentDate -
              submittedDate
            ) /
            86_400_000
          ).toFixed(6),
        ),
      gapUnit: "days",
      note:
        "Independent date minus this submitted candidate date.",
    };
  }

  return {
    comparable: true,
    gapValue:
      String(
        independent.value,
      ) +
      " vs " +
      String(
        alternative.value,
      ),
    gapUnit:
      independent.unit ??
      alternative.unit,
    note:
      "Non-numeric candidate comparison.",
  };
}

function conflictOutputs(
  submitted: ChallengeValue,
  independent: ChallengeValue,
): {
  candidateComparisons:
    ModuleChallengeItem["candidateComparisons"];
  conflictRecommendation:
    ModuleChallengeItem["conflictRecommendation"];
} {
  const alternatives =
    submitted.alternatives ??
    (
      submitted.value !== null
        ? [{
            value:
              submitted.value,
            unit:
              submitted.unit,
            authority:
              submitted.authority,
            sourceRefs: [
              ...submitted
                .sourceRefs,
            ],
            basisRevisionId:
              submitted
                .basisRevisionId,
            asOfIso:
              submitted.asOfIso,
            confidence:
              submitted.confidence,
            supportCount: 1,
            evidenceScore:
              submitted.confidence ===
                null
                ? 0
                : submitted.confidence *
                  20,
            reasons: [],
          }]
        : []
    );

  const assessed =
    alternatives.map(
      (alternative) => {
        const result =
          candidateGap(
            alternative,
            independent,
          );

        let consistencyBonus = 0;
        let consistencyReason =
          "No independent-consistency bonus was applied.";

        if (
          result.comparable &&
          typeof result.gapValue ===
            "number"
        ) {
          const scale =
            typeof independent.value ===
              "number"
              ? Math.max(
                  1,
                  Math.abs(
                    independent.value,
                  ),
                )
              : 30;
          const normalizedGap =
            Math.min(
              1,
              Math.abs(
                result.gapValue,
              ) / scale,
            );
          consistencyBonus =
            Number(
              (
                25 *
                (
                  1 -
                  normalizedGap
                )
              ).toFixed(4),
            );
          consistencyReason =
            "Independent consistency contributes " +
            consistencyBonus +
            " recommendation points; evidence authority remains the primary basis.";
        } else if (
          result.comparable &&
          typeof result.gapValue ===
            "string"
        ) {
          consistencyBonus =
            result.gapValue.startsWith(
              String(
                independent.value,
              ) +
                " vs " +
                String(
                  alternative.value,
                ),
            ) &&
            String(
              independent.value,
            ) ===
              String(
                alternative.value,
              )
              ? 25
              : 5;
          consistencyReason =
            "Independent consistency was assessed qualitatively for this non-numeric candidate.";
        }

        const evidenceScore =
          alternative
            .evidenceScore ??
          0;
        const recommendationScore =
          Number(
            (
              evidenceScore +
              consistencyBonus
            ).toFixed(4),
          );

        return {
          alternative,
          result,
          evidenceScore,
          recommendationScore,
          consistencyReason,
        };
      },
    );

  const candidateComparisons =
    assessed.map(
      ({
        alternative,
        result,
      }) => ({
        submittedValue:
          alternative.value,
        submittedUnit:
          alternative.unit,
        sourceRefs: [
          ...alternative
            .sourceRefs,
        ],
        comparable:
          result.comparable,
        gapValue:
          result.gapValue,
        gapUnit:
          result.gapUnit,
        note:
          result.note,
      }),
    );

  if (
    submitted.state !==
      "conflicted" ||
    alternatives.length <= 1
  ) {
    return {
      candidateComparisons,
      conflictRecommendation: {
        state:
          "not_applicable",
        recommendedValue:
          submitted.value,
        recommendedUnit:
          submitted.unit,
        rationale: [],
        userDecisionRequired:
          false,
        candidates: [],
      },
    };
  }

  const ranked =
    assessed
      .slice()
      .sort(
        (a, b) =>
          b.recommendationScore -
            a.recommendationScore ||
          b.evidenceScore -
            a.evidenceScore ||
          String(
            a.alternative.value,
          ).localeCompare(
            String(
              b.alternative.value,
            ),
          ),
      );

  const top =
    ranked[0]!;
  const second =
    ranked[1] ??
    null;
  const uniqueRecommendation =
    second === null ||
    top.recommendationScore >
      second.recommendationScore
      ? top
      : null;

  const assessedCandidates =
    ranked.map(
      (candidate) => ({
        value:
          candidate
            .alternative.value,
        unit:
          candidate
            .alternative.unit,
        sourceRefs: [
          ...candidate
            .alternative
            .sourceRefs,
        ],
        supportCount:
          candidate
            .alternative
            .supportCount ??
          1,
        evidenceScore:
          candidate.evidenceScore,
        recommendationScore:
          candidate
            .recommendationScore,
        independentGap:
          candidate
            .result.gapValue,
        gapUnit:
          candidate
            .result.gapUnit,
        reasons: [
          ...(candidate
            .alternative
            .reasons ??
            []),
          candidate
            .consistencyReason,
          ...(candidate
            .result.comparable
              ? [
                  "Independent comparison was calculated for this candidate.",
                ]
              : [
                  "Independent comparison is not arithmetically comparable for this candidate.",
                ]),
        ],
        recommended:
          uniqueRecommendation !==
            null &&
          candidate ===
            uniqueRecommendation,
      }),
    );

  return {
    candidateComparisons,
    conflictRecommendation: {
      state:
        "recommendation_only",
      recommendedValue:
        uniqueRecommendation
          ?.alternative.value ??
        null,
      recommendedUnit:
        uniqueRecommendation
          ?.alternative.unit ??
        null,
      rationale:
        uniqueRecommendation
          ? [
              ...(uniqueRecommendation
                .alternative
                .reasons ??
                []),
              uniqueRecommendation
                .consistencyReason,
              "The recommendation combines evidence authority/active-basis support, corroboration and independent consistency. It does not become governed until the user confirms it.",
            ]
          : [
              "Two or more contradictory candidates are equally supported after evidence and independent-consistency scoring. CMeng retains all calculations and requires the user to choose the governed basis.",
            ],
      userDecisionRequired:
        true,
      candidates:
        assessedCandidates,
    },
  };
}

function materiallyDifferent(
  submitted:
    ChallengeValue,
  independent:
    ChallengeValue,
  gap: ChallengeValue,
  tolerance: number,
): boolean {
  if (
    submitted.state ===
      "not_submitted" ||
    submitted.state ===
      "conflicted"
  ) {
    return true;
  }

  if (
    independent.state ===
      "not_derivable"
  ) {
    return false;
  }

  if (
    typeof gap.value ===
    "number"
  ) {
    return (
      Math.abs(gap.value) >
      tolerance
    );
  }

  return (
    gap.value !== null &&
    String(gap.value) !==
      "0"
  );
}

function itemFor(
  assertions:
    readonly DocumentAssertion[],
  spec:
    IndependentMetricSpec,
): ModuleChallengeItem {
  let submitted =
    spec.submittedOverride ??
    submittedValue(
      assertions,
      spec.metric,
    );

  if (
    typeof submitted.value ===
      "number" &&
    (
      (
        spec.submittedReasonableMin !==
          undefined &&
        submitted.value <
          spec.submittedReasonableMin
      ) ||
      (
        spec.submittedReasonableMax !==
          undefined &&
        submitted.value >
          spec.submittedReasonableMax
      )
    )
  ) {
    submitted = {
      ...submitted,
      state: "conflicted",
      diagnostics: [
        ...submitted
          .diagnostics,
        "SUBMITTED_VALUE_REASONABLENESS_FAILED",
      ],
      note:
        (
          spec.submittedReasonablenessNote ??
          "Submitted value failed the configured reasonableness check."
        ) +
        (
          submitted.note
            ? " " +
              submitted.note
            : ""
        ),
    };
  }

  const independent =
    independentValue({ ...spec, state: spec.value === null ? "not_derivable" : spec.state });
  const gap =
    gapValue(
      submitted,
      independent,
      spec.unit,
    );
  const conflict =
    conflictOutputs(
      submitted,
      independent,
    );
  const tolerance =
    spec.tolerance ?? 0;
  const different =
    materiallyDifferent(
      submitted,
      independent,
      gap,
      tolerance,
    );

  let consequence: string;
  let action: string;

  if (
    independent.state ===
      "not_derivable"
  ) {
    consequence = spec.consequenceWhenIndependentUnavailable ??
      "CMeng has not established an independent comparison for this metric. Available submitted evidence is retained; no agreement or discrepancy is concluded.";
    action = spec.actionWhenIndependentUnavailable ??
      "Establish the independent calculation and its evidence basis, then rerun the comparison.";
  } else if (
    submitted.state ===
      "not_submitted"
  ) {
    consequence =
      spec.consequenceWhenMissing;
    action =
      spec.actionWhenMissing;
  } else if (
    different
  ) {
    consequence =
      spec.consequenceWhenDifferent;
    action =
      spec.actionWhenDifferent;
  } else {
    consequence =
      "Submitted and independent positions are within the configured tolerance.";
    action =
      "No reconciliation action is required for this metric unless newer evidence changes the basis.";
  }

  const reconciliationState: ModuleChallengeItem["reconciliationState"] =
    submitted.state === "conflicted" ? "conflicting_evidence"
    : independent.state === "not_derivable" || independent.value === null ? "independent_unavailable"
    : submitted.state === "not_submitted" || submitted.value === null ? "submitted_missing"
    : gap.state === "not_derivable" || gap.value === null ? "incomparable"
    : spec.comparisonBasisEstablished === false ? "comparison_pending"
    : independent.state === "scenario" ? "scenario"
    : different ? "material_difference" : "within_tolerance";
  if (reconciliationState === "comparison_pending") {
    consequence = "The numbers can be calculated, but a common scope, calendar and approved comparison basis have not been confirmed. Equality alone does not establish reconciliation.";
    action = "Confirm the comparison basis and materiality tolerance before interpreting agreement or difference.";
  } else if (reconciliationState === "incomparable") {
    consequence = "The submitted and calculated values do not have a comparable measurement basis.";
    action = "Reconcile units, population, authority and time basis before interpreting a difference.";
  } else if (reconciliationState === "scenario") {
    consequence = "The comparison uses a scenario. Numeric agreement does not establish an approved or independently verified position.";
    action = "Validate and govern the scenario assumptions before using the comparison as an official position.";
  } else if (reconciliationState === "conflicting_evidence") {
    consequence = "Submitted evidence contains unresolved competing positions; no single reconciled result is established.";
    action = "Resolve the source authority and reporting basis of the competing evidence, retaining the alternatives for audit.";
  }

  const evidenceState:
    ModuleChallengeItem["evidenceState"] =
    spec.comparisonBasisEstablished === false ? "partial" : submitted.state ===
      "conflicted"
      ? "conflicted"
      : independent.state ===
          "scenario"
        ? "scenario"
        : independent.state ===
            "not_derivable"
          ? "partial"
          : independent.state ===
              "calculated"
            ? "verified"
            : "derived";

  return {
    itemId:
      "challenge-" +
      stableFingerprint({
        metric:
          spec.metric,
        submitted:
          submitted.value,
        independent:
          independent.value,
        state:
          independent.state,
      }).slice(0, 20),
    metric:
      spec.metric,
    label:
      spec.label,
    submitted,
    independent,
    gap,
    evidenceState,
    reconciliationState,
    materialDifference: reconciliationState === "material_difference",
    tolerance,
    consequence,
    action,
    candidateComparisons:
      conflict.candidateComparisons,
    conflictRecommendation:
      conflict.conflictRecommendation,
    diagnostics: [
      ...(submitted.state ===
      "not_submitted"
        ? [
            "SUBMITTED_VALUE_NOT_IDENTIFIED",
          ]
        : []),
      ...(submitted.state ===
      "conflicted"
        ? [
            "SUBMITTED_VALUES_CONFLICT",
          ]
        : []),
      ...(independent.state ===
      "not_derivable"
        ? [
            "INDEPENDENT_VALUE_NOT_DERIVABLE_FROM_CURRENT_EVIDENCE",
          ]
        : []),
    ],
  };
}

export function buildModuleChallenge(
  input: {
    moduleKey: string;
    generatedAt: string;
    assertions:
      readonly DocumentAssertion[];
    metrics:
      readonly IndependentMetricSpec[];
    diagnostics?: string[];
  },
): ModuleChallengeEnvelope {
  const items =
    input.metrics.map(
      (spec) =>
        itemFor(
          input.assertions,
          spec,
        ),
    );

  const submittedStates =
    items.map(
      (item) =>
        item.submitted.state,
    );

  const submittedEvidenceState:
    ModuleChallengeEnvelope["submittedEvidenceState"] =
    submittedStates.some(
      (state) =>
        state ===
        "conflicted",
    )
      ? "conflicted"
      : submittedStates.every(
          (state) =>
            state ===
            "not_submitted",
        )
        ? "not_submitted"
        : submittedStates.some(
            (state) =>
              state ===
              "not_submitted",
          )
          ? "partial"
          : "available";

  const independentStates =
    items.map(
      (item) =>
        item.independent.state,
    );

  const independentState:
    ModuleChallengeEnvelope["independentState"] =
    independentStates.some(
      (state) =>
        state ===
        "not_derivable",
    )
      ? independentStates.some(
          (state) =>
            state !==
            "not_derivable",
        )
        ? "partial"
        : "partial"
      : independentStates.some(
          (state) =>
            state ===
            "scenario",
        )
        ? "scenario"
        : independentStates.some(
            (state) =>
              state ===
              "derived",
          )
          ? "derived"
          : "calculated";

  const challengedCount = items.filter(item => item.reconciliationState !== "within_tolerance").length;
  const priority: ModuleChallengeItem["reconciliationState"][] = ["conflicting_evidence", "material_difference", "independent_unavailable", "submitted_missing", "incomparable", "scenario", "comparison_pending"];
  const reconciliationState = priority.find(state => items.some(item => item.reconciliationState === state))
    ?? (items.length ? "within_tolerance" : "comparison_pending");

  return {
    schemaVersion: "1.0",
    moduleKey:
      input.moduleKey,
    generatedAt:
      input.generatedAt,
    submittedEvidenceState,
    independentState,
    itemCount:
      items.length,
    challengedCount,
    materialDifferenceCount: items.filter(item => item.materialDifference).length,
    unavailableCheckCount: items.filter(item => item.reconciliationState === "independent_unavailable").length,
    reconciledCount: items.filter(item => item.reconciliationState === "within_tolerance").length,
    reconciliationState,
    notSubmittedCount:
      items.filter(
        (item) =>
          item.reconciliationState === "submitted_missing",
      ).length,
    scenarioCount:
      items.filter(
        (item) =>
          item.independent
            .state ===
          "scenario",
      ).length,
    items,
    diagnostics: [
      ...(input.diagnostics ??
        []),
    ],
  };
}
