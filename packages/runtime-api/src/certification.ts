import type {
  ProjectRuntimeState,
  ModuleRuntimeResult,
} from "./project-state-types";
import type {
  ProjectDirectorPosition,
} from "../../project-director/src";
import type {
  BoardReadyReport,
} from "../../board-report/src";

export interface CrossModuleCertificationCheck {
  checkId: string;
  state:
    | "pass"
    | "fail"
    | "not_applicable";
  detail: string;
  values: Array<{
    source: string;
    value: unknown;
  }>;
}

export interface CrossModuleCertification {
  schemaVersion: "1.0";
  state: "pass" | "fail";
  generatedAt: string;
  projectId: string;
  checkCount: number;
  failedCheckIds: string[];
  checks: CrossModuleCertificationCheck[];
}

function data(
  modules:
    Map<string, ModuleRuntimeResult>,
  key: string,
): any {
  return modules.get(key)?.data as any;
}

function normalized(
  value: unknown,
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "__NULL__";
  }
  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? String(
          Number(
            value.toFixed(8),
          ),
        )
      : "__NONFINITE__";
  }
  return String(value);
}

function equalityCheck(
  checkId: string,
  detail: string,
  values: Array<{
    source: string;
    value: unknown;
  }>,
): CrossModuleCertificationCheck {
  const established =
    values.filter(
      (item) =>
        item.value !== null &&
        item.value !== undefined,
    );
  if (established.length < 2) {
    return {
      checkId,
      state:
        "not_applicable",
      detail,
      values,
    };
  }
  const keys =
    new Set(
      established.map(
        (item) =>
          normalized(
            item.value,
          ),
      ),
    );
  return {
    checkId,
    state:
      keys.size === 1
        ? "pass"
        : "fail",
    detail,
    values,
  };
}

function booleanCheck(
  checkId: string,
  ok: boolean,
  detail: string,
  values: CrossModuleCertificationCheck["values"] = [],
): CrossModuleCertificationCheck {
  return {
    checkId,
    state:
      ok ? "pass" : "fail",
    detail,
    values,
  };
}

export function certifyCrossModuleConsistency(
  input: {
    generatedAt: string;
    state: ProjectRuntimeState;
    modules:
      Map<
        string,
        ModuleRuntimeResult
      >;
    director:
      ProjectDirectorPosition | null;
    boardReport:
      BoardReadyReport | null;
  },
): CrossModuleCertification {
  const {
    state,
    modules,
    director,
    boardReport,
  } = input;

  const forecast =
    data(
      modules,
      "independent-forecast",
    );
  const progress =
    data(
      modules,
      "progress-report",
    );
  const challenge =
    data(
      modules,
      "challenge-contract",
    );
  const pmo =
    data(
      modules,
      "pmo-analysis",
    );
  const windows =
    data(
      modules,
      "windows-analysis",
    );
  const delay =
    data(
      modules,
      "delay-claims",
    );
  const eot =
    data(
      modules,
      "eot-assessment",
    );
  const quantity =
    data(
      modules,
      "quantity-scurve",
    );

  const checks:
    CrossModuleCertificationCheck[] =
    [];

  checks.push(
    booleanCheck(
      "MODULE_COUNT_22",
      modules.size === 22,
      "The runtime must expose all 22 specialist modules.",
      [{
        source:
          "runtime.modules",
        value: modules.size,
      }],
    ),
  );

  const challengeMissing =
    [...modules.entries()]
      .filter(
        ([, result]) =>
          !(
            result.data &&
            typeof result.data ===
              "object" &&
            "challenge" in
              (
                result.data as
                  Record<
                    string,
                    unknown
                  >
              )
          ),
      )
      .map(([key]) => key);

  checks.push(
    booleanCheck(
      "SHARED_CHALLENGE_ENVELOPE_ALL_MODULES",
      challengeMissing.length ===
        0,
      "Every specialist module must expose the shared submitted/independent/gap/consequence/action envelope.",
      [{
        source:
          "modules_without_challenge",
        value:
          challengeMissing.join(
            ",",
          ),
      }],
    ),
  );

  checks.push(
    equalityCheck(
      "INDEPENDENT_COMPLETION_CONSISTENCY",
      "Independent completion must remain consistent from Forecast through Progress, Challenge, PMO, Director and Board unless a module declares another basis.",
      [
        {
          source:
            "independent-forecast",
          value:
            forecast
              ?.independentForecastCompletionIso,
        },
        {
          source:
            "progress-report",
          value:
            progress
              ?.forecast
              ?.independentForecastCompletionIso,
        },
        {
          source:
            "challenge-contract",
          value:
            challenge
              ?.deliveryChallenge
              ?.scheduleChallenge
              ?.independentCompletionIso,
        },
        {
          source:
            "pmo-analysis",
          value:
            pmo?.forecast
              ?.independentCompletionIso,
        },
        {
          source:
            "director",
          value:
            director?.schedule
              .independentForecastCompletionIso,
        },
        {
          source:
            "board-report",
          value:
            boardReport
              ?.sections
              .executivePosition
              .independentForecastCompletionIso,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "PROGRAMME_MOVEMENT_PROPAGATION",
      "Programme movement calculated in Windows must propagate to Delay, EOT, Director and Board without disappearing.",
      [
        {
          source:
            "windows-analysis",
          value:
            windows
              ?.positiveProgrammeMovementDays,
        },
        {
          source:
            "delay-claims",
          value:
            delay
              ?.observedPositiveProgrammeMovementDays,
        },
        {
          source:
            "eot-assessment",
          value:
            eot
              ?.observedProgrammeMovementDays,
        },
        {
          source:
            "director",
          value:
            director?.claims
              .observedProgrammeMovementDays,
        },
        {
          source:
            "board-report",
          value:
            boardReport
              ?.sections
              .claims
              ?.observedProgrammeMovementDays,
        },
      ],
    ),
  );

  const latest =
    state.schedules
      .filter(
        (item) =>
          item.role !==
          "recovery",
      )
      .sort(
        (a, b) =>
          (
            a.revision.model
              .dataDateIso ??
            a.revision
              .effectiveAt ??
            ""
          ).localeCompare(
            b.revision.model
              .dataDateIso ??
            b.revision
              .effectiveAt ??
            "",
          ),
      )
      .at(-1) ??
    null;

  checks.push(
    equalityCheck(
      "DATA_DATE_CONSISTENCY",
      "The current analytical Data Date must be consistent across Forecast, Progress and Director.",
      [
        {
          source:
            "active-schedule",
          value:
            latest?.revision.model
              .dataDateIso,
        },
        {
          source:
            "independent-forecast",
          value:
            forecast?.dataDateIso,
        },
        {
          source:
            "progress-report",
          value:
            progress?.dataDateIso,
        },
        {
          source:
            "director",
          value:
            director?.schedule
              .dataDateIso,
        },
      ],
    ),
  );

  checks.push(
    equalityCheck(
      "BOQ_BASIS_CONSISTENCY",
      "Quantity S-Curve must use the same active BOQ basis as the canonical quantity model.",
      [
        {
          source:
            "quantity-model",
          value:
            state.quantities
              ?.boqRevisionId,
        },
        {
          source:
            "quantity-scurve",
          value:
            quantity
              ?.boqRevisionId,
        },
      ],
    ),
  );

  const invalidChallengeValues:
    string[] = [];
  for (
    const [
      moduleKey,
      result,
    ] of modules.entries()
  ) {
    const envelope =
      (
        result.data as
          | any
          | null
      )?.challenge;
    for (
      const item of
        envelope?.items ?? []
    ) {
      for (
        const [side, value] of [
          [
            "submitted",
            item.submitted,
          ],
          [
            "independent",
            item.independent,
          ],
        ] as const
      ) {
        if (
          value &&
          value.state !==
            "not_submitted" &&
          value.state !==
            "not_derivable" &&
          value.value !== null &&
          (
            !Array.isArray(
              value.sourceRefs,
            ) ||
            value.sourceRefs
              .length === 0
          )
        ) {
          invalidChallengeValues.push(
            moduleKey +
              ":" +
              item.metric +
              ":" +
              side,
          );
        }
      }
    }
  }

  checks.push(
    booleanCheck(
      "EVIDENCE_LINKS_ON_ESTABLISHED_VALUES",
      invalidChallengeValues
        .length === 0,
      "Established submitted and independent challenge values must retain evidence/source references.",
      [{
        source:
          "values_missing_source_refs",
        value:
          invalidChallengeValues.join(
            ",",
          ),
      }],
    ),
  );

  const staleFinalized =
    state.boardPublicationHistory
      .filter(
        (item) =>
          item.stale,
      );
  const currentFinalized =
    state.boardPublicationHistory
      .filter(
        (item) =>
          !item.stale,
      );
  const boardHistoryValid =
    !(
      staleFinalized.length > 0 &&
      currentFinalized.some(
        (item) =>
          staleFinalized.some(
            (stale) =>
              stale.publicationId ===
              item.publicationId,
          ),
      )
    );

  checks.push(
    booleanCheck(
      "BOARD_PUBLICATION_VERSION_GOVERNANCE",
      boardHistoryValid,
      "Finalized board publications must be versioned and become stale rather than silently mutating after evidence changes.",
      [
        {
          source:
            "stale_publication_count",
          value:
            staleFinalized.length,
        },
        {
          source:
            "current_publication_count",
          value:
            currentFinalized.length,
        },
      ],
    ),
  );

  const failed =
    checks.filter(
      (check) =>
        check.state ===
        "fail",
    );

  return {
    schemaVersion: "1.0",
    state:
      failed.length === 0
        ? "pass"
        : "fail",
    generatedAt:
      input.generatedAt,
    projectId:
      state.projectId,
    checkCount:
      checks.length,
    failedCheckIds:
      failed.map(
        (check) =>
          check.checkId,
      ),
    checks,
  };
}
