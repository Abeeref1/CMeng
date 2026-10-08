/** One date-based package position for delivery, actions and workfront readiness. */
export function procurementTiming(input:{dataDateIso:string|null;programmeNeedDate:string|null;sourceRequiredOnSite:string|null;forecastDelivery:string|null;actualDelivery:string|null;status:string}){
 const day=(value:string|null)=>value&&Number.isFinite(Date.parse(value))?value.slice(0,10):null;
 const cutoff=day(input.dataDateIso),programmeNeedDate=day(input.programmeNeedDate),sourceRequiredOnSite=day(input.sourceRequiredOnSite),forecastDelivery=day(input.forecastDelivery),actualDelivery=day(input.actualDelivery);
 const needDate=[programmeNeedDate,sourceRequiredOnSite].filter((value):value is string=>!!value).sort()[0]??null;
 const needDateBasis=needDate===sourceRequiredOnSite?'the required-on-site date from the register':'the linked programme need date';
 const deliveredAtDataDate=!!actualDelivery&&!!cutoff&&actualDelivery<=cutoff;
 const terminal=/^(delivered|accepted|installed|closed|complete|completed)$/i.test(input.status.trim());
 // The status is evidence of completion, not proof of an actual delivery date or on-time delivery.
 // A recorded future actual date takes precedence over a stale completed-status label.
 const deliveredStatusOnly=!!cutoff&&terminal&&!actualDelivery;
 const knownUndelivered=!!cutoff&&!deliveredAtDataDate&&!deliveredStatusOnly&&(!!actualDelivery&&actualDelivery>cutoff||!!input.status.trim()&&!terminal);
 const overdueUndelivered=!!needDate&&!!cutoff&&needDate<cutoff&&knownUndelivered;
 const headroomCalendarDays=needDate&&forecastDelivery?(Date.parse(needDate)-Date.parse(forecastDelivery))/86400000:null;
 const forecastLate=!deliveredAtDataDate&&!deliveredStatusOnly&&headroomCalendarDays!==null&&headroomCalendarDays<0;
 return {programmeNeedDate,sourceRequiredOnSite,needDate,needDateBasis,forecastDelivery,deliveredAtDataDate,deliveredStatusOnly,overdueUndelivered,headroomCalendarDays,forecastLate};
}
