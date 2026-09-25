import { csv, canonicalHeader, sourceTables } from '../../truth-kernel/src';
import type { applyEvidenceBasis } from './evidence-control';
import type { ProjectRuntimeState } from './project-state-types';
export function typedEvidenceRole(documentType: string, headers: readonly string[]): string | null {
  const keys = new Set(headers.map(h=>canonicalHeader(h))); const has = (...fields: string[]) => fields.every(f => keys.has(canonicalHeader(f)));
  if (documentType === 'resource_register') {
    if (has('resource id', 'available capacity', 'planned demand') && (has('week start') || has('period start'))) return 'weekly_capacity';
    if (has('resource id', 'week start', 'actual approved usage', 'source status')) return 'approved_usage';
    if (has('assignment id', 'activity id', 'week start', 'planned quantity')) return 'assignment_timephase';
    if (has('resource id', 'utilization applicable', 'class', 'unit')) return 'resource_master';
    if (has('resource id', 'month', 'planned utilization %')) return 'monthly_utilization';
    if (has('metric', 'value', 'source')) return 'utilization_headlines';
  }
  if (documentType === 'delay_eot_claims_register') {
    if (has('claim id', 'event', 'notice date')) return 'claim_events';
    if (has('determination id', 'claim id', 'awarded eot days')) return 'engineer_determinations';
    if (has('claim id', 'net assessed impact days')) return 'event_impacts';
    if (has('claim id', 'assessed days')) return 'entitlement_assessments';
  }
  return null;
}
export function typedEvidenceRoleFromText(documentType: string, text: string): string | null {
  try { return typedEvidenceRole(documentType, csv(text.split(/\r?\n/, 1)[0] ?? '')[0] ?? []); } catch { return null; }
}
/** Replay original upload intent only for legacy cross-role family collisions. Never
 * revive superseded/historical records or replace source bytes. The diagnostic is
 * retained on each affected document; same-role revisions remain governed as before.
 */
export function migrateTypedEvidenceFamilies(state: ProjectRuntimeState, applyBasis: typeof applyEvidenceBasis): boolean {
  const diagnostics: string[] = [];
  const tables = sourceTables(state.evidenceDocuments, diagnostics);
  const changes = tables.flatMap(t => {
    const d = state.evidenceDocuments.find(d => d.documentId === t.document.documentId)!;
    const role = typedEvidenceRole(d.documentType, t.headers);
    const legacy = d.category + ':' + d.documentType;
    return role && d.familyKey === legacy && !d.supersededByDocumentId &&
      ['active', 'candidate', 'additive'].includes(d.basisState) ? [{d, key: legacy + ':' + role, oldKey: legacy, oldState: d.basisState}] : [];
  }).sort((a,b) => a.d.uploadedAt.localeCompare(b.d.uploadedAt) || a.d.documentId.localeCompare(b.d.documentId));
  for (const c of changes) { c.d.familyKey = c.key; c.d.logicalDocumentKey = c.key; }
  for (const c of changes) {
    const effect = applyBasis(state, c.d, c.d.uploadIntent);
    c.d.diagnostics.push('SOURCE_ROLE_FAMILY_MIGRATION_V1:' + c.oldKey + '->' + c.key + ':' + c.oldState + '->' + effect.basisState);
  }
  for (const key of new Set(changes.map(c => c.oldKey))) {
    if (!state.evidenceDocuments.some(d => d.familyKey === key)) delete state.activeEvidenceBasis[key];
  }
  return changes.length > 0;
}
