import type {ProjectScope,Cell} from '../../project-ask/src/types';
import type {ActivityAnalyticsRow} from '../../activity-analytics/src/types';
import {AuthorityBuilder,evidenceState} from './ask-authority-builder';
import {moduleForProject} from './project-projections';
import {runtimeProjects} from './project-state';
import {projectControlSchedule} from './canonical-time-claims';

const columns={activityId:{label:'Activity ID'},name:{label:'Activity'},currentStartIso:{label:'Planned start'},currentFinishIso:{label:'Planned finish'},
  plannedStartIso:{label:'Planned start'},plannedFinishIso:{label:'Forecast finish'},
  totalFloatHours:{label:'Programme float',unit:'hours'},independentTotalFloatHours:{label:'Calculated float',unit:'hours'},
  percentComplete:{label:'Progress',unit:'%'},startOverdueCalendarDays:{label:'Start overdue',unit:'calendar days'},finishOverdueCalendarDays:{label:'Finish overdue',unit:'calendar days'}};
const execution=(r:ActivityAnalyticsRow)=>!['level_of_effort','wbs_summary'].includes(r.activityType);
export function askScheduleActivities(scope:ProjectScope){
  const source=moduleForProject(scope.projectId,'activity-analytics'),data=source.data as any;
  const rows:ActivityAnalyticsRow[]=(data?.rows??[]).filter(execution);
  const basis='Activities in the adopted programme, as of '+(scope.dataDate??'an unconfirmed Data Date')+'. A missed start is a planned start before the Data Date with work not started. An overdue finish is an unfinished activity whose forecast finish has passed. Baseline slippage is shown only when a baseline comparison exists. Summary and level-of-effort rows are excluded.';
  const b=new AuthorityBuilder('activities','Programme activities','activity-analytics',scope,evidenceState(source.status),rows.length?'Activity dates, progress and float from this project’s programme.':'No adopted programme activities are available.');
  b.table('rows','Activities',rows,basis,columns,r=>({...r,plannedStartIso:r.currentStartIso??r.forecastStartIso,plannedFinishIso:r.forecastFinishIso??r.currentFinishIso,critical:r.criticality==='unknown'?null:r.criticality==='critical',predecessors:r.predecessorIds.join('; '),successors:r.successorIds.join('; ')}));
  const table=b.result.tables[0]!;table.population=data?.rows?.length??0;table.excluded=table.population-rows.length;
  const state=runtimeProjects.get(scope.projectId),programme=state?projectControlSchedule(state):null;
  if(programme&&programme.revision.revisionId===scope.programmeRevision)b.result.traces[0]!.sourceRefs=[programme.sourceHashSha256,programme.revision.revisionId];
  // Register fields even for an empty programme, so a valid zero is never a schema error.
  if(!rows.length)table.columns=Object.entries(columns).map(([key,c])=>({key,label:c.label,type:'text',unit:'unit'in c?c.unit:null,aggregate:'none',dimension:false}));
  return b.result;
}

export function askCriticalPath(scope:ProjectScope){
  const source=askScheduleActivities(scope),forecast:any=moduleForProject(scope.projectId,'independent-forecast').data;
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
  for(const trace of source.traces)b.result.traces.push(trace);
  return b.result;
}
