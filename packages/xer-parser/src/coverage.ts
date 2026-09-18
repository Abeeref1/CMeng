import type { XerParseResult } from "./types";

export interface XerTableCoverage {
  table: string;
  rowsSeen: number;
  rowsParsed: number;
  rowsUnresolved: number;
  coveragePercent: number;
}

export interface XerCoverageReport {
  rowsSeen: number;
  rowsParsed: number;
  rowsUnresolved: number;
  rowCoveragePercent: number;
  endMarkerSeen: boolean;
  tables: XerTableCoverage[];
  complete: boolean;
  reasons: string[];
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Number(((numerator / denominator) * 100).toFixed(4));
}

export function buildXerCoverageReport(
  result: XerParseResult,
): XerCoverageReport {
  const tables: XerTableCoverage[] = [...result.tables.values()].map((table) => {
    const rowsSeen = table.rows.length;
    const rowsParsed = table.rows.filter((row) => row.status === "parsed").length;
    const rowsUnresolved = rowsSeen - rowsParsed;
    return {
      table: table.name,
      rowsSeen,
      rowsParsed,
      rowsUnresolved,
      coveragePercent: pct(rowsParsed, rowsSeen),
    };
  });

  const reasons: string[] = [];

  if (!result.endMarkerSeen) {
    reasons.push("XER end marker %E is missing; source may be truncated.");
  }
  if (result.rowsUnresolved > 0) {
    reasons.push(
      result.rowsUnresolved + " of " + result.rowsSeen + " source row(s) are unresolved.",
    );
  }
  if (result.rowsParsed + result.rowsUnresolved !== result.rowsSeen) {
    reasons.push(
      "Internal row accounting mismatch: parsed + unresolved does not equal rows seen.",
    );
  }

  const errorCount = result.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  ).length;
  if (errorCount > 0) {
    reasons.push(errorCount + " parser error diagnostic(s) remain.");
  }

  return {
    rowsSeen: result.rowsSeen,
    rowsParsed: result.rowsParsed,
    rowsUnresolved: result.rowsUnresolved,
    rowCoveragePercent: pct(result.rowsParsed, result.rowsSeen),
    endMarkerSeen: result.endMarkerSeen,
    tables,
    complete: reasons.length === 0,
    reasons,
  };
}
