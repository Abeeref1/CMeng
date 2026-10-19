// TEMPORARY workload for the r12-perf2 profile probe (not a test file).
// Runs the j8-final-blind-release-acceptance flow (same generator, same gateway,
// same upload headers, same 58 pages and 2 Ask questions, restart) for a subset
// of projects with a fixed seed, and writes timings and masked page hashes.
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import type {AddressInfo} from 'node:net';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {generateBlindRound,generateMixedWorkbookBlindRound,generateLifecycleMixedWorkbookBlindRound,generateSemanticAiBlindRound,type BlindDocument} from './blind-project-generator';

type Project={family:string;projectId:string;documents:BlindDocument[];dataDateIso:string};
const [outDir,countsArg,seedArg,dumpArg]=process.argv.slice(2);
const counts=(countsArg??'10,6,5,4').split(',').map(Number);
const seed=seedArg??'r12-perf2-fixed-seed::J8-FINAL-REAL-ACCEPTANCE';
const dumpCount=Number(dumpArg??'1');
const mask=(text:string)=>text
  .replace(/20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g,(v)=>/^2026-1[0-2]/.test(v)?'<ts>':v)
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<uuid>')
  .replace(/("[A-Za-z]*Ms"):\s*-?\d+(?:\.\d+)?/g,'$1:<ms>')
  .replace(/\b17\d{11}\b/g,'<epoch>');
const hash=(text:string)=>createHash('sha256').update(text).digest('hex').slice(0,16);
function pagePath(projectId:string,page:(typeof moduleRegistry)[number]){
  return '/api/projects/'+encodeURIComponent(projectId)+(page.area==='management'?'/management/'+page.key:'/'+page.area+'/modules/'+page.key);
}

(async()=>{
  const t0=performance.now();
  const [general,mixed,lifecycle,semantic]=await Promise.all([
    generateBlindRound(seed+'::general',counts[0]!),
    generateMixedWorkbookBlindRound(seed+'::mixed',counts[1]!),
    generateLifecycleMixedWorkbookBlindRound(seed+'::lifecycle',counts[2]!),
    generateSemanticAiBlindRound(seed+'::semantic',counts[3]!),
  ]);
  const projects:Project[]=[
    ...general.projects.map(p=>({...p,family:'general'})),...mixed.projects.map(p=>({...p,family:'mixed'})),
    ...lifecycle.projects.map(p=>({...p,family:'lifecycle'})),...semantic.projects.map(p=>({...p,family:'semantic'})),
  ];
  const timings:Record<string,number>={generateMs:performance.now()-t0};
  const root=await mkdtemp(join(tmpdir(),'cmeng-r12-perf2-'));
  let gateway=await createProjectGateway(root,{maxWorkers:4});
  const listen=async()=>{await new Promise<void>(resolve=>gateway.server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+(gateway.server.address() as AddressInfo).port;};
  let base=await listen();
  const request=async(path:string,init?:RequestInit)=>{const response=await fetch(base+path,init),text=await response.text();return {status:response.status,text};};
  const pageMs:Record<string,number>={},askMs:Record<string,number>={};
  const hashes:Record<string,Record<string,string>>={};
  const dumps:Record<string,Record<string,string>>={};
  const dumpIds=new Set<string>();
  for(const family of ['general','mixed','lifecycle','semantic'])projects.filter(p=>p.family===family).slice(0,dumpCount).forEach(p=>dumpIds.add(p.projectId));
  try{
    let s=performance.now();
    for(const project of projects){const r=await request('/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:project.projectId})});if(r.status!==201)throw new Error('create '+r.status);}
    timings.createMs=performance.now()-s;s=performance.now();
    await Promise.all(projects.map(async project=>{
      for(const [index,document] of project.documents.entries()){
        const r=await request('/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/uploads',{method:'POST',headers:{'content-type':document.mediaType,
          'x-source-filename-encoded':encodeURIComponent(document.filename),'x-source-relative-path-encoded':encodeURIComponent(document.filename),'x-upload-intent':'add_update','x-upload-id':'J8-SHARED-'+index},body:Buffer.from(document.bytes)});
        if(r.status!==201)throw new Error('upload '+project.projectId+' '+r.status+' '+r.text.slice(0,200));
      }
    }));
    timings.uploadMs=performance.now()-s;s=performance.now();
    const perProject:Array<{projectId:string;family:string;ms:number;firstPageMs:number}>=[];
    for(const project of projects){
      const ps=performance.now(),P='/api/projects/'+encodeURIComponent(project.projectId);
      const h:Record<string,string>={};hashes[project.projectId]=h;
      const keep=dumpIds.has(project.projectId)?(dumps[project.projectId]={}):null;
      const record=(key:string,text:string)=>{const masked=mask(text);h[key]=hash(masked);if(keep)keep[key]=masked;};
      record('documents',(await request(P+'/evidence/documents')).text);
      await request(P+'/evidence/upload-progress/J8-SHARED-0');
      let firstPageMs=0;
      for(const page of moduleRegistry){
        const qs=performance.now();const r=await request(pagePath(project.projectId,page));const ms=performance.now()-qs;
        if(!firstPageMs)firstPageMs=ms;
        pageMs[page.key]=(pageMs[page.key]??0)+ms;
        record(page.key,r.status+' '+r.text);
      }
      for(const question of ['What is the Data Date?','What is current completion?']){
        const qs=performance.now();
        const r=await request(P+'/intelligence/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question})});
        askMs[question]=(askMs[question]??0)+performance.now()-qs;
        record('ask:'+question,r.status+' '+r.text);
      }
      perProject.push({projectId:project.projectId,family:project.family,ms:performance.now()-ps,firstPageMs});
    }
    timings.pagesAndAskMs=performance.now()-s;s=performance.now();
    await request('/api/portfolio');await request('/api/test-projects');await request('/health');
    await gateway.close();gateway=await createProjectGateway(root,{maxWorkers:4});base=await listen();
    timings.restartMs=performance.now()-s;s=performance.now();
    for(const project of projects){
      const P='/api/projects/'+encodeURIComponent(project.projectId);
      await request(P+'/evidence/documents');
      const overview=await request(P+'/overview');hashes[project.projectId]!['restart:overview']=hash(mask(overview.text));
    }
    timings.afterRestartMs=performance.now()-s;
    timings.totalMs=performance.now()-t0;
    await mkdir(outDir!,{recursive:true});
    await writeFile(join(outDir!,'result.json'),JSON.stringify({seed,counts,projects:projects.length,timings,pageMs,askMs,perProject,hashes}));
    await writeFile(join(outDir!,'dumps.json'),JSON.stringify(dumps));
  }finally{
    await gateway.close();
    await rm(root,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
