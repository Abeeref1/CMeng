import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {attachReportingContract} from '../packages/runtime-api/src/reporting-contract';
import {certifyCrossModuleConsistency} from '../packages/runtime-api/src/certification';
import {projectDataDate,projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';

// Shared rule (M6/M13): a newly uploaded programme that is still awaiting
// adoption is analysed provisionally. Its record sets carry its own Data Date
// while the governed Data Date is not yet set. That is one date, not a
// contradiction between pages, so the cross-page check must not report a
// CMeng system failure for it.
function xer(date:string){return ['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tPROJ\t'+date,
  '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\ttask_type\ttarget_start_date\ttarget_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
  '%R\t1\t1\tA1\tWorks\tTT_Task\t2031-09-01\t2031-12-31\t8\t8\t0','%R\t2\t1\tM1\tFinish\tTT_FinMile\t2031-12-31\t2031-12-31\t0\t0\t0','%E'].join('\n');}

test('a programme awaiting adoption does not raise a cross-page system failure',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'pending-baseline-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});
  await store.ingestEvidenceFile({projectId:'PENDING-BASE',sourceFilename:'Approved_Baseline.xer',bytes:Buffer.from(xer('2031-08-31')),
    mediaType:'text/plain',uploadedAt:'2031-09-01T00:00:00Z',uploadIntent:'add_update'});
  const state=store.get('PENDING-BASE')!;
  const current=projectControlSchedule(state);
  assert.ok(current,'the uploaded programme is analysed provisionally');
  const modules=new Map<string,any>();
  for(const key of ['milestones','activity-analytics'])
    modules.set(key,attachReportingContract(state,{key,status:'available',engineState:'calculated',data:{}} as any));
  // A comparison record set built from the same programme (current against a
  // missing baseline) carries the programme's Data Date too.
  const comparison=attachReportingContract(state,{key:'variance-trends',status:'available',engineState:'calculated',
    data:{movementAnalysis:{population:{...(modules.get('milestones') as any).data.reportingContract.populations.source_records,
      populationId:'population:comparison',sourceRevisionId:current!.revision.revisionId+'|baseline:null'}}}} as any);
  modules.set('variance-trends',comparison);
  const contract=(modules.get('milestones') as any).data.reportingContract;
  assert.equal(contract.programmeRevisionId,current!.revision.revisionId);
  assert.equal(contract.programmeDataDateIso,'2031-08-31');
  assert.equal(projectDataDate(state),null,'the programme awaits adoption, so no governed Data Date');
  assert.equal(contract.dataDateIso,null);
  const gate=certifyCrossModuleConsistency({state,modules,director:null,boardReport:null,generatedAt:'2031-09-01'} as any);
  const check=gate.checks.find(c=>c.checkId==='POPULATION_DENOMINATOR_AUTHORITY_CONTRACT');
  assert.equal(check?.state,'pass',JSON.stringify(check));
});

test('a record set dated by a different programme still fails the check',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'pending-baseline-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false});
  await store.ingestEvidenceFile({projectId:'PENDING-BASE',sourceFilename:'Approved_Baseline.xer',bytes:Buffer.from(xer('2031-08-31')),
    mediaType:'text/plain',uploadedAt:'2031-09-01T00:00:00Z',uploadIntent:'add_update'});
  const state=store.get('PENDING-BASE')!;
  const result=attachReportingContract(state,{key:'milestones',status:'available',engineState:'calculated',data:{}} as any) as any;
  const contract=result.data.reportingContract;
  const name=Object.keys(contract.populations).find(k=>contract.populations[k].sourceRevisionId===contract.programmeRevisionId&&contract.populations[k].dataDateIso)!;
  assert.ok(name,'a record set from the programme exists');
  contract.populations[name]={...contract.populations[name],dataDateIso:'2031-07-31'};
  const gate=certifyCrossModuleConsistency({state,modules:new Map([['milestones',result]]),director:null,boardReport:null,generatedAt:'2031-09-01'} as any);
  assert.equal(gate.checks.find(c=>c.checkId==='POPULATION_DENOMINATOR_AUTHORITY_CONTRACT')?.state,'fail');
});
