import { delayClaimsAsOf } from '../../delay-analysis-core/src/reporting';
import { projectDataDate, canonicalTimeClaims } from './canonical-time-claims';
import type { ProjectRuntimeState } from './project-state-types';
import { reportingScope,partitionAsOf } from '../../truth-kernel/src';
import { projectControlSchedule } from './canonical-time-claims';

const cache = new WeakMap<ProjectRuntimeState,{version:number;date:string|null;value:ProjectRuntimeState}>();
const views = new WeakSet<ProjectRuntimeState>();
const origins = new WeakMap<ProjectRuntimeState,ProjectRuntimeState>();
/** Read-only reporting view. Never truncates or overwrites persisted evidence. */
export function reportingState(state: ProjectRuntimeState): ProjectRuntimeState {
  if(views.has(state))return state;
  const date=projectDataDate(state), old=cache.get(state);
  if(old?.version===state.version&&old.date===date)return old.value;
  const governed=state.controls.delayClaims;
  const source=governed&&!/^(canonical-evidence|evidence-document):/.test(governed.evidenceRevisionId)?governed:canonicalTimeClaims(state).delayClaims??governed;
  const schedules=state.schedules.map(stored=>{
    const model=stored.revision.model;
    if(!Array.isArray(model.activities))return stored;
    const cutoff=model.dataDateIso??date;
    let changed=false;
    const activities=model.activities.map(row=>{
      const invalidStart=Boolean(row.actualStartIso)&&reportingScope(row.actualStartIso,cutoff)!=='as_of';
      const invalidFinish=Boolean(row.actualFinishIso)&&reportingScope(row.actualFinishIso,cutoff)!=='as_of';
      if(!invalidStart&&!invalidFinish)return row;
      changed=true;
      return {...row,actualStartIso:invalidStart?null:row.actualStartIso,actualFinishIso:invalidFinish?null:row.actualFinishIso,
        status:'unknown' as const,percentComplete:null,
        diagnostics:[...row.diagnostics,'ACTUAL_EVENT_OUTSIDE_SNAPSHOT_DATA_DATE_STATUS_AND_PROGRESS_WITHHELD']};
    });
    return changed?{...stored,revision:{...stored.revision,model:{...model,activities}}}:stored;
  });
  const view={...state,schedules,controls:{...state.controls,delayClaims:source?delayClaimsAsOf(source,date).current:null}};
  views.add(view);origins.set(view,state);cache.set(state,{version:state.version,date,value:view});return view;
}

export function scheduleActualReporting(state:ProjectRuntimeState){
  state=origins.get(state)??state;
  const current=projectControlSchedule(state),dataDateIso=projectDataDate(state);
  const rows=(current?.revision.model.activities??[]).flatMap(row=>[
    ...(row.actualStartIso?[{id:row.activityId+':actual_start',activityId:row.activityId,event:'actual_start',dateIso:row.actualStartIso}]:[]),
    ...(row.actualFinishIso?[{id:row.activityId+':actual_finish',activityId:row.activityId,event:'actual_finish',dateIso:row.actualFinishIso}]:[]),
  ]);
  return partitionAsOf(rows,{name:'Dated schedule actual events',entity:'activity_actual_event',dataDateIso,dateBasis:'actual start and finish dates; future planned dates are a separate basis',sourceRevisionId:current?.revision.revisionId??null,id:r=>r.id,date:r=>r.dateIso});
}

export function claimsReporting(state: ProjectRuntimeState) {
  state=origins.get(state)??state;
  const governed=state.controls.delayClaims;
  const source=governed&&!/^(canonical-evidence|evidence-document):/.test(governed.evidenceRevisionId)?governed:canonicalTimeClaims(state).delayClaims??governed;
  return source?delayClaimsAsOf(source,projectDataDate(state)):null;
}
