import { activityPopulation } from '../../schedule-analysis-core/src';
import { populationContract, partitionAsOf, type PopulationContract, type ReportingAuthority } from '../../truth-kernel/src';
import { projectControlSchedule, projectDataDate, canonicalTimeClaims } from './canonical-time-claims';
import { claimsReporting,scheduleActualReporting,operationalReporting } from './reporting-state';
import { createHash } from 'node:crypto';
import { projectScheduleControlBasis } from './schedule-control-basis';
import type { ProjectRuntimeState, ModuleRuntimeResult } from './project-state-types';

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
      if (population) contract.metricContracts[collection + '[' + key + '].value'] = {
        populationId: population.populationId, denominator: population.denominator, excludedCount: population.exclusions.length,
        exclusionsRef: 'reportingContract.populations.' + Object.keys(populations).find(k => populations[k] === population) + '.exclusions',
        dataDateIso: contract.dataDateIso, authority: metric.authority === 'source' ? 'source' : 'calculated', dateBasis: metric.basis,
      };
    }
  }
  for (const field of ['approvedVariationAmount', 'pendingVariationAmount', 'retentionDeductedAmount', 'retentionHeldAmount', 'certifiedUnpaidAmount', 'activeBondAmount']) {
    const original = commercial?.metricContracts?.['position.currencies[*].' + field + '.value'];
    if (original) contract.metricContracts['commercialByCurrency[*].' + field + '.value'] = original;
  }
  return result;
}

/** Shared reporting metadata travels with the resolved payload to every consumer.
 * Population references are independent of UI pagination and retain excluded IDs.
 */
export function attachReportingContract(state:ProjectRuntimeState,result:ModuleRuntimeResult):ModuleRuntimeResult {
  if(!result.data||typeof result.data!=='object')return result;
  const data=result.data as any, current=projectControlSchedule(state), model=current?.revision.model, dataDateIso=projectDataDate(state);
  const populations:Record<string,PopulationContract>={};
  const operations=operationalReporting(state);
  if(['project-director','board-report','management-surfaces','pmo-analysis','lookahead-schedule'].includes(result.key)) {
    populations.ncrs=operations.quality.population;populations.rfis=operations.rfi.population;populations.risks=operations.risk.population;
  }
  const actuals=scheduleActualReporting(state);
  populations.schedule_actual_events=actuals.population;
  const register=(key:string,name:string,entity:string,rows:readonly any[],id:(r:any,i:number)=>string,dateBasis='current governed programme snapshot',authority:ReportingAuthority='source')=>{
    populations[key]=populationContract({name,entity,dataDateIso,dateBasis,sourceRevisionId:model?.sourceRevisionId??null,authority,sourceCount:rows.length,memberIds:rows.map(id),exclusions:[]});
  };
  if(model)for(const basis of ['source_records','execution_control','milestones','duration_weighted_progress'] as const){
    const p=activityPopulation(model,basis);
    populations[basis]=p.reporting;
  }
  if(data.movementAnalysis?.population)populations.baseline_comparable=data.movementAnalysis.population;
  if(data.finishMovementAnalysis?.population)populations.revision_comparable=data.finishMovementAnalysis.population;
  if(state.quantities&&['quantity-scurve','challenge-contract'].includes(result.key))register('boq_items','BOQ source quantity items','quantity_item',state.quantities.items,r=>r.quantityItemId,'BOQ source scope, separate from measured installed quantities');
  if(model)register('relationships','Source relationship records','relationship',model.relationships,(r,i)=>String(r.relationshipId??[r.predecessorActivityId,r.successorActivityId,r.type,r.lagHours,i].join(':')));
  const revisionScope=partitionAsOf(state.schedules.filter(s=>s.role!=='recovery'),{name:'Programme revisions by Data Date',entity:'programme_revision',dataDateIso,dateBasis:'programme Data Date or explicit revision effective date',id:r=>r.revision.revisionId,date:r=>r.revision.model.dataDateIso??r.revision.effectiveAt});
  populations.revisions=revisionScope.population;
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
  const claims=['pmo-analysis','delay-claims','notices-claims','windows-analysis','eot-assessment','commercial-claims-notices','project-director','board-report','management-surfaces'].includes(result.key)?claimsReporting(state):null;
  if(claims){
    populations.claims=claims.claims.population;populations.notices=claims.notices.population;populations.events=claims.events.population;
    for (const [key,determination] of [['claim_notices',false],['determinations',true]] as const) {
      populations[key] = partitionAsOf(claims.source.notices.filter(n=>(n.kind==='determination')===determination),{
        name: determination ? 'Dated determinations' : 'Claim notices, excluding determinations',entity: determination ? 'determination' : 'notice',dataDateIso,
        dateBasis:'actualIssuedAt',sourceRevisionId:claims.source.evidenceRevisionId,id:n=>n.noticeId,date:n=>n.actualIssuedAt}).population;
    }
  }
  const resources=current?state.resourcesByRevision.get(current.revision.revisionId):null;
  if(resources&&['resource-utilization','manhour-scurve','pmo-analysis','progress-report','project-director'].includes(result.key)){
    const ids=resources.resources.map(r=>r.resourceId);
    populations.resources=populationContract({name:'P6 resource master identities',entity:'resource',dataDateIso,dateBasis:'current programme resource master',sourceRevisionId:model?.sourceRevisionId??null,authority:'source',sourceCount:ids.length,memberIds:ids,exclusions:[]});
    populations.assignments=populationContract({name:'P6 resource assignment records',entity:'assignment',dataDateIso,dateBasis:'current programme assignment register; not resource identities',sourceRevisionId:model?.sourceRevisionId??null,authority:'source',sourceCount:resources.assignments.length,memberIds:resources.assignments.map((r,i)=>String((r as any).assignmentId??i)),exclusions:[]});
  }
  const metricContracts:Record<string,{populationId:string;denominator:number;excludedCount:number;exclusionsRef:string;dataDateIso:string|null;authority:ReportingAuthority;dateBasis:string}>={};
  const add=(path:string,population:PopulationContract|undefined,authority:ReportingAuthority='calculated')=>{
    if(population)metricContracts[path]={populationId:population.populationId,denominator:population.denominator,excludedCount:population.exclusions.length,exclusionsRef:'reportingContract.populations.'+Object.keys(populations).find(key=>populations[key]===population)+'.exclusions',dataDateIso,authority,dateBasis:population.dateBasis};
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
        const authority:ReportingAuthority=/official/i.test(full)?'official':/position\.currencies\[\*\]\.approvedVariationAmount\.value/.test(full)?'source':/source|submitted/i.test(full)?'submitted':value?.basis?.authority==='source'?'source':'calculated';
        add(full,p,authority);
      }else walk(v,full,depth+1);
    }
  };
  walk(data,'',0);
  const time=canonicalTimeClaims(state).contractTimeBasis??state.controls.contractTimeBasis;
  return {...result,data:{...data,reportingContract:{schemaVersion:'1.0',dataDateIso,projectVersion:state.version,
    configurationId:createHash('sha256').update(JSON.stringify(projectScheduleControlBasis(state).analysisConfig)).digest('hex').slice(0,24),
    programmeRevisionId:current?.revision.revisionId??null,programmeLabel:current?.revision.label??null,
    actualEventPolicy:'Only dated events on or before the Data Date enter current actuals. Future and undated evidence is retained separately.',
    forecastPolicy:'Future planned work and forecast dates remain visible as forecasts, never as actual events.',
    resolver:'moduleForProject',populations,metricContracts,
    excludedScheduleActualEvents:{future:actuals.future,undated:actuals.undated},
    completionAuthority:{governedContractualFinish:time?.contractualCompletionIso??null,authority:time?.contractualCompletionState??'missing',
      additionalExtensionState:time?.overlapResolution==='unresolved'?'not_established':'separately_assessed',
      explanation:time?.overlapResolution==='unresolved'?'The governed amendment finish remains valid. A further adjusted finish cannot be established until overlap with determinations is resolved.':'Governed contractual finish and separately evidenced EOT adjustments retain distinct authority.'},
    authorityDefinitions:{source:'Recorded source assertion',submitted:'Submitted position',calculated:'CMeng calculation',adjusted:'Calculation changing a stated basis',official:'Explicit governed approval',scenario:'Unapproved analytical scenario'}}}};
}
