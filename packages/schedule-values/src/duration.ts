export type ScheduleDurationUnit = "hours" | "days" | "weeks" | "minutes" | "unknown";

export interface ScheduleDurationValue {
  raw: string;
  status: "valid" | "ambiguous" | "invalid" | "empty";
  value: number | null;
  unit: ScheduleDurationUnit;
  hours: number | null;
  reason: string | null;
}

function numberPart(raw: string): number | null {
  const normalized = raw.replace(/,/g, "").trim();
  if (!/^[+\-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function inferDurationUnitFromHeader(header: string): ScheduleDurationUnit {
  const raw = header.toLowerCase();
  if (/(^|[^a-z])(hr|hrs|hour|hours)([^a-z]|$)|_hr_cnt|\[h\]|\(h\)/.test(raw)) {
    return "hours";
  }
  if (/(^|[^a-z])(min|mins|minute|minutes)([^a-z]|$)|\[m\]|\(m\)/.test(raw)) {
    return "minutes";
  }
  if (/(^|[^a-z])(day|days)([^a-z]|$)|\[d\]|\(d\)/.test(raw)) {
    return "days";
  }
  if (/(^|[^a-z])(week|weeks)([^a-z]|$)|\[w\]|\(w\)/.test(raw)) {
    return "weeks";
  }
  return "unknown";
}

export function parseScheduleDuration(
  input: string | number | null | undefined,
  provenUnit: ScheduleDurationUnit = "unknown",
): ScheduleDurationValue {
  if (input === null || input === undefined || String(input).trim() === "") {
    return {
      raw: input === null || input === undefined ? "" : String(input),
      status: "empty",
      value: null,
      unit: provenUnit,
      hours: null,
      reason: null,
    };
  }

  const raw = String(input).trim();
  const match = raw.match(/^([+\-]?\d[\d,]*(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|min|mins|minute|minutes)?$/i);

  if (!match) {
    return {
      raw,
      status: "invalid",
      value: null,
      unit: provenUnit,
      hours: null,
      reason: "Unsupported duration syntax",
    };
  }

  const value = numberPart(match[1]!);
  if (value === null) {
    return {
      raw,
      status: "invalid",
      value: null,
      unit: provenUnit,
      hours: null,
      reason: "Invalid duration number",
    };
  }

  const suffix = (match[2] ?? "").toLowerCase();
  let unit: ScheduleDurationUnit = provenUnit;

  if (/^(h|hr|hrs|hour|hours)$/.test(suffix)) unit = "hours";
  else if (/^(d|day|days)$/.test(suffix)) unit = "days";
  else if (/^(w|wk|wks|week|weeks)$/.test(suffix)) unit = "weeks";
  else if (/^(min|mins|minute|minutes)$/.test(suffix)) unit = "minutes";

  if (suffix && provenUnit !== "unknown" && unit !== provenUnit) {
    return {
      raw,
      status: "ambiguous",
      value,
      unit,
      hours: null,
      reason: "Value suffix conflicts with header/source unit",
    };
  }

  if (!suffix && unit === "unknown") {
    return {
      raw,
      status: "ambiguous",
      value,
      unit: "unknown",
      hours: null,
      reason: "Duration unit is not proven by value or source field",
    };
  }

  return {
    raw,
    status: "valid",
    value,
    unit,
    hours:
      unit === "hours"
        ? value
        : unit === "minutes"
          ? value / 60
          : null,
    reason:
      unit === "days" || unit === "weeks"
        ? "Calendar-dependent unit preserved without converting to hours"
        : null,
  };
}
