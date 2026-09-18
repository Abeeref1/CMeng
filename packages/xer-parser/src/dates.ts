import type { XerDateParseResult } from "./types";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

function makeIso(
  year: number,
  month: number,
  day: number,
  hh?: number,
  mm?: number,
  ss?: number,
): string {
  const date = `${year}-${pad(month)}-${pad(day)}`;
  if (hh === undefined) return date;
  return `${date}T${pad(hh)}:${pad(mm ?? 0)}:${pad(ss ?? 0)}`;
}

export function parseXerDateStrict(rawInput: string): XerDateParseResult {
  const raw = rawInput.trim();
  if (!raw) {
    return {
      raw: rawInput,
      status: "empty",
      iso: null,
      candidates: [],
      detectedFormat: null,
    };
  }

  const iso = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (iso) {
    const [, y, m, d, hh, mm, ss] = iso;
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (!validDate(year, month, day)) {
      return {
        raw: rawInput,
        status: "invalid",
        iso: null,
        candidates: [],
        detectedFormat: null,
      };
    }
    const value = makeIso(
      year,
      month,
      day,
      hh === undefined ? undefined : Number(hh),
      mm === undefined ? undefined : Number(mm),
      ss === undefined ? undefined : Number(ss),
    );
    return {
      raw: rawInput,
      status: "valid",
      iso: value,
      candidates: [value],
      detectedFormat: hh === undefined ? "ISO" : "ISO_DATETIME",
    };
  }

  const local = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (!local) {
    return {
      raw: rawInput,
      status: "invalid",
      iso: null,
      candidates: [],
      detectedFormat: null,
    };
  }

  const [, a, b, y, hh, mm, ss] = local;
  const first = Number(a);
  const second = Number(b);
  const year = Number(y);
  const time = hh === undefined
    ? []
    : [Number(hh), Number(mm), ss === undefined ? 0 : Number(ss)];

  const candidates: Array<{ iso: string; format: "MDY" | "DMY" | "MDY_DATETIME" | "DMY_DATETIME" }> = [];

  if (validDate(year, first, second)) {
    candidates.push({
      iso: makeIso(year, first, second, time[0], time[1], time[2]),
      format: hh === undefined ? "MDY" : "MDY_DATETIME",
    });
  }

  if (validDate(year, second, first)) {
    const candidate = makeIso(year, second, first, time[0], time[1], time[2]);
    if (!candidates.some((item) => item.iso === candidate)) {
      candidates.push({
        iso: candidate,
        format: hh === undefined ? "DMY" : "DMY_DATETIME",
      });
    }
  }

  if (candidates.length === 0) {
    return {
      raw: rawInput,
      status: "invalid",
      iso: null,
      candidates: [],
      detectedFormat: null,
    };
  }

  if (candidates.length > 1) {
    return {
      raw: rawInput,
      status: "ambiguous",
      iso: null,
      candidates: candidates.map((item) => item.iso),
      detectedFormat: null,
    };
  }

  return {
    raw: rawInput,
    status: "valid",
    iso: candidates[0]!.iso,
    candidates: [candidates[0]!.iso],
    detectedFormat: candidates[0]!.format,
  };
}
