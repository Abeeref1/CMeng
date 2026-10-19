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

test('the combined request stays in every matter its originals belonged to, with every page, reference and field',async()=>{
  const {projectActions}=await import('../packages/runtime-api/src/project-actions');
  const {projectReviewGroup}=await import('../packages/runtime-api/src/project-review-groups');
  const {runtimeProjects}=await import('../packages/runtime-api/src/project-state');
  const state=runtimeProjects.getOrCreate('T10-COMBINED-REQUEST');
  const separate=projectActions(state,{...summarizeControlIssues([resource]),issues:[...summarizeControlIssues([resource]).issues,...summarizeControlIssues([contract]).issues]});
  const combined=projectActions(state,summarizeControlIssues([resource,contract]));
  const matters=(result:typeof combined)=>[...result.actions,...result.information];
  const resourceGroup='matter:'+projectReviewGroup(resource,state).key,contractGroup='matter:'+projectReviewGroup(contract,state).key;
  assert.notEqual(resourceGroup,contractGroup,'the two originals belong to different matters');
  for(const id of [resourceGroup,contractGroup]){
    const before=matters(separate).find(a=>a.id===id)!,after=matters(combined).find(a=>a.id===id);
    assert.ok(after,id+' is not lost');
    assert.equal(after.requestCount,before.requestCount,id+' still lists the request');
    assert.ok(after.recordCount>=before.recordCount,id+' loses no source record');
    for(const page of before.affectedPages??[])assert.ok(after.affectedPages?.includes(page),id+' keeps page '+page);
    for(const ref of before.findings!.flatMap(f=>f.sourceRefs))assert.ok(after.findings!.some(f=>f.sourceRefs.includes(ref)),id+' keeps '+ref);
    for(const field of before.missingFields??[])assert.ok(after.missingFields?.some(m=>m.field===field.field),id+' keeps field '+field.field);
    assert.ok(after.findings!.every(f=>f.memberIssueIds?.length===2),'the same single request, with both identities');
  }
  const findingIds=new Set(matters(combined).filter(a=>[resourceGroup,contractGroup].includes(a.id)).flatMap(a=>a.findingIds??[]));
  assert.equal(findingIds.size,1,'one request id across both matters');
});
