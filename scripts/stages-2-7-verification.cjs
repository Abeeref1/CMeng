// Internal execution evidence; independent acceptance is a separate decision.
const {spawnSync,execFileSync}=require('node:child_process');
const {mkdirSync,writeFileSync,readFileSync,existsSync,openSync,closeSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {randomBytes,createHash}=require('node:crypto');
const root=resolve(__dirname,'..');
const out=resolve(process.argv[2]||'');
if(!process.argv[2]||existsSync(join(out,'run.json')))throw Error('Provide a new evidence directory; retained runs cannot be overwritten.');
mkdirSync(out,{recursive:true});
const built=spawnSync(process.execPath,[join(root,'node_modules/typescript/bin/tsc')],{cwd:root,encoding:'utf8'});
writeFileSync(join(out,'build.log'),(built.stdout||'')+(built.stderr||''));
if(built.status!==0)throw Error('Build must pass before any verification phase starts.');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sourceHash=()=>{
  const names=git('ls-files','packages','tests','scripts','package.json','package-lock.json','tsconfig.json').split('\n').filter(Boolean);
  const h=createHash('sha256');for(const name of names)h.update(name+'\0').update(readFileSync(join(root,name)));
  return h.digest('hex');
};
const phases=[
 {id:'stage2-source-authority',stages:[2],files:['blind-project-generator','batch-j-test-architecture','batch-j-100-case-matrix','batch-j-anti-overfit','canonical-source-integration','parser-reconciliation-integration','source-reconciliation','register-reader-release','system-evidence-governance','evidence-intake-governance','commercial-basis-review','programme-review-workflow','missing-evidence-zero-guard','conflict-downstream-calculation']},
 {id:'stages4-6-fresh-feature-cohorts',stages:[4,5,6],files:['j8-feature-batch-blind-acceptance']},
 {id:'stage7-isolation-durability',stages:[7],files:['j6-blind-storage','j7-blind-enterprise-isolation','runtime-persistence','project-concurrency','runtime-safety-guards','upload-durability']},
 {id:'stage7-fresh-100-projects',stages:[7],files:['j8-final-blind-release-acceptance']},
];
const record={startedAt:new Date().toISOString(),classification:'Internal generated verification; not consultant acceptance or final production release',
 node:process.version,head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),workingChanges:git('diff','--stat'),
 testedSourceHash:sourceHash(),rootSeed:'stages2-7:'+randomBytes(20).toString('hex'),phases:[],acceptance:'Pending'};
const save=()=>writeFileSync(join(out,'run.json'),JSON.stringify(record,null,2)+'\n');save();
for(const phase of phases){
 const row={...phase,startedAt:new Date().toISOString(),status:'running',seed:record.rootSeed+'::'+phase.id};
 record.phases.push(row);save();
 const fd=openSync(join(out,phase.id+'.log'),'w');
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-concurrency=2',...phase.files.map(f=>join(root,'dist/tests/'+f+'.test.js'))],{
  cwd:root,env:{...process.env,CMENG_GENERATOR_SEED:row.seed,CMENG_BLIND_EVIDENCE_DIR:join(out,'inputs')},stdio:['ignore',fd,fd]});
 closeSync(fd);
 row.finishedAt=new Date().toISOString();row.exitCode=result.status;row.signal=result.signal;row.error=result.error?.message;
 row.status=result.status===0?'passed':'failed';
 const log=readFileSync(join(out,phase.id+'.log'),'utf8');
 row.summary=log.split('\n').filter(line=>/^# (tests|pass|fail|cancelled|skipped|duration_ms) /.test(line));
 row.sourceUnchanged=sourceHash()===record.testedSourceHash;
 if(!row.sourceUnchanged)row.status='source_changed';
 save();process.stdout.write(JSON.stringify({id:row.id,status:row.status,summary:row.summary})+'\n');
}
record.finishedAt=new Date().toISOString();record.status=record.phases.every(p=>p.status==='passed')?'passed':'failed';save();
process.exitCode=record.status==='passed'?0:1;
