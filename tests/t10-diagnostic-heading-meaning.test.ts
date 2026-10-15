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
