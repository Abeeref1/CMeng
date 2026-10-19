import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execSync} from 'node:child_process';
import {mkdtempSync,readdirSync,readFileSync,existsSync,copyFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// TEMPORARY r12-perf2 probe. Builds the unfixed base (5da3be8f) next to this
// build on the SAME runner and runs the j8-final workload subset alternately
// (base, fixed, base, fixed) without a profiler, then compares every page and
// Ask answer of both builds (masked for run timestamps, random ids and paths).
// Finally one profiled run of the fixed build prints the hottest functions.
const BASE='5da3be8f4da660c13f7cedbe33098d934475847e';
const cpuModel=(()=>{try{return (/model name\s*:\s*(.*)/.exec(readFileSync('/proc/cpuinfo','utf8'))?.[1]??'unknown').trim();}catch{return 'unknown';}})();
const seed='r12-perf2-fixed-seed::J8-FINAL-REAL-ACCEPTANCE';

async function run(script:string,out:string,profileDir?:string){
 const args=[...(profileDir?['--cpu-prof','--cpu-prof-dir='+profileDir,'--cpu-prof-interval=1000']:[]),script,out,process.env.R12_COUNTS??'10,6,5,4',seed,'1'];
 const child=spawn(process.execPath,args,{env:{...process.env},stdio:['ignore','ignore','pipe']});
 let errors='';child.stderr.on('data',chunk=>{errors+=chunk;if(errors.length>20000)errors=errors.slice(-20000);});
 const code=await new Promise<number|null>(resolve=>child.on('close',resolve));
 if(code!==0)console.log('R12ERR '+errors.slice(-4000).replace(/\n/g,' | '));
 assert.equal(code,0);
 return {result:JSON.parse(readFileSync(join(out,'result.json'),'utf8')),dumps:JSON.parse(readFileSync(join(out,'dumps.json'),'utf8'))};
}
function pathDiff(a:any,b:any,path:string,out:string[]){
 if(out.length>12)return;
 if(typeof a!==typeof b||Array.isArray(a)!==Array.isArray(b)||(a===null)!==(b===null)){out.push(path+': '+JSON.stringify(a)?.slice(0,160)+' -> '+JSON.stringify(b)?.slice(0,160));return;}
 if(a&&typeof a==='object'){
  if(Array.isArray(a)&&a.length!==b.length)out.push(path+'#length: '+a.length+' -> '+b.length);
  const keys=Array.isArray(a)?[...Array(Math.min(a.length,b.length)).keys()].map(String):[...new Set([...Object.keys(a),...Object.keys(b)])];
  if(!Array.isArray(a)&&JSON.stringify(Object.keys(a))!==JSON.stringify(Object.keys(b)))out.push(path+' keys: '+JSON.stringify(Object.keys(a)).slice(0,200)+' -> '+JSON.stringify(Object.keys(b)).slice(0,200));
  for(const key of keys)pathDiff(a[key],b[key],path+'/'+key,out);return;
 }
 if(a!==b)out.push(path+': '+JSON.stringify(a)?.slice(0,160)+' -> '+JSON.stringify(b)?.slice(0,160));
}
const parse=(text:string)=>{const t=/^\d{3} /.test(text)?text.slice(4):text;try{return JSON.parse(t.replace(/:<ms>/g,':0').replace(/<epoch>/g,'0'));}catch{return t;}};

type Agg={self:Map<string,number>;incl:Map<string,number>;edges:Map<string,Map<string,number>>;total:number};
function addProfile(agg:Agg,profile:any){
 const byId=new Map<number,any>();for(const node of profile.nodes)byId.set(node.id,node);
 const parent=new Map<number,number>();for(const node of profile.nodes)for(const child of node.children??[])parent.set(child,node.id);
 const key=(node:any)=>{const f=node.callFrame;return (f.functionName||'(anon)')+' '+String(f.url).replace(/^.*\/dist\//,'').replace(/^file:\/\//,'')+':'+(f.lineNumber+1);};
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

test('r12-perf2 probe: base and fixed builds on one runner, same pages and Ask answers',{timeout:3_000_000},async()=>{
 console.log('R12CPU '+cpuModel);
 const repo=process.cwd(),work=mkdtempSync(join(tmpdir(),'r12-ab-')),base=join(work,'base');
 let s=Date.now();
 execSync('git fetch -q --depth=1 origin '+BASE+' && git worktree add -q --detach '+base+' '+BASE,{cwd:repo,stdio:'inherit'});
 symlinkSync(resolve(repo,'node_modules'),join(base,'node_modules'));
 copyFileSync(join(repo,'tests','zz-r12-workload.ts'),join(base,'tests','zz-r12-workload.ts'));
 execSync('npm run -s build',{cwd:base,stdio:'inherit'});
 console.log('R12AB base build '+(Date.now()-s)+' ms');
 const scripts={base:join(base,'dist','tests','zz-r12-workload.js'),fixed:join(repo,'dist','tests','zz-r12-workload.js')};
 const results:Record<string,any[]>={base:[],fixed:[]};
 for(const [round,label] of (['base','fixed','base','fixed'] as const).entries()){
  s=Date.now();
  const r=await run(scripts[label],join(work,'out-'+round));
  results[label]!.push(r);
  console.log('R12AB '+label+' round '+round+' wall '+(Date.now()-s)+' ms timings '+JSON.stringify(Object.fromEntries(Object.entries(r.result.timings).map(([k,v])=>[k,Math.round(v as number)]))));
 }
 const total=(label:string)=>results[label]!.map(r=>Math.round(r.result.timings.totalMs));
 console.log('R12AB summary base '+JSON.stringify(total('base'))+' fixed '+JSON.stringify(total('fixed')));
 // Parity: every page and Ask answer of every project, base vs fixed (and base vs base for run noise).
 const compare=(x:any,y:any)=>{const out:string[]=[];for(const [pid,h] of Object.entries<any>(x.result.hashes))for(const [k,v] of Object.entries(h))if(y.result.hashes[pid]?.[k]!==v)out.push(pid+' '+k);return out;};
 const noise=compare(results.base![0],results.base![1]),cross=compare(results.base![0],results.fixed![0]),cross2=compare(results.base![1],results.fixed![1]);
 const entries=Object.values<any>(results.base![0].result.hashes).reduce((n,h)=>n+Object.keys(h).length,0);
 console.log('R12PARITY entries '+entries+' base-vs-base differing '+noise.length+' base-vs-fixed differing '+cross.length+' / '+cross2.length);
 for(const item of cross.slice(0,40))console.log('R12PARITY diff '+item);
 for(const item of cross.slice(0,12)){
  const [pid,key]=[item.slice(0,item.indexOf(' ')),item.slice(item.indexOf(' ')+1)];
  const a=results.base![0].dumps[pid]?.[key],b=results.fixed![0].dumps[pid]?.[key];
  if(a===undefined||b===undefined)continue;
  const out:string[]=[];pathDiff(parse(a),parse(b),'',out);
  for(const line of out)console.log('R12PARITY path '+pid+' '+key+' '+line);
 }
 // One profiled run of the fixed build.
 const prof=join(work,'prof');s=Date.now();
 await run(scripts.fixed,join(work,'out-prof'),prof);
 console.log('R12AB fixed profiled wall '+(Date.now()-s)+' ms');
 const workers:Agg={self:new Map(),incl:new Map(),edges:new Map(),total:0};
 for(const file of existsSync(prof)?readdirSync(prof):[])if(Number(file.split('.')[4])!==0)addProfile(workers,JSON.parse(readFileSync(join(prof,file),'utf8')));
 console.log('R12PROF WORKERS total sampled '+workers.total.toFixed(0)+' ms');
 for(const [k,ms] of [...workers.self].sort((a,b)=>b[1]-a[1]).slice(0,60))console.log('R12PROF WORKERS self '+ms.toFixed(0).padStart(7)+' '+k);
 const incl=[...workers.incl].sort((a,b)=>b[1]-a[1]).filter(([k])=>!/^\(root\)|^\(program\)|^\(garbage|^\(idle/.test(k));
 for(const [k,ms] of incl.slice(0,160))console.log('R12PROF WORKERS incl '+ms.toFixed(0).padStart(7)+' '+k);
 for(const [k,ms] of incl.filter(([k])=>!/node:|runMicrotasks|processTicks/.test(k)).slice(0,100))
  for(const [caller,cms] of [...(workers.edges.get(k)??new Map<string,number>())].sort((a,b)=>b[1]-a[1]).slice(0,4))
   console.log('R12PROF WORKERS caller '+ms.toFixed(0).padStart(7)+' '+k+' <= '+cms.toFixed(0)+' '+caller);
 execSync('git worktree remove --force '+base,{cwd:repo});
 console.log('R12PARITY done');
});
