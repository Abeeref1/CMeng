/** One date-based package position for delivery, actions and workfront readiness. */
/** SW-17: register columns that state how long before the linked activity start
 * the package must be on site (review / inspection / site lead time). A bare
 * "lead time" column is NOT read: it normally states the supplier's
 * order-to-delivery period, which gives a latest order date, not a need date. */
export const PROCUREMENT_LEAD_REVIEW_HEADERS=['lead/review time','lead review time','review time','review period','review days','site lead time','lead time before start','required lead time before start'];
/** The record's stated lead/review time in calendar days. Blank is not stated
 * (no default is applied). A value that is not a whole number of calendar days
 * (for example working days or free text) is unreadable: it is never converted. */
export function statedLeadReviewDays(raw:string|null|undefined):{state:'not_stated'|'stated'|'unreadable';days:number|null;raw:string}{
 const text=typeof raw==='string'?raw.trim():'';
 if(!text)return {state:'not_stated',days:null,raw:''};
 const match=/^(\d{1,4})(?:\s*(?:calendar\s+)?(?:days?|d))?$/i.exec(text);
 return match?{state:'stated',days:Number(match[1]),raw:text}:{state:'unreadable',days:null,raw:text};
}
export function procurementTiming(input:{dataDateIso:string|null;programmeNeedDate:string|null;sourceRequiredOnSite:string|null;forecastDelivery:string|null;actualDelivery:string|null;status:string;governingDate?:'programme'|'register'|null;leadReviewTime?:string|null}){
 // Validate an actual Gregorian source day before date sorting or overdue
 // arithmetic. Date.parse alone can silently normalize 2032-02-30 to March.
 const day=(value:string|null):string|null=>{
  if(typeof value!=='string')return null;
  // A valid day prefix with a malformed time or trailing text is NOT a
  // usable source date. Match the entire timestamp as the canonical reader
  // does; this does not invent a timezone or change the source day.
  const iso=/^(\d{4}-\d{2}-\d{2})(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))?)?$/.exec(value.trim())?.[1];
  if(!iso)return null;
  const millis=Date.parse(iso+'T00:00:00Z');
  return Number.isFinite(millis)&&new Date(millis).toISOString().slice(0,10)===iso?iso:null;
 };
 // SW-17: programmeNeedDate input is the linked activity start in the current
 // programme. The need date is that start less the record's stated lead/review
 // time; with no stated time it is the start itself (no fixed default). A
 // stated but unreadable time leaves the programme need date not established.
 const leadReview=statedLeadReviewDays(input.leadReviewTime),programmeStartDate=day(input.programmeNeedDate);
 const programmeNeedDate=!programmeStartDate||leadReview.state==='unreadable'?null:leadReview.days?new Date(Date.parse(programmeStartDate+'T00:00:00Z')-leadReview.days*86400000).toISOString().slice(0,10):programmeStartDate;
 const leadNote=leadReview.days?' (linked activity start '+programmeStartDate+' less the stated '+leadReview.days+' calendar-day lead/review time)':'';
 const cutoff=day(input.dataDateIso),sourceRequiredOnSite=day(input.sourceRequiredOnSite),forecastDelivery=day(input.forecastDelivery),actualDelivery=day(input.actualDelivery);
 const needDate=input.governingDate==='programme'?programmeNeedDate:input.governingDate==='register'?sourceRequiredOnSite:[programmeNeedDate,sourceRequiredOnSite].filter((value):value is string=>!!value).sort()[0]??null;
 const needDateBasis=input.governingDate==='programme'?'the confirmed programme need date'+leadNote:input.governingDate==='register'?'the confirmed register required-on-site date':!needDate?'need date not established':needDate===sourceRequiredOnSite?'the required-on-site date from the register (screening)':'the linked programme need date (screening)'+leadNote;
 const deliveredAtDataDate=!!actualDelivery&&!!cutoff&&actualDelivery<=cutoff;
 const status=typeof input.status==='string'?input.status.trim():'';
 const terminal=/^(delivered|accepted|installed|closed|complete|completed)$/i.test(status);
 // Missing, disputed or unverified statuses are not proof of non-delivery.
 const indeterminateStatus=/^(?:unknown|not known|not established|not verified|unverified|tbd|tbc|unclear|disputed|undetermined)$/i.test(status);
 // SW-18: "Not applicable" is its own state. It is neither known delivered nor
 // known undelivered, so no date can turn it into an overdue or late blocker.
 const notApplicable=/^(?:not applicable|n\/a|na)$/i.test(status);
 // SW-18: an explicit not-yet-delivered status with an actual delivery dated on
 // or before the reporting date contradicts that date; raise it for review.
 const openStatus=/^(?:pending|open|not delivered|undelivered|awaiting delivery|not started|planned|scheduled|ordered|on order|in production|manufacturing|in manufacture|fabrication|in fabrication|in transit|shipped|dispatched)$/i.test(status);
 const openStatusDeliveredConflict=!!cutoff&&openStatus&&!!actualDelivery&&actualDelivery<=cutoff;
 // The status is evidence of completion, not proof of an actual delivery date or on-time delivery.
 // A recorded future actual date takes precedence over a stale completed-status label.
 const deliveredStatusOnly=!!cutoff&&terminal&&!actualDelivery;
 const deliveryDateConflict=!!cutoff&&terminal&&(!!actualDelivery&&actualDelivery>cutoff||!actualDelivery&&!!forecastDelivery&&forecastDelivery>cutoff);
 const knownUndelivered=!!cutoff&&!notApplicable&&!deliveredAtDataDate&&!deliveredStatusOnly&&(!!actualDelivery&&actualDelivery>cutoff||!!status&&!terminal&&!indeterminateStatus);
 const overdueUndelivered=!!needDate&&!!cutoff&&needDate<cutoff&&knownUndelivered;
 const headroomCalendarDays=needDate&&forecastDelivery?(Date.parse(needDate)-Date.parse(forecastDelivery))/86400000:null;
 const forecastLate=!notApplicable&&!deliveredAtDataDate&&!deliveredStatusOnly&&headroomCalendarDays!==null&&headroomCalendarDays<0;
 return {programmeStartDate,leadReview,programmeNeedDate,sourceRequiredOnSite,needDate,needDateBasis,forecastDelivery,deliveredAtDataDate,deliveredStatusOnly,deliveryDateConflict,openStatusDeliveredConflict,notApplicable,overdueUndelivered,headroomCalendarDays,forecastLate};
}
