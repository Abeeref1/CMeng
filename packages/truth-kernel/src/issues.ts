/** Shared issue vocabulary. Project performance is a separate axis. */
export const CONTROL_ISSUE_KINDS = ['system_defect', 'source_conflict', 'data_quality', 'missing_information',
  'comparison_difference', 'governance_review', 'verification_pending'] as const;
export type ControlIssueKind = typeof CONTROL_ISSUE_KINDS[number];
export interface ControlIssue {
  code: string;
  kind: ControlIssueKind;
  summary: string;
  detail: string;
  action: string;
  owner: 'CMeng' | 'Project evidence owner' | 'Project controls reviewer';
  moduleKeys: string[];
  evidencePaths: string[];
  sourceRefs: string[];
  checkIds: string[];
  /** Owning producer's semantic rule, independent of the display path. */
  sourceFactKey?: string;
}
export interface ControlIssueAssessment {
  schemaVersion: '1.0';
  primaryKind: ControlIssueKind | 'checked';
  systemCheckState: 'failed' | 'unverified' | 'listed_checks_passed';
  counts: Record<ControlIssueKind, number>;
  affectedModuleCounts: Record<ControlIssueKind, number>;
  issues: ControlIssue[];
  scope: string;
}
export function summarizeControlIssues(issues: readonly ControlIssue[]): ControlIssueAssessment {
  const grouped=new Map<string,ControlIssue>();
  for(const issue of issues){
    // One identical correction request may affect many records and pages.
    // Preserve every reference while counting the request once.
    // The same diagnostic over the same source rows may be exposed through
    // several projection paths. Display labels are not separate causes. Keep
    // different source populations separate, even if their wording is equal.
    const sourceIdentity=issue.kind==='source_conflict'&&issue.sourceFactKey&&issue.sourceRefs.length
      ? [...new Set(issue.sourceRefs)].sort() : null;
    const key=JSON.stringify(sourceIdentity
      ? [issue.kind,issue.code,issue.sourceFactKey,issue.detail,issue.action,issue.owner,sourceIdentity]
      : [issue.kind,issue.code,issue.summary,issue.detail,issue.action,issue.owner]);
    const old=grouped.get(key);grouped.set(key,old?{...old,moduleKeys:[...new Set([...old.moduleKeys,...issue.moduleKeys])],sourceRefs:[...new Set([...old.sourceRefs,...issue.sourceRefs])],evidencePaths:[...new Set([...old.evidencePaths,...issue.evidencePaths])],checkIds:[...new Set([...old.checkIds,...issue.checkIds])]}:{...issue});
  }
  const unique=[...grouped.values()];
  const counts = Object.fromEntries(CONTROL_ISSUE_KINDS.map(kind=>[kind,unique.filter(i=>i.kind===kind).length])) as Record<ControlIssueKind,number>;
  const affectedModuleCounts = Object.fromEntries(CONTROL_ISSUE_KINDS.map(kind=>[kind,new Set(unique.filter(i=>i.kind===kind).flatMap(i=>i.moduleKeys)).size])) as Record<ControlIssueKind,number>;
  return {schemaVersion:'1.0',primaryKind:CONTROL_ISSUE_KINDS.find(k=>counts[k]>0)??'checked',
    systemCheckState:counts.system_defect>0?'failed':unique.some(i=>i.kind==='verification_pending'&&i.owner==='CMeng')?'unverified':'listed_checks_passed',
    counts,affectedModuleCounts,issues:unique,
    scope:'Categories are independent. A source conflict, missing input or difference between submitted and independent positions is not proof of a software defect. Passed checks certify only their stated scope; project performance remains separate.'};
}
