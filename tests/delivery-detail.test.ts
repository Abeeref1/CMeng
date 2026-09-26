import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

function fixture(){
 let projectId='PROJECT-A';const elements=new Map<string,any>();
 const c:any={escapeHtml:(v:any)=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!)),project:()=>projectId,el:(id:string)=>elements.get(id)};
 runInNewContext(deliveryScript()+';globalThis.views=()=>deliveryDetailViews;',c);
 return {c,elements,switchProject:()=>{projectId='PROJECT-B';}};
}

test('large evidence sets remain complete without eagerly visiting hidden record fields',()=>{
 const {c}=fixture();let visited=0;
 const records=Array.from({length:50000},(_,i)=>({reference:'R'+i,get source(){visited++;return {date:'2031-08-31',amount:1450000000};}}));
 const html=c.deliveryObjectDetail({records});assert.equal(visited,0);assert.ok(html.length<1000);
 const id=/data-delivery-lazy="([^"]+)"/.exec(html)![1]!;
 assert.equal(c.views()[id].value,records);const page=c.deliveryEvidencePage(id);
 assert.match(page,/R24/);assert.doesNotMatch(page,/R25\b/);assert.equal(visited,0);
 assert.match(page,/1–25 of 50000 matching items · 50000 in the complete set/);
});

test('evidence detail reaches first, middle and final pages, searches the complete set and restores it',()=>{
 const {c}=fixture();const records=Array.from({length:63},(_,i)=>({reference:'REC-'+String(i).padStart(3,'0'),source:{filename:'Source.csv',locator:'row:'+(i+2)},value:i===62?'<exact & final>':i}));
 const before=JSON.stringify(records),html=c.deliveryObjectDetail(records),id=/data-delivery-lazy="([^"]+)"/.exec(html)![1]!,view=c.views()[id];
 assert.match(c.deliveryEvidencePage(id),/1–25 of 63/);
 view.page=1;assert.match(c.deliveryEvidencePage(id),/REC-025/);assert.match(c.deliveryEvidencePage(id),/26–50 of 63/);
 view.page=2;const last=c.deliveryEvidencePage(id);assert.match(last,/REC-062/);assert.match(last,/51–63 of 63/);
 view.query='row:64';view.page=0;assert.match(c.deliveryEvidencePage(id),/REC-062/);assert.match(c.deliveryEvidencePage(id),/1–1 of 1 matching items · 63 in the complete set/);
 const finalId=Object.keys(c.views()).find(key=>c.views()[key].value===records[62])!;
 const target={innerHTML:''},node={open:true,dataset:{deliveryLazy:finalId},querySelector:()=>target};
 c.deliveryExpandEvidence({target:node});assert.match(target.innerHTML,/&lt;exact &amp; final&gt;/);
 view.query='not present';assert.match(c.deliveryEvidencePage(id),/No matching records/);
 view.query='';assert.match(c.deliveryEvidencePage(id),/1–25 of 63/);
 assert.equal(JSON.stringify(records),before,'browsing does not rewrite any source field');
});

test('lazy evidence does not disclose the previous project after a project switch',()=>{
 const {c,switchProject}=fixture();const html=c.deliveryObjectDetail([{reference:'ONLY-PROJECT-A'}]);
 const id=/data-delivery-lazy="([^"]+)"/.exec(html)![1]!,target={innerHTML:'Unchanged'},node={open:true,dataset:{deliveryLazy:id},querySelector:()=>target};
 switchProject();c.deliveryExpandEvidence({target:node});assert.equal(target.innerHTML,'Unchanged');
});
