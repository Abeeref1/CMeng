export interface CsvParseOptions {
  delimiter?: "," | ";" | "\t";
}

export interface CsvCell {
  row: number;
  column: number;
  value: string;
}

export interface CsvRow {
  row: number;
  cells: string[];
}

export interface CsvParseResult {
  delimiter: string;
  rows: CsvRow[];
  rowCount: number;
  maxColumnCount: number;
  diagnostics: string[];
}

function stripBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function detectDelimiter(source: string): "," | ";" | "\t" {
  const sample = source.split(/\r\n|\n|\r/, 20).filter(Boolean);
  const candidates: Array<"," | ";" | "\t"> = [",", ";", "\t"];
  let best: { delimiter: "," | ";" | "\t"; score: number } = {
    delimiter: ",",
    score: -Infinity,
  };

  for (const delimiter of candidates) {
    const counts = sample.map((line) => {
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i]!;
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            i += 1;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (!inQuotes && ch === delimiter) {
          count += 1;
        }
      }
      return count;
    });
    const nonZero = counts.filter((count) => count > 0);
    if (nonZero.length === 0) continue;
    const avg = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
    const variance =
      nonZero.reduce((sum, count) => sum + Math.abs(count - avg), 0) /
      nonZero.length;
    const score = nonZero.length * 10 + avg - variance;
    if (score > best.score) best = { delimiter, score };
  }

  return best.delimiter;
}

export function parseCsv(
  bytes: Uint8Array,
  options: CsvParseOptions = {},
): CsvParseResult {
  const diagnostics: string[] = [];
  let source = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  source = stripBom(source);

  if (source.includes("\uFFFD")) {
    diagnostics.push("CSV_UTF8_REPLACEMENT_CHARACTER_PRESENT");
  }

  const delimiter = options.delimiter ?? detectDelimiter(source);
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let rowNumber = 1;

  const pushCell = () => {
    cells.push(cell);
    cell = "";
  };

  const pushRow = () => {
    pushCell();
    rows.push({ row: rowNumber, cells });
    cells = [];
    rowNumber += 1;
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      pushCell();
      continue;
    }

    if (ch === "\r") {
      if (source[i + 1] === "\n") i += 1;
      pushRow();
      continue;
    }

    if (ch === "\n") {
      pushRow();
      continue;
    }

    cell += ch;
  }

  if (inQuotes) {
    diagnostics.push("CSV_UNTERMINATED_QUOTED_FIELD");
  }

  if (cell.length > 0 || cells.length > 0) {
    pushRow();
  }

  while (
    rows.length > 0 &&
    rows.at(-1)!.cells.every((value) => value.trim() === "")
  ) {
    rows.pop();
  }

  return {
    delimiter,
    rows,
    rowCount: rows.length,
    maxColumnCount: rows.reduce(
      (max, row) => Math.max(max, row.cells.length),
      0,
    ),
    diagnostics,
  };
}
