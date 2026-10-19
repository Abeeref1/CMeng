import type {CanonicalScheduleModel} from "../../schedule-analysis-core/src";
import {
  ELAPSED_24H_CALENDAR,
  resolveWorkingCalendar,
  type WorkingCalendarResolution,
} from "./calendar";

/** The calendar a relationship lag is counted on (P6 project option
 * "Calendar for scheduling Relationship Lag"):
 * - predecessor: the predecessor activity's calendar;
 * - successor: the successor activity's calendar;
 * - 24_hour: continuous time, 24 hours a day, 7 days a week;
 * - project_default: the project's default calendar for new activities.
 * One shared rule for the CPM, the lag working-day display and the
 * look-ahead predecessor check. */
export type RelationshipLagCalendarRule =
  | "predecessor"
  | "successor"
  | "24_hour"
  | "project_default";

export type RelationshipLagCalendarMethod =
  | "predecessor_calendar_forward_and_backward"
  | "successor_calendar_forward_and_backward"
  | "24_hour_calendar_forward_and_backward"
  | "project_default_calendar_forward_and_backward";

export interface RelationshipLagCalendarBasis {
  rule: RelationshipLagCalendarRule;
  /** True only when the programme states one of the four options. */
  stated: boolean;
  /** The option text as written in the file; null when not stated. */
  sourceValue: string | null;
  /** Project default calendar named by the file (project_default rule only). */
  projectDefaultCalendarId: string | null;
  method: RelationshipLagCalendarMethod;
  /** Plain-language basis shown with every lag-dependent figure. */
  basis: string;
  /** Present when a value is stated but is not one of the four options (or
   * several projects state different ones): the successor calendar is then
   * an assumption, never a stated basis. */
  assumption: string | null;
}

export const LAG_CALENDAR_NOT_STATED_BASIS =
  "lag calendar not stated in the programme; successor calendar used";

const STATED_BASIS: Record<RelationshipLagCalendarRule, string> = {
  predecessor: "lag calendar stated in the programme: predecessor activity calendar",
  successor: "lag calendar stated in the programme: successor activity calendar",
  "24_hour": "lag calendar stated in the programme: 24-hour calendar (continuous time)",
  project_default: "lag calendar stated in the programme: project default calendar",
};

export function relationshipLagCalendarBasis(
  model: CanonicalScheduleModel,
): RelationshipLagCalendarBasis {
  const source = model.relationshipLagCalendar;
  let result: RelationshipLagCalendarBasis;
  if (!source) {
    result = {rule: "successor", stated: false, sourceValue: null, projectDefaultCalendarId: null,
      method: "successor_calendar_forward_and_backward", basis: LAG_CALENDAR_NOT_STATED_BASIS, assumption: null};
  } else if (source.rule === null) {
    result = {rule: "successor", stated: false, sourceValue: source.sourceValue, projectDefaultCalendarId: null,
      method: "successor_calendar_forward_and_backward",
      basis: "lag calendar \"" + source.sourceValue + "\" in the programme is not one P6 option; successor calendar assumed",
      assumption: "RELATIONSHIP_LAG_CALENDAR_NOT_ESTABLISHED_SUCCESSOR_CALENDAR_ASSUMED:" + source.sourceValue};
  } else {
    const rule = source.rule;
    const projectDefaultCalendarId = rule === "project_default" ? source.projectDefaultCalendarId : null;
    result = {rule, stated: true, sourceValue: source.sourceValue, projectDefaultCalendarId,
      method: (rule + "_calendar_forward_and_backward") as RelationshipLagCalendarMethod,
      basis: STATED_BASIS[rule] + (rule === "project_default" ? " (" + (projectDefaultCalendarId ?? "not named in the file") + ")" : ""),
      assumption: null};
  }
  return result;
}

/** The basis as published beside CPM figures (forecast projection). */
export function relationshipLagCalendarSummary(model: CanonicalScheduleModel): RelationshipLagCalendarSummary {
  const {rule, stated, sourceValue, projectDefaultCalendarId, basis} = relationshipLagCalendarBasis(model);
  return {rule, stated, sourceValue, projectDefaultCalendarId, basis};
}
export type RelationshipLagCalendarSummary = Omit<RelationshipLagCalendarBasis, "method" | "assumption">;

/** 24-hour lag calendar: continuous elapsed time. */
const CONTINUOUS_LAG_CALENDAR: WorkingCalendarResolution = {
  calendar: ELAPSED_24H_CALENDAR,
  mode: "source_calendar",
  assumptions: [],
};

/** The calendar resolution a lag of one relationship is counted on, given
 * the predecessor's and successor's own resolutions. Null means the stated
 * lag calendar cannot be read (project default calendar missing or without
 * a working pattern): the lag is then unknown, never counted on another
 * calendar. */
export function lagCalendarResolver(
  model: CanonicalScheduleModel,
  basis: RelationshipLagCalendarBasis = relationshipLagCalendarBasis(model),
): (predecessor: WorkingCalendarResolution | null, successor: WorkingCalendarResolution | null) => WorkingCalendarResolution | null {
  switch (basis.rule) {
    case "successor":
      return (_predecessor, successor) => successor;
    case "predecessor":
      return (predecessor) => predecessor;
    case "24_hour":
      return () => CONTINUOUS_LAG_CALENDAR;
    case "project_default": {
      const resolved = basis.projectDefaultCalendarId === null ? null
        : resolveWorkingCalendar(basis.projectDefaultCalendarId, model.calendars, false);
      return () => resolved;
    }
  }
}
