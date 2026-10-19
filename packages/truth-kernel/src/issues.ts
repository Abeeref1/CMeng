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
  /** This original's own detail text (F05: kept when requests combine). */
  detail?: string;
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
    ...(issue.field!==undefined?{field:issue.field}:{}),action:issue.action,detail:issue.detail,
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
/** One combined request while its findings are folded in (see summarizeControlIssues). */
interface OwnedMember { member: ControlIssueMember; sets?: {moduleKeys:Set<string>;evidencePaths:Set<string>;sourceRefs:Set<string>} }
interface IssueGroup {
  first: ControlIssue;
  merged: boolean;
  moduleKeys: Set<string>; sourceRefs: Set<string>; evidencePaths: Set<string>; checkIds: Set<string>;
  memberIssueIds: string[];
  members: ControlIssueMember[] | undefined;
  owned: {list: OwnedMember[]; index: Map<string, OwnedMember>} | null;
}
function ownMembers(members: ControlIssueMember[]) {
  const list=members.map(member=>({member})),index=new Map<string,OwnedMember>();
  for(const row of list)if(!index.has(row.member.id))index.set(row.member.id,row);
  return {list,index};
}
/** The combined request exactly as the one-at-a-time fold would hold it now. */
function groupIssue(group: IssueGroup): ControlIssue {
  if(!group.merged)return group.first;
  const members=group.owned
    ? group.owned.list.map(({member,sets})=>sets?{...member,moduleKeys:[...sets.moduleKeys],evidencePaths:[...sets.evidencePaths],sourceRefs:[...sets.sourceRefs]}:member)
    : group.members;
  return {...group.first,moduleKeys:[...group.moduleKeys],sourceRefs:[...group.sourceRefs],evidencePaths:[...group.evidencePaths],checkIds:[...group.checkIds],
    memberIssueIds:group.owned?group.owned.list.map(row=>row.member.id):group.memberIssueIds,...(members!==undefined?{members}:{})};
}
/** Folds one more finding into its request. Same result as
 * {...old, unions, memberIssueIds, members: mergeMembers(controlIssueMembers(old), controlIssueMembers(issue))}
 * applied one finding at a time, without copying every earlier member and
 * reference again for each finding (that copy grew with the square of the
 * number of identical findings on large registers). */
function foldIssue(group: IssueGroup, issue: ControlIssue): void {
  const right=controlIssueMembers(issue);
  if(group.owned){
    // Owned list: the fold's own copies, so they can be extended in place.
    for(const member of right){
      const same=group.owned.index.get(member.id);
      if(!same){const row={member:{...member}};group.owned.list.push(row);group.owned.index.set(member.id,row);continue;}
      const sets=same.sets??(same.sets={moduleKeys:new Set([...same.member.moduleKeys]),evidencePaths:new Set([...same.member.evidencePaths]),sourceRefs:new Set([...same.member.sourceRefs])});
      for(const value of member.moduleKeys)sets.moduleKeys.add(value);
      for(const value of member.evidencePaths)sets.evidencePaths.add(value);
      for(const value of member.sourceRefs)sets.sourceRefs.add(value);
    }
  }else if(group.members!==undefined){
    const members=mergeMembers(group.members,right);
    if(members.length>1){group.members=members;group.owned=ownMembers(members);}
    else group.memberIssueIds=members.map(m=>m.id);
  }else{
    // No members yet: the request stands for one original identity. It stays
    // one member while every new finding carries that same identity.
    const leftId=group.memberIssueIds[0]??controlIssueMemberId(groupIssue(group));
    if(right.every(member=>member.id===leftId))group.memberIssueIds=[leftId];
    else{const members=mergeMembers(controlIssueMembers(groupIssue(group)),right);group.members=members;group.owned=ownMembers(members);}
  }
  if(!group.merged){
    group.merged=true;
    group.moduleKeys=new Set([...group.first.moduleKeys]);group.sourceRefs=new Set([...group.first.sourceRefs]);
    group.evidencePaths=new Set([...group.first.evidencePaths]);group.checkIds=new Set([...group.first.checkIds]);
  }
  for(const value of issue.moduleKeys)group.moduleKeys.add(value);
  for(const value of issue.sourceRefs)group.sourceRefs.add(value);
  for(const value of issue.evidencePaths)group.evidencePaths.add(value);
  for(const value of issue.checkIds)group.checkIds.add(value);
}
export function summarizeControlIssues(issues: readonly ControlIssue[], checksRunCount: number | null = null): ControlIssueAssessment {
  const checksRun=typeof checksRunCount==='number'&&Number.isFinite(checksRunCount)&&checksRunCount>=0?checksRunCount:null;
  const grouped=new Map<string,IssueGroup>();
  for(const issue of issues){
    // One identical correction request may affect many records and pages.
    // Preserve every reference while counting the request once.
    // The same diagnostic over the same source rows may be exposed through
    // several projection paths. Display labels are not separate causes. Keep
    // different source populations separate, even if their wording is equal.
    const sourceIdentity=issue.kind==='source_conflict'&&issue.sourceFactKey&&issue.sourceRefs.length
      ? [...new Set(issue.sourceRefs)].sort() : null;
    // F05: the key is machine identity only. Detail and action are prose that
    // differ by page; they never split one problem into two requests. Each
    // original keeps its own detail and action as a member.
    const key=JSON.stringify(sourceIdentity
      ? [issue.kind,issue.code,issue.sourceFactKey,issue.owner,sourceIdentity]
      : [issue.kind,issue.code,controlIssueField(issue),issue.owner]);
    const old=grouped.get(key);
    if(!old){
      const first={...issue,memberIssueIds:issue.memberIssueIds??[controlIssueMemberId(issue)]};
      grouped.set(key,{first,merged:false,moduleKeys:new Set(),sourceRefs:new Set(),evidencePaths:new Set(),checkIds:new Set(),
        memberIssueIds:first.memberIssueIds,members:first.members,owned:null});
      continue;
    }
    // One request, the union of everything both originals carried, and both
    // original identities retained as members.
    foldIssue(old,issue);
  }
  const unique=[...grouped.values()].map(groupIssue);
  const counts = Object.fromEntries(CONTROL_ISSUE_KINDS.map(kind=>[kind,unique.filter(i=>i.kind===kind).length])) as Record<ControlIssueKind,number>;
  const affectedModuleCounts = Object.fromEntries(CONTROL_ISSUE_KINDS.map(kind=>[kind,new Set(unique.filter(i=>i.kind===kind).flatMap(i=>i.moduleKeys)).size])) as Record<ControlIssueKind,number>;
  return {schemaVersion:'1.0',primaryKind:CONTROL_ISSUE_KINDS.find(k=>counts[k]>0)??'checked',
    // SW-46: "listed checks passed" needs at least one check that ran; no check (or an unknown count) is not a pass.
    systemCheckState:counts.system_defect>0?'failed':unique.some(i=>i.kind==='verification_pending'&&i.owner==='CMeng')||!(checksRun!==null&&checksRun>0)?'unverified':'listed_checks_passed',
    checksRunCount:checksRun,
    counts,affectedModuleCounts,issues:unique,
    scope:'Categories are independent. A source conflict, missing input or difference between submitted and independent positions is not proof of a software defect. Passed checks certify only their stated scope; project performance remains separate.'};
}
