import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

const html=cmengUatHtml();
const fn=(name:string)=>{
 const start=html.indexOf('function '+name+'(');
 assert.ok(start>=0,'assembled browser function missing '+name);
 const end=html.indexOf('\n}',start);
 assert.ok(end>start);
 return html.slice(start,end+2);
};
test('T05 uncut source list uses retained server total; mapped preview never invents its length as full population',()=>{
 const c:any={currentModuleResult:null,responsePopulationRoot:null,
  responsePopulationIndex:new WeakMap(),responseRowPopulationIndex:new WeakMap()};
 const js='let responsePopulationRoot=null,responsePopulationIndex=new WeakMap(),responseRowPopulationIndex=new WeakMap();\n'
  +fn('indexResponsePopulations')+'\n'+fn('responseListPopulation')+'\n;({responseListPopulation})';
 const api=runInNewContext(js,c) as {responseListPopulation:(rows:any[],explicit?:any)=>any};
 const source=[{recordId:'A'},{recordId:'B'}];
 c.currentModuleResult={key:'quality',data:{rows:source},responsePaging:{
  tables:[{kind:'array',pointer:'/data/rows',total:320,shown:2}],source:'/api/projects/TEST/quality'}};
 const direct=api.responseListPopulation(source);
 assert.equal(direct.total,320);
 assert.equal(direct.totalEstablished,true);
 assert.equal(direct.pointer,'/data/rows');
 const preview=api.responseListPopulation(source.slice(0,1));
 assert.equal(preview.total,320,'source row identity retains full population total');
 assert.equal(preview.totalEstablished,true);
 const mapped=api.responseListPopulation(source.map(row=>({...row})));
 assert.equal(mapped.totalEstablished,false,'cloned preview is not an authoritative full population');
 const explicit=api.responseListPopulation(source.slice(0,1),{total:879,pointer:'/data/records'});
 assert.equal(explicit.totalEstablished,true);
 assert.equal(explicit.total,879);
});
test('T05 generic record and mixed-list rendering qualifies untracked totals and keeps source drill-down',()=>{
 assert.match(html,/totalEstablished===true\s*\?\s*' of '/);
 assert.match(html,/Complete source total not established for this derived list/);
 assert.match(html,/Additional source records · /);
 assert.match(html,/sourcePopulationControl\(value\)/);
 assert.doesNotMatch(html,/Additional records · '\+escapeHtml\(value\.length\)/);
});
