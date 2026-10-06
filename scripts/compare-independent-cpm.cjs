const {readFileSync,writeFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const {resolve,join}=require('node:path');
const {calculateCpm}=require('../dist/packages/schedule-cpm/src');
const dir=resolve(process.argv[2]);const output=process.argv[3]||'comparison.json';
const bytes=readFileSync(join(dir,'reference.json'));
const hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==readFileSync(join(dir,'reference.sha256'),'utf8').trim())throw Error('Frozen independent reference changed.');
const ref=JSON.parse(bytes);const results=[];
for(const c of ref.cases){
 const activities=c.durations.map((duration,i)=>({projectId:c.id,activityId:'A'+i,nativeId:null,name:'A'+i,wbsId:null,calendarId:'C',activityType:'task',status:'not_started',
 baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
 originalDurationHours:duration,remainingDurationHours:duration,totalFloatHours:null,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
 const model={projectId:c.id,source:'xer',sourceRevisionId:c.id,dataDateIso:c.anchor,activities,
 relationships:c.relationships.map(([p,s,type,lag],i)=>({relationshipId:'R'+i,predecessorActivityId:'A'+p,successorActivityId:'A'+s,type,lagHours:lag,external:false,sourceRefs:[],diagnostics:[]})),wbs:[],calendars:[c.calendar],diagnostics:[]};
 const actual=calculateCpm(model,{allowElapsedFallback:false,assumeUnknownRelationshipTypeFs:false,assumeMissingLagZero:false,requiredFinishIso:c.requiredFinishIso});
 const differences=[];
 if(actual.projectFinishIso!==c.projectFinishIso)differences.push({field:'projectFinishIso',expected:c.projectFinishIso,actual:actual.projectFinishIso});
 for(const e of c.expected){const a=actual.activities.find(x=>x.activityId===e.activityId);for(const [field,value] of Object.entries(e))if(a?.[field]!==value)differences.push({activityId:e.activityId,field,expected:value,actual:a?.[field]});}
 results.push({id:c.id,pass:differences.length===0,differences,actual});
}
const result={referenceSha256:hash,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,total:results.length,results};
writeFileSync(join(dir,output),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({referenceSha256:hash,passed:result.passed,failed:result.failed,total:result.total,firstDifferences:results.filter(r=>!r.pass).slice(0,2).map(r=>({id:r.id,differences:r.differences.slice(0,8)}))}));
process.exitCode=result.failed?1:0;
