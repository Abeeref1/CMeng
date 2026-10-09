import test from 'node:test';
import assert from 'node:assert/strict';
import {Script,createContext,runInContext} from 'node:vm';
import {boqNumericReviewScript} from '../packages/runtime-api/src/ui-boq-numeric-review';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

function harness(){
 const elements=new Map<string,any>();
 const element=(id:string)=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',checked:false,disabled:false,hidden:false,open:true,close(){this.open=false;}});return elements.get(id);};
 const calls:any[]=[];let owner='P',fails=false,counter=0;
 const rows=Array.from({length:55},(_,i)=>({itemId:'I'+i,fingerprint:'F'+i,itemNumber:String(i),description:'Works <'+i+'>',unit:'m2',currency:'SAR',values:{quantity:i===0?null:i,rate:4,amount:i*4},reasons:['Check source'],page:1,arithmeticConflict:i===1}));
 const data={projectId:'P',projectVersion:4,reviewToken:'T',pendingCount:55,confirmedCount:4,automaticCount:12,sources:[{ingestionId:'B',sourceHash:'HASH',filename:'<Source>.pdf',pendingCount:55,confirmedCount:4,automaticCount:12,sourceAvailable:true,mediaType:'application/pdf',rows}]};
 const context=createContext({project:()=>owner,el:element,escapeHtml:(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)),crypto:{randomUUID:()=>String(++counter)},refresh:async()=>{},api:async(path:string,options:any)=>{calls.push({path,options});if(fails)throw Error('Temporary save failure');return {...data,reviewToken:'T2',pendingCount:0,confirmedCount:59,sources:[]};},data});
 runInContext(boqNumericReviewScript+';boqReviewSession={owner:"P",data,selected:new Set(),drafts:new Map(),pages:new Map(),payload:null};',context);
 return {context,element,calls,setOwner:(value:string)=>owner=value,setFails:(value:boolean)=>fails=value};
}
test('assembled browser script remains valid JavaScript',()=>{
 const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;assert.doesNotThrow(()=>new Script(script));
});
test('one review retains edits and selections across pages, escapes source content and groups only consistent rows',()=>{
 const h=harness();runInContext('renderBoqNumericReview();',h.context);
 assert.match(h.element('boqNumericReviewDialog').innerHTML,/12 native rows need no confirmation/);
 assert.match(h.element('boqNumericReviewDialog').innerHTML,/&lt;Source&gt;/);
 runInContext('editBoqReviewValue(0,3,"quantity","3.25");pageBoqReview(0,1);pageBoqReview(0,-1);',h.context);
 assert.equal(runInContext('boqReviewSession.drafts.get("B|I3").quantity',h.context),3.25);
 assert.equal(runInContext('boqReviewSession.selected.has("B|I3")',h.context),true);
 assert.match(h.element('boqNumericReviewDialog').innerHTML,/value="3.25"/);
 runInContext('selectBoqReviewedGroup(0,true);',h.context);
 assert.equal(runInContext('boqReviewSession.selected.size',h.context),53);
 assert.equal(runInContext('boqReviewSession.selected.has("B|I0")||boqReviewSession.selected.has("B|I1")',h.context),false);
});
test('source check is explicit once and a failed save retains one idempotent batch for retry',async()=>{
 const h=harness();runInContext('renderBoqNumericReview();updateBoqReviewSelection(0,3,true);',h.context);
 await runInContext('saveBoqNumericReview()',h.context);assert.equal(h.calls.length,0);
 h.element('boqReviewSourceChecked').checked=true;h.setFails(true);
 await runInContext('saveBoqNumericReview()',h.context);assert.equal(h.calls.length,1);
 assert.equal(runInContext('boqReviewSession.selected.size',h.context),1);
 h.setFails(false);await runInContext('saveBoqNumericReview()',h.context);assert.equal(h.calls.length,2);
 assert.equal(h.calls[0].options.body,h.calls[1].options.body,'Retry uses the exact same review reference and values');
 assert.equal(runInContext('boqReviewSession.selected.size',h.context),0);
 assert.match(h.element('boqNumericReviewDialog').innerHTML,/nothing to confirm again/);
});
test('switching projects cannot send a stale review into the new project',async()=>{
 const h=harness();runInContext('updateBoqReviewSelection(0,3,true)',h.context);h.element('boqReviewSourceChecked').checked=true;h.setOwner('OTHER');
 await runInContext('saveBoqNumericReview()',h.context);assert.equal(h.calls.length,0);assert.match(h.element('boqReviewMessage').textContent,/current project/);
});
