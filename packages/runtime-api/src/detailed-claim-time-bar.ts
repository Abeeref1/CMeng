import type {NoticeRequirement,DetailedClaimTimeBar} from '../../delay-analysis-core/src';

const days=(a:string|null,b:string|null)=>a&&b?(Date.parse(b.slice(0,10))-Date.parse(a.slice(0,10)))/86400000:null;
const plusDays=(d:string,n:number):string|null=>{
 const base=Date.parse(d.slice(0,10)),instant=base+n*86400000;
 return Number.isFinite(base)&&Number.isFinite(n)&&Number.isFinite(instant)&&
   !Number.isNaN(new Date(instant).getTime())?new Date(instant).toISOString().slice(0,10):null;
};

export interface DetailedClaimInputs {awarenessIso:string|null;eventStartIso:string|null;submittedIso:string|null;cutoffIso:string|null;
 /** The claim's initial notice date, when recorded. Optional: older callers pass none. */
 noticeIso?:string|null}

/** ABB G5_DELAY-27: when the awareness date is not recorded but the claim notice
 * date is, awareness cannot be later than that notice (a notice is given after the
 * party becomes aware). Each awareness-triggered official calendar-day rule that
 * could cover an awareness date on or before the notice therefore gives a latest
 * possible due date. The bound is used only when those rules cover every earlier
 * date without a gap or overlap; otherwise it stays not established. It never
 * becomes the due date itself. */
function latestPossibleDue(noticeIso:string|null|undefined,rules:readonly NoticeRequirement[]){
 const notice=noticeIso?noticeIso.slice(0,10):null;
 if(!notice||!Number.isFinite(Date.parse(notice)))return null;
 const covering=rules.filter(rule=>!rule.effectiveFromIso||rule.effectiveFromIso<=notice)
  .sort((a,b)=>(a.effectiveFromIso??'').localeCompare(b.effectiveFromIso??''));
 if(!covering.length)return null;
 for(const rule of covering){
  if(rule.state!=='official'||rule.applicabilityState==='unresolved'||rule.sourceDayBasis==='working'||rule.triggerBasis!=='awareness')return null;
  if(typeof rule.noticePeriodDays!=='number'||!Number.isFinite(rule.noticePeriodDays)||rule.noticePeriodDays<0)return null;
 }
 // One interval chain from the earliest date to the notice: no gap, no overlap.
 if(covering[0]!.effectiveFromIso)return null;
 for(let i=1;i<covering.length;i++)if(covering[i-1]!.effectiveToIso!==covering[i]!.effectiveFromIso)return null;
 if(covering.at(-1)!.effectiveToIso&&covering.at(-1)!.effectiveToIso!<=notice)return null;
 const ends=covering.map(rule=>{const last=rule.effectiveToIso&&rule.effectiveToIso<=notice?rule.effectiveToIso:notice;return plusDays(last,rule.noticePeriodDays);});
 if(ends.some(end=>end===null))return null;
 const latest=(ends as string[]).sort().at(-1)!;
 const periods=[...new Set(covering.map(rule=>rule.noticePeriodDays))];
 return {latest,notice,rules:covering,limit:periods.length===1?periods[0]!:null};
}

/** One detailed-claim deadline rule for every page (F47). The contract's own
 * detailed-claim period (for example FIDIC 20.2.4) is applied only when exactly
 * one official, calendar-day, established rule covers the trigger date, and the
 * trigger (awareness or event start) is the one that rule states. Anything else
 * is "not established": no default period and no inferred date. */
export function detailedClaimDeadline(input:DetailedClaimInputs,rules:readonly NoticeRequirement[]){
 const {awarenessIso:awareness,eventStartIso:eventStart,submittedIso:submitted,cutoffIso:cutoff}=input;
 const candidates=rules.filter(rule=>{
  if(rule.applicabilityState==='unresolved'||rule.sourceDayBasis==='working')return false;
  const trigger=rule.triggerBasis==='awareness'?awareness:rule.triggerBasis==='event_start'?eventStart:null;
  return trigger&&(!rule.effectiveFromIso||trigger>=rule.effectiveFromIso)&&(!rule.effectiveToIso||trigger<rule.effectiveToIso);
 });
 const rule=candidates.length===1&&candidates[0]!.state==='official'?candidates[0]!:null;
 const trigger=rule?.triggerBasis==='awareness'?awareness:rule?.triggerBasis==='event_start'?eventStart:null;
 // An ill-formed period from an otherwise matched clause is not an
 // established contractual deadline. Retain the rule and claim for review;
 // never throw or substitute zero when the source value is invalid.
 const declaredLimit=rule&&typeof rule.noticePeriodDays==='number'&&Number.isFinite(rule.noticePeriodDays)&&rule.noticePeriodDays>=0?rule.noticePeriodDays:null;
 const due=trigger&&declaredLimit!==null?plusDays(trigger,declaredLimit):null;
 // A valid rule period can remain known while its trigger is missing; an
 // unrepresentable due date cannot establish even a usable period comparison.
 const limit=declaredLimit!==null&&(!trigger||due!==null)?declaredLimit:null;
 // Awareness not recorded: the latest possible due date from the claim notice date.
 const bound=!due&&!awareness?latestPossibleDue(input.noticeIso,rules):null;
 const boundState=bound?(submitted?(submitted>bound.latest?'late':null):cutoff&&bound.latest<cutoff?'overdue_no_submission':null):null;
 const detailedClaimState=!due?(boundState??'due_basis_missing'):submitted?(submitted<=due?'within_period':'late'):cutoff&&due<cutoff?'overdue_no_submission':'submission_not_recorded';
 return {rule:rule??(bound&&bound.rules.length===1?bound.rules[0]!:null),trigger,due,limit:limit??bound?.limit??null,detailedClaimState,daysAfterDue:due&&submitted?days(due,submitted):null,
  latestDueDateIso:bound?.latest??null,
  basis:rule&&due&&limit!==null?'Documented detailed-claim period of '+limit+' calendar days from '+(rule.triggerBasis==='awareness'?'awareness':'event start')+'.'
   :bound?'The awareness date is not recorded. Awareness cannot be later than the claim notice of '+bound.notice+', so under the documented '+(bound.limit!==null?bound.limit+'-day ':'')+'detailed-claim period from awareness the detailed claim was due by '+bound.latest+' at the latest; the exact due date is not established.'
   :'The applicable detailed-claim period and starting event are not established; no deadline is assumed.'};
}

/** Per-claim time-bar position carried on the claim record. Only a recorded
 * submission on or before the due date is "on_time" and only a recorded
 * submission after it is "late"; a missing submission or missing rule/trigger
 * stays "not_established" (no submission is never treated as late). */
export function detailedClaimTimeBar(input:DetailedClaimInputs,rules:readonly NoticeRequirement[]):DetailedClaimTimeBar{
 const d=detailedClaimDeadline(input,rules);
 const triggerBasis=d.rule?.triggerBasis;
 const status=d.detailedClaimState==='within_period'?'on_time':d.detailedClaimState==='late'?'late':'not_established';
 // The rule's own document and located pages; a document-wide clause list is not the governing clause.
 const locators=[...new Set((d.rule?.evidenceRefs??[]).map(ref=>ref.locator))];
 const ruleRef=d.rule?(d.rule.sourceFilename??d.rule.requirementId)+(locators.length?' ('+locators.join(', ')+')':''):null;
 const why=d.latestDueDateIso&&d.detailedClaimState!=='due_basis_missing'?(d.detailedClaimState==='late'?'The recorded submission is after the latest possible due date.':'The latest possible due date has passed and no detailed-claim submission date is recorded; lateness is not established without the submission record.'):d.detailedClaimState==='due_basis_missing'?(!d.rule?'No single official calendar-day detailed-claim rule in the contract covers this claim.':'The '+(d.rule.triggerBasis==='awareness'?'awareness':'event start')+' date is not recorded.')
  :d.detailedClaimState==='overdue_no_submission'?'Due date has passed and no detailed-claim submission date is recorded; lateness is not established without the submission record.'
  :d.detailedClaimState==='submission_not_recorded'?'No detailed-claim submission date is recorded.':null;
 return {status,sourceState:d.detailedClaimState,
  triggerBasis:triggerBasis==='awareness'||triggerBasis==='event_start'?triggerBasis:null,
  triggerDateIso:d.trigger,submittedIso:input.submittedIso,dueDateIso:d.due,...(d.latestDueDateIso?{latestDueDateIso:d.latestDueDateIso}:{}),allowedDays:d.limit,
  daysToSubmission:d.trigger&&input.submittedIso?days(d.trigger,input.submittedIso):null,daysAfterDue:d.daysAfterDue,
  ruleReference:ruleRef,basis:d.basis+(why?' '+why:'')+' Screening only; no waiver, entitlement or time-bar determination is made.',
  sourceRefs:(d.rule?.evidenceRefs??[]).map(ref=>ref.sourceType+':'+ref.sourceId+':'+ref.locator)};
}
