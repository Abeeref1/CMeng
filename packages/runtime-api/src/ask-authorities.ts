import {phaseProgrammePosition} from './phase-programmes';
import {askScheduleActivities,askCriticalPath} from './ask-schedule';
import {askProjectDiagnosis} from './ask-diagnosis';
import {AuthorityCatalogue} from '../../project-ask/src/catalogue';
import type {AnalysisPlan,AuthorityResult,Column,Domain,ProjectScope} from '../../project-ask/src/types';
import {cell,label} from '../../project-ask/src/primitives';
import {AuthorityBuilder,at,evidenceState} from './ask-authority-builder';
import {moduleRegistry} from './registry';
import {moduleForProject} from './project-projections';
import {resolveBoqSource,suppliedBoqFigures,suppliedBoqReportedTotals} from './boq-source';
import {projectControlSchedule} from './canonical-time-claims';
import {deliveryPosition,deliveryModule} from './delivery-projections';
import {isDeliveryPage} from '../../delivery-core/src/registry';
import {projectScheduleControlBasis} from './schedule-control-basis';
import type {ProjectRuntimeState} from './project-state-types';

export interface AskProducerContext {state:ProjectRuntimeState}
const percent:Partial<Column>={type:'number',unit:'%',aggregate:'none'};
const quantity:Partial<Column>={type:'number',unit:'row unit',aggregate:'sum'};
const money:Partial<Column>={type:'number',unit:'row currency',aggregate:'sum'};
const overrides:Record<string,Partial<Column>>={
  quantity,required:quantity,ordered:quantity,delivered:quantity,accepted:quantity,installed:quantity,manufactured:quantity,
  remainingToOrder:quantity,remainingToDeliver:quantity,remainingToInstall:quantity,amount:money,packageValue:money,
  scheduleProgressPercent:percent,plannedPercent:percent,actualPercent:percent,percentComplete:percent,baselinePlannedPercent:percent,currentForecastPercent:percent,actualProgressPercent:percent,
  currentPlanPercent:percent,durationWeightedProgressPercent:percent,deliveryCoveragePercent:percent,installationCompletionPercent:percent,
  progressPercent:percent,plannedCumulativeHours:{unit:'hours'},actualCumulativeHours:{unit:'hours'},forecastCumulativeHours:{unit:'hours'},procurementCoveragePercent:percent,headroomCalendarDays:{unit:'calendar days'},totalFloatHours:{unit:'hours'},
  discipline:{dimension:true},location:{dimension:true},wbsId:{dimension:true},dateIso:{type:'date'},
};
type Registration={id:string;concepts:string[];metrics?:[string,string,string|null][];tables?:string[];domains?:Domain[]};
/** Registration metadata belongs to each producer, not to question-specific branches. */
const registrations:Record<string,Registration>={
  'master-dashboard':{id:'master-dashboard',concepts:['kpi dashboard','executive summary','kpi','key figures','project status','project position'],tables:['scheduleExceptions.rows']},
  'command-center':{id:'command-center',concepts:['management action','director','meeting','what killing','urgent'],tables:['decisions','evidenceGaps']},
  'master-control-programme':{id:'master-control-programme',concepts:['programme control','project history','joined'],tables:['controlHistory','specialistPositions']},
  'source-quality':{id:'source-quality',concepts:['missing evidence','information gaps','evidence gaps'],tables:['sourceIssues','reviewActions','pendingChecks']},
  'pmo-analysis':{id:'pmo-analysis',concepts:['management brief','executive brief'],metrics:[['forecast.sourceCompletionIso','Submitted completion',null],['forecast.independentCompletionIso','Calendar recalculation completion',null],['progress.durationWeightedProgressPercent','Schedule snapshot','%'],['claims.officialApprovedEotDays','Approved EOT','calendar days']]},
  'challenge-contract':{id:'challenge-contract',concepts:['challenge the contract','contract challenge'],tables:['deliveryChallenge.findings','boqFeasibility.rows','contractIntelligence.signals']},
  'schedule-analytics':{id:'programme',concepts:['programme','schedule position','data date','reporting date','program','البرنامج','تاريخ البيانات'],metrics:[['result.activityCount','Execution activities','activities'],['result.float.criticalCount','Critical execution activities','activities']]},
  'activity-analytics':{id:'activities',concepts:['activities','activity','critical activities','انشطه'],tables:['rows']},
  'near-critical':{id:'float',concepts:['critical','float','worst','حرج'],metrics:[['nearCriticalCount','Strict near-critical activities','activities'],['negativeFloatCount','Negative float activities','activities'],['classificationCoveragePercent','Float classification coverage','%']],tables:['rows']},
  'progress-report':{id:'progress',concepts:['current completion','completion percentage','progress','behind','slippage','التقدم','انجاز']},
  'progress-breakdown':{id:'wbs',concepts:['wbs','by trade','work breakdown'],tables:['rows']},
  'progress-scurve':{id:'progress-curve',concepts:['progress curve','s-curve','s curve','progress chart'],tables:['points','actualSnapshots']},
  'quantity-scurve':{id:'quantities',concepts:['installed','installed quantity','quantity progress','quantities','quantity completion','كميات']},
  'resource-utilization':{id:'resources',concepts:['resources','labour','labor','manpower','crew','عماله'],tables:['rows','weeklyRows']},
  'manhour-scurve':{id:'manhours',concepts:['manhour','man-hour','man hour','ساعات العمل'],tables:['points']},
  'lookahead-schedule':{id:'lookahead',concepts:['lookahead','look-ahead','next week'],tables:['rows','activities']},
  'schedule-change-report':{id:'programme-changes',concepts:['changed','change since','previous update','programme change'],tables:['changedActivities','changeCategories'],metrics:[['matchedActivityCount','Matched activities','activities'],['addedActivityCount','Added activities','activities'],['removedActivityCount','Removed activities','activities'],['executionModifiedActivityCount','Changed execution activities','activities']]},
  'revision-trend':{id:'revision-history',concepts:['history','revisions','revision','joined','تاريخ المشروع'],tables:['points']},
  'milestones':{id:'milestones',concepts:['milestone','المعالم'],tables:['rows']},
  'variance-trends':{id:'variance',concepts:['variance trend','movement'],tables:['rows','points']},
  'forecast-history':{id:'forecast-history',concepts:['completion history','forecast history'],tables:['rows','revisions','points']},
  'independent-forecast':{id:'forecast',concepts:['forecast','finish','completion date','cpm','التوقع','الانتهاء'],metrics:[['sourceForecastCompletionIso','Submitted programme finish',null],['independentForecastCompletionIso','Calendar recalculation finish',null],['sourceProductivityForecastCompletionIso','Source productivity forecast finish',null],['activityCoveragePercent','Calculation activity coverage','%']]},
  'cost-forecast':{id:'evm',concepts:['cpi','spi','evm','earned value','cost performance','ev','pv','ac','مؤشر التكلفه'],domains:['commercial']},
  'commercial-overview':{id:'commercial',concepts:['commercial','contract value','cost exposure','commercial kpi','التجاري'],domains:['commercial','claims']},
  'payments':{id:'payments',concepts:['paid','payment','certificate','certified','retention','دفع','مستخلص'],domains:['commercial']},
  'cash-flow':{id:'cash',concepts:['cash','cash flow','التدفق النقدي'],domains:['commercial'],tables:['focus.transactions','focus.cashFlowRegister.currencies']},
  'variations-change':{id:'variations',concepts:['variation','change order','تغيير'],domains:['commercial']},
  'commercial-claims-notices':{id:'financial-claims',concepts:['financial claim','claimed amount','money claim'],domains:['claims','commercial']},
  'contract-particulars-bonds':{id:'contract',concepts:['contract particulars','bonds','insurance','retention','العقد','ضمان'],domains:['commercial','claims']},
  'delay-claims':{id:'delay',concepts:['delay event','delay claim','تأخير'],domains:['claims','schedule'],tables:['events','rows']},
  'notices-claims':{id:'notices',concepts:['notice','claim notice','اخطار'],domains:['claims'],tables:['claimsReporting.current.notices']},
  'windows-analysis':{id:'windows',concepts:['windows analysis','concurrent','causation','time impact'],domains:['claims','schedule'],tables:['windows','rows']},
  'eot-assessment':{id:'eot',concepts:['eot','extension','claims','entitlement','تمديد'],domains:['claims','schedule'],metrics:[['officialApprovedEotDays','Approved EOT','calendar days'],['analyticalTimeImpactCandidateDays','Analytical time impact candidate — not entitlement','calendar days'],['officialAdjustedCompletionIso','Official adjusted completion',null]],tables:['windowCandidates']},
  'procurement-packages':{id:'procurement',concepts:['procurement','package','مشتريات','توريد'],domains:['delivery','commercial']},
  'material-tracking':{id:'materials',concepts:['material','ordered','delivered','installation','المواد','تسليم'],domains:['delivery','boq','schedule']},
  'long-lead':{id:'long-lead',concepts:['long lead','long-lead','transformer','lead time','latest order'],domains:['delivery','commercial','schedule']},
  'delivery-submittals':{id:'submittals',concepts:['submittal','approval','review duration','اعتماد']},
  'procurement-scurves':{id:'procurement-curves',concepts:['procurement curve','value curve','weighted procurement','procurement progress'],domains:['delivery','commercial']},
  'delivery-suppliers':{id:'suppliers',concepts:['supplier','subcontractor','مورد'],domains:['delivery','commercial']},
  'delivery-design':{id:'design',concepts:['design','rfi','technical approval','تصميم']},
  'construction-discipline':{id:'disciplines',concepts:['discipline','trade','construction matrix','mep']},
  'construction-locations':{id:'locations',concepts:['floor','location','zone','tower','building','طابق','موقع']},
  'construction-readiness':{id:'construction-readiness',concepts:['construction readiness','workfront','جاهزيه التنفيذ']},
  'procurement-readiness':{id:'procurement-readiness',concepts:['procurement readiness','جاهزيه التوريد']},
  'delivery-quality':{id:'quality',concepts:['quality','ncr','inspection','جوده']},
  'delivery-permits':{id:'permits',concepts:['permit','authority approval','تصريح']},
  'delivery-hse':{id:'hse',concepts:['hse','injury','injuries','safety','frequency rate','سلامه']},
  'delivery-commissioning':{id:'commissioning',concepts:['commissioning','testing','test pass','تشغيل']},
  'delivery-assets':{id:'assets',concepts:['asset','system handover','اصول']},
  'delivery-closeout':{id:'closeout',concepts:['snag','closeout','punch','closure']},
  'delivery-spares':{id:'spares',concepts:['spare','special tool','قطع غيار']},
  'handover-readiness':{id:'handover',concepts:['handover','accepted requirements','تسليم نهائي']},
  'delivery-weather':{id:'weather',concepts:['weather','disruption','طقس'],domains:['delivery','claims']},
  'delivery-risks':{id:'risks',concepts:['risk','what worry','مخاطر']},
};
const analyticFields=['recordId','reference','description','name','itemNumber','activityId','wbsId','discipline','location','floor','zone','supplier','unit','currency','taxBasis','status','state','amount','required','ordered','delivered','installed','deliveryCoveragePercent','totalFloatHours','headroomCalendarDays','programmeNeedDate','percentComplete','score'];
const scheduleFields=['schedulePressure','onDrivingNetwork','wbs','critical','criticality','floatRiskWatchlist','missedPlannedStart','finishOverdue','scheduleDelayed','startOverdueCalendarDays','finishOverdueCalendarDays','currentStartIso','currentFinishIso','finishVarianceDays','independentTotalFloatHours'];

function produceBoq({state}:AskProducerContext,scope:ProjectScope){
  const source=resolveBoqSource(state,scope.programmeRevision??''),figures=suppliedBoqFigures(source.boq,source.quantities);
  const status=source.selection.adoptedSource?source.boq?.complete?'established':'partial':source.selection.state==='candidate'?'candidate':'unavailable';
  const b=new AuthorityBuilder('boq','BOQ / Scope','boq',scope,status,source.selection.explanation);
  b.metric('items','Readable BOQ items',figures.itemCount,'items',figures.basis,{fact:true});
  b.table('items','BOQ items',figures.rows,figures.basis,overrides);
  const reported=suppliedBoqReportedTotals(state,source.selection.sourceDocumentId);
  if(reported.length){b.table('reported-totals','Source-stated summary totals',reported,'Explicit totals in the selected source. These are not sums of the recovered rows and must not be added to them.',overrides);for(const [i,r]of reported.entries())b.metric('reported-total-'+i,'Source-stated BOQ total · '+r.taxBasis.replaceAll('_',' '),r.amount,r.currency,r.basis,{fact:true,refs:r.sourceRefs});}
  const groups=new Map<string,{section:string;currency:string|null;itemCount:number;pricedCount:number;readableAmount:number;quantityKnown:number;sourceRefs:string[]}>();
  for(const row of figures.rows){const key=JSON.stringify([row.section,row.currency]),g=groups.get(key)??{section:row.section??'Section not supplied',currency:row.currency,itemCount:0,pricedCount:0,readableAmount:0,quantityKnown:0,sourceRefs:[]};g.itemCount++;if(typeof row.amount==='number'){g.pricedCount++;g.readableAmount+=row.amount;}if(typeof row.quantity==='number')g.quantityKnown++;g.sourceRefs.push(...row.sourceRefs);groups.set(key,g);}
  if(groups.size)b.table('scope-cost','Scope and readable cost by section',[...groups.values()].map(g=>({...g,readableAmount:g.pricedCount?Number(g.readableAmount.toFixed(2)):null})), 'Sum of readable line amounts only, separated by source section and currency. Partial coverage is not the complete section value; unpriced or included rows are not zero.',{...overrides,readableAmount:{unit:'row currency'},section:{dimension:true}});
  if(figures.rows.length)b.result.explanation=figures.rows.length+' BOQ item descriptions are readable; '+figures.rows.filter(r=>r.amount!==null).length+' have stated amounts and '+figures.rows.filter(r=>r.quantity!==null).length+' have aligned quantities. Scope and cost information are available without a programme. '+(!source.boq?.complete?'The complete item population and total reconciliation remain unconfirmed. ':'')+(source.selection.state==='candidate'?'This is a candidate source awaiting selection.':'');
  const currencies=[...new Set(figures.rows.map(r=>r.currency))];
  for(const currency of currencies){const rows=figures.rows.filter(r=>r.currency===currency),known=rows.filter(r=>typeof r.amount==='number');
    const total=currency&&source.selection.adoptedSource&&source.boq?.complete&&known.length===rows.length?known.reduce((n,r)=>n+r.amount!,0):null;
    b.metric('value-'+(currency??'unresolved'),'BOQ value · '+(currency??'currency unresolved'),total,currency,'Sum of selected BOQ item amounts within one currency. Complete item population and readable amounts required.',{refs:rows.flatMap(r=>r.sourceRefs)});
    if(known.length<rows.length)b.finding('missing-amounts-'+currency,'BOQ value coverage incomplete',known.length+' of '+rows.length+' item amounts are readable.','Reconcile the missing source quantities, rates and amounts.');
  }
  return b.result;
}
function deliveryAuthority(context:AskProducerContext,scope:ProjectScope,key:string,id:string,title:string):AuthorityResult{
  const result=deliveryModule(context.state,key),d:any=result.data,p=deliveryPosition(context.state);
  const b=new AuthorityBuilder(id,title,key,scope,evidenceState(result.status),result.reason??'');
  for(const m of d?.metrics??[])b.metric(m.label.toLowerCase().replace(/[^a-z0-9]+/g,'-'),m.label,m.value,m.unit,m.basis,{state:m.state});
  const packages=new Map(p.packageRows.map(r=>[r.recordId,r]));
  const rows=(d?.rows??[]).filter((r:any)=>!r.scope||r.scope==='current');
  b.table('rows',title,rows,'Current governed subset at the programme Data Date. '+(d?.population?.basis??''),overrides,(r:any)=>{
    const pack=packages.get(r.recordId);const locationIds=pack?.locationIds??r.links?.locationIds??[];
    const loc=locationIds.map((id:string)=>p.locations.find(l=>l.recordId===id)?.description??null);
    const statedType=String(r.fields?.['record type']??r.fields?.['quality type']??r.fields?.type??'').toLowerCase();const recordType=statedType||(Object.keys(r.fields??{}).some(k=>/^ncr (id|no|number)$/.test(k))?'ncr':null);
    return {...r,recordType,open:typeof r.currentStatus==='string'&&r.currentStatus!=='not_established'?!['closed','accepted','source_approved','passed'].includes(r.currentStatus):typeof r.status==='string'&&['open','closed'].includes(r.status)?r.status==='open':null,late:typeof r.overdue==='boolean'?r.overdue:typeof r.state==='string'?/^(late|overdue)$/i.test(r.state):null,displayState:r.state??r.currentStatus??r.permitStatus??r.readinessState??r.status??r.scope??null,discipline:r.discipline??pack?.discipline??(r.dimension==='discipline'?r.label:null),location:loc.length&&loc.every(Boolean)?loc.join('; '):r.dimension==='location'?r.name??r.label??null:null,
      critical:pack?.programmeFloat.length?pack.programmeFloat.every(a=>typeof a.totalFloatHours==='number')?pack.programmeFloat.some(a=>a.totalFloatHours!<=projectScheduleControlBasis(context.state).analysisConfig.criticalFloatThresholdHours):null:r.critical??null,
      programmeNeedDate:pack?.programmeNeedDate??r.programmeNeedDate??null,headroomCalendarDays:pack?.headroomCalendarDays??r.headroomCalendarDays??null,
      issueCount:(d?.findings??[]).filter((f:any)=>f.recordId===r.recordId).length};
  });
  const primary=b.result.tables[0];if(primary){primary.population=(d?.rows??[]).length;primary.excluded=primary.population-rows.length;}
  for(const f of d?.findings??[])b.finding(f.findingId??f.code+':'+f.recordId,f.code.replace(/_/g,' '),f.explanation??f.message??f.reason??'',f.action??'Review the source record.',{},[b.trace('record:'+f.recordId,'Delivery record '+f.recordId, f.receipts??[])]);
  for(const curve of d?.curves??[]){
    b.table('curve-'+curve.key,curve.kind==='throughput'?'Procurement Throughput':label(curve.kind)+' · '+curve.stage,curve.points,
      [curve.weighting,'Series '+curve.series,'Unit '+curve.unit,'Population '+curve.population.length,'Coverage '+String(curve.coveragePercent??'not established')].join('. '),{value:{unit:curve.unit},dateIso:{type:'date'}});
  }
  if(rows.length!==(d?.rows??[]).length)b.finding('dated-population','Future and undated rows excluded',((d?.rows??[]).length-rows.length)+' rows are outside the current reporting population.','Review future and undated records on the source page.');
  if(d?.population?.state!=='established')b.result.explanation+=' Complete register population is not confirmed; known rows are a subset.';
  return b.result;
}
function evmAuthority(b:AuthorityBuilder,d:any){
  const performance=d?.position?.performance;
  const positions=performance?.costControl?.positions??[];
  for(const [i,p] of positions.entries())for(const [key,name] of [['cpi','CPI'],['spi','SPI'],['ev','Earned value'],['pv','Planned value'],['ac','Actual cost']] as const){const v=p[key];b.metric(key+'-'+p.currency+'-'+p.taxBasis,name+' · '+p.currency+' · tax '+p.taxBasis,v?.value,key==='cpi'||key==='spi'?'ratio':p.currency,v?.basis??'Existing Commercial / EVM authority at Data Date.',{path:'position.performance.costControl.positions.'+i+'.'+key,state:v?.state,refs:v?.sourceRefs??[]});}
  if(!positions.length)for(const key of ['cpi','spi','ev','pv','ac'])b.metric(key,key.toUpperCase(),null,key==='cpi'||key==='spi'?'ratio':null,'Commercial EVM inputs and a compatible measurement population are not established.');
  for(const [i,series] of (performance?.evmPerformance?.series??[]).entries())b.table('evm-'+i,'EVM · '+series.currency,series.points,'Existing Commercial EVM time series; current and future positions retain their producer labels.',{},r=>Object.fromEntries(Object.entries(r).map(([k,v]:[string,any])=>[k,v&&typeof v==='object'?'value'in v?v.value:null:v])));
}
function moduleAuthority(context:AskProducerContext,scope:ProjectScope,key:string,registration:Registration,title:string):AuthorityResult{
  if(registration.id==='activities')return askScheduleActivities(scope);
  const result=moduleForProject(scope.projectId,key),d:any=result.data;
  const b=new AuthorityBuilder(registration.id,title,key,scope,evidenceState(result.status),result.reason??'Existing CMeng authority at the programme Data Date.');
  if(registration.id==='forecast'&&d?.completionPosition){
    const p=d.completionPosition;
    b.result.explanation=p.interpretation+' '+p.contractNote;
    for(const [id,name,value,unit] of [
      ['sourceForecastCompletionIso','Submitted programme finish',p.submittedFinishIso,null],['independentForecastCompletionIso','CMeng calendar recalculation',p.independentFinishIso,null],
      ['difference','Recalculation minus submitted finish',p.differenceElapsedDays,'elapsed calendar days'],['contract','Contractual completion',p.contractualFinishIso,null]
    ])b.metric(id,name,value,unit,p.differenceBasis,{state:id==='independentForecastCompletionIso'?p.calculationState:undefined,refs:[scope.programmeRevision??'']});
    for(const [path,name,unit] of registration.metrics??[])if(!b.result.metrics.some(m=>m.id===registration.id+'.'+path))b.metric(path,name,at(d,path),unit,'Existing '+title+' producer.',{path});
    b.table('position','Completion position',[{submittedFinish:p.submittedFinishIso,calendarRecalculation:p.independentFinishIso,calculationState:p.calculationState,differenceElapsedDays:p.differenceElapsedDays,contractualFinish:p.contractualFinishIso}],p.differenceBasis);
    for(const l of p.limitations)b.finding(l.key,'Calculation qualification',l.text,'Review this stated calculation assumption with the relevant programme record.');
    return b.result;
  }
  if(registration.id==='float'){
    const activities=askScheduleActivities(scope);
    b.result.tables=activities.tables.map(t=>({...t,id:'float.rows',authorityId:'float',title:'Activity float',traceId:'float:rows'}));
    b.trace('rows','Programme float in hours; all execution activities are queried before any requested threshold or Top N selection.',activities.traces.flatMap(t=>t.sourceRefs));
    b.result.explanation='Negative float shows pressure against schedule targets. It does not by itself prove that an activity missed its current start or finish date.';
    return b.result;
  }
  if(registration.id==='lookahead'){
    b.result.explanation='Upcoming and overdue work, with linked issues that may prevent work. A linked issue is not by itself proof of project delay causation.';
    b.table('rows','Work and linked issues',d?.rows,b.result.explanation,overrides,r=>({...r,
      linkedBlockers:(r.readiness?.dimensions??[]).filter((v:any)=>v.state==='blocked').map((v:any)=>v.key.replaceAll('_',' ')+': '+(v.note??'Linked issue needs review')).join('; ')||'No confirmed linked blocker',
      checksMissing:(r.readiness?.dimensions??[]).filter((v:any)=>v.state==='unknown').map((v:any)=>v.key.replaceAll('_',' ')).join('; '),
      sourceRefs:(r.readiness?.dimensions??[]).flatMap((v:any)=>v.sourceRefs??[])}));
    b.result.traces[0]!.sourceRefs=[...new Set<string>((d?.rows??[]).flatMap((r:any)=>(r.readiness?.dimensions??[]).flatMap((v:any)=>v.sourceRefs??[])))];
    return b.result;
  }
  for(const [path,name,unit] of registration.metrics??[])b.metric(path,name,at(d,path),unit,'Existing '+title+' producer.',{path});
  for(const path of registration.tables??[])if(Array.isArray(at(d,path)))b.table(path,title+' · '+label(path.split('.').at(-1)!),at(d,path),'Existing '+title+' producer. Its population, exclusions and calculation basis apply.',overrides,r=>({...r,late:typeof r.dueState==='string'&&r.dueState!=='unknown'?r.dueState==='overdue':null,critical:typeof r.critical==='boolean'?r.critical:typeof r.criticality==='string'?r.criticality==='unknown'?null:r.criticality==='critical':typeof r.totalFloatHours==='number'?r.totalFloatHours<=projectScheduleControlBasis(context.state).analysisConfig.criticalFloatThresholdHours:null}));
  if(registration.id==='programme'){
    b.metric('dataDate','Programme Data Date',scope.dataDate,null,'Selected programme authority.',{fact:true});
    const finish=d?.result?.completionBases?.find((c:any)=>c.basis==='forecast');b.metric('source-finish','Submitted programme completion',finish?.dateIso??null,null,finish?.method??'Selected programme source finish, as published by Programme Review.',{fact:true,refs:finish?.sourceRefs??[]});
  }
  for(const m of d?.metrics??d?.programmePosition??[])if(m&&typeof m==='object'&&m.label)b.metric(m.key,m.label,m.value,m.unit??null,m.basis??'Existing management authority.',{state:m.state});
  for(const f of d?.alerts??[])b.finding(f.alertId??f.title,f.title,f.consequence??'',f.action??'Review the source position.');
  if(registration.id==='progress'){
    for(const [name,p] of Object.entries(d?.progressBases??{}) as [string,any][])b.metric(name,label(name)+' progress',p.valuePercent,'%',p.authority+'; coverage '+(p.coveragePercent??'unresolved')+'%.',{path:'progressBases.'+name,state:p.state,refs:p.sourceRefs??[]});
    if(!b.result.metrics.length)b.metric('physical','Physical progress',null,'%','Measured physical progress is not established.');
  }
  if(registration.id==='evm')evmAuthority(b,d);
  if(['commercial','payments','variations','contract','financial-claims'].includes(registration.id)){
    const fields=registration.id==='payments'?['certifiedAmount','paidAmount','certifiedUnpaidAmount','retentionHeldAmount']:registration.id==='variations'?['approvedVariationAmount','pendingVariationAmount']:registration.id==='financial-claims'?['claimedAmount','assessedClaimAmount']:['originalContractValue','currentContractValue','approvedVariationAmount','paidAmount'];
    for(const [i,c]of(d?.position?.currencies??[]).entries())for(const name of fields){const m=c[name];b.metric(name+'-'+c.currency,label(name)+' · '+c.currency,m?.value,c.currency,m?.basis??'Existing Commercial authority; currency and temporal basis retained.',{path:'position.currencies.'+i+'.'+name,state:m?.state,refs:m?.sourceRefs??[]});}
    const table=registration.id==='payments'?'position.foundation.paymentRegister.rows':registration.id==='variations'?'position.contractControls.variations.rows':registration.id==='financial-claims'?'position.claimsNotices.claims':null;
    if(table)b.table('records',title,at(d,table),'Current records selected by the existing Commercial authority.',overrides);
  }
  if(registration.id==='quantities')for(const [i,s]of(d?.series??[]).entries()){
    b.metric('required-'+i,'Known contract quantity · '+s.unit,s.knownContractQuantity,s.unit,'Existing Installed Quantities authority; compatible BOQ unit group.');
    const latest=(s.points??[]).filter((p:any)=>typeof p.dateIso==='string'&&scope.dataDate&&p.dateIso.slice(0,10)<=scope.dataDate).at(-1);b.metric('installed-'+i,'Installed quantity · '+s.unit,latest?.actualInstalledQuantity??null,s.unit,'Existing Installed Quantities authority at the latest published point on or before the programme Data Date. '+s.actualAuthority);
    b.table('series-'+i,'Installed Quantities · '+s.unit,s.points,'Unit '+s.unit+'. '+s.actualAuthority+'. Actual item coverage '+(s.actualSnapshotItemCoveragePercent??'unresolved')+'%. '+s.actualHistoryMode,
      {baselinePlannedQuantity:{unit:s.unit},currentForecastQuantity:{unit:s.unit},actualInstalledQuantity:{unit:s.unit},dateIso:{type:'date'}});
  }
  if(!b.result.metrics.length&&!b.result.tables.length){
    // Newly registered modules can expose a compact typed Ask AI view without changing this pipeline.
    const view=d?.askAi;
    if(view){for(const m of view.metrics??[])b.metric(m.id,m.label,m.value,m.unit??null,m.basis,{refs:m.sourceRefs??[],state:m.state});for(const t of view.tables??[])b.table(t.id,t.title,t.rows,t.basis,t.columns??{});}
    else b.finding('adapter-gap','Detailed analytical fields not established',result.reason??'This producer has not registered detailed analytical fields.','Open the source page to inspect its established position.');
  }
  for(const diagnostic of (d?.diagnostics??[]).filter((s:unknown)=>typeof s==='string').slice(0,12))b.result.traces.forEach(t=>{t.exclusions.push(diagnostic);});
  return b.result;
}
export function createAskAuthorityCatalogue(){
  const catalogue=new AuthorityCatalogue<AskProducerContext>();
  catalogue.register({id:'project-diagnosis',title:'Project diagnosis',description:'Shared programme position, driving network, WBS pressure, revision changes and explicitly linked multi-domain evidence.',module:'pmo-analysis',domains:['schedule','delivery','commercial','claims','evidence'],concepts:['project diagnosis','finish drivers','why are we late'],fields:[...analyticFields,...scheduleFields,'schedulePressure','onDrivingNetwork','wbs'],historical:false,produce:(_context,scope,plan)=>askProjectDiagnosis(scope,plan)});
  catalogue.register({id:'critical-path',title:'Critical activities',description:'Calculated critical activities, or a clearly labelled source-float list when CPM is unavailable.',module:'independent-forecast',domains:['schedule'],concepts:['critical path','driving path'],fields:[...analyticFields,...scheduleFields],historical:false,produce:(_context,scope)=>askCriticalPath(scope)});
  catalogue.register({id:'boq',title:'BOQ / Scope',description:'Selected BOQ source quantities, item values and scope. No cross-currency sum.',module:'boq',domains:['boq','commercial'],concepts:['boq','scope','cost driver','cost distribution','bill of quantities','جدول الكميات'],fields:analyticFields,historical:false,produce:produceBoq});
  for(const module of moduleRegistry){
    const registration=registrations[module.key]??{id:module.key,concepts:[module.title.toLowerCase()]};
    const domains:Domain[]=registration.domains??(module.area==='delivery'?['delivery']:module.area==='commercial'?['commercial','claims']:module.area==='management'?['schedule','delivery','boq','commercial','claims','evidence']:module.category==='claims'||module.key==='challenge-contract'?['schedule','claims','commercial']:['schedule']);
    catalogue.register({id:registration.id,title:module.title,description:module.description,module:module.key,domains,concepts:registration.concepts,fields:['activities','float'].includes(registration.id)?[...analyticFields,...scheduleFields]:analyticFields,historical:false,
      produce:(context,scope)=>isDeliveryPage(module.key)?deliveryAuthority(context,scope,module.key,registration.id,module.title):moduleAuthority(context,scope,module.key,registration,module.title)});
  }
  catalogue.register({id:'productivity',title:'Productivity / Installation Rates',description:'Existing source productivity calculation with explicit scope and activity links.',module:'independent-forecast',domains:['schedule','boq'],concepts:['productivity','installation rate','productivity weak','انتاجيه'],fields:analyticFields,historical:false,produce:(context,scope)=>{
    const d:any=moduleForProject(scope.projectId,'independent-forecast').data,p=d?.sourceProductivityForecastEvidence??d?.sourceProductivityForecast;
    const b=new AuthorityBuilder('productivity','Productivity / Installation Rates','independent-forecast',scope,evidenceState(p?.state),p?.explanation??'Productivity needs measured quantities, periods, work scope and source rates.');
    b.table('rates','Source productivity work packages',p?.workPackages??p?.rows, 'Existing source productivity authority; never inferred from a schedule percentage.',overrides);return b.result;
  }});
  catalogue.register({id:'phase-programmes',title:'Phase Programme Positions',description:'Separate adopted programme positions for each project phase; no automatic whole-project roll-up.',module:'phase-programmes',domains:['schedule'],concepts:['phase','phases','next phase'],fields:['phaseId','dataDate','revisionId','activityCount','role','authorityState'],historical:false,produce:(context,scope,plan)=>{
    const all=(context.state.phaseProgrammes??[]).map(p=>phaseProgrammePosition(context.state,p.phaseId)),q=plan.objective.normalize('NFKC').toLowerCase(),matched=all.filter(p=>q.includes(p.phaseId.toLowerCase()));
    const selected=matched.length?matched:all,b=new AuthorityBuilder('phase-programmes','Phase Programme Positions','phase-programmes',scope,selected.length?'partial':'unavailable','Each row uses that phase’s adopted programme and Data Date. Whole-project metrics and evidence are not phase metrics. Phase commercial, Delivery and combined roll-up calculations are not established by uploading a programme.');
    b.table('positions','Phase programme authority',selected.map(p=>({phaseId:p.phaseId,authorityState:p.review.state,dataDate:p.programme?.dataDate??null,revisionId:p.programme?.revisionId??null,activityCount:p.programme?.activityCount??null,role:p.programme?.role??null,pendingRevisions:p.review.pendingSchedules.length})),b.result.explanation,{phaseId:{dimension:true},activityCount:{unit:'activities'}});return b.result;
  }});
  return catalogue;
}
