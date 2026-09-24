import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {CanonicalQuantityProgressModel} from '../../quantity-progress-core/src';
import type {CanonicalResourceModel} from '../../schedule-resource-core/src';
import {resolveWorkingCalendar, workingHoursBetween, addWorkingHours} from '../../schedule-cpm/src';

export interface LaborProductivityBasis {
  quantityItemId: string;
  activityId: string;
  unit: string;
  laborHoursPerUnit: number;
  sourceRefs: string[];
}
export interface BoqFeasibilityRow {
  quantityItemId: string; activityId: string | null; description: string; unit: string | null;
  remainingQuantity: number | null; laborHoursPerUnit: number | null;
  productivityBasis: 'supplied_rate' | 'measured_same_scope' | 'unresolved';
  requiredLaborHours: number | null; availableWorkingHours: number | null;
  requiredAveragePeople: number | null; submittedPeople: number | null; manpowerGap: number | null;
  submittedFinishIso: string | null; productionFinishIso: string | null;
  manpowerState: 'calculated' | 'unresolved'; scheduleState: 'fits' | 'exceeds' | 'unresolved';
  reason: string; scheduleReason: string; sourceRefs: string[];
}
const instant=(s:string|null)=>s&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const rounded=(n:number)=>Number(n.toFixed(6));
const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0;

/** Calculates quantities -> labor hours -> people and durations. No crew multiplier,
 * elapsed calendar fallback, scope allocation or missing attendance is invented. */
export function buildBoqFeasibility(input:{schedule:CanonicalScheduleModel;quantities:CanonicalQuantityProgressModel|null;resources:CanonicalResourceModel|null;rates?:LaborProductivityBasis[]}) {
  const {schedule, quantities, resources}=input, dataDate=instant(schedule.dataDateIso);
  const activities=new Map(schedule.activities.map(a=>[a.activityId,a]));
  const resourceById=new Map((resources?.resources??[]).map(r=>[r.resourceId,r]));
  const allocations=new Map<string,NonNullable<typeof quantities>['allocations']>();
  const activityItems=new Map<string,Set<string>>();
  for(const a of quantities?.allocations??[]){const list=allocations.get(a.quantityItemId)??[];list.push(a);allocations.set(a.quantityItemId,list);const ids=activityItems.get(a.activityId)??new Set<string>();ids.add(a.quantityItemId);activityItems.set(a.activityId,ids);}
  const assignments=new Map<string,NonNullable<typeof resources>['assignments']>();
  for(const a of resources?.assignments??[]){const resource=a.resourceId?resourceById.get(a.resourceId):null;
    if((a.resourceType==='labor'||resource?.resourceType==='labor')&&/^(h|hr|hrs|hour|hours|labor hour|labour hour)$/i.test(resource?.unitAbbreviation??resource?.unitName??'')){const list=assignments.get(a.activityId)??[];list.push(a);assignments.set(a.activityId,list);}}
  const snapshots=new Map<string,NonNullable<typeof quantities>['installedSnapshots']>();
  for(const s of quantities?.installedSnapshots??[]){const date=instant(s.asOfIso);if(dataDate===null||date===null||date>dataDate)continue;const list=snapshots.get(s.quantityItemId)??[];list.push(s);snapshots.set(s.quantityItemId,list);}
  const rates=new Map<string,LaborProductivityBasis[]>();
  for(const rate of input.rates??[]){const key=rate.quantityItemId+'|'+rate.activityId;const list=rates.get(key)??[];list.push(rate);rates.set(key,list);}
  const rows:BoqFeasibilityRow[]=[];
  for(const item of quantities?.items??[]){
    const row:BoqFeasibilityRow={quantityItemId:item.quantityItemId,activityId:null,description:item.description,unit:item.unit,remainingQuantity:null,laborHoursPerUnit:null,productivityBasis:'unresolved',requiredLaborHours:null,availableWorkingHours:null,requiredAveragePeople:null,submittedPeople:null,manpowerGap:null,submittedFinishIso:null,productionFinishIso:null,manpowerState:'unresolved',scheduleState:'unresolved',reason:'',scheduleReason:'',sourceRefs:item.sourceRefs.map(r=>r.source+':'+r.locator)};
    rows.push(row);
    const fail=(reason:string)=>{row.reason=reason;row.scheduleReason=reason;};
    if(quantities?.scheduleRevisionId!==schedule.sourceRevisionId){fail('BOQ-to-activity mapping belongs to a different schedule revision; confirm the current links.');continue;}
    const links=allocations.get(item.quantityItemId)??[];
    if(dataDate===null){fail('Schedule data date is unresolved.');continue;}
    if(links.length!==1||!positive(item.contractQuantity)||Math.abs(links[0]!.allocatedQuantity-item.contractQuantity)>0.000001){fail('Confirm the complete BOQ item allocation to one activity, or provide measured progress for each split allocation.');continue;}
    const link=links[0]!,activity=activities.get(link.activityId);row.activityId=link.activityId;
    row.sourceRefs.push(...link.sourceRefs.map(r=>r.source+':'+r.locator));
    if(!activity){fail('The linked activity is absent from the current programme.');continue;}
    row.submittedFinishIso=activity.forecastFinishIso??activity.currentFinishIso;
    const history=(snapshots.get(item.quantityItemId)??[]).sort((a,b)=>Date.parse(b.asOfIso)-Date.parse(a.asOfIso));
    const latest=history[0],sameDate=history.filter(s=>s.asOfIso===latest?.asOfIso);
    if(!latest||latest.asOfIso.slice(0,10)!==schedule.dataDateIso?.slice(0,10)||new Set(sameDate.map(s=>s.installedQuantity)).size!==1||latest.installedQuantity<0||latest.installedQuantity>item.contractQuantity){fail('Installed quantity at the reporting date is missing, stale or conflicting.');continue;}
    row.remainingQuantity=rounded(item.contractQuantity-latest.installedQuantity);
    const supplied=(rates.get(item.quantityItemId+'|'+activity.activityId)??[]).filter(r=>r.unit.toUpperCase()===item.unit?.toUpperCase()&&positive(r.laborHoursPerUnit));
    const labor=resources?.sourceRevisionId===schedule.sourceRevisionId?(assignments.get(activity.activityId)??[]):[];
    if(supplied.length){
      if(new Set(supplied.map(r=>r.laborHoursPerUnit)).size!==1){fail('Supplied labor productivity rates conflict.');continue;}
      row.laborHoursPerUnit=supplied[0]!.laborHoursPerUnit;row.productivityBasis='supplied_rate';row.sourceRefs.push(...supplied.flatMap(r=>r.sourceRefs));
    }else if(activityItems.get(activity.activityId)?.size===1&&latest.asOfIso.slice(0,10)===schedule.dataDateIso?.slice(0,10)&&latest.installedQuantity>0&&labor.length&&labor.every(a=>a.actualRegularUnits!==null&&a.actualRegularUnits>=0&&a.actualOvertimeUnits!==null&&a.actualOvertimeUnits>=0)){
      const actual=labor.reduce((sum,a)=>sum+a.actualRegularUnits!+a.actualOvertimeUnits!,0);
      if(actual>0){row.laborHoursPerUnit=actual/latest.installedQuantity;row.productivityBasis='measured_same_scope';row.sourceRefs.push(...latest.sourceRefs.map(r=>r.source+':'+r.locator),...labor.flatMap(a=>a.sourceRefs.map(r=>r.source+':'+r.locator)));}
    }
    if(row.laborHoursPerUnit===null){fail('Provide labor hours per unit for this BOQ item, or measured installed quantity and complete labor hours for the same activity, scope and reporting date.');continue;}
    row.requiredLaborHours=rounded(row.remainingQuantity*row.laborHoursPerUnit);
    const start=instant(activity.forecastStartIso??activity.currentStartIso), finish=instant(row.submittedFinishIso);
    const calendar=resolveWorkingCalendar(activity.calendarId,schedule.calendars,false)?.calendar;
    if(!calendar||start===null||finish===null||finish<=Math.max(start,dataDate)||finish-Math.max(start,dataDate)>36524*86400000){fail('A readable activity calendar and a positive remaining work period are required.');continue;}
    const from=Math.max(start,dataDate),hours=workingHoursBetween(calendar,from,finish);
    if(!positive(hours)){fail('The remaining scheduled period has no established working hours.');continue;}
    row.availableWorkingHours=rounded(hours);row.requiredAveragePeople=rounded(row.requiredLaborHours/hours);row.manpowerState='calculated';
    row.reason='Remaining BOQ quantity × labor hours per unit ÷ source-calendar working hours. This is an analytical requirement, not attendance.';
    if(!labor.length||labor.some(a=>!positive(a.remainingUnitsPerHour))||labor.some(a=>{const resource=a.resourceId?resourceById.get(a.resourceId):null;return resource?.calendarId&&resource.calendarId!==activity.calendarId;})){row.scheduleReason='Provide activity-linked remaining crew capacity on the same working calendar to calculate an achievable finish.';continue;}
    row.submittedPeople=rounded(labor.reduce((sum,a)=>sum+a.remainingUnitsPerHour!,0));row.manpowerGap=rounded(row.submittedPeople-row.requiredAveragePeople);
  }
  const grouped=new Map<string,BoqFeasibilityRow[]>();
  for(const row of rows)if(row.activityId){const group=grouped.get(row.activityId)??[];group.push(row);grouped.set(row.activityId,group);}
  const activityChecks=[...grouped].map(([activityId,items])=>{
    const first=items[0]!,complete=items.every(r=>r.manpowerState==='calculated'),activity=activities.get(activityId);
    const requiredLaborHours=complete?rounded(items.reduce((sum,r)=>sum+r.requiredLaborHours!,0)):null;
    const availableWorkingHours=complete?first.availableWorkingHours:null;
    const requiredAveragePeople=requiredLaborHours!==null&&positive(availableWorkingHours)?rounded(requiredLaborHours/availableWorkingHours):null;
    const submittedPeople=items.every(r=>r.submittedPeople!==null)?first.submittedPeople:null;
    let productionFinishIso:string|null=null,scheduleState:BoqFeasibilityRow['scheduleState']='unresolved';
    let reason=items.find(r=>r.manpowerState==='unresolved')?.reason??first.scheduleReason;
    if(requiredLaborHours!==null&&positive(submittedPeople)&&activity&&dataDate!==null){
      const calendar=resolveWorkingCalendar(activity.calendarId,schedule.calendars,false)?.calendar;
      const start=instant(activity.forecastStartIso??activity.currentStartIso),finish=instant(first.submittedFinishIso);
      if(calendar&&start!==null&&finish!==null)try{productionFinishIso=new Date(addWorkingHours(calendar,Math.max(start,dataDate),requiredLaborHours/submittedPeople)).toISOString();scheduleState=Date.parse(productionFinishIso)>finish?'exceeds':'fits';reason='All linked BOQ items are included at the supplied activity crew capacity on its calendar. This local check does not resolve project-wide resource sharing, sequence or EOT.';}catch{reason='The quantity-driven duration exceeds the supported calendar calculation range.';}
    }
    return {activityId,itemCount:items.length,requiredLaborHours,availableWorkingHours,requiredAveragePeople,submittedPeople,manpowerGap:requiredAveragePeople!==null&&submittedPeople!==null?rounded(submittedPeople-requiredAveragePeople):null,submittedFinishIso:first.submittedFinishIso,productionFinishIso,scheduleState,reason,sourceRefs:[...new Set(items.flatMap(r=>r.sourceRefs))]};
  });
  const unresolvedCount=rows.filter(r=>r.manpowerState==='unresolved').length;
  const assessed=activityChecks.filter(r=>r.scheduleState!=='unresolved'),insufficient=assessed.filter(r=>r.scheduleState==='exceeds').length;
  const overallStatus=insufficient?'Challenge required':!assessed.length?'Unable to assess':unresolvedCount||activityChecks.some(r=>r.scheduleState==='unresolved')?'Further evidence required':'No material contradiction found';
  return {method:'boq_quantity_labor_productivity_working_calendar' as const,state:rows.length&&!unresolvedCount?'calculated' as const:'unresolved' as const,overallStatus,reason:!rows.length?'BOQ quantities are not established.':unresolvedCount?unresolvedCount+' BOQ items require quantity, productivity, mapping or calendar evidence.':'Item requirements are calculated from the stated production basis. This does not prove whole-programme feasibility.',unresolvedCount,requiredLaborHours:rows.length&&!unresolvedCount?rounded(rows.reduce((sum,r)=>sum+r.requiredLaborHours!,0)):null,rows,activityChecks};
}
