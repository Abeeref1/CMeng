/** One date-based package position for delivery, actions and workfront readiness. */
export function procurementTiming(input:{dataDateIso:string|null;programmeNeedDate:string|null;sourceRequiredOnSite:string|null;forecastDelivery:string|null;actualDelivery:string|null;status:string;governingDate?:'programme'|'register'|null}){
 // Validate an actual Gregorian source day before date sorting or overdue
 // arithmetic. Date.parse alone can silently normalize 2032-02-30 to March.
 const day=(value:string|null):string|null=>{
  if(typeof value!=='string')return null;
  // A valid day prefix with a malformed time or trailing text is NOT a
  // usable source date. Match the entire timestamp as the canonical reader
  // does; this does not invent a timezone or change the source day.
  const iso=/^(\d{4}-\d{2}-\d{2})(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)?)?$/.exec(value.trim())?.[1];
  if(!iso)return null;
  const millis=Date.parse(iso+'T00:00:00Z');
  return Number.isFinite(millis)&&new Date(millis).toISOString().slice(0,10)===iso?iso:null;
 };
 const cutoff=day(input.dataDateIso),programmeNeedDate=day(input.programmeNeedDate),sourceRequiredOnSite=day(input.sourceRequiredOnSite),forecastDelivery=day(input.forecastDelivery),actualDelivery=day(input.actualDelivery);
 const needDate=input.governingDate==='programme'?programmeNeedDate:input.governingDate==='register'?sourceRequiredOnSite:[programmeNeedDate,sourceRequiredOnSite].filter((value):value is string=>!!value).sort()[0]??null;
 const needDateBasis=input.governingDate==='programme'?'the confirmed programme need date':input.governingDate==='register'?'the confirmed register required-on-site date':!needDate?'need date not established':needDate===sourceRequiredOnSite?'the required-on-site date from the register (screening)':'the linked programme need date (screening)';
 const deliveredAtDataDate=!!actualDelivery&&!!cutoff&&actualDelivery<=cutoff;
 const terminal=/^(delivered|accepted|installed|closed|complete|completed)$/i.test(input.status.trim());
 // The status is evidence of completion, not proof of an actual delivery date or on-time delivery.
 // A recorded future actual date takes precedence over a stale completed-status label.
 const deliveredStatusOnly=!!cutoff&&terminal&&!actualDelivery;
 const deliveryDateConflict=!!cutoff&&terminal&&(!!actualDelivery&&actualDelivery>cutoff||!actualDelivery&&!!forecastDelivery&&forecastDelivery>cutoff);
 const knownUndelivered=!!cutoff&&!deliveredAtDataDate&&!deliveredStatusOnly&&(!!actualDelivery&&actualDelivery>cutoff||!!input.status.trim()&&!terminal);
 const overdueUndelivered=!!needDate&&!!cutoff&&needDate<cutoff&&knownUndelivered;
 const headroomCalendarDays=needDate&&forecastDelivery?(Date.parse(needDate)-Date.parse(forecastDelivery))/86400000:null;
 const forecastLate=!deliveredAtDataDate&&!deliveredStatusOnly&&headroomCalendarDays!==null&&headroomCalendarDays<0;
 return {programmeNeedDate,sourceRequiredOnSite,needDate,needDateBasis,forecastDelivery,deliveredAtDataDate,deliveredStatusOnly,deliveryDateConflict,overdueUndelivered,headroomCalendarDays,forecastLate};
}
