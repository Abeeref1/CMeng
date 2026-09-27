/** Reader-facing position over existing schedule authorities. No schedule is recalculated here. */
export function completionPosition(data:any, forecast:any=data, names:Map<string,string>=new Map()) {
  const submitted=forecast.sourceForecastCompletionIso??data.forecast?.sourceCompletionIso??null;
  const calculated=forecast.independentForecastCompletionIso??data.forecast?.independentCompletionIso??null;
  const complete=forecast.complete??data.forecast?.complete??false;
  const origin=forecast.origin??data.forecast?.origin??'unavailable';
  const contract=data.reportingContract?.completionAuthority?.governedContractualFinish??data.contractualCompletionIso??data.claims?.contractualCompletionIso??null;
  const review=data.calendarBasisReview??data.sourceInterpretation?.calendarReview;
  const assumptions:string[]=forecast.assumptions??[];
  const limitations:{key:string;text:string}[]=[];
  if(review?.assignedCalendarMismatchCount>0)limitations.push({key:'calendar-duration',text:review.assignedCalendarMismatchCount+' of '+review.population.denominator+' checked completed activities have recorded durations that differ from working time on their assigned calendars. This is a duration-basis reconciliation, not proof of the cause of delay.'});
  for(const assumption of assumptions){
    if(assumption.startsWith('SOURCE_CONSTRAINTS_RETAINED_NOT_APPLIED'))limitations.push({key:'source-constraints',text:'The recalculation does not apply '+(assumption.split(':')[1]??'the supplied')+' activity date restrictions. The submitted dates retain those restrictions.'});
    else if(assumption==='UNKNOWN_ACTIVITY_STATUS_TREATED_AS_INCOMPLETE')limitations.push({key:'activity-status',text:'Activities with an unknown status are treated as unfinished in this calculation.'});
    else if(assumption==='SOURCE_DURATION_ELAPSED_DAY_PATTERN_REQUIRES_CALENDAR_RECONCILIATION'&&!limitations.some(l=>l.key==='calendar-duration'))limitations.push({key:'calendar-duration',text:'Some recorded durations follow an elapsed-day pattern and need comparison with the assigned working calendars.'});
    else if(!['SOURCE_DURATION_ELAPSED_DAY_PATTERN_REQUIRES_CALENDAR_RECONCILIATION'].includes(assumption))limitations.push({key:assumption,text:assumption.toLowerCase().replaceAll('_',' ').replaceAll(':',': ')});
  }
  if(!complete)limitations.push({key:'incomplete-calculation',text:'The full network finish is unavailable because some activities or logic cannot be calculated. Available submitted dates remain usable.'});
  const independent=complete?calculated:null;
  const elapsed=typeof forecast.forecastVarianceDays==='number'?forecast.forecastVarianceDays:data.forecast?.varianceDays;
  const difference=independent&&submitted&&typeof elapsed==='number'&&Number.isFinite(elapsed)?elapsed:null;
  const scenario=origin!=='deterministic_source_calendar'||limitations.length>0;
  const comparable=(forecast.activities??[]).filter((r:any)=>typeof r.finishVarianceDays==='number'&&Number.isFinite(r.finishVarianceDays));
  const differenceRows=[...comparable].sort((a:any,b:any)=>Math.abs(b.finishVarianceDays)-Math.abs(a.finishVarianceDays)||String(a.activityId).localeCompare(String(b.activityId))).slice(0,20)
    .map((r:any)=>({activityId:r.activityId,name:names.get(r.activityId)??r.name??r.activityId,submittedFinishIso:r.sourceFinishIso,calculatedFinishIso:r.independentEarlyFinishIso,differenceElapsedDays:r.finishVarianceDays}));
  const implication=difference===null?'The available completion dates are shown separately; a like-for-like finish comparison is not established.':Math.abs(difference)<.000001?'The submitted finish and calendar recalculation agree.':
    'The calendar recalculation finishes '+Math.abs(difference).toFixed(2)+' elapsed calendar days '+(difference>0?'later':'earlier')+' than the submitted programme. '+(scenario?'Use this as a comparison with stated assumptions; it is not an approved revised finish.':'The difference identifies programme dates to reconcile.');
  return {submittedFinishIso:submitted,independentFinishIso:independent,contractualFinishIso:contract,differenceElapsedDays:difference,
    calculationState:independent?(scenario?'scenario':'calculated'):'unavailable',complete,origin,
    activityCount:forecast.calculatedActivityCount??null,coveragePercent:forecast.activityCoveragePercent??data.forecast?.activityCoveragePercent??null,
    interpretation:implication,limitations,differenceRows,comparableActivityCount:comparable.length,
    contractNote:contract?'Contract completion is shown separately from both forecasts. A finish comparison does not establish entitlement.':'Contract comparison unavailable: no contractual completion date has been confirmed. This does not prevent programme forecasting.',
    differenceBasis:'Existing programme calculation; exact elapsed calendar-day difference, including time of day. It is not working days, attributable delay or EOT.'};
}
