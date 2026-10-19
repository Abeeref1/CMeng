import {createHash} from 'node:crypto';
import {registerDate} from '../../truth-kernel/src';
import type {ContractTermKey,ContractTermVersion} from './contract-term-versions';
import {SOURCE_ANALYTICAL_USE} from './contract-source-analysis';
import type {ProjectRuntimeState} from './project-state-types';
import type {ContractTimeBasis} from '../../eot-assessment/src';
import {contractCompletionPosition,completionHeldByAdoptedBasis,withoutCompletionSourceLabel} from './contract-completion';
import {projectDataDate} from './canonical-time-claims';

// T04: one decision place for contract terms whose sources disagree or whose
// reading is unsure. The user picks a read value, types their own, changes or
// undoes it. The decision is stored in controls.reviewDecisions under
// 'contract-fact:<term>' (additive key; older versions ignore it), bound to a
// fingerprint of the exact source versions compared. It is applied inside the
// shared term reader (reportingContractTermVersions), so every page reads it.
// A chosen or typed value is never shown as formally adopted, and removing the
// decision (undo) or any source change restores the source reading.
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const CONTRACT_FACT_DECISION_PREFIX='contract-fact:';
export const USER_ENTERED_TERM_NOTE='Entered by the user in the decision place; not formally adopted.';
const TERM_LABELS:Record<ContractTermKey,string>={ldRate:'delay damages (LD) rate',ldCap:'delay damages (LD) cap',retentionPercent:'retention percentage',retentionCapPercent:'retention limit',paymentPeriodDays:'payment period',noticePeriodDays:'claim notice period',performanceSecurity:'performance security',advanceSecurity:'advance payment security'};

const applicableAt=(v:ContractTermVersion,date:string|null)=>date?(!v.effectiveFromIso||v.effectiveFromIso<=date)&&(!v.effectiveToIso||v.effectiveToIso>date):v.effectiveToIso===null;
export const contractFactValueKey=(v:{value:number;unit:string})=>v.value+'|'+v.unit;

export interface ContractFactDecisionItem {
  key:string;term:ContractTermKey;label:string;dataDateIso:string|null;fingerprint:string;
  reason:'sources_disagree'|'unsure_reading';
  candidates:Array<{valueKey:string;value:number;unit:string;adopted:boolean;documentIds:string[];sourceRefs:string[]}>;
  enterUnit:string|null;decision:{choice:string;enteredValue?:number;confirmedAt:string}|null;
}

/** Terms at the data date with more than one read value, or an unsure reading. */
export function contractFactDecisionItems(state:ProjectRuntimeState,versions:readonly ContractTermVersion[],dataDate:string|null):ContractFactDecisionItem[]{
  const date=registerDate(dataDate??'')||null,items:ContractFactDecisionItem[]=[];
  for(const term of [...new Set(versions.map(v=>v.term))]){
    const relevant=versions.filter(v=>v.term===term&&applicableAt(v,date));
    const values=new Map<string,ContractTermVersion[]>();
    for(const v of relevant)values.set(contractFactValueKey(v),[...(values.get(contractFactValueKey(v))??[]),v]);
    // The notice period's unresolved applicability has its own notice review.
    const unsure=term!=='noticePeriodDays'&&relevant.some(v=>v.applicability==='unresolved');
    // Different values inside one document are separate obligations (for example
    // sectional delay damages), not a conflict between sources: never offered here.
    const disagree=values.size>1&&new Set(relevant.map(v=>v.documentId)).size>1;
    if(!disagree&&!unsure)continue;
    const key=CONTRACT_FACT_DECISION_PREFIX+term;
    const fingerprint=hash(['contract-fact-v1',state.projectId,term,date,relevant.map(v=>[v.documentId,v.value,v.unit,v.effectiveFromIso,v.effectiveToIso,v.applicability,Boolean(v.sourceAnalyticalUse),v.sourceRefs])]);
    const saved=state.controls?.reviewDecisions?.[key];
    const candidates=[...values.entries()].map(([valueKey,group])=>({valueKey,value:group[0]!.value,unit:group[0]!.unit,adopted:group.some(v=>!v.sourceAnalyticalUse),documentIds:[...new Set(group.map(v=>v.documentId))],sourceRefs:[...new Set(group.flatMap(v=>v.sourceRefs))]}));
    const units=new Set(candidates.map(c=>c.unit));
    items.push({key,term,label:TERM_LABELS[term],dataDateIso:date,fingerprint,reason:disagree?'sources_disagree':'unsure_reading',candidates,enterUnit:units.size===1?[...units][0]!:null,
      decision:saved&&saved.sourceFingerprint===fingerprint&&isValidChoice(saved.choice,candidates,units.size===1,saved.enteredValue)?{choice:saved.choice,...(saved.enteredValue!==undefined?{enteredValue:saved.enteredValue}:{}),confirmedAt:saved.confirmedAt}:null});
  }
  return items;
}
function isValidChoice(choice:string,candidates:ContractFactDecisionItem['candidates'],canEnter:boolean,entered:number|undefined){
  if(choice==='enter_value')return canEnter&&typeof entered==='number'&&Number.isFinite(entered)&&entered>=0;
  return choice.startsWith('use:')&&candidates.some(c=>c.valueKey===choice.slice(4));
}

/** Applies saved, current decisions. Only the versions in force at the data date
 * are replaced; other intervals and the extracted source terms stay untouched. */
export function applyContractFactDecisions(state:ProjectRuntimeState,versions:ContractTermVersion[],dataDate:string|null):ContractTermVersion[]{
  const items=contractFactDecisionItems(state,versions,dataDate).filter(item=>item.decision);
  if(!items.length)return versions;
  const date=registerDate(dataDate??'')||null;let result=[...versions];
  for(const item of items){
    const decision=item.decision!,ref='user-confirmation:'+item.key+':'+item.fingerprint;
    const replaced=result.filter(v=>v.term===item.term&&applicableAt(v,date));
    // The decision governs the interval in which every replaced version applied
    // (it contains the data date). Each replaced version keeps its own parts
    // before and after that interval, so other dates read exactly as before.
    const from=replaced.map(v=>v.effectiveFromIso).filter((f):f is string=>Boolean(f)).sort().at(-1)??null;
    const to=replaced.map(v=>v.effectiveToIso).filter((t):t is string=>Boolean(t)).sort()[0]??null;
    const keep=result.filter(v=>!replaced.includes(v));
    for(const v of replaced){
      if(from&&(!v.effectiveFromIso||v.effectiveFromIso<from))keep.push({...v,effectiveToIso:from});
      if(to&&(!v.effectiveToIso||v.effectiveToIso>to))keep.push({...v,effectiveFromIso:to});
    }
    if(decision.choice==='enter_value'){
      keep.push({term:item.term,value:decision.enteredValue!,unit:item.enterUnit!,effectiveFromIso:from,effectiveToIso:to,documentId:'user-confirmation',role:'user_decision',sourceRefs:[ref],clauseIdentifier:null,applicability:'prospective',decisionReference:ref,sourceAnalyticalUse:SOURCE_ANALYTICAL_USE,sourceAnalyticalNote:USER_ENTERED_TERM_NOTE});
    }else{
      const chosen=replaced.filter(v=>contractFactValueKey(v)===decision.choice.slice(4));
      keep.push(...chosen.map(v=>({...v,effectiveFromIso:from,effectiveToIso:to,applicability:'prospective' as const,decisionReference:ref,sourceRefs:[...v.sourceRefs,ref]})));
    }
    result=keep;
  }
  return result;
}

/** Validated reviewDecisions patch for the decision place (pick, type, change, undo). */
export function contractFactDecisionPatch(state:ProjectRuntimeState,item:ContractFactDecisionItem,input:{choice?:unknown;enteredValue?:unknown},sourceRefs:string[]){
  const choice=String(input.choice??''),decisions={...(state.controls.reviewDecisions??{})};
  if(choice==='undo'){if(!decisions[item.key])throw new Error('There is no saved decision to undo.');delete decisions[item.key];return {reviewDecisions:decisions};}
  let enteredValue:number|undefined;
  if(choice==='enter_value'){
    const raw=String(input.enteredValue??'').trim();enteredValue=Number(raw);
    if(!item.enterUnit)throw new Error('The read values use different units. Pick one of the read values.');
    if(raw===''||!Number.isFinite(enteredValue)||enteredValue<0)throw new Error('Enter the value to use.');
  }else if(!isValidChoice(choice,item.candidates,Boolean(item.enterUnit),undefined))throw new Error('Select one of the available decisions.');
  decisions[item.key]={sourceFingerprint:item.fingerprint,choice,...(enteredValue!==undefined?{enteredValue}:{}),confirmedAt:new Date().toISOString(),sourceRefs:[...new Set([...sourceRefs,'user-confirmation:'+item.key+':'+item.fingerprint])]};
  return {reviewDecisions:decisions};
}

// T04 (a): the contractual completion date uses the same decision place and the
// same stored form (reviewDecisions['contract-fact:contractualCompletion'],
// additive enteredDateIso field). It is applied to the canonical time position
// and to reportingTimeBasis by applyCompletionDecision, so every page agrees.
export const COMPLETION_DECISION_KEY=CONTRACT_FACT_DECISION_PREFIX+'contractualCompletion';
export const COMPLETION_DECISION_NOTE='Chosen by the user in the decision place; not formally adopted.';
export interface CompletionDecisionItem {key:string;dataDateIso:string|null;fingerprint:string;reason:'sources_disagree'|'unsure_reading';
  candidates:Array<{date:string;adopted:boolean;userConfirmed:boolean;documentIds:string[];sourceRefs:string[]}>;
  decision:{choice:string;enteredDateIso?:string;confirmedAt:string}|null;}
const isoDate=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const completionCache=new WeakMap<ProjectRuntimeState,{version:number;value:CompletionDecisionItem|null}>();
export function completionDecisionItem(state:ProjectRuntimeState):CompletionDecisionItem|null{
  const prior=completionCache.get(state);if(prior&&prior.version===state.version)return prior.value;
  const value=readCompletionDecisionItem(state);completionCache.set(state,{version:state.version,value});return value;
}
function readCompletionDecisionItem(state:ProjectRuntimeState):CompletionDecisionItem|null{
  const asOf=registerDate(projectDataDate(state)??'')||null;
  const position=contractCompletionPosition(state,asOf);
  const stored=state.controls.contractTimeBasis;
  const held=completionHeldByAdoptedBasis(stored,position)?.length&&stored?.contractualCompletionIso?stored.contractualCompletionIso.slice(0,10):null;
  const relevant=position.candidates.filter(c=>!c.historical&&(c.role!=='amendment'||!c.effectiveFrom||!asOf||c.effectiveFrom<=asOf));
  const latest=relevant.filter(c=>c.role==='amendment'&&c.effectiveFrom&&asOf).map(c=>c.effectiveFrom!).sort().at(-1);
  // A base date replaced by an applicable dated amendment is not a competing value.
  const offered=relevant.filter(c=>!latest||(c.role==='amendment'&&(!c.effectiveFrom||c.effectiveFrom===latest)));
  const unsure=position.state==='conflicted'&&/applicability is unresolved/.test(position.reason??'');
  const dates=new Map<string,CompletionDecisionItem['candidates'][number]>();
  for(const c of offered){const row=dates.get(c.date)??{date:c.date,adopted:false,userConfirmed:false,documentIds:[],sourceRefs:[]};
    row.adopted||=!c.sourceAnalytical;if(!row.documentIds.includes(c.documentId))row.documentIds.push(c.documentId);if(!row.sourceRefs.includes(c.sourceRef))row.sourceRefs.push(c.sourceRef);dates.set(c.date,row);}
  if(held){const row=dates.get(held)??{date:held,adopted:false,userConfirmed:true,documentIds:[],sourceRefs:[]};row.userConfirmed=true;
    row.sourceRefs.push(...(stored?.sourceRefs??[]).filter(r=>r.startsWith('user-confirmation:contract-completion:')));dates.set(held,row);}
  const disagree=dates.size>1&&(position.state==='conflicted'||position.sourceConflicts.length>0||Boolean(held));
  if(!disagree&&!unsure)return null;
  const candidates=[...dates.values()];
  const fingerprint=hash(['contract-completion-v1',state.projectId,asOf,held,position.state,candidates.map(c=>[c.date,c.adopted,c.userConfirmed,c.documentIds,c.sourceRefs])]);
  const saved=state.controls?.reviewDecisions?.[COMPLETION_DECISION_KEY];
  const valid=saved&&saved.sourceFingerprint===fingerprint&&(saved.choice==='enter_value'?isoDate(saved.enteredDateIso):saved.choice.startsWith('use:')&&dates.has(saved.choice.slice(4)));
  return {key:COMPLETION_DECISION_KEY,dataDateIso:asOf,fingerprint,reason:disagree?'sources_disagree':'unsure_reading',candidates,
    decision:valid?{choice:saved!.choice,...(saved!.enteredDateIso?{enteredDateIso:saved!.enteredDateIso}:{}),confirmedAt:saved!.confirmedAt}:null};
}
/** The decided completion date on any time basis (canonical or stored); idempotent. */
export function applyCompletionDecision(state:ProjectRuntimeState,basis:ContractTimeBasis|null|undefined):ContractTimeBasis|null|undefined{
  const item=completionDecisionItem(state),decision=item?.decision;
  if(!item||!decision)return basis;
  const ref='user-confirmation:'+item.key+':'+item.fingerprint;
  if(basis?.sourceRefs?.includes(ref))return basis;
  const date=decision.choice==='enter_value'?decision.enteredDateIso!:decision.choice.slice(4);
  const chosen=item.candidates.find(c=>c.date===date);
  const base=withoutCompletionSourceLabel(basis);
  return {...(base??{}),
    contractualCompletionIso:date,contractualCompletionState:'candidate',completionReason:COMPLETION_DECISION_NOTE,
    officialApprovedEotDays:base?.officialApprovedEotDays??null,officialApprovedEotState:base?.officialApprovedEotState??'missing',
    eotDayBasis:base?.eotDayBasis??'unknown',eotDayBasisState:base?.eotDayBasisState??'missing',
    contractualCompletionSourceUse:SOURCE_ANALYTICAL_USE,contractualCompletionSourceNote:COMPLETION_DECISION_NOTE,
    sourceRefs:[...new Set([...(base?.sourceRefs??[]),...(chosen?.sourceRefs??[]),ref])]} as ContractTimeBasis;
}
/** Validated reviewDecisions patch for the completion decision (pick, type, change, undo). */
export function completionDecisionPatch(state:ProjectRuntimeState,item:CompletionDecisionItem,input:{choice?:unknown;enteredDateIso?:unknown},sourceRefs:string[]){
  const choice=String(input.choice??''),decisions={...(state.controls.reviewDecisions??{})};
  if(choice==='undo'){if(!decisions[item.key])throw new Error('There is no saved decision to undo.');delete decisions[item.key];return {reviewDecisions:decisions};}
  const enteredDateIso=choice==='enter_value'?String(input.enteredDateIso??'').trim():undefined;
  if(choice==='enter_value'&&!isoDate(enteredDateIso))throw new Error('Enter a valid contractual completion date.');
  if(choice!=='enter_value'&&!(choice.startsWith('use:')&&item.candidates.some(c=>c.date===choice.slice(4))))throw new Error('Select one of the available decisions.');
  decisions[item.key]={sourceFingerprint:item.fingerprint,choice,...(enteredDateIso?{enteredDateIso}:{}),confirmedAt:new Date().toISOString(),sourceRefs:[...new Set([...sourceRefs,'user-confirmation:'+item.key+':'+item.fingerprint])]};
  return {reviewDecisions:decisions};
}
