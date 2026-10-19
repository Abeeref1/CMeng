import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {activityRegisterView} from '../packages/runtime-api/src/activity-register-page';

// F07 (D-064, D-078, D-107, D-178, D-209, D-215, D-216), consultant check: "A
// prerequisite confirmed on one page is confirmed on all." Quantities, installed
// quantities, CPM coverage and the discipline list are one shared status
// (project facts inputs). The REEM file is not in the repository, so this
// project reproduces the case through the real upload path: a BOQ with items
// whose quantity or unit cannot be read, a measurement file with one row that
// matches no BOQ item and one dated after the Data Date, a programme whose
// CMeng CPM finish differs from the submitted finish, and disciplines from an
// activity code, from WBS names and from activity names, with one activity
// that matches none. Every expected value below is counted from these files.

const DATA_DATE='2031-08-31';
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
// 7-day calendar, 8 working hours a day. From the Data Date (31 Aug 08:00) the
// CMeng CPM finishes CIV-200 (80 h left) on 9 Sep, ELE-100 and ELE-200 (80 h
// each, after CIV-200) on 19 Sep and the milestone on 19 Sep. The submitted
// programme states 12 Sep, 22 Sep and 22 Sep: every activity differs by
// 3 days (below the 14-day screening) and the project finish differs by 3 days.
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tREEM-F07\t'+DATA_DATE+' 08:00',
 '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tSeven day 8h\t'+calendar,
 '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\tW0\t1\t\tRV\tReem Villas','%R\tW1\t1\tW0\tELE\tElectrical Works','%R\tW2\t1\tW0\tCIV\tCivil Works',
 '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\tact_start_date\tact_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
 '%R\t1\t1\tW2\t1\tCIV-100\tSite clearance\tTT_Task\tTK_Complete\t2031-06-01 08:00\t2031-06-10 16:00\t2031-06-01 08:00\t2031-06-10 16:00\t80\t0\t0',
 '%R\t2\t1\tW2\t1\tCIV-200\tExcavation and blinding\tTT_Task\tTK_Active\t2031-08-21 08:00\t\t2031-08-21 08:00\t2031-09-12 16:00\t160\t80\t0',
 '%R\t3\t1\tW1\t1\tELE-100\tCable tray installation\tTT_Task\tTK_NotStart\t\t\t2031-09-13 08:00\t2031-09-22 16:00\t80\t80\t0',
 '%R\t4\t1\tW1\t1\tELE-200\tLighting fixtures and switchgear\tTT_Task\tTK_NotStart\t\t\t2031-09-13 08:00\t2031-09-22 16:00\t80\t80\t0',
 '%R\t5\t1\tW0\t1\tMS-900\tHandover to employer\tTT_FinMile\tTK_NotStart\t\t\t2031-09-22 16:00\t2031-09-22 16:00\t0\t0\t0',
 '%T\tACTVTYPE','%F\tactv_code_type_id\tactv_code_type','%R\tT1\tDiscipline',
 '%T\tACTVCODE','%F\tactv_code_id\tactv_code_type_id\tshort_name\tactv_code_name','%R\tC1\tT1\tELEC\tElectrical installation',
 '%T\tTASKACTV','%F\ttask_id\tactv_code_type_id\tactv_code_id\tproj_id','%R\t3\tT1\tC1\t1',
 '%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt\tproj_id\tpred_proj_id',
 ...[[1,2],[2,3],[2,4],[3,5],[4,5]].map(([pre,post],i)=>['%R',i+1,post,pre,'PR_FS',0,1,1].join('\t')),'%E'].join('\n');
// 6 BOQ items: 2.003 has no unit, 3.001 has no quantity -> 4 of 6 readable.
const boqCsv='Item No,Section,Description,Unit,Quantity,Rate,Amount,Currency,VAT Basis\n'+
 '1.001,Electrical,Cable tray,m,1200,80,96000,AED,Exclusive\n'+
 '1.002,Electrical,Lighting fixtures,nr,300,450,135000,AED,Exclusive\n'+
 '2.001,Civil,Excavation,m3,5000,25,125000,AED,Exclusive\n'+
 '2.002,Civil,Blinding concrete,m3,400,300,120000,AED,Exclusive\n'+
 '2.003,Civil,Dewatering allowance,,1,40000,40000,AED,Exclusive\n'+
 '3.001,General,Testing and commissioning,LS,,60000,60000,AED,Exclusive';
// 5 rows: 1.001, 1.002 and 2.001 match on or before the Data Date; 2.002 in m2
// matches no item (the BOQ unit is m3); 2.002 in m3 is dated after the Data Date.
const measurementCsv='Measurement Date,Item No,Section,Unit,Cumulative Installed Qty\n'+
 '2031-08-31,1.001,Electrical,m,800\n2031-08-31,1.002,Electrical,nr,120\n2031-08-31,2.001,Civil,m3,5000\n'+
 '2031-08-31,2.002,Civil,m2,100\n2031-09-15,2.002,Civil,m3,200';

async function contractPdf(){
 const lines=['CONSTRUCTION CONTRACT','1 Contract Particulars','Contract currency is AED.','Accepted Contract Amount: AED 576000.',
  'Original Contract Value: AED 576000.','Contractual completion date: 2032-06-30.'];
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([595,842]);
 page.drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
 return Buffer.from(await pdf.save());
}
let cached:Promise<string>|null=null;
function reemCase(){
 cached??=(async()=>{
  const state=runtimeProjects.getOrCreate('R12-F07-'+randomUUID());
  const upload=(name:string,bytes:Buffer,extra:Record<string,unknown>={})=>runtimeProjects.ingestEvidenceFile({projectId:state.projectId,bytes,
   mediaType:name.endsWith('.pdf')?'application/pdf':name.endsWith('.xer')?'text/plain':'text/csv',sourceFilename:name,uploadedAt:'2031-09-01',...extra} as any);
  await upload('Current_Programme.xer',Buffer.from(programme),{uploadIntent:'replace_current_basis'});
  await upload('Main_Works_Contract.pdf',await contractPdf());
  await upload('BOQ.csv',Buffer.from(boqCsv),{uploadIntent:'replace_current_basis'});
  await upload('Installed_Quantities.csv',Buffer.from(measurementCsv));
  return state.projectId;
 })();
 return cached;
}
const page=(id:string,key:string)=>moduleForProject(id,key).data as any;
const confirmed=(state:unknown)=>state==='established'||state==='partial';
// Each page that shows or gates on one of the four inputs, and which inputs.
const PAGES:Record<string,string[]>={
 'quantity-scurve':['quantities','installedQuantities'],'progress-breakdown':['quantities','installedQuantities'],'progress-report':['quantities','installedQuantities'],
 'challenge-contract':['quantities','installedQuantities'],'delivery-control':['quantities','installedQuantities'],'procurement-packages':['quantities','installedQuantities'],
 'material-tracking':['quantities','installedQuantities'],'long-lead':['quantities','installedQuantities'],
 'pmo-analysis':['cpmCoverage'],'schedule-analytics':['cpmCoverage'],'near-critical':['cpmCoverage'],'independent-forecast':['cpmCoverage'],
 'forecast-history':['cpmCoverage'],'recovery-acceleration':['cpmCoverage'],
 'activity-analytics':['disciplines'],'scope-classification':['disciplines'],'construction-discipline':['disciplines'],'resource-utilization':['disciplines'],
};

test('F07 shared prerequisites: the project facts state the four inputs counted from the uploaded files',async t=>{
 const id=await reemCase(),inputs=(projectFactsForState(runtimeProjects.get(id)!) as any).inputs;
 t.diagnostic(JSON.stringify({quantities:inputs?.quantities,installedQuantities:inputs?.installedQuantities,cpmCoverage:inputs?.cpmCoverage,disciplines:inputs?.disciplines}));
 const q=inputs.quantities;
 assert.deepEqual([q.state,q.sourceState,q.boqItemCount,q.readableQuantityItemCount,q.unitItemCount,q.readableItemCount,q.unreadableItemCount],
  ['partial','source',6,5,5,4,2],'6 items; 2.003 has no unit and 3.001 no quantity');
 const m=inputs.installedQuantities;
 assert.deepEqual([m.state,m.boqItemCount,m.measuredItemCount,m.unmeasuredItemCount,m.sourceRowCount,m.matchedRowCount,m.unresolvedRowCount,m.futureRowCount],
  ['partial',6,3,3,5,4,1,1],'3 of 6 items measured by the Data Date; one row matches no item; one row is after the Data Date');
 assert.equal(m.itemCoveragePercent,50);
 const d=inputs.disciplines;
 assert.deepEqual([d.state,d.activityCount,d.groupedActivityCount,d.activityCodeActivityCount,d.nameRuleActivityCount,d.notGroupedActivityCount,d.disciplineCount],
  ['partial',5,4,1,3,1,3]);
 assert.deepEqual(d.disciplines.map((r:any)=>[r.value,r.activityCount,r.activityCodeActivityCount,r.nameRuleActivityCount]),
  [['Civil',2,0,2],['ELEC',1,1,0],['Electrical',1,0,1]],'Civil from the WBS name, ELEC from the Discipline code, Electrical from "switchgear"; the milestone matches none');
 const c=inputs.cpmCoverage;
 assert.equal(c.publishable,false,'the CMeng CPM finish (19 Sep) differs from the submitted finish (22 Sep): not publishable');
 assert.ok(c.holdReasons.length>0,'the reason it is not publishable is stated');
 assert.equal(c.calculatedActivityCount+c.unresolvedActivityCount,c.activityCount);
 assert.notEqual(c.state,'established');
});

test('F07 shared prerequisites: every page that shows or gates on these inputs carries the project facts status',async()=>{
 const id=await reemCase(),inputs=(projectFactsForState(runtimeProjects.get(id)!) as any).inputs;
 for(const [key,names] of Object.entries(PAGES)){
  const data=page(id,key);
  for(const name of names){
   assert.ok(inputs?.[name],'the project facts state '+name);
   assert.deepEqual(data.inputStatus?.[name],inputs[name],key+' shows the shared '+name+' status');
  }
 }
});

test('F07 shared prerequisites: a page cannot show an input confirmed while another shows it missing',async()=>{
 const id=await reemCase(),state=runtimeProjects.get(id)!,facts=projectFactsForState(state) as any,inputs=facts.inputs;
 const quantity=page(id,'quantity-scurve'),challenge=page(id,'challenge-contract'),breakdown=page(id,'progress-breakdown'),delivery=page(id,'delivery-control');
 const prerequisite=(k:string)=>challenge.featureAvailability.prerequisites.find((p:any)=>p.key===k);
 const tracking=delivery.boqIntelligence.mappingCoverage.find((r:any)=>r.dimension==='quantity tracking');
 const forecast=page(id,'independent-forecast');
 // Progress Breakdown states BOQ items and measured items per area; the areas partition the BOQ.
 const areas=breakdown.decisionAnalysis.areas as any[],sum=(f:string)=>areas.reduce((n,a)=>n+a[f],0);
 const breakdownItems=sum('itemCount'),breakdownMeasured=sum('measuredItemCount');
 // Page against page first (what each screen states), then each page against the facts.
 const installedShown={quantities:['available','partial'].includes(quantity.installedQuantityStatus.state),challenge:prerequisite('remaining_quantities').established,
  breakdown:breakdownMeasured>0,delivery:tracking.mappedCount>0,facts:confirmed(inputs?.installedQuantities?.state)};
 assert.equal(new Set(Object.values(installedShown)).size,1,'installed quantities confirmed on one page are confirmed on all: '+JSON.stringify(installedShown));
 const boqShown={challenge:prerequisite('boq').established,quantities:quantity.boqItemCount>0,delivery:delivery.boqIntelligence.itemCount>0,facts:confirmed(inputs?.quantities?.state)};
 assert.equal(new Set(Object.values(boqShown)).size,1,'BOQ quantities confirmed on one page are confirmed on all: '+JSON.stringify(boqShown));
 const independentDays=facts.time.independentDaysAfterCurrentContract?.value;
 assert.equal(forecast.forecastReconciliationGate.publishable,independentDays!==null&&independentDays!==undefined,
  'the Completion Forecast publishes the CMeng finish only when the Dashboard does');
 // Installed quantities and BOQ quantities against the facts.
 assert.equal(quantity.installedQuantityStatus.measuredItemCount,inputs.installedQuantities.measuredItemCount,'Quantities measured items = facts');
 assert.equal(quantity.installedQuantityStatus.boqItemCount,inputs.quantities.boqItemCount);
 assert.equal(quantity.boqItemCount,inputs.quantities.boqItemCount,'Quantities BOQ items = facts');
 assert.equal(quantity.knownQuantityItemCount,inputs.quantities.readableQuantityItemCount,'Quantities readable quantities = facts');
 assert.equal(breakdownItems,inputs.quantities.boqItemCount,'Progress Breakdown BOQ items = facts');
 assert.equal(quantity.decisionAnalysis.quantities.measuredItemCount,inputs.installedQuantities.measuredItemCount,'Quantities decision analysis measured items = facts');
 assert.equal(breakdownMeasured,inputs.installedQuantities.measuredItemCount,'Progress Breakdown measured items = facts');
 assert.equal(delivery.boqIntelligence.itemCount,inputs.quantities.boqItemCount,'Delivery value mapping BOQ items = facts');
 assert.equal(tracking.mappedCount,inputs.installedQuantities.measuredItemCount,'Delivery quantity tracking = facts');
 // CPM coverage and publication against the facts.
 const cpm=inputs.cpmCoverage;
 for(const key of ['schedule-analytics','near-critical'])assert.equal(page(id,key).independentCpmState,cpm.calculationComplete?'established':'not_established',key+' CPM state = facts');
 assert.equal(page(id,'pmo-analysis').schedule.independentCpmState,cpm.calculationComplete?'established':'not_established','Management Brief CPM state = facts');
 assert.equal(page(id,'pmo-analysis').forecast.activityCoveragePercent,cpm.coveragePercent,'Management Brief CPM coverage = facts');
 assert.equal(forecast.activityCoveragePercent,cpm.coveragePercent,'Completion Forecast CPM coverage = facts');
 assert.equal(forecast.calculatedActivityCount,cpm.calculatedActivityCount);
 assert.equal(forecast.forecastReconciliationGate.publishable,cpm.publishable,'Completion Forecast publication = facts');
 assert.equal(forecast.managementReviewState,cpm.publishable?'accepted_for_analysis':'review_required');
 // Discipline list: filters, Construction by discipline, schedule breakdowns.
 const values=inputs.disciplines.disciplines.map((r:any)=>r.value);
 const filters=activityRegisterView(page(id,'activity-analytics')).activitySummary.filterOptions.discipline;
 assert.deepEqual([...filters].sort(),[...values].sort(),'Activity filter disciplines = facts');
 const construction=page(id,'construction-discipline').rows.filter((r:any)=>r.dimension==='discipline');
 const byLabel=new Map<string,number>();for(const r of construction)if(r.label!=='Unclassified')byLabel.set(r.label,(byLabel.get(r.label)??0)+r.activityCount);
 assert.deepEqual([...byLabel].sort(),inputs.disciplines.disciplines.map((r:any)=>[r.value,r.activityCount]).sort(),'Construction by discipline = facts');
 assert.equal(construction.find((r:any)=>r.label==='Unclassified')?.activityCount??0,inputs.disciplines.notGroupedActivityCount);
 const groups=page(id,'scope-classification').dimensionGroups.discipline;
 assert.equal(groups.valueCount,inputs.disciplines.disciplineCount,'schedule breakdowns discipline count = facts');
 assert.equal(groups.notGrouped.activityCount,inputs.disciplines.notGroupedActivityCount);
});
