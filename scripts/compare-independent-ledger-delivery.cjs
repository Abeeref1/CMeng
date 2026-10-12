const {readFileSync,writeFileSync,mkdtempSync,rmSync}=require('node:fs');const {join,resolve}=require('node:path');const {tmpdir}=require('node:os');const {createHash}=require('node:crypto');
const {reconcilePaymentEvidence}=require('../dist/packages/runtime-api/src/payment-reconciliation');
const {RuntimeProjectStore}=require('../dist/packages/runtime-api/src/project-state');
const {changeDelivery,deliveryStore,deliveryRecords}=require('../dist/packages/runtime-api/src/delivery-records');
const {deliveryPosition}=require('../dist/packages/runtime-api/src/delivery-projections');
const dir=resolve(process.argv[2]),bytes=readFileSync(join(dir,'reference.json')),ref=JSON.parse(bytes),hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==readFileSync(join(dir,'reference.sha256'),'utf8').trim())throw Error('Independent reference changed.');
const results=[];
for(const c of ref.ledger){
 const receipt={documentId:c.id,sourceHash:hash,revision:'R1',locator:'row:'+c.id,basisState:'active',authority:'source_approved'};
 const keys=['applicationAmount','engineerAssessedAmount','employerCertifiedAmount','grossWork','grossCertifiedAmount','variations','variationCertifiedAmount','retentionDeduction','advanceRecovery','otherDeduction','taxAmount','netCertifiedAmount','paidAmount','outstandingAmount'];
 const amounts=Object.fromEntries(keys.map(k=>[k,{value:c.values[k]??null,currency:c.currency,taxBasis:'exclusive',amountBasis:k,state:c.scenario==='candidate'?'candidate':'official',asOf:'2026-08-31',receipts:[receipt]}]));
 const cells={'paid allocation basis':c.scenario==='allocation_unknown'?'unknown':'cumulative allocated to certificate',
  'payment source status':c.scenario==='unposted_receipt'?'draft':'posted',
  'payment date':c.scenario==='undated_receipt'?'':c.scenario==='future_receipt'?'2026-09-01':'2026-08-31','payment reference':'RECEIPT-'+c.id,
  'paid currency':c.scenario==='currency_mismatch'?'EUR':c.currency};
 const actual=reconcilePaymentEvidence({cells,receipt},amounts,'2026-08-31'),differences=[];
 const observed={reconciliation:actual.reconciliation,calculatedOutstandingAmount:actual.calculatedOutstandingAmount.value,fullComponentNet:actual.reconciliation==='unresolved'?null:actual.componentArithmetic.calculatedNet};
 for(const [field,expected] of Object.entries(c.expected))if(typeof expected==='number'?typeof observed[field]!=='number'||!Number.isFinite(observed[field])||Math.abs(observed[field]-expected)>1e-6:observed[field]!==expected)differences.push({field,expected,actual:observed[field]});
 results.push({id:c.id,family:'ledger',pass:!differences.length,differences,actual});
}
async function main(){
 const root=mkdtempSync(join(tmpdir(),'cmeng-delivery-reference-'));const store=new RuntimeProjectStore({dataDir:root,durable:false});
 try{
  const ids=[...new Set(ref.delivery.map(c=>c.projectId))];
  for(const projectId of ids){
   const xer=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectId+'\t2026-08-31','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\tInstallation\tTK_NotStart\t2026-09-10 08:00\t2026-09-11 16:00\t16\t16','%E'].join('\n');
   await store.ingestEvidenceFile({projectId,bytes:Buffer.from(xer),mediaType:'text/plain',sourceFilename:'Current.xer',uploadedAt:'2026-08-31',uploadIntent:'replace_current_basis'});
  }
  for(const c of ref.delivery){
   const state=store.get(c.projectId);state.delivery={schemaVersion:1,manual:[],decisions:[],populations:[]};store.touch(state);
   function change(x){changeDelivery(state,{expectedVersion:state.version,...x});store.touch(state);}
   function create(kind,fields,links={}){change({action:'create',kind,fields});const row=deliveryStore(state).manual.at(-1);change({action:'review',recordId:row.recordId,sourceRevision:row.revision,state:'governed',fields:{},links,note:'Declared reference input for this internal test.'});return deliveryRecords(state).records.find(r=>r.recordId===row.recordId);}
   const target=create('workfront',{'record reference':c.id,description:c.id});
   for(const [i,g] of c.gates.entries())create('gate',{'record reference':c.id+'G'+i,requirement:'Prerequisite '+i,applicable:g.applicable,outcome:g.outcome,'outcome date':g.outcomeDate,'satisfied date':g.satisfiedDate},{recordIds:[target.recordId]});
   if(c.confirmPopulation)change({action:'confirm_population',kind:'gate',scopeId:target.recordId,note:'The frozen reference enumerates the full test population.'});
   const position=deliveryPosition(state),actual=position.readiness.find(r=>r.recordId===target.recordId),differences=[];
   for(const [field,expected] of Object.entries(c.expected)){
    const value=actual?.[field];if(typeof expected==='number'?typeof value!=='number'||!Number.isFinite(value)||Math.abs(value-expected)>(field==='readinessPercent'?0.00005:0.000001):value!==expected)differences.push({field,expected,actual:value});
   }
   results.push({id:c.id,family:'delivery',pass:!differences.length,differences,actual});
  }
 }finally{rmSync(root,{recursive:true,force:true});}
 const report={comparisonPolicy:'Strict types; money/counts tolerance 0.000001. Readiness percentage tolerance 0.00005 matches the public four-decimal rounding. The frozen six-decimal reference remains unchanged.',referenceSha256:hash,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,total:results.length,results};
 writeFileSync(join(dir,process.argv[3]||'comparison.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,failed:report.failed,total:report.total,firstDifferences:results.filter(r=>!r.pass).slice(0,3).map(r=>({id:r.id,differences:r.differences}))}));process.exitCode=report.failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
