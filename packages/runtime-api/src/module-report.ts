import ExcelJS from "exceljs";
import type {
  ModuleRuntimeResult,
} from "./project-state-types";
import {
  scheduleModules,
  commercialModules,
} from "./registry";

type FlatValue =
  | string
  | number
  | boolean
  | null;

interface ArraySection {
  path: string;
  rows: unknown[];
}

function titleForModule(
  moduleKey: string,
): string {
  return (
    [...scheduleModules, ...commercialModules].find(
      (item) =>
        item.key === moduleKey,
    )?.title ??
    moduleKey
  );
}

function safeFilenamePart(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .replace(
      /[^A-Za-z0-9._-]+/g,
      "_",
    )
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function worksheetName(
  value: string,
  used: Set<string>,
): string {
  const base =
    (
      value
        .replace(
          /[\\/?*\[\]:]/g,
          " ",
        )
        .replace(/\s+/g, " ")
        .trim() || "Data"
    ).slice(0, 31);

  let name = base;
  let index = 2;
  while (used.has(name)) {
    const suffix =
      " " + index;
    name =
      base.slice(
        0,
        Math.max(
          1,
          31 -
            suffix.length,
        ),
      ) + suffix;
    index += 1;
  }
  used.add(name);
  return name;
}

function primitiveValue(
  value: unknown,
): FlatValue {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

function flattenRecord(
  value: unknown,
  prefix = "",
  out: Record<
    string,
    FlatValue
  > = {},
  depth = 0,
): Record<string, FlatValue> {
  if (depth > 6) {
    if (prefix) {
      out[prefix] =
        "[nested data]";
    }
    return out;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value !== "object"
  ) {
    if (prefix) {
      out[prefix] =
        primitiveValue(value);
    }
    return out;
  }

  if (Array.isArray(value)) {
    if (prefix) {
      if (
        value.every(
          (item) =>
            item === null ||
            item === undefined ||
            typeof item !==
              "object",
        )
      ) {
        const joined = value
            .map(
              (item) =>
                item === null ||
                item ===
                  undefined
                  ? ""
                  : String(item),
            )
            .join("; ");
        out[prefix] = joined.length<=32000?joined:'['+value.length+' records; complete values are in the array worksheet]';
      } else {
        out[prefix] =
          "[" +
          value.length +
          " records]";
      }
    }
    return out;
  }

  const entries =
    Object.entries(
      value as Record<
        string,
        unknown
      >,
    );
  if (entries.length === 0) {
    if (prefix) {
      out[prefix] = "";
    }
    return out;
  }

  for (const [key, child] of entries) {
    const path =
      prefix
        ? prefix + "." + key
        : key;
    if (Array.isArray(child)) {
      if (
        child.every(
          (item) =>
            item === null ||
            item === undefined ||
            typeof item !==
              "object",
        )
      ) {
        const joined=child
            .map(
              (item) =>
                item === null ||
                item ===
                  undefined
                  ? ""
                  : String(item),
            )
            .join("; ");
        out[path]=joined.length<=32000?joined:'['+child.length+' records; complete values are in the array worksheet]';
      } else {
        out[path] =
          "[" +
          child.length +
          " records]";
      }
    } else if (
      child !== null &&
      typeof child ===
        "object"
    ) {
      flattenRecord(
        child,
        path,
        out,
        depth + 1,
      );
    } else {
      out[path] =
        primitiveValue(child);
    }
  }

  return out;
}

function collectArrays(
  value: unknown,
  prefix = "",
  out: ArraySection[] = [],
  depth = 0,
): ArraySection[] {
  if (
    depth > 6 ||
    value === null ||
    value === undefined ||
    typeof value !== "object"
  ) {
    return out;
  }

  if (Array.isArray(value)) {
    out.push({
      path:
        prefix || "records",
      rows: value,
    });
    return out;
  }

  for (
    const [key, child] of
      Object.entries(
        value as Record<
          string,
          unknown
        >,
      )
  ) {
    const path =
      prefix
        ? prefix + "." + key
        : key;
    if (Array.isArray(child)) {
      out.push({
        path,
        rows: child,
      });
      for (
        const row of child.slice(
          0,
          20,
        )
      ) {
        if (
          row &&
          typeof row ===
            "object" &&
          !Array.isArray(row)
        ) {
          collectArrays(
            row,
            path,
            out,
            depth + 1,
          );
        }
      }
    } else {
      collectArrays(
        child,
        path,
        out,
        depth + 1,
      );
    }
  }

  const seen = new Set<string>();
  return out.filter(
    (section) => {
      if (
        seen.has(section.path)
      ) {
        return false;
      }
      seen.add(section.path);
      return true;
    },
  );
}

function styleHeader(
  row: ExcelJS.Row,
): void {
  row.font = {
    bold: true,
    color: {
      argb: "FFFFFFFF",
    },
  };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF315F8A",
    },
  };
  row.alignment = {
    vertical: "middle",
    wrapText: true,
  };
}

function fitColumns(
  sheet: ExcelJS.Worksheet,
  maxWidth = 42,
): void {
  sheet.columns.forEach(
    (column) => {
      let width = 10;
      if (!column.eachCell) {
        column.width = width;
        return;
      }
      column.eachCell(
        {
          includeEmpty: false,
        },
        (cell) => {
          const text =
            cell.value === null ||
            cell.value ===
              undefined
              ? ""
              : typeof cell.value ===
                  "object"
                ? JSON.stringify(
                    cell.value,
                  )
                : String(
                    cell.value,
                  );
          width = Math.max(
            width,
            Math.min(
              maxWidth,
              text.length + 2,
            ),
          );
        },
      );
      column.width = width;
    },
  );
}

function addArraySheet(
  workbook: ExcelJS.Workbook,
  section: ArraySection,
  usedNames: Set<string>,
): void {
  const sheet =
    workbook.addWorksheet(
      worksheetName(
        section.path
          .split(".")
          .at(-1) ??
          section.path,
        usedNames,
      ),
    );

  if (section.rows.length === 0) {
    sheet.addRow([
      "No records",
    ]);
    return;
  }

  const flatRows =
    section.rows.map(
      (row) => {
        if (
          row &&
          typeof row ===
            "object" &&
          !Array.isArray(row)
        ) {
          return flattenRecord(
            row,
          );
        }
        return {
          value:
            primitiveValue(row),
        };
      },
    );

  const headers: string[] =
    [];
  const seen =
    new Set<string>();
  for (
    const row of flatRows
  ) {
    for (
      const key of
        Object.keys(row)
    ) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
  sheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];
  sheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column:
        Math.max(
          1,
          headers.length,
        ),
    },
  };

  for (
    const row of flatRows
  ) {
    sheet.addRow(
      headers.map(
        (key) =>
          row[key] ?? null,
      ),
    );
  }

  fitColumns(sheet);
}

export async function buildModuleWorkbook(
  projectId: string,
  moduleKey: string,
  result: ModuleRuntimeResult,
): Promise<Buffer> {
  const workbook =
    new ExcelJS.Workbook();
  workbook.creator = "CMeng";
  workbook.company = "CMeng";
  workbook.subject =
    "CMeng module report";
  workbook.title =
    projectId +
    " - " +
    titleForModule(
      moduleKey,
    );
  workbook.created =
    new Date();

  const usedNames =
    new Set<string>();
  const summary =
    workbook.addWorksheet(
      worksheetName(
        "Report",
        usedNames,
      ),
    );

  summary.addRow([
    "CMeng Module Report",
  ]);
  summary.mergeCells(
    "A1:B1",
  );
  summary.getCell("A1").font = {
    bold: true,
    size: 18,
    color: {
      argb: "FF22364D",
    },
  };

  const reportRows: Array<
    [string, FlatValue]
  > = [
    [
      "Project",
      projectId,
    ],
    [
      "Module",
      titleForModule(
        moduleKey,
      ),
    ],
    [
      "Module key",
      moduleKey,
    ],
    [
      "Status",
      result.status,
    ],
    [
      "Reason",
      result.reason ??
        null,
    ],
    [
      "Report generated",
      new Date()
        .toISOString(),
    ],
  ];

  for (
    const [label, value] of
      reportRows
  ) {
    summary.addRow([
      label,
      value,
    ]);
  }

  const data =
    result.data &&
    typeof result.data ===
      "object"
      ? result.data
      : {};
  const flat =
    flattenRecord(data);
  summary.addRow([]);
  summary.addRow([
    "Calculated / source fields",
  ]);
  const sectionHeader =
    summary.lastRow!;
  sectionHeader.font = {
    bold: true,
    color: {
      argb: "FFFFFFFF",
    },
  };
  sectionHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF4F7FB4",
    },
  };

  for (
    const [key, value] of
      Object.entries(flat)
  ) {
    summary.addRow([
      key,
      value,
    ]);
  }

  summary.getColumn(1).width =
    42;
  summary.getColumn(2).width =
    46;
  summary.eachRow(
    (row, rowNumber) => {
      if (
        rowNumber > 1 &&
        rowNumber <=
          reportRows.length +
            1
      ) {
        row.getCell(1).font = {
          bold: true,
          color: {
            argb: "FF506579",
          },
        };
      }
      row.alignment = {
        vertical: "top",
        wrapText: true,
      };
    },
  );

  for (
    const section of
      collectArrays(data)
  ) {
    addArraySheet(
      workbook,
      section,
      usedNames,
    );
  }

  const buffer =
    await workbook.xlsx
      .writeBuffer();
  return Buffer.from(buffer);
}

export function buildModuleJsonDownload(
  projectId: string,
  moduleKey: string,
  result: ModuleRuntimeResult,
): Buffer {
  return Buffer.from(
    JSON.stringify(
      {
        report: {
          projectId,
          module:
            titleForModule(
              moduleKey,
            ),
          moduleKey,
          generatedAt:
            new Date()
              .toISOString(),
        },
        result,
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function moduleReportFilename(
  projectId: string,
  moduleKey: string,
  extension:
    | "xlsx"
    | "json",
): string {
  const title =
    titleForModule(
      moduleKey,
    );
  return (
    safeFilenamePart(
      projectId,
    ) +
    "_" +
    safeFilenamePart(
      title,
    ) +
    "_" +
    new Date()
      .toISOString()
      .slice(0, 10) +
    "." +
    extension
  );
}
