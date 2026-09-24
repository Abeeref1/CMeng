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
  compare('Matched-scope progress gap',[['progress-scurve','scopeComparison.gapPercentagePoints'],['progress-report','scopeComparison.gapPercentagePoints']]);
  compare('Matched-scope schedule ratio',[['progress-scurve','scopeComparison.ratio'],['progress-report','scopeComparison.ratio']]);
  compare('Source productivity finish',[['pmo-analysis','sourceProductivityForecast.completionIso'],['independent-forecast','sourceProductivityForecast.completionIso'],['challenge-contract','sourceProductivityForecast.completionIso'],['master-dashboard','sourceInterpretation.productivityForecast.completionIso'],['command-center','sourceInterpretation.productivityForecast.completionIso']],iso);
  compare('Current claim identity cohort',['notices-claims','delay-claims','windows-analysis','eot-assessment','commercial-claims-notices'].map(k=>[k,'claimsReporting.claims.population.populationId']));
  compare('Current notice cohort',['notices-claims','delay-claims','windows-analysis','eot-assessment','commercial-claims-notices'].map(k=>[k,'claimsReporting.notices.population.populationId']));
  compare('Certificate components and time partitions',['commercial-overview','payments','cash-flow'].map(k=>[k,'position.certificateProfile']));
  compare('Current commercial currency positions',['commercial-overview','cost-forecast','payments','cash-flow','variations-change','commercial-claims-notices','contract-particulars-bonds'].map(k=>[k,'position.currencies']));
  compare('Dated operational actions',[['master-dashboard','operationalReporting.actions'],['command-center','operationalReporting.actions']]);
  compare('HSE reported source figures',[['master-dashboard','sourceInterpretation.hse'],['command-center','sourceInterpretation.hse']]);
  compare('Delivery forecast authority',[['master-dashboard','sourceInterpretation.productivityForecast'],['command-center','sourceInterpretation.productivityForecast']]);
  return checks;
}
