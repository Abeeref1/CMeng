export interface SlaEvent {
  eventKey: string;
  plannedAt: string | null;
  actualOccurredAt: string | null;
  actualCompletedAt: string | null;
}

export interface SlaRule {
  ruleId: string;
  startEventKey: string;
  endEventKey: string;
  targetMinutes: number;
}

export interface SlaPerformance {
  ruleId: string;
  status:
    | "not_started"
    | "in_progress"
    | "met"
    | "missed"
    | "insufficient_actual_timestamps";
  elapsedMinutes: number | null;
  targetMinutes: number;
  usedActualTimestampsOnly: true;
}

export function calculateSlaPerformance(
  events: readonly SlaEvent[],
  rule: SlaRule,
): SlaPerformance {
  const byKey = new Map(
    events.map((event) => [event.eventKey, event]),
  );
  const start = byKey.get(rule.startEventKey);
  const end = byKey.get(rule.endEventKey);

  if (!start?.actualOccurredAt) {
    return {
      ruleId: rule.ruleId,
      status: "not_started",
      elapsedMinutes: null,
      targetMinutes: rule.targetMinutes,
      usedActualTimestampsOnly: true,
    };
  }

  if (!end?.actualCompletedAt) {
    return {
      ruleId: rule.ruleId,
      status: "in_progress",
      elapsedMinutes: null,
      targetMinutes: rule.targetMinutes,
      usedActualTimestampsOnly: true,
    };
  }

  const startMs = Date.parse(start.actualOccurredAt);
  const endMs = Date.parse(end.actualCompletedAt);
  if (
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    endMs < startMs
  ) {
    return {
      ruleId: rule.ruleId,
      status:
        "insufficient_actual_timestamps",
      elapsedMinutes: null,
      targetMinutes: rule.targetMinutes,
      usedActualTimestampsOnly: true,
    };
  }

  const elapsedMinutes =
    (endMs - startMs) / 60_000;

  return {
    ruleId: rule.ruleId,
    status:
      elapsedMinutes <= rule.targetMinutes
        ? "met"
        : "missed",
    elapsedMinutes,
    targetMinutes: rule.targetMinutes,
    usedActualTimestampsOnly: true,
  };
}
