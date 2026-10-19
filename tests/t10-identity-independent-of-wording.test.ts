import test from 'node:test';
import assert from 'node:assert/strict';
import {assessModuleIssues} from '../packages/runtime-api/src/module-issues';
import {projectReviewGroup} from '../packages/runtime-api/src/project-review-groups';
import {actionFindingId} from '../packages/runtime-api/src/project-actions';
import {summarizeControlIssues,type ControlIssue} from '../packages/truth-kernel/src';
import type {ModuleRuntimeResult,ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

// T10: reader labels are display only. Issue identity, de-duplication, action
// grouping and finding ids come from machine data (kind, code, raw field and
// path, modules, source references), so rewording a label changes nothing else.
const pass={state:'pass' as const,failedCheckIds:[],checkCount:8};
function input(data:Record<string,unknown>,key='activity-analytics'):ModuleRuntimeResult{
  return {key,label:key,evidenceState:'complete',engineState:'complete',
    data:{systemEvidenceContract:{state:'verified_for_checked_metrics',checks:[]},...data},dependencies:[],reason:null} as unknown as ModuleRuntimeResult;
}
const state={evidenceDocuments:[],schedules:[{}]} as unknown as ProjectRuntimeState;

test('dataDate and dataDateIso stay two findings although both read "Data date"',()=>{
  const assessed=assessModuleIssues(input({position:{dataDate:{state:'missing'},dataDateIso:{state:'missing'}}}),pass);
  const missing=assessed.issues.filter(i=>i.code==='MISSING_SOURCE_VALUE');
  assert.equal(missing.length,2,'two different source fields are two findings');
  assert.deepEqual(missing.map(i=>i.field).sort(),['position.dataDate','position.dataDateIso']);
  assert.deepEqual(missing.map(i=>i.evidencePaths),[['data.position.dataDate'],['data.position.dataDateIso']]);
  // Same reader heading; still distinct keys, groups and ids.
  assert.equal(missing[0]!.summary,missing[1]!.summary,'the display headings are equal by design');
  assert.equal(assessed.counts.missing_information,2);
  assert.notEqual(projectReviewGroup(missing[0]!,state).key,projectReviewGroup(missing[1]!,state).key);
  assert.notEqual(actionFindingId(missing[0]!),actionFindingId(missing[1]!));
  // A project-level re-summary over the same findings keeps them apart too.
  assert.equal(summarizeControlIssues(missing).issues.length,2);
});

test('plannedQty and contractualStartIso land in the same groups as bd851ecc (raw names)',()=>{
  // Expected keys are the outputs of the original bd851ecc grouping for these raw fields.
  const groupOf=(data:Record<string,unknown>)=>{
    const issue=assessModuleIssues(input(data),pass).issues.find(i=>i.code==='MISSING_SOURCE_VALUE')!;
    return projectReviewGroup(issue,state).key;
  };
  // 'Planned quantity' must not match the quantities rule: plannedQty never did.
  assert.equal(groupOf({plannedQty:{state:'missing'}}),'source:MISSING_SOURCE_VALUE:data.plannedQty');
  // 'Contractual start date' must not be read as the contractual completion date.
  assert.equal(groupOf({contractualStartIso:{state:'missing'}}),'commercial');
  // Raw camelCase words still match as before, e.g. workingDays -> schedule calculation,
  // and a record topic is still part of the raw field.
  assert.equal(projectReviewGroup(assessModuleIssues(input({calc:{workingDays:{state:'invalid'}}}),pass).issues.find(i=>i.code==='SOURCE_QUALITY')!,state).key,'schedule-calculation');
  const topical=assessModuleIssues(input({rows:[{topic:'labour',state:'missing'}]}),pass).issues.find(i=>i.code==='MISSING_SOURCE_VALUE')!;
  assert.equal(topical.field,'data.rows[topic=labour]|labour');
  assert.equal(projectReviewGroup(topical,state).key,'resources');
});

test('changing a display label changes no issue key, action group, action id or finding id',()=>{
  const data={
    position:{dataDate:{state:'missing'},dataDateIso:{state:'missing'},plannedQty:{state:'missing'},contractualStartIso:{state:'missing'}},
    left:{performance:{costControl:{state:'conflicted',diagnostics:['COST_SOURCE_CONFLICT'],sourceRefs:['REGISTER:1']}}},
    right:{performance:{costControl:{state:'conflicted',diagnostics:['COST_SOURCE_CONFLICT'],sourceRefs:['REGISTER:1']}}},
  };
  const issues=[...assessModuleIssues(input(data,'cost-forecast'),pass).issues,...assessModuleIssues(input(data,'commercial-overview'),pass).issues]
    .filter(i=>i.owner!=='CMeng');
  const reworded=(rename:(i:ControlIssue,index:number)=>string)=>issues.map((i,index)=>({...i,summary:rename(i,index)}));
  const fingerprint=(list:ControlIssue[])=>{
    const assessed=summarizeControlIssues(list);
    return {
      counts:assessed.counts,
      keys:assessed.issues.map(i=>[i.kind,i.code,i.field,i.evidencePaths,i.moduleKeys,i.sourceRefs]),
      groups:list.map(i=>'matter:'+projectReviewGroup(i,state).key),
      findingIds:assessed.issues.map(actionFindingId),
    };
  };
  const original=fingerprint(issues);
  assert.ok(original.keys.length>=5,'several distinct findings are under test');
  // Labels that collide, labels that mention other groups' words, and unique labels.
  for(const rename of [
    ()=>'Data date',
    (i:ControlIssue)=>'Planned quantity · contractual start date · '+i.summary,
    (_:ControlIssue,index:number)=>'Finding '+index,
  ])assert.deepEqual(fingerprint(reworded(rename)),original);
  // The cross-page duplicate of the same costControl conflict is still one finding.
  assert.equal(original.counts.source_conflict,1);
});
