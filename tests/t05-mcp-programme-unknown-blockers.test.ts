import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

type Stage = {
  label:string;
  activityCount:number;
  openActivityCount:number;
  readinessBlockerCount?:number|null;
  readinessBlockerTypes?:string[];
  wbsPathCount?:number|null;
  wbsPaths?:string[];
};

function renderStage(stage:Stage):string {
  const original=JSON.stringify(stage);
  const script=cmengUatHtml();
  const source=/function renderMcpProgrammeControl\(data\)\{[\s\S]*?\n\}/.exec(script)?.[0];
  assert.ok(source,'run the actual assembled browser programme-stage renderer');
  const render=runInNewContext('('+source+')',{
    fmt:(v:unknown)=>String(v),
    escapeHtml:(v:unknown)=>String(v),
    humanizeKey:(v:unknown)=>String(v),
    pmcDefined:(v:unknown)=>typeof v==='number'&&Number.isFinite(v),
    planningShortDate:(v:unknown)=>String(v),
    sourceWorkingFloat:()=> 'Not established',
    managementPanel:(_title:string,_description:string,html:string)=>html
  }) as (data:unknown)=>string;
  const output=render({managementContext:{schedule:{programmeStages:[stage]}},visualControl:{},interfaces:{rows:[]}});
  assert.equal(JSON.stringify(stage),original,'renderer must never edit source controls or stage facts');
  return output;
}

test('T05 unknown Look-Ahead blocker counts do not become a false no-blocker verdict',()=>{
  const unknown=renderStage({label:'Design',activityCount:10,openActivityCount:4,readinessBlockerCount:null,wbsPaths:['Design WBS']});
  assert.match(unknown,/Look-Ahead blocker count not established/);
  assert.doesNotMatch(unknown,/No linked Look-Ahead blocker identified/);
  const absent=renderStage({label:'Design',activityCount:10,openActivityCount:4});
  assert.match(absent,/Look-Ahead blocker count not established/);
  const zero=renderStage({label:'Design',activityCount:10,openActivityCount:4,readinessBlockerCount:0});
  assert.match(zero,/No linked Look-Ahead blocker identified/);
  assert.doesNotMatch(zero,/Look-Ahead blocker count not established/);
  const actual=renderStage({label:'Design',activityCount:10,openActivityCount:4,readinessBlockerCount:2,readinessBlockerTypes:['material','design']});
  assert.match(actual,/2 affected activities · material, design/);
});

test('T05 WBS source population never assumes missing total equals zero',()=>{
  const missing=renderStage({label:'Procurement',activityCount:10,openActivityCount:4});
  assert.match(missing,/Observed package\/WBS not established/);
  const known=renderStage({label:'Procurement',activityCount:10,openActivityCount:4,wbsPaths:['A','B','C','D','E','F'],wbsPathCount:7,readinessBlockerCount:0});
  assert.match(known,/A; B; C; D; E · 2 more/);
  const derived=renderStage({label:'Procurement',activityCount:10,openActivityCount:4,wbsPaths:['A','B','C','D','E','F'],readinessBlockerCount:0});
  assert.match(derived,/A; B; C; D; E · 1 more/);
  assert.doesNotMatch(derived,/ · 0 more/);
});
