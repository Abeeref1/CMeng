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
  if(['master-dashboard','command-center'].includes(page.key)){
    const metrics=data.metrics??data.programmePosition;
    compare(page.key+' submitted finish against current contract',metrics.find(row=>row.key==='submitted-vs-contract')?.value,15);
    compare(page.key+' calendar recalculation against current contract',metrics.find(row=>row.key==='independent-vs-contract')?.value,15);
  }
  for(const [path,expected] of Object.entries(key.pageAnswers?.[page.key]??{})){
    let actual=value(data,path);if(typeof expected==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(expected)&&typeof actual==='string')actual=actual.slice(0,10);
    compare(page.key+' '+path,actual,expected);
  }
  if(page.key==='contract-particulars-bonds'){
    const ld=data.focus.liquidatedDamages;
    for(const [scenario,expected] of [['no_eot',key.sectionTwoDelayDamages.originalDateExposure],['awarded_eot',key.sectionTwoDelayDamages.extendedDateExposure]]){
      const row=ld.scenarios.find(row=>row.scenario===scenario&&row.currency==='QAR');
      compare('Section 2 '+scenario+' exposure',row?.cappedExposure?.value,expected);
      compare('Section 2 '+scenario+' cap',row?.capAmount?.value,key.sectionTwoDelayDamages.cap);
    }
    compare('Sectional rate count',data.projectFacts.contractSections?.length,2);
    for(const [section,milestone] of Object.entries(key.sectionMilestones??{}))compare('Section '+section+' completion milestone',data.projectFacts.contractSections.find(row=>String(row.sectionId)===section)?.milestoneId,milestone);
  }
  if(page.key==='delivery-permits'){
    compare('Permit supplied validity dates are usable',data.rows.filter(row=>row.validFrom&&row.expiryDate).length,69);
    compare('Pending permit retains its absent validity dates',data.rows.filter(row=>row.reference==='PMT-0069'&&row.permitStatus==='pending'&&row.validFrom===null&&row.expiryDate===null).length,1);
    compare('Permit validity falsely missing',data.rows.filter(row=>['not_established','validity_not_established'].includes(row.permitStatus)).length,0);
    compare('Permit expiry agrees with shared fact',data.rows.filter(row=>row.permitStatus==='expired').length,data.projectFacts.controls.expiredPermitCount.value);
  }
  if(page.key==='delivery-risks'){
    compare('Open risk records',data.rows.filter(row=>row.status==='open').length,73);
    compare('Risk Impact column used',data.rows.filter(row=>typeof row.impact==='number').length,110);
  }
  if(page.key==='resource-utilization'){
    compare('Critical work retains its resource-hour assignments',data.criticalResourceHours?.some(row=>row.remainingHours>0&&row.assignmentCount>0),true);
    compare('Critical resource hours have complete assignment coverage',data.criticalResourceHours?.every(row=>row.knownAssignmentCount===row.assignmentCount),true);
  }
  if(page.key==='material-tracking')compare('Dated installed quantities remain available',data.rows.filter(row=>typeof row.installed==='number').length,896);
  if(page.key==='variance-trends')compare('Human-readable revision labels',Object.values(data.revisionLabels).every(label=>typeof label==='string'&&!/^schedrev_/.test(label)),true);
  if(page.key==='schedule-analytics'){
    const quality=data.projectFacts.programmeQuality;
    compare('Remaining execution float population',quality.remainingActivityCount,220);
    compare('BEI is calculated from the adopted baseline',typeof quality.bei.value==='number'&&Number.isFinite(quality.bei.value),true);
    compare('All baseline dates retain their adopted authority',quality.bei.missingBaselineActivityIds.length,0);
    compare('Programme update gap is explicit',quality.updateGaps.some(g=>g.calendarDays===427),true);
  }
  result.pages.push({key:page.key,bindingCount:data.projectFactBindings?.length??0,mismatches});
 }
 compare('Data date',facts.dataDateIso,key.dataDateIso);
 for(const [path,expected] of Object.entries(key.expected)){
  let actual=value(facts,path)?.value;if(typeof expected==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(expected)&&typeof actual==='string')actual=actual.slice(0,10);
  compare(path,actual,expected);
 }
 for(const [currency,metrics] of Object.entries(key.currencies))for(const [name,expected] of Object.entries(metrics))compare(currency+' '+name,facts.commercial.currencies.find(row=>row.currency===currency)?.[name]?.value,expected);
 const documents=await get(prefix+'/evidence/documents');
 for(const [filename,type] of [['P8_Permit_Register.csv','permit_register'],['P8_Cost_EVM_Monthly_History.csv','cost_evm_report']]){
  const document=documents.documents.find(row=>row.sourceFilename===filename);
  compare(filename+' header classification',document?.classificationReview?.documentType,type);
  compare(filename+' usable source',document?.classificationReview?.usableRegister,true);
 }
 for(const document of documents.documents.filter(row=>row.columnUsage?.length))compare(document.sourceFilename+' recognized columns',document.columnUsage.flatMap(table=>table.ignoredColumns).length,0);
 const director=await get(prefix+'/director-position'),directorData=director.data??director;
 compare('Director snapshot',digest(directorData.projectFacts),digest(facts));
 const actions=await get(prefix+'/actions');compare('Project review action count',actions.actionCount,facts.actions.openCount.value);
 compare('Project review one record per action',new Set(actions.actions.map(row=>row.id)).size,actions.actions.length);
 result.passed=result.checks.every(c=>c.passed);
}catch(error){result.error=error.message;result.passed=false;}
writeFileSync(process.env.CMENG_ANSWER_OUTPUT??'/tmp/cmeng-reem-golden-facts.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({release:result.release,passed:result.passed,checks:result.checks.length,failures:result.checks.filter(c=>!c.passed).map(c=>c.name),error:result.error}));
if(!result.passed)process.exitCode=1;
