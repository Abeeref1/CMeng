export type XerUnitSemantic =
  | "hours"
  | "hours_per_day"
  | "quantity"
  | "percent"
  | "date"
  | "identifier"
  | "text"
  | "unknown";

const EXACT: Record<string, XerUnitSemantic> = {
  total_float_hr_cnt: "hours",
  free_float_hr_cnt: "hours",
  remain_drtn_hr_cnt: "hours",
  target_drtn_hr_cnt: "hours",
  act_drtn_hr_cnt: "hours",
  total_drtn_hr_cnt: "hours",
  lag_hr_cnt: "hours",
  lag_hr_cnt_elapsed: "hours",
  day_hr_cnt: "hours_per_day",
  drtn_complete_pct: "percent",
  phys_complete_pct: "percent",
  task_id: "identifier",
  task_code: "identifier",
  proj_id: "identifier",
  wbs_id: "identifier",
  clndr_id: "identifier",
};

export function xerFieldSemantic(field: string): XerUnitSemantic {
  const normalized = field.trim().toLowerCase();
  if (EXACT[normalized]) return EXACT[normalized];

  if (normalized.endsWith("_date")) return "date";
  if (normalized.endsWith("_pct")) return "percent";
  if (normalized.endsWith("_qty")) return "quantity";
  if (normalized.endsWith("_id")) return "identifier";
  if (normalized.endsWith("_name") || normalized.endsWith("_desc")) return "text";

  return "unknown";
}
