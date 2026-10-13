import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {partitionAsOf,populationContract} from '../packages/truth-kernel/src';
import {pageProjectResponse,recordDetailPage} from '../packages/runtime-api/src/response-paging';
import {runInNewContext} from './browser-context';

test('excluded dates and milestone totals cover full source populations without changing population identity',()=>{
 const rows=Array.from({length:950},(_,i)=>({id:'R'+i,date:i<130?'2031-08-01':i<350?'2032-01-01':null}));
 const p=partitionAsOf(rows,{name:'Risk register',entity:'risk',dataDateIso:'2031-08-31',dateBasis:'raised date',id:r=>r.id,date:r=>r.date}).population;
 assert.deepEqual(p.exclusionCounts,{after_data_date:220,record_date_missing:600});
 const {populationId,missingDatePolicy,denominator,exclusionCounts,...originalCanonical}=p;
 assert.equal(populationId,'population:'+createHash('sha256').update(JSON.stringify(originalCanonical)).digest('hex').slice(0,24),'computed count metadata does not change the canonical population identity');
 const changed=populationContract({...p,memberIds:[],exclusions:[{id:'NEW',reason:'record_date_invalid'}]});assert.deepEqual(changed.exclusionCounts,{record_date_invalid:1},'a copied population cannot inherit stale reason totals');
 const milestones=populationContract({name:'Milestones',entity:'milestone',sourceCount:9500,memberIds:[],exclusions:Array.from({length:9500},(_,i)=>({id:'A'+i,reason:'not_milestone'})),dataDateIso:'2031-08-31',dateBasis:'source activity type',sourceRevisionId:'R',authority:'source'});
 const full={key:'pmo-analysis',data:{projectionKey:'pmo_analysis',reportingContract:{dataDateIso:'2031-08-31',populations:{risk:p,milestones}}}},before=JSON.stringify(full);
 const page:any=pageProjectResponse(full,'/api/projects/P/management/pmo-analysis'),ctx={data:page.data,currentModuleResult:page,overview:null};
 assert.equal(page.data.reportingContract.populations.risk.exclusions.length,25);
 const scope=runInNewContext('renderRegisterScope(data,true)',ctx);assert.ok(scope.includes('<td>220</td><td>600</td>'),'counts are 220 future and 600 undated despite the first exclusion page containing only future records');
 const basis=runInNewContext('renderModuleBasis(data,true)',ctx);assert.ok(basis.includes('Milestones</td><td>0 / 9,500</td><td>9,500'),'full milestone exclusions remain visible');assert.match(basis,/Browse excluded records/);
 assert.equal((recordDetailPage(full,'/data/reportingContract/populations/milestones/exclusions',9475) as any).rows.at(-1).id,'A999','canonical exclusions retain lexicographic order and all records');
 assert.equal(JSON.stringify(full),before);
 const legacy=structuredClone(page);delete legacy.data.reportingContract.populations.risk.exclusionCounts;
 const unknown=runInNewContext('reportingExclusionCounts(data.reportingContract.populations.risk)',{data:legacy.data,currentModuleResult:legacy});assert.equal(unknown.future,null);assert.equal(unknown.undated,null,'an all-future preview cannot establish a missing-date zero');
});

test('same labels with different source date rules stay separate; actual comparable count conflicts remain unresolved',()=>{
 const base={name:'Certificate periods by Data Date',entity:'certificate',dataDateIso:'2031-08-31',sourceRevisionId:'R',authority:'source',sourceCount:0,denominator:0,memberIds:[],exclusions:[]};
 const rows=[{...base,dateBasis:'periodEnd'},{...base,dateBasis:'certificate period, not receipt date'}];
 const distinct=runInNewContext('uniqueReportingPopulations(rows)',{rows});assert.equal(distinct.length,2);assert.ok(distinct.every((r:any)=>r.sourceCount===0));assert.ok(distinct.every((r:any)=>!r.dateBasis.includes('disagree')));
 const identical=runInNewContext('uniqueReportingPopulations(rows)',{rows:[rows[0],{...rows[0]}]});assert.equal(identical.length,1);
 const conflict=runInNewContext('uniqueReportingPopulations(rows)',{rows:[rows[0],{...rows[0],sourceCount:7,denominator:3}]});assert.equal(conflict.length,1);assert.equal(conflict[0].sourceCount,null);assert.match(conflict[0].dateBasis,/disagree/);
});

test('all 136 observed WBS labels remain counted and browsable from the management preview',()=>{
 const full={key:'master-control-programme',data:{wbsControl:{observedWbsCount:136,observedWbsLabels:Array.from({length:136},(_,i)=>'WBS '+i)}}};
 const page:any=pageProjectResponse(full,'/api/projects/P/management/master-control-programme');
 const html=runInNewContext('renderObservedWbsLabels(data.wbsControl.observedWbsLabels)',{data:page.data,currentModuleResult:page});
 assert.match(html,/136 labels/);assert.match(html,/Showing 25 of 136 labels/);assert.match(html,/Browse all observed WBS labels/);
 const last:any=recordDetailPage(full,'/data/wbsControl/observedWbsLabels',125);assert.equal(last.rows.at(-1),'WBS 135');
});
