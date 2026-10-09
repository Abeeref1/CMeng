import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {boqPageReviewScript} from '../packages/runtime-api/src/ui-boq-page-review';
function harness(){
 const elements=new Map<string,any>(),el=(id:string)=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',checked:false,disabled:false,value:'2'});return elements.get(id);};
 let owner='P',fail=false,seq=0;const calls:any[]=[];
 const source={ingestionId:'B',sourceHash:'H',revisionId:'R',filename:'<Original>.pdf',sourceAvailable:true,automaticItemCount:0,reviewedCoveragePercent:0,pages:[{page:2,status:'needs_review',reviewToken:'T',automaticItemCount:0,addedItemCount:0,reviewedItemCount:null,items:[],note:''}]};
 const session={owner:'P',data:{},pageData:{projectId:'P',sources:[source]},pageDrafts:new Map()};
 const context=createContext({el,project:()=>owner,crypto:{randomUUID:()=>String(++seq)},escapeHtml:(x:unknown)=>String(x).replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),boqReviewSession:session,renderBoqNumericReview:()=>{},refresh:async()=>{},api:async(path:string,options?:any)=>{calls.push({path,options});if(fail)throw Error('Save interrupted');if(!options)return session.pageData;const input=JSON.parse(options.body),p={...source.pages[0],status:input.action==='confirm'?'confirmed':'reopened',items:input.items,reviewToken:'T2',reviewedItemCount:input.items.length};return {projectId:'P',pendingPageCount:0,sources:[{...source,pages:[p]}]};}});
 runInContext(boqPageReviewScript,context);
 return {context,el,calls,session,setFail:(x:boolean)=>fail=x,setOwner:(x:string)=>owner=x};
}
test('a page with zero extracted items stays visible, opens beside its source and supports insertion',async()=>{
 const h=harness();assert.match(runInContext('renderBoqPageOverview()',h.context),/0 extracted items/);assert.match(runInContext('renderBoqPageOverview()',h.context),/&lt;Original&gt;/);
 await runInContext('openBoqPageEditor(0)',h.context);assert.match(h.el('boqPageEditor').innerHTML,/Original source page 2/);
 runInContext('addBoqPageItem(-1);editBoqPageField(0,"description","Missing work");editBoqPageField(0,"quantity","0");',h.context);
 assert.equal(runInContext('boqPageSession.draft.rows[0].values.quantity',h.context),0);
 assert.equal(runInContext('boqPageSession.draft.rows[0].description',h.context),'Missing work');
});
test('split and combine preserve source links and require source values to be entered anew',async()=>{
 const h=harness();await runInContext('openBoqPageEditor(0)',h.context);
 runInContext('addBoqPageItem(-1);boqPageSession.draft.rows[0].origins=["RAW"];editBoqPageField(0,"description","Work");editBoqPageField(0,"quantity","10");splitBoqPageItem(0);',h.context);
 assert.equal(runInContext('boqPageSession.draft.rows.length',h.context),2);assert.equal(runInContext('boqPageSession.draft.rows[1].values.quantity',h.context),null);
 runInContext('boqPageSession.draft.selected.add(0);boqPageSession.draft.selected.add(1);combineBoqPageItems()',h.context);
 assert.equal(runInContext('boqPageSession.draft.rows.length',h.context),1);assert.equal(runInContext('boqPageSession.draft.rows[0].origins.join()',h.context),'RAW');
});
test('source attestation, failed-save retry and project switching protect the page review',async()=>{
 const h=harness();await runInContext('openBoqPageEditor(0)',h.context);runInContext('addBoqPageItem(-1);editBoqPageField(0,"description","Retained draft");',h.context);
 const before=h.calls.length;await runInContext('saveBoqPageReview("confirm")',h.context);assert.equal(h.calls.length,before);
 h.el('boqPageAttest').checked=true;h.setFail(true);await runInContext('saveBoqPageReview("confirm")',h.context);const body=h.calls.at(-1).options.body;
 assert.equal(runInContext('boqPageSession.draft.rows[0].description',h.context),'Retained draft');
 await runInContext('saveBoqPageReview("confirm")',h.context);assert.equal(h.calls.at(-1).options.body,body);
 h.setOwner('OTHER');const count=h.calls.length;await runInContext('saveBoqPageReview("confirm")',h.context);assert.equal(h.calls.length,count);
});
