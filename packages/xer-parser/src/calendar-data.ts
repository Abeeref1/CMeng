export interface P6StructuredNode {
  prefix: string;
  name: string;
  attributes: string[];
  children: P6StructuredNode[];
}

export interface P6CalendarInterval {
  start: string;
  finish: string;
  minutes: number;
}

export interface P6CalendarDay {
  dayIndex: number;
  intervals: P6CalendarInterval[];
  workMinutes: number;
}

export interface P6CalendarException {
  serialDay: number;
  isoDate: string;
  intervals: P6CalendarInterval[];
  nonWorking: boolean;
}

export interface P6CalendarDataResult {
  status: "valid" | "invalid";
  root: P6StructuredNode | null;
  days: P6CalendarDay[];
  exceptions: P6CalendarException[];
  unknownTopLevelNodes: string[];
  diagnostics: string[];
}

class Cursor {
  constructor(
    readonly source: string,
    public index = 0,
  ) {}

  get done(): boolean {
    return this.index >= this.source.length;
  }

  peek(): string {
    return this.source[this.index] ?? "";
  }

  consume(expected?: string): string {
    const value = this.peek();
    if (expected && value !== expected) {
      throw new Error(
        `Expected "${expected}" at offset ${this.index}, found "${value || "<eof>"}"`,
      );
    }
    this.index += 1;
    return value;
  }

  skipWhitespace(): void {
    while (/\s/.test(this.peek())) this.index += 1;
  }
}

function readFlatGroup(cursor: Cursor): string {
  cursor.consume("(");
  let value = "";
  while (!cursor.done && cursor.peek() !== ")") {
    if (cursor.peek() === "(") {
      throw new Error(
        `Nested parenthesis is not valid inside attribute group at offset ${cursor.index}`,
      );
    }
    value += cursor.consume();
  }
  cursor.consume(")");
  return value;
}

function parseNode(cursor: Cursor): P6StructuredNode {
  cursor.skipWhitespace();
  cursor.consume("(");

  let header = "";
  while (!cursor.done && cursor.peek() !== "(") {
    if (cursor.peek() === ")") {
      throw new Error(
        `Node header ended before attribute group at offset ${cursor.index}`,
      );
    }
    header += cursor.consume();
  }

  const split = header.indexOf("||");
  if (split < 0) {
    throw new Error(`Structured node is missing || separator: "${header}"`);
  }

  const prefix = header.slice(0, split);
  const name = header.slice(split + 2);
  if (!name) throw new Error("Structured node name is empty");

  const attributeText = readFlatGroup(cursor);
  const attributes = attributeText === "" ? [] : attributeText.split("|");
  const children: P6StructuredNode[] = [];

  cursor.skipWhitespace();
  if (cursor.peek() === "(") {
    cursor.consume("(");
    cursor.skipWhitespace();
    while (cursor.peek() === "(") {
      children.push(parseNode(cursor));
      cursor.skipWhitespace();
    }
    cursor.consume(")");
  }

  cursor.skipWhitespace();
  cursor.consume(")");

  return { prefix, name, attributes, children };
}

export function parseP6StructuredText(source: string): P6StructuredNode {
  const cursor = new Cursor(source.trim());
  const root = parseNode(cursor);
  cursor.skipWhitespace();
  if (!cursor.done) {
    throw new Error(`Trailing structured-text content begins at offset ${cursor.index}`);
  }
  return root;
}

function findNode(root: P6StructuredNode, name: string): P6StructuredNode | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const found = findNode(child, name);
    if (found) return found;
  }
  return null;
}

function attrMap(attributes: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i + 1 < attributes.length; i += 2) {
    const key = attributes[i];
    const value = attributes[i + 1];
    if (key) map.set(key, value ?? "");
  }
  return map;
}

function timeToMinutes(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (minute < 0 || minute > 59) return null;
  if (hour === 24 && minute === 0) return 24 * 60;
  if (hour < 0 || hour > 23) return null;
  return hour * 60 + minute;
}

function intervalFromNode(
  node: P6StructuredNode,
  diagnostics: string[],
): P6CalendarInterval | null {
  const attrs = attrMap(node.attributes);
  const start = attrs.get("s");
  const finish = attrs.get("f");
  if (!start && !finish) return null;
  if (!start || !finish) {
    diagnostics.push(`CALENDAR_INTERVAL_INCOMPLETE:${node.name}`);
    return null;
  }

  const startMinutes = timeToMinutes(start);
  const finishMinutes = timeToMinutes(finish);
  if (
    startMinutes === null ||
    finishMinutes === null ||
    finishMinutes <= startMinutes
  ) {
    diagnostics.push(`CALENDAR_INTERVAL_INVALID:${start}-${finish}`);
    return null;
  }

  return {
    start,
    finish,
    minutes: finishMinutes - startMinutes,
  };
}

function intervalsFrom(
  node: P6StructuredNode,
  diagnostics: string[],
): P6CalendarInterval[] {
  const intervals: P6CalendarInterval[] = [];
  for (const child of node.children) {
    const interval = intervalFromNode(child, diagnostics);
    if (interval) intervals.push(interval);
  }

  const sorted = [...intervals].sort((a, b) => {
    return (timeToMinutes(a.start) ?? 0) - (timeToMinutes(b.start) ?? 0);
  });

  for (let i = 1; i < sorted.length; i += 1) {
    const priorFinish = timeToMinutes(sorted[i - 1]!.finish)!;
    const currentStart = timeToMinutes(sorted[i]!.start)!;
    if (currentStart < priorFinish) {
      diagnostics.push(
        `CALENDAR_INTERVAL_OVERLAP:${sorted[i - 1]!.start}-${sorted[i - 1]!.finish}:${sorted[i]!.start}-${sorted[i]!.finish}`,
      );
    }
  }

  return sorted;
}

function serialToIso(serial: number): string {
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + serial * 86400000).toISOString().slice(0, 10);
}

export function parseP6CalendarData(source: string): P6CalendarDataResult {
  const diagnostics: string[] = [];

  let root: P6StructuredNode;
  try {
    root = parseP6StructuredText(source);
  } catch (error) {
    return {
      status: "invalid",
      root: null,
      days: [],
      exceptions: [],
      unknownTopLevelNodes: [],
      diagnostics: [
        `CALENDAR_DATA_SYNTAX_ERROR:${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }

  const calendar = findNode(root, "CalendarData") ?? root;
  const daysNode = calendar.children.find((child) => child.name === "DaysOfWeek");
  const exceptionsNode = calendar.children.find(
    (child) => child.name === "Exceptions",
  );

  const days: P6CalendarDay[] = [];
  if (daysNode) {
    const seen = new Set<number>();
    for (const dayNode of daysNode.children) {
      const dayIndex = Number(dayNode.name);
      if (!Number.isInteger(dayIndex) || dayIndex < 1 || dayIndex > 7) {
        diagnostics.push(`CALENDAR_DAY_INDEX_INVALID:${dayNode.name}`);
        continue;
      }
      if (seen.has(dayIndex)) {
        diagnostics.push(`CALENDAR_DAY_INDEX_DUPLICATE:${dayIndex}`);
        continue;
      }
      seen.add(dayIndex);
      const intervals = intervalsFrom(dayNode, diagnostics);
      days.push({
        dayIndex,
        intervals,
        workMinutes: intervals.reduce((sum, item) => sum + item.minutes, 0),
      });
    }
  }

  const exceptions: P6CalendarException[] = [];
  if (exceptionsNode) {
    for (const exceptionNode of exceptionsNode.children) {
      const attrs = attrMap(exceptionNode.attributes);
      const rawSerial = attrs.get("d");
      if (!rawSerial || !/^\d+$/.test(rawSerial)) {
        diagnostics.push(
          `CALENDAR_EXCEPTION_DATE_INVALID:${rawSerial ?? "<missing>"}`,
        );
        continue;
      }
      const serialDay = Number(rawSerial);
      const intervals = intervalsFrom(exceptionNode, diagnostics);
      exceptions.push({
        serialDay,
        isoDate: serialToIso(serialDay),
        intervals,
        nonWorking: intervals.length === 0,
      });
    }
  }

  const known = new Set(["DaysOfWeek", "Exceptions"]);
  const unknownTopLevelNodes = calendar.children
    .filter((child) => !known.has(child.name))
    .map((child) => child.name);

  return {
    status: diagnostics.some((item) =>
      /SYNTAX_ERROR|INVALID|DUPLICATE|OVERLAP|INCOMPLETE/.test(item),
    )
      ? "invalid"
      : "valid",
    root,
    days: days.sort((a, b) => a.dayIndex - b.dayIndex),
    exceptions: exceptions.sort((a, b) => a.serialDay - b.serialDay),
    unknownTopLevelNodes,
    diagnostics,
  };
}
