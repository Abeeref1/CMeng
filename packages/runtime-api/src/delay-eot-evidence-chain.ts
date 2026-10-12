import type {DeterminationRecord} from './canonical-time-claims';
import type { CanonicalScheduleModel } from "../../schedule-analysis-core/src";
import type { DelayClaimEventAssessmentRow, DelayClaimsProjection } from "../../delay-claims/src";
import type { NoticesClaimsProjection } from "../../notices-claims/src";
import type { WindowsAnalysisProjection } from "../../windows-analysis/src";

export type DelayEvidencePopulationState = "established" | "partial" | "missing" | "quarantined";
export type DelayEvidenceLinkState = "established" | "candidate" | "partial" | "missing" | "conflicted" | "review_required" | "quarantined";
export type DelayEvidenceLinkKey = "event" | "notice" | "activity" | "window" | "impact" | "responsibility" | "eot" | "determination";

export interface DelayEvidenceLink {
  key: DelayEvidenceLinkKey;
  label: string;
  state: DelayEvidenceLinkState;
  value: string | number | null;
  detail: string;
}
export interface DelayEotEvidenceChainRow {
  eventId: string;
  title: string;
  links: DelayEvidenceLink[];
  chainState: "determined" | "candidate" | "review_required" | "incomplete";
}
export interface DelayProgrammePressureRow {
  activityId: string;
  name: string;
  wbsId: string | null;
  baselineFinishIso: string | null;
  currentFinishIso: string | null;
  forecastFinishIso: string | null;
  varianceDays: number | null;
  totalFloatHours: number | null;
  milestone: boolean;
}
export interface DelayProgrammeContext {
  projectCompletionMovementDays: number | null;
  projectCompletionMovementBasis: WindowsAnalysisProjection["projectCompletionMovementBasis"];
  revisionCount: number;
  windowCount: number;
  delayedActivityCount: number;
  negativeFloatActivityCount: number;
  pressuredMilestoneCount: number;
  pressureRows: DelayProgrammePressureRow[];
  basis: "contextual_programme_intelligence_not_contractual_delay_event";
}
export interface DelayEotEvidenceChain {
  producerVersion: "delay-eot-evidence-chain-v1";
  projectId: string | null;
  populationState: DelayEvidencePopulationState;
  sourceClaimCount: number | null;
  quarantinedClaimCount: number | null;
  rows: DelayEotEvidenceChainRow[];
  programmeContext: DelayProgrammeContext;
  linkOrder: DelayEvidenceLinkKey[];
  basis: "event_notice_activity_window_impact_responsibility_eot_determination";
}

const linkOrder: DelayEvidenceLinkKey[] = ["event","notice","activity","window","impact","responsibility","eot","determination"];

function governanceState(value:string|null|undefined):DelayEvidenceLinkState {
  if(value==="official") return "established";
  if(value==="candidate"||value==="provisional") return "candidate";
  if(value==="partial") return "partial";
  if(value==="conflicted") return "conflicted";
  return "missing";
}
function daysBetween(from:string|null,to:string|null):number|null {
  if(!from||!to)return null;
  const a=Date.parse(from.slice(0,10)),b=Date.parse(to.slice(0,10));
  if(!Number.isFinite(a)||!Number.isFinite(b))return null;
  return Number(((b-a)/86400000).toFixed(6));
}
function effectiveFinish(activity:CanonicalScheduleModel["activities"][number]):string|null {
  return activity.status==="completed"
    ? activity.actualFinishIso??activity.currentFinishIso??activity.forecastFinishIso
    : activity.forecastFinishIso??activity.currentFinishIso;
}
function activityPressure(model:CanonicalScheduleModel):DelayProgrammePressureRow[] {
  return model.activities
    .filter(activity=>activity.status!=="completed"&&activity.activityType!=="wbs_summary"&&activity.activityType!=="level_of_effort")
    .map(activity=>{
      const finish=effectiveFinish(activity),baseline=activity.baselineFinishIso??activity.baselineStartIso;
      const varianceDays=daysBetween(baseline,finish);
      const milestone=["milestone","start_milestone","finish_milestone"].includes(activity.activityType);
      return {activityId:activity.activityId,name:activity.name??activity.activityId,wbsId:activity.wbsId,
        baselineFinishIso:baseline,currentFinishIso:activity.currentFinishIso,forecastFinishIso:activity.forecastFinishIso,
        varianceDays,totalFloatHours:activity.totalFloatHours,milestone};
    })
    .filter(row=>(row.varianceDays!==null&&row.varianceDays>0)||(row.totalFloatHours!==null&&row.totalFloatHours<0)||(row.milestone&&row.totalFloatHours!==null&&row.totalFloatHours<=0))
    .sort((a,b)=>(b.varianceDays??Number.NEGATIVE_INFINITY)-(a.varianceDays??Number.NEGATIVE_INFINITY)||
      (a.totalFloatHours??Number.MAX_SAFE_INTEGER)-(b.totalFloatHours??Number.MAX_SAFE_INTEGER)||a.activityId.localeCompare(b.activityId))
    .slice(0,25);
}
function noticeState(event:DelayClaimEventAssessmentRow):DelayEvidenceLinkState {
  if(!event.noticeIds.length)return "missing";
  if(event.noticeTimeliness==="timely")return "established";
  if(event.noticeTimeliness==="late"||event.noticeTimeliness==="requirement_conflicted")return "review_required";
  return "partial";
}
function activityState(event:DelayClaimEventAssessmentRow):DelayEvidenceLinkState {
  if(event.relatedActivityIds.length)return "established";
  if(event.activityCorrespondence?.classification==="candidate")return "candidate";
  if(event.activityCorrespondence?.classification==="ambiguous")return "partial";
  return "missing";
}
function impactState(event:DelayClaimEventAssessmentRow):DelayEvidenceLinkState {
  if(event.describedImpactDays!==null)return governanceState(event.describedImpactState);
  if(event.observedPositiveProgrammeMovementDays!==null)return "candidate";
  return "missing";
}
function eotState(event:DelayClaimEventAssessmentRow):DelayEvidenceLinkState {
  if(event.candidateClass==="concurrency_review")return "review_required";
  if(event.candidateClass==="employer_or_neutral_time_candidate"&&event.responsibilityState==="official"&&
    event.observedPositiveProgrammeMovementDays!==null&&event.observedPositiveProgrammeMovementDays>0)return "candidate";
  return "missing";
}

export function buildDelayEotEvidenceChain(input:{
  schedule:CanonicalScheduleModel;
  determinations?:readonly DeterminationRecord[];
  windows:WindowsAnalysisProjection;
  delay:DelayClaimsProjection;
  notices:NoticesClaimsProjection;
  populationState:DelayEvidencePopulationState;
  sourceClaimCount:number|null;
  quarantinedClaimCount:number|null;
}):DelayEotEvidenceChain {
  const cutoff=input.schedule.dataDateIso?.slice(0,10),effective=(input.determinations??[]).filter(row=>row.state==='source_immutable'&&row.determinationDate&&cutoff&&row.determinationDate.slice(0,10)<=cutoff),superseded=new Set(effective.map(row=>row.supersedes).filter(Boolean));
  const noticeByEvent=new Map(input.notices.events.map(event=>[event.eventId,event]));
  const rows:DelayEotEvidenceChainRow[]=input.delay.events.map(event=>{
    const notice=noticeByEvent.get(event.eventId)??null;
    const awards=effective.filter(row=>!superseded.has(row.determinationId)&&(event.linkedClaimIds.includes(row.claimId)||event.determinationIds.includes(row.determinationId)));
    const awardedDays=awards.length&&awards.every(row=>row.awardedDays!==null)?awards.reduce((sum,row)=>sum+row.awardedDays!,0):null;
    const links:DelayEvidenceLink[]=[
      {key:"event",label:"Event",state:"established",value:event.eventId,detail:"Recorded delay-event identity. Event existence is not causation."},
      {key:"notice",label:"Notice",state:noticeState(event),value:event.noticeIds.join(", ")||null,
        detail:notice?"Notice timeliness: "+notice.noticeTimeliness+".":"No event-linked notice assessment is established."},
      {key:"activity",label:"Activity",state:activityState(event),value:event.relatedActivityIds.join(", ")||null,
        detail:event.relatedActivityIds.length?"Schedule association is established; association is not causation.":"No defensible activity link is established."},
      {key:"window",label:"Window",state:event.overlappingWindowIds.length?"established":input.windows.revisionCount<2?"review_required":"missing",
        value:event.overlappingWindowIds.join(", ")||null,detail:event.overlappingWindowIds.length?"Temporal window association only; not delay attribution.":input.windows.revisionCount<2?"Another comparable programme revision is required before a window can exist.":"No comparable window contains the event."},
      {key:"impact",label:"Impact",state:impactState(event),value:event.describedImpactDays??event.observedPositiveProgrammeMovementDays,
        detail:event.describedImpactDays!==null?"Source-described impact; retain its evidence authority.":event.observedPositiveProgrammeMovementDays!==null?"Observed programme movement is contextual analytical evidence, not causal impact.":"No event-specific impact is established."},
      {key:"responsibility",label:"Responsibility",state:governanceState(event.responsibilityState),
        value:governanceState(event.responsibilityState)==="missing"||event.responsibility==="unknown"?null:event.responsibility,
        detail:event.responsibilityState==="official"?"Responsibility is supported at the stated source authority.":"Responsibility is not established as an official contractual conclusion."},
      {key:"eot",label:"EOT",state:awardedDays!==null?"established":eotState(event),value:awardedDays,
        detail:awardedDays!==null?"Dated Engineer award: "+awardedDays+" calendar days; "+awards.map(row=>row.determinationId).join(', ')+".":eotState(event)==="candidate"?"Analytical EOT candidate only; entitlement and award are not established.":event.candidateClass==="concurrency_review"?"Concurrency requires review before any EOT candidate can be relied upon.":"No event-level EOT entitlement is established."},
      {key:"determination",label:"Determination",state:event.determinationIds.length?"established":"missing",value:event.determinationIds.join(", ")||null,
        detail:event.determinationIds.length?"Dated determination identity linked to the event.":"No determination is linked to the event."},
    ];
    const determination=links.find(link=>link.key==="determination")!,eot=links.find(link=>link.key==="eot")!;
    const review=links.some(link=>["review_required","conflicted","partial"].includes(link.state));
    return {eventId:event.eventId,title:event.title,links,
      chainState:determination.state==="established"?"determined":eot.state==="candidate"?"candidate":review?"review_required":"incomplete"};
  });
  const pressureRows=activityPressure(input.schedule);
  const activities=input.schedule.activities.filter(activity=>activity.status!=="completed"&&activity.activityType!=="wbs_summary"&&activity.activityType!=="level_of_effort");
  const delayedActivityCount=activities.filter(activity=>{const v=daysBetween(activity.baselineFinishIso??activity.baselineStartIso,effectiveFinish(activity));return v!==null&&v>0;}).length;
  const negativeFloatActivityCount=activities.filter(activity=>activity.totalFloatHours!==null&&activity.totalFloatHours<0).length;
  const pressuredMilestoneCount=activities.filter(activity=>{
    const milestone=["milestone","start_milestone","finish_milestone"].includes(activity.activityType);if(!milestone)return false;
    const v=daysBetween(activity.baselineFinishIso??activity.baselineStartIso,effectiveFinish(activity));
    return (v!==null&&v>0)||(activity.totalFloatHours!==null&&activity.totalFloatHours<=0);
  }).length;
  return {
    producerVersion:"delay-eot-evidence-chain-v1",projectId:input.schedule.projectId,populationState:input.populationState,
    sourceClaimCount:input.sourceClaimCount,quarantinedClaimCount:input.quarantinedClaimCount,rows,
    programmeContext:{projectCompletionMovementDays:input.windows.projectCompletionMovementDays,
      projectCompletionMovementBasis:input.windows.projectCompletionMovementBasis,revisionCount:input.windows.revisionCount,
      windowCount:input.windows.windowCount,delayedActivityCount,negativeFloatActivityCount,pressuredMilestoneCount,pressureRows,
      basis:"contextual_programme_intelligence_not_contractual_delay_event"},
    linkOrder,basis:"event_notice_activity_window_impact_responsibility_eot_determination",
  };
}
