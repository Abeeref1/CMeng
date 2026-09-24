import {buildBoqFeasibility, type LaborProductivityBasis} from '../../delivery-challenge/src/boq-feasibility';
import {cell,numberValue,dateValue,governedTables} from '../../truth-kernel/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {projectControlSchedule} from './canonical-time-claims';

export function programmePcMilestone(model:CanonicalScheduleModel|null) {
  const candidates=(model?.activities??[]).filter(a=>['milestone','finish_milestone'].includes(a.activityType)&&/\b(programme\s+p\.?c\.?|practical completion|project completion)\b/i.test(a.name??''));
  const values=candidates.map(a=>a.forecastFinishIso??a.currentFinishIso);
  const dates=values.map(v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null);
  const date=candidates.length===1&&dates[0]?dates[0]:null;
  return {dateIso:date,state:date?'established':'unresolved',reason:!candidates.length?'Programme PC milestone is not identified.':candidates.length!==1?'Multiple completion milestones require a confirmed Programme PC selection.':!date?'Programme PC milestone has no readable finish date.':'Explicit Programme PC milestone in the source revision.',activityIds:candidates.map(a=>a.activityId)};
}
function computeDeliveryFeasibility(state:ProjectRuntimeState) {
  const current=projectControlSchedule(state);if(!current)return null;
  const model=current.revision.model,cutoff=dateValue(model.dataDateIso??'');
  const items=new Map((state.quantities?.items??[]).map(i=>[i.quantityItemId,i]));
  const itemNumbers=new Map<string,string[]>();for(const item of items.values())if(item.itemNumber){const ids=itemNumbers.get(item.itemNumber)??[];ids.push(item.quantityItemId);itemNumbers.set(item.itemNumber,ids);}
  const rates:LaborProductivityBasis[]=[];
  for(const table of governedTables(state.evidenceDocuments,[]).filter(t=>t.headers.some(h=>['labor hours per unit','labour hours per unit','man hours per unit','labor h unit'].includes(h))))for(const row of table.rows){
    const raw=cell(row,'Labor Hours Per Unit','Labour Hours Per Unit','Man Hours Per Unit','Labor h/unit'),rate=numberValue(raw);
    if(rate===null||rate<=0)continue;
    const dateRaw=cell(row,'As Of','Data Date','Effective Date'),date=dateValue(dateRaw);
    if(dateRaw&&(!date||!cutoff||date>cutoff))continue;
    const suppliedId=cell(row,'Quantity Item ID','BOQ Item ID','BOQ Item','Item Number','Item No'),activityId=cell(row,'Activity ID','Activity Code'),unit=cell(row,'Unit','UOM');
    const ids=items.has(suppliedId)?[suppliedId]:itemNumbers.get(suppliedId)??[];
    if(ids.length!==1||!activityId||!unit)continue;
    rates.push({quantityItemId:ids[0]!,activityId,unit,laborHoursPerUnit:rate,sourceRefs:['evidence-document:'+row.receipt.documentId+':'+row.receipt.locator]});
  }
  const analysis=buildBoqFeasibility({schedule:model,quantities:state.quantities,resources:state.resourcesByRevision.get(current.revision.revisionId)??null,rates});
  const baselineId=state.activeEvidenceBasis['schedule:baseline']?.activeArtifactId;
  const baseline=baselineId?state.schedules.find(s=>s.revision.revisionId===baselineId&&['baseline','revised_baseline'].includes(s.role)):undefined;
  const from=programmePcMilestone(baseline?.revision.model??null),to=programmePcMilestone(model);
  const comparable=!!baseline&&baseline.revision.revisionId!==current.revision.revisionId&&from.dateIso!==null&&to.dateIso!==null&&from.activityIds[0]===to.activityIds[0];
  return {...analysis,programmePc:{baseline:from,current:to,baselineRevisionId:baseline?.revision.revisionId??null,currentRevisionId:current.revision.revisionId,movementDays:comparable?Number(((Date.parse(to.dateIso!)-Date.parse(from.dateIso!))/86400000).toFixed(6)):null,state:comparable?'established':'unresolved',reason:comparable?'Same explicit Programme PC activity in the adopted baseline and current programme; movement does not establish causation or EOT.':!baseline?'An adopted baseline is not established.':!from.dateIso?from.reason:!to.dateIso?to.reason:'Confirm that baseline and current Programme PC refer to the same milestone.'}};
}
const cache=new WeakMap<ProjectRuntimeState,{version:number;value:ReturnType<typeof computeDeliveryFeasibility>}>();
export function deliveryFeasibilityForState(state:ProjectRuntimeState){
  const prior=cache.get(state);if(prior?.version===state.version)return prior.value;
  const value=computeDeliveryFeasibility(state);cache.set(state,{version:state.version,value});return value;
}
