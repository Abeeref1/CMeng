import type {ProjectScope,Cell} from '../../project-ask/src/types';
import type {ActivityAnalyticsRow} from '../../activity-analytics/src/types';
import {AuthorityBuilder,evidenceState} from './ask-authority-builder';
import {moduleForProject} from './project-projections';
import {runtimeProjects} from './project-state';
import {projectControlSchedule} from './canonical-time-claims';
import {projectDiagnosisDetails} from './project-diagnosis';
import {scheduleScopeClassification} from './schedule-scope-classification';

const columns={activityId:{label:'Activity ID'},name:{label:'Activity'},wbs:{label:'WBS',dimension:true},wbsId:{label:'WBS ID',dimension:true},wbsPath:{label:'WBS path',dimension:true},wbsLevel:{label:'WBS level',dimension:true},
  location:{label:'Location',dimension:true},zone:{label:'Zone',dimension:true},floor:{label:'Floor',dimension:true},level:{label:'Level',dimension:true},tower:{label:'Tower',dimension:true},building:{label:'Building',dimension:true},area:{label:'Area',dimension:true},workFront:{label:'Work front',dimension:true},discipline:{label:'Discipline',dimension:true},package:{label:'Package',dimension:true},
  currentStartIso:{label:'Planned start'},currentFinishIso:{label:'Planned finish'},
  plannedStartIso:{label:'Planned start'},plannedFinishIso:{label:'Forecast finish'},
  totalFloatHours:{label:'Programme float',unit:'hours'},independentTotalFloatHours:{label:'Calculated float',unit:'hours'},
  percentComplete:{label:'Progress',unit:'%'},startOverdueCalendarDays:{label:'Start overdue',unit:'calendar days'},finishOverdueCalendarDays:{label:'Finish overdue',unit:'calendar days'}};
const execution=(r:ActivityAnalyticsRow)=>!['level_of_effort','wbs_summary'].includes(r.activityType);
export function askScheduleActivities(scope:ProjectScope){
  const source=moduleForProject(scope.projectId,'activity-analytics'),data=source.data as any;
  const rows:ActivityAnalyticsRow[]=(data?.rows??[]).filter(execution);
  const basis='Activities in the adopted programme, as of '+(scope.dataDate??'an unconfirmed Data Date')+'. A missed start is a planned start before the Data Date with work not started. An overdue finish is an unfinished activity whose forecast finish has passed. Baseline slippage is shown only when a baseline comparison exists. Summary and level-of-effort rows are excluded.';
  const b=new AuthorityBuilder('activities','Programme activities','activity-analytics',scope,evidenceState(source.status),rows.length?'Activity dates, progress and float from this project’s programme.':'No adopted programme activities are available.');
  if(rows.length&&!rows.some(r=>r.baselineFinishIso!==null))b.result.explanation+=' No baseline has been confirmed, so delay against the original planned dates cannot be measured.';
  const diagnosis=projectDiagnosisDetails((moduleForProject(scope.projectId,'pmo-analysis').data as any)?.projectDiagnosis);
  const driving=new Set<string>(diagnosis?.network.rows.map((r:any)=>r.activityId)??[]),wbsNames=new Map<string,string>((diagnosis?.wbsRows??[]).map((r:any)=>[r.wbsId,r.wbs]));
  const state=runtimeProjects.get(scope.projectId),programme=state?projectControlSchedule(state):null;
  const classifications=programme&&programme.revision.revisionId===scope.programmeRevision?scheduleScopeClassification(programme.revision.model):null;
  const classificationById=new Map((classifications?.rows??[]).map(row=>[row.activityId,row]));
  b.table('rows','Activities',rows,basis,columns,r=>{const scopeRow=classificationById.get(r.activityId);return {...r,wbs:wbsNames.get(r.wbsId)??r.wbsId,
    wbsPath:scopeRow?.wbsPath??null,wbsLevel:scopeRow?.wbsLevel??null,location:scopeRow?.location??null,zone:scopeRow?.zone??null,floor:scopeRow?.floor??null,level:scopeRow?.level??null,tower:scopeRow?.tower??null,building:scopeRow?.building??null,area:scopeRow?.area??null,workFront:scopeRow?.workFront??null,discipline:scopeRow?.discipline??null,package:scopeRow?.package??null,
    onDrivingNetwork:diagnosis&&diagnosis.network.state!=='unavailable'?driving.has(r.activityId):null,
    schedulePressure:['not_started','in_progress'].includes(r.status)?driving.has(r.activityId)||r.criticality==='critical'||r.criticality==='near_critical'||r.scheduleDelayed===true:r.status==='completed'?false:null,
    plannedStartIso:r.currentStartIso??r.forecastStartIso,plannedFinishIso:r.forecastFinishIso??r.currentFinishIso,critical:r.criticality==='unknown'?null:r.criticality==='critical',predecessors:r.predecessorIds.join('; '),successors:r.successorIds.join('; ')}});
  const table=b.result.tables[0]!;table.population=data?.rows?.length??0;table.excluded=table.population-rows.length;
  if(programme&&programme.revision.revisionId===scope.programmeRevision){
    b.result.traces[0]!.sourceRefs=[programme.sourceHashSha256,programme.revision.revisionId];
    if(classifications)b.result.explanation+=' Scope classification coverage: '+classifications.coverage.filter(row=>row.classified>0).map(row=>row.label+' '+row.classified+'/'+row.total).join('; ')+'. Source-derived classifications are not promoted to governed project master data.';
  }
  // Register fields even for an empty programme, so a valid zero is never a schema error.
  if(!rows.length)table.columns=Object.entries(columns).map(([key,c])=>({key,label:c.label,type:'text',unit:'unit'in c?c.unit:null,aggregate:'none',dimension:false}));
  return b.result;
}

export function askCriticalPath(scope:ProjectScope){
  const source=askScheduleActivities(scope),forecast:any=moduleForProject(scope.projectId,'independent-forecast').data;
  const diagnosis=projectDiagnosisDetails((moduleForProject(scope.projectId,'pmo-analysis').data as any)?.projectDiagnosis);
  if(diagnosis?.network.state!=='unavailable'&&diagnosis?.network.rows.length){
    const network=diagnosis.network,qualified=network.state==='scenario';
    const b=new AuthorityBuilder('critical-path','Driving path to completion','independent-forecast',scope,qualified?'scenario':'established',
      'The calendar calculation identifies '+network.rows.length+' '+(network.rows.length===1?'activity':'activities')+' and '+network.relationships.length+' binding relationships leading to completion.'+(qualified?' This is a calculated network with the stated programme assumptions.':'')+' Parallel branches are retained.');
    b.table('network','Ordered finish-driving network',network.rows,network.basis,{...columns,sequence:{label:'Order'},wbs:{label:'WBS'},calculatedStartIso:{label:'Calculated start'},calculatedFinishIso:{label:'Calculated finish'},remainingDurationHours:{label:'Remaining duration',unit:'hours'},drivingPredecessors:{label:'Driving predecessors / link / lag'},drivingSuccessors:{label:'Driving successors / link / lag'}});
    b.table('relationships','Driving relationships',network.relationships,network.basis,{lagHours:{unit:'working hours'}});
    b.metric('driving-count','Finish-driving activities',network.rows.length,'activities',network.basis);
    for(const l of diagnosis.completion?.limitations??[])b.finding(l.key,'Calculation qualification',l.text,'The network above retains this stated assumption.');
    for(const t of b.result.traces)t.sourceRefs=source.traces.flatMap(t=>t.sourceRefs);
    return b.result;
  }
  const calculated=forecast?.complete===true&&forecast?.origin==='deterministic_source_calendar';
  const b=new AuthorityBuilder('critical-path','Critical activities','independent-forecast',scope,calculated?'established':source.state==='unavailable'?'unavailable':'partial',
    calculated?'Activities identified as critical by CMeng’s calendar calculation. Several parallel paths may exist.':'The independent critical path is not yet confirmed. The list below shows activities with critical float in the uploaded programme.');
  const ids=new Set<string>(forecast?.criticalActivityIds??[]),values=new Map<string,any>((forecast?.activities??[]).map((r:any)=>[r.activityId,r]));
  const population=source.tables[0]!.rows;
  const rows:Record<string,Cell>[]=population.filter(r=>calculated?ids.has(String(r.activityId)):r.critical===true).map(r=>({...r,independentTotalFloatHours:calculated?values.get(String(r.activityId))?.independentTotalFloatHours??null:null}));
  rows.sort((a,b)=>String(a.currentStartIso??'9999').localeCompare(String(b.currentStartIso??'9999'))||String(a.activityId).localeCompare(String(b.activityId)));
  const basis=calculated?'Existing independent CPM calculation using the programme calendars, relationships, constraints and remaining durations. This is an activity list, not a single ordered path.':'Source total float at the project’s critical threshold. This list does not establish an independently calculated driving path.';
  b.table('rows',calculated?'Calculated critical activities':'Programme critical activities',rows,basis,columns);
  b.result.traces[0]!.sourceRefs=source.traces.flatMap(t=>t.sourceRefs);
  b.result.tables[0]!.population=population.length;b.result.tables[0]!.excluded=population.length-rows.length;
  const missing=population.filter(r=>r.critical===null).length;
  b.metric('known-count',calculated?'Calculated critical activities':'Known programme critical activities',source.state==='unavailable'?null:rows.length,'activities',basis);
  if(!calculated&&missing)b.finding('missing-float','Some activities have no float',missing+' activities have no readable source float. The known list is shown; the full critical total is unconfirmed.','Review those activities in Programme Review.');
  if(!calculated&&forecast?.complete){
    const reasons=(forecast.assumptions??[]).flatMap((a:string)=>a.startsWith('SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED')?['Some activity date restrictions have not been applied in the calendar calculation.']:a==='UNKNOWN_ACTIVITY_STATUS_TREATED_AS_INCOMPLETE'?['Some activity statuses need checking.']:a==='SOURCE_DURATION_ELAPSED_DAY_PATTERN_REQUIRES_CALENDAR_RECONCILIATION'?['Some recorded durations differ from the working-calendar calculation.']:[]);
    b.finding('calculation-review','Why the calculated path still needs review',reasons.join(' ')||'The calculation depends on assumptions that need review.','Open Completion Forecast to review the stated assumptions.');
  }
  for(const trace of source.traces)b.result.traces.push(trace);
  return b.result;
}
