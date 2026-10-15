import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

test('T10 every unfamiliar diagnostic has a distinct professional heading, not a repeated fixed generic notice',()=>{
 const html=cmengUatHtml();
 const source=/function humanizeKey\(key\)\{[\s\S]*?\n\}/.exec(html)?.[0];
 assert.ok(source,'inspect the actual rendered browser function');
 const humanize=runInNewContext('('+source+')') as (key:string)=>string;
 const first=humanize('PAYMENT_CURRENCY_BASIS_CONFLICT:IPC_71');
 const second=humanize('MISSING_ASSET_ACCEPTANCE_DATE:ASSET_17');
 assert.equal(first,'Payment Currency Basis Conflict · IPC 71');
 assert.equal(second,'Missing Asset Acceptance Date · ASSET 17');
 assert.notEqual(first,second);
 assert.ok(!first.includes('_')&&!second.includes('_'),'no raw identifier labels');
 assert.notEqual(first,'Additional calculation qualification');
 assert.equal(humanize('not_established'),'Not established','authoritative label mapping remains');
 assert.equal(humanize('PARALLEL_ASSESSMENT_VALUES_DIFFER'),'Claim assessments disagree','known professional diagnostics unchanged');
 assert.equal(humanize('recordActionCount'),'Record Action Count','camel source field headings retained');
});

test('T10 single missing or nonfinite value does not create a fake observed trend',()=>{
 const html=cmengUatHtml();
 const start=html.indexOf('function renderLineChart(points,series,yMaxHint=null,options={}){');
 const stop=html.indexOf('  const dateKey=options.dateKey',start);
 assert.ok(start>=0&&stop>start,'actual browser-rendered source found');
 const partial=html.slice(start,stop)+String.fromCharCode(10)+'}';
 const chart=runInNewContext('('+partial+')',{
  escapeHtml:(s:unknown)=>String(s),planningShortDate:(s:unknown)=>String(s),
  fmt:(n:unknown)=>String(n),
 }) as (points:unknown[],series:unknown[])=>string;
 const series=[{key:'cpi',label:'CPI'}];
 for(const value of [null,undefined,Number.NaN,Number.POSITIVE_INFINITY]){
  const rendered=chart([{dateIso:'2031-05-01',cpi:value}],series);
  assert.ok(rendered.includes('No established numeric observation'),'missing evidence must be disclosed');
  assert.ok(!rendered.includes('Single observation'),'missing cannot imply measured trend');
 }
 const zero=chart([{dateIso:'2031-05-01',cpi:0}],series);
 assert.ok(zero.includes('Single observation')&&zero.includes('0'),'genuine zero still displays');
});
