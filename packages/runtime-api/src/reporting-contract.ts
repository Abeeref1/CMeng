import {isAdoptedProgrammeRevision,isScenarioRevision,scheduleAuthorityReview} from './schedule-authority';
import {registerDateReview,scopeRegisterDateReview} from './register-date-review';
import { activityPopulation,calendarWorkingDayHours } from '../../schedule-analysis-core/src';
import { populationContract, partitionAsOf, type PopulationContract, type ReportingAuthority } from '../../truth-kernel/src';
import { projectControlSchedule, projectDataDate, canonicalTimeClaims } from './canonical-time-claims';
import { claimsReporting,scheduleActualReporting,operationalReporting } from './reporting-state';
import { createHash } from 'node:crypto';
import { projectScheduleControlBasis } from './schedule-control-basis';
import type { ProjectRuntimeState, ModuleRuntimeResult } from './project-state-types';

const sharedReportingContextCache=new WeakMap<ProjectRuntimeState,{version:number;dataDateIso:string|null;value:any}>();

type MetricSemanticContract={
  populationId:string|null;
  denominator:number|null;
  excludedCount:number;
  exclusionsRef:string|null;
  dataDateIso:string|null;
  authority:ReportingAuthority;
  dateBasis:string;
  unit:string|null;
  state:string|null;
  qualification:string|null;
};

/** Project-level reporting facts are identical for every module at one project
 * version. Build them once and let each module add only its owned populations
 * and metric contracts. This changes no authority or denominator semantics. */
function sharedReportingContext(state:ProjectRuntimeState){
  const dataDateIso=projectDataDate(state);
  const cached=sharedReportingContextCache.get(state);
  if(cached?.version===state.version&&cached.dataDateIso===dataDateIso)return cached.value;

  const authorityReview=scheduleAuthorityReview(state);
  const current=projectControlSchedule(state);
  const model=current?.revision.model;
  const operations=operationalReporting(state);
  const actuals=scheduleActualReporting(state);
  const basePopulations:Record<string,PopulationContract>={schedule_actual_events:actuals.population};

  if(model){
    for(const basis of ['source_records','execution_control','milestones','duration_weighted_progress'] as const)
      basePopulations[basis]=activityPopulation(model,basis).reporting;
    basePopulations.relationships=populationContract({
      name:'Source relationship records',entity:'relationship',dataDateIso,
      dateBasis:'current governed programme snapshot',sourceRevisionId:model.sourceRevisionId,authority:'source',
      sourceCount:model.relationships.length,
      memberIds:model.relationships.map((r,i)=>String(r.relationshipId??[r.predecessorActivityId,r.successorActivityId,r.type,r.lagHours,i].join(':'))),
      exclusions:[]
    });
  }

  const revisionScope=partitionAsOf(state.schedules.filter(s=>!isScenarioRevision(s)),{
    name:'Programme revisions by Data Date',entity:'programme_revision',dataDateIso,
    dateBasis:'programme Data Date or explicit revision effective date',
    id:r=>r.revision.revisionId,date:r=>r.revision.model.dataDateIso??r.revision.effectiveAt
  });
  basePopulations.revisions=revisionScope.population;

  const analysisConfig=projectScheduleControlBasis(state).analysisConfig;
  const calendarById=model?new Map(model.calendars.map(calendar=>[calendar.calendarId,calendar])):null;
  const executionActivities=model?activityPopulation(model).activities:[];
  const calendarUnresolvedActivityCount=model&&calendarById
    ? executionActivities.filter(activity=>calendarWorkingDayHours(activity.calendarId?calendarById.get(activity.calendarId):undefined)===null).length
    : null;
  const time=canonicalTimeClaims(state).contractTimeBasis??state.controls.contractTimeBasis;
  const baseline=state.schedules
    .filter(s=>isAdoptedProgrammeRevision(state,s)&&['baseline','revised_baseline'].includes(s.role)&&s.revision.model.dataDateIso&&dataDateIso&&s.revision.model.dataDateIso.slice(0,10)<=dataDateIso)
    .sort((a,b)=>(a.revision.model.dataDateIso??'').localeCompare(b.revision.model.dataDateIso??'')).at(-1);
  const value={
    authorityReview,current,model,dataDateIso,operations,actuals,basePopulations,
    claims:claimsReporting(state),
    resources:current?state.resourcesByRevision.get(current.revision.revisionId):null,
    dateReview:registerDateReview(state),
    analysisConfig,
    configurationId:createHash('sha256').update(JSON.stringify(analysisConfig)).digest('hex').slice(0,24),
    calendarUnresolvedActivityCount,time,baseline
  };
  sharedReportingContextCache.set(state,{version:state.version,dataDateIso,value});
  return value;
}

export function reportingData<T extends object>(state:ProjectRuntimeState,key:string,data:T):T & {reportingContract:Record<string,unknown>} {
  return attachReportingContract(state,{key,status:'partial',reason:null,dependencies:[],data}).data as T & {reportingContract:Record<string,unknown>};
}

/** Management reuses specialist population definitions; it cannot invent another
 * denominator when it promotes a specialist value into a management card. */
export function managementReportingData<T extends object>(state: ProjectRuntimeState, data: T, modules: Map<string, ModuleRuntimeResult>) {
  const result = reportingData(state, 'management-surfaces', data);
  const contract = result.reportingContract as any;
  const commercial = (modules.get('commercial-overview')?.data as any)?.reportingContract;
  Object.assign(contract.populations, commercial?.populations ?? {});
  const populations = contract.populations as Record<string, PopulationContract>;
  const record = data as any;
  for (const collection of ['metrics', 'programmePosition']) {
    for (const metric of record[collection] ?? []) {
      const key = metric.key as string;
      const population = /critical/.test(key) ? populations.execution_control : /claims/.test(key) ? populations.claims :
        key === 'progress-position' ? populations.duration_weighted_progress : key === 'schedule-spi' ? populations.commercial_positions : undefined;
      const path = collection + '[' + key + '].value';
      const populationKey = population ? Object.keys(populations).find(k => populations[k] === population) ?? null : null;
      const semantic = {
        populationId: population?.populationId ?? null,
        denominator: population?.denominator ?? null,
        excludedCount: population?.exclusions.length ?? 0,
        exclusionsRef: population && populationKey ? 'reportingContract.populations.' + populationKey + '.exclusions' : null,
        dataDateIso: contract.dataDateIso,
        authority: ['source','submitted','calculated','adjusted','official','scenario'].includes(metric.authority) ? metric.authority : 'calculated',
        dateBasis: population?.dateBasis ?? metric.basis,
        unit: metric.unit ?? null,
        state: metric.state ?? null,
        qualification: metric.basis ?? null,
      };
      if (population) contract.metricContracts[path] = semantic;
    }
  }
  for (const field of ['approvedVariationAmount', 'pendingVariationAmount', 'retentionDeductedAmount', 'retentionHeldAmount', 'certifiedUnpaidAmount', 'activeBondAmount']) {
    const sourcePath='position.currencies[*].' + field + '.value',targetPath='commercialByCurrency[*].' + field + '.value';
    const original = commercial?.metricContracts?.[sourcePath];
    if (original) contract.metricContracts[targetPath] = original;
  }
  return result;
}

/** Shared reporting metadata travels with the resolved payload to every consumer.
 * Population references are independent of UI pagination and retain excluded IDs.
 */
export function attachReportingContract(state:ProjectRuntimeState,result:ModuleRuntimeResult):ModuleRuntimeResult {
  const shared=sharedReportingContext(state);
  const {authorityReview,current,model,dataDateIso,operations,actuals}=shared;
  result={...result,scheduleAuthorityReview:authorityReview};
  // An unavailable calculation still has a project, version and authority context.
  // Keep its result blocked while publishing that shared context to its consumers.
  if(!result.data||typeof result.data!=='object')result={...result,data:{}};
  const data=result.data as any;
  const populations:Record<string,PopulationContract>={...shared.basePopulations};
  if(['project-director','board-report','management-surfaces','pmo-analysis','lookahead-schedule'].includes(result.key)) {
    populations.ncrs=operations.quality.population;populations.rfis=operations.rfi.population;populations.risks=operations.risk.population;
  }
  const register=(key:string,name:string,entity:string,rows:readonly any[],id:(r:any,i:number)=>string,dateBasis='current governed programme snapshot',authority:ReportingAuthority='source')=>{
    populations[key]=populationContract({name,entity,dataDateIso,dateBasis,sourceRevisionId:model?.sourceRevisionId??null,authority,sourceCount:rows.length,memberIds:rows.map(id),exclusions:[]});
  };
  if(data.movementAnalysis?.population)populations.baseline_comparable=data.movementAnalysis.population;
  if(data.finishMovementAnalysis?.population)populations.revision_comparable=data.finishMovementAnalysis.population;
  if(state.quantities&&['quantity-scurve','challenge-contract'].includes(result.key))register('boq_items','BOQ source quantity items','quantity_item',state.quantities.items,r=>r.quantityItemId,'BOQ source scope, separate from measured installed quantities');
  if(model)register('relationships','Source relationship records','relationship',model.relationships,(r,i)=>String(r.relationshipId??[r.predecessorActivityId,r.successorActivityId,r.type,r.lagHours,i].join(':')));
  if(data.windows||data.windowCandidates)register('windows','Compared programme windows','programme_window',data.windows??data.windowCandidates,(r,i)=>String(r.windowId??i),'comparison of dated programme revisions');
  if(data.points)register('series_points','Reported series points','series_point',data.points,(r,i)=>String(r.dateIso??r.periodEnd??r.revisionId??i),'each series retains its stated actual, planned or forecast date basis');
  const commercial=data.position;
  if(commercial?.sourceLedger?.populations)Object.assign(populations,commercial.sourceLedger.populations);
  if(commercial?.foundation?.paymentRegister?.population)populations.certificate_periods=commercial.foundation.paymentRegister.population;
  if(commercial?.contractControls?.variations?.population)populations.variation_lifecycle=commercial.contractControls.variations.population;
  if(commercial){
    const securities=commercial.contractControls?.bondsInsurance;
    if(securities?.insurancePopulation)populations.insurances=securities.insurancePopulation;
    if(securities?.bonds)register('bonds','Governed security register','bond',securities.bonds,r=>r.bondId,'source status and expiry date; missing expiry yields unknown monitoring counts');
    for(const [key,p] of Object.entries(commercial.contractControls??{}) as Array<[string,any]>){
      if(p?.population)populations[key]=p.population;
      else if(Array.isArray(p?.rows))register(key,key.replace(/([a-z])([A-Z])/g,'$1 $2'),'control_record',p.rows,(r,i)=>String(r.obligationId??r.retentionId??r.instructionId??i),'explicit source controls; findings retain their individual authority and date basis');
    }
    register('commercial_positions','Currency-specific commercial positions','currency_position',commercial.currencies??[],r=>r.currency,'dated source facts and separately governed contractual terms');
  }
  const claims=['pmo-analysis','delay-claims','notices-claims','windows-analysis','eot-assessment','commercial-claims-notices','project-director','board-report','management-surfaces'].includes(result.key)?shared.claims:null;
  if(claims){
    populations.claims=claims.claims.population;populations.notices=claims.notices.population;populations.events=claims.events.population;
    for (const [key,determination] of [['claim_notices',false],['determinations',true]] as const) {
      populations[key] = partitionAsOf(claims.source.notices.filter((n:any)=>(n.kind==='determination')===determination),{
        name: determination ? 'Dated determinations' : 'Claim notices, excluding determinations',entity: determination ? 'determination' : 'notice',dataDateIso,
        dateBasis:'actualIssuedAt',sourceRevisionId:claims.source.evidenceRevisionId,id:(n:any)=>n.noticeId,date:(n:any)=>n.actualIssuedAt}).population;
    }
  }
  const resources=shared.resources;
  if(resources&&['resource-utilization','manhour-scurve','pmo-analysis','progress-report','project-director'].includes(result.key)){
    const ids=resources.resources.map((r:any)=>r.resourceId);
    populations.resources=populationContract({name:'P6 resource master identities',entity:'resource',dataDateIso,dateBasis:'current programme resource master',sourceRevisionId:model?.sourceRevisionId??null,authority:'source',sourceCount:ids.length,memberIds:ids,exclusions:[]});
    populations.assignments=populationContract({name:'P6 resource assignment records',entity:'assignment',dataDateIso,dateBasis:'current programme assignment register; not resource identities',sourceRevisionId:model?.sourceRevisionId??null,authority:'source',sourceCount:resources.assignments.length,memberIds:resources.assignments.map((r:any,i:number)=>String(r.assignmentId??i)),exclusions:[]});
  }
  const metricContracts:Record<string,MetricSemanticContract>={};
  const add=(path:string,population:PopulationContract|undefined,authority:ReportingAuthority='calculated',semantic:{unit?:string|null;state?:string|null;qualification?:string|null}={})=>{
    // Runtime reporting contracts certify populations only. Non-population
    // scalar semantics are read directly from the canonical fact object when
    // a report/export is requested, keeping the cold project path lean.
    if(!population)return;
    const populationKey=Object.keys(populations).find(key=>populations[key]===population)??null;
    metricContracts[path]={
      populationId:population.populationId,
      denominator:population.denominator,
      excludedCount:population.exclusions.length,
      exclusionsRef:populationKey?'reportingContract.populations.'+populationKey+'.exclusions':null,
      dataDateIso,
      authority,
      dateBasis:population.dateBasis,
      unit:semantic.unit??null,
      state:semantic.state??null,
      qualification:semantic.qualification??population.dateBasis
    };
  };
  // Explicit metric-family rules: a resource count can never use assignment rows.
  const walk=(value:any,path:string,depth:number)=>{
    if(!value||typeof value!=='object'||depth>7)return;
    if(Array.isArray(value)){
      // Array record schemas inherit their collection population; the wildcard
      // avoids turning pagination or a large register into thousands of contracts.
      for(const item of value.slice(0,1))walk(item,path+'[*]',depth+1);
      return;
    }
    for(const [key,v] of Object.entries(value)){
      const full=path?path+'.'+key:key;
      if(['sourceLedger','claimsReporting','challenge','controlBasis','systemEvidenceContract','reportingContract','diagnostics','sourceRefs','basis','coverage','source','futureRows','undatedRows','population','populationContract','activityPopulation','movementAnalysis'].includes(key))continue;
      if(typeof v==='number'||v===null&&/(Count|Percent|Amount|Days|Hours|Value|denominator|value)$/.test(key)){
        let p:PopulationContract|undefined;
        if(/ncr/i.test(key)||/controls\.reporting\.quality/.test(full))p=populations.ncrs;
        else if(/rfi/i.test(key)||/controls\.reporting\.rfi/.test(full))p=populations.rfis;
        else if(/riskCount/i.test(key)||/controls\.reporting\.risk/.test(full))p=populations.risks;
        else if(/EventCount$/.test(key)||['eventCount','timelyNoticeCount','lateNoticeCount','missingNoticeCount','noticeRequirementMissingCount'].includes(key))p=populations.events;
        else if(/ClaimCount$/.test(key)||key==='claimCount')p=populations.claims;
        else if(key==='noticeCount'||key==='sourceNoticeCount')p=populations.claim_notices;
        else if(/DeterminationCount$/.test(key))p=populations.determinations;
        else if(/\.status\.(completed|inProgress|in_progress|notStarted|not_started|unknown)$/.test(full))p=populations.execution_control;
        else if(/position\.currencies\[\*\]\.approvedVariationAmount\.value/.test(full))p=populations.commercial_positions;
        else if(/relationship|logicDensity/i.test(full))p=populations.relationships;
        else if(/revisionCount|snapshotCount|observationCount|establishedForecastCount|sourceForecastCount/i.test(full))p=populations.revisions;
        else if(/window|MovementDays|TimeImpact/i.test(full))p=populations.windows;
        else if(/assignment/i.test(full))p=populations.assignments;
        else if(/resourceCount|assignedResource|p6ResourceMaster|sourceMasterResource/.test(full))p=populations.resources;
        else if(/notice/i.test(key))p=populations.notices;
        else if(/event/i.test(key))p=populations.events;
        else if(/claim/i.test(key))p=populations.claims;
        else if(/insurance|polic/i.test(key))p=populations.insurances;
        else if(/bond/i.test(key))p=populations.bonds;
        else if(/retentionDeduct/.test(full))p=populations.retentionDeductions;
        else if(/paymentRegister|invoiceCount|certificate/.test(full))p=populations.certificate_periods??populations.payments;
        else if(/variation/i.test(full))p=populations.variation_lifecycle??populations.variations;
        else if(/contractObligations|retentionCalendar|siteInstructions/.test(full))p=populations[['contractObligations','retentionCalendar','siteInstructions'].find(k=>full.includes(k))!];
        else if(/movement|Variance|baselineComparable/.test(full))p=populations.baseline_comparable;
        else if(/milestone/i.test(full)||result.key==='milestones')p=populations.milestones;
        else if(/critical|float|execution|completed|inProgress|notStarted|unknownStatus/i.test(full))p=populations.execution_control;
        else if(/progress|weighted/i.test(full))p=populations.duration_weighted_progress;
        else if(/sourceCount|activityCount|ActivityCount/.test(full))p=['progress-breakdown','independent-forecast'].includes(result.key)?populations.execution_control:populations.source_records;
        else if(/notice/i.test(full))p=populations.notices;
        else if(/event/i.test(full))p=populations.events;
        else if(/claim/i.test(full))p=populations.claims;
        if(!p&&commercial)p=populations.commercial_positions;
        if(!p&&result.key==='resource-utilization')p=populations.resources;
        if(!p&&result.key==='manhour-scurve')p=populations.assignments;
        if(!p&&['windows-analysis','eot-assessment'].includes(result.key))p=populations.windows;
        if(!p&&['revision-trend','forecast-history'].includes(result.key))p=populations.revisions;
        if(p&&/sourceRecordCount|sourceNoticeCount|fullRecordCount|futureRecordCount|futureNoticeCount|futureDeterminationCount|undatedRecordCount|undatedNoticeCount/.test(key)){
          const scope=/future/i.test(key)?'future':/undated/i.test(key)?'undated':'full_source';
          const baseKey=Object.keys(populations).find(k=>populations[k]===p)!;
          const scopedKey=baseKey+'_'+scope;
          if(!populations[scopedKey]){
            const chosen=scope==='full_source'?[...p.memberIds,...p.exclusions.map(e=>e.id)]:p.exclusions.filter(e=>scope==='future'?e.reason==='after_data_date':/date_missing|date_invalid/.test(e.reason)).map(e=>e.id);
            const included=new Set(chosen);
            populations[scopedKey]=populationContract({...p,name:p.name+' · '+scope.replaceAll('_',' '),dateBasis:scope==='full_source'?'Full retained source register; explicitly not the as-of position':scope==='future'?'Source records after Data Date; excluded from current totals':'Source records without an established event date; excluded from current totals',memberIds:chosen,exclusions:[...p.memberIds,...p.exclusions.map(e=>e.id)].filter(id=>!included.has(id)).map(id=>({id,reason:'outside_'+scope+'_population'}))});
          }
          p=populations[scopedKey];
        }
        const declaredAuthority=typeof value?.authority==='string'&&['source','submitted','calculated','adjusted','official','scenario'].includes(value.authority)?value.authority as ReportingAuthority:null;
        const authority:ReportingAuthority=declaredAuthority??(/official/i.test(full)?'official':/position\.currencies\[\*\]\.approvedVariationAmount\.value/.test(full)?'source':/source|submitted/i.test(full)?'submitted':value?.basis?.authority==='source'?'source':'calculated');
        const unit=typeof value?.unit==='string'?value.unit:typeof value?.currency==='string'?value.currency:p?/Percent$|PercentagePoints$/.test(key)?'%':/Hours$/.test(key)?'hours':/Days$/.test(key)?'calendar days':null:null;
        const state=typeof value?.state==='string'?value.state:p?(v===null?'not_established':'established'):null;
        const qualification=typeof value?.basis==='string'?value.basis:typeof value?.qualification==='string'?value.qualification:typeof value?.reason==='string'?value.reason:p?.dateBasis??null;
        add(full,p,authority,{unit,state,qualification});
      }else walk(v,full,depth+1);
    }
  };
  walk(data,'',0);
  const time=shared.time;
  const baseline=shared.baseline;
  return {...result,data:{...data,scheduleAuthorityReview:authorityReview,registerDateReview:scopeRegisterDateReview(shared.dateReview,result.key),baselineComparison:{state:baseline?'established':'unresolved',revisionId:baseline?.revision.revisionId??null,reason:baseline?null:'No confirmed baseline'},reportingContract:{schemaVersion:'1.0',dataDateIso,projectVersion:state.version,
    calendarResolution:{unresolvedActivityCount:shared.calendarUnresolvedActivityCount},
    configurationId:shared.configurationId,
    pendingScheduleReviews:authorityReview.pendingSchedules,
    programmeAuthority:{state:authorityReview.state,method:authorityReview.method,authority:authorityReview.authority,explanation:authorityReview.explanation},
    newerUnadoptedSchedules:authorityReview.pendingSchedules.filter((s:any)=>s.dateRelationship==='later'||s.dateRelationship==='no_current_programme'),
    programmeRevisionId:current?.revision.revisionId??null,programmeLabel:current?.revision.label??null,
    actualEventPolicy:'Only dated events on or before the Data Date enter current actuals. Future and undated evidence is retained separately.',
    forecastPolicy:'Future planned work and forecast dates remain visible as forecasts, never as actual events.',
    resolver:'moduleForProject',populations,metricContracts,
    excludedScheduleActualEvents:{future:actuals.future,undated:actuals.undated},
    completionAuthority:{governedContractualFinish:time?.contractualCompletionIso??null,authority:time?.contractualCompletionState??'missing',
      reason:time?.completionReason??null,
      additionalExtensionState:time?.overlapResolution==='unresolved'?'not_established':'separately_assessed',
      explanation:!time?.contractualCompletionIso?(time?.completionReason??'No applicable contract completion date has been established from the supplied contract records.'):time?.overlapResolution==='unresolved'?'The governed amendment finish remains valid. A further adjusted finish cannot be established until overlap with determinations is resolved.':'Governed contractual finish and separately evidenced EOT adjustments retain distinct authority.'},
    authorityDefinitions:{source:'Recorded source assertion',submitted:'Submitted position',calculated:'CMeng calculation',adjusted:'Calculation changing a stated basis',official:'Explicit governed approval',scenario:'Unapproved analytical scenario'}}}};
}
