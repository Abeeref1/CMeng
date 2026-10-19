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

  // A plain number is a duration in hours: Primavera P6 XML (PMXML, APIBusinessObjects)
  // writes PlannedDuration, RemainingDuration, AtCompletionDuration, TotalFloat and
  // Relationship Lag as doubles in hours, and the reference P6 XML reader (MPXJ
  // XmlProjectReader.getDuration: Duration.getInstance(value, TimeUnit.HOURS)) reads them so.
  if (/^[+\-]?\d+(?:\.\d+)?$/.test(raw)) {
    const hours = Number(raw);
    if (!Number.isFinite(hours)) {
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
      hours,
      reason: "P6 XML numeric duration in hours",
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
