import { registerColumnKind, registerDate } from '../../truth-kernel/src';
import type { CanonicalDelayEvent, DelayEvidenceRef } from '../../delay-analysis-core/src';

/**
 * SW-15 / F06: one shared reader for delay event sources, used by both claims
 * readers (canonical-time-claims and evidence-control-adapters) so they agree.
 *
 * An event source is an event/delay register, or a notice register that states
 * an event. It is found by its headers (an event id column) or, in a delay,
 * claim or notice document, by its content: one column of distinct identifiers,
 * one column whose every value is a date and one column of distinct text
 * descriptions. A table with any claim column (a header naming a claim, claimed
 * or granted days) or any money amount column is a claims table, never an event
 * source. A claim row is never an event.
 */
export interface EventSourceColumns {
  identifiedBy: 'header' | 'content';
  noticeStated: boolean;
  eventId: number;
  title: number;
  start: number;
  end: number;
  awareness: number;
  responsibility: number;
  clause: number;
}

const EVENT_ID_HEADERS = ['event id', 'delay event id', 'event no', 'event number', 'event ref', 'event reference'];
const TITLE_HEADERS = ['description', 'event description', 'event', 'title', 'event title'];
const START_HEADERS = ['event date', 'event start', 'event start date', 'start date', 'delay start', 'from date'];
const END_HEADERS = ['event end', 'event end date', 'end date', 'delay end', 'to date'];
const NOTICE_HEADERS = ['notice date', 'notice reference', 'notice ref', 'letter reference', 'letter no', 'letter number', 'issued date'];
const CLAIM_ONLY_HEADERS = ['days claimed', 'claimed days', 'days granted', 'granted days', 'source granted days', 'claimed amount', 'amount claimed', 'claim amount', 'submitted amount', 'assessed amount'];

const find = (headers: readonly string[], names: readonly string[]): number => {
  for (const name of names) { const index = headers.indexOf(name); if (index >= 0) return index; }
  return -1;
};
const valuesOf = (rows: readonly (readonly string[])[], index: number): string[] =>
  rows.map((row) => (row[index] ?? '').trim());
const distinct = (values: readonly string[]): boolean => new Set(values).size === values.length;

/** Cheap header-only pre-check, so large unrelated tables are never scanned cell by cell. */
export function eventSourceCandidate(documentType: string | null | undefined, headers: readonly string[]): boolean {
  if (headers.some((header) => header === 'claim id' || CLAIM_ONLY_HEADERS.includes(header))) return false;
  return find(headers, EVENT_ID_HEADERS) >= 0 || /delay|eot|claim|notice|letter|correspondence/.test(documentType ?? '');
}

export function detectEventSourceTable(input: {
  documentType?: string | null;
  headers: readonly string[];
  rawHeaders?: readonly string[];
  rows: readonly (readonly string[])[];
}): EventSourceColumns | null {
  const { headers, rows } = input;
  const raw = headers.map((header, index) => input.rawHeaders?.[index] ?? header);
  if (!rows.length) return null;
  // Any claim column (including a column the shared schema reads as the claim id)
  // or any money amount makes this a claims table: claims stay claims.
  if (raw.some((header) => /claim/i.test(header)) || headers.some((header) => header === 'claim id' || CLAIM_ONLY_HEADERS.includes(header))) return null;
  if (headers.some((header, index) => registerColumnKind(raw[index]!, header) === 'amount')) return null;
  const noticeStated = /notice|letter|correspondence/.test(input.documentType ?? '') || NOTICE_HEADERS.some((name) => headers.includes(name));
  const columns = (identifiedBy: EventSourceColumns['identifiedBy'], eventId: number, title: number, start: number): EventSourceColumns => ({
    identifiedBy, noticeStated, eventId, title, start,
    end: find(headers, END_HEADERS),
    awareness: find(headers, ['awareness date']),
    responsibility: find(headers, ['responsibility', 'responsible party', 'delay responsibility', 'cause']),
    clause: find(headers, ['clause', 'clause reference']),
  });

  const headerEventId = find(headers, EVENT_ID_HEADERS);
  if (headerEventId >= 0) {
    const title = find(headers, TITLE_HEADERS), start = find(headers, START_HEADERS);
    return title >= 0 || start >= 0 ? columns('header', headerEventId, title, start) : null;
  }

  // Content: only in a delay, claim or notice document, and only when every
  // value of the identifier, date and description columns has that shape.
  if (!/delay|eot|claim|notice|letter|correspondence/.test(input.documentType ?? '')) return null;
  const isDate = (value: string) => registerDate(value) !== null;
  const dateColumn = (index: number) => { const values = valuesOf(rows, index).filter(Boolean); return values.length > 0 && values.every(isDate); };
  const idColumn = (index: number) => {
    const values = valuesOf(rows, index);
    return values.every((value) => value !== '' && /\d/.test(value) && /^\S+$/.test(value) && !isDate(value)) && distinct(values);
  };
  const textColumn = (index: number) => {
    const values = valuesOf(rows, index);
    return values.every((value) => value !== '' && /\p{L}/u.test(value) && !isDate(value))
      && values.some((value) => /\s/.test(value)) && distinct(values);
  };
  const eventId = headers.findIndex((_, index) => idColumn(index));
  if (eventId < 0) return null;
  const start = find(headers, START_HEADERS) >= 0 ? find(headers, START_HEADERS) : headers.findIndex((_, index) => index !== eventId && dateColumn(index));
  const title = find(headers, TITLE_HEADERS) >= 0 ? find(headers, TITLE_HEADERS) : headers.findIndex((_, index) => index !== eventId && index !== start && textColumn(index));
  return start >= 0 && title >= 0 ? columns('content', eventId, title, start) : null;
}

export function eventResponsibility(text: string): CanonicalDelayEvent['responsibility'] {
  return /employer|client|owner/i.test(text) ? 'employer'
    : /contractor/i.test(text) ? 'contractor'
      : /concurrent|shared/i.test(text) ? 'concurrent'
        : /neutral|authority|weather|force majeure/i.test(text) ? 'neutral'
          : 'unknown';
}

/** One event from one event-source row; dates come only from this row. */
export function eventFromSourceRow(columns: EventSourceColumns, row: readonly string[], ref: { sourceId: string; locator: string | null }): CanonicalDelayEvent | null {
  const at = (index: number) => (index >= 0 ? (row[index] ?? '').trim() : '');
  const eventId = at(columns.eventId);
  if (!eventId) return null;
  const responsibilityText = at(columns.responsibility), clause = at(columns.clause);
  const responsibility = eventResponsibility(responsibilityText);
  const evidenceRef: DelayEvidenceRef = { sourceType: columns.noticeStated ? 'notice' : 'other', sourceId: ref.sourceId, locator: ref.locator };
  return {
    eventId, title: at(columns.title) || eventId, category: 'other',
    identitySource: columns.noticeStated ? 'notice' : 'event_register',
    startIso: registerDate(at(columns.start)), awarenessIso: registerDate(at(columns.awareness)), endIso: registerDate(at(columns.end)),
    responsibility, responsibilityState: responsibilityText && responsibility !== 'unknown' ? 'candidate' : 'missing',
    describedImpactDays: null, describedImpactState: 'missing',
    relatedActivityIds: [], relatedWindowReferences: [], relatedClauseIdentifiers: clause ? [clause] : [],
    evidenceRefs: [evidenceRef],
    diagnostics: [columns.noticeStated ? 'EVENT_FROM_NOTICE_STATING_EVENT' : 'EVENT_FROM_EVENT_REGISTER', 'SOURCE_REGISTER_EVENT_NOT_PROVEN_CAUSATION',
      ...(columns.identifiedBy === 'content' ? ['EVENT_REGISTER_IDENTIFIED_BY_COLUMN_CONTENT'] : [])],
  };
}

const uniq = (values: readonly string[]) => [...new Set(values)];

/**
 * Merge source events into a population of claim-cited references. A claim
 * reference with the same event id keeps its links on the source event and is
 * removed as a separate row; the event's dates come only from the source. The
 * first source row for an id wins; later duplicates are reported.
 */
export function mergeSourceEvents(events: CanonicalDelayEvent[], sourceEvents: readonly CanonicalDelayEvent[], diagnostics: string[]): Set<string> {
  const sourceEventIds = new Set<string>();
  for (const source of sourceEvents) {
    if (sourceEventIds.has(source.eventId)) { diagnostics.push('DUPLICATE_EVENT_ID_IN_EVENT_SOURCE:' + source.eventId); continue; }
    sourceEventIds.add(source.eventId);
    const cited = events.filter((event) => event.eventId === source.eventId && event.identitySource === 'claims_register_row');
    const withCorrespondence = cited.find((event) => event.activityCorrespondence);
    const merged: CanonicalDelayEvent = {
      ...source,
      title: source.title !== source.eventId ? source.title : cited[0]?.title ?? source.title,
      responsibility: source.responsibility === 'unknown' && cited[0] ? cited[0].responsibility : source.responsibility,
      responsibilityState: source.responsibility !== 'unknown' ? source.responsibilityState : cited[0]?.responsibilityState ?? source.responsibilityState,
      describedImpactDays: cited[0]?.describedImpactDays ?? null, describedImpactState: cited[0]?.describedImpactState ?? 'missing',
      relatedActivityIds: uniq(cited.flatMap((event) => event.relatedActivityIds)).sort(),
      ...(withCorrespondence ? { activityCorrespondence: withCorrespondence.activityCorrespondence } : {}),
      relatedWindowReferences: uniq(cited.flatMap((event) => event.relatedWindowReferences ?? [])),
      relatedClauseIdentifiers: uniq([...source.relatedClauseIdentifiers, ...cited.flatMap((event) => event.relatedClauseIdentifiers)]),
      evidenceRefs: [...source.evidenceRefs, ...cited.flatMap((event) => event.evidenceRefs)],
      diagnostics: [...source.diagnostics, ...(cited.length ? ['CLAIM_CITED_EVENT_REFERENCES_MERGED:' + cited.length] : [])],
    };
    for (let index = events.length - 1; index >= 0; index -= 1) if (events[index]!.eventId === source.eventId) events.splice(index, 1);
    events.push(merged);
  }
  return sourceEventIds;
}
