import {
  cell,
  dateValue,
  governedTables,
  norm,
  type SourceReceipt,
} from "../../truth-kernel/src";
import type { ProjectRuntimeState } from "./project-state-types";
import { projectDataDate } from "./canonical-time-claims";

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
  if (direct) return dateValue(direct);

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
  const value =
    cell(
      row as any,
      "value",
      "date",
      "completion",
      "completion date",
      "forecast date",
      "finish",
    ) || "";
  if (
    /productivity/i.test(key) &&
    /(forecast|completion|finish)/i.test(key)
  ) {
    return dateValue(value);
  }

  return null;
}

export function sourceProductivityForecastEvidence(
  state: ProjectRuntimeState,
): SourceProductivityForecastEvidence {
  const old = cache.get(state);
  if (old?.version === state.version) return old.value;

  const diagnostics: string[] = [];
  const scheduleControlIds = new Set(
    state.evidenceDocuments
      .filter(
        (document) =>
          document.category === "schedule_control" &&
          ["active", "additive", "candidate"].includes(document.basisState),
      )
      .map((document) => document.documentId),
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
    if (
      document.category !== "schedule_control" ||
      !["active", "additive", "candidate"].includes(
        document.basisState,
      )
    ) {
      continue;
    }

    const productivityAssertions =
      document.assertions.filter(
        (assertion) =>
          assertion.metric ===
            "source_productivity_forecast_completion" &&
          typeof assertion.value === "string",
      );
    if (productivityAssertions.length === 0) {
      continue;
    }

    const documentDataDates =
      document.assertions
        .filter(
          (assertion) =>
            assertion.metric ===
              "schedule_control_data_date" &&
            typeof assertion.value ===
              "string",
        )
        .map(
          (assertion) =>
            dateValue(
              String(
                assertion.value,
              ),
            ),
        )
        .filter(
          (
            value,
          ): value is string =>
            value !== null,
        );
    const uniqueDocumentDates =
      [
        ...new Set(
          documentDataDates,
        ),
      ];
    const assertionAsOf =
      uniqueDocumentDates.length === 1
        ? uniqueDocumentDates[0]!
        : cutoff;

    if (
      uniqueDocumentDates.length >
      1
    ) {
      diagnostics.push(
        "CONFLICTING_PRODUCTIVITY_ASSERTION_DATA_DATES:" +
          document.documentId,
      );
      continue;
    }

    for (
      const assertion of
        productivityAssertions
    ) {
      const completionIso =
        dateValue(
          String(
            assertion.value,
          ),
        );
      if (!completionIso) {
        continue;
      }

      if (
        cutoff !== null &&
        assertionAsOf !== null &&
        assertionAsOf > cutoff
      ) {
        diagnostics.push(
          "FUTURE_SOURCE_PRODUCTIVITY_FORECAST_NOT_APPLIED:" +
            document.documentId +
            ":" +
            assertion.assertionId,
        );
        continue;
      }

      const receipt:
        SourceReceipt = {
        documentId:
          document.documentId,
        sourceHash:
          document.sourceHashSha256,
        revision:
          document.linkedArtifactId ??
          document.sourceHashSha256,
        locator:
          assertion.sourceRef ||
          "assertion:" +
            assertion.assertionId,
        basisState:
          document.basisState,
        authority:
          "source_record",
      };
      candidates.push({
        completionIso,
        asOfIso:
          assertionAsOf,
        receipt,
        official:
          ["active", "additive"].includes(
            document.basisState,
          ),
      });

      if (
        uniqueDocumentDates.length ===
          0 &&
        cutoff !== null
      ) {
        diagnostics.push(
          "PRODUCTIVITY_ASSERTION_ASOF_USES_PROGRAMME_DATA_DATE:" +
            document.documentId,
        );
      }
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
