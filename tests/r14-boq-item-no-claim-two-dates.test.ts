import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {resolveBoqSource} from '../packages/runtime-api/src/boq-source';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {canonicalHeader} from '../packages/truth-kernel/src/register-schema';

// R14 (1): a BOQ-qualified item number header ("BOQ Item No", "BOQ Item No.",
// "BOQ Item Number", "BOQ Ref No") cites a BOQ item. A plain "Item No" is the
// register's own row number. A package register states both; the package links
// resolve from the BOQ column only (exact ID or unique item number).
// R14 (2): a claims register stating both a Notice Date and a Submitted Date
// keeps both; a difference between two files on either date is a query.
// Every expected value is written by hand from the fixture text below.
process.env.CMENG_OCR_ENABLED='0';

const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tR14\t2031-08-31 08:00',
 '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,
 '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\tW0\t1\t\tVP\tProject',
 '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
 '%R\t1\t1\tW0\t1\tA1\tWorks\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16','%E'].join('\n');
const boqCsv='Item No,Section,Description,Unit,Quantity,Rate,Amount,Currency\n'+
 '1.1,Earthworks,Excavation,m3,100,10,1000,QAR\n'+
 '1.2,Electrical Works,Cable tray,m,50,20,1000,QAR\n'+
 '1.3,Finishes,Tiling,m2,20,5,100,QAR';
// The register's own row numbers 1 and 2 equal no BOQ item number on purpose:
// read as BOQ references they would be "not found", never a link.
const procurementCsv='Item No,Package ID,Description,BOQ Item No,Status\n'+
 '1,PK-EL,Electrical,1.2,Ordered\n'+
 '2,PK-FIN,Finishes,1.3,Ordered';

async function store(t:any,name:string){
 const dir=mkdtempSync(join(tmpdir(),'r14-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const s=new RuntimeProjectStore({dataDir:dir,durable:false}),state=s.getOrCreate(name);
 let day=1;
 const upload=(file:string,content:string,extra:any={})=>s.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(content),mediaType:file.endsWith('.xer')?'text/plain':'text/csv',sourceFilename:file,uploadedAt:'2031-09-0'+(day++),...extra});
 await upload('Current.xer',programme,{uploadIntent:'replace_current_basis'});
 return {state,upload};
}

test('R14: BOQ-qualified item number headers keep the BOQ qualifier; a plain Item No stays the row number',()=>{
 for(const header of ['BOQ Item No','BOQ Item No.','BOQ Item Number','BOQ Ref No','boq item no'])
  assert.equal(canonicalHeader(header),'boq item no',header+' is a BOQ item reference');
 for(const header of ['Item No','Item No.','Item Number'])assert.equal(canonicalHeader(header),'item no',header+' is a row/item number');
});

test('R14: a package register citing BOQ items by "BOQ Item No" links each package to its BOQ item; its own Item No is not a link',async t=>{
 const {state,upload}=await store(t,'R14-BOQ-ITEM-NO');
 await upload('BOQ.csv',boqCsv);
 await upload('Procurement.csv',procurementCsv);
 const items=resolveBoqSource(state,'').quantities!.items;
 const id=(number:string)=>items.find(i=>i.itemNumber===number)!.quantityItemId;
 const p=deliveryPosition(state) as any;
 const el=p.records.find((r:any)=>r.reference==='PK-EL'),fin=p.records.find((r:any)=>r.reference==='PK-FIN');
 assert.ok(el&&fin,'both packages are read: '+JSON.stringify(p.records.map((r:any)=>r.reference)));
 assert.deepEqual(el.links.boqItemIds,[id('1.2')],'BOQ Item No 1.2 resolves to the one BOQ item 1.2');
 assert.deepEqual(fin.links.boqItemIds,[id('1.3')],'BOQ Item No 1.3 resolves to the one BOQ item 1.3');
 assert.equal(el.boqReferences?.[0]?.state,'unique_item_number');
});

test('R14: a BOQ whose own number column is headed "BOQ Item No" still reads its items',async t=>{
 const {state,upload}=await store(t,'R14-BOQ-OWN-HEADER');
 await upload('BOQ.csv',boqCsv.replace(/^Item No,/,'BOQ Item No,'));
 const items=resolveBoqSource(state,'').quantities?.items??[];
 assert.deepEqual(items.map(i=>i.itemNumber).sort(),['1.1','1.2','1.3']);
});

const claimsA='Claim ID,Event ID,Event,Notice Date,Submitted Date,Days Claimed,Status\n'+
 'CLM-01,EV-01,Late site access,2031-03-05,2031-03-20,10,Submitted\n'+
 'CLM-02,EV-02,Design change,2031-04-12,2031-04-30,8,Submitted';
// A separate EOT register (no event title column, so it is a different register
// from the claims register, not a revision of it; as in the F06 case).
// CLM-01: the later file states a different Notice Date (one query on notice date).
// CLM-02: the later file states a different Submitted Date (one query on submitted date).
const claimsB='Claim ID,Event ID,Notice Date,Submitted Date,Days Claimed,Status\n'+
 'CLM-01,EV-01,2031-03-07,2031-03-20,10,Submitted\n'+
 'CLM-02,EV-02,2031-04-12,2031-05-02,8,Submitted';

test('R14: a claims register stating both dates keeps both; a conflict on either date between two files is a query',async t=>{
 const {state,upload}=await store(t,'R14-CLAIM-TWO-DATES');
 await upload('Claims_Register.csv',claimsA);
 await upload('EOT_Register.csv',claimsB);
 for(const name of ['Claims_Register.csv','EOT_Register.csv']){
  const stored=state.evidenceDocuments.find((d:any)=>d.sourceFilename===name) as any;
  assert.ok(stored&&['active','additive'].includes(stored.basisState),name+' is part of the current basis ('+stored?.basisState+', '+stored?.documentType+', '+stored?.familyKey+', '+stored?.logicalDocumentKey+')');
 }
 const facts:any=projectFactsForState(state);
 const queries=facts.claims.pipeline.sourceRecordQueries.map((q:any)=>[q.recordId,q.field,q.values.map((v:any)=>v.value),q.usedValue]);
 assert.deepEqual(queries.sort(),[
  ['CLM-01','notice date',['2031-03-05','2031-03-07'],'2031-03-07'],
  ['CLM-02','submitted date',['2031-04-30','2031-05-02'],'2031-05-02'],
 ],JSON.stringify({queries,documents:state.evidenceDocuments.map((d:any)=>[d.sourceFilename,d.documentType,d.basisState,d.logicalDocumentKey])}));
 const rows=facts.claims.pipeline.rows.map((r:any)=>r.claimId).sort();
 assert.deepEqual(rows,['CLM-01','CLM-02'],'one claim per id across both files');
});
