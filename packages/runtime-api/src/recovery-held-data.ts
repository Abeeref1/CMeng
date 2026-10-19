import type {CanonicalScheduleActivity} from '../../schedule-analysis-core/src';
import type {CanonicalResourceModel} from '../../schedule-resource-core/src';
import {resourceLaborHourEligible} from '../../schedule-resource-core/src';
import type {TradeChainResourcePosition} from '../../resource-utilization/src';
import type {RecoveryScenario} from './recovery-acceleration';

/**
 * F29: best-available crew candidates from the data held.
 *
 * Crew acceleration is calculated only where quantity, productivity and the
 * submitted crew are all held (the activity feasibility check). When that data
 * is partial, the held data still shows where a crew option applies:
 *  - a repeated trade chain (F46 calculator) on the completion-driving network;
 *  - a labour resource stated on unfinished completion-driving activities.
 * Each candidate states what is held and which inputs limit it. No crew size,
 * productivity or gain is assumed: candidates carry no CPM change, no days and
 * no cost, and they never change the calculated or assumption scenario counts.
 */
export interface HeldDataLimitingInput {code:string;label:string}
export interface HeldDataCrewCandidate {
  candidateId:string;
  type:'additional_crew';
  state:'option_requires_assumption';
  basisSource:'trade_chain'|'stated_labour_resource';
  subject:string;
  trade:string|null;
  tradeSource:string|null;
  resourceIds:string[];
  resourceNames:(string|null)[];
  activityCount:number;
  /** First 50 activity ids of the candidate; activityCount is the full count. */
  affectedActivities:string[];
  locations:string[];
  remainingHours:number|null;
  capacityLabel:string|null;
  shortfallHours:number|null;
  chainCompletionEffect:{state:string;completionDelayCalendarDays:number|null}|null;
  held:string[];
  limitingInputs:HeldDataLimitingInput[];
  basis:string;
  possibleDaysRecovered:null;
  completionGainWorkingDays:null;
  completionGainBasis:string;
  authority:'scenario';
}
export interface HeldDataCrewCandidates {
  state:'generated'|'none_found'|'not_established';
  reason:string|null;
  candidateCount:number|null;
  candidates:HeldDataCrewCandidate[];
  /** Every crew option the held data supports, by basis. Calculated-need and
   * sequential-chain options are existing scenarios; the others are the
   * candidates above. Null where the basis cannot be assessed. */
  crewOptionCounts:{calculatedNeed:number;sequentialChain:number;tradeChain:number|null;statedResource:number|null};
  crewCandidateTotal:number|null;
  limitingInputs:Array<HeldDataLimitingInput&{candidateCount:number}>;
  uncoveredDrivingActivityCount:number|null;
  basis:string;
}

const LIST_LIMIT=50;
const ADDED_CREW:HeldDataLimitingInput={code:'ADDED_CREW_NOT_STATED',label:'Size and availability of the added crew are not stated in the data held'};
const PRODUCTIVITY:HeldDataLimitingInput={code:'PRODUCTIVITY_NOT_LINKED',label:'Quantity and labour-hours per unit are not linked to every activity, so productivity is not established'};
const REMAINING_HOURS:HeldDataLimitingInput={code:'REMAINING_HOURS_NOT_STATED',label:'Remaining labour hours are not stated on every assignment'};
const CAPACITY:HeldDataLimitingInput={code:'CAPACITY_NOT_STATED',label:'Weekly capacity of the resource is not stated in the resource register or the programme'};
const CREW_LINKS:HeldDataLimitingInput={code:'CREW_LINKS_NOT_CONFIRMED',label:'The links between locations are not confirmed as crew dependencies rather than physical prerequisites'};
const GAIN_BASIS='Not calculated: the data held states no added crew size or productivity, and CMeng does not assume them. Enter recovery assumptions by trade or work front to calculate a gain.';
const BASIS='Crew candidates from the data held: repeated trade chains (same trade across locations, joined by programme logic) and labour resources stated on unfinished activities of the CMeng CPM completion-driving network. Activities already covered by a crew scenario are not repeated. A candidate is not a recovery plan and carries no gain, days or cost.';

const execution=(activity:CanonicalScheduleActivity|undefined)=>!!activity&&!['level_of_effort','wbs_summary','start_milestone','finish_milestone','milestone'].includes(activity.activityType);
const hours=(value:number|null)=>value===null?'not established':Number(value.toFixed(2))+' h';

export function heldDataCrewCandidates(input:{
  scenarios:readonly RecoveryScenario[];
  drivingNetworkEstablished:boolean;
  drivingOpen:readonly CanonicalScheduleActivity[];
  tradeChains:TradeChainResourcePosition|null;
  resources:CanonicalResourceModel|null;
  productivityActivityIds:ReadonlySet<string>;
  calculatedNeedCount:number;
}):HeldDataCrewCandidates{
  const crewCovered=new Set(input.scenarios.filter(s=>s.type==='additional_crew').flatMap(s=>s.affectedActivities));
  const sequentialChain=input.scenarios.filter(s=>s.scenarioId.startsWith('plot-crews:')&&s.pathRole==='recovery_option').length;
  const counts={calculatedNeed:input.calculatedNeedCount,sequentialChain};
  if(!input.drivingNetworkEstablished)return {state:'not_established',reason:'DRIVING_PATH_NOT_ESTABLISHED',candidateCount:null,candidates:[],
    crewOptionCounts:{...counts,tradeChain:null,statedResource:null},crewCandidateTotal:null,limitingInputs:[],uncoveredDrivingActivityCount:null,
    basis:BASIS+' The completion-driving network is not established, so trade-chain and stated-resource candidates are not assessed.'};
  const open=input.drivingOpen.filter(execution);
  const openIds=new Set(open.map(a=>a.activityId));
  const candidates:HeldDataCrewCandidate[]=[];
  const claimed=new Set<string>();
  const productivityLimit=(ids:readonly string[])=>ids.some(id=>!input.productivityActivityIds.has(id));
  // 1. Repeated trade chains on the driving network (F46 shared calculation).
  for(const chain of input.tradeChains?.chains??[]){
    if(chain.onDrivingPath!==true)continue;
    const ids=chain.openActivityIds.filter(id=>openIds.has(id)&&!crewCovered.has(id)&&!claimed.has(id));
    if(!ids.length)continue;
    ids.forEach(id=>claimed.add(id));
    const capacityStated=chain.resources.length>0&&chain.resources.every(r=>r.capacitySource!==null);
    const limits=[ADDED_CREW,...(productivityLimit(ids)?[PRODUCTIVITY]:[]),...(chain.remainingHours===null?[REMAINING_HOURS]:[]),...(capacityStated?[]:[CAPACITY]),CREW_LINKS];
    const capacityLabel=chain.resources.length?[...new Set(chain.resources.map(r=>r.capacityLabel))].join('; '):null;
    const effect=chain.completionEffect;
    const held=[
      'Trade '+chain.trade+' ('+chain.tradeSource+') across '+chain.locations.length+' locations, joined by programme logic',
      ids.length+' unfinished activities on the completion-driving network ('+ids[0]+' to '+ids.at(-1)+')',
      'Remaining assigned hours on the chain: '+hours(chain.remainingHours),
      ...(chain.resources.length?['Stated resources: '+chain.resources.map(r=>r.resourceId+(r.resourceName?' '+r.resourceName:'')).join(', ')+(capacityLabel?' · capacity: '+capacityLabel:'')]:[]),
      ...(chain.totalShortfallHours!==null?['Shortfall against stated capacity: '+hours(chain.totalShortfallHours)]:[]),
      ...(effect.state==='established'&&effect.completionDelayCalendarDays!==null?['At the stated capacity the chain moves completion by '+effect.completionDelayCalendarDays+' calendar days']:[]),
    ];
    candidates.push({candidateId:'trade-chain-crew:'+chain.chainId,type:'additional_crew',state:'option_requires_assumption',basisSource:'trade_chain',
      subject:chain.trade+' · '+chain.locations.length+' locations',trade:chain.trade,tradeSource:chain.tradeSource,
      resourceIds:chain.resources.map(r=>r.resourceId),resourceNames:chain.resources.map(r=>r.resourceName),
      activityCount:ids.length,affectedActivities:ids.slice(0,LIST_LIMIT),locations:chain.locations,remainingHours:chain.remainingHours,capacityLabel,
      shortfallHours:chain.totalShortfallHours,chainCompletionEffect:{state:effect.state,completionDelayCalendarDays:effect.completionDelayCalendarDays},
      held,limitingInputs:limits,
      basis:'An added crew on the '+chain.trade+' chain could split the one-crew sequence across its locations. '+held.join('. ')+'.',
      possibleDaysRecovered:null,completionGainWorkingDays:null,completionGainBasis:GAIN_BASIS,authority:'scenario'});
  }
  // 2. Labour resources stated on the remaining unfinished driving activities.
  const remaining=open.filter(a=>!crewCovered.has(a.activityId)&&!claimed.has(a.activityId));
  const remainingIds=new Set(remaining.map(a=>a.activityId));
  const resourceById=new Map((input.resources?.resources??[]).map(r=>[r.resourceId,r]));
  const byResource=new Map<string,{activityIds:string[];units:(number|null)[]}>();
  for(const assignment of input.resources?.assignments??[]){
    if(!remainingIds.has(assignment.activityId)||!assignment.resourceId)continue;
    const resource=resourceById.get(assignment.resourceId);
    if(!resource||!resourceLaborHourEligible(resource))continue;
    if(typeof assignment.remainingUnits==='number'&&assignment.remainingUnits<=0)continue;
    const row=byResource.get(assignment.resourceId)??{activityIds:[],units:[]};
    if(!row.activityIds.includes(assignment.activityId))row.activityIds.push(assignment.activityId);
    row.units.push(typeof assignment.remainingUnits==='number'&&Number.isFinite(assignment.remainingUnits)?assignment.remainingUnits:null);
    byResource.set(assignment.resourceId,row);
  }
  const resourced=new Set<string>();
  for(const [resourceId,row] of [...byResource].sort((a,b)=>a[0].localeCompare(b[0]))){
    row.activityIds.forEach(id=>resourced.add(id));
    const resource=resourceById.get(resourceId)!,name=resource.name??resource.shortName??null;
    const remainingHours=row.units.every(v=>v!==null)?Number(row.units.reduce((sum:number,v)=>sum+v!,0).toFixed(6)):null;
    const limits=[ADDED_CREW,...(productivityLimit(row.activityIds)?[PRODUCTIVITY]:[]),...(remainingHours===null?[REMAINING_HOURS]:[])];
    const held=[
      'Labour resource '+resourceId+(name?' '+name:'')+' stated on '+row.activityIds.length+' unfinished activities of the completion-driving network ('+row.activityIds[0]+(row.activityIds.length>1?' to '+row.activityIds.at(-1):'')+')',
      'Remaining assigned hours: '+hours(remainingHours),
    ];
    candidates.push({candidateId:'driving-resource-crew:'+resourceId,type:'additional_crew',state:'option_requires_assumption',basisSource:'stated_labour_resource',
      subject:(name??resourceId)+' · '+row.activityIds.length+' driving activit'+(row.activityIds.length===1?'y':'ies'),trade:null,tradeSource:null,
      resourceIds:[resourceId],resourceNames:[name],activityCount:row.activityIds.length,affectedActivities:row.activityIds.slice(0,LIST_LIMIT),locations:[],
      remainingHours,capacityLabel:null,shortfallHours:null,chainCompletionEffect:null,held,limitingInputs:limits,
      basis:'Added labour of this stated resource on the completion-driving activities. '+held.join('. ')+'.',
      possibleDaysRecovered:null,completionGainWorkingDays:null,completionGainBasis:GAIN_BASIS,authority:'scenario'});
  }
  const uncovered=remaining.filter(a=>!resourced.has(a.activityId)).length;
  const limitCounts=new Map<string,HeldDataLimitingInput&{candidateCount:number}>();
  for(const candidate of candidates)for(const limit of candidate.limitingInputs){const row=limitCounts.get(limit.code)??{...limit,candidateCount:0};row.candidateCount++;limitCounts.set(limit.code,row);}
  const limitingInputs=[...limitCounts.values(),
    ...(uncovered?[{code:'NO_STATED_RESOURCE_OR_TRADE_CHAIN',label:uncovered+' unfinished completion-driving activit'+(uncovered===1?'y has':'ies have')+' no stated labour resource, trade chain or crew check, so no crew candidate can be shown for '+(uncovered===1?'it':'them'),candidateCount:0}]:[])];
  const tradeChain=candidates.filter(c=>c.basisSource==='trade_chain').length,statedResource=candidates.length-tradeChain;
  return {state:candidates.length?'generated':'none_found',reason:candidates.length?null:open.length?'NO_HELD_CREW_BASIS_ON_UNCOVERED_DRIVING_WORK':'NO_UNFINISHED_DRIVING_WORK',
    candidateCount:candidates.length,candidates,crewOptionCounts:{...counts,tradeChain,statedResource},
    crewCandidateTotal:counts.calculatedNeed+counts.sequentialChain+tradeChain+statedResource,limitingInputs,uncoveredDrivingActivityCount:uncovered,basis:BASIS};
}
