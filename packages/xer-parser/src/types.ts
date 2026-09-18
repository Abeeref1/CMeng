export type XerEncoding =
  | "utf8"
  | "utf8-bom"
  | "utf16le"
  | "utf16be"
  | "windows-1256"
  | "mixed-utf8-windows1256";

export type XerSeverity = "warning" | "error";

export interface XerDiagnostic {
  code: string;
  severity: XerSeverity;
  message: string;
  line?: number;
  table?: string;
  raw?: string;
}

export interface XerDecodedSource {
  text: string;
  encoding: XerEncoding;
  lineEncodings: XerEncoding[];
  diagnostics: XerDiagnostic[];
}

export interface XerHeader {
  raw: string;
  tokens: string[];
  line: number;
}

export interface XerRow {
  table: string;
  line: number;
  fields: string[];
  rawValues: string[];
  rawLine: string;
  status: "parsed" | "unresolved";
  data: Record<string, string> | null;
  diagnosticCodes: string[];
}

export interface XerTable {
  name: string;
  fieldSets: string[][];
  rows: XerRow[];
}

export interface XerParseResult {
  header: XerHeader | null;
  tables: Map<string, XerTable>;
  tableOrder: string[];
  rowsSeen: number;
  rowsParsed: number;
  rowsUnresolved: number;
  endMarkerSeen: boolean;
  encoding: XerEncoding;
  diagnostics: XerDiagnostic[];
}

export interface XerExternalRelationship {
  line: number;
  successorProjectId: string | null;
  successorTaskId: string | null;
  predecessorProjectId: string | null;
  predecessorTaskId: string | null;
}

export interface XerIntegrityResult {
  complete: boolean;
  sourceComplete: boolean;
  graphComplete: boolean;
  activityCount: number;
  relationshipCount: number;
  wbsCount: number;
  calendarCount: number;
  calendarSemanticComplete: boolean;
  unresolvedCalendars: number;
  duplicateTaskIds: string[];
  duplicateActivityCodes: string[];
  missingPredecessorTaskIds: string[];
  missingSuccessorTaskIds: string[];
  missingWbsIds: string[];
  missingCalendarIds: string[];
  missingCoreTables: string[];
  externalRelationships: XerExternalRelationship[];
  externalRelationshipCount: number;
  unresolvedRows: number;
  truncated: boolean;
  diagnostics: XerDiagnostic[];
}

export interface XerDateParseResult {
  raw: string;
  status: "valid" | "ambiguous" | "invalid" | "empty";
  iso: string | null;
  candidates: string[];
  detectedFormat:
    | "ISO"
    | "MDY"
    | "DMY"
    | "ISO_DATETIME"
    | "MDY_DATETIME"
    | "DMY_DATETIME"
    | null;
}
