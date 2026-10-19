import {noteXerRead} from "./read-tracking";
import type {XerParseResult} from "./types";

/** F22: baseline projects carried in one P6 export, identified only from
 * explicit P6 fields: a baseline's orig_proj_id (the project it was copied
 * from) or the current project's sum_base_proj_id (its project baseline).
 * The project baseline is the one sum_base_proj_id names, else the only
 * baseline whose orig_proj_id names the project. Several candidates without
 * that choice stay unresolved. Every XER reader (schedule and resources)
 * uses this one rule, so baseline rows never become current work. */
export function xerBaselineProjects(result: XerParseResult) {
  const value = (row: {data: Record<string, string> | null}, name: string) => { noteXerRead("PROJECT", name); const v = row.data?.[name]?.trim(); return v ? v : null; };
  const projectRows = (result.tables.get("PROJECT")?.rows ?? []).filter((row) => row.status === "parsed" && row.data);
  const ids = new Set(projectRows.map((row) => value(row, "proj_id")).filter((id): id is string => !!id));
  const originOf = new Map<string, string>();
  for (const row of projectRows) {
    const id = value(row, "proj_id"), origin = value(row, "orig_proj_id");
    if (id && origin && origin !== id && ids.has(origin)) originOf.set(id, origin);
  }
  const declared = new Map<string, string>();
  for (const row of projectRows) {
    const id = value(row, "proj_id"), base = value(row, "sum_base_proj_id");
    if (id && base && base !== id && ids.has(base) && !originOf.has(id)) declared.set(id, base);
  }
  const baselineIds = new Set<string>([...originOf.keys(), ...declared.values()]);
  const chosen = new Map<string, string>(), diagnostics: string[] = [];
  // A file in which every project is a baseline has no current project to
  // compare against; nothing is set aside then.
  if (ids.size && [...ids].every((id) => baselineIds.has(id))) return {baselineIds: new Set<string>(), chosen, diagnostics: ["XER_BASELINE_PROJECT_WITHOUT_CURRENT_PROJECT"]};
  for (const id of ids) {
    if (baselineIds.has(id)) continue;
    const named = declared.get(id);
    const copies = [...originOf].filter(([, origin]) => origin === id).map(([baseline]) => baseline).sort();
    const baseline = named ?? (copies.length === 1 ? copies[0]! : null);
    if (baseline) { chosen.set(id, baseline); diagnostics.push("XER_BASELINE_PROJECT:" + baseline + ":FOR:" + id + ":" + (named ? "sum_base_proj_id" : "orig_proj_id")); }
    else if (copies.length > 1) diagnostics.push("XER_BASELINE_PROJECT_AMBIGUOUS:" + id + ":" + copies.join("|"));
  }
  return {baselineIds, chosen, diagnostics};
}
