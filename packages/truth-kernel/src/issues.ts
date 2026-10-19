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
  /** Raw machine name of the field the finding concerns: the last two raw path
   * segments joined by '.', plus '|'+topic when the record names one
   * (e.g. 'position.dataDateIso'). Identity only; never a reader label. */
  field?: string;
  /** Machine ids of every underlying finding this request stands for; one id
   * when nothing was combined. De-duplication never drops an identity. */
  memberIssueIds?: string[];
  /** Present when genuinely duplicate findings were combined into one request:
   * each original finding with its own heading, field, pages, paths, source
   * references and action, so nothing of either original is lost. */
  members?: ControlIssueMember[];
}
/** One original finding inside a combined request. */
export interface ControlIssueMember {
  id: string;
  summary: string;
  field?: string;
  action: string;
  moduleKeys: string[];
  evidencePaths: string[];
  sourceRefs: string[];
}
/** Stable machine identity of the field a finding concerns. Keys, groups,
 * de-duplication and hashes use this, never the display summary: rewording a
 * label must not merge, split or move a finding. Findings without a walked
 * field are identified by their code and raw evidence path. */
export function controlIssueField(issue: Pick<ControlIssue,'code'|'evidencePaths'|'field'>): string {
  return issue.field ?? issue.code+':'+(issue.evidencePaths[0]??'');
}
/** Machine identity of one original finding: kind, code, raw field, modules
 * and raw evidence paths. Never display text. */
export function controlIssueMemberId(issue: Pick<ControlIssue,'kind'|'code'|'evidencePaths'|'field'|'moduleKeys'>): string {
  return [issue.kind,issue.code,controlIssueField(issue),[...issue.moduleKeys].sort().join('+'),[...issue.evidencePaths].sort().join('|')].join(':');
}
function controlIssueMembers(issue: ControlIssue): ControlIssueMember[] {
  return issue.members??[{id:issue.memberIssueIds?.[0]??controlIssueMemberId(issue),summary:issue.summary,
    ...(issue.field!==undefined?{field:issue.field}:{}),action:issue.action,
    moduleKeys:[...issue.moduleKeys],evidencePaths:[...issue.evidencePaths],sourceRefs:[...issue.sourceRefs]}];
}
function mergeMembers(left: ControlIssueMember[], right: ControlIssueMember[]): ControlIssueMember[] {
  const out=left.map(m=>({...m}));
  for(const member of right){
    const same=out.find(m=>m.id===member.id);
    if(!same){out.push({...member});continue;}
    same.moduleKeys=[...new Set([...same.moduleKeys,...member.moduleKeys])];
    same.evidencePaths=[...new Set([...same.evidencePaths,...member.evidencePaths])];
    same.sourceRefs=[...new Set([...same.sourceRefs,...member.sourceRefs])];
  }
  return out;
}
export interface ControlIssueAssessment {
  schemaVersion: '1.0';
  primaryKind: ControlIssueKind | 'checked';
  systemCheckState: 'failed' | 'unverified' | 'listed_checks_passed';
  /** SW-46: number of listed calculation checks that ran; null when not established. */
  checksRunCount?: number | null;
  counts: Record<ControlIssueKind, number>;
  affectedModuleCounts: Record<ControlIssueKind, number>;
  issues: ControlIssue[];
  scope: string;
}
/** SW-46: total of known check-run counts; null when none of them is established. */
export function totalChecksRun(values: ReadonlyArray<number | null | undefined>): number | null {
  const known=values.filter((v):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0);
  return known.length?known.reduce((n,v)=>n+v,0):null;
}
export function summarizeControlIssues(issues: readonly ControlIssue[], checksRunCount: number | null = null): ControlIssueAssessment {
  const checksRun=typeof checksRunCount==='number'&&Number.isFinite(checksRunCount)&&checksRunCount>=0?checksRunCount:null;
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
      : [issue.kind,issue.code,controlIssueField(issue),issue.detail,issue.action,issue.owner]);
    const old=grouped.get(key);
    if(!old){grouped.set(key,{...issue,memberIssueIds:issue.memberIssueIds??[controlIssueMemberId(issue)]});continue;}
    // One request, the union of everything both originals carried, and both
    // original identities retained as members.
    const members=mergeMembers(controlIssueMembers(old),controlIssueMembers(issue));
    grouped.set(key,{...old,moduleKeys:[...new Set([...old.moduleKeys,...issue.moduleKeys])],sourceRefs:[...new Set([...old.sourceRefs,...issue.sourceRefs])],evidencePaths:[...new Set([...old.evidencePaths,...issue.evidencePaths])],checkIds:[...new Set([...old.checkIds,...issue.checkIds])],
      memberIssueIds:members.map(m=>m.id),...(members.length>1?{members}:{})});
  }
  const unique=[...grouped.values()];
  const counts = Object.fromEntries(CONTROL_ISSUE_KINDS.map(kind=>[kind,unique.filter(i=>i.kind===kind).length])) as Record<ControlIssueKind,number>;
  const affectedModuleCounts = Object.fromEntries(CONTROL_ISSUE_KINDS.map(kind=>[kind,new Set(unique.filter(i=>i.kind===kind).flatMap(i=>i.moduleKeys)).size])) as Record<ControlIssueKind,number>;
  return {schemaVersion:'1.0',primaryKind:CONTROL_ISSUE_KINDS.find(k=>counts[k]>0)??'checked',
    // SW-46: "listed checks passed" needs at least one check that ran; no check (or an unknown count) is not a pass.
    systemCheckState:counts.system_defect>0?'failed':unique.some(i=>i.kind==='verification_pending'&&i.owner==='CMeng')||!(checksRun!==null&&checksRun>0)?'unverified':'listed_checks_passed',
    checksRunCount:checksRun,
    counts,affectedModuleCounts,issues:unique,
    scope:'Categories are independent. A source conflict, missing input or difference between submitted and independent positions is not proof of a software defect. Passed checks certify only their stated scope; project performance remains separate.'};
}
