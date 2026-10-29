import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {projectActions,programmeActions} from '../packages/runtime-api/src/project-actions';
import {summarizeControlIssues} from '../packages/truth-kernel/src';

// M13.1 invariant: a required Project Review item is one whose answer changes a
// published figure. A single read value is pre-filled. Text never claims CMeng
// already uses something it does not use.

const contract=(amounts:number[])=>({semanticComplete:true,pdf:{pages:[]},sections:amounts.map((amount,index)=>({sectionKey:'amount-'+index,kind:'clause',text:'Contract Sum AED '+amount.toLocaleString('en-US'),startPage:index+1,diagnostics:[],
  sourceSpans:[{sourceKind:'pdf_page',sourceIndex:index+1,start:0,end:40}],status:'verified',sourceMode:'deterministic'}))}) as any;
const valueItem=(state:any)=>{const r=projectActions(state,summarizeControlIssues([],0));return [...r.actions,...r.information].find(a=>a.id==='matter:contract-value');};

test('M13.1: a single read contract value is pre-filled; two values are not guessed',()=>{
  const one=runtimeProjects.getOrCreate('M131-ONE-'+randomUUID().slice(0,6).toUpperCase());one.contract=contract([1000]);one.version++;
  assert.equal(valueItem(one)?.target.reviewChoice,'value:AED:1000','the one value is pre-filled');
  const two=runtimeProjects.getOrCreate('M131-TWO-'+randomUUID().slice(0,6).toUpperCase());two.contract=contract([1000,1200]);two.version++;
  assert.equal(valueItem(two)?.target.reviewChoice,null,'two different values: the user chooses');
});

test('M13.1: a schedule awaiting confirmation is never described as already in use',()=>{
  const state={projectId:'M131-S',schedules:[{role:'update',roleConfirmed:true,approvalReference:null,sourceFilename:'Current.xer',sourceHashSha256:'h',
    revision:{revisionId:'S1',sequence:1,label:'Current',effectiveAt:'2042-08-20',model:{dataDateIso:'2042-08-20',activities:[],relationships:[],wbs:[],calendars:[]}}}],
    activeEvidenceBasis:{'schedule:control':{activeArtifactId:'S1',activeDocumentId:'D1'}},
    evidenceDocuments:[{documentId:'D1',category:'schedule',documentType:'schedule_update',familyKey:'schedule:control',linkedArtifactId:'S1',basisState:'active',sourceHashSha256:'h',sourceFilename:'Current.xer',sourceRelativePath:'Current.xer'}]} as any;
  const items=programmeActions(state);
  assert.ok(items.length>0,'the schedule is asked for');
  for(const item of programmeActions(state)){
    if(item.category==='information')continue;
    assert.doesNotMatch(item.reason,/already using/,'not in use: '+item.reason);
  }
});
