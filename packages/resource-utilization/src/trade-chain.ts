import type {
  CanonicalCalendar,
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
} from "../../schedule-analysis-core/src";
import {
  addWorkingHours,
  parseScheduleInstant,
  resolveWorkingCalendar,
  workingHoursBetween,
} from "../../schedule-cpm/src";
import {
  resourceLaborHourEligible,
  type CanonicalResource,
  type CanonicalResourceAssignment,
  type CanonicalResourceModel,
} from "../../schedule-resource-core/src";
import { effectiveCapacity } from "./projector";

/**
 * F46 (D-065): one shared calculator for repeated trade chains.
 *
 * A chain is a set of activities of the same trade (the SW-27 source grouping:
 * activity code Discipline/Trade, else the labelled name match) joined by
 * programme relationships and spanning two or more locations. For each chain
 * and each labour-hour resource assigned to it, the remaining assignment hours
 * (TASKRSRC remaining quantity in the resource's own hour unit; never an
 * hours-per-day conversion) are spread over the assignment's remaining dates on
 * the activity calendar, totalled per 7-day period, compared with the stated
 * capacity, and the shortfall per period is carried forward at that capacity to
 * give the chain's resource-limited finish. When the chain is on the driving
 * path, that finish movement is the completion effect. Anything that cannot be
 * read from the sources is returned as not established with its reason.
 */

export interface TradeChainActivityGroup {
  activityId: string;
  trade: string | null;
  tradeSource: string | null;
  tradeBasis: string | null;
  location: string | null;
  locationSource: string | null;
}

export interface TradeChainRegisterCapacityRow {
  resourceId: string;
  resourceName: string | null;
  weekStartIso: string;
  capacityHours: number;
  authority: "approved_source" | "source_unconfirmed";
  sourceRef: string;
}

export interface TradeChainCapacityConfirmation {
  resourceId: string;
  capacityUnitsPerHour: number;
  effectiveFromIso: string;
  approvedBy: string;
  sourceRef: string;
}

export type TradeChainCapacitySource =
  | "project_confirmed"
  | "resource_register"
  | "programme_max_units";

export interface TradeChainPeriod {
  periodStartIso: string;
  periodEndIso: string;
  demandHours: number | null;
  capacityHours: number | null;
  shortfallHours: number | null;
  /** Remaining hours of the same resource on open work outside this chain. */
  otherDemandHours: number | null;
  backlogHours: number | null;
}

export interface TradeChainResourceRow {
  resourceId: string;
  resourceName: string | null;
  unit: "hours";
  assignmentCount: number;
  knownAssignmentCount: number;
  remainingHours: number | null;
  capacitySource: TradeChainCapacitySource | null;
  capacityLabel: string;
  capacitySourceRefs: string[];
  capacityUnitsPerHour: number | null;
  periods: TradeChainPeriod[];
  totalShortfallHours: number | null;
  peakShortfallHours: number | null;
  firstShortfallPeriodIso: string | null;
  scheduledFinishIso: string | null;
  resourceLimitedFinishIso: string | null;
  finishMovementCalendarDays: number | null;
  finishMovementWorkingHours: number | null;
  state: "established" | "not_established";
  reasons: string[];
}

export interface TradeChainCompletionEffect {
  state:
    | "established"
    | "not_on_driving_path"
    | "not_established";
  chainFinishIso: string | null;
  resourceLimitedFinishIso: string | null;
  completionDelayCalendarDays: number | null;
  completionDelayWorkingHours: number | null;
  basis: string;
  reasons: string[];
}

export interface TradeChainRow {
  chainId: string;
  trade: string;
  tradeSource: string;
  tradeBasis: string | null;
  activityIds: string[];
  openActivityIds: string[];
  locations: string[];
  locationSources: string[];
  onDrivingPath: boolean | null;
  drivingActivityIds: string[];
  remainingHours: number | null;
  resources: TradeChainResourceRow[];
  totalShortfallHours: number | null;
  completionEffect: TradeChainCompletionEffect;
  state: "established" | "not_established";
  reasons: string[];
}

export interface TradeChainResourcePosition {
  schemaVersion: "1.0";
  projectionKey: "trade_chain_resources";
  dataDateIso: string | null;
  state: "established" | "partial" | "none_found" | "not_established";
  reason: string | null;
  chainCount: number;
  establishedChainCount: number;
  shortfallChainCount: number;
  groupingBasis: string;
  periodBasis: string;
  drivingPathBasis: string;
  chains: TradeChainRow[];
  diagnostics: string[];
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const EPSILON = 1e-9;
/** Ten years of 7-day periods: a guard, not a planning horizon. */
const MAX_CLEARING_PERIODS = 522;

const round = (value: number, digits = 6) =>
  Number(value.toFixed(digits));
const iso = (ms: number) => new Date(ms).toISOString();
const normal = (value: string | null | undefined) =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const GROUPING_BASIS =
  "Activities of the same trade (activity code Discipline/Trade, else the labelled name match) joined by programme relationships and spanning two or more locations.";
const PERIOD_BASIS =
  "7-day periods: the resource register weeks when the register states the capacity, otherwise 7-day periods from the Data Date. Remaining assignment hours are spread over the assignment remaining dates in proportion to working hours on the activity calendar.";

function executionWork(activity: CanonicalScheduleActivity) {
  return ![
    "level_of_effort",
    "wbs_summary",
    "start_milestone",
    "finish_milestone",
    "milestone",
  ].includes(activity.activityType);
}

class Union {
  private parent = new Map<string, string>();
  find(id: string): string {
    let root = id;
    while (this.parent.has(root) && this.parent.get(root) !== root)
      root = this.parent.get(root)!;
    let cursor = id;
    while (cursor !== root) {
      const next = this.parent.get(cursor) ?? root;
      this.parent.set(cursor, root);
      cursor = next;
    }
    if (!this.parent.has(root)) this.parent.set(root, root);
    return root;
  }
  join(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      if (ra < rb) this.parent.set(rb, ra);
      else this.parent.set(ra, rb);
    }
  }
}

interface PhasedAssignment {
  assignment: CanonicalResourceAssignment;
  remainingHours: number;
  startMs: number;
  finishMs: number;
  calendar: CanonicalCalendar;
  workingHours: number;
}

function phase(
  assignment: CanonicalResourceAssignment,
  activity: CanonicalScheduleActivity,
  schedule: CanonicalScheduleModel,
  dataDateMs: number | null,
): { phased: PhasedAssignment | null; reason: string | null } {
  const remaining = assignment.remainingUnits;
  if (remaining === null || !Number.isFinite(remaining))
    return {
      phased: null,
      reason:
        "REMAINING_HOURS_NOT_STATED:" + assignment.assignmentId,
    };
  if (assignment.curveId)
    return {
      phased: null,
      reason:
        "RESOURCE_CURVE_NOT_READ:" +
        assignment.assignmentId +
        ":" +
        assignment.curveId,
    };
  const startText =
    assignment.remainingStartIso ??
    activity.forecastStartIso ??
    activity.currentStartIso;
  const finishText =
    assignment.remainingFinishIso ??
    activity.forecastFinishIso ??
    activity.currentFinishIso;
  let start = parseScheduleInstant(startText);
  const finish = parseScheduleInstant(finishText);
  if (start === null || finish === null)
    return {
      phased: null,
      reason:
        "REMAINING_DATES_NOT_STATED:" + assignment.assignmentId,
    };
  if (dataDateMs !== null && start < dataDateMs) start = dataDateMs;
  const resolved = resolveWorkingCalendar(
    activity.calendarId,
    schedule.calendars,
    false,
  );
  if (!resolved)
    return {
      phased: null,
      reason:
        "ACTIVITY_CALENDAR_NOT_ESTABLISHED:" +
        activity.activityId +
        ":" +
        (activity.calendarId ?? "none"),
    };
  const hours =
    finish > start
      ? workingHoursBetween(resolved.calendar, start, finish)
      : 0;
  if (remaining > 0 && hours <= 0)
    return {
      phased: null,
      reason:
        "NO_WORKING_TIME_IN_REMAINING_DATES:" +
        assignment.assignmentId,
    };
  return {
    phased: {
      assignment,
      remainingHours: remaining,
      startMs: start,
      finishMs: finish,
      calendar: resolved.calendar,
      workingHours: hours,
    },
    reason: null,
  };
}

function demandIn(
  rows: readonly PhasedAssignment[],
  fromMs: number,
  toMs: number,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.remainingHours === 0 || row.workingHours <= 0) continue;
    const from = Math.max(fromMs, row.startMs);
    const to = Math.min(toMs, row.finishMs);
    if (to <= from) continue;
    total +=
      (row.remainingHours *
        workingHoursBetween(row.calendar, from, to)) /
      row.workingHours;
  }
  return total;
}

interface CapacityBasis {
  source: TradeChainCapacitySource;
  label: string;
  sourceRefs: string[];
  unitsPerHour: number | null;
  anchorMs: number | null;
  /** Capacity hours for [startMs, endMs), or null when not stated. */
  hours: (startMs: number, endMs: number) => number | null;
  /** Instant at which `hours` of capacity are used up from `startMs` inside one period. */
  clearAt: (startMs: number, endMs: number, hours: number) => number | null;
  reason: (startMs: number) => string;
}

function capacityBasis(
  resource: CanonicalResource,
  register: readonly TradeChainRegisterCapacityRow[],
  confirmations: readonly TradeChainCapacityConfirmation[],
  calendar: CanonicalCalendar | null,
  dataDateMs: number | null,
  dataDateIso: string | null,
): CapacityBasis | null {
  const to = (value: number) => round(value);
  const rateBasis = (
    source: TradeChainCapacitySource,
    label: string,
    refs: string[],
    rateAt: (startMs: number) => number | null,
    unitsAtDataDate: number | null,
  ): CapacityBasis => ({
    source,
    label,
    sourceRefs: refs,
    unitsPerHour: unitsAtDataDate,
    anchorMs: null,
    hours: (startMs, endMs) => {
      const rate = rateAt(startMs);
      if (rate === null || !calendar) return null;
      const from =
        dataDateMs !== null ? Math.max(startMs, dataDateMs) : startMs;
      return to(rate * (endMs > from ? workingHoursBetween(calendar, from, endMs) : 0));
    },
    clearAt: (startMs, endMs, hours) => {
      const rate = rateAt(startMs);
      if (rate === null || rate <= 0 || !calendar) return null;
      return Math.min(endMs, addWorkingHours(calendar, startMs, hours / rate));
    },
    reason: (startMs) =>
      !calendar
        ? "CAPACITY_CALENDAR_NOT_ESTABLISHED:" + resource.resourceId
        : "CAPACITY_RATE_NOT_STATED:" + resource.resourceId + ":" + iso(startMs).slice(0, 10),
  });

  const confirmed = confirmations.filter(
    (row) =>
      row.resourceId === resource.resourceId &&
      Number.isFinite(row.capacityUnitsPerHour) &&
      row.capacityUnitsPerHour >= 0,
  );
  if (confirmed.length) {
    const rateAt = (startMs: number) => {
      const day = iso(startMs).slice(0, 10);
      const row = confirmed
        .filter((item) => item.effectiveFromIso.slice(0, 10) <= day)
        .sort((a, b) => b.effectiveFromIso.localeCompare(a.effectiveFromIso))[0];
      return row?.capacityUnitsPerHour ?? null;
    };
    return rateBasis(
      "project_confirmed",
      "Project-confirmed capacity (" + confirmed[0]!.approvedBy + ")",
      [...new Set(confirmed.map((row) => row.sourceRef))],
      rateAt,
      dataDateMs === null ? null : rateAt(dataDateMs),
    );
  }

  const ids = new Set(
    [resource.resourceId, resource.nativeId, resource.shortName]
      .filter((value): value is string => Boolean(value))
      .map(normal),
  );
  const name = normal(resource.name);
  const rows = register.filter(
    (row) =>
      ids.has(normal(row.resourceId)) ||
      (name !== "" && normal(row.resourceName) === name),
  );
  if (rows.length) {
    const byStart = new Map<number, TradeChainRegisterCapacityRow>();
    const conflicted = new Set<number>();
    for (const row of rows) {
      const ms = parseScheduleInstant(row.weekStartIso.slice(0, 10));
      if (ms === null) continue;
      const prior = byStart.get(ms);
      if (prior && prior.capacityHours !== row.capacityHours) conflicted.add(ms);
      else byStart.set(ms, row);
    }
    for (const ms of conflicted) byStart.delete(ms);
    const starts = [...byStart.keys()].sort((a, b) => a - b);
    const anchor = starts[0] ?? null;
    const authority = rows.every((row) => row.authority === "approved_source")
      ? "approved in the register"
      : "stated in the register; approval not recorded";
    return {
      source: "resource_register",
      label: "Resource register weekly available capacity (" + authority + ")",
      sourceRefs: [...new Set(rows.map((row) => row.sourceRef))],
      unitsPerHour: null,
      anchorMs: anchor,
      hours: (startMs, endMs) => {
        const row = byStart.get(startMs);
        if (!row || endMs - startMs !== WEEK_MS) return null;
        if (dataDateMs === null || dataDateMs <= startMs) return row.capacityHours;
        if (dataDateMs >= endMs) return 0;
        // The Data Date falls inside this register week: only the working
        // hours after the Data Date remain available.
        if (!calendar) return null;
        const whole = workingHoursBetween(calendar, startMs, endMs);
        if (whole <= 0) return null;
        return to(
          (row.capacityHours * workingHoursBetween(calendar, dataDateMs, endMs)) /
            whole,
        );
      },
      clearAt: (startMs, endMs, hours) => {
        const row = byStart.get(startMs);
        if (!row || !calendar || row.capacityHours <= 0) return null;
        const whole = workingHoursBetween(calendar, startMs, endMs);
        if (whole <= 0) return null;
        return Math.min(
          endMs,
          addWorkingHours(calendar, startMs, (hours * whole) / row.capacityHours),
        );
      },
      reason: (startMs) =>
        conflicted.has(startMs)
          ? "REGISTER_CAPACITY_CONFLICT:" + resource.resourceId + ":" + iso(startMs).slice(0, 10)
          : !calendar
            ? "CAPACITY_CALENDAR_NOT_ESTABLISHED:" + resource.resourceId
            : "REGISTER_CAPACITY_NOT_STATED_FOR_WEEK:" + resource.resourceId + ":" + iso(startMs).slice(0, 10),
    };
  }

  const rated = resource.rates.some(
    (rate) => rate.maxUnitsPerHour !== null && rate.maxUnitsPerHour >= 0,
  );
  if (rated) {
    return rateBasis(
      "programme_max_units",
      "Programme resource max units per hour (a programme rate, not an approved crew limit)",
      resource.rates.flatMap((rate) => rate.sourceRefs.map((ref) => ref.source + ":" + ref.locator)),
      (startMs) => effectiveCapacity(resource, iso(startMs)).value,
      effectiveCapacity(resource, dataDateIso).value,
    );
  }
  return null;
}

function emptyEffect(reasons: string[]): TradeChainCompletionEffect {
  return {
    state: "not_established",
    chainFinishIso: null,
    resourceLimitedFinishIso: null,
    completionDelayCalendarDays: null,
    completionDelayWorkingHours: null,
    basis: "Completion effect not established.",
    reasons,
  };
}

export function buildTradeChainResourcePosition(
  schedule: CanonicalScheduleModel,
  resources: CanonicalResourceModel | null,
  input: {
    groups: readonly TradeChainActivityGroup[];
    drivingActivityIds: readonly string[] | null;
    drivingPathBasis: string;
    registerCapacity?: readonly TradeChainRegisterCapacityRow[];
    capacityConfirmations?: readonly TradeChainCapacityConfirmation[];
  },
): TradeChainResourcePosition {
  const dataDateIso = schedule.dataDateIso;
  const dataDateMs = parseScheduleInstant(dataDateIso);
  const base = {
    schemaVersion: "1.0" as const,
    projectionKey: "trade_chain_resources" as const,
    dataDateIso,
    groupingBasis: GROUPING_BASIS,
    periodBasis: PERIOD_BASIS,
    drivingPathBasis: input.drivingPathBasis,
  };
  const activityById = new Map(
    schedule.activities.map((activity) => [activity.activityId, activity]),
  );
  const groupById = new Map(
    input.groups
      .filter((group) => group.trade && group.tradeSource)
      .map((group) => [group.activityId, group]),
  );
  const tradeKey = (id: string) => {
    const group = groupById.get(id);
    const activity = activityById.get(id);
    if (!group || !activity || !executionWork(activity)) return null;
    return JSON.stringify([group.tradeSource, normal(group.trade)]);
  };

  // Same-trade activities joined by any programme relationship.
  const union = new Union();
  for (const relation of schedule.relationships) {
    const a = tradeKey(relation.predecessorActivityId);
    if (a === null || a !== tradeKey(relation.successorActivityId)) continue;
    union.join(relation.predecessorActivityId, relation.successorActivityId);
  }
  const components = new Map<string, string[]>();
  for (const id of groupById.keys()) {
    if (tradeKey(id) === null) continue;
    const root = union.find(id);
    const list = components.get(root) ?? [];
    list.push(id);
    components.set(root, list);
  }

  const startOf = (activity: CanonicalScheduleActivity) =>
    activity.actualStartIso ??
    activity.forecastStartIso ??
    activity.currentStartIso ??
    "";
  const candidates = [...components.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) =>
      ids
        .map((id) => activityById.get(id)!)
        .sort(
          (a, b) =>
            startOf(a).localeCompare(startOf(b)) ||
            a.activityId.localeCompare(b.activityId),
        ),
    )
    .filter((activities) => {
      const locations = new Set(
        activities
          .map((activity) => normal(groupById.get(activity.activityId)?.location))
          .filter(Boolean),
      );
      return (
        locations.size >= 2 &&
        activities.some((activity) => activity.status !== "completed")
      );
    });

  if (!candidates.length) {
    return {
      ...base,
      state: "none_found",
      reason:
        "No repeated trade chain found: no two or more same-trade activities at different locations are joined by programme logic.",
      chainCount: 0,
      establishedChainCount: 0,
      shortfallChainCount: 0,
      chains: [],
      diagnostics: [],
    };
  }

  const driving =
    input.drivingActivityIds === null ? null : new Set(input.drivingActivityIds);
  const resourceById = new Map(
    (resources?.resources ?? []).map((resource) => [resource.resourceId, resource]),
  );
  const assignmentsByActivity = new Map<string, CanonicalResourceAssignment[]>();
  const assignmentsByResource = new Map<string, CanonicalResourceAssignment[]>();
  for (const assignment of resources?.assignments ?? []) {
    if (!assignment.resourceId) continue;
    const resource = resourceById.get(assignment.resourceId);
    if (!resource || !resourceLaborHourEligible(resource)) continue;
    const list = assignmentsByActivity.get(assignment.activityId) ?? [];
    list.push(assignment);
    assignmentsByActivity.set(assignment.activityId, list);
    const byResource = assignmentsByResource.get(assignment.resourceId) ?? [];
    byResource.push(assignment);
    assignmentsByResource.set(assignment.resourceId, byResource);
  }
  const unitExcluded = (resources?.assignments ?? []).filter((assignment) => {
    const resource = assignment.resourceId ? resourceById.get(assignment.resourceId) : null;
    return (
      resource &&
      resource.resourceType === "labor" &&
      !resourceLaborHourEligible(resource)
    );
  });

  // One phasing per assignment, shared by every chain that reads it.
  const phaseMemo = new Map<CanonicalResourceAssignment, ReturnType<typeof phase>>();
  const phaseOnce = (assignment: CanonicalResourceAssignment, activity: CanonicalScheduleActivity) => {
    let result = phaseMemo.get(assignment);
    if (!result) {
      result = phase(assignment, activity, schedule, dataDateMs);
      phaseMemo.set(assignment, result);
    }
    return result;
  };

  const chains: TradeChainRow[] = candidates.map((activities) => {
    const first = activities[0]!;
    const group = groupById.get(first.activityId)!;
    const open = activities.filter((activity) => activity.status !== "completed");
    const openIds = new Set(open.map((activity) => activity.activityId));
    const locations = [
      ...new Set(
        activities
          .map((activity) => groupById.get(activity.activityId)?.location ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const locationSources = [
      ...new Set(
        activities
          .map((activity) => groupById.get(activity.activityId)?.locationSource ?? null)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const drivingIds =
      driving === null ? [] : open.map((a) => a.activityId).filter((id) => driving.has(id));
    const onDrivingPath = driving === null ? null : drivingIds.length > 0;
    const chainReasons: string[] = [];
    if (!resources) chainReasons.push("PROGRAMME_RESOURCE_ASSIGNMENTS_NOT_SUPPLIED");
    const excluded = unitExcluded.filter((assignment) => openIds.has(assignment.activityId));
    for (const assignment of excluded)
      chainReasons.push("RESOURCE_UNIT_NOT_HOURS:" + assignment.resourceId + ":" + assignment.assignmentId);

    const chainAssignments = open.flatMap(
      (activity) => assignmentsByActivity.get(activity.activityId) ?? [],
    );
    if (resources && !chainAssignments.length && !excluded.length)
      chainReasons.push("NO_LABOUR_HOUR_ASSIGNMENTS_ON_CHAIN");
    const resourceIds = [...new Set(chainAssignments.map((a) => a.resourceId!))].sort();
    const chainCalendars = [
      ...new Set(open.map((activity) => activity.calendarId).filter(Boolean)),
    ] as string[];

    const rows: TradeChainResourceRow[] = resourceIds.map((resourceId) => {
      const resource = resourceById.get(resourceId)!;
      const own = chainAssignments.filter((a) => a.resourceId === resourceId);
      const reasons: string[] = [];
      const known = own.filter(
        (a) => a.remainingUnits !== null && Number.isFinite(a.remainingUnits),
      );
      const remainingHours =
        known.length === own.length
          ? round(known.reduce((sum, a) => sum + a.remainingUnits!, 0))
          : null;
      if (remainingHours === null) reasons.push("REMAINING_HOURS_NOT_STATED_ON_SOME_ASSIGNMENTS:" + resourceId);
      const phased: PhasedAssignment[] = [];
      for (const assignment of own) {
        const result = phaseOnce(assignment, activityById.get(assignment.activityId)!);
        if (result.phased) phased.push(result.phased);
        else reasons.push(result.reason!);
      }
      // Same resource on open work outside this chain, in the same periods.
      const other: PhasedAssignment[] = [];
      let otherKnown = true;
      for (const assignment of assignmentsByResource.get(resourceId) ?? []) {
        if (openIds.has(assignment.activityId)) continue;
        const activity = activityById.get(assignment.activityId);
        if (!activity || activity.status === "completed") continue;
        const result = phaseOnce(assignment, activity);
        if (result.phased) other.push(result.phased);
        else otherKnown = false;
      }
      const resourceCalendar = resolveWorkingCalendar(resource.calendarId, schedule.calendars, false);
      const capacityCalendar =
        resourceCalendar?.calendar ??
        (chainCalendars.length === 1
          ? resolveWorkingCalendar(chainCalendars[0]!, schedule.calendars, false)?.calendar ?? null
          : null);
      const capacity = capacityBasis(
        resource,
        input.registerCapacity ?? [],
        input.capacityConfirmations ?? [],
        capacityCalendar,
        dataDateMs,
        dataDateIso,
      );
      if (!capacity) reasons.push("CAPACITY_NOT_STATED:" + resourceId);

      const scheduledFinishMs = phased.length
        ? Math.max(...phased.map((row) => row.finishMs))
        : null;
      const row: TradeChainResourceRow = {
        resourceId,
        resourceName: resource.name ?? resource.shortName,
        unit: "hours",
        assignmentCount: own.length,
        knownAssignmentCount: known.length,
        remainingHours,
        capacitySource: capacity?.source ?? null,
        capacityLabel: capacity?.label ?? "Capacity not stated in the resource register or the programme",
        capacitySourceRefs: capacity?.sourceRefs ?? [],
        capacityUnitsPerHour: capacity?.unitsPerHour ?? null,
        periods: [],
        totalShortfallHours: null,
        peakShortfallHours: null,
        firstShortfallPeriodIso: null,
        scheduledFinishIso: scheduledFinishMs === null ? null : iso(scheduledFinishMs),
        resourceLimitedFinishIso: null,
        finishMovementCalendarDays: null,
        finishMovementWorkingHours: null,
        state: "not_established",
        reasons,
      };
      const allPhased = phased.length === own.length && own.length > 0;
      const active = phased.filter((p) => p.remainingHours > 0 && p.finishMs > p.startMs);
      if (!allPhased || !active.length) {
        if (allPhased && !active.length && remainingHours === 0) {
          row.state = "established";
          row.totalShortfallHours = 0;
          row.peakShortfallHours = 0;
          row.finishMovementCalendarDays = 0;
          row.finishMovementWorkingHours = 0;
          row.resourceLimitedFinishIso = row.scheduledFinishIso;
        }
        return row;
      }
      const demandStart = Math.min(...active.map((p) => p.startMs));
      const demandEnd = Math.max(...active.map((p) => p.finishMs));
      const anchor = capacity?.anchorMs ?? dataDateMs ?? demandStart;
      const periodStartFor = (ms: number) => anchor + Math.floor((ms - anchor) / WEEK_MS) * WEEK_MS;
      const firstStart = periodStartFor(demandStart);
      const lastStart = periodStartFor(demandEnd - 1);
      let backlog: number | null = 0;
      let total = 0;
      let peak = 0;
      let firstShortfall: number | null = null;
      let capacityComplete = Boolean(capacity);
      for (let start = firstStart; start <= lastStart; start += WEEK_MS) {
        const end = start + WEEK_MS;
        const demand = round(demandIn(active, start, end));
        const cap = capacity ? capacity.hours(start, end) : null;
        if (cap === null) {
          capacityComplete = false;
          if (capacity) reasons.push(capacity.reason(start));
        }
        const shortfall = cap === null ? null : round(Math.max(0, demand - cap));
        if (shortfall !== null) {
          total += shortfall;
          if (shortfall > peak) peak = shortfall;
          if (shortfall > EPSILON && firstShortfall === null) firstShortfall = start;
        }
        backlog = backlog === null || cap === null ? null : round(Math.max(0, backlog + demand - cap));
        row.periods.push({
          periodStartIso: iso(start),
          periodEndIso: iso(end),
          demandHours: demand,
          capacityHours: cap,
          shortfallHours: shortfall,
          otherDemandHours: otherKnown ? round(demandIn(other, start, end)) : null,
          backlogHours: backlog,
        });
      }
      row.reasons = [...new Set(reasons)];
      if (!capacity || !capacityComplete || backlog === null) return row;
      row.totalShortfallHours = round(total);
      row.peakShortfallHours = round(peak);
      row.firstShortfallPeriodIso = firstShortfall === null ? null : iso(firstShortfall);
      const finish = scheduledFinishMs!;
      if (backlog <= EPSILON) {
        row.state = "established";
        row.resourceLimitedFinishIso = iso(finish);
        row.finishMovementCalendarDays = 0;
        row.finishMovementWorkingHours = 0;
        return row;
      }
      // Carry the remaining backlog forward at the stated capacity.
      let left = backlog;
      let clearedAt: number | null = null;
      for (let index = 1, start = lastStart + WEEK_MS; index <= MAX_CLEARING_PERIODS; index++, start += WEEK_MS) {
        const end = start + WEEK_MS;
        const cap = capacity.hours(start, end);
        if (cap === null) {
          row.reasons = [...new Set([...row.reasons, capacity.reason(start)])];
          return row;
        }
        if (cap + EPSILON >= left) {
          clearedAt = capacity.clearAt(start, end, left);
          if (clearedAt === null) row.reasons = [...new Set([...row.reasons, capacity.reason(start)])];
          break;
        }
        left = round(left - cap);
      }
      if (clearedAt === null) {
        if (!row.reasons.length) row.reasons.push("BACKLOG_NOT_CLEARED_WITHIN_GUARD:" + resourceId);
        return row;
      }
      row.state = "established";
      row.resourceLimitedFinishIso = iso(clearedAt);
      row.finishMovementCalendarDays = round((clearedAt - finish) / DAY_MS, 4);
      row.finishMovementWorkingHours = capacityCalendar
        ? round(workingHoursBetween(capacityCalendar, finish, clearedAt), 4)
        : null;
      return row;
    });

    const remainingHours =
      rows.length && rows.every((row) => row.remainingHours !== null)
        ? round(rows.reduce((sum, row) => sum + row.remainingHours!, 0))
        : null;
    const established = rows.length > 0 && rows.every((row) => row.state === "established") && !excluded.length;
    const reasons = [...new Set([...chainReasons, ...rows.flatMap((row) => row.reasons)])];
    const latest = (values: Array<string | null>) =>
      values.every((value) => value !== null) && values.length
        ? (values as string[]).sort().at(-1)!
        : null;
    const chainFinishIso = latest(rows.map((row) => row.scheduledFinishIso));
    const limitedFinishIso = established ? latest(rows.map((row) => row.resourceLimitedFinishIso)) : null;
    let completionEffect: TradeChainCompletionEffect;
    if (!established || chainFinishIso === null || limitedFinishIso === null) {
      completionEffect = emptyEffect(reasons.length ? reasons : ["CHAIN_RESOURCE_POSITION_NOT_ESTABLISHED"]);
    } else {
      const delayDays = round((Date.parse(limitedFinishIso) - Date.parse(chainFinishIso)) / DAY_MS, 4);
      const limiting = rows.find((row) => row.resourceLimitedFinishIso === limitedFinishIso)!;
      const delayHours = delayDays === 0 ? 0 : limiting.finishMovementWorkingHours;
      if (onDrivingPath === true) {
        completionEffect = {
          state: "established",
          chainFinishIso,
          resourceLimitedFinishIso: limitedFinishIso,
          completionDelayCalendarDays: delayDays,
          completionDelayWorkingHours: delayHours,
          basis:
            "The chain is on the driving path. Its finish moves to the instant the shortfall is cleared at the stated capacity, with the chain given first call on the resource; completion moves by the same time.",
          reasons: [],
        };
      } else if (onDrivingPath === false) {
        completionEffect = {
          state: "not_on_driving_path",
          chainFinishIso,
          resourceLimitedFinishIso: limitedFinishIso,
          completionDelayCalendarDays: null,
          completionDelayWorkingHours: null,
          basis:
            "The chain is not on the driving path. Its own finish movement is shown; it uses float before it moves completion.",
          reasons: ["CHAIN_NOT_ON_DRIVING_PATH"],
        };
      } else {
        completionEffect = {
          ...emptyEffect(["DRIVING_PATH_NOT_ESTABLISHED"]),
          chainFinishIso,
          resourceLimitedFinishIso: limitedFinishIso,
          basis: "The chain finish movement is shown; whether it moves completion needs the driving path, which is not established.",
        };
      }
    }
    const totalShortfall =
      established ? round(rows.reduce((sum, row) => sum + (row.totalShortfallHours ?? 0), 0)) : null;
    return {
      chainId: (group.trade ?? "") + "|" + first.activityId,
      trade: group.trade!,
      tradeSource: group.tradeSource!,
      tradeBasis: group.tradeBasis,
      activityIds: activities.map((activity) => activity.activityId),
      openActivityIds: open.map((activity) => activity.activityId),
      locations,
      locationSources,
      onDrivingPath,
      drivingActivityIds: drivingIds,
      remainingHours,
      resources: rows,
      totalShortfallHours: totalShortfall,
      completionEffect,
      state: established ? "established" : "not_established",
      reasons,
    };
  });

  chains.sort(
    (a, b) =>
      Number(b.onDrivingPath === true) - Number(a.onDrivingPath === true) ||
      (b.totalShortfallHours ?? -1) - (a.totalShortfallHours ?? -1) ||
      b.activityIds.length - a.activityIds.length ||
      a.chainId.localeCompare(b.chainId),
  );
  const establishedCount = chains.filter((chain) => chain.state === "established").length;
  return {
    ...base,
    state: establishedCount === chains.length ? "established" : establishedCount ? "partial" : "not_established",
    reason:
      establishedCount === chains.length
        ? null
        : "Some chain hours, capacity or periods are not stated in the sources; see each chain's reasons.",
    chainCount: chains.length,
    establishedChainCount: establishedCount,
    shortfallChainCount: chains.filter((chain) => (chain.totalShortfallHours ?? 0) > EPSILON).length,
    chains,
    diagnostics: [],
  };
}
