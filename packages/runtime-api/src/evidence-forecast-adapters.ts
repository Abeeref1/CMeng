import type {
  SourceProductivityForecastModel,
  SourceProductivityForecastRow,
} from "../../independent-forecast/src";
import type {
  ProjectRuntimeState,
  StoredEvidenceDocument,
} from "./project-state-types";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index]!;
    if (quoted) {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function norm(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function col(headers: string[], candidates: string[]): number {
  const normalized = headers.map(norm);
  for (const candidate of candidates) {
    const exact = normalized.indexOf(norm(candidate));
    if (exact >= 0) return exact;
  }
  return normalized.findIndex((header) =>
    candidates.some((candidate) => header.includes(norm(candidate))),
  );
}

function cell(row: string[], index: number): string {
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

function numeric(raw: string): number | null {
  const clean = raw.replace(/,/g, "").replace(/[^0-9.+-]/g, "").trim();
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

function iso(raw: string): string | null {
  if (!raw.trim()) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function deriveSourceProductivityForecastFromCsv(input: {
  state: ProjectRuntimeState;
  document: StoredEvidenceDocument;
  bytes: Uint8Array;
}): SourceProductivityForecastModel | null {
  if (
    input.document.documentType !== "productivity_forecast_model" &&
    !/^if0?1[_-]/i.test(input.document.sourceFilename)
  ) {
    return null;
  }

  const text = Buffer.from(input.bytes).toString("utf8").replace(/^\uFEFF/, "");
  const records = parseCsv(text);
  const headers = records[0] ?? [];
  const workPackage = col(headers, ["work package", "work package id"]);
  const description = col(headers, ["description"]);
  const discipline = col(headers, ["discipline"]);
  const remaining = col(headers, ["remaining quantity"]);
  const unit = col(headers, ["unit"]);
  const recentRate = col(headers, ["recent achieved rate / day", "recent achieved rate"]);
  const conservativeRate = col(headers, ["conservative achievable rate / day", "conservative achievable rate"]);
  const availableStart = col(headers, ["available start"]);
  const productiveDays = col(headers, ["productive days"]);
  const interfaceDays = col(headers, ["interface allowance days"]);
  const finish = col(headers, ["independent forecast finish"]);
  const status = col(headers, ["status"]);

  if (workPackage < 0 || finish < 0) return null;

  const rows: SourceProductivityForecastRow[] = [];
  for (let rowIndex = 1; rowIndex < records.length; rowIndex += 1) {
    const row = records[rowIndex] ?? [];
    const id = cell(row, workPackage);
    if (!id) continue;
    rows.push({
      workPackageId: id,
      description: cell(row, description) || null,
      discipline: cell(row, discipline) || null,
      remainingQuantity: numeric(cell(row, remaining)),
      unit: cell(row, unit) || null,
      recentAchievedRatePerDay: numeric(cell(row, recentRate)),
      conservativeAchievableRatePerDay: numeric(cell(row, conservativeRate)),
      availableStartIso: iso(cell(row, availableStart)),
      productiveDays: numeric(cell(row, productiveDays)),
      interfaceAllowanceDays: numeric(cell(row, interfaceDays)),
      independentForecastFinishIso: iso(cell(row, finish)),
      status: cell(row, status) || null,
      sourceRefs: [{
        sourceId: input.document.documentId,
        locator: "row:" + (rowIndex + 1),
      }],
    });
  }

  const dated = rows
    .filter((row) => row.independentForecastFinishIso !== null)
    .sort((a, b) =>
      a.independentForecastFinishIso!.localeCompare(
        b.independentForecastFinishIso!,
      ),
    );
  const completion = dated.at(-1)?.independentForecastFinishIso ?? null;
  const drivers = completion
    ? dated
        .filter((row) => row.independentForecastFinishIso === completion)
        .map((row) => row.workPackageId)
    : [];

  return {
    projectId: input.state.projectId,
    sourceDocumentId: input.document.documentId,
    authority: "source_productivity_model",
    method: "remaining_quantity_over_conservative_rate_plus_interface_allowance",
    workPackageCount: rows.length,
    forecastCoveragePercent:
      rows.length > 0
        ? Number(((dated.length / rows.length) * 100).toFixed(4))
        : null,
    independentForecastCompletionIso: completion,
    drivingWorkPackageIds: drivers,
    rows,
    diagnostics: [
      ...(drivers.length === 0
        ? ["SOURCE_PRODUCTIVITY_FORECAST_DRIVER_NOT_ESTABLISHED"]
        : []),
    ],
  };
}

export function rebuildSourceProductivityForecast(
  state: ProjectRuntimeState,
): void {
  const fragments = state.sourceProductivityForecastByDocument ?? {};
  const documents = new Map(
    state.evidenceDocuments.map((document) => [document.documentId, document]),
  );
  const candidates = Object.values(fragments)
    .filter((model) => {
      const document = documents.get(model.sourceDocumentId);
      return Boolean(
        document &&
        ["active", "additive", "candidate"].includes(document.basisState),
      );
    })
    .sort((a, b) => {
      const ad = documents.get(a.sourceDocumentId)?.uploadedAt ?? "";
      const bd = documents.get(b.sourceDocumentId)?.uploadedAt ?? "";
      return ad.localeCompare(bd);
    });

  state.sourceProductivityForecast = candidates.at(-1) ?? null;
}
