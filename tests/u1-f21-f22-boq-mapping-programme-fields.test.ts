import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src';
import {scheduleScopeClassification} from '../packages/runtime-api/src/schedule-scope-classification';
import {assignScope,reconcileScope,boqReferenceResolver,boqItemSourceRows} from '../packages/runtime-api/src/boq-scope-mapping';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {projectDecisionFacts} from '../packages/runtime-api/src/project-decision-facts';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {resolveBoqSource} from '../packages/runtime-api/src/boq-source';

// F21 (BOQ to area and to package) and F22 (programme baseline, discipline
// and plot) read from the source files through one shared rule each.

const xer=(lines:string[])=>parseXerBytes(new TextEncoder().encode([...lines,'%E'].join('\n')));
const TASK_FIELDS='%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt';
const task=(id:string,proj:string,wbs:string,code:string,targetStart:string,targetEnd:string,earlyStart:string,earlyEnd:string)=>
 ['%R',id,proj,wbs,'',code,code+' work','TT_Task','TK_NotStart',targetStart+' 08:00',targetEnd+' 16:00',earlyStart+' 08:00',earlyEnd+' 16:00','80','80'].join('\t');

function baselineXer(projects:string[][]){
 // Rows of a project are written only when that PROJECT row is in the file.
 const present=new Set(projects.map(p=>p[0]!)),of=(proj:string,row:string)=>present.has(proj)?[row]:[];
 return xer(['ERMHDR\t23.12',
  '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date\torig_proj_id\tsum_base_proj_id',...projects.map(p=>['%R',...p].join('\t')),
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name',...of('1','%R\tW1\t1\t\tCUR\tCurrent works'),...of('2','%R\tW2\t2\t\tBL\tBaseline works'),...of('3','%R\tW3\t3\t\tBL2\tSecond baseline'),
  '%T\tTASK',TASK_FIELDS,
  ...of('1',task('11','1','W1','A100','2031-02-01','2031-02-10','2031-03-01','2031-03-12')),
  ...of('1',task('12','1','W1','A200','2031-02-11','2031-02-20','2031-03-13','2031-03-24')),
  ...of('2',task('21','2','W2','A100','2031-01-10','2031-01-20','2031-01-10','2031-01-20')),
  ...of('2',task('22','2','W2','A300','2031-01-21','2031-01-30','2031-01-21','2031-01-30')),
  ...of('3',task('31','3','W3','A100','2030-12-01','2030-12-10','2030-12-01','2030-12-10')),
  '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt',
  ...of('1','%R\tL1\t12\t11\t1\t1\tPR_FS\t0'),...of('2','%R\tL2\t22\t21\t2\t2\tPR_FS\t0')]);
}

test('F22 baseline dates come from the baseline project the XER carries, labelled, and its rows never become current work',()=>{
 const model=canonicalScheduleFromXer(baselineXer([['1','CUR','2031-08-31 08:00','','2'],['2','CUR-BL','2031-01-05 08:00','1','']]),{sourceRevisionId:'R1',projectId:'CUR'});
 assert.deepEqual(model.activities.map(a=>a.activityId).sort(),['A100','A200'],'baseline TASK rows are not current activities');
 assert.ok(!model.diagnostics.some(d=>d.startsWith('XER_DUPLICATE_ACTIVITY_ID')),'the baseline copy is not a duplicate activity');
 assert.equal(model.dataDateIso?.slice(0,10),'2031-08-31','the baseline project never conflicts with the current data date');
 assert.deepEqual(model.wbs.map(w=>w.wbsId),['W1']);
 assert.deepEqual(model.relationships.map(r=>r.relationshipId),['L1'],'baseline links are not current links');
 const a100=model.activities.find(a=>a.activityId==='A100')!;
 assert.equal(a100.baselineDateBasis,'source_declared_baseline');
 assert.equal(a100.baselineStartIso?.slice(0,10),'2031-01-10');
 assert.equal(a100.baselineFinishIso?.slice(0,10),'2031-01-20');
 assert.equal(a100.currentStartIso?.slice(0,10),'2031-03-01','baseline start differs from current start where the baseline says so');
 assert.ok(a100.sourceRefs.some(r=>r.locator.startsWith('BASELINE:2:TASK:line:')));
 const a200=model.activities.find(a=>a.activityId==='A200')!;
 assert.equal(a200.baselineStartIso,null,'an activity absent from the baseline has no baseline date (not its own target date)');
 assert.equal(a200.baselineDateBasis,'source_declared_baseline');
 assert.ok(a200.diagnostics.includes('XER_ACTIVITY_NOT_IN_BASELINE_PROJECT:2'));
 assert.ok(model.diagnostics.includes('XER_BASELINE_PROJECT:2:FOR:1:sum_base_proj_id'));
});

test('F22 sum_base_proj_id chooses among several baselines; without that choice the file\'s own target dates stay, labelled',()=>{
 const chosen=canonicalScheduleFromXer(baselineXer([['1','CUR','2031-08-31 08:00','','3'],['2','BL1','2031-01-05 08:00','1',''],['3','BL2','2030-11-05 08:00','1','']]),{sourceRevisionId:'R2',projectId:'CUR'});
 assert.deepEqual(chosen.activities.map(a=>a.activityId).sort(),['A100','A200']);
 assert.equal(chosen.activities.find(a=>a.activityId==='A100')!.baselineStartIso?.slice(0,10),'2030-12-01');
 const open=canonicalScheduleFromXer(baselineXer([['1','CUR','2031-08-31 08:00','',''],['2','BL1','2031-01-05 08:00','1',''],['3','BL2','2030-11-05 08:00','1','']]),{sourceRevisionId:'R3',projectId:'CUR'});
 assert.deepEqual(open.activities.map(a=>a.activityId).sort(),['A100','A200'],'declared baselines are still not current work');
 const a100=open.activities.find(a=>a.activityId==='A100')!;
 assert.equal(a100.baselineDateBasis,'xer_target_dates');
 assert.equal(a100.baselineStartIso?.slice(0,10),'2031-02-01','own planned (target) dates, labelled as such');
 assert.ok(open.diagnostics.includes('XER_BASELINE_PROJECT_AMBIGUOUS:1:2|3'));
 // A single-project file keeps target dates labelled as target dates.
 const single=canonicalScheduleFromXer(baselineXer([['1','CUR','2031-08-31 08:00','','']]),{sourceRevisionId:'R4',projectId:'CUR'});
 assert.equal(single.activities.find(a=>a.activityId==='A100')!.baselineDateBasis,'xer_target_dates');
});

test('F22 discipline and plot come from the programme activity codes first, then WBS / names',()=>{
 const model=canonicalScheduleFromXer(xer(['ERMHDR\t23.12',
  '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tCODES\t2031-01-05 08:00',
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\tW1\t1\t\tR\tVillas','%R\tW2\t1\tW1\tP7\tPlot C 7 villas',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt',
  '%R\t1\t1\tW1\t\tA1\tInstall electrical cable trays\tTT_Task\tTK_NotStart\t8\t8',
  '%R\t2\t1\tW1\t\tA2\tInstall electrical panels\tTT_Task\tTK_NotStart\t8\t8',
  '%R\t3\t1\tW2\t\tA3\tInternal plaster\tTT_Task\tTK_NotStart\t8\t8',
  '%T\tACTVTYPE','%F\tactv_code_type_id\tactv_code_type','%R\tT1\tDiscipline','%R\tT2\tPlot',
  '%T\tACTVCODE','%F\tactv_code_id\tactv_code_type_id\tshort_name\tactv_code_name',
  '%R\tC1\tT1\tMEP-EL\tElectrical services','%R\tC2\tT2\tB 42\tPlot B 42',
  '%T\tTASKACTV','%F\ttask_id\tactv_code_type_id\tactv_code_id\tproj_id','%R\t1\tT1\tC1\t1','%R\t1\tT2\tC2\t1']),{sourceRevisionId:'C1',projectId:'CODES'});
 const rows=new Map(scheduleScopeClassification(model).rows.map(r=>[r.activityId,r]));
 assert.equal(rows.get('A1')!.discipline,'MEP-EL','the programme discipline code, not a name match');
 assert.equal(rows.get('A1')!.classificationBasis.discipline,'source_activity_code');
 assert.equal(rows.get('A1')!.plot,'Plot B 42');
 assert.equal(rows.get('A1')!.classificationBasis.plot,'source_activity_code');
 assert.equal(rows.get('A2')!.discipline,'Electrical','no code: labelled name match stays the fallback');
 assert.equal(rows.get('A2')!.classificationBasis.discipline,'source_derived');
 assert.equal(rows.get('A3')!.plot,'Plot C 7','no code: plot read from the WBS name');
 assert.equal(rows.get('A3')!.classificationBasis.plot,'source_wbs');
});

test('F21 shared rule: explicit reference first, then unique matches; disagreement stays unmapped with candidates; totals add up',()=>{
 assert.deepEqual(assignScope({values:['Plot 01',' plot  01 '],basis:'explicit'},[{values:['Area 9'],basis:'match'}]),{group:'Plot 01',state:'explicit',basis:'explicit',candidates:['Plot 01']});
 const ambiguous=assignScope({values:['Zone 1','Zone 2'],basis:'explicit'},[{values:['Area 9'],basis:'match'}]);
 assert.equal(ambiguous.group,null);assert.equal(ambiguous.state,'ambiguous');assert.deepEqual(ambiguous.candidates,['Zone 1','Zone 2']);
 assert.deepEqual(assignScope({values:[],basis:'explicit'},[{values:[null,'Area 9'],basis:'match'}]).group,'Area 9');
 assert.equal(assignScope({values:[],basis:'explicit'},[{values:[],basis:'match'}]).state,'unmapped');
 const rows=[{itemId:'a',currency:'QAR',value:10},{itemId:'b',currency:'QAR',value:5},{itemId:'c',currency:'QAR',value:null},{itemId:'d',currency:'USD',value:7}];
 const groups:Record<string,string|null>={a:'X',b:null,c:'X',d:'Y'};
 const r=reconcileScope(rows,row=>({group:groups[row.itemId]!,state:groups[row.itemId]?'explicit':'unmapped',basis:'t',candidates:[]}),'Unmapped');
 assert.equal(r.addsUp,true);
 const qar=r.byCurrency.find(x=>x.currency==='QAR')!;
 assert.deepEqual([qar.totalItemCount,qar.totalValue,qar.mappedItemCount,qar.mappedValue,qar.unmappedItemCount,qar.unmappedValue],[3,15,2,10,1,5]);
 assert.equal(r.groups.find(g=>g.group==='X')!.value,10,'an item without a value is counted, never as zero value');
 const resolve=boqReferenceResolver([{quantityItemId:'boqitem_1',itemNumber:'1.1'},{quantityItemId:'boqitem_2',itemNumber:'2.1'},{quantityItemId:'boqitem_3',itemNumber:'2.1'}]);
 assert.equal(resolve('boqitem_2').state,'exact_item_id');
 assert.deepEqual(resolve(' 1.1 '),{reference:'1.1',itemId:'boqitem_1',state:'unique_item_number',candidates:['boqitem_1']});
 assert.deepEqual(resolve('2.1'),{reference:'2.1',itemId:null,state:'ambiguous',candidates:['boqitem_2','boqitem_3']});
 assert.equal(resolve('9.9').state,'not_found');
 const table:any={document:{sourceHashSha256:'H'},rows:[{cells:{'item no':'2.1','section':'Doors','package':'PK-D'},receipt:{}},{cells:{'item no':'1.1','package':'PK-A'},receipt:{}},{cells:{'item no':'2.1','package':'PK-?'},receipt:{}}]};
 const byItem=boqItemSourceRows([table],'H',[{quantityItemId:'i1',itemNumber:'1.1',section:'Civil'},{quantityItemId:'i2',itemNumber:'2.1',section:'Doors'},{quantityItemId:'i3',itemNumber:'2.1',section:'Joinery'}]);
 assert.deepEqual([...byItem.keys()].sort(),['i1','i2'],'a repeated item number without a section matches no item');
});

const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tAREAS\t2031-08-31 08:00',
 '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,
 '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\tW0\t1\t\tVP\tVilla Project','%R\tW1\t1\tW0\tA01\tArea 01','%R\tW2\t1\tW0\tA02\tArea 02',
 '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
 '%R\t1\t1\tW1\t1\tA1\tSlab works area one\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16',
 '%R\t2\t1\tW2\t1\tA2\tBlockwork area two\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16','%E'].join('\n');
const boqCsv='Item No,Section,Description,Unit,Quantity,Rate,Amount,Currency,Area,WBS Code,Package\n'+
 '1.1,Earthworks,Excavation,m3,100,10,1000,QAR,Plot 01,,PK-CIV\n'+
 '1.2,Electrical Works,Cable tray,m,50,20,1000,QAR,,,\n'+
 '1.3,Area 02,Blockwork,m2,10,30,300,QAR,,,\n'+
 '1.4,Finishes,Tiling,m2,20,5,100,QAR,Zone 1,,\n'+
 '1.5,Concrete,Slab,m3,8,100,800,QAR,,A01,\n'+
 '1.6,Doors,Door,No.,2,10,20,QAR,,,\n'+
 '1.6,Joinery,Wardrobe,No.,1,40,40,QAR,,,';

async function project(t:any){
 const dir=mkdtempSync(join(tmpdir(),'u1-f21-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('U1-F21');
 const upload=(name:string,content:string,extra:any={})=>store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(content),mediaType:name.endsWith('.xer')?'text/plain':'text/csv',sourceFilename:name,uploadedAt:'2031-09-01',...extra});
 await upload('Current.xer',programme,{uploadIntent:'replace_current_basis'});
 await upload('BOQ.csv',boqCsv);
 await upload('Measurements.csv','Measurement Date,Item No,Section,Cumulative Installed Qty,Unit,Zone\n2031-08-20,1.4,Finishes,5,m2,Zone 2');
 await upload('Procurement.csv','Package ID,Description,BOQ Item,Status\nPK-CIV,Civil works,,Ordered\nPK-EL,Electrical,1.2;1.3,Ordered\nPK-FIN,Finishes,1.6,Ordered\nPK-X,Extra trays,1.3,Ordered');
 const items=resolveBoqSource(state,'').quantities!.items;
 const id=(number:string,section:string)=>items.find(i=>i.itemNumber===number&&i.section===section)!.quantityItemId;
 return {state,items,id};
}

test('F21 BOQ items map to the programme areas: explicit area, BOQ WBS code, exact section; conflicts unmapped; area totals add up',async t=>{
 const {state,items,id}=await project(t);
 assert.equal(items.length,7);
 const q=projectDecisionFacts(state).quantities as any,item=new Map(q.items.map((r:any)=>[r.itemId,r]));
 const area=(n:string,s:string)=>(item.get(id(n,s)) as any);
 assert.equal(area('1.1','Earthworks').area,'Plot 01','explicit BOQ row area');
 assert.equal(area('1.5','Concrete').area,'Area 01','BOQ WBS code maps the item to the programme area of that WBS');
 assert.equal(area('1.3','Area 02').area,'Area 02','section equal to one programme area');
 assert.equal(area('1.2','Electrical Works').area,null,'a BOQ section is not an area');
 assert.equal(area('1.2','Electrical Works').areaMappingState,'unmapped');
 assert.equal(area('1.4','Finishes').area,null,'disagreeing explicit areas are not chosen');
 assert.equal(area('1.4','Finishes').areaMappingState,'ambiguous');
 assert.deepEqual(area('1.4','Finishes').areaCandidates,['Zone 1','Zone 2']);
 const r=q.areaReconciliation.byCurrency.find((x:any)=>x.currency==='QAR');
 assert.deepEqual([r.totalItemCount,r.totalValue,r.mappedItemCount,r.mappedValue,r.unmappedItemCount,r.unmappedValue,r.ambiguousItemCount,r.addsUp],[7,3260,3,2100,4,1160,1,true]);
 const groups=q.areas.filter((a:any)=>a.mapped).map((a:any)=>[a.area,a.itemCount,a.contractValue]).sort();
 assert.deepEqual(groups,[['Area 01',1,800],['Area 02',1,300],['Plot 01',1,1000]]);
 const unmapped=q.areas.find((a:any)=>!a.mapped);
 assert.deepEqual([unmapped.area,unmapped.itemCount,unmapped.contractValue,unmapped.certifiedValue],['Area not recorded',4,1160,null]);
});

test('F21 BOQ items map to packages from the register\'s cited item numbers and the BOQ row package code; shared or ambiguous items listed; totals add up',async t=>{
 const {state,id}=await project(t);
 const p=deliveryPosition(state) as any,rec=p.boqIntelligence.packageReconciliation;
 assert.ok(rec,'package reconciliation published');
 const pk=p.records.find((r:any)=>r.reference==='PK-EL');
 assert.deepEqual(pk.links.boqItemIds.sort(),[id('1.2','Electrical Works'),id('1.3','Area 02')].sort(),'register item numbers resolve to the BOQ items');
 const fin=p.records.find((r:any)=>r.reference==='PK-FIN');
 assert.equal(fin.boqReferences[0].state,'ambiguous');
 assert.deepEqual(fin.boqReferences[0].candidates.sort(),[id('1.6','Doors'),id('1.6','Joinery')].sort());
 const groups=rec.groups.map((g:any)=>[g.reference,g.itemCount,g.value]).sort();
 assert.deepEqual(groups,[['PK-CIV',1,1000],['PK-EL',1,1000]]);
 const qar=rec.byCurrency.find((x:any)=>x.currency==='QAR');
 assert.deepEqual([qar.totalItemCount,qar.totalValue,qar.mappedItemCount,qar.mappedValue,qar.unmappedItemCount,qar.unmappedValue,qar.ambiguousItemCount,qar.addsUp],[7,3260,2,2000,5,1260,3,true]);
 const shared=rec.unmapped.items.find((u:any)=>u.itemId===id('1.3','Area 02'));
 assert.equal(shared.state,'ambiguous');assert.deepEqual(shared.candidates.sort(),['PK-EL','PK-X']);
 assert.equal(rec.unmapped.items.find((u:any)=>u.itemId===id('1.5','Concrete')).state,'unmapped');
 const row=p.boqIntelligence.rows.find((r:any)=>r.itemId===id('1.1','Earthworks'));
 assert.equal(row.procurementPackageIds.length,1,'BOQ row package code links the item to its one package');
});
