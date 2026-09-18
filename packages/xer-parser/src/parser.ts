import { decodeXerBytes } from "./encoding";
import type {
  XerDiagnostic,
  XerHeader,
  XerParseResult,
  XerRow,
  XerTable,
} from "./types";

function getOrCreateTable(
  tables: Map<string, XerTable>,
  name: string,
): XerTable {
  let table = tables.get(name);
  if (!table) {
    table = { name, fieldSets: [], rows: [] };
    tables.set(name, table);
  }
  return table;
}

function normalizeRecordToken(token: string): string {
  return token.replace(/^\uFEFF/, "").trim();
}

export function parseXerBytes(bytes: Uint8Array): XerParseResult {
  const decoded = decodeXerBytes(bytes);
  const diagnostics: XerDiagnostic[] = [...decoded.diagnostics];
  const tables = new Map<string, XerTable>();
  const tableOrder: string[] = [];

  let header: XerHeader | null = null;
  let currentTableName: string | null = null;
  let currentFields: string[] | null = null;
  let rowsSeen = 0;
  let rowsParsed = 0;
  let rowsUnresolved = 0;
  let endMarkerSeen = false;

  const lines = decoded.text.split(/\r\n|\n|\r/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    if (!rawLine.trim()) continue;

    const tokens = rawLine.split("\t");
    const recordType = normalizeRecordToken(tokens[0] ?? "");
    const line = index + 1;

    if (!recordType.startsWith("%")) {
      if (!header) {
        header = {
          raw: rawLine,
          tokens: tokens.map((value) => value.replace(/^\uFEFF/, "")),
          line,
        };
      } else {
        diagnostics.push({
          code: "XER_UNKNOWN_NON_RECORD_LINE",
          severity: "warning",
          message: "Encountered a non-empty line outside a recognized XER record.",
          line,
          raw: rawLine,
          table: currentTableName ?? undefined,
        });
      }
      continue;
    }

    if (recordType === "%T") {
      const tableName = (tokens[1] ?? "").trim().toUpperCase();
      if (!tableName) {
        diagnostics.push({
          code: "XER_TABLE_NAME_MISSING",
          severity: "error",
          message: "%T record is missing a table name.",
          line,
          raw: rawLine,
        });
        currentTableName = null;
        currentFields = null;
        continue;
      }

      currentTableName = tableName;
      currentFields = null;
      if (!tables.has(tableName)) tableOrder.push(tableName);
      getOrCreateTable(tables, tableName);
      continue;
    }

    if (recordType === "%F") {
      if (!currentTableName) {
        diagnostics.push({
          code: "XER_FIELD_RECORD_WITHOUT_TABLE",
          severity: "error",
          message: "%F record appeared before a valid %T table record.",
          line,
          raw: rawLine,
        });
        continue;
      }

      const fields = tokens.slice(1).map((field) => field.trim());
      if (fields.length === 0 || fields.some((field) => !field)) {
        diagnostics.push({
          code: "XER_INVALID_FIELD_DEFINITION",
          severity: "error",
          message: "Field definition is empty or contains an unnamed field.",
          line,
          table: currentTableName,
          raw: rawLine,
        });
        currentFields = null;
        continue;
      }

      const duplicates = fields.filter(
        (field, i) => fields.indexOf(field) !== i,
      );
      if (duplicates.length > 0) {
        diagnostics.push({
          code: "XER_DUPLICATE_FIELD_NAMES",
          severity: "error",
          message: `Duplicate field name(s): ${[...new Set(duplicates)].join(", ")}`,
          line,
          table: currentTableName,
          raw: rawLine,
        });
      }

      currentFields = fields;
      getOrCreateTable(tables, currentTableName).fieldSets.push([...fields]);
      continue;
    }

    if (recordType === "%R") {
      rowsSeen += 1;

      if (!currentTableName) {
        diagnostics.push({
          code: "XER_ROW_WITHOUT_TABLE",
          severity: "error",
          message: "%R record appeared before a valid %T table record.",
          line,
          raw: rawLine,
        });
        rowsUnresolved += 1;
        continue;
      }

      const rawValues = tokens.slice(1);
      const diagnosticCodes: string[] = [];
      let data: Record<string, string> | null = null;
      let status: XerRow["status"] = "parsed";

      if (!currentFields) {
        status = "unresolved";
        diagnosticCodes.push("XER_ROW_WITHOUT_FIELD_DEFINITION");
        diagnostics.push({
          code: "XER_ROW_WITHOUT_FIELD_DEFINITION",
          severity: "error",
          message: "Row cannot be mapped because no active %F definition exists.",
          line,
          table: currentTableName,
          raw: rawLine,
        });
      } else if (rawValues.length !== currentFields.length) {
        status = "unresolved";
        diagnosticCodes.push("XER_FIELD_COUNT_MISMATCH");
        diagnostics.push({
          code: "XER_FIELD_COUNT_MISMATCH",
          severity: "error",
          message:
            `Row contains ${rawValues.length} value(s) but the active schema has ` +
            `${currentFields.length} field(s). No positional repair was guessed.`,
          line,
          table: currentTableName,
          raw: rawLine,
        });
      } else {
        data = Object.fromEntries(
          currentFields.map((field, i) => [field, rawValues[i] ?? ""]),
        );
      }

      const row: XerRow = {
        table: currentTableName,
        line,
        fields: currentFields ? [...currentFields] : [],
        rawValues,
        rawLine,
        status,
        data,
        diagnosticCodes,
      };

      getOrCreateTable(tables, currentTableName).rows.push(row);

      if (status === "parsed") rowsParsed += 1;
      else rowsUnresolved += 1;

      continue;
    }

    if (recordType === "%E") {
      endMarkerSeen = true;
      continue;
    }

    diagnostics.push({
      code: "XER_UNKNOWN_RECORD_TYPE",
      severity: "warning",
      message: `Unknown XER record type: ${recordType}`,
      line,
      table: currentTableName ?? undefined,
      raw: rawLine,
    });
  }

  if (!endMarkerSeen) {
    diagnostics.push({
      code: "XER_END_MARKER_MISSING",
      severity: "error",
      message:
        "No %E end marker was found. The file may be truncated or incomplete.",
    });
  }

  return {
    header,
    tables,
    tableOrder,
    rowsSeen,
    rowsParsed,
    rowsUnresolved,
    endMarkerSeen,
    encoding: decoded.encoding,
    diagnostics,
  };
}
