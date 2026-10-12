const {readFileSync,writeFileSync}=require('node:fs');const {join,resolve}=require('node:path');const {createHash}=require('node:crypto');
const {buildCommercialFoundation}=require('../dist/packages/commercial-foundation/src');
const {buildCommercialPerformance}=require('../dist/packages/commercial-performance/src');
const {assessEventNotice}=require('../dist/packages/delay-analysis-core/src/notices');
const dir=resolve(process.argv[2]),bytes=readFileSync(join(dir,'reference.json')),ref=JSON.parse(bytes),hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==readFileSync(join(dir,'reference.sha256'),'utf8').trim())throw Error('Independent reference changed.');
const results=[];
for(const c of ref.evm){
 const foundation=buildCommercialFoundation({projectId:c.id,generatedAt:c.date,dataDateIso:c.date,contractValue:null,contractValueCandidates:[],variations:[],contractTimeBasis:null,ldTerms:null,contractSections:[],amendments:[],costMetrics:[],payments:[]});
 const actual=buildCommercialPerformance({projectId:c.id,generatedAt:c.date,dataDateIso:c.date,foundation,
  costSnapshots:[{currency:'AED',taxBasis:c.taxBasis,asOf:c.date,state:c.state,values:c.values,sourceRefs:[c.id+':source-row'],diagnostics:[]}],costMetrics:[],payments:[]});
 const views=[['current',actual.costControl.positions[0]],['history',actual.evmPerformance.series[0]?.points[0]]],differences=[];
 for(const [view,point] of views)for(const [metric,expected] of Object.entries(c.expected)){
  const f=point?.[metric];if(f?.value!==expected)differences.push({view,metric,field:'value',expected,actual:f?.value});
  if(c.state!=='official'&&f?.state==='established')differences.push({view,metric,field:'state',expected:c.expectedState,actual:f?.state});
  if(expected!==null&&c.state==='official'&&f?.state!=='established')differences.push({view,metric,field:'state',expected:'established',actual:f?.state});
 }
 for(const [metric,expected] of Object.entries(c.forecastExpected??{})){
  const p=actual.costControl.positions[0],f=p?.[metric]??p?.eacScenarios.find(s=>s.method===metric)?.value;
  if(f?.value!==expected)differences.push({view:'forecast',metric,field:'value',expected,actual:f?.value});
  if(c.state!=='official'&&f?.state==='established')differences.push({view:'forecast',metric,field:'state',expected:c.expectedState,actual:f?.state});
 }
 results.push({id:c.id,family:'evm',pass:!differences.length,differences,actual});
}
for(const c of ref.notices){
 const event={eventId:c.id,title:c.id,category:'other',startIso:c.scenario==='event_missing'?null:c.event,awarenessIso:c.scenario==='event_missing'?null:c.awareness};
 const notices=c.scenario==='notice_missing'?[]:[{eventId:c.id,noticeId:c.id+'N',kind:'claim_notice',actualIssuedAt:c.scenario==='undated_notice'?null:c.issued}];
 const rules=[{requirementId:'PRE',noticeKind:'claim_notice',eventCategories:[],noticePeriodDays:14,state:'official',triggerBasis:c.triggerBasis,effectiveToIso:c.amendmentDate},
 {requirementId:'POST',noticeKind:'claim_notice',eventCategories:[],noticePeriodDays:21,state:'official',triggerBasis:c.triggerBasis,effectiveFromIso:c.amendmentDate}];
 if(c.scenario==='conflicted')rules.push({...rules[c[c.triggerBasis==='awareness'?'awareness':'event']<c.amendmentDate?0:1],requirementId:'CONFLICT',noticePeriodDays:99});
 const actual=assessEventNotice(event,notices,rules),differences=[];
 for(const [field,expected] of Object.entries(c.expected))if(actual[field]!==expected)differences.push({field,expected,actual:actual[field]});
 results.push({id:c.id,family:'notice',pass:!differences.length,differences,actual});
}
const report={referenceSha256:hash,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,total:results.length,results};
writeFileSync(join(dir,process.argv[3]||'comparison.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed,total:report.total,byFamily:Object.fromEntries(['evm','notice'].map(f=>[f,{pass:results.filter(r=>r.family===f&&r.pass).length,fail:results.filter(r=>r.family===f&&!r.pass).length}])),firstDifferences:results.filter(r=>!r.pass).slice(0,2).map(r=>({id:r.id,differences:r.differences.slice(0,4)}))}));
process.exitCode=report.failed?1:0;
