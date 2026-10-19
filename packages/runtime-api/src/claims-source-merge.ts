import { dateValue, norm, numberValue } from '../../truth-kernel/src';
import type {
  CanonicalClaimRecord, CanonicalDelayEvent, CanonicalNoticeRecord, DelayEvidenceRef, SourceRecordQuery,
} from '../../delay-analysis-core/src';

/**
 * F06: one shared rule for every claims, event and notice source file of the
 * project's current basis, used by both claims readers (canonical-time-claims
 * and evidence-control-adapters).
 *
 * - Every claims/EOT register file is read. One claim id (or event id, or
 *   notice id) stated in two files is one record.
 * - Files are ordered by the report date stated inside every file when all of
 *   them state one (contentReportDate), otherwise by upload order. Nothing is
 *   ordered by file name.
 * - Field by field, the later file's value is used only where that file states
 *   a value; an empty cell never erases an earlier value.
 * - A field stated with different values in two files is listed as a query
 *   (the later value is used and the earlier one is kept in the query).
 */

/** A claims/EOT register table: it states the claim itself (claimed days, or its event and notice date). */
export function claimsRegisterHeaders(headers: readonly string[]): boolean {
  const has = (name: string) => headers.includes(name);
  return has('claim id') && !has('determination id') && (has('days claimed') || (has('event') && has('notice date')));
}

export interface ClaimsSourceFile { documentId: string; sourceFilename: string | null; uploadedAt: string }
export interface ClaimsSourceOrder {
  rank(documentId: string): number;
  basis(): SourceRecordQuery['orderBasis'];
  filename(documentId: string): string | null;
}

/** Report dates are read lazily: only when one identity is stated in two files. */
export function claimsSourceOrder(files: readonly ClaimsSourceFile[], reportDate: (documentId: string) => string | null): ClaimsSourceOrder {
  const byId = new Map<string, ClaimsSourceFile>();
  for (const file of files) if (!byId.has(file.documentId)) byId.set(file.documentId, file);
  let ranks: Map<string, number> | null = null;
  let basis: SourceRecordQuery['orderBasis'] = 'upload_order';
  const resolve = (): Map<string, number> => {
    if (ranks) return ranks;
    const list = [...byId.values()];
    const dates = new Map(list.map((file) => [file.documentId, list.length > 1 ? reportDate(file.documentId) : null] as const));
    basis = list.length > 1 && list.every((file) => dates.get(file.documentId)) ? 'report_date' : 'upload_order';
    list.sort((a, b) => (basis === 'report_date' ? dates.get(a.documentId)!.localeCompare(dates.get(b.documentId)!) : 0)
      || a.uploadedAt.localeCompare(b.uploadedAt) || a.documentId.localeCompare(b.documentId));
    ranks = new Map(list.map((file, index) => [file.documentId, index] as const));
    return ranks;
  };
  return {
    rank: (documentId) => resolve().get(documentId) ?? -1,
    basis: () => { resolve(); return basis; },
    filename: (documentId) => byId.get(documentId)?.sourceFilename ?? null,
  };
}

const valueText = (value: unknown): string =>
  Array.isArray(value) ? value.map(valueText).filter(Boolean).join('; ') : value === null || value === undefined ? '' : String(value).trim();

export function statedSourceValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Same stated meaning: same date, same number, or the same words (case and punctuation aside). */
export function sameSourceValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const set = (value: unknown) => [...new Set((Array.isArray(value) ? value : [value]).map((item) => norm(valueText(item))))].sort().join('|');
    return set(a) === set(b);
  }
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  const x = valueText(a), y = valueText(b);
  if (x === y) return true;
  const dx = dateValue(x), dy = dateValue(y);
  if (dx !== null && dy !== null) return dx === dy;
  const nx = numberValue(x), ny = numberValue(y);
  if (nx !== null && ny !== null) return nx === ny;
  return norm(x) === norm(y);
}

const fieldLabel = (field: string) => field.replace(/Iso$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().trim();

export interface StatedEntry<T> { record: T; documentId: string; sourceFilename?: string | null }
export interface StatedFieldSpec {
  fields: readonly string[];
  /** Fields that travel with the value they describe (for example its governance state). */
  follow?: Readonly<Record<string, readonly string[]>>;
  stated?: (field: string, value: unknown, record: Record<string, unknown>) => boolean;
  /** Fields whose difference is expected (for example each file's own report date). */
  noQuery?: (field: string) => boolean;
}

/** The one merge rule. Entries are in file order, earliest first. */
export function mergeStatedFields<T extends object>(input: {
  kind: SourceRecordQuery['kind']; recordId: string; entries: readonly StatedEntry<T>[]; spec: StatedFieldSpec;
  orderBasis: SourceRecordQuery['orderBasis']; queries: SourceRecordQuery[];
}): { merged: T; conflictFields: string[] } {
  const record = (entry: StatedEntry<T>) => entry.record as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...record(input.entries[0]!) };
  const conflictFields: string[] = [];
  const isStated = (field: string, entry: StatedEntry<T>) => {
    const value = record(entry)[field];
    return statedSourceValue(value) && (input.spec.stated?.(field, value, record(entry)) ?? true);
  };
  for (const field of input.spec.fields) {
    const stated = input.entries.filter((entry) => isStated(field, entry));
    if (!stated.length) continue;
    const used = stated.at(-1)!;
    merged[field] = record(used)[field];
    for (const dependent of input.spec.follow?.[field] ?? []) merged[dependent] = record(used)[dependent];
    if (input.spec.noQuery?.(field)) continue;
    const distinct: StatedEntry<T>[] = [];
    for (const entry of stated) if (!distinct.some((other) => sameSourceValue(record(other)[field], record(entry)[field]))) distinct.push(entry);
    if (distinct.length < 2) continue;
    conflictFields.push(field);
    const values = stated.map((entry) => ({ documentId: entry.documentId, sourceFilename: entry.sourceFilename ?? null, value: valueText(record(entry)[field]) }));
    const name = (entry: { documentId: string; sourceFilename: string | null }) => entry.sourceFilename ?? 'document ' + entry.documentId;
    // Source column names are shown as written (canonical); record keys in words.
    const label = /[A-Z]/.test(field) ? fieldLabel(field) : field;
    const usedValue = values.at(-1)!;
    input.queries.push({
      queryId: input.kind + ':' + input.recordId + ':' + field,
      kind: input.kind, recordId: input.recordId, field: label, values,
      usedValue: usedValue.value, usedDocumentId: usedValue.documentId, orderBasis: input.orderBasis,
      question: input.kind[0]!.toUpperCase() + input.kind.slice(1) + ' ' + input.recordId + ': ' + label + ' is ' +
        values.map((value) => (value.value || 'blank') + ' in ' + name(value)).join(' and ') + '. ' +
        'The later file (' + name(usedValue) + ', ' + (input.orderBasis === 'report_date' ? 'later report date inside the file' : 'later upload; not every file states a report date') + ') is used. Confirm the correct value.',
    });
  }
  return { merged: merged as T, conflictFields };
}

const refKey = (ref: DelayEvidenceRef) => ref.sourceType + '\u0000' + ref.sourceId + '\u0000' + (ref.locator ?? '');
export function unionRefs(...lists: ReadonlyArray<readonly DelayEvidenceRef[]>): DelayEvidenceRef[] {
  const seen = new Set<string>(), out: DelayEvidenceRef[] = [];
  for (const list of lists) for (const ref of list) { const key = refKey(ref); if (!seen.has(key)) { seen.add(key); out.push(ref); } }
  return out;
}
const unionText = (...lists: ReadonlyArray<readonly string[] | undefined>) => [...new Set(lists.flatMap((list) => list ?? []))];

export const CLAIM_RECORD_SPEC: StatedFieldSpec = {
  fields: ['title', 'state', 'submittedAt', 'assessedAt', 'claimedDays', 'claimedAmount', 'assessedDays', 'assessedAmount', 'eventIds', 'clauseIdentifiers'],
  follow: { assessedDays: ['assessedDaysState'], assessedAmount: ['assessedAmountState'] },
  stated: (field, value, record) => !(field === 'state' && value === 'unknown') && !(field === 'title' && value === record.claimId),
  // A record-level submittedAt can come from a notice date or a submission date
  // column (one file each), so its difference is not a stated conflict.
  noQuery: (field) => field === 'submittedAt',
};
export const EVENT_RECORD_SPEC: StatedFieldSpec = {
  fields: ['title', 'category', 'startIso', 'awarenessIso', 'endIso', 'responsibility', 'describedImpactDays'],
  follow: { responsibility: ['responsibilityState'], describedImpactDays: ['describedImpactState'] },
  stated: (field, value, record) => !(field === 'responsibility' && value === 'unknown') && !(field === 'category' && value === 'other') && !(field === 'title' && value === record.eventId),
};
/** A claim-cited event reference copies its claim row: a difference is already listed on the claim. */
export const CLAIM_CITED_EVENT_SPEC: StatedFieldSpec = { ...EVENT_RECORD_SPEC, noQuery: () => true };
/** True for an event from an event source (never a claim row); legacy untagged rows are claim rows here. */
export const sourceEventRecord = (event: CanonicalDelayEvent) => event.identitySource !== undefined && event.identitySource !== 'claims_register_row';
export const NOTICE_RECORD_SPEC: StatedFieldSpec = {
  fields: ['kind', 'eventId', 'claimId', 'actualIssuedAt', 'actualReceivedAt', 'plannedAt', 'subject'],
};

const documentOf = (refs: readonly DelayEvidenceRef[], fallback: string) => refs[0]?.sourceId ?? fallback;

/** Merge one identity's records (file order, earliest first) with the shared rule. */
export function mergeSameIdentity<T extends { evidenceRefs: DelayEvidenceRef[]; diagnostics: string[] }>(
  kind: SourceRecordQuery['kind'], recordId: string, entries: StatedEntry<T>[], spec: StatedFieldSpec,
  orderBasis: SourceRecordQuery['orderBasis'], queries: SourceRecordQuery[], unions: (merged: T, records: T[]) => void,
): T {
  if (entries.length === 1) return entries[0]!.record;
  const { merged, conflictFields } = mergeStatedFields({ kind, recordId, entries, spec, orderBasis, queries });
  const records = entries.map((entry) => entry.record);
  const latestFirst = [...records].reverse();
  merged.evidenceRefs = unionRefs(...latestFirst.map((record) => record.evidenceRefs));
  merged.diagnostics = unionText(...records.map((record) => record.diagnostics), ['SAME_IDENTITY_MERGED_FROM_SOURCE_FILES:' + entries.length],
    conflictFields.map((field) => 'SOURCE_FILE_VALUES_CONFLICT:' + field));
  unions(merged, records);
  return merged;
}

/**
 * Merge record lists from several files (lists in file order, earliest first)
 * by identity. Output keeps first-appearance order. Linear in the records.
 */
export function mergeRecordsByIdentity<T extends { evidenceRefs: DelayEvidenceRef[]; diagnostics: string[] }>(input: {
  kind: SourceRecordQuery['kind']; lists: ReadonlyArray<{ documentId: string; sourceFilename?: string | null; records: readonly T[] }>;
  id: (record: T) => string; spec: StatedFieldSpec; orderBasis: SourceRecordQuery['orderBasis']; queries: SourceRecordQuery[];
  unions?: (merged: T, records: T[]) => void;
}): T[] {
  const groups = new Map<string, StatedEntry<T>[]>();
  for (const list of input.lists) for (const record of list.records) {
    const key = input.id(record);
    const entry = { record, documentId: documentOf(record.evidenceRefs, list.documentId), sourceFilename: list.sourceFilename ?? null };
    const group = groups.get(key);
    if (group) group.push(entry); else groups.set(key, [entry]);
  }
  return [...groups].map(([key, entries]) => mergeSameIdentity(input.kind, key, entries, input.spec, input.orderBasis, input.queries, input.unions ?? (() => {})));
}

export const claimUnions = (merged: CanonicalClaimRecord, records: CanonicalClaimRecord[]) => {
  merged.clauseIdentifiers = unionText(...records.map((record) => record.clauseIdentifiers));
};
export const eventUnions = (merged: CanonicalDelayEvent, records: CanonicalDelayEvent[]) => {
  merged.relatedActivityIds = unionText(...records.map((record) => record.relatedActivityIds)).sort();
  merged.relatedClauseIdentifiers = unionText(...records.map((record) => record.relatedClauseIdentifiers));
  const windows = unionText(...records.map((record) => record.relatedWindowReferences));
  if (windows.length || records.some((record) => record.relatedWindowReferences)) merged.relatedWindowReferences = windows;
  const correspondence = [...records].reverse().find((record) => record.activityCorrespondence);
  if (correspondence) merged.activityCorrespondence = correspondence.activityCorrespondence!;
};
export const noticeUnions = (merged: CanonicalNoticeRecord, records: CanonicalNoticeRecord[]) => {
  merged.clauseIdentifiers = unionText(...records.map((record) => record.clauseIdentifiers));
};
