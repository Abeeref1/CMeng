import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readdirSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

// TEMPORARY r12-perf2 probe: runs the j8-final flow for a subset of projects in a
// child process with --cpu-prof (main thread and every project worker thread
// write a profile), then prints the hottest functions, page timings, the
// workers' own stage timings and masked page hashes for before/after parity.
const cpuModel=(()=>{try{return (/model name\s*:\s*(.*)/.exec(readFileSync('/proc/cpuinfo','utf8'))?.[1]??'unknown').trim();}catch{return 'unknown';}})();

type Agg={self:Map<string,number>;incl:Map<string,number>;edges:Map<string,Map<string,number>>;total:number};
const newAgg=():Agg=>({self:new Map(),incl:new Map(),edges:new Map(),total:0});
function addProfile(agg:Agg,profile:any){
  const byId=new Map<number,any>();for(const node of profile.nodes)byId.set(node.id,node);
  const parent=new Map<number,number>();for(const node of profile.nodes)for(const child of node.children??[])parent.set(child,node.id);
  const keyOf=new Map<number,string>();
  const key=(node:any)=>{let k=keyOf.get(node.id);if(k===undefined){const f=node.callFrame;k=(f.functionName||'(anon)')+' '+String(f.url).replace(/^.*\/dist\//,'').replace(/^file:\/\//,'')+':'+(f.lineNumber+1);keyOf.set(node.id,k);}return k;};
  for(let i=0;i<profile.samples.length;i++){
    const ms=(profile.timeDeltas[i]??0)/1000;agg.total+=ms;
    const node=byId.get(profile.samples[i]);if(!node)continue;
    const k=key(node);agg.self.set(k,(agg.self.get(k)??0)+ms);
    const seen=new Set<string>(),seenEdge=new Set<string>();let child:string|null=null;
    for(let id:number|undefined=node.id;id!==undefined;id=parent.get(id)){
      const kk=key(byId.get(id));
      if(child!==null&&child!==kk&&!seenEdge.has(child+'<'+kk)){seenEdge.add(child+'<'+kk);const m=agg.edges.get(child)??new Map<string,number>();m.set(kk,(m.get(kk)??0)+ms);agg.edges.set(child,m);}
      child=kk;if(seen.has(kk))continue;seen.add(kk);agg.incl.set(kk,(agg.incl.get(kk)??0)+ms);
    }
  }
}
function print(label:string,agg:Agg){
  console.log('R12PROF '+label+' total sampled '+agg.total.toFixed(0)+' ms');
  for(const [k,ms] of [...agg.self].sort((a,b)=>b[1]-a[1]).slice(0,80))console.log('R12PROF '+label+' self '+ms.toFixed(0).padStart(7)+' '+k);
  const incl=[...agg.incl].sort((a,b)=>b[1]-a[1]).filter(([k])=>!/^\(root\)|^\(program\)|^\(garbage|^\(idle/.test(k));
  for(const [k,ms] of incl.slice(0,200))console.log('R12PROF '+label+' incl '+ms.toFixed(0).padStart(7)+' '+k);
  for(const [k,ms] of incl.filter(([k])=>!/node:|runMicrotasks|processTicks/.test(k)).slice(0,120))
    for(const [caller,cms] of [...(agg.edges.get(k)??new Map<string,number>())].sort((a,b)=>b[1]-a[1]).slice(0,4))
      console.log('R12PROF '+label+' caller '+ms.toFixed(0).padStart(7)+' '+k+' <= '+cms.toFixed(0)+' '+caller);
}

test('r12-perf2 probe: profile the j8-final workload subset',{timeout:1_800_000},async()=>{
  console.log('R12CPU '+cpuModel);
  const work=mkdtempSync(join(tmpdir(),'r12-probe-')),prof=join(work,'prof'),out=join(work,'out');
  const counts=process.env.R12_COUNTS??'10,6,5,4';
  // Unprofiled run first: true phase timings (the profiler slows compilation).
  {
   const plainOut=join(work,'plain'),s0=Date.now();
   const plain=spawn(process.execPath,[join(__dirname,'zz-r12-workload.js'),plainOut,counts,'r12-perf2-fixed-seed::J8-FINAL-REAL-ACCEPTANCE','0'],{env:{...process.env},stdio:['ignore','ignore','pipe']});
   let plainErrors='';plain.stderr.on('data',chunk=>{plainErrors+=chunk;if(plainErrors.length>20000)plainErrors=plainErrors.slice(-20000);});
   const plainCode=await new Promise<number|null>(resolve=>plain.on('close',resolve));
   console.log('R12PLAIN child wall '+(Date.now()-s0)+' ms, exit '+plainCode);
   if(plainCode!==0)console.log('R12ERR '+plainErrors.slice(-4000).replace(/\n/g,' | '));
   assert.equal(plainCode,0);
   const r=JSON.parse(readFileSync(join(plainOut,'result.json'),'utf8'));
   console.log('R12PLAIN timings '+JSON.stringify(Object.fromEntries(Object.entries(r.timings).map(([k,v])=>[k,Math.round(v as number)]))));
   console.log('R12PLAIN pages '+JSON.stringify(Object.entries(r.pageMs).sort((a:any,b:any)=>b[1]-a[1]).slice(0,12).map(([k,v]:any)=>[k,Math.round(v)])));
   console.log('R12PLAIN perProject '+JSON.stringify(r.perProject.map((p:any)=>[p.family,Math.round(p.ms),Math.round(p.firstPageMs)])));
   for(const [projectId,h] of Object.entries(r.hashes))console.log('R12PLAINHASH '+projectId+' '+JSON.stringify(h));
  }
  const started=Date.now();
  const child=spawn(process.execPath,['--cpu-prof','--cpu-prof-dir='+prof,'--cpu-prof-interval=1000',join(__dirname,'zz-r12-workload.js'),out,counts,'r12-perf2-fixed-seed::J8-FINAL-REAL-ACCEPTANCE','1'],
    {env:{...process.env},stdio:['ignore','pipe','pipe']});
  const events:any[]=[];let buffer='',errors='';
  child.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(line.startsWith('{"event":'))try{events.push(JSON.parse(line));}catch{}}});
  child.stderr.on('data',chunk=>{errors+=chunk;if(errors.length>20000)errors=errors.slice(-20000);});
  const code=await new Promise<number|null>(resolve=>child.on('close',resolve));
  console.log('R12TIME child wall '+(Date.now()-started)+' ms, exit '+code);
  if(code!==0)console.log('R12ERR '+errors.slice(-4000).replace(/\n/g,' | '));
  assert.equal(code,0);
  const result=JSON.parse(readFileSync(join(out,'result.json'),'utf8'));
  console.log('R12TIME timings '+JSON.stringify(Object.fromEntries(Object.entries(result.timings).map(([k,v])=>[k,Math.round(v as number)]))));
  console.log('R12TIME pages '+JSON.stringify(Object.entries(result.pageMs).sort((a:any,b:any)=>b[1]-a[1]).map(([k,v]:any)=>[k,Math.round(v)])));
  console.log('R12TIME ask '+JSON.stringify(Object.fromEntries(Object.entries(result.askMs).map(([k,v])=>[k,Math.round(v as number)]))));
  console.log('R12TIME perProject '+JSON.stringify(result.perProject.map((p:any)=>[p.projectId,p.family,Math.round(p.ms),Math.round(p.firstPageMs)])));
  for(const [projectId,h] of Object.entries(result.hashes))console.log('R12HASH '+projectId+' '+JSON.stringify(h));
  // Worker stage timings (CMENG_PROFILE_PERF is always on in project workers).
  const byEvent=new Map<string,number>();for(const e of events)byEvent.set(e.event,(byEvent.get(e.event)??0)+1);
  console.log('R12EVENTS counts '+JSON.stringify([...byEvent]));
  const sumParts=(name:string,field:string)=>{const sums=new Map<string,number>();for(const e of events.filter(e=>e.event===name))for(const t of e[field]??[]){const k=t.part??t.key??t.module;sums.set(k,(sums.get(k)??0)+(t.ms??0));}return [...sums].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([k,v])=>[k,Math.round(v)]);};
  const sumFields=(name:string)=>{const sums=new Map<string,number>();for(const e of events.filter(e=>e.event===name))for(const [k,v] of Object.entries(e))if(typeof v==='number'&&/Ms$/.test(k))sums.set(k,(sums.get(k)??0)+v);return [...sums].map(([k,v])=>[k,Math.round(v)]);};
  for(const name of ['project_bundle_profile','project_diagnosis_profile'])console.log('R12EVENTS '+name+' '+JSON.stringify(sumParts(name,'timings')));
  console.log('R12EVENTS project_resolution_profile '+JSON.stringify(sumFields('project_resolution_profile')));
  console.log('R12EVENTS slowCandidates '+JSON.stringify(sumParts('project_resolution_profile','slowCandidates')));
  console.log('R12EVENTS slowReadiness '+JSON.stringify(sumParts('project_resolution_profile','slowReadiness')));
  console.log('R12EVENTS management_surface_profile '+JSON.stringify(sumFields('management_surface_profile')));
  console.log('R12EVENTS management_resolved_modules '+JSON.stringify(sumParts('management_resolved_modules_breakdown','modules')));
  for(const name of ['independent_change_stage_profile','delivery_cold_profile','lookahead_profile'])console.log('R12EVENTS '+name+' '+JSON.stringify(sumParts(name,'stages')));
  for(const name of ['independent_cpm_profile','lookahead_cold_breakdown','management_visual_profile','quantity_mapping_profile'])console.log('R12EVENTS '+name+' '+JSON.stringify(sumFields(name)));
  // CPU profiles: main thread (tid 0) and all worker threads.
  const main=newAgg(),workers=newAgg();let files=0;
  for(const file of existsSync(prof)?readdirSync(prof):[]){
    const tid=Number(file.split('.')[4]);files++;
    addProfile(tid===0?main:workers,JSON.parse(readFileSync(join(prof,file),'utf8')));
  }
  console.log('R12PROF profile files '+files);
  print('MAIN',main);print('WORKERS',workers);
  const dumps=readFileSync(join(out,'dumps.json'));
  const data=gzipSync(dumps).toString('base64');
  for(let i=0,n=Math.ceil(data.length/60000);i<n;i++)console.log('R12CHUNK dumps '+i+' '+n+' '+data.slice(i*60000,(i+1)*60000));
});
