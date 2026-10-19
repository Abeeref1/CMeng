import {sourceColumnAuditEntry} from "../../truth-kernel/src/register-schema";
import type {XerParseResult} from "./types";

// Columns that XER readers (schedule and resource adapters) actually read,
// per table, while a tracking scope is open. Used for the shared R1
// unused-column report; reading values is unchanged.
const activeReads: Map<string, Set<string>>[] = [];

export function noteXerRead(table: string, name: string): void {
  for (const read of activeReads) {
    let names = read.get(table);
    if (!names) read.set(table, names = new Set());
    names.add(name);
  }
}

export function trackXerReads<T>(fn: () => T): {value: T; read: Map<string, Set<string>>} {
  const read = new Map<string, Set<string>>();
  activeReads.push(read);
  try { return {value: fn(), read}; }
  finally { activeReads.splice(activeReads.indexOf(read), 1); }
}

/** Every column of every XER table received: read into a field, or listed
 * as unused with its first non-empty value. */
export function xerSourceColumnAudit(result: XerParseResult, read: Map<string, Set<string>>) {
  return result.tableOrder.flatMap(table => {
    const rows = result.tables.get(table)?.rows ?? [];
    const headers = [...new Set((result.tables.get(table)?.fieldSets ?? []).flat())];
    return headers.map(header => ({table, ...sourceColumnAuditEntry(header, header, 'other', read.get(table)?.has(header) ?? false,
      'Read by the XER reader into the canonical schedule or resource model.',
      rows.map(row => row.data?.[header]?.trim()).find(value => !!value) ?? null)}));
  });
}
