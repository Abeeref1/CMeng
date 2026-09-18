import type { BoqLineItem } from "../../boq-parser/src/types";

export interface BoqCsvResult {
  rowsSeen: number;
  candidateRows: number;
  verifiedRows: number;
  unresolvedRows: number;
  coveragePercent: number | null;
  items: BoqLineItem[];
  complete: boolean;
  diagnostics: string[];
}
