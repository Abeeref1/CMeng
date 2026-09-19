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
      "not_submitted"
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
    submitted.state ===
      "conflicted"
  ) {
    return {
      state: "conflicted",
      value: null,
      unit,
      authority:
        "derived",
      sourceRefs: [
        ...submitted
          .sourceRefs,
      ],
      basisRevisionId:
        independent
          .basisRevisionId,
      coveragePercent:
        independent
          .coveragePercent,
      asOfIso:
        independent.asOfIso,
      confidence: null,
      diagnostics: [
        "SUBMITTED_VALUES_CONFLICT",
      ],
      note:
        "Submitted evidence contains conflicting values, so a single numeric gap is not authoritative.",
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
        "The independent value cannot be defensibly derived from current evidence.",
    };
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
        "Independent minus submitted.",
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
        "Independent date minus submitted date.",
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
      "Non-numeric comparison.",
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
    independentValue(spec);
  const gap =
    gapValue(
      submitted,
      independent,
      spec.unit,
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
    consequence =
      spec.consequenceWhenMissing;
    action =
      spec.actionWhenMissing;
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

  const evidenceState:
    ModuleChallengeItem["evidenceState"] =
    submitted.state ===
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
    consequence,
    action,
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

  const challengedCount =
    items.filter(
      (item) =>
        item.submitted.state ===
          "not_submitted" ||
        item.submitted.state ===
          "conflicted" ||
        (
          typeof item.gap
            .value ===
            "number" &&
          Math.abs(
            item.gap.value,
          ) > 0
        ) ||
        (
          typeof item.gap
            .value ===
            "string" &&
          item.gap.value !== "0"
        ),
    ).length;

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
    notSubmittedCount:
      items.filter(
        (item) =>
          item.submitted
            .state ===
          "not_submitted",
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
