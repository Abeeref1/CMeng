import { registerColumnKind, registerDate } from '../../truth-kernel/src';
import type { CanonicalDelayEvent, CanonicalNoticeRecord, DelayEvidenceRef, SourceRecordQuery } from '../../delay-analysis-core/src';
import { norm } from '../../truth-kernel/src';
import { EVENT_RECORD_SPEC, claimsRegisterHeaders, eventUnions, mergeSameIdentity, type ClaimsSourceOrder } from './claims-source-merge';

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
  documentType?: string | null | undefined;
  headers: readonly string[];
  rawHeaders?: readonly string[] | undefined;
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

/** File order for the shared merge rule (claims-source-merge): later files win where they state a value. */
export interface SourceMergeOptions {
  order?: ClaimsSourceOrder | undefined;
  queries?: SourceRecordQuery[];
}

/**
 * Merge source events into a population of claim-cited references. A claim
 * reference with the same event id keeps its links on the source event and is
 * removed as a separate row; the event's dates come only from the source.
 * F06: one event id stated in two source files is one event (the later file's
 * values win field by field where it states them; differences are listed as
 * queries). A repeat inside one file stays a reported duplicate (first row kept).
 * Linear: events and source rows are grouped once by id.
 */
export function mergeSourceEvents(events: CanonicalDelayEvent[], sourceEvents: readonly CanonicalDelayEvent[], diagnostics: string[], options: SourceMergeOptions = {}): Set<string> {
  const documentOf = (event: CanonicalDelayEvent) => event.evidenceRefs?.[0]?.sourceId ?? '';
  const existingById = new Map<string, CanonicalDelayEvent[]>();
  for (const event of events) {
    const group = existingById.get(event.eventId);
    if (group) group.push(event); else existingById.set(event.eventId, [event]);
  }
  const sourcesById = new Map<string, CanonicalDelayEvent[]>();
  for (const source of sourceEvents) {
    const group = sourcesById.get(source.eventId);
    if (!group) { sourcesById.set(source.eventId, [source]); continue; }
    if (group.some((other) => documentOf(other) === documentOf(source))) { diagnostics.push('DUPLICATE_EVENT_ID_IN_EVENT_SOURCE:' + source.eventId); continue; }
    group.push(source);
  }
  const merged: CanonicalDelayEvent[] = [];
  for (const [eventId, rows] of sourcesById) {
    const existing = existingById.get(eventId) ?? [];
    const cited = existing.filter((event) => event.identitySource === 'claims_register_row');
    // A source event already in the population (another file) is the same event.
    const earlier = existing.filter((event) => (event.identitySource === 'event_register' || event.identitySource === 'notice') && !rows.some((row) => documentOf(row) === documentOf(event)));
    const all = [...earlier, ...rows];
    const basis = all.length > 1 && options.order ? options.order.sort(all, documentOf) : 'upload_order';
    const source = all.length === 1 ? all[0]! : mergeSameIdentity('event', eventId,
      all.map((record) => ({ record, documentId: documentOf(record), sourceFilename: options.order?.filename(documentOf(record)) ?? null })),
      EVENT_RECORD_SPEC, basis, options.queries ?? [], eventUnions);
    const withCorrespondence = cited.find((event) => event.activityCorrespondence);
    merged.push({
      ...source,
      title: source.title !== source.eventId ? source.title : cited[0]?.title ?? source.title,
      responsibility: source.responsibility === 'unknown' && cited[0] ? cited[0].responsibility : source.responsibility,
      responsibilityState: source.responsibility !== 'unknown' ? source.responsibilityState : cited[0]?.responsibilityState ?? source.responsibilityState,
      // Links already merged onto a source event (an earlier combination) are kept.
      describedImpactDays: cited[0]?.describedImpactDays ?? source.describedImpactDays ?? null, describedImpactState: cited[0]?.describedImpactState ?? source.describedImpactState ?? 'missing',
      relatedActivityIds: uniq([...source.relatedActivityIds, ...cited.flatMap((event) => event.relatedActivityIds)]).sort(),
      ...(withCorrespondence ? { activityCorrespondence: withCorrespondence.activityCorrespondence } : {}),
      relatedWindowReferences: uniq([...(source.relatedWindowReferences ?? []), ...cited.flatMap((event) => event.relatedWindowReferences ?? [])]),
      relatedClauseIdentifiers: uniq([...source.relatedClauseIdentifiers, ...cited.flatMap((event) => event.relatedClauseIdentifiers)]),
      evidenceRefs: [...source.evidenceRefs, ...cited.flatMap((event) => event.evidenceRefs)],
      diagnostics: [...source.diagnostics, ...(cited.length ? ['CLAIM_CITED_EVENT_REFERENCES_MERGED:' + cited.length] : [])],
    });
  }
  const kept = events.filter((event) => !sourcesById.has(event.eventId));
  events.length = 0;
  // A loop, not a spread: a large register must not exceed the argument limit.
  for (const event of kept) events.push(event);
  for (const event of merged) events.push(event);
  return new Set(sourcesById.keys());
}

/**
 * F06: a notice register (or a notice document read as a table). It names
 * itself: a notice identity or notice date column, or a notice document type.
 * A claims register (claim id with claimed days, or with its event and notice
 * date) gives claim notices through the claims reader and is never read here;
 * nor is a determination register or a table with claim quantities or amounts.
 */
export interface NoticeTableColumns {
  noticeId: number; date: number; eventId: number; eventTitle: number; subject: number; claimId: number; type: number; clause: number;
}
const NOTICE_ID_HEADERS = ['notice id', 'notice ref', 'notice reference', 'notice no', 'notice number', 'notice letter ref'];
export function detectNoticeTable(input: { documentType?: string | null | undefined; headers: readonly string[] }): NoticeTableColumns | null {
  const { headers } = input;
  if (claimsRegisterHeaders(headers) || headers.includes('determination id')) return null;
  if (headers.some((header) => CLAIM_ONLY_HEADERS.includes(header))) return null;
  const noticeId = find(headers, NOTICE_ID_HEADERS);
  const noticeDocument = /(?:^|_)(?:claim_|eot_)?notice$/.test(input.documentType ?? '');
  if (noticeId < 0 && !headers.includes('notice date') && !noticeDocument) return null;
  // A claim list with notice dates but no notice identity stays a claims list.
  if (noticeId < 0 && headers.includes('claim id')) return null;
  const date = find(headers, ['notice date', 'issued date', 'date issued', 'letter date', 'date']);
  if (date < 0) return null;
  return {
    noticeId, date,
    eventId: find(headers, [...EVENT_ID_HEADERS, 'related event id']),
    eventTitle: find(headers, ['event title', 'event']),
    subject: find(headers, ['subject', 'title', 'description']),
    claimId: find(headers, ['claim id']),
    type: find(headers, ['notice type', 'type']),
    clause: find(headers, ['clause', 'clause reference']),
  };
}

const noticeKind = (type: string): CanonicalNoticeRecord['kind'] =>
  /early\s*warning/i.test(type) ? 'early_warning' : /\beot\b|extension of time/i.test(type) ? 'eot_notice'
    : /determination/i.test(type) ? 'determination' : /response|reply/i.test(type) ? 'response' : /claim/i.test(type) ? 'claim_notice' : 'notice';

/** One notice record per notice row, labelled with its source. Linking to events is done once by linkStatedNotices. */
export function noticesFromNoticeTable(columns: NoticeTableColumns, rows: readonly (readonly string[])[],
  ref: (rowIndex: number) => { documentId: string; sourceFilename: string | null; locator: string | null },
  kind: 'notice_register' | 'notice_document' = 'notice_register'): CanonicalNoticeRecord[] {
  const notices: CanonicalNoticeRecord[] = [];
  rows.forEach((row, rowIndex) => {
    const at = (index: number) => (index >= 0 ? (row[index] ?? '').trim() : '');
    const reference = at(columns.noticeId), dateText = at(columns.date), statedEventId = at(columns.eventId) || null;
    const statedEventTitle = at(columns.eventTitle) || null, subject = at(columns.subject) || statedEventTitle;
    if (!reference && !dateText && !statedEventId && !statedEventTitle && !subject) return;
    const source = ref(rowIndex), clause = at(columns.clause);
    notices.push({
      noticeId: reference || source.documentId + ':' + (source.locator ?? 'row:' + (rowIndex + 1)),
      kind: noticeKind(at(columns.type)), eventId: null, claimId: at(columns.claimId) || null,
      actualIssuedAt: registerDate(dateText), actualReceivedAt: null, plannedAt: null, subject: subject || null,
      clauseIdentifiers: clause ? [clause] : [],
      evidenceRefs: [{ sourceType: 'notice', sourceId: source.documentId, locator: source.locator }],
      diagnostics: [kind === 'notice_register' ? 'NOTICE_FROM_NOTICE_REGISTER' : 'NOTICE_FROM_NOTICE_DOCUMENT'],
      noticeSource: { kind, documentId: source.documentId, sourceFilename: source.sourceFilename, locator: source.locator,
        statedEventId, statedEventTitle, linkBasis: 'not_linked', unlinkedReason: null },
    });
  });
  return notices;
}

/**
 * The one link rule for notices read from notice sources: a notice that states
 * its date and the event it notifies (event id in the population, or, when no
 * event id is stated, an exact event title that names one event) is linked to
 * that event. Anything else stays unlinked, with the reason, and listed.
 * Linear: events are indexed once by id and by title.
 */
export function linkStatedNotices(notices: readonly CanonicalNoticeRecord[], events: readonly CanonicalDelayEvent[]): CanonicalNoticeRecord[] {
  const eventIds = new Set(events.map((event) => event.eventId));
  const byTitle = new Map<string, string | null>();
  for (const event of events) {
    const key = event.title && event.title !== event.eventId ? norm(event.title) : '';
    if (!key) continue;
    const previous = byTitle.get(key);
    byTitle.set(key, previous === undefined || previous === event.eventId ? event.eventId : null);
  }
  return notices.map((notice) => {
    const source = notice.noticeSource;
    if (!source) return notice;
    if ((source.statedEventIds?.length ?? 0) > 1) return { ...notice, eventId: null,
      noticeSource: { ...source, linkBasis: 'not_linked' as const, unlinkedReason: 'The notice names more than one event (' + source.statedEventIds!.join(', ') + ').' } };
    const titleMatch = source.statedEventId ? null
      : [source.statedEventTitle, notice.subject].map((text) => (text ? byTitle.get(norm(text)) ?? null : null)).find(Boolean) ?? null;
    const target = source.statedEventId ? (eventIds.has(source.statedEventId) ? source.statedEventId : null) : titleMatch;
    const reason = !notice.actualIssuedAt ? 'The notice does not state its date.'
      : target ? null
        : source.statedEventId ? 'The event it names (' + source.statedEventId + ') is not in the event population.'
          : 'The notice names no event (no event id and no exact event title).';
    return { ...notice, eventId: reason ? null : target,
      noticeSource: { ...source, linkBasis: reason ? 'not_linked' : source.statedEventId ? 'event_id' : 'exact_event_title', unlinkedReason: reason } };
  });
}

/** Notices from notice sources that are not linked to an event (listed on every claims page). */
export const unlinkedSourceNotices = (notices: readonly CanonicalNoticeRecord[]) =>
  notices.filter((notice) => notice.noticeSource && notice.noticeSource.linkBasis === 'not_linked');

/**
 * F06: a notice document (one letter whose text is read) that states its own
 * reference, its date and the event it notifies. It is a notice when its subject
 * names a notice (or its document type is a notice). A document holding several
 * letters (more than one reference or date heading) is not read as one notice.
 * The event is an event id of the population named in the text, or (when it
 * names none) an exact event title as its subject. Linear in the text length.
 */
export function noticeFromLetterText(text: string, documentType: string, eventIds: ReadonlySet<string>,
  ref: { documentId: string; sourceFilename: string | null }): { notice: CanonicalNoticeRecord | null; diagnostic: string | null } {
  const heading = (label: string) => [...new Set([...text.matchAll(new RegExp('^[ \\t]*' + label + '[ \\t]*:[ \\t]*(.+?)[ \\t]*$', 'gim'))].map((match) => match[1]!.trim()))];
  const subject = heading('Subject')[0] ?? null;
  const noticeType = /(?:^|_)(?:claim_|eot_)?notice$/.test(documentType);
  if (!noticeType && !(subject && /\bnotice\b/i.test(subject))) return { notice: null, diagnostic: null };
  const references = heading('(?:Our\\s+)?Ref(?:erence)?(?:\\s+No\\.?)?'), dates = heading('Date');
  if (references.length > 1 || dates.length > 1) return { notice: null, diagnostic: 'NOTICE_DOCUMENT_NOT_A_SINGLE_LETTER:' + ref.documentId };
  const reference = references[0] ?? '';
  const named = new Set<string>();
  for (const token of text.match(/[\p{L}\p{N}][\p{L}\p{N}_.:/-]*/gu) ?? []) {
    const id = token.replace(/[.:/-]+$/, '');
    if (id !== reference && eventIds.has(id)) named.add(id);
  }
  const ids = [...named];
  return { diagnostic: null, notice: {
    noticeId: reference || ref.documentId, kind: 'notice', eventId: null, claimId: null,
    actualIssuedAt: dates[0] ? registerDate(dates[0]) : null, actualReceivedAt: null, plannedAt: null, subject,
    clauseIdentifiers: [], evidenceRefs: [{ sourceType: 'notice', sourceId: ref.documentId, locator: 'document' }],
    diagnostics: ['NOTICE_FROM_NOTICE_DOCUMENT'],
    noticeSource: { kind: 'notice_document', documentId: ref.documentId, sourceFilename: ref.sourceFilename, locator: 'document',
      statedEventId: ids.length === 1 ? ids[0]! : null, ...(ids.length > 1 ? { statedEventIds: ids } : {}),
      statedEventTitle: ids.length ? null : subject, linkBasis: 'not_linked', unlinkedReason: null },
  } };
}
