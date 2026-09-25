import { delayClaimsAsOf } from '../../delay-analysis-core/src/reporting';
import { projectDataDate, canonicalTimeClaims, inheritTimeClaimsCache } from './canonical-time-claims';
import type { ProjectRuntimeState } from './project-state-types';
import { reportingScope,partitionAsOf } from '../../truth-kernel/src';
import { projectControlSchedule } from './canonical-time-claims';
import {operationalControlsAsOf,type OperationalReporting} from './operational-reporting';
import {resolveBoqSource} from './boq-source';
import {refreshContractSegmentation} from '../../contract-parser/src';
import {refreshScheduleConstraints} from './schedule-source-refresh';
import {reportingReadinessEvidence} from './evidence-readiness';
import {noticeVersionCohorts} from './contract-notice-rules';

const cache = new WeakMap<ProjectRuntimeState,{version:number;date:string|null;value:ProjectRuntimeState}>();
const views = new WeakSet<ProjectRuntimeState>();
const origins = new WeakMap<ProjectRuntimeState,ProjectRuntimeState>();
const operationalCache = new WeakMap<ProjectRuntimeState,{version:number;date:string|null;value:OperationalReporting}>();
export function operationalReporting(state:ProjectRuntimeState) {
  state=origins.get(state)??state;const date=projectDataDate(state),cached=operationalCache.get(state);
  if(cached?.version===state.version&&cached.date===date)return cached.value;
  const value=operationalControlsAsOf(state,date);operationalCache.set(state,{version:state.version,date,value});return value;
}
/** Read-only reporting view. Never truncates or overwrites persisted evidence. */
export function reportingState(state: ProjectRuntimeState): ProjectRuntimeState {
  if(views.has(state))return state;
  const date=projectDataDate(state), old=cache.get(state);
  if(old?.version===state.version&&old.date===date)return old.value;
  const governed=state.controls.delayClaims;
  const source=governed&&!/^(canonical-evidence|evidence-document):/.test(governed.evidenceRevisionId)?governed:canonicalTimeClaims(state).delayClaims??governed;
  const hasBaseline=state.schedules.some(s=>['baseline','revised_baseline'].includes(s.role)&&reportingScope(s.revision.model.dataDateIso??s.revision.effectiveAt,date)==='as_of');
  const schedules=state.schedules.map(stored=>{
    const model=refreshScheduleConstraints(state,stored);
    if(!Array.isArray(model.activities))return stored;
    const cutoff=model.dataDateIso??date;
    let changed=model!==stored.revision.model;
    const activities=model.activities.map(row=>{
      const invalidStart=Boolean(row.actualStartIso)&&reportingScope(row.actualStartIso,cutoff)!=='as_of';
      const invalidFinish=Boolean(row.actualFinishIso)&&reportingScope(row.actualFinishIso,cutoff)!=='as_of';
      const unconfirmedBaseline=!hasBaseline&&(row.baselineStartIso!==null||row.baselineFinishIso!==null);
      if(!invalidStart&&!invalidFinish&&!unconfirmedBaseline)return row;
      changed=true;
      return {...row,...(!hasBaseline?{baselineStartIso:null,baselineFinishIso:null}:{}),
        ...(invalidStart||invalidFinish?{actualStartIso:invalidStart?null:row.actualStartIso,actualFinishIso:invalidFinish?null:row.actualFinishIso,
        status:'unknown' as const,percentComplete:null,diagnostics:[...row.diagnostics,'ACTUAL_EVENT_OUTSIDE_SNAPSHOT_DATA_DATE_STATUS_AND_PROGRESS_WITHHELD']}:{} )};
    });
    return changed?{...stored,revision:{...stored.revision,model:{...model,activities}}}:stored;
  });
  const ops=operationalReporting(state);
  const boqSource=resolveBoqSource(state,projectControlSchedule(state)?.revision.revisionId??'');
  const view={...state,schedules,boq:boqSource.boq,quantities:boqSource.quantities,
    contract:state.contract?refreshContractSegmentation(state.contract):null,
    contractDocuments:state.contractDocuments.map(doc=>({...doc,result:refreshContractSegmentation(doc.result)})),
    controls:{...state.controls,readinessEvidence:reportingReadinessEvidence(state,date),delayClaims:source?delayClaimsAsOf(source,date).current:null,
    ncrs:ops.quality.current as typeof state.controls.ncrs,rfis:ops.rfi.current as typeof state.controls.rfis,risks:ops.risk.current as typeof state.controls.risks}};
  inheritTimeClaimsCache(state,view);
  views.add(view);origins.set(view,state);cache.set(state,{version:state.version,date,value:view});return view;
}

export function boqSourceReporting(state:ProjectRuntimeState) {
  const raw=origins.get(state)??state;
  return resolveBoqSource(raw,projectControlSchedule(raw)?.revision.revisionId??'').selection;
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
  if(!source)return null;
  const reporting=delayClaimsAsOf(source,projectDataDate(state));
  const notices=reporting.notices.asOf.filter(n=>n.kind!=='determination');
  const determinations=canonicalTimeClaims(state).determinations;
  return {...reporting,noticeRuleVersions:noticeVersionCohorts(reporting.notices.asOf,source.noticeRequirements),
    correspondenceReview:{registerNoticeCount:notices.length,
      documentCoverage:state.evidenceDocuments.filter(d=>d.correspondenceNarrativeRefresh).map(d=>({sourceFilename:d.sourceFilename,...d.correspondenceNarrativeRefresh})),
      documentIdentityCount:notices.filter(n=>n.correspondenceEvidence?.identityFound).length,
      noticeContentLinkedCount:notices.filter(n=>n.correspondenceEvidence?.noticeContentLinked).length,
      unconfirmedLetterIds:notices.filter(n=>!n.correspondenceEvidence?.identityFound).map(n=>n.correspondenceEvidence?.sourceLetter??n.noticeId),
      determinations:determinations.map(d=>({...d,reportingScope:reportingScope(d.determinationDate,projectDataDate(state))})),
      interpretation:'A register notice date establishes a reported notice, not delivery or its contents. A matching letter ID alone does not prove an event-specific notice or award.'}};
}
