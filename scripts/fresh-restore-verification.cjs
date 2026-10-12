// A stopped-store, relocated-volume restore with independently retained input hashes.
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const crypto=require('node:crypto');
const {RuntimeProjectStore}=require('../dist/packages/runtime-api/src/project-state');
const {changeDelivery}=require('../dist/packages/runtime-api/src/delivery-records');
const out=path.resolve(process.argv[2]||'');
if(!process.argv[2]||fs.existsSync(path.join(out,'result.json')))throw Error('Use a new evidence directory.');
fs.mkdirSync(out,{recursive:true});
const seed=crypto.randomBytes(20).toString('hex'),root=fs.mkdtempSync(path.join(os.tmpdir(),'cmeng-restore-'));
const active=path.join(root,'active'),backup=path.join(root,'backup'),restored=path.join(root,'restored');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
let cases=Array.from({length:10},(_,i)=>{
 const id='RESTORE-'+digest(seed+':'+i).slice(0,12).toUpperCase(),count=20+crypto.randomInt(80);
 const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+id+'\t2026-08-31','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt'];
 for(let j=0;j<count;j++){const hours=crypto.randomInt(1,81);lines.push(['%R',j+1,1,'A'+j,id+' activity '+j,'TK_NotStart',hours,hours].join('\t'));}
 const source=Buffer.from([...lines,'%E'].join('\n'));fs.writeFileSync(path.join(out,id+'.xer'),source);
 return {id,count,sha256:digest(source),source,gateRef:'GATE-'+crypto.randomBytes(8).toString('hex')};
});
if(process.argv[3]){const original=path.resolve(process.argv[3]);cases=JSON.parse(fs.readFileSync(path.join(original,'inputs.json'),'utf8')).projects.map(p=>({...p,source:fs.readFileSync(path.join(original,p.id+'.xer'))}));for(const c of cases)fs.writeFileSync(path.join(out,c.id+'.xer'),c.source);}
fs.writeFileSync(path.join(out,'inputs.json'),JSON.stringify({seed,classification:'Internal fresh restore verification; not deployment rollback acceptance',projects:cases.map(({source,...p})=>p)},null,2));
async function main(){
 const results=[];
 try{
  const store=new RuntimeProjectStore({dataDir:active,durable:true});
  for(const c of cases){
   await store.ingestEvidenceFile({projectId:c.id,bytes:c.source,mediaType:'text/plain',sourceFilename:c.id+'.xer',uploadedAt:'2026-08-31',uploadIntent:'replace_current_basis'});
   const s=store.get(c.id);changeDelivery(s,{expectedVersion:s.version,action:'create',kind:'gate',fields:{'record reference':c.gateRef,requirement:'Restored prerequisite'}});store.touch(s);
   c.version=s.version;c.documentId=s.evidenceDocuments[0].documentId;
  }
  // Complete the existing source-schema migration before measuring restore identity.
  // Raw ingestion marks v3; first reopen migrates it to v7 and legitimately increments version.
  const settled=new RuntimeProjectStore({dataDir:active,durable:true});
  for(const c of cases)c.version=settled.get(c.id).version;
  // No writer remains active after this point. Copy the entire volume, not just JSON.
  fs.cpSync(active,backup,{recursive:true});fs.renameSync(active,path.join(root,'unavailable-original'));
  fs.cpSync(backup,restored,{recursive:true});
  const recovered=new RuntimeProjectStore({dataDir:restored,durable:true});
  for(const c of cases){
   const s=recovered.get(c.id),checks={project:!!s,version:s?.version===c.version,activities:s?.schedules[0]?.revision.model.activities.length===c.count,
    decision:s?.delivery?.manual.some(r=>Object.values(r.fields).includes(c.gateRef)),sourceIdentity:s?.evidenceDocuments[0]?.documentId===c.documentId,sourceHash:s?.evidenceDocuments[0]?.sourceHashSha256===c.sha256};
   try{checks.sourceBytes=digest(fs.readFileSync(s.evidenceDocuments[0].storedPath))===c.sha256;}catch{checks.sourceBytes=false;}
   results.push({id:c.id,expectedVersion:c.version,actualVersion:s?.version,checks,pass:Object.values(checks).every(v=>v===true)});
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 const report={seed,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,total:cases.length,scope:'Quiescent full-volume backup, relocation, source-byte recovery and Delivery record preservation. Deployment rollback remains separate.',results};
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exitCode=report.failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
