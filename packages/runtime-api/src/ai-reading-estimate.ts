import {configuredModelLimits,estimateTokens,realisticTokens,configuredProviderState} from '../../project-ask/src/provider';
import {callUpperBoundUsd,monthlyAiUsage,type MonthlyAiUsage} from '../../project-ask/src/usage-budget';
import type {AiRequestEvent} from './evidence-semantic-ai';

/** Point 5 (13 Nov): what the owner sees before approving Finish AI reading. Built from the
 * requests a reading would actually send (planning mode), never from
 * "number of parts x the 48,000/5,000-token allowance". */
export interface AiReadingEstimate {
  model:string|null;
  pendingParts:number;
  byKind:{table:number;contract:number};
  uniqueStructures:number;
  aiCalls:number;
  reusedFromThisReading:number;
  reusedFromValidatedCache:number;
  expected:{inputTokens:number;outputTokens:number;usd:number|null};
  /** The most these AI calls can cost: each request's payload at two bytes per token plus the
   * safety margin, and the full output allowance. */
  ceilingForPlannedCalls:{inputTokens:number;outputTokens:number;usd:number|null};
  /** Absolute worst case: every pending part called on its own (no reuse at all). */
  worstCase:{inputTokens:number;outputTokens:number;usd:number|null};
  month:MonthlyAiUsage|null;
  fitsRemainingCap:boolean|null;
  basis:string;
  statement:string;
}

const usd=(model:string|null,input:number,output:number,env:NodeJS.ProcessEnv)=>model===null?null:callUpperBoundUsd(model,input,output,env);
const round=(value:number|null)=>value===null?null:Math.round(value*1e6)/1e6;
const money=(value:number|null)=>value===null?'not priced':'USD '+(value<0.01&&value>0?value.toFixed(4):value.toFixed(2));

export function estimateAiReading(events:readonly AiRequestEvent[],env:NodeJS.ProcessEnv=process.env):AiReadingEstimate{
  const provider=configuredProviderState(env),model=provider.model,limits=configuredModelLimits(env);
  const tokens=(event:AiRequestEvent)=>{
    const sent={instructions:event.request.prompt,input:event.request.payload,schema:event.request.schema};
    return {ceilingIn:estimateTokens(sent)+limits.safetyTokens,ceilingOut:limits.outputTokens,
      expectedIn:realisticTokens(sent),expectedOut:Math.ceil(event.request.expectedOutputBytes/4)};
  };
  let expectedIn=0,expectedOut=0,plannedIn=0,plannedOut=0,worstIn=0,worstOut=0;
  let expectedUsd:number|null=model?0:null,plannedUsd:number|null=model?0:null,worstUsd:number|null=model?0:null;
  for(const event of events){
    const t=tokens(event);
    // Worst case: every part is called on its own, each at its own ceiling.
    worstIn+=t.ceilingIn;worstOut+=t.ceilingOut;
    const worst=usd(model,t.ceilingIn,t.ceilingOut,env);worstUsd=worstUsd===null||worst===null?null:worstUsd+worst;
    if(!event.call)continue;
    expectedIn+=t.expectedIn;expectedOut+=t.expectedOut;plannedIn+=t.ceilingIn;plannedOut+=t.ceilingOut;
    const expected=usd(model,t.expectedIn,t.expectedOut,env),planned=usd(model,t.ceilingIn,t.ceilingOut,env);
    expectedUsd=expectedUsd===null||expected===null?null:expectedUsd+expected;
    plannedUsd=plannedUsd===null||planned===null?null:plannedUsd+planned;
  }
  const month=model?monthlyAiUsage(model,env):null;
  const calls=events.filter(event=>event.call).length;
  const estimate:Omit<AiReadingEstimate,'statement'>={
    model,pendingParts:events.length,
    byKind:{table:events.filter(event=>event.kind==='table').length,contract:events.filter(event=>event.kind==='contract').length},
    uniqueStructures:new Set(events.map(event=>event.kind+':'+event.request.fingerprint)).size,
    aiCalls:calls,
    reusedFromThisReading:events.filter(event=>!event.call&&event.reuse==='run').length,
    reusedFromValidatedCache:events.filter(event=>!event.call&&event.reuse==='cache').length,
    expected:{inputTokens:expectedIn,outputTokens:expectedOut,usd:round(expectedUsd)},
    ceilingForPlannedCalls:{inputTokens:plannedIn,outputTokens:plannedOut,usd:round(plannedUsd)},
    worstCase:{inputTokens:worstIn,outputTokens:worstOut,usd:round(worstUsd)},
    month,
    fitsRemainingCap:month&&plannedUsd!==null?plannedUsd<=month.remainingUsd:null,
    basis:'Requests are built exactly as they would be sent. Expected cost: about four bytes per token (the live measurement: 41,573 bytes counted as 10,302 tokens) and the usual answer size. '+
      'Ceiling: two bytes per token plus a '+limits.safetyTokens+'-token margin, and the full '+limits.outputTokens+'-token answer allowance per call. '+
      'Worst case: every pending part called on its own. Same model, same 0.90 acceptance threshold and source validation.',
  };
  const statement=events.length===0?'Nothing is waiting for AI reading.':
    estimate.pendingParts+' part'+(estimate.pendingParts===1?'':'s')+' not fully read'+
    (estimate.byKind.table&&estimate.byKind.contract?' ('+estimate.byKind.table+' table, '+estimate.byKind.contract+' contract heading)':estimate.byKind.contract?' (contract headings)':' (tables)')+'. '+
    estimate.uniqueStructures+' unique structure'+(estimate.uniqueStructures===1?'':'s')+'; '+calls+' AI call'+(calls===1?'':'s')+' after reuse'+
    (estimate.reusedFromValidatedCache?' ('+estimate.reusedFromValidatedCache+' answered from earlier validated readings)':'')+'. '+
    'Expected cost about '+money(estimate.expected.usd)+'; ceiling for these calls '+money(estimate.ceilingForPlannedCalls.usd)+'; worst case '+money(estimate.worstCase.usd)+'. '+
    (month?'Spent this month '+money(month.committedUsd)+' of USD '+month.capUsd.toFixed(2)+'; '+money(month.remainingUsd)+' left.':'No spending ledger is configured.');
  return {...estimate,statement};
}
