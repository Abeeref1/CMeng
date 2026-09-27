import type {AnalysisPlan,AuthorityDescriptor,ProjectScope} from '../../project-ask/src/types';
import type {ProjectRuntimeState} from './project-state-types';
import {AuthorityBuilder} from './ask-authority-builder';
import {isAdoptedProgrammeRevision} from './schedule-authority';
import {buildScheduleAnalyticsProjection} from '../../schedule-analytics/src';
import {buildActivityAnalyticsProjection} from '../../activity-analytics/src';
import {buildProgressBreakdownProjection} from '../../progress-breakdown/src';

/** Historical reads never route through today's cached project projections. */
export function historicalAskAuthority(state:ProjectRuntimeState,scope:ProjectScope,plan:AnalysisPlan,authority:AuthorityDescriptor){
  const cutoff=plan.asOf,valid=cutoff&&/^\d{4}-\d{2}-\d{2}$/.test(cutoff)&&new Date(cutoff).toISOString().slice(0,10)===cutoff;
  const revision=valid?state.schedules.filter(r=>isAdoptedProgrammeRevision(state,r)&&!!r.revision.model.dataDateIso&&r.revision.model.dataDateIso.slice(0,10)<=cutoff!).sort((a,b)=>a.revision.model.dataDateIso!.localeCompare(b.revision.model.dataDateIso!)).at(-1):null;
  const supported=['programme','activities','float','wbs','progress','forecast','revision-history'].includes(authority.id);
  const b=new AuthorityBuilder(authority.id,authority.title,authority.module,scope,revision&&supported?'partial':'unavailable',
    !valid?'Historical cut-off is not established. Current facts are not substituted.':!revision?'No adopted programme revision supports this historical cut-off.':!supported?'A governed historical '+authority.title.toLowerCase()+' snapshot is not available. Current records have not been used.':'Dated programme source at '+revision.revision.model.dataDateIso+'. Other domains and what management knew at that time require their own dated evidence.');
  if(!revision||!supported)return b.result;
  scope.programmeRevision=revision.revision.revisionId;scope.authorityState='historical_adopted_source';
  const model=revision.revision.model,asOf=model.dataDateIso!,options={generatedAt:new Date().toISOString(),producerVersion:'ask-historical-source-v1'};
  const facts=buildScheduleAnalyticsProjection(model,options).result;
  b.metric('historicalDate','Historical programme Data Date',asOf,null,'Adopted source revision '+revision.revision.revisionId,{fact:true,refs:['schedule-revision:'+revision.revision.revisionId]});
  if(authority.id==='activities'||authority.id==='float')b.table('activities','Historical programme activities',buildActivityAnalyticsProjection(model,options).rows,'Existing Activity Review producer applied to the dated historical programme. No current evidence is joined.');
  else if(authority.id==='wbs')b.table('wbs','Historical WBS progress',buildProgressBreakdownProjection(model,options).rows,'Existing WBS producer on the historical programme.');
  else {
    const f:any=facts;const finish=f.completionBases?.find((c:any)=>c.basis==='forecast');b.metric('historicalFinish','Historical submitted completion',finish?.dateIso??null,null,'Existing Schedule Analysis producer on the dated source.',{fact:true});b.metric('sourceProgress','Historical schedule snapshot',f.progress?.durationWeightedProgressPercent??null,'%','Existing Schedule Analysis producer; not independently measured physical progress.');
    b.metric('critical','Historical critical activities',f.float?.criticalCount??null,'activities','Existing Schedule Analysis producer on the historical source.');
  }
  for(const trace of b.result.traces)trace.dataDate=asOf;
  return b.result;
}
