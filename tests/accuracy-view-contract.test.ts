import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';

const script = cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
function ledgerHtml(row: Record<string, unknown>): string {
  const start = script!.indexOf('function renderCommercialLedgerVisual(');
  const end = script!.indexOf('\nfunction renderCommercialVisual(', start);
  assert.ok(start >= 0 && end > start);
  return runInNewContext(script!.slice(start,end) + '\nrenderCommercialLedgerVisual(data)', {
    data: {moduleKey:'commercial-payment-register',rows:[row],dataDateIso:'2026-08-31',summary:{effectiveRecordCount:1}},
    projectionFor:(data:unknown)=>data,
    escapeHtml:(value:unknown)=>String(value??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]!)),
    planningShortDate:(date:unknown)=>date??'Not confirmed',
    humanizeKey:(value:unknown)=>String(value??''),
    planningKpis:(rows:unknown[][])=>JSON.stringify(rows),
  }) as string;
}
function sourceRow(outstanding: number|null, calculated: number|null, state: string): Record<string,unknown> {
  const m=(value:number|null)=>({value,currency:'AED',receipts:[]});
  return {paymentId:'IPC1',periodEnd:'2026-08-31',sourceStatus:'Paid',
    paymentDate:'2026-08-31',paymentReference:'R1',reconciliation:'matched',diagnostics:[],
    calculatedOutstandingAmount:{...m(calculated),state},
    amounts:{applicationAmount:m(null),engineerAssessedAmount:m(null),employerCertifiedAmount:m(null),
      grossWork:m(1000),variations:m(100),retentionDeduction:m(50),advanceRecovery:m(20),otherDeduction:m(10),taxAmount:m(null),
      netCertifiedAmount:m(1020),paidAmount:m(200),outstandingAmount:m(outstanding)}};
}
test('payment view keeps reported and calculated balances visible without doing its own arithmetic',()=>{
  const html=ledgerHtml(sourceRow(900,820,'conflicted'));
  assert.match(html,/Cash allocation and balance reconciliation/);
  assert.match(html,/Reported outstanding/);assert.match(html,/Calculated outstanding/);
  assert.match(html,/<b>900<\/b>/);assert.match(html,/<b>820<\/b>/);assert.match(html,/conflicted/);
  assert.match(html,/Recorded paid amounts/);assert.doesNotMatch(html,/four reported components|Payment receipts/);
});
test('payment view preserves a missing calculated balance rather than deriving it from Paid status',()=>{
  const html=ledgerHtml(sourceRow(null,null,'missing'));
  assert.match(html,/Not confirmed/);assert.doesNotMatch(html,/<b>820<\/b>/);
  assert.match(html,/source figures, not verified receipt count/);
});
test('payment evidence references are escaped rather than executed as markup',()=>{
  const row=sourceRow(820,820,'official');row.paymentReference='<img src=x onerror=alert(1)>';
  const html=ledgerHtml(row);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
});
function navigationHarness(){
  const start=script!.indexOf('let moduleRequestSeq=');
  const end=script!.indexOf('\nfunction kpi(',start);
  assert.ok(start>=0&&end>start);
  const nodes=new Map<string,{textContent:string;innerHTML:string;className:string;classList:{remove:(name:string)=>void}}>();
  const el=(id:string)=>{let n=nodes.get(id);if(!n){n={textContent:'',innerHTML:'',className:'',classList:{remove:()=>{}}};nodes.set(id,n);}return n;};
  const requests:Array<{resolve:(value:unknown)=>void;reject:(value:unknown)=>void}>=[];
  const rendered:unknown[]=[];const busy:string[]=[];
  const load=runInNewContext(script!.slice(start,end)+'\nloadModule',{
    document:{body:{classList:{remove(){}}},querySelectorAll:()=>[]},overview:{},el,names:{payments:'Payments','cost-forecast':'Cost Forecast'},descriptions:{},
    setBusy:(value:string)=>busy.push(value),escapeHtml:(value:unknown)=>String(value),project:()=> 'TEST',
    api:()=>new Promise((resolve,reject)=>requests.push({resolve,reject})),renderModuleResult:(result:unknown)=>rendered.push(result),
  }) as (key:string)=>Promise<void>;
  return {load,nodes,requests,rendered,busy};
}
test('rapid module navigation updates its title immediately and rejects stale successful responses',async()=>{
  const h=navigationHarness();const old=h.load('payments');const current=h.load('cost-forecast');
  assert.equal(h.nodes.get('moduleTitle')?.textContent,'Cost Forecast');
  assert.match(h.nodes.get('moduleContent')!.innerHTML,/Updating Cost Forecast/);
  h.requests[1]!.resolve({key:'cost-forecast'});await current;
  h.requests[0]!.resolve({key:'payments'});await old;
  assert.deepEqual(h.rendered,[{key:'cost-forecast'}]);
});
test('stale module failures do not overwrite a newer successful module',async()=>{
  const h=navigationHarness();const old=h.load('payments');const current=h.load('cost-forecast');
  h.requests[1]!.resolve({key:'cost-forecast'});await current;
  h.requests[0]!.reject(new Error('old request failed'));await old;
  assert.deepEqual(h.rendered,[{key:'cost-forecast'}]);assert.equal(h.busy.at(-1),'');
});
