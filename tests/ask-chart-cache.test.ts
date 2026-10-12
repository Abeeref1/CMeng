import test from 'node:test';
import assert from 'node:assert/strict';
import {askChartPng} from '../packages/runtime-api/src/ask-export';
import type {AnalysisChart,AnalysisTable} from '../packages/project-ask/src/types';

function source(){
  const table:AnalysisTable={id:'amounts',title:'Dated amounts',authorityId:'cash',
    columns:[{key:'name',label:'Period',type:'text',unit:null,aggregate:'none',dimension:true},{key:'value',label:'Amount',type:'number',unit:'AED',aggregate:'none',dimension:false}],
    rows:[{name:'January',value:12},{name:'February',value:-8},{name:'March',value:null}],population:3,excluded:0,state:'partial',basis:'Retained source amounts',traceId:'source-1'};
  const chart:AnalysisChart={id:'amounts-chart',title:'Project A / المشروع أ',type:'bar',tableId:table.id,category:'name',series:['value'],unit:'AED',basis:'Same retained cells',population:3,dataDate:'2035-03-31'};
  return {table,chart};
}
test('repeated chart exports preserve exact pixels and callers cannot corrupt a later export',()=>{
  const {table,chart}=source(),snapshot=JSON.stringify({table,chart});
  const original=askChartPng(chart,table),expected=Buffer.from(original);
  original.fill(0);
  const repeated=askChartPng(chart,table);assert.deepEqual(repeated,expected);
  repeated.fill(1);assert.deepEqual(askChartPng(chart,table),expected);
  assert.equal(JSON.stringify({table,chart}),snapshot);
});
test('chart exports follow changed source values, project title, Data Date and requested view',()=>{
  const {table,chart}=source(),original=askChartPng(chart,table);
  table.rows[0]!.value=91;const changed=askChartPng(chart,table);assert.notDeepEqual(changed,original);
  assert.notDeepEqual(askChartPng({...chart,title:'Project B'},table),changed);
  assert.notDeepEqual(askChartPng({...chart,dataDate:'2035-04-30'},table),changed);
  assert.notDeepEqual(askChartPng(chart,table,{type:'line'}),changed);
  assert.notDeepEqual(askChartPng(chart,table,{limit:1}),changed);
  table.rows[0]!.value=12;assert.deepEqual(askChartPng(chart,table),original);
});
