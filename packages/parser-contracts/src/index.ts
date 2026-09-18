import type {
  EvidenceMediaKind,
  SourceLocator,
} from "../../evidence-model/src";

export type UnitKind =
  | "page"
  | "sheet"
  | "frame"
  | "record"
  | "paragraph"
  | "table";

export type UnitReadMethod = "native" | "ocr" | "hybrid" | "not_read";

export interface SourceUnitInventory {
  unitId: string;
  ordinal: number;
  kind: UnitKind;
  method: UnitReadMethod;
  readable: boolean;
  checksumSha256: string | null;
  locator: SourceLocator;
  warnings: string[];
}

export interface SourceInventory {
  sourceRevisionId: string;
  mediaKind: EvidenceMediaKind;
  expectedUnitCount: number;
  units: SourceUnitInventory[];
  parserName: string;
  parserVersion: string;
  warnings: string[];
}

export interface ParseCheckpoint {
  sourceRevisionId: string;
  parserName: string;
  parserVersion: string;
  nextOrdinal: number;
  completedOrdinals: number[];
  createdAt: string;
}

export interface ParsedBlock {
  blockId: string;
  sourceRevisionId: string;
  locator: SourceLocator;
  method: Exclude<UnitReadMethod, "not_read">;
  text: string;
  confidence: number | null;
}

export interface ParserProgress {
  sourceRevisionId: string;
  completedUnits: number;
  expectedUnits: number;
  currentUnitOrdinal: number | null;
}

export interface Parser {
  readonly name: string;
  readonly version: string;

  supports(mediaKind: EvidenceMediaKind, verifiedMediaType: string): boolean;

  inventory(
    sourceRevisionId: string,
    bytes: Uint8Array,
    onProgress?: (progress: ParserProgress) => void,
  ): Promise<SourceInventory>;

  parse(
    inventory: SourceInventory,
    bytes: Uint8Array,
    checkpoint?: ParseCheckpoint,
    onProgress?: (progress: ParserProgress) => void,
  ): AsyncIterable<ParsedBlock>;
}
