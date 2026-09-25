import {readableXlsx} from '../../shared/src/xlsx';
import ExcelJS from "exceljs";
import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  SubmittedManpowerPeriod,
  SubmittedManpowerPlan,
} from "./types";

function normalizeHeader(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsv(
  text: string,
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (
    let i = 0;
    i < text.length;
    i += 1
  ) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(
        field.replace(
          /\r$/,
          "",
        ),
      );
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (
    field.length > 0 ||
    row.length > 0
  ) {
    row.push(
      field.replace(
        /\r$/,
        "",
      ),
    );
    rows.push(row);
  }

  return rows;
}

function indexOfHeader(
  headers: string[],
  candidates: string[],
): number {
  const wanted =
    new Set(
      candidates.map(
        normalizeHeader,
      ),
    );
  return headers.findIndex(
    (header) =>
      wanted.has(
        normalizeHeader(header),
      ),
  );
}

function iso(
  value: string,
): string | null {
  const trimmed =
    value.trim();
  if (!trimmed) return null;

  const month =
    /^(\d{4})-(\d{2})$/.exec(
      trimmed,
    );
  if (month) {
    const year =
      Number(month[1]);
    const monthIndex =
      Number(month[2]) - 1;
    if (
      year >= 1900 &&
      monthIndex >= 0 &&
      monthIndex <= 11
    ) {
      return new Date(
        Date.UTC(
          year,
          monthIndex,
          1,
        ),
      ).toISOString();
    }
  }

  const parsed =
    Date.parse(trimmed);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : null;
}

function periodEnd(
  startIso: string,
  rawEnd: string,
  rawPeriod: string,
): string | null {
  const explicit =
    iso(rawEnd);
  if (explicit) return explicit;

  const month =
    /^(\d{4})-(\d{2})$/.exec(
      rawPeriod.trim(),
    );
  if (month) {
    const year =
      Number(month[1]);
    const monthIndex =
      Number(month[2]) - 1;
    return new Date(
      Date.UTC(
        year,
        monthIndex + 1,
        1,
      ),
    ).toISOString();
  }

  const start =
    Date.parse(startIso);
  if (!Number.isFinite(start)) {
    return null;
  }

  return new Date(
    start + 30 * 86_400_000,
  ).toISOString();
}

function numeric(
  value: string,
): number | null {
  const normalized =
    value
      .replace(/,/g, "")
      .trim();
  if (!normalized) return null;
  const parsed =
    Number(normalized);
  return (
    Number.isFinite(parsed) &&
    parsed >= 0
  )
    ? parsed
    : null;
}

function fromRows(
  rows: string[][],
  sourceRef: string,
): SubmittedManpowerPlan {
  const headers =
    rows[0] ?? [];
  const diagnostics: string[] = [];

  const periodIndex =
    indexOfHeader(
      headers,
      [
        "period",
        "month",
        "week",
        "period name",
      ],
    );
  const startIndex =
    indexOfHeader(
      headers,
      [
        "start",
        "start date",
        "period start",
        "from",
      ],
    );
  const endIndex =
    indexOfHeader(
      headers,
      [
        "end",
        "end date",
        "period end",
        "to",
      ],
    );
  const manpowerIndex =
    indexOfHeader(
      headers,
      [
        "planned manpower",
        "manpower",
        "headcount",
        "planned headcount",
        "total manpower",
        "planned workforce",
      ],
    );
  const tradeIndex =
    indexOfHeader(
      headers,
      [
        "trade",
        "discipline",
        "resource type",
      ],
    );
  const workFrontIndex =
    indexOfHeader(
      headers,
      [
        "work front",
        "workfront",
        "area",
        "location",
        "zone",
      ],
    );

  if (
    manpowerIndex < 0
  ) {
    diagnostics.push(
      "MANPOWER_PLAN_HEADCOUNT_COLUMN_MISSING",
    );
  }

  const periods:
    SubmittedManpowerPeriod[] =
    [];

  for (
    let rowIndex = 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row =
      rows[rowIndex] ?? [];
    if (
      row.every(
        (value) =>
          !value.trim(),
      )
    ) continue;

    const rawPeriod =
      periodIndex >= 0
        ? row[periodIndex] ?? ""
        : "";
    const rawStart =
      startIndex >= 0
        ? row[startIndex] ?? ""
        : rawPeriod;
    const startIso =
      iso(rawStart);

    const plannedManpower =
      manpowerIndex >= 0
        ? numeric(
            row[
              manpowerIndex
            ] ?? "",
          )
        : null;

    if (
      startIso === null ||
      plannedManpower === null
    ) {
      diagnostics.push(
        "MANPOWER_PLAN_ROW_UNRESOLVED:" +
          (rowIndex + 1),
      );
      continue;
    }

    const endIso =
      periodEnd(
        startIso,
        endIndex >= 0
          ? row[endIndex] ?? ""
          : "",
        rawPeriod,
      );

    if (
      endIso === null ||
      Date.parse(endIso) <=
        Date.parse(startIso)
    ) {
      diagnostics.push(
        "MANPOWER_PLAN_PERIOD_END_UNRESOLVED:" +
          (rowIndex + 1),
      );
      continue;
    }

    periods.push({
      periodId:
        "mp-period-" +
        stableFingerprint({
          sourceRef,
          rowIndex,
          startIso,
          endIso,
          plannedManpower,
        }).slice(0, 18),
      startIso,
      endIso,
      plannedManpower,
      trade:
        tradeIndex >= 0
          ? (
              row[tradeIndex] ??
              ""
            ).trim() ||
            null
          : null,
      workFront:
        workFrontIndex >= 0
          ? (
              row[
                workFrontIndex
              ] ?? ""
            ).trim() ||
            null
          : null,
      sourceRefs: [
        sourceRef +
          ":row:" +
          (rowIndex + 1),
      ],
    });
  }

  return {
    planId:
      "manpower-plan-" +
      stableFingerprint({
        sourceRef,
        periods,
      }).slice(0, 20),
    periods,
    sourceRefs: [
      sourceRef,
    ],
    diagnostics,
  };
}

export async function parseSubmittedManpowerPlan(
  input: {
    bytes: Uint8Array;
    mediaType: string;
    sourceRef: string;
  },
): Promise<SubmittedManpowerPlan> {
  const media =
    input.mediaType
      .toLowerCase();

  if (
    media.includes("csv") ||
    media.startsWith(
      "text/",
    )
  ) {
    return fromRows(
      parseCsv(
        Buffer.from(
          input.bytes,
        )
          .toString("utf8")
          .replace(
            /^\uFEFF/,
            "",
          ),
      ),
      input.sourceRef,
    );
  }

  if (
    media.includes(
      "spreadsheet",
    ) ||
    media.includes(
      "excel",
    )
  ) {
    const workbook =
      new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(
        input.bytes,
      ) as any,
    );

    const rows:
      string[][] = [];
    const sheet =
      workbook.worksheets[0];

    if (!sheet) {
      return {
        planId:
          "manpower-plan-empty",
        periods: [],
        sourceRefs: [
          input.sourceRef,
        ],
        diagnostics: [
          "MANPOWER_PLAN_WORKBOOK_EMPTY",
        ],
      };
    }

    for (
      let rowNumber = 1;
      rowNumber <=
        sheet.rowCount;
      rowNumber += 1
    ) {
      const row =
        sheet.getRow(
          rowNumber,
        );
      const values: string[] =
        [];
      for (
        let column = 1;
        column <=
          Math.max(
            row.cellCount,
            1,
          );
        column += 1
      ) {
        values.push(
          row.getCell(
            column,
          ).text ?? "",
        );
      }
      rows.push(values);
    }

    return fromRows(
      rows,
      input.sourceRef +
        ":sheet:" +
        sheet.name,
    );
  }

  return {
    planId:
      "manpower-plan-unsupported",
    periods: [],
    sourceRefs: [
      input.sourceRef,
    ],
    diagnostics: [
      "MANPOWER_PLAN_FORMAT_UNSUPPORTED",
    ],
  };
}
