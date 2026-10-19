import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeControlIssues,controlIssueMemberId,type ControlIssue} from '../packages/truth-kernel/src';

// T10 round 3: combining genuinely duplicate requests keeps ONE request but
// never loses a source reference, affected field, module, page, path or
// corrective action, and both original identities stay on the request.
// Shape taken from the real case: the same comparison metric requested by two
// pages under two different headings.
const original=(moduleKey:string,summary:string,sourceRefs:string[]):ControlIssue=>({
  kind:'missing_information',code:'INDEPENDENT_COMPARISON_INPUT',summary,
  detail:'A periodised headcount plan, confirmed hours per person and a reconciled remaining-hours basis are needed.',
  action:'Supply the periodised headcount plan for this comparison.',owner:'Project evidence owner',
  moduleKeys:[moduleKey],evidencePaths:['challenge.items.manpower_average'],sourceRefs,checkIds:[]});
const resource=original('resource-utilization','Average manpower required · specific evidence needed',['schedule-revision:REV-3','resource-register:row:4']);
const contract=original('challenge-contract','Average manpower requirement / scenario · specific evidence needed',['delivery-challenge']);

test('one combined request holds every reference, module, path, field, action and identity of both originals',()=>{
  const assessed=summarizeControlIssues([resource,contract]);
  assert.equal(assessed.issues.length,1,'a genuine duplicate is one request');
  assert.equal(assessed.counts.missing_information,1,'distinct problems stay de-duplicated');
  const merged=assessed.issues[0]!;
  for(const issue of [resource,contract]){
    for(const ref of issue.sourceRefs)assert.ok(merged.sourceRefs.includes(ref),'source reference '+ref+' kept');
    for(const key of issue.moduleKeys)assert.ok(merged.moduleKeys.includes(key),'page '+key+' kept');
    for(const path of issue.evidencePaths)assert.ok(merged.evidencePaths.includes(path));
    const member=merged.members?.find(m=>m.id===controlIssueMemberId(issue));
    assert.ok(member,'original identity kept as a member');
    assert.equal(member.summary,issue.summary,'affected field heading kept');
    assert.equal(member.action,issue.action,'corrective action kept');
    assert.deepEqual(member.moduleKeys,issue.moduleKeys);assert.deepEqual(member.sourceRefs,issue.sourceRefs);assert.deepEqual(member.evidencePaths,issue.evidencePaths);
  }
  assert.deepEqual(merged.memberIssueIds,[controlIssueMemberId(resource),controlIssueMemberId(contract)]);
  // The project-level re-summary over module results keeps every member.
  const again=summarizeControlIssues([...assessed.issues,{...resource,moduleKeys:['resource-utilization']}]).issues[0]!;
  assert.deepEqual(again.memberIssueIds,merged.memberIssueIds);
  assert.deepEqual(again.members?.map(m=>m.sourceRefs),merged.members?.map(m=>m.sourceRefs));
  // A finding that is not combined still carries its own identity.
  const single=summarizeControlIssues([resource]).issues[0]!;
  assert.deepEqual(single.memberIssueIds,[controlIssueMemberId(resource)]);assert.equal(single.members,undefined);
});

test('a combined request is counted once, in one matter, and that matter holds every page, reference and field of both originals',async()=>{
  const {projectActions}=await import('../packages/runtime-api/src/project-actions');
  const {projectReviewGroup}=await import('../packages/runtime-api/src/project-review-groups');
  const {runtimeProjects}=await import('../packages/runtime-api/src/project-state');
  const state=runtimeProjects.getOrCreate('T10-COMBINED-REQUEST');
  const assessed=summarizeControlIssues([resource,contract]);
  const combined=projectActions(state,assessed);
  const matters=[...combined.actions,...combined.information].filter(a=>(a.findings??[]).length>0);
  const holding=matters.filter(a=>a.findings!.some(f=>f.code==='INDEPENDENT_COMPARISON_INPUT'));
  // requestCount counts distinct problems: one problem, one request, one matter.
  assert.equal(holding.length,1,'the distinct problem is listed in exactly one matter');
  const home=holding[0]!;
  assert.equal(home.id,'matter:'+projectReviewGroup(assessed.issues[0]!,state).key,'its matter is chosen from the combined request');
  assert.equal(home.requestCount,1);
  assert.equal(matters.reduce((n,a)=>n+(a.requestCount??0),0),assessed.counts.missing_information,'request totals equal distinct problems');
  // Nothing of either original is lost.
  for(const issue of [resource,contract]){
    for(const page of issue.moduleKeys)assert.ok(home.affectedPages?.includes(page),'page '+page+' kept');
    for(const ref of issue.sourceRefs)assert.ok(home.findings![0]!.sourceRefs.includes(ref),'source reference '+ref+' kept');
    assert.ok(home.missingFields?.some(m=>m.field===issue.summary),'affected field '+issue.summary+' kept');
    assert.ok(home.findings![0]!.members?.some(m=>m.id===controlIssueMemberId(issue)&&m.action===issue.action),'original and its action kept');
  }
  assert.equal(home.recordCount,new Set([...resource.sourceRefs,...contract.sourceRefs]).size,'every source record of both originals is counted once');
  assert.equal(home.findingIds?.length,1);
});
