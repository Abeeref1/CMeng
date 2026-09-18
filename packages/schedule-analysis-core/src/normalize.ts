import type {
  CanonicalActivityStatus,
  CanonicalActivityType,
  CanonicalRelationshipType,
} from "./types";

function norm(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeActivityStatus(
  value: string | null | undefined,
  percentComplete: number | null = null,
  actualFinishIso: string | null = null,
): CanonicalActivityStatus {
  const normalized = norm(value);

  if (
    /^(complete|completed|finished|finish)$/.test(normalized) ||
    normalized.includes("completed") ||
    normalized === "tk complete"
  ) {
    return "completed";
  }

  if (
    normalized.includes("in progress") ||
    normalized.includes("inprogress") ||
    normalized === "active" ||
    normalized === "tk active"
  ) {
    return "in_progress";
  }

  if (
    normalized.includes("not started") ||
    normalized.includes("notstarted") ||
    normalized === "planned" ||
    normalized === "tk notstart" ||
    normalized === "tk not start"
  ) {
    return "not_started";
  }

  if (actualFinishIso) return "completed";
  if (percentComplete !== null) {
    if (percentComplete >= 100) return "completed";
    if (percentComplete > 0) return "in_progress";
    if (percentComplete === 0) return "not_started";
  }

  return "unknown";
}

export function normalizeActivityType(
  value: string | null | undefined,
  originalDurationHours: number | null,
): {
  type: CanonicalActivityType;
  inferredFromZeroDuration: boolean;
} {
  const normalized = norm(value);

  if (
    normalized.includes("start milestone") ||
    normalized === "start milestone" ||
    normalized === "tt mile"
  ) {
    return {
      type: "start_milestone",
      inferredFromZeroDuration: false,
    };
  }

  if (
    normalized.includes("finish milestone") ||
    normalized === "finish milestone" ||
    normalized === "tt finmile" ||
    normalized === "tt fin mile"
  ) {
    return {
      type: "finish_milestone",
      inferredFromZeroDuration: false,
    };
  }

  if (normalized === "milestone") {
    return {
      type: "milestone",
      inferredFromZeroDuration: false,
    };
  }

  if (
    normalized.includes("level of effort") ||
    normalized === "loe" ||
    normalized === "tt loe"
  ) {
    return {
      type: "level_of_effort",
      inferredFromZeroDuration: false,
    };
  }

  if (
    normalized.includes("wbs summary") ||
    normalized.includes("summary") ||
    normalized === "tt wbs"
  ) {
    return {
      type: "wbs_summary",
      inferredFromZeroDuration: false,
    };
  }

  if (
    normalized === "task dependent" ||
    normalized === "resource dependent" ||
    normalized === "task" ||
    normalized === "activity" ||
    normalized === "tt task" ||
    normalized === "tt rsrc"
  ) {
    return {
      type: "task",
      inferredFromZeroDuration: false,
    };
  }

  if (originalDurationHours === 0) {
    return {
      type: "milestone",
      inferredFromZeroDuration: true,
    };
  }

  return {
    type: "unknown",
    inferredFromZeroDuration: false,
  };
}

export function normalizeRelationshipType(
  value: string | null | undefined,
): CanonicalRelationshipType {
  const normalized = norm(value);

  if (
    normalized === "fs" ||
    normalized === "finish to start" ||
    normalized === "finish start" ||
    normalized === "pr fs"
  ) {
    return "FS";
  }
  if (
    normalized === "ss" ||
    normalized === "start to start" ||
    normalized === "start start" ||
    normalized === "pr ss"
  ) {
    return "SS";
  }
  if (
    normalized === "ff" ||
    normalized === "finish to finish" ||
    normalized === "finish finish" ||
    normalized === "pr ff"
  ) {
    return "FF";
  }
  if (
    normalized === "sf" ||
    normalized === "start to finish" ||
    normalized === "start finish" ||
    normalized === "pr sf"
  ) {
    return "SF";
  }

  return "unknown";
}
