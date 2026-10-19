import {createHash} from 'node:crypto';
import {registerDate} from '../../truth-kernel/src';
import type {ContractTermKey,ContractTermVersion} from './contract-term-versions';
import {SOURCE_ANALYTICAL_USE} from './contract-source-analysis';
import type {ProjectRuntimeState} from './project-state-types';

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
