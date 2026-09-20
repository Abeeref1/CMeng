import {
  cell,
  dateValue,
  governedTables,
  norm,
  type SourceReceipt,
} from "../../truth-kernel/src";
import type { ProjectRuntimeState } from "./project-state-types";
import { projectDataDate } from "./canonical-time-claims";
import { inferDocumentType } from "./evidence";
import {
  analyzeSchedule,
} from "../../schedule-analysis-core/src";

export interface SourceProductivityForecastEvidence {
  producerVersion: "source-productivity-forecast-v1";
  completionIso: string | null;
  state: "official" | "candidate" | "missing" | "conflicted";
  asOfIso: string | null;
  receipts: SourceReceipt[];
  sourceRefs: string[];
  diagnostics: string[];
}

const cache = new WeakMap<
  ProjectRuntimeState,
  { version: number; value: SourceProductivityForecastEvidence }
>();

function ref(receipt: SourceReceipt): string {
  return "evidence-document:" + receipt.documentId + ":" + receipt.locator;
}

function dateFromProductivityRow(
  row: { cells: Readonly<Record<string, string>> },
): string | null {
  const direct = [
    "source productivity forecast",
    "source productivity forecast completion",
    "productivity forecast",
    "productivity forecast completion",
    "productivity completion forecast",
    "productivity based completion",
    "productivity-based completion",
    "productivity finish",
  ]
    .map((name) => row.cells[norm(name)] ?? "")
    .find((value) => value.trim());
  if (direct) {
    const parsed = dateValue(direct);
    if (parsed) return parsed;
  }

  const key =
    cell(
      row as any,
      "metric",
      "parameter",
      "measure",
      "name",
      "forecast type",
      "position",
    ) || "";
  const basis =
    cell(
      row as any,
      "forecast basis",
      "forecast method",
      "method",
      "calculation basis",
      "basis",
      "source",
      "forecast source",
    ) || "";
  const semanticText = [
    key,
    basis,
    ...Object.values(
      row.cells,
    ),
  ]
    .join(" | ")
    .normalize("NFKC");

  if (
    !/productivity/i.test(
      semanticText,
    ) ||
    !/(forecast|completion|finish)/i.test(
      semanticText,
    )
  ) {
    return null;
  }

  const explicitCompletionValues = [
    "value",
    "completion",
    "completion date",
    "forecast completion",
    "forecast completion date",
    "forecast date",
    "finish",
    "finish date",
    "projected completion",
    "projected finish",
  ]
    .map(
      (name) =>
        row.cells[norm(name)] ??
        "",
    )
    .filter(Boolean)
    .map(dateValue)
    .filter(
      (
        value,
      ): value is string =>
        value !== null,
    );

  const explicitUnique = [
    ...new Set(
      explicitCompletionValues,
    ),
  ];
  if (
    explicitUnique.length === 1
  ) {
    return explicitUnique[0]!;
  }
  if (
    explicitUnique.length > 1
  ) {
    return null;
  }

  const excludedDateHeaders =
    new Set(
      [
        "as of",
        "as of date",
        "data date",
        "reporting date",
        "reporting period",
        "period end",
        "period start",
        "effective date",
        "issue date",
        "document date",
        "actual date",
        "status date",
      ].map(norm),
    );
  const genericDates =
    Object.entries(
      row.cells,
    )
      .filter(
        ([header]) =>
          !excludedDateHeaders.has(
            norm(header),
          ),
      )
      .map(
        ([, value]) =>
          dateValue(value),
      )
      .filter(
        (
          value,
        ): value is string =>
          value !== null,
      );
  const genericUnique = [
    ...new Set(
      genericDates,
    ),
  ];
  return genericUnique.length === 1
    ? genericUnique[0]!
    : null;
}

export function sourceProductivityForecastEvidence(
  state: ProjectRuntimeState,
): SourceProductivityForecastEvidence {
  const old = cache.get(state);
  if (old?.version === state.version) return old.value;

  const diagnostics: string[] = [];
  const productivitySourceTypes =
    new Set([
      "schedule_control_basis",
      "schedule_metric_register",
      "project_data_book",
    ]);
  const scheduleControlIds =
    new Set(
      state.evidenceDocuments
        .filter(
          (document) => {
            const inferredType =
              inferDocumentType(
                document.sourceRelativePath ??
                  document.sourceFilename,
                null,
              );
            return (
              (
                document.category ===
                  "schedule_control" ||
                productivitySourceTypes.has(
                  document.documentType,
                ) ||
                productivitySourceTypes.has(
                  inferredType,
                )
              ) &&
              [
                "active",
                "additive",
                "candidate",
              ].includes(
                document.basisState,
              )
            );
          },
        )
        .map(
          (document) =>
            document.documentId,
        ),
    );
  const tables = governedTables(state.evidenceDocuments, diagnostics).filter(
    (table) => scheduleControlIds.has(table.document.documentId),
  );
  const cutoff = projectDataDate(state);
  const candidates: Array<{
    completionIso: string;
    asOfIso: string | null;
    receipt: SourceReceipt;
    official: boolean;
  }> = [];

  for (const document of state.evidenceDocuments) {
    if (!scheduleControlIds.has(document.documentId)) continue;
    const asOfAssertion = document.assertions
      .filter((assertion) => assertion.metric === "schedule_control_data_date")
      .map((assertion) =>
        typeof assertion.value === "string"
          ? dateValue(assertion.value)
          : null,
      )
      .find((value): value is string => value !== null) ?? null;

    for (const assertion of document.assertions) {
      const productivitySpecific =
        assertion.metric === "source_productivity_forecast_completion";
      const contextualCompletion =
        assertion.metric === "completion_date" &&
        /productivity/i.test(assertion.sourceText ?? "") &&
        /(forecast|completion|finish|projected)/i.test(assertion.sourceText ?? "");
      if (!productivitySpecific && !contextualCompletion) {
        continue;
      }
      const completionIso =
        typeof assertion.value === "string"
          ? dateValue(assertion.value)
          : null;
      if (!completionIso) continue;
      if (
        cutoff !== null &&
        asOfAssertion !== null &&
        asOfAssertion > cutoff
      ) {
        diagnostics.push(
          "FUTURE_SOURCE_PRODUCTIVITY_FORECAST_NOT_APPLIED:" +
            document.documentId +
            ":" +
            assertion.sourceRef,
        );
        continue;
      }
      candidates.push({
        completionIso,
        asOfIso: asOfAssertion,
        receipt: {
          documentId: document.documentId,
          sourceHash: document.sourceHashSha256,
          revision: document.linkedArtifactId ?? document.sourceHashSha256,
          locator: assertion.sourceRef || "assertion:" + assertion.assertionId,
          basisState: document.basisState,
          authority: "source_record",
        },
        official: ["active", "additive"].includes(document.basisState),
      });
    }
  }

  for (const table of tables) {
    for (const row of table.rows) {
      const completionIso = dateFromProductivityRow(row);
      if (!completionIso) continue;
      const asOfIso = dateValue(
        cell(
          row,
          "as of",
          "as of date",
          "data date",
          "reporting date",
          "period end",
        ),
      );
      if (
        cutoff !== null &&
        asOfIso !== null &&
        asOfIso > cutoff
      ) {
        diagnostics.push(
          "FUTURE_SOURCE_PRODUCTIVITY_FORECAST_NOT_APPLIED:" +
            row.receipt.documentId +
            ":" +
            row.receipt.locator,
        );
        continue;
      }
      candidates.push({
        completionIso,
        asOfIso,
        receipt: row.receipt,
        official: ["active", "additive"].includes(row.receipt.basisState),
      });
    }
  }

  if (candidates.length === 0) {
    const snapshots = state.schedules
      .filter(
        (stored) =>
          stored.role !== "recovery" &&
          stored.role !== "other",
      )
      .map((stored) => {
        const asOfIso =
          dateValue(
            stored.revision.model.dataDateIso ??
              stored.revision.effectiveAt ??
              "",
          );
        if (
          asOfIso === null ||
          (
            cutoff !== null &&
            asOfIso > cutoff
          )
        ) {
          return null;
        }

        const progress =
          analyzeSchedule(
            stored.revision.model,
          ).progress
            .durationWeightedPercentComplete
            .value;
        if (
          progress === null ||
          !Number.isFinite(progress)
        ) {
          return null;
        }

        const evidence =
          state.evidenceDocuments.find(
            (document) =>
              document.linkedArtifactId ===
                stored.revision.revisionId &&
              ["active", "superseded", "historical", "candidate"].includes(
                document.basisState,
              ),
          ) ??
          null;

        return {
          asOfIso,
          progress,
          revisionId:
            stored.revision.revisionId,
          sequence:
            stored.revision.sequence,
          receipt:
            evidence
              ? {
                  documentId:
                    evidence.documentId,
                  sourceHash:
                    evidence.sourceHashSha256,
                  revision:
                    stored.revision.revisionId,
                  locator:
                    "schedule-progress:" +
                    stored.revision.revisionId,
                  basisState:
                    evidence.basisState,
                  authority:
                    "source_record" as const,
                }
              : null,
        };
      })
      .filter(
        (
          item,
        ): item is NonNullable<
          typeof item
        > => item !== null,
      )
      .sort(
        (a, b) =>
          a.asOfIso.localeCompare(
            b.asOfIso,
          ) ||
          a.sequence -
            b.sequence,
      );

    const byDate =
      new Map<
        string,
        (typeof snapshots)[number]
      >();
    for (const snapshot of snapshots) {
      byDate.set(
        snapshot.asOfIso,
        snapshot,
      );
    }
    const history = [
      ...byDate.values(),
    ].sort(
      (a, b) =>
        a.asOfIso.localeCompare(
          b.asOfIso,
        ) ||
        a.sequence -
          b.sequence,
    );

    const latestPoint =
      history.at(-1) ??
      null;
    let priorPoint:
      (typeof history)[number] |
      null = null;
    if (latestPoint) {
      for (
        let index =
          history.length - 2;
        index >= 0;
        index -= 1
      ) {
        const candidate =
          history[index]!;
        if (
          candidate.progress <
          latestPoint.progress
        ) {
          priorPoint =
            candidate;
          break;
        }
      }
    }

    if (
      latestPoint &&
      priorPoint &&
      latestPoint.progress < 100
    ) {
      const from =
        Date.parse(
          priorPoint.asOfIso,
        );
      const to =
        Date.parse(
          latestPoint.asOfIso,
        );
      const elapsedDays =
        Number.isFinite(from) &&
        Number.isFinite(to)
          ? (
              to - from
            ) /
            86_400_000
          : 0;
      const gained =
        latestPoint.progress -
        priorPoint.progress;

      if (
        elapsedDays > 0 &&
        gained > 0
      ) {
        const percentPerDay =
          gained /
          elapsedDays;
        const remainingDays =
          (
            100 -
            latestPoint.progress
          ) /
          percentPerDay;
        const completionMs =
          to +
          remainingDays *
            86_400_000;

        if (
          Number.isFinite(
            completionMs,
          ) &&
          remainingDays >= 0
        ) {
          const completionIso =
            new Date(
              completionMs,
            )
              .toISOString()
              .slice(
                0,
                10,
              );
          const trendReceipts = [
            priorPoint.receipt,
            latestPoint.receipt,
          ].filter(
            (
              receipt,
            ): receipt is SourceReceipt =>
              receipt !== null,
          );
          const receipt =
            trendReceipts.at(-1) ??
            {
              documentId:
                "schedule-progress-trend",
              sourceHash:
                [
                  priorPoint.revisionId,
                  latestPoint.revisionId,
                ].join(":"),
              revision:
                latestPoint.revisionId,
              locator:
                "schedule-progress-trend:" +
                priorPoint.revisionId +
                "->" +
                latestPoint.revisionId,
              basisState:
                "candidate",
              authority:
                "source_record" as const,
            };

          candidates.push({
            completionIso,
            asOfIso:
              latestPoint.asOfIso,
            receipt,
            official: false,
          });
          diagnostics.push(
            "SOURCE_PRODUCTIVITY_FORECAST_DERIVED_FROM_GOVERNED_PROGRESS_TREND:" +
              priorPoint.revisionId +
              "->" +
              latestPoint.revisionId,
          );
        }
      } else {
        diagnostics.push(
          "SOURCE_PRODUCTIVITY_PROGRESS_TREND_NOT_POSITIVE",
        );
      }
    } else if (
      history.length < 2
    ) {
      diagnostics.push(
        "SOURCE_PRODUCTIVITY_FORECAST_REQUIRES_TWO_PROGRESS_SNAPSHOTS",
      );
    } else {
      diagnostics.push(
        "SOURCE_PRODUCTIVITY_FORECAST_PROGRESS_TREND_NOT_DERIVABLE",
      );
    }
  }

  const official = candidates.filter((item) => item.official);
  const selectedPool = official.length > 0 ? official : candidates;
  selectedPool.sort(
    (a, b) =>
      (a.asOfIso ?? "").localeCompare(b.asOfIso ?? "") ||
      a.receipt.documentId.localeCompare(b.receipt.documentId) ||
      a.receipt.locator.localeCompare(b.receipt.locator),
  );
  const latestAsOf = selectedPool.at(-1)?.asOfIso ?? null;
  const latest = selectedPool.filter(
    (item) => item.asOfIso === latestAsOf,
  );
  const values = [...new Set(latest.map((item) => item.completionIso))];
  const conflicted = values.length > 1;
  if (conflicted) {
    diagnostics.push("CONFLICTING_SOURCE_PRODUCTIVITY_FORECASTS");
  }

  const completionIso =
    values.length === 1 ? values[0]! : null;
  const receipts =
    completionIso === null
      ? latest.map((item) => item.receipt)
      : latest
          .filter((item) => item.completionIso === completionIso)
          .map((item) => item.receipt);
  const stateValue: SourceProductivityForecastEvidence["state"] =
    conflicted
      ? "conflicted"
      : completionIso !== null && official.length > 0
        ? "official"
        : completionIso !== null
          ? "candidate"
          : "missing";

  const value: SourceProductivityForecastEvidence = {
    producerVersion: "source-productivity-forecast-v1",
    completionIso,
    state: stateValue,
    asOfIso: latestAsOf,
    receipts,
    sourceRefs: [...new Set(receipts.map(ref))],
    diagnostics: [...new Set(diagnostics)],
  };
  cache.set(state, { version: state.version, value });
  return value;
}
