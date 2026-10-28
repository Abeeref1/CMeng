import {spawn,type ChildProcess} from 'node:child_process';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {join} from 'node:path';
import assert from 'node:assert/strict';

// Shared real-browser harness: the process, Chrome and DevTools helpers first written
// for F01, exported so other real-browser regression tests use the same code.
// Not a test file (no .test suffix), so the runner never executes it on its own.
// ---------- process helpers (only processes started here are ever stopped)
export async function freePort(){
  return new Promise<number>((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=(s.address() as any).port;s.close(()=>resolve(port));});});
}
/** Stops a process this test started, and the processes it started in turn: each child is spawned
 * as the leader of its own process group, so the group signal reaches only that child's descendants. */
export function own(child:ChildProcess){
  // If this test process ends abruptly, still end the process groups it started.
  const pid=child.pid;if(pid!==undefined)process.once('exit',()=>{try{process.kill(-pid,'SIGKILL');}catch{}});
  return child;
}
export function stop(child:ChildProcess|null){
  if(!child||child.pid===undefined||child.exitCode!==null||child.signalCode!==null)return Promise.resolve();
  const signal=(name:NodeJS.Signals)=>{try{process.kill(-child.pid!,name);}catch{try{child.kill(name);}catch{}}};
  return new Promise<void>(resolve=>{
    const timer=setTimeout(()=>{signal('SIGKILL');resolve();},8000);
    child.once('exit',()=>{clearTimeout(timer);signal('SIGKILL');resolve();});
    signal('SIGTERM');
  });
}
export function chromeBinary(){
  if(process.env.CHROME_PATH)return existsSync(process.env.CHROME_PATH)?process.env.CHROME_PATH:null;
  if(existsSync('/usr/bin/google-chrome'))return '/usr/bin/google-chrome';
  const root='/opt/pw-browsers';
  if(existsSync(root))for(const dir of readdirSync(root).filter(d=>/^chromium-\d+$/.test(d)).sort().reverse()){
    const candidate=join(root,dir,'chrome-linux','chrome');if(existsSync(candidate))return candidate;}
  return null;
}

// ---------- minimal Chrome DevTools Protocol client over the global WebSocket
export class Cdp{
  private next=1;private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void}>();
  private listeners:Array<(method:string,params:any,sessionId?:string)=>void>=[];
  constructor(private socket:WebSocket){
    socket.addEventListener('message',event=>{
      const message=JSON.parse(String((event as MessageEvent).data));
      if(message.id){const waiter=this.pending.get(message.id);if(!waiter)return;this.pending.delete(message.id);
        if(message.error)waiter.reject(new Error(message.error.message));else waiter.resolve(message.result);}
      else for(const listener of this.listeners)listener(message.method,message.params,message.sessionId);
    });
    socket.addEventListener('close',()=>{for(const waiter of this.pending.values())waiter.reject(new Error('DevTools socket closed'));this.pending.clear();});
  }
  static async connect(url:string){
    const socket=new WebSocket(url);
    await new Promise<void>((resolve,reject)=>{socket.addEventListener('open',()=>resolve());socket.addEventListener('error',()=>reject(new Error('DevTools connection failed '+url)));});
    return new Cdp(socket);
  }
  send(method:string,params:Record<string,unknown>={},sessionId?:string,timeoutMs=60_000):Promise<any>{
    const id=this.next++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('DevTools '+method+' timed out'));},timeoutMs);
      this.pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});
      this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
  }
  on(listener:(method:string,params:any,sessionId?:string)=>void){this.listeners.push(listener);}
  close(){try{this.socket.close();}catch{}}
}
export async function launchChrome(binary:string,profile:string){
  const child=own(spawn(binary,['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--no-sandbox','--disable-gpu',
    '--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking',
    '--window-size=1440,1000','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe'],detached:true}));
  // Chrome reports its DevTools address on stderr and in <profile>/DevToolsActivePort; either one
  // is accepted. If Chrome does not start, its whole process group is stopped before the test
  // fails, so a failed start can never leave a browser holding the test process open.
  const kill=()=>{try{process.kill(-child.pid!,'SIGKILL');}catch{try{child.kill('SIGKILL');}catch{}}};
  const url=await new Promise<string>((resolve,reject)=>{
    let log='',done=false;
    const finish=(error:Error|null,value?:string)=>{if(done)return;done=true;clearTimeout(timer);clearInterval(poll);
      if(error){kill();child.stderr?.destroy();reject(error);}else resolve(value!);};
    const timer=setTimeout(()=>finish(new Error('Chrome did not start within 120 s: '+log.slice(-2000))),120_000);
    const poll=setInterval(()=>{try{const [port,path]=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n');
      if(port&&path)finish(null,'ws://127.0.0.1:'+port.trim()+path.trim());}catch{}},250);
    child.stderr!.on('data',d=>{log=(log+d).slice(-20000);const m=/DevTools listening on (ws:\/\/\S+)/.exec(log);if(m)finish(null,m[1]!);});
    child.once('exit',code=>finish(new Error('Chrome exited '+code+': '+log.slice(-2000))));
  });
  return {child,url};
}


/** The real built server on its own data folder and port; started here, so this test may stop it. */
// CMENG_TEST_SERVER runs the same invariant against another build (for example the previous release).
export const BUILT_SERVER=process.env.CMENG_TEST_SERVER||join(__dirname,'../packages/runtime-api/src/project-gateway.js');
export async function startBuiltServer(dataDir:string,port:number,extraEnv:Record<string,string|undefined>={}){
  const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:dataDir,PORT:String(port),HOST:'127.0.0.1'};
  for(const name of ['RAILWAY_VOLUME_MOUNT_PATH','NODE_TEST_CONTEXT','CMENG_PROJECT_WORKER','NODE_OPTIONS'])delete env[name];
  for(const [name,value] of Object.entries(extraEnv)){if(value===undefined)delete env[name];else env[name]=value;}
  const child=own(spawn(process.execPath,[BUILT_SERVER],{env,stdio:['ignore','pipe','pipe'],detached:true}));
  let log='';child.stdout!.on('data',d=>{log=(log+d).slice(-20000);});child.stderr!.on('data',d=>{log=(log+d).slice(-20000);});
  const deadline=Date.now()+60_000;
  for(;;){
    if(child.exitCode!==null)assert.fail('server exited during start: '+log.slice(-3000));
    try{const r=await fetch('http://127.0.0.1:'+port+'/health',{signal:AbortSignal.timeout(2000)});if(r.ok)return child;}catch{}
    if(Date.now()>deadline)assert.fail('server did not answer /health within 60 s: '+log.slice(-3000));
    await new Promise(r=>setTimeout(r,300));
  }
}
/** A small valid P6 programme: one five-day calendar, a chain of tasks, a finish milestone. */
export function smallProgrammeXer(projectId:string,dataDate:string,names:(i:number)=>string=i=>'Works package '+(i+1),count=12){
  const shift=(iso:string,days:number)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  const shifts=[['08:00','12:00'],['13:00','17:00']] as const;
  const intervals=shifts.map(([s,e],i)=>'(0||'+i+'(s|'+s+'|f|'+e+')())').join('');
  const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d>=2&&d<=6?intervals:'')+'))').join('');
  const calendar='(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()())))'.replaceAll('(0||','\x7f\x7f  (0||');
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectId+'\t'+dataDate,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tMain Works',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\tC1\tFive Day 8h\t8\t40\t'+calendar,
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'];
  for(let i=0;i<count;i++){
    const last=i===count-1,start=shift(dataDate,i*7),finish=shift(dataDate,i*7+6);
    lines.push(['%R',String(2000+i),'1','10','C1',last?'MS-FINISH':'ACT-'+(100+i),last?'Project Completion':names(i),
      last?'TT_FinMile':'TT_Task','TK_NotStart',last?finish:start,finish,last?finish:start,finish,last?'0':'40',last?'0':'40','0','0'].join('\t'));
  }
  lines.push('%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt');
  for(let i=1;i<count;i++)lines.push(['%R',String(7000+i),'1',String(2000+i),'1',String(1999+i),'PR_FS','0'].join('\t'));
  lines.push('%E');
  return lines.join('\n');
}
