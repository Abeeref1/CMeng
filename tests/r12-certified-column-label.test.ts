import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ExcelJS from 'exceljs';
import {PDFDocument,StandardFonts} from 'pdf-lib';

// R12 (F01 follow-up, found by the F01 real-browser walk): a payment certificate
// register whose only certified column is Net Certified showed that net amount
// labelled "Gross certified" on Payments, Commercial Overview and Cash Flow. The
// certificate reader now records which column each certified amount came from,
// and the shared commercial position labels the figure by that column. Figures
// do not change; only the label and its basis field.
// Three projects are uploaded through the real upload routes of the real built
// server: a Gross Certified Amount column only, a Net Certified column only, and a
// plain Certified Amount column. Expected values come from the source text only.
// The rendered pages are read in a real headless Chrome; the facts, Ask and the
// downloads are read from their own API responses.
// R12 follow-up: a register whose only certified column is Gross Certified Amount
// is read (gross established; net and the unpaid balance stay not established);
// a Net Payable / Net Amount Payable column is read as the net certified amount;
// and the receipts planning scenario never subtracts a net figure from the
// contract value: with net-only certificates it is not established, with that reason.

const SERVER=join(__dirname,'../packages/runtime-api/src/project-gateway.js');
const DATA_DATE='2033-03-15';
const LABEL={gross:'Gross certified',net:'Certified (net; gross not stated)',unstated:'Certified (gross or net not stated)'} as const;
type Column=keyof typeof LABEL;
const CASES:Array<{projectId:string;column:Column;header:string}>=[
  {projectId:'R12-GROSS-ONLY',column:'gross',header:'Gross Certified Amount'},
  {projectId:'R12-NET-ONLY',column:'net',header:'Net Certified'},
  {projectId:'R12-PLAIN-CERTIFIED',column:'unstated',header:'Certified Amount'},
  {projectId:'R12-NET-PAYABLE',column:'net',header:'Net Payable'},
  {projectId:'R12-NET-AMOUNT-PAYABLE',column:'net',header:'Net Amount Payable'},
];
const CONTRACT_LINES=['MAIN WORKS CONTRACT AGREEMENT','Contract Data','Contract currency is SAR.','Accepted Contract Amount: SAR 48,250,000.',
  'Date for Completion: '+shiftDateText(412),'The Engineer shall determine extensions of time in calendar days.'];
function shiftDateText(days:number){const d=new Date(DATA_DATE+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
async function contractPdf(){
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595,842]).drawText(CONTRACT_LINES.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
  return Buffer.from(await doc.save());
}
/** Contract amount from the contract text only. */
const CONTRACT_AMOUNT=Number(/Accepted Contract Amount: SAR ([\d,]+)/.exec(CONTRACT_LINES.join('\n'))![1]!.replaceAll(',',''));
const GROSS_PAGE_LABELS=/^(?:gross certified|gross certified to date|dated gross certification)$/i;

function shiftDate(iso:string,days:number){const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function fiveDayCalendar(){
  const shifts=[['08:00','12:00'],['13:00','17:00']] as const;
  const intervals=shifts.map(([s,e],i)=>'(0||'+i+'(s|'+s+'|f|'+e+')())').join('');
  const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d>=2&&d<=6?intervals:'')+'))').join('');
  return '(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()())))'.replaceAll('(0||','\x7f\x7f  (0||');
}
function programmeXer(projectId:string){
  const count=12;
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectId+'\t'+DATA_DATE,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tMain Works',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\tC1\tFive Day 8h\t8\t40\t'+fiveDayCalendar(),
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'];
  for(let i=0;i<count;i++){
    const last=i===count-1,pct=last?0:i<4?100:i<6?50:0;
    const start=shiftDate(DATA_DATE,-60+i*6),finish=shiftDate(DATA_DATE,-40+i*12);
    lines.push(['%R',String(2000+i),'1','10','C1',last?'MS-FINISH':'ACT-'+(100+i),last?'Project Completion':'Works package '+(i+1),
      last?'TT_FinMile':'TT_Task',pct===100?'TK_Complete':pct>0?'TK_Active':'TK_NotStart',last?finish:start,finish,last?finish:start,finish,
      last?'0':'80',last?'0':String(80*(100-pct)/100),String(last?0:40),String(pct)].join('\t'));
  }
  lines.push('%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt');
  for(let i=1;i<count;i++)lines.push(['%R',String(7000+i),'1',String(2000+i),'1',String(1999+i),'PR_FS','0'].join('\t'));
  lines.push('%E');
  return lines.join('\n');
}
function csvText(headers:string[],rows:string[][]){return [headers,...rows].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');}
/** The same three dated, paid, incremental certificates; only the certified column differs. */
function paymentRegister(amountHeader:string){
  const headers=['Certificate No','Payment Type','Period End','Certificate Date','Payment Date',amountHeader,'Paid Amount','Currency','Status','Certified Amount Basis','Paid Amount Basis','VAT Basis'];
  const amounts=[1_935_000,3_127_950,3_611_025];
  const rows=amounts.map((amount,i)=>{
    const period=shiftDate(DATA_DATE,-75+i*30);
    return ['IPC-'+(i+1),'Interim',period,shiftDate(period,5),shiftDate(period,28),String(amount),String(Math.round(amount*.9)),'SAR','Paid','incremental','incremental','Exclusive'];
  });
  return csvText(headers,rows);
}
/** Answer key from the source text only. */
function sourceCertifiedTotal(csv:string,header:string){
  const rows=csv.split(/\r?\n/).map(line=>[...line.matchAll(/"((?:[^"]|"")*)"/g)].map(m=>m[1]!));
  const [head,...body]=rows;const at=head!.indexOf(header),dated=head!.indexOf('Certificate Date');
  return body.filter(r=>r[dated]!<=DATA_DATE).reduce((sum,r)=>sum+Number(r[at]),0);
}

// ---------- processes (only processes started here are ever stopped)
async function freePort(){
  return new Promise<number>((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=(s.address() as any).port;s.close(()=>resolve(port));});});
}
function own(child:ChildProcess){const pid=child.pid;if(pid!==undefined)process.once('exit',()=>{try{process.kill(-pid,'SIGKILL');}catch{}});return child;}
function stop(child:ChildProcess|null){
  if(!child||child.pid===undefined||child.exitCode!==null||child.signalCode!==null)return Promise.resolve();
  const signal=(name:NodeJS.Signals)=>{try{process.kill(-child.pid!,name);}catch{try{child.kill(name);}catch{}}};
  return new Promise<void>(resolve=>{const timer=setTimeout(()=>{signal('SIGKILL');resolve();},8000);child.once('exit',()=>{clearTimeout(timer);signal('SIGKILL');resolve();});signal('SIGTERM');});
}
function chromeBinary(){
  if(process.env.CHROME_PATH)return existsSync(process.env.CHROME_PATH)?process.env.CHROME_PATH:null;
  if(existsSync('/usr/bin/google-chrome'))return '/usr/bin/google-chrome';
  const root='/opt/pw-browsers';
  if(existsSync(root))for(const dir of readdirSync(root).filter(d=>/^chromium-\d+$/.test(d)).sort().reverse()){
    const candidate=join(root,dir,'chrome-linux','chrome');if(existsSync(candidate))return candidate;}
  return null;
}
class Cdp{
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
async function launchChrome(binary:string,profile:string){
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
/** "9,637,750 SAR" or "9.64M": the displayed precision decides the tolerance. */
function shownMoney(raw:string):{value:number;tolerance:number}|null{
  const m=/^(?:[A-Z]{3}\s+)?(-?[\d,]+)(?:\.(\d+))?\s*([kMB])?(?=$|\s|[A-Z]{3}\b)/.exec(raw.trim());
  if(!m)return null;
  const scale=({k:1e3,M:1e6,B:1e9} as Record<string,number>)[m[3]??'']??1;
  return {value:Number(m[1]!.replaceAll(',','')+(m[2]?'.'+m[2]:''))*scale,tolerance:0.5*scale*10**-(m[2]?.length??0)+1e-6};
}
/** Every "label line, value line" pair on a screen whose label names a certified figure. */
function certifiedReadings(text:string){
  const lines=text.split('\n').map(l=>l.replace(/ /g,' ').trim()).filter(Boolean);
  const out:Array<{label:string;raw:string}>=[];
  lines.forEach((line,i)=>{if((GROSS_PAGE_LABELS.test(line)||line===LABEL.net||line===LABEL.unstated)&&lines[i+1]!==undefined)out.push({label:line,raw:lines[i+1]!});});
  return out;
}

test('R12: a certified figure is labelled by the register column it came from on every page, fact, Ask answer and download',{timeout:900_000},async t=>{
  const binary=chromeBinary();
  if(!binary){
    if(process.env.CI)assert.fail('R12 needs a Chrome/Chromium binary: set CHROME_PATH, or install /usr/bin/google-chrome.');
    t.skip('No Chrome/Chromium binary found (set CHROME_PATH); this test is mandatory on CI');return;
  }
  assert.ok(existsSync(SERVER),'built server missing: '+SERVER);
  const root=await mkdtemp(join(tmpdir(),'cmeng-r12-'));
  let server:ChildProcess|null=null,chrome:ChildProcess|null=null,cdp:Cdp|null=null;
  const failures:string[]=[];
  try{
    const port=await freePort(),base='http://127.0.0.1:'+port;
    const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:join(root,'data'),PORT:String(port),HOST:'127.0.0.1'};
    for(const name of ['RAILWAY_VOLUME_MOUNT_PATH','NODE_TEST_CONTEXT','CMENG_PROJECT_WORKER','NODE_OPTIONS'])delete env[name];
    server=own(spawn(process.execPath,[SERVER],{env,stdio:['ignore','pipe','pipe'],detached:true}));
    let serverLog='';server.stdout!.on('data',d=>{serverLog=(serverLog+d).slice(-20000);});server.stderr!.on('data',d=>{serverLog=(serverLog+d).slice(-20000);});
    const deadline=Date.now()+60_000;
    for(;;){
      if(server.exitCode!==null)assert.fail('server exited during start: '+serverLog.slice(-3000));
      try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}
      if(Date.now()>deadline)assert.fail('server did not answer /health within 60 s: '+serverLog.slice(-3000));
      await new Promise(r=>setTimeout(r,300));
    }
    // 1. Upload through the routes and headers the browser itself uses.
    const expected=new Map<string,number>();
    for(const c of CASES){
      const created=await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:c.projectId,testProject:false})});
      assert.equal(created.status,201,'project creation failed: '+await created.text());
      const csv=paymentRegister(c.header),xer=programmeXer(c.projectId);
      expected.set(c.projectId,sourceCertifiedTotal(csv,c.header));
      const files=[
        {filename:'Programme_Update.xer',mediaType:'text/plain',bytes:Buffer.from(xer,'utf8'),route:'/schedule/uploads',headers:{'x-upload-intent':'add_update','x-evidence-category':'schedule','x-schedule-role':'update','x-schedule-role-confirmed':'1'}},
        {filename:'Main_Contract.pdf',mediaType:'application/pdf',bytes:await contractPdf(),route:'/contract/uploads',headers:{'x-contract-role':'main'}},
        {filename:'Payment_Certificates.csv',mediaType:'text/csv',bytes:Buffer.from(csv,'utf8'),route:'/evidence/uploads',headers:{'x-upload-intent':'add_update'}},
      ];
      for(const [index,file] of files.entries()){
        const uploaded=await fetch(base+'/api/projects/'+encodeURIComponent(c.projectId)+file.route,{method:'POST',
          headers:{'content-type':file.mediaType,'x-source-filename-encoded':encodeURIComponent(file.filename),'x-source-relative-path-encoded':encodeURIComponent(file.filename),
            'x-upload-id':c.projectId+'-'+index,...file.headers},body:file.bytes,signal:AbortSignal.timeout(180_000)});
        assert.equal(uploaded.status,201,c.projectId+' '+file.filename+' upload failed: '+(await uploaded.text()).slice(0,800));
      }
    }
    const getJson=async(path:string)=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(180_000)});const text=await r.text();
      assert.equal(r.status,200,path+' -> '+r.status+' '+text.slice(0,500));return JSON.parse(text);};

    // 2. The shared position and the facts (API).
    const apiFigure=new Map<string,number|null>();
    for(const c of CASES){
      for(const page of ['payments','commercial-overview','cash-flow']){
        const body=await getJson('/api/projects/'+encodeURIComponent(c.projectId)+'/commercial/modules/'+page);
        const data=body.data??body,row=(data.position?.currencies??[]).find((r:any)=>r.currency==='SAR');
        const fact=(data.projectFacts?.commercial?.currencies??[]).find((r:any)=>r.currency==='SAR');
        console.log('R12 '+c.projectId+' '+page+' position: '+JSON.stringify(row?{value:row.grossCertifiedAmount?.value,state:row.grossCertifiedAmount?.state,
          column:row.grossCertifiedAmountColumn,label:row.grossCertifiedAmountLabel,net:row.netCertifiedAmount?.value,unpaid:row.certifiedUnpaidAmount?.value,contract:row.currentContractValue?.value}:null)+
          ' fact: '+JSON.stringify(fact?{value:fact.grossCertifiedAmount?.value,basis:fact.grossCertifiedAmount?.basis,column:fact.grossCertifiedAmountColumn,label:fact.grossCertifiedAmountLabel}:null));
        if(!row){failures.push(c.projectId+' '+page+': no SAR commercial position');continue;}
        const value=row.grossCertifiedAmount?.value??null;
        if(page==='payments')apiFigure.set(c.projectId,value);
        else if(value!==apiFigure.get(c.projectId))failures.push(c.projectId+' '+page+': certified figure '+value+' differs from Payments '+apiFigure.get(c.projectId));
        if(c.column!=='gross'){
          // A figure read from a net or unlabelled column keeps its value and is never labelled gross.
          if(value!==expected.get(c.projectId))failures.push(c.projectId+' '+page+': certified figure '+value+'; the source column sums to '+expected.get(c.projectId));
          if(row.grossCertifiedAmountColumn!==c.column)failures.push(c.projectId+' '+page+': column '+row.grossCertifiedAmountColumn+', expected '+c.column);
          if(row.grossCertifiedAmountLabel!==LABEL[c.column])failures.push(c.projectId+' '+page+': label "'+row.grossCertifiedAmountLabel+'", expected "'+LABEL[c.column]+'"');
          if(!fact||fact.grossCertifiedAmountLabel!==LABEL[c.column]||fact.grossCertifiedAmountColumn!==c.column)
            failures.push(c.projectId+' '+page+': project fact label/column '+JSON.stringify([fact?.grossCertifiedAmountLabel,fact?.grossCertifiedAmountColumn]));
          if(/\bgross certification\b|^dated gross/i.test(String(fact?.grossCertifiedAmount?.basis??'')))
            failures.push(c.projectId+' '+page+': project fact basis calls the figure gross: '+fact?.grossCertifiedAmount?.basis);
        }else{
          // A Gross Certified column alone is read: gross established, net and the unpaid balance not established.
          if(row.grossCertifiedAmountLabel!==LABEL.gross||row.grossCertifiedAmountColumn!=='gross')failures.push(c.projectId+' '+page+': gross label/column '+JSON.stringify([row.grossCertifiedAmountLabel,row.grossCertifiedAmountColumn]));
          if(value!==expected.get(c.projectId))failures.push(c.projectId+' '+page+': gross figure '+value+'; the source Gross Certified Amount column sums to '+expected.get(c.projectId));
          if(row.netCertifiedAmount?.value!=null)failures.push(c.projectId+' '+page+': net certified '+row.netCertifiedAmount.value+' although the register states gross only');
          if(row.certifiedUnpaidAmount?.value!=null)failures.push(c.projectId+' '+page+': certified unpaid '+row.certifiedUnpaidAmount.value+' from gross less cash; the register states no net');
        }
        if(page==='cash-flow'){
          // The receipts planning scenario never subtracts a net figure from the contract value.
          const scenario=data.position?.programmeCashScenario,group=(scenario?.groups??[]).find((g:any)=>g.currency==='SAR');
          console.log('R12 '+c.projectId+' receipts scenario: '+JSON.stringify(group?{remainingGross:group.remainingGross,rows:group.rows?.length,reason:group.notEstablishedReason,missing:group.missingInputs}:null)+' basis: '+String(scenario?.basis??'').slice(0,160));
          if(row.currentContractValue?.value!==CONTRACT_AMOUNT)failures.push(c.projectId+': current contract value '+row.currentContractValue?.value+'; the contract states '+CONTRACT_AMOUNT);
          else if(!group)failures.push(c.projectId+': no SAR receipts scenario');
          else if(c.column==='net'){
            if(group.remainingGross!==null||group.rows?.length)failures.push(c.projectId+': receipts scenario subtracts the net figure ('+group.remainingGross+')');
            if(!/net certified amounts only/.test(String(group.notEstablishedReason??''))||!(group.missingInputs??[]).some((m:string)=>/net certified amounts only/.test(m)))
              failures.push(c.projectId+': receipts scenario does not say it is not established because the certificates state net only: '+JSON.stringify([group.notEstablishedReason,group.missingInputs]));
          }else if(c.column==='gross'){
            if(group.remainingGross!==CONTRACT_AMOUNT-expected.get(c.projectId)!)failures.push(c.projectId+': remaining gross '+group.remainingGross+'; contract less gross certified is '+(CONTRACT_AMOUNT-expected.get(c.projectId)!));
          }else if(/less dated gross certification/.test(String(scenario?.basis??'')))failures.push(c.projectId+': receipts scenario basis calls an unstated figure gross: '+scenario.basis);
        }
      }
    }

    // 3. Ask answers: a certified figure in an answer carries the shared label and is never called gross unless it is.
    for(const c of CASES){
      const r=await fetch(base+'/api/projects/'+encodeURIComponent(c.projectId)+'/intelligence/ask',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({question:'How much has been certified on the payment certificates?'}),signal:AbortSignal.timeout(180_000)});
      const text=await r.text();assert.equal(r.status,200,c.projectId+' Ask failed: '+text.slice(0,500));
      const answer=JSON.parse(text),figure=apiFigure.get(c.projectId)??null;
      const labelled:Array<{label:string;value:unknown}>=[];
      const walk=(v:any)=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(walk);return;}
        if(typeof v.label==='string'&&('value' in v))labelled.push({label:v.label,value:v.value});for(const child of Object.values(v))walk(child);};
      walk(answer);
      const shown=labelled.filter(m=>figure!==null&&typeof m.value==='number'&&Math.abs(m.value-figure)<0.5);
      console.log('R12 '+c.projectId+' Ask metrics with the certified figure: '+JSON.stringify(shown.slice(0,8))+' · certif labels: '+JSON.stringify(labelled.filter(m=>/certif/i.test(m.label)).slice(0,12)));
      if(c.column!=='gross')for(const m of shown)if(/gross/i.test(m.label)&&!m.label.startsWith(LABEL[c.column]))failures.push(c.projectId+' Ask labels the '+c.column+' figure "'+m.label+'"');
      if(figure!==null&&!labelled.some(m=>m.value===figure&&m.label.startsWith(LABEL[c.column])))
        failures.push(c.projectId+' Ask does not answer the certified figure '+figure+' with the label "'+LABEL[c.column]+'"');
    }

    // 4. Downloads: the Payments workbook heading of the figure and the JSON download carry the shared label.
    for(const c of CASES){
      const r=await fetch(base+'/api/projects/'+encodeURIComponent(c.projectId)+'/commercial/modules/payments/report.xlsx',{signal:AbortSignal.timeout(180_000)});
      assert.equal(r.status,200,c.projectId+' payments workbook download failed');
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(Buffer.from(await r.arrayBuffer()) as any);
      const keys=workbook.getWorksheet('Field keys');
      const headings:Array<{sheet:string;heading:string;key:string}>=[];
      keys?.eachRow((row,n)=>{if(n===1)return;const v=row.values as any[];headings.push({sheet:String(v[1]),heading:String(v[4]),key:String(v[5])});});
      const figureHeadings=headings.filter(h=>/^grossCertifiedAmount\.value$/.test(h.key)&&!/^Summary/i.test(h.sheet));
      console.log('R12 '+c.projectId+' workbook headings of grossCertifiedAmount.value: '+JSON.stringify(figureHeadings));
      if(!figureHeadings.length)failures.push(c.projectId+' payments workbook has no certified figure column');
      for(const h of figureHeadings){
        if(c.column!=='gross'&&/gross/i.test(h.heading)&&!h.heading.startsWith(LABEL[c.column]))failures.push(c.projectId+' workbook sheet '+h.sheet+' heads the '+c.column+' figure "'+h.heading+'"');
        if(!h.heading.startsWith(LABEL[c.column]))failures.push(c.projectId+' workbook sheet '+h.sheet+' heading "'+h.heading+'" does not start with "'+LABEL[c.column]+'"');
      }
      const json=await getJson('/api/projects/'+encodeURIComponent(c.projectId)+'/commercial/modules/payments/report.json');
      const rows=JSON.stringify(json);
      if(!rows.includes('"grossCertifiedAmountLabel":"'+LABEL[c.column]+'"'))failures.push(c.projectId+' JSON download does not carry grossCertifiedAmountLabel "'+LABEL[c.column]+'"');
    }

    // 5. Rendered pages in a real headless Chrome.
    const launched=await launchChrome(binary,join(root,'chrome-profile'));chrome=launched.child;
    cdp=await Cdp.connect(launched.url);
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    const send=(method:string,params:Record<string,unknown>={},timeoutMs?:number)=>cdp!.send(method,params,sessionId,timeoutMs);
    const inflight=new Set<string>();let lastNetwork=Date.now();
    cdp.on((method,params,sid)=>{
      if(sid!==sessionId)return;
      if(method==='Network.requestWillBeSent'){inflight.add(params.requestId);lastNetwork=Date.now();}
      else if(method==='Network.loadingFinished'||method==='Network.loadingFailed'){inflight.delete(params.requestId);lastNetwork=Date.now();}
    });
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const evaluate=async(expression:string)=>{
      const reply=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},90_000);
      if(reply.exceptionDetails)throw new Error('page script failed: '+(reply.exceptionDetails.exception?.description??reply.exceptionDetails.text));
      return reply.result.value;
    };
    const ready=(module:string)=>'typeof currentModuleResult!=="undefined"&&(currentModuleResult?.key==='+JSON.stringify(module)+
      '||/Unable to load/.test(document.getElementById("moduleContent").innerText))&&document.getElementById("moduleBadge").textContent!=="Updating"&&'+
      '!document.getElementById("projectModulePanel").hidden';
    const pageText=async(projectId:string,module:string)=>{
      await send('Page.navigate',{url:base+'/?view=project&project='+encodeURIComponent(projectId)+'&module='+encodeURIComponent(module)});
      const until=Date.now()+90_000;
      for(;;){
        const ok=await evaluate('(()=>{try{return !!('+ready(module)+')}catch{return false}})()').catch(()=>false);
        if(ok&&inflight.size===0&&Date.now()-lastNetwork>700)break;
        if(Date.now()>until)throw new Error(projectId+' '+module+' did not finish rendering');
        await new Promise(r=>setTimeout(r,250));
      }
      // Chart drawings are not stated values: read the screen text without them.
      return String(await evaluate('(()=>{const style=document.createElement("style");style.textContent="svg,canvas{display:none!important}";document.head.appendChild(style);const text=document.body.innerText;style.remove();return text;})()'));
    };
    for(const c of CASES){
      const figure=apiFigure.get(c.projectId)??null;
      for(const page of ['payments','commercial-overview','cash-flow']){
        const text=await pageText(c.projectId,page),readings=certifiedReadings(text);
        console.log('R12 '+c.projectId+' '+page+' screen: '+JSON.stringify(readings));
        if(/Unable to load|Try this view again/i.test(text))failures.push(c.projectId+' '+page+': page failed to load');
        if(page==='cash-flow'&&c.column==='net'&&!/Future receipts not established:\s*The payment certificates state net certified amounts only/.test(text))
          failures.push(c.projectId+' cash-flow: the screen does not say the receipts scenario is not established because the certificates state net only');
        if(c.column==='gross'){
          const gross=readings.filter(r=>GROSS_PAGE_LABELS.test(r.label));
          if(!gross.length)failures.push(c.projectId+' '+page+': the gross-only register lost its gross label');
          if(readings.some(r=>r.label===LABEL.net||r.label===LABEL.unstated))failures.push(c.projectId+' '+page+': the gross-only register shows a net/unstated label');
          for(const r of gross){const m=shownMoney(r.raw);
            if(!m||Math.abs(m.value-expected.get(c.projectId)!)>m.tolerance)failures.push(c.projectId+' '+page+': "'+r.label+'" shows "'+r.raw+'"; the source Gross Certified Amount column sums to '+expected.get(c.projectId));}
        }else{
          for(const r of readings.filter(r=>GROSS_PAGE_LABELS.test(r.label))){const m=shownMoney(r.raw);
            if(m&&figure!==null&&Math.abs(m.value-figure)<=m.tolerance)failures.push(c.projectId+' '+page+': the '+c.column+' figure is shown as "'+r.label+'" '+r.raw);}
          const mine=readings.filter(r=>r.label===LABEL[c.column]);
          if(!mine.some(r=>{const m=shownMoney(r.raw);return !!m&&Math.abs(m.value-expected.get(c.projectId)!)<=m.tolerance;}))
            failures.push(c.projectId+' '+page+': does not show "'+LABEL[c.column]+'" '+expected.get(c.projectId)+' ['+JSON.stringify(readings)+']');
        }
      }
    }
  }finally{
    if(cdp){await cdp.send('Browser.close',{},undefined,5000).catch(()=>{});cdp.close();}
    await stop(chrome);await stop(server);
    await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
  assert.deepEqual(failures,[],'each certified figure carries the label of the column it came from');
});
