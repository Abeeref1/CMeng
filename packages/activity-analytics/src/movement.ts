import { numericDistribution } from '../../schedule-analysis-core/src/population';
import { populationContract } from '../../truth-kernel/src';
import type { ActivityAnalyticsRow } from './types';

const finish=(row:{status:string;actualFinishIso:string|null;forecastFinishIso:string|null;currentFinishIso:string|null})=>row.status==='completed'&&row.actualFinishIso?row.actualFinishIso:row.forecastFinishIso??row.currentFinishIso;
const difference=(to:string|null,from:string|null)=>!to||!from||!Number.isFinite(Date.parse(to))||!Number.isFinite(Date.parse(from))?null:Number(((Date.parse(to)-Date.parse(from))/86400000).toFixed(6));

export function activityMovementAnalysis(rows: readonly ActivityAnalyticsRow[], input: {
  dataDateIso:string|null;currentRevisionId:string;currentLabel:string;baselineRevisionId:string|null;baselineLabel:string|null;
  previousRevisionId:string|null;previousLabel:string|null;previousRows?:readonly {activityId:string;status:string;actualFinishIso:string|null;forecastFinishIso:string|null;currentFinishIso:string|null}[];
}) {
  const previous=new Map((input.previousRows??[]).map(r=>[r.activityId,r]));
  const comparable=rows.filter(r=>r.finishVarianceDays!==null&&difference(finish(r),r.baselineFinishIso)!==null);
  const distribution=numericDistribution(comparable.map(r=>r.finishVarianceDays));
  const comparableIds=new Set(comparable.map(r=>r.activityId));
  const population=populationContract({name:'Activities with a controlled-baseline finish comparison',entity:'activity',
    dataDateIso:input.dataDateIso,dateBasis:'current effective activity finish minus the same activity controlled-baseline finish; calendar days',
    sourceRevisionId:input.currentRevisionId+'|baseline:'+input.baselineRevisionId,authority:'calculated',sourceCount:rows.length,
    memberIds:comparable.map(r=>r.activityId),exclusions:rows.filter(r=>!comparableIds.has(r.activityId)).map(r=>({id:r.activityId,reason:'baseline_or_current_finish_unavailable'}))});
  const maximumRows=comparable.filter(r=>r.finishVarianceDays===distribution.maximum).map(r=>{
    const prior=previous.get(r.activityId),currentFinishIso=finish(r),previousFinishIso=prior?finish(prior):null;
    const calculated=difference(currentFinishIso,r.baselineFinishIso);
    return {activityId:r.activityId,name:r.name,activityType:r.activityType,wbsId:r.wbsId,baselineFinishIso:r.baselineFinishIso,
      currentFinishIso,previousFinishIso,baselineMovementDays:calculated,previousMovementDays:difference(currentFinishIso,previousFinishIso),
      priorBaselineMovementDays:difference(previousFinishIso,r.baselineFinishIso),sourcePairVerified:calculated===r.finishVarianceDays};
  });
  const group=(key:(r:typeof maximumRows[number])=>string)=>{
    const groups=new Map<string,number>();for(const r of maximumRows){const k=key(r);groups.set(k,(groups.get(k)??0)+1);}
    return [...groups].map(([value,count])=>({value,count})).sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value));
  };
  return {population,coveragePercent:rows.length?100*comparable.length/rows.length:null,
    comparison:{baselineRevisionId:input.baselineRevisionId,baselineLabel:input.baselineLabel,currentRevisionId:input.currentRevisionId,currentLabel:input.currentLabel,
      previousRevisionId:input.previousRevisionId,previousLabel:input.previousLabel,unit:'calendar_days'},
    distribution,maximumRows,representatives:maximumRows.slice(0,5),
    activityTypes:group(r=>r.activityType),baselineDatePatterns:group(r=>r.baselineFinishIso??'missing'),currentDatePatterns:group(r=>r.currentFinishIso??'missing'),wbsPatterns:group(r=>r.wbsId??'missing'),
    sourcePairVerifiedCount:maximumRows.filter(r=>r.sourcePairVerified).length,
    causation:'not_established',systematicRevisionShift:'review_required',
    interpretation:'Source schedule date movement, not delay causation or entitlement. Identical movements are not additive and may reflect common programme rephasing.'};
}
