import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {projectFactConsumerMismatches}=require('../dist/packages/runtime-api/src/project-fact-consumers.js');
const {moduleRegistry}=require('../dist/packages/runtime-api/src/registry.js');
const key=JSON.parse(readFileSync(new URL('../tests/fixtures/reem-112-golden-facts.json',import.meta.url),'utf8'));
const base=process.env.CMENG_RAILWAY_URL?.replace(/\/$/,''),release=process.env.CMENG_EXPECTED_RELEASE;
if(!base||!/^[a-f0-9]{40}$/.test(release??''))throw Error('Set the review URL and exact deployed commit before running this read-only answer check.');
const result={release,projectId:key.projectId,kind:'API answer comparison; does not replace the live 62-page walk',checks:[],pages:[]};
const get=async path=>{const response=await fetch(base+path,{signal:AbortSignal.timeout(90000)});if(![200,409].includes(response.status))throw Error(path+' HTTP '+response.status);return response.json();};
const digest=object=>createHash('sha256').update(JSON.stringify(object)).digest('hex');
const value=(object,path)=>path.split('.').reduce((o,k)=>o?.[k],object);
const compare=(name,actual,expected)=>result.checks.push({name,actual,expected,passed:Object.is(actual,expected)});
try{
 const health=await get('/health');compare('Exact release',health.release,release);if(health.release!==release)throw Error('Review site is running a different commit.');
 const prefix='/api/projects/'+encodeURIComponent(key.projectId);
 let facts;
 for(const page of moduleRegistry){
  const path=page.area==='management'?'/management/'+page.key:'/'+page.area+'/modules/'+page.key;
  const response=await get(prefix+path),data=response.data;
  if(!data?.projectFacts)throw Error('Shared facts missing from '+page.key);
  if(!facts)facts=data.projectFacts;
  compare(page.key+' snapshot',digest(data.projectFacts),digest(facts));
  const mismatches=projectFactConsumerMismatches(data);compare(page.key+' displayed fact fields',mismatches.length,0);
  result.pages.push({key:page.key,bindingCount:data.projectFactBindings?.length??0,mismatches});
 }
 compare('Data date',facts.dataDateIso,key.dataDateIso);
 for(const [path,expected] of Object.entries(key.expected)){
  let actual=value(facts,path)?.value;if(typeof expected==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(expected)&&typeof actual==='string')actual=actual.slice(0,10);
  compare(path,actual,expected);
 }
 for(const [currency,metrics] of Object.entries(key.currencies))for(const [name,expected] of Object.entries(metrics))compare(currency+' '+name,facts.commercial.currencies.find(row=>row.currency===currency)?.[name]?.value,expected);
 result.passed=result.checks.every(c=>c.passed);
}catch(error){result.error=error.message;result.passed=false;}
writeFileSync(process.env.CMENG_ANSWER_OUTPUT??'/tmp/cmeng-reem-golden-facts.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({release:result.release,passed:result.passed,checks:result.checks.length,failures:result.checks.filter(c=>!c.passed).map(c=>c.name),error:result.error}));
if(!result.passed)process.exitCode=1;
