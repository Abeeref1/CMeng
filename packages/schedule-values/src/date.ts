import { parseXerDateStrict } from "../../xer-parser/src/dates";

export interface ScheduleDateValue {
  raw: string;
  status: "valid" | "ambiguous" | "invalid" | "empty";
  iso: string | null;
  reason: string | null;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function valid(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseScheduleDate(input: string | null | undefined): ScheduleDateValue {
  const raw = input?.trim() ?? "";
  if (!raw) return { raw, status: "empty", iso: null, reason: null };

  const strict = parseXerDateStrict(raw);
  if (strict.status === "valid") {
    return { raw, status: "valid", iso: strict.iso, reason: null };
  }
  if (strict.status === "ambiguous") {
    return {
      raw,
      status: "ambiguous",
      iso: null,
      reason: "Numeric day/month order is ambiguous",
    };
  }

  const dmy = raw.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = MONTHS[dmy[2]!.toLowerCase()];
    const year = Number(dmy[3]);
    if (month && valid(year, month, day)) {
      const date = year + "-" + pad(month) + "-" + pad(day);
      const iso =
        dmy[4] === undefined
          ? date
          : date +
            "T" +
            pad(Number(dmy[4])) +
            ":" +
            pad(Number(dmy[5])) +
            ":" +
            pad(Number(dmy[6] ?? 0));
      return { raw, status: "valid", iso, reason: null };
    }
  }

  const mdy = raw.match(/^([A-Za-z]{3,9})[ ,\-]+(\d{1,2})[ ,\-]+(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (mdy) {
    const month = MONTHS[mdy[1]!.toLowerCase()];
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    if (month && valid(year, month, day)) {
      const date = year + "-" + pad(month) + "-" + pad(day);
      const iso =
        mdy[4] === undefined
          ? date
          : date +
            "T" +
            pad(Number(mdy[4])) +
            ":" +
            pad(Number(mdy[5])) +
            ":" +
            pad(Number(mdy[6] ?? 0));
      return { raw, status: "valid", iso, reason: null };
    }
  }

  return {
    raw,
    status: "invalid",
    iso: null,
    reason: "Unsupported or invalid schedule date format",
  };
}
