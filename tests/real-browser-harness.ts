import {spawn,type ChildProcess} from 'node:child_process';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import {join} from 'node:path';

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

