import type { CanonicalDelayEvent, DelayClaimsModel } from "./types";

/** Model diagnostics written only by the claims register readers (kept so stored models read before identitySource existed are judged the same way). */
const CLAIMS_REGISTER_EVENT_MODEL_DIAGNOSTICS = [
  "EVENT_IDENTITIES_ESTABLISHED_FROM_SOURCE_REGISTER_CAUSATION_REMAINS_UNPROVEN",
  "DELAY_EVENTS_GOVERNED_FROM_CLAIMS_REGISTER_FIELDS",
];

export const EVENT_POPULATION_NOT_ESTABLISHED_REASON =
  "EVENT_POPULATION_NOT_ESTABLISHED_NO_EVENT_SOURCE: only claims register rows cite these events; a claim is not an event, so event count and event dates need an event register, a notice that states the event, or an event recorded by the user";

export interface DelayEventPopulation {
  state: "established" | "not_established";
  reason: string | null;
  /** Event ids that come from an event source (never from a claim row). */
  sourceEventIds: Set<string>;
  /** Per model.events index: true when that event comes from an event source. A claim row that repeats a source event id is still a claim row. */
  fromEventSource: boolean[];
}

/** True only when the event identity comes from an event source, not from a claim row. */
export function eventFromEventSource(event: CanonicalDelayEvent, model: Pick<DelayClaimsModel, "diagnostics">): boolean {
  if (event.identitySource !== undefined) return event.identitySource !== "claims_register_row";
  return !model.diagnostics.some((code) => CLAIMS_REGISTER_EVENT_MODEL_DIAGNOSTICS.includes(code));
}

/** One shared rule for every delay, notice and claim page: delay events come only from event sources. */
export function delayEventPopulation(model: Pick<DelayClaimsModel, "events" | "diagnostics">): DelayEventPopulation {
  const fromEventSource = model.events.map((event) => eventFromEventSource(event, model));
  const sourceEventIds = new Set(model.events.filter((_, index) => fromEventSource[index]).map((event) => event.eventId));
  const claimRowOnly = sourceEventIds.size === 0 && model.events.length > 0;
  return {
    state: claimRowOnly ? "not_established" : "established",
    reason: claimRowOnly ? EVENT_POPULATION_NOT_ESTABLISHED_REASON : null,
    sourceEventIds,
    fromEventSource,
  };
}
