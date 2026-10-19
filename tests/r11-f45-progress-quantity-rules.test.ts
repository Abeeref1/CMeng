import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectDecisionFacts} from '../packages/runtime-api/src/project-decision-facts';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {reportingState} from '../packages/runtime-api/src/reporting-state';
import {assessQuantityMapping} from '../packages/quantity-progress-core/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F45 (consultant R5 step 4): progress and quantity rules. The consultant's
// check on the REEM file: "Villa Type B progress shown separately; 132 LS items
// queried; installed value vs 184.26M certified". The REEM file is not in the
// repository, so this project reproduces the same case through the real upload
// path: a Villa Type B area, lump-sum items with fractional quantities, and
// whole-project interim certificates.

const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tREEM-F45\t2031-08-31 08:00',
 '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,
 '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\tW0\t1\t\tRV\tReem Villas','%R\tW1\t1\tW0\tINF\tInfrastructure','%R\tW2\t1\tW0\tVTB\tVilla Type B',
 '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tact_start_date\tact_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
 '%R\t1\t1\tW1\t1\tINF-100\tExcavation and pipework\tTK_Complete\t2031-01-05 08:00\t2031-06-30 16:00\t2031-01-05 08:00\t2031-06-30 16:00\t1200\t0\t0',
 '%R\t2\t1\tW2\t1\tVTB-100\tVilla Type B blockwork and plaster\tTK_Active\t2031-05-01 08:00\t\t2031-05-01 08:00\t2032-03-31 16:00\t1600\t1600\t-40',
 '%R\t3\t1\tW2\t1\tVTB-200\tVilla Type B MEP and fit-out\tTK_NotStart\t\t\t2031-10-01 08:00\t2032-06-30 16:00\t1600\t1600\t-40','%E'].join('\n');
// Item numbers repeat per bill (1.001 in Infrastructure and in General); the
// measurement file is per BOQ section, as in the consultant's source.
const boqCsv='Item No,Section,Description,Unit,Quantity,Rate,Amount,Currency,VAT Basis\n'+
 '1.001,Infrastructure,Excavation,m3,10000,25,250000,AED,Exclusive\n'+
 '1.002,Infrastructure,Pipework,m,5000,120,600000,AED,Exclusive\n'+
 '1.008,Infrastructure,Preliminaries,LS,41.908,597.23,25028.71,AED,Exclusive\n'+
 '2.001,Villa Type B,Blockwork,m2,8000,60,480000,AED,Exclusive\n'+
 '2.002,Villa Type B,Internal plaster,m2,16000,30,480000,AED,Exclusive\n'+
 '2.003,Villa Type B,MEP first fix,LS,1,200000,200000,AED,Exclusive\n'+
 '2.004,Villa Type B,Kitchen fit-out,LS,2.25,40000,90000,AED,Exclusive\n'+
 '2.005,Villa Type B,Doors,nr,120,1500,180000,AED,Exclusive\n'+
 '1.001,General,Site clearance,m3,2000,5,10000,AED,Exclusive\n'+
 'GEN.001,General,Site establishment,LS,1,100000,100000,AED,Exclusive\n'+
 'GEN.002,General,Testing and commissioning,LS,0.5,50000,25000,AED,Exclusive';
const measured:Array<[string,string,string,number,number]>=[
 ['1.001','Infrastructure','m3',10000,10000],['1.002','Infrastructure','m',4800,5000],['1.008','Infrastructure','LS',41.908,41.908],
 ['2.001','Villa Type B','m2',5000,6000],['2.002','Villa Type B','m2',6000,8000],['2.003','Villa Type B','LS',0.2,0.4],['2.004','Villa Type B','LS',1,1.5],
 ['1.001','General','m3',2000,2000],['GEN.001','General','LS',1,1],['GEN.002','General','LS',0.5,0.5]];
const measurementCsv='Measurement Date,Item No,Section,Unit,Cumulative Installed Qty,Certificate No,Certification Date,Certified Quantity,Certified Value,Certified Amount Basis,Currency\n'+
 measured.flatMap(([item,section,unit,july,august])=>[
  ['2031-07-31',item,section,unit,july,'','','','','',''].join(','),
  // One item-level certified record: a lump sum certified at 0.6 of its quantity.
  ['2031-08-31',item,section,unit,august,...(item==='GEN.001'?['IPC-023','2031-08-30','0.6','60000','cumulative','AED']:['','','','','',''])].join(','),
 ]).join('\n');
const certificatesCsv='Certificate No,Period End,Certificate Date,Gross Work,Variations,Retention,Advance Recovery,Net Certified,Currency,VAT Basis,Status,Certified Amount Basis\n'+
 'IPC-021,2031-06-30,2031-07-05,700000,0,70000,0,630000,AED,Exclusive,Certified,incremental\n'+
 'IPC-022,2031-07-31,2031-08-05,500000,0,50000,0,450000,AED,Exclusive,Certified,incremental\n'+
 'IPC-023,2031-08-25,2031-08-30,450000,0,45000,0,405000,AED,Exclusive,Certified,incremental';

async function contractPdf(){
 const lines=['CONSTRUCTION CONTRACT','1 Contract Particulars','Contract currency is AED.','Accepted Contract Amount: AED 2440028.71.',
  'Original Contract Value: AED 2440028.71.','Contractual completion date: 2032-06-30.','2 Certification and Payment',
  'The Engineer shall certify within 7 calendar days.','Payment shall be made within 28 calendar days after certification.'];
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([595,842]);
 page.drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
 return Buffer.from(await pdf.save());
}

let cached:Promise<string>|null=null;
function reemCase(){
 cached??=(async()=>{
  const state=runtimeProjects.getOrCreate('R11-F45-'+randomUUID());
  const upload=(name:string,bytes:Buffer,extra:Record<string,unknown>={})=>runtimeProjects.ingestEvidenceFile({projectId:state.projectId,bytes,
   mediaType:name.endsWith('.pdf')?'application/pdf':name.endsWith('.xer')?'text/plain':'text/csv',sourceFilename:name,uploadedAt:'2031-09-01',...extra} as any);
  await upload('Current_Programme.xer',Buffer.from(programme),{uploadIntent:'replace_current_basis'});
  await upload('Main_Works_Contract.pdf',await contractPdf());
  await upload('BOQ.csv',Buffer.from(boqCsv));
  await upload('Installed_Quantities.csv',Buffer.from(measurementCsv));
  await upload('Payment_Certificates.csv',Buffer.from(certificatesCsv));
  return state.projectId;
 })();
 return cached;
}
// Read by name so this file also compiles against the unfixed base (probe run).
const {likeForLikeDifference}=require('../packages/runtime-api/src/commercial-sum-basis') as Record<string,any>;
const {lumpSumQuantityQuery}=require('../packages/quantity-progress-core/src') as Record<string,any>;
const near=(actual:unknown,expected:number,message:string)=>{assert.equal(typeof actual,'number',message+': '+JSON.stringify(actual));assert.ok(Math.abs((actual as number)-expected)<=1e-6*Math.max(1,Math.abs(expected)),message+': '+actual+' vs '+expected);};

test('F45 progress by area: Villa Type B is its own row with installed %, installed value and certified value; the not-mapped part is shown',async()=>{
 const id=await reemCase(),state=runtimeProjects.get(id)!;
 const q:any=projectDecisionFacts(reportingState(state)).quantities;
 const area=(name:string)=>q.areas.find((a:any)=>a.area===name&&a.currency==='AED');
 const villa=area('Villa Type B');
 assert.ok(villa,'Villa Type B area row: '+JSON.stringify(q.areas.map((a:any)=>[a.area,a.itemCount])));
 assert.equal(villa.mapped,true);assert.equal(villa.itemCount,5);assert.equal(villa.measuredItemCount,4);
 near(villa.contractValue,1_430_000,'Villa Type B priced scope');
 near(villa.installedValue,740_000,'Villa Type B installed value = installed quantity x rate');
 near(villa.installedPercent,740_000/1_430_000*100,'Villa Type B % installed (value basis)');
 assert.equal(villa.certifiedValue,null,'whole-project certificates are not apportioned to an area');
 const infra=area('Infrastructure');
 assert.ok(infra);assert.equal(infra.itemCount,3);near(infra.installedValue,875_028.71484,'Infrastructure installed value');
 const unmapped=q.areas.find((a:any)=>!a.mapped);
 assert.deepEqual([unmapped.area,unmapped.itemCount],['Area not recorded',3]);
 near(unmapped.installedValue,135_000,'not-mapped part installed value');
 near(unmapped.certifiedValue,60_000,'item-level certified value in the not-mapped part');
 const r=q.areaReconciliation.byCurrency.find((x:any)=>x.currency==='AED');
 assert.deepEqual([r.totalItemCount,r.mappedItemCount,r.unmappedItemCount,r.addsUp],[11,8,3,true]);
 // Progress Breakdown carries the same area rows; its WBS row reads the same %.
 const breakdown:any=moduleForProject(id,'progress-breakdown').data;
 const shown=breakdown.decisionAnalysis.areas.find((a:any)=>a.area==='Villa Type B');
 assert.equal(shown.installedValue,villa.installedValue);assert.equal(shown.installedPercent,villa.installedPercent);
 const wbsRow=breakdown.dimensionViews.find((v:any)=>v.dimension==='wbs').rows.find((row:any)=>row.groupLabel==='Villa Type B');
 assert.equal(wbsRow.physicalMeasuredPercent,villa.physicalProgressPercent,'the WBS row shows the Villa Type B measured %');
 // The Progress page shows the same area rows separately (summary; detail on Progress Breakdown).
 const progress:any=moduleForProject(id,'progress-report').data.measuredProgressByArea;
 assert.ok(progress,'Progress page carries progress by area');
 const row=progress.rows.find((a:any)=>a.area==='Villa Type B');
 assert.equal(row.installedValue,villa.installedValue);assert.equal(row.installedPercent,villa.installedPercent);assert.equal(row.certifiedValue,null);
 assert.ok(progress.rows.some((a:any)=>a.area==='Area not recorded'&&a.mapped===false),'not-mapped part shown on the Progress page');
 assert.equal(progress.detailModule,'progress-breakdown');
});

test('F45 period and required rate: per item and per area, to the governing contract completion; unknown stays unknown',async()=>{
 const id=await reemCase(),state=runtimeProjects.get(id)!;
 const scoped=reportingState(state),q:any=projectDecisionFacts(scoped).quantities;
 const governing=projectFactsForState(state).time.governingContractCompletionIso?.value??null;
 assert.equal(governing,'2032-06-30','contract completion read from the uploaded contract');
 const item=(n:string,s:string)=>q.items.find((r:any)=>r.itemNumber===n&&r.section===s);
 const plaster=item('2.002','Villa Type B');
 assert.equal(plaster.periodInstalledQuantity,2000);assert.equal(plaster.periodStartIso,'2031-07-31');assert.equal(plaster.periodEndIso,'2031-08-31');
 assert.equal(plaster.contractCompletionIso,'2032-06-30');assert.equal(plaster.daysToContractCompletion,304);
 near(plaster.requiredRateToContractCompletionPerCalendarDay,8000/304,'remaining 8,000 m2 over 304 calendar days');
 near(plaster.installedPercent,50,'% installed per item');
 const doors=item('2.005','Villa Type B');
 assert.equal(doors.installedQuantity,null);assert.equal(doors.requiredRateToContractCompletionPerCalendarDay,null,'no measurement: required rate unknown, never 0');
 const excavation=item('1.001','Infrastructure');
 assert.equal(excavation.installedQuantity,10000,'section-specific measurement resolves a repeated item number');
 assert.equal(item('1.001','General').installedQuantity,2000);
 assert.equal(excavation.requiredRateToContractCompletionPerCalendarDay,0,'complete item: nothing remains');
 const villa=q.areas.find((a:any)=>a.area==='Villa Type B');
 near(villa.periodInstalledValue,180_000,'Villa Type B value installed in the last period');
 assert.equal(villa.periodStartIso,'2031-07-31');assert.equal(villa.periodEndIso,'2031-08-31');assert.equal(villa.periodItemCount,4);
 near(villa.remainingValue,510_000,'remaining value of the measured Villa Type B items');
 near(villa.requiredValuePerCalendarDay,510_000/304,'Villa Type B required value per calendar day');
 assert.equal(villa.requiredRateItemCount,4);
 // Without a contract completion the required rate stays unknown.
 const noContract=runtimeProjects.getOrCreate('R11-F45-NOCONTRACT-'+randomUUID());
 const up=(name:string,content:string,extra:Record<string,unknown>={})=>runtimeProjects.ingestEvidenceFile({projectId:noContract.projectId,bytes:Buffer.from(content),mediaType:name.endsWith('.xer')?'text/plain':'text/csv',sourceFilename:name,uploadedAt:'2031-09-01',...extra} as any);
 await up('Current_Programme.xer',programme,{uploadIntent:'replace_current_basis'});await up('BOQ.csv',boqCsv);await up('Installed_Quantities.csv',measurementCsv);
 const other:any=projectDecisionFacts(reportingState(noContract)).quantities;
 const p2=other.items.find((r:any)=>r.itemNumber==='2.002');
 assert.equal(p2.periodInstalledQuantity,2000);assert.equal(p2.contractCompletionIso,null);assert.equal(p2.requiredRateToContractCompletionPerCalendarDay,null);
 assert.equal(other.areas.find((a:any)=>a.area==='Villa Type B').requiredValuePerCalendarDay,null);
});

test('F45 lump-sum items with a fractional contract, installed or certified quantity are queried with their count, never summed with other units',async()=>{
 const id=await reemCase(),state=runtimeProjects.get(id)!;
 const q:any=projectDecisionFacts(reportingState(state)).quantities;
 const queries=q.lumpSumQueries;
 assert.equal(queries.count,5,JSON.stringify(queries.rows.map((r:any)=>[r.itemNumber,r.reasons])));
 const by=new Map(queries.rows.map((r:any)=>[r.itemNumber+'|'+r.section,r]));
 assert.deepEqual((by.get('1.008|Infrastructure') as any).reasons.sort(),['contract_quantity_not_1','installed_quantity_not_0_or_1']);
 assert.deepEqual((by.get('2.003|Villa Type B') as any).reasons,['installed_quantity_not_0_or_1']);
 assert.deepEqual((by.get('2.004|Villa Type B') as any).reasons.sort(),['contract_quantity_not_1','installed_quantity_not_0_or_1']);
 assert.deepEqual((by.get('GEN.001|General') as any).reasons,['certified_quantity_not_0_or_1']);
 assert.equal((by.get('GEN.001|General') as any).certifiedQuantity,0.6);
 assert.deepEqual((by.get('GEN.002|General') as any).reasons.sort(),['contract_quantity_not_1','installed_quantity_not_0_or_1']);
 // The Quantities page reads the same shared query list and count.
 const page:any=moduleForProject(id,'quantity-scurve').data;
 assert.equal(page.decisionAnalysis.quantities.lumpSumQueries.count,5);
 // Every quantity curve is one BOQ item in one unit; no total adds different items or units.
 assert.ok(page.series.length>=11&&page.series.every((s:any)=>s.itemCount===1),'per-item curves only');
 const ls=page.series.find((s:any)=>s.itemNumber==='1.008');
 assert.equal(ls.unit,'LS');assert.equal(ls.knownContractQuantity,41.908,'the LS quantity stays on its own item');
 const plaster=page.series.find((s:any)=>s.itemNumber==='2.002');
 assert.equal(plaster.latestInstalledQuantity,8000);assert.equal(plaster.installedPercent,50,'% installed on the item curve');
 // Area and project totals are money per currency only: no quantity field is summed across items.
 for(const row of [...q.areas,...q.installedVsCertified])for(const [key,value] of Object.entries(row))
  if(typeof value==='number')assert.doesNotMatch(key,/quantity/i,'area/project totals carry no cross-item quantity sum: '+key);
 // The shared rule, on its own.
 assert.deepEqual(lumpSumQuantityQuery({unit:'L.S.',contractQuantity:1},{installedQuantity:1,certifiedQuantity:0}).reasons,[]);
 assert.deepEqual(lumpSumQuantityQuery({unit:'Lump Sum',contractQuantity:1},{installedQuantity:0.25,certifiedQuantity:null}).reasons,['installed_quantity_not_0_or_1']);
 assert.deepEqual(lumpSumQuantityQuery({unit:'m2',contractQuantity:0.5},{installedQuantity:0.5,certifiedQuantity:0.5}).reasons,[],'only lump-sum units are queried');
 // A mapping assessment over different units publishes no summed quantity.
 const mixed=assessQuantityMapping({projectId:'P',boqRevisionId:'B',scheduleRevisionId:'S',diagnostics:[],installedSnapshots:[],
  items:[{quantityItemId:'a',itemNumber:'1',section:null,description:'A',unit:'m',contractQuantity:10,sourceRefs:[],diagnostics:[]},{quantityItemId:'b',itemNumber:'2',section:null,description:'B',unit:'LS',contractQuantity:0.5,sourceRefs:[],diagnostics:[]}],
  allocations:[{allocationId:'x',quantityItemId:'a',activityId:'A',allocatedQuantity:10,sourceRefs:[]}]});
 assert.equal(mixed.totalKnownContractQuantity,null);assert.equal(mixed.mappedQuantity,null);assert.equal(mixed.mappingCoveragePercent,null);
 assert.equal(mixed.knownQuantityItemCount,2,'counts remain');
});

test('F45 installed value against certified gross work: same currency and tax basis, with the difference',async()=>{
 const id=await reemCase(),state=runtimeProjects.get(id)!;
 const q:any=projectDecisionFacts(reportingState(state)).quantities;
 const aed=q.installedVsCertified.find((r:any)=>r.currency==='AED');
 assert.ok(aed,JSON.stringify(q.installedVsCertified));
 near(aed.installedValue,1_750_028.71484,'installed quantity x BOQ rate over every measured item');
 assert.equal(aed.measuredItemCount,10);assert.equal(aed.installedTaxBasis,'exclusive');
 near(aed.certifiedGrossWork,1_650_000,'gross work certified to IPC-023');
 assert.equal(aed.certifiedTaxBasis,'exclusive');assert.equal(aed.certificateCount,3);assert.equal(aed.latestCertificateId,'IPC-023');
 near(aed.difference,100_028.71484,'installed less certified');
 assert.equal(aed.state,'established');assert.deepEqual(aed.queries,[]);
 assert.equal(aed.lumpSumQueryItemCount,5,'queried lump-sum items inside the installed value are counted');
 const page:any=moduleForProject(id,'quantity-scurve').data;
 assert.deepEqual(page.decisionAnalysis.quantities.installedVsCertified,q.installedVsCertified,'Quantities page shows the shared comparison');
 const progress:any=moduleForProject(id,'progress-report').data.measuredProgressByArea;
 assert.deepEqual(progress.installedVsCertified,q.installedVsCertified,'Progress page shows the same comparison');
 // The shared like-for-like rule.
 const side=(value:number|null,currency:string|null,taxBasis:string|null)=>({value,currency,taxBasis,records:'r'});
 assert.equal(likeForLikeDifference(side(10,'AED','exclusive'),side(4,'AED','exclusive')).difference,6);
 const unknownTax=likeForLikeDifference(side(10,'AED',null),side(4,'AED','exclusive'));
 assert.equal(unknownTax.state,'queried');assert.equal(unknownTax.difference,6);assert.equal(unknownTax.queries.length,1);
 const otherTax=likeForLikeDifference(side(10,'AED','inclusive'),side(4,'AED','exclusive'));
 assert.equal(otherTax.state,'not_comparable');assert.equal(otherTax.difference,null);
 assert.equal(likeForLikeDifference(side(10,'AED','exclusive'),side(4,'SAR','exclusive')).difference,null,'never across currencies');
 assert.equal(likeForLikeDifference(side(null,'AED','exclusive'),side(4,'AED','exclusive')).state,'not_established');
});

test('F45 pages render progress by area, period and required rate, lump-sum queries and installed against certified',()=>{
 const html=cmengUatHtml();
 for(const text of ['Required quantity / calendar day to contract completion','Period from','Installed % (value)','Period installed value',
  'Required value / calendar day to contract completion','Installed value against certified gross work','Progress by area',
  'lump-sum items need checking'])assert.ok(html.includes(text),text);
});

test('F45 TEMP fixture dump',async()=>{
 const id=await reemCase(),state=runtimeProjects.get(id)!;
 const q:any=projectDecisionFacts(reportingState(state)).quantities;
 console.log('DUMP_DOCS '+JSON.stringify(state.evidenceDocuments.map((d:any)=>[d.sourceFilename,d.documentType,d.basisState,d.category])));
 console.log('DUMP_CONTRACTS '+JSON.stringify(state.contractDocuments.map((d:any)=>[d.documentId,d.role])));
 const facts=projectFactsForState(state);
 console.log('DUMP_TIME '+JSON.stringify(facts.time.governingContractCompletionIso)+' '+JSON.stringify(facts.time.contractualCompletionIso));
 console.log('DUMP_ITEMS '+JSON.stringify(q.items.map((r:any)=>[r.itemNumber,r.section,r.unit,r.area,r.areaMappingState,r.contractQuantity,r.installedQuantity,r.periodInstalledQuantity,r.installedValue,r.certifiedValue,r.currency])));
 console.log('DUMP_AREAS '+JSON.stringify(q.areas.map((a:any)=>[a.area,a.currency,a.itemCount,a.measuredItemCount,a.contractValue,a.installedValue,a.physicalProgressPercent,a.certifiedValue])));
 console.log('DUMP_MEAS '+JSON.stringify((reportingState(state) as any).quantities?.measurementReview));
 const c:any=(require('../packages/runtime-api/src/commercial-runtime') as any).commercialPositionForState(reportingState(state));
 console.log('DUMP_CERT '+JSON.stringify((c.certificateProfile?.groups??[]).map((g:any)=>[g.currency,g.taxBasis,g.cumulativeBasis,g.certifiedTotals,g.certifiedCount])));
 const qs:any=moduleForProject(id,'quantity-scurve').data;
 console.log('DUMP_QQ '+JSON.stringify(qs.quantityQueries));
});
