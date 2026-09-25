import type {ModuleRuntimeResult} from './project-state-types';
export type PageValueCheck={metric:string;state:'passed'|'failed'|'not_comparable';values:Array<{page:string;value:unknown}>};
const get=(value:any,path:string)=>path.split('.').reduce((v,k)=>v?.[k],value);
const iso=(value:unknown)=>typeof value==='string'?value.slice(0,10):value;
const stable=(value:unknown)=>JSON.stringify(value,(_key,v)=>typeof v==='number'&&Number.isFinite(v)?Number(v.toFixed(7)):v);
/** Reads the actual output of every consumer. Missing a value in one consumer
 * fails when another consumer has that same-basis value. All-null is disclosed. */
export function checkPageValues(pages:Map<string,ModuleRuntimeResult>):PageValueCheck[]{
  const checks:PageValueCheck[]=[];
  const compare=(metric:string,paths:Array<[string,string]>,normalize:(v:unknown)=>unknown=v=>v)=>{
    const values=paths.filter(([key])=>pages.has(key)).map(([page,path])=>({page,value:normalize(get(pages.get(page)?.data,path)??null)}));
    const known=values.filter(r=>r.value!==null&&r.value!==undefined);
    checks.push({metric,state:!known.length||values.length<2?'not_comparable':new Set(values.map(r=>stable(r.value))).size===1?'passed':'failed',values});
  };
  const all=[...pages.keys()];
  compare('Reporting Data Date',all.filter(k=>k!=='source-quality').map(k=>[k,'reportingContract.dataDateIso']),iso);
  compare('Contract completion',[['notices-claims','contractualCompletionIso'],['milestones','contractualCompletionIso'],['independent-forecast','requiredFinishIso']],iso);
  compare('Gross positive programme movement',[['windows-analysis','positiveProgrammeMovementDays'],['eot-assessment','observedProgrammeMovementDays'],['delay-claims','observedPositiveProgrammeMovementDays'],['project-director','claims.observedProgrammeMovementDays'],['board-report','sections.claims.observedProgrammeMovementDays']]);
  compare('Overview and Payments certified state and values',[['commercial-overview','position.currencies'],['payments','position.currencies']]);
  compare('Matched-scope progress gap',[['progress-scurve','scopeComparison.gapPercentagePoints'],['progress-report','scopeComparison.gapPercentagePoints']]);
  compare('Matched-scope schedule ratio',[['progress-scurve','scopeComparison.ratio'],['progress-report','scopeComparison.ratio']]);
  compare('Source productivity finish',[['pmo-analysis','sourceProductivityForecast.completionIso'],['independent-forecast','sourceProductivityForecast.completionIso'],['challenge-contract','sourceProductivityForecast.completionIso'],['master-dashboard','sourceInterpretation.productivityForecast.completionIso'],['command-center','sourceInterpretation.productivityForecast.completionIso']],iso);
  compare('Current claim identity cohort',['notices-claims','delay-claims','windows-analysis','eot-assessment','commercial-claims-notices'].map(k=>[k,'claimsReporting.claims.population.populationId']));
  compare('Current notice cohort',['notices-claims','delay-claims','windows-analysis','eot-assessment','commercial-claims-notices'].map(k=>[k,'claimsReporting.notices.population.populationId']));
  compare('Assessed missing-event dates and verdicts',[['notices-claims','noticeEventDateMissingCount'],['notices-claims','positionVerdict.facts.noticeEventDateMissingCount'],['commercial-claims-notices','position.claimsNotices.noticeTimelinessCounts.event_date_missing'],['commercial-claims-notices','positionVerdict.facts.noticeEventDateMissingCount']]);
  compare('Certificate components and time partitions',['commercial-overview','payments','cash-flow'].map(k=>[k,'position.certificateProfile']));
  compare('Current commercial currency positions',['commercial-overview','cost-forecast','payments','cash-flow','variations-change','commercial-claims-notices','contract-particulars-bonds'].map(k=>[k,'position.currencies']));
  compare('Dated operational actions',[['master-dashboard','operationalReporting.actions'],['command-center','operationalReporting.actions']]);
  compare('HSE reported source figures',[['master-dashboard','sourceInterpretation.hse'],['command-center','sourceInterpretation.hse']]);
  compare('Delivery forecast authority',[['master-dashboard','sourceInterpretation.productivityForecast'],['command-center','sourceInterpretation.productivityForecast']]);
  compare('Confirmed baseline authority',all.filter(k=>k!=='source-quality').map(k=>[k,'baselineComparison']));
  const baselineFields:Record<string,string[]>={
    'activity-analytics':['baselineStartIso','baselineFinishIso','finishVarianceDays'],
    milestones:['baselineDateIso','varianceDays'],
    'lookahead-schedule':['baselineFinishIso'],
    'progress-breakdown':['baselinePlannedPercent','scheduleMinusBaselinePercentagePoints'],
    'variance-trends':['averageFinishVarianceDays','maximumDelayDays','lateActivityCount','earlyActivityCount','onTimeActivityCount','projectCompletionVarianceDays'],
  };
  const unconfirmed=[...pages].filter(([,r])=>(r.data as any)?.baselineComparison?.state==='unresolved');
  const baselineValues=unconfirmed.filter(([k])=>baselineFields[k]).map(([page,r])=>{
    const d=r.data as any,rows=page==='variance-trends'?d.points:d.rows;
    const invalid=(rows??[]).filter((row:any)=>baselineFields[page]!.some(k=>row[k]!==null&&row[k]!==undefined));
    return {page,value:{state:invalid.length?'fabricated_comparison':'unresolved',affectedRows:invalid.length}};
  });
  if(baselineValues.length)checks.push({metric:'No comparisons without a confirmed baseline',state:baselineValues.some(v=>v.value.affectedRows>0)?'failed':'passed',values:baselineValues});
  compare('Overdue activity exceptions',[['lookahead-schedule','overdueCount'],['master-dashboard','deliveryExceptions.overdueActivityCount'],['command-center','deliveryExceptions.overdueActivityCount']]);
  return checks;
}
