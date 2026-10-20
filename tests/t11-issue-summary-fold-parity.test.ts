import test from 'node:test';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {summarizeControlIssues,controlIssueMemberId,controlIssueField,CONTROL_ISSUE_KINDS,type ControlIssue,type ControlIssueMember} from '../packages/truth-kernel/src/issues';

// T11: summarizeControlIssues folds findings into one request per machine
// identity without re-copying every earlier member and reference for each
// finding. This is the fold as it stood before that change, kept verbatim as
// the reference. Every result (values AND key order, so the JSON bytes) must
// be identical for any input, including inputs that already carry members.
function referenceMembers(issue: ControlIssue): ControlIssueMember[] {
  return issue.members??[{id:issue.memberIssueIds?.[0]??controlIssueMemberId(issue),summary:issue.summary,
    ...(issue.field!==undefined?{field:issue.field}:{}),action:issue.action,detail:issue.detail,
    moduleKeys:[...issue.moduleKeys],evidencePaths:[...issue.evidencePaths],sourceRefs:[...issue.sourceRefs]}];
}
function referenceMerge(left: ControlIssueMember[], right: ControlIssueMember[]): ControlIssueMember[] {
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
function referenceSummary(issues: readonly ControlIssue[], checksRunCount: number | null = null) {
  const checksRun=typeof checksRunCount==='number'&&Number.isFinite(checksRunCount)&&checksRunCount>=0?checksRunCount:null;
  const grouped=new Map<string,ControlIssue>();
  for(const issue of issues){
    const sourceIdentity=issue.kind==='source_conflict'&&issue.sourceFactKey&&issue.sourceRefs.length
      ? [...new Set(issue.sourceRefs)].sort() : null;
    const key=JSON.stringify(sourceIdentity
      ? [issue.kind,issue.code,issue.sourceFactKey,issue.owner,sourceIdentity]
      : [issue.kind,issue.code,controlIssueField(issue),issue.owner]);
    const old=grouped.get(key);
    if(!old){grouped.set(key,{...issue,memberIssueIds:issue.memberIssueIds??[controlIssueMemberId(issue)]});continue;}
    const members=referenceMerge(referenceMembers(old),referenceMembers(issue));
    grouped.set(key,{...old,moduleKeys:[...new Set([...old.moduleKeys,...issue.moduleKeys])],sourceRefs:[...new Set([...old.sourceRefs,...issue.sourceRefs])],evidencePaths:[...new Set([...old.evidencePaths,...issue.evidencePaths])],checkIds:[...new Set([...old.checkIds,...issue.checkIds])],
      memberIssueIds:members.map(m=>m.id),...(members.length>1?{members}:{})});
  }
  const unique=[...grouped.values()];
  const counts = Object.fromEntries(CONTROL_ISSUE_KINDS.map(kind=>[kind,unique.filter(i=>i.kind===kind).length]));
  const affectedModuleCounts = Object.fromEntries(CONTROL_ISSUE_KINDS.map(kind=>[kind,new Set(unique.filter(i=>i.kind===kind).flatMap(i=>i.moduleKeys)).size]));
  return {schemaVersion:'1.0',primaryKind:CONTROL_ISSUE_KINDS.find(k=>(counts as any)[k]>0)??'checked',
    systemCheckState:(counts as any).system_defect>0?'failed':unique.some(i=>i.kind==='verification_pending'&&i.owner==='CMeng')||!(checksRun!==null&&checksRun>0)?'unverified':'listed_checks_passed',
    checksRunCount:checksRun,counts,affectedModuleCounts,issues:unique,
    scope:'Each type is counted on its own. Records that disagree, a missing input or a difference between the submitted and independent positions do not by themselves mean a software fault. A passed check covers only what it checks; project performance is reported separately.'};
}

// Deterministic pseudo-random generator (no Math.random: the cases repeat exactly).
function generator(seed: number) {
  let s=seed>>>0;
  return () => {s=(s*1664525+1013904223)>>>0;return s/4294967296;};
}
function randomIssues(seed: number, count: number): ControlIssue[] {
  const r=generator(seed),pick=<T>(values: readonly T[])=>values[Math.floor(r()*values.length)]!;
  const list=(values: readonly string[], max: number)=>Array.from({length:Math.floor(r()*(max+1))},()=>pick(values));
  const kinds=['source_conflict','data_quality','missing_information','verification_pending'] as const;
  const owners=['CMeng','Project evidence owner','Project controls reviewer'] as const;
  const member=():ControlIssueMember=>({id:pick(['m1','m2','m3','m4']),summary:pick(['S1','S2']),...(r()<0.5?{field:pick(['a.b','c.d'])}:{}),
    action:pick(['A1','A2']),...(r()<0.7?{detail:pick(['D1','D2'])}:{}),moduleKeys:list(['mod-a','mod-b','mod-c'],3),evidencePaths:list(['p1','p2','p3'],3),sourceRefs:list(['r1','r2','r3','r4'],4)});
  return Array.from({length:count},()=>{
    const issue:ControlIssue={kind:pick(kinds),code:pick(['C1','C2']),summary:pick(['Summary one','Summary two']),detail:pick(['Detail x','Detail y']),
      action:pick(['Act 1','Act 2']),owner:pick(owners),moduleKeys:list(['mod-a','mod-b','mod-c'],3),evidencePaths:list(['data.rows[*]','data.items','data.x'],3),
      sourceRefs:list(['r1','r2','r3','r4','r5'],4),checkIds:list(['k1','k2'],2)};
    if(r()<0.6)issue.field=pick(['rows','items.value','x|topic']);
    if(r()<0.3)issue.sourceFactKey=pick(['f1','f2']);
    const roll=r();
    if(roll<0.08)issue.memberIssueIds=[];
    else if(roll<0.2)issue.memberIssueIds=[pick(['m1','m2','m3'])];
    const membersRoll=r();
    if(membersRoll<0.06)issue.members=[];
    else if(membersRoll<0.14)issue.members=[member()];
    else if(membersRoll<0.22)issue.members=[member(),member(),member()];
    return issue;
  });
}

test('T11 issue summary fold equals the one-at-a-time reference fold for any input (values and key order)',()=>{
  for(let seed=1;seed<=400;seed++){
    const issues=randomIssues(seed,1+seed%60),before=JSON.stringify(issues);
    const expected=referenceSummary(issues,seed%3?seed%7:null),actual=summarizeControlIssues(issues,seed%3?seed%7:null);
    assert.equal(JSON.stringify(actual),JSON.stringify(expected),'seed '+seed);
    assert.deepEqual(actual,expected,'seed '+seed);
    assert.equal(JSON.stringify(issues),before,'inputs are not changed (seed '+seed+')');
  }
});

test('T11 thousands of identical findings combine into the same request as the reference fold',()=>{
  // One register finding repeated on every row (same identity, own source row),
  // plus a second population whose rows carry different member identities.
  const same=Array.from({length:3000},(_,i)=>({kind:'missing_information' as const,code:'MISSING_SOURCE_VALUE',summary:'Claims · information missing',detail:'Row '+i,
    action:'Supply the value.',owner:'Project evidence owner' as const,moduleKeys:['delay-claims'],evidencePaths:['data.claims[*]'],sourceRefs:['evidence-document:D:row:'+(i+2)],checkIds:[],field:'data.claims'}));
  const distinct=Array.from({length:1500},(_,i)=>({...same[i]!,code:'SOURCE_QUALITY',kind:'data_quality' as const,evidencePaths:['data.claims[*]','data.rows['+(i%40)+']'],moduleKeys:['m'+(i%7)]}));
  const issues=[...same,...distinct,...same.slice(0,200)];
  const actual=summarizeControlIssues(issues),expected=referenceSummary(issues);
  assert.equal(JSON.stringify(actual),JSON.stringify(expected));
  assert.equal(actual.issues.length,2);
  assert.equal(actual.issues[0]!.sourceRefs.length,3000,'every source row is kept on the one request');
  assert.equal(actual.issues[1]!.members!.length,280,'every distinct original identity (7 module keys x 40 paths) is kept as a member');
});

test('T11 20,000 identical register findings fold in linear time',()=>{
  // Before the repair each further finding re-copied every earlier member and
  // source reference of its request: about 10^9 copies for 20,000 rows.
  const issues=Array.from({length:20_000},(_,i)=>({kind:'missing_information' as const,code:'MISSING_SOURCE_VALUE',summary:'Claims · information missing',detail:'Row '+i,
    action:'Supply the value.',owner:'Project evidence owner' as const,moduleKeys:['delay-claims'],evidencePaths:['data.claims[*]'],sourceRefs:['evidence-document:D:row:'+(i+2)],checkIds:[],field:'data.claims'}));
  const started=performance.now(),summary=summarizeControlIssues(issues),ms=performance.now()-started;
  console.log('T11 summary of 20,000 identical findings: '+ms.toFixed(0)+' ms');
  assert.equal(summary.issues.length,1);
  assert.equal(summary.issues[0]!.sourceRefs.length,20_000);
  assert.deepEqual(summary.issues[0]!.memberIssueIds,[controlIssueMemberId(issues[0]!)]);
  assert.ok(ms<3_000,'folding 20,000 identical findings took '+ms.toFixed(0)+' ms');
});
