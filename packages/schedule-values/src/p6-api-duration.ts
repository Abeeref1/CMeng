export interface P6ApiDurationValue {
  raw: string;
  status: "valid" | "ambiguous" | "invalid" | "empty";
  hours: number | null;
  reason: string | null;
}

export function parseP6ApiDuration(
  input: string | null | undefined,
): P6ApiDurationValue {
  const raw = input?.trim() ?? "";
  if (!raw) {
    return {
      raw,
      status: "empty",
      hours: null,
      reason: null,
    };
  }

  if (/^[+\-]?\d+(?:\.\d+)?$/.test(raw)) {
    const milliseconds = Number(raw);
    if (!Number.isFinite(milliseconds)) {
      return {
        raw,
        status: "invalid",
        hours: null,
        reason: "Numeric duration is not finite",
      };
    }
    return {
      raw,
      status: "valid",
      hours: milliseconds / 3_600_000,
      reason: "Simple Integration API duration interpreted as milliseconds",
    };
  }

  const token = /^([+\-])?(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i.exec(raw);
  if (!token) {
    return {
      raw,
      status: "invalid",
      hours: null,
      reason: "Unsupported P6 Integration API duration syntax",
    };
  }

  const sign = token[1] === "-" ? -1 : 1;
  const days = token[2] ? Number(token[2]) : 0;
  const hours = token[3] ? Number(token[3]) : 0;
  const minutes = token[4] ? Number(token[4]) : 0;
  const seconds = token[5] ? Number(token[5]) : 0;

  if (days !== 0) {
    return {
      raw,
      status: "ambiguous",
      hours: null,
      reason:
        "Day-based P6 duration preserved without converting working days to hours until calendar semantics are resolved",
    };
  }

  return {
    raw,
    status: "valid",
    hours: sign * (hours + minutes / 60 + seconds / 3600),
    reason: null,
  };
}
