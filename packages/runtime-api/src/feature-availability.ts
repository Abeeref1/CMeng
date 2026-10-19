import {featureAvailability,type FeatureAvailability} from '../../truth-kernel/src';
import {conditionalNotice} from './conditional-notice';

export interface RuntimeFeatureAvailability {
  state: FeatureAvailability;
  reason: string;
  prerequisiteCount: number | null;
  establishedResultCount: number | null;
  prerequisites?: Array<{
    key: string;
    label: string;
    established: boolean;
    evidence: string;
  }>;
}

const array=(value:unknown):any[]=>Array.isArray(value)?value:[];
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;

/** F07: shared project inputs. When supplied, a prerequisite is decided from the
 * one project status every page reads, not from this page's own copy. */
export interface FeatureAvailabilityInputs {
  calendar?:{calendarActivityCount:number|null}|null;
  /** F07: shared BOQ quantity and installed-quantity status (project facts). */
  quantities?:{state:string;boqItemCount:number|null;readableItemCount:number|null;reason:string}|null;
  installedQuantities?:{state:string;measuredItemCount:number|null;boqItemCount:number|null;reason:string}|null;
}
const sharedConfirmed=(status:{state:string}|null|undefined)=>status?.state==='established'||status?.state==='partial';
export function moduleFeatureAvailability(key:string,data:unknown,inputs:FeatureAvailabilityInputs={}):RuntimeFeatureAvailability {
  const d=(data&&typeof data==='object'?data:{}) as any;
  if(key==='forecast-history'){
    const points=array(d.points);
    return {
      state:featureAvailability({hasEstablishedResult:points.length>=2,hasUsefulEvidence:points.length>=1,prerequisitesSatisfied:points.length>=2}),
      reason:points.length>=2?'Two or more comparable revisions are available for a completion trend.':
        points.length===1?'Only one comparable programme revision exists. Show the current completion position, not a trend.':
        'No comparable programme revision is available for completion history.',
      prerequisiteCount:points.length,establishedResultCount:points.length>=2?points.length:null
    };
  }
  if(key==='windows-analysis'){
    const windows=array(d.windows),revisionLabels=d.revisionLabels&&typeof d.revisionLabels==='object'?Object.keys(d.revisionLabels).length:0;
    const comparable=Math.max(revisionLabels,windows.length?windows.length+1:0);
    return {
      state:featureAvailability({hasEstablishedResult:windows.length>0,hasUsefulEvidence:comparable>0,prerequisitesSatisfied:comparable>=2}),
      reason:windows.length?'Comparable programme states are available for window analysis.':
        comparable===1?'Window analysis not yet available — another comparable programme revision is required.':
        'Window analysis not yet available — at least two comparable programme revisions are required.',
      prerequisiteCount:comparable,establishedResultCount:windows.length||null
    };
  }
  if(key==='challenge-contract'){
    const f=d.boqFeasibility??{},checks=array(f.activityChecks),rows=array(f.rows);
    const calculated=checks.filter((row:any)=>['fits','exceeds'].includes(row?.scheduleState)||typeof row?.requiredAveragePeople==='number').length;
    const boqCount=number(d.suppliedBoq?.itemCount)??array(d.suppliedBoq?.rows).length;
    // F07: readable programme calendars come from the shared project status.
    const calendarActivities=(inputs.calendar?inputs.calendar.calendarActivityCount:f.programmeChecks?.calendarActivityCount)??0;
    const prerequisites=[
      // F07: BOQ quantities and installed quantities come from the shared project status.
      inputs.quantities?{key:'boq',label:'BOQ',established:sharedConfirmed(inputs.quantities),evidence:inputs.quantities.reason}:
      {key:'boq',label:'BOQ',established:boqCount>0,evidence:boqCount>0?String(boqCount)+' BOQ item(s) available.':'BOQ quantity scope not established.'},
      inputs.installedQuantities?{key:'remaining_quantities',label:'Remaining quantities',established:sharedConfirmed(inputs.installedQuantities),evidence:'Dated installed quantity and contract quantity on the same BOQ item. '+inputs.installedQuantities.reason}:
      {key:'remaining_quantities',label:'Remaining quantities',established:rows.some((row:any)=>number(row?.remainingQuantity)!==null),evidence:'Dated installed quantity and contract quantity on the same BOQ item.'},
      {key:'activity_links',label:'Activity links',established:rows.some((row:any)=>typeof row?.activityId==='string'&&row.activityId.length>0),evidence:'Current-revision BOQ-to-activity link.'},
      {key:'productivity',label:'Productivity',established:rows.some((row:any)=>number(row?.laborHoursPerUnit)!==null),evidence:'Supported labour-hours-per-unit or same-scope measured productivity.'},
      // SW-46: the calendar and labour-hour evidence sentences state availability only when the data shows it.
      {key:'calendar_working_time',label:'Calendar / working time',established:rows.some((row:any)=>number(row?.availableWorkingHours)!==null)||calendarActivities>0,evidence:conditionalNotice(calendarActivities>0,'Readable programme calendars are available independently of BOQ activity links; item-level working-time checks require those links.',rows.some((row:any)=>number(row?.availableWorkingHours)!==null)?'Working time is available on linked BOQ items; readable programme calendars are not established.':'Readable programme calendars are not established; item-level working-time checks require them and BOQ activity links.')},
      {key:'resource_basis',label:'Resource basis',established:rows.some((row:any)=>number(row?.submittedPeople)!==null)||number(f.programmeChecks?.remainingLaborHours)!==null,evidence:conditionalNotice(number(f.programmeChecks?.remainingLaborHours)!==null,'Submitted activity-linked labour hours are available; independent required headcount also needs quantity/productivity evidence.',rows.some((row:any)=>number(row?.submittedPeople)!==null)?'Submitted headcount is available on BOQ items; submitted activity-linked labour hours are not established.':'Submitted activity-linked labour hours and submitted headcount are not established.')},
    ];
    const prerequisiteComplete=prerequisites.every(row=>row.established);
    const useful=boqCount>0||checks.length>0||rows.length>0||Boolean(d.sourceLaborEvidence);
    const missing=prerequisites.filter(row=>!row.established).map(row=>row.label);
    return {
      state:featureAvailability({hasEstablishedResult:calculated>0&&prerequisiteComplete,hasUsefulEvidence:useful,prerequisitesSatisfied:prerequisiteComplete}),
      reason:calculated>0&&prerequisiteComplete?'All six delivery-challenge prerequisites are represented and at least one independent feasibility check is calculable.':
        useful?'Useful source evidence is available. Missing prerequisite(s): '+missing.join(', ')+'.':
        'No useful quantity/productivity/resource evidence is available for a feasibility challenge.',
      prerequisiteCount:prerequisites.length,establishedResultCount:calculated||null,prerequisites
    };
  }
  if(key==='revision-trend'||key==='variance-trends'){
    const points=array(d.points);
    return {
      state:featureAvailability({hasEstablishedResult:points.length>=2,hasUsefulEvidence:points.length>=1,prerequisitesSatisfied:points.length>=2}),
      reason:points.length>=2?'Two or more comparable controlled programme revisions are available for trend analysis.':
        points.length===1?'Only one comparable controlled programme revision exists. Show the current revision position, not a trend.':
        'No comparable controlled programme revision is available for trend analysis.',
      prerequisiteCount:points.length,establishedResultCount:points.length>=2?points.length:null
    };
  }
  if(key==='schedule-change-report'){
    const compared=Boolean(d.fromRevisionId&&d.toRevisionId)&&Array.isArray(d.changedActivities);
    const hasAny=Boolean(d.toRevisionId||d.fromRevisionId||Array.isArray(d.changedActivities));
    return {
      state:featureAvailability({hasEstablishedResult:compared,hasUsefulEvidence:hasAny,prerequisitesSatisfied:compared}),
      reason:compared?'A controlled from/to revision pair is available for change comparison.':
        hasAny?'Programme evidence exists, but a controlled from/to revision pair is not established for change comparison.':
        'At least two controlled programme revisions are required before Programme Changes can be calculated.',
      prerequisiteCount:compared?2:hasAny?1:0,establishedResultCount:compared?2:null
    };
  }
  if(key==='quantity-scurve'){
    const series=array(d.series),mapped=series.filter((row:any)=>array(row?.points).length>0).length;
    // F07: measured installation is the shared installed-quantity status when supplied.
    const measured=inputs.installedQuantities?sharedConfirmed(inputs.installedQuantities):
      d.installedQuantityStatus?.state==='available'||number(d.measurementReview?.measuredItemCount)!==null&&Number(d.measurementReview?.measuredItemCount)>0;
    const boqCount=number(d.boqItemCount)??number(d.suppliedBoq?.itemCount)??0;
    const useful=boqCount>0||series.length>0||Boolean(d.boqRevisionId)||Boolean(d.suppliedBoq?.revisionId)||Boolean(d.measurementReview);
    return {
      state:featureAvailability({hasEstablishedResult:mapped>0||measured,hasUsefulEvidence:useful,prerequisitesSatisfied:mapped>0||measured}),
      reason:mapped>0||measured?'A mapped planned quantity curve or measured installed-quantity position is available.':
        useful?'BOQ/quantity evidence is available, but a planned curve needs governed mapping and installed progress needs dated quantity evidence.':
        'No BOQ or installed-quantity evidence is available.',
      prerequisiteCount:boqCount||null,establishedResultCount:mapped||null
    };
  }
  return {state:'active',reason:'The feature has no additional conditional activation rule.',prerequisiteCount:null,establishedResultCount:null};
}
