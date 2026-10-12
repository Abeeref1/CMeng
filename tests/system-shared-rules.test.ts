import test from 'node:test';
import assert from 'node:assert/strict';
import {managementValueState,managementValue,managementNumber,managementDate} from '../packages/runtime-api/src/management-values';
import {programmeCashScenario} from '../packages/runtime-api/src/programme-cash-scenario';
import {milestonePopulation,attachMilestonePopulation} from '../packages/runtime-api/src/milestone-population';
import {pageProjectResponse,recordDetailPage} from '../packages/runtime-api/src/response-paging';
import {sectionDelayDamagesScenario} from '../packages/runtime-api/src/project-contract-sections';
import {attachLookaheadResourceLinks} from '../packages/runtime-api/src/lookahead-resource-linkage';
import {crossDomainAccountability} from '../packages/runtime-api/src/accountability-intelligence';
import {loadCertifiedDemoProject} from '../packages/runtime-api/src/demo-project';
import {pmcRoleOwner} from '../packages/runtime-api/src/action-priority';
import {parseScheduleInstant} from '../packages/schedule-cpm/src/calendar';

for(let i=0;i<10;i++)test('shared value and population rules preserve exact source evidence '+i,()=>{
 const source=0.0001*(i+1);assert.equal(managementNumber(source),'<0.01');assert.ok(source>0);
 assert.equal(managementNumber(0),'0');assert.equal(managementDate('2026-08-29T23:00:00Z'),'Aug 29, 2026');
 for(const state of ['not_in_source','records_disagree','not_calculable','withheld'] as const){
  const value={value:null,valueState:state};assert.equal(managementValueState(value),state);
  assert.doesNotMatch(managementValue(value,'days'),/days|null|undefined/);
 }
 assert.equal(managementValueState('Not a missing value'),'value','display text never decides typed state');
 assert.equal(pmcRoleOwner('payment','Not recorded'),pmcRoleOwner('payment'));
 assert.equal(pmcRoleOwner('rfi','Named source owner'),'Named source owner');
 const rows=Array.from({length:300+i},(_,j)=>({activityId:'P'+i+'-M'+j,status:j<50?'completed':'not_started',managementPriority:'high',dueState:'overdue',varianceDays:3,movementBasis:'actual_vs_baseline'}));
 const data=attachMilestonePopulation({projectionKey:'milestones',rows}),sourceRows=JSON.stringify(rows);
 const response=pageProjectResponse({key:'milestones',data},'/api/projects/P'+i+'/schedule/modules/milestones',50000) as any;
 assert.equal(response.data.milestoneFullCounts.openCount,250+i);assert.equal(response.data.milestoneFullCounts.completedLateBaselineCount,50);
 assert.equal(data.openMilestones.length,250+i);assert.equal(data.completedMilestones.length,50);
 assert.deepEqual(data.milestoneFullCounts,milestonePopulation(rows));assert.equal(JSON.stringify(rows),sourceRows);
 const last=recordDetailPage({data},'/data/openMilestones',250,25) as any;assert.equal(last.total,250+i);assert.equal(last.rows.length,i);
 const result=sectionDelayDamagesScenario({contractCompletionIso:'2026-08-29',extendedCompletionIso:null,programmeCompletionIso:'2026-09-03',rate:7000,rateBasis:'fixed_amount_per_week',capAmount:4000});
 assert.equal(result.state,'scenario');assert.equal(result.lateDays,5);assert.equal(result.uncapped,5000);assert.equal(result.capped,4000);
 assert.equal(sectionDelayDamagesScenario({contractCompletionIso:null,extendedCompletionIso:null,programmeCompletionIso:'2026-09-03',rate:7000,rateBasis:'fixed_amount_per_week',capAmount:4000}).uncapped,null);
 for(const date of ['2026-08-29','2026-08-29T08:00:00Z',null,'invalid'])assert.equal(parseScheduleInstant(date),parseScheduleInstant(date));
});
test('future cash keeps missing deductions separate and never truncates the forward curve',()=>{
 for(const position of [{},{foundation:{}},{currencies:[{currency:'SAR'}]}])assert.doesNotThrow(()=>programmeCashScenario(position as any,null));
 const position:any={foundation:{commercialTerms:{retentionPercent:{value:null},paymentPeriodDays:{value:30}}},currencies:[{currency:'SAR',currentContractValue:{value:1000},grossCertifiedAmount:{value:100},advanceBalance:{value:0}}]};
 const before=JSON.stringify(position),scenario=programmeCashScenario(position,'2026-08-31','2030-03-31');
 assert.equal(scenario.groups[0]!.remainingGross,900);assert.equal(scenario.groups[0]!.netReceipts,null);
 assert.ok(scenario.groups[0]!.missingInputs.includes('Contract retention percentage'));
 const response=pageProjectResponse({data:{programmeCashScenario:scenario}},'/api/projects/P/commercial/modules/cash-flow') as any;
 assert.equal(response.data.programmeCashScenario.groups[0].curvePoints.at(-1).dateIso,'2030-03-31');
 assert.equal(JSON.stringify(position),before);
});
test('unique resource links remain per activity without promoting capacity approval',()=>{
 const p:any={sourceResourceTrades:[{resourceId:'XER',matchedRegisterResourceId:'REGISTER',trade:'Electrician',registerLinkedByTradeName:true,activityIds:['A'],registerSourceRefs:['REGISTER:row:2'],registerMatchBasis:'Unique matching trade name'}],forwardWindowRows:[{activityId:'A',readiness:{state:'conditional',dimensions:[{key:'resource',state:'unknown',sourceRefs:[]}]}},{activityId:'B',readiness:{state:'conditional',dimensions:[{key:'resource',state:'unknown',sourceRefs:[]}]}}],readinessCoverage:[{key:'resource'}]};
 attachLookaheadResourceLinks(p);assert.equal(p.forwardWindowRows[0].resourceLinkCount,1);assert.equal(p.forwardWindowRows[0].readiness.dimensions[0].state,'unknown');assert.equal(p.readinessCoverage[0].linkedActivityCount,1);
 assert.equal(p.forwardWindowRows[1].resourceLinkCount,undefined);assert.equal(p.resourceLinkedActivityCount,1);
});
test('stable owner groups expose complete source membership when unrelated rows are added',()=>{
 const state=loadCertifiedDemoProject('GROUP-IDENTITY-PROOF'),before=crossDomainAccountability(state);
 const existing=before.ownerGroups.map(g=>({key:g.key,id:g.groupId,count:g.count}));
 const template=state.controls.rfis[0];assert.ok(template);
 state.controls.rfis.push({...template,rfiId:'FRESH-UNRELATED',owner:'Different owner',status:'open'});state.version++;
 const after=crossDomainAccountability(state);
 for(const item of existing){const group=after.ownerGroups.find(g=>g.key===item.key);assert.ok(group);assert.equal(group.groupId,item.id);assert.equal(group.count,item.count);}
 for(const group of after.ownerGroups){const result=recordDetailPage({recordActions:after.recordActions},'/recordActions',0,25,{groupKey:group.key}) as any;assert.equal(result.total,group.count);assert.ok(result.rows.every((row:any)=>group.memberActionIds.includes(row.actionId)));}
 assert.equal(crossDomainAccountability(state),after,'same canonical project version reuses one action producer');
});
