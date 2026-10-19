import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {existsSync,readdirSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';

// F01 (N-8): a real headless Chrome opens every CMeng page of a project that was
// uploaded through the real upload path of the real built server, reads what the
// screen shows (document.body / drawer innerText) and compares it with an answer
// key computed in this file from the uploaded source files alone. CMeng output is
// never used as an expected value. Checks: (a) each expected figure is shown on
// the pages that show it, (b) one fact has one value on every page that shows it,
// (c) no banned words, (d) every API response a page loads is under 2 MB.
// No npm dependency: Chrome is driven over the DevTools Protocol with Node 22's
// global WebSocket.

const SERVER=join(__dirname,'../packages/runtime-api/src/project-gateway.js');
const MAX_PAGE_BYTES=2_000_000;
const PAGE_TIMEOUT_MS=90_000;

// ---------- source files of the test project (the only source of expected values)
const PROJECT_ID='F01-SCREEN-WALK';
const DATA_DATE='2033-03-15';
const ACTIVITY_COUNT=37;
function shiftDate(iso:string,days:number){const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function fiveDayCalendar(){
  const shifts=[['08:00','12:00'],['13:00','17:00']] as const;
  const intervals=shifts.map(([s,e],i)=>'(0||'+i+'(s|'+s+'|f|'+e+')())').join('');
  const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d>=2&&d<=6?intervals:'')+'))').join('');
  return '(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()())))'.replaceAll('(0||','\x7f\x7f  (0||');
}
function programmeXer(){
  const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+PROJECT_ID+'\t'+DATA_DATE,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\tMain Works',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\tC1\tFive Day 8h\t8\t40\t'+fiveDayCalendar(),
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'];
  for(let i=0;i<ACTIVITY_COUNT;i++){
    const last=i===ACTIVITY_COUNT-1,pct=last?0:i<8?100:i<14?50:0;
    const start=shiftDate(DATA_DATE,-60+i*3),finish=shiftDate(DATA_DATE,-40+i*9);
    lines.push(['%R',String(2000+i),'1','10','C1',last?'MS-FINISH':'ACT-'+(100+i),last?'Project Completion':'Works package '+(i+1),
      last?'TT_FinMile':'TT_Task',pct===100?'TK_Complete':pct>0?'TK_Active':'TK_NotStart',last?finish:start,finish,last?finish:start,finish,
      last?'0':'80',last?'0':String(80*(100-pct)/100),String(last?0:i%5===0?-16:i%3===0?0:40),String(pct)].join('\t'));
  }
  lines.push('%T\tTASKPRED','%F\ttask_pred_id\tproj_id\ttask_id\tpred_proj_id\tpred_task_id\tpred_type\tlag_hr_cnt');
  for(let i=1;i<ACTIVITY_COUNT;i++)lines.push(['%R',String(7000+i),'1',String(2000+i),'1',String(1999+i),'PR_FS','0'].join('\t'));
  lines.push('%E');
  return lines.join('\n');
}
const CONTRACT_COMPLETION=shiftDate(DATA_DATE,412);
const CONTRACT_LINES=['MAIN WORKS CONTRACT AGREEMENT','Contract Data','Contract currency is SAR.','Accepted Contract Amount: SAR 48,250,000.',
  'Date for Completion: '+CONTRACT_COMPLETION,'Retention percentage: 10%',
  'The Engineer shall determine extensions of time in calendar days.'];
async function contractPdf(){
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595,842]).drawText(CONTRACT_LINES.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
  return Buffer.from(await doc.save());
}
function csvText(headers:string[],rows:string[][]){return [headers,...rows].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');}
function rfiRegister(){
  const headers=['RFI ID','Subject','Status','Raised Date','Due Date','Response Date','Owner','Linked Activity'];
  const rows:string[][]=[];
  for(let i=0;i<11;i++){
    // Raised from 50 to 20 days before the Data Date; answers are due 21 days
    // after issue, so some open RFIs are overdue at the Data Date and some are not.
    const open=i%3!==0,raised=shiftDate(DATA_DATE,-50+i*3),due=shiftDate(raised,21);
    rows.push(['RFI-'+(301+i),'Design query '+(i+1),open?'Open':'Closed',raised,due,open?'':shiftDate(raised,9),'Design Manager','ACT-'+(110+i)]);
  }
  return {headers,rows};
}
function paymentRegister(){
  const headers=['Certificate No','Payment Type','Period End','Certificate Date','Payment Date','Gross Certified Amount','Net Certified','Paid Amount','Retention','Currency','Status','Certified Amount Basis','Paid Amount Basis','VAT Basis'];
  const gross=[2_150_000,3_475_500,4_012_250];
  const rows=gross.map((amount,i)=>{
    const period=shiftDate(DATA_DATE,-75+i*30),retention=Math.round(amount*.1),net=amount-retention;
    return ['IPC-'+(i+1),'Interim',period,shiftDate(period,5),shiftDate(period,28),String(amount),String(net),String(Math.round(net*.9)),String(retention),'SAR','Paid','incremental','incremental','Exclusive'];
  });
  return {headers,rows};
}
/** One uploaded source file: its bytes, the text written into it (the only input
 * of the answer key) and the upload route/headers the browser itself uses. */
type SourceFile={filename:string;mediaType:string;text:string;bytes:Uint8Array;route:string;headers:Record<string,string>};
export async function sourceFiles():Promise<SourceFile[]>{
  const rfi=rfiRegister(),pay=paymentRegister(),text=(s:string)=>Buffer.from(s,'utf8');
  const evidence={'x-upload-intent':'add_update'},xer=programmeXer(),rfiCsv=csvText(rfi.headers,rfi.rows),payCsv=csvText(pay.headers,pay.rows);
  return [
    {filename:'Programme_Update.xer',mediaType:'text/plain',text:xer,bytes:text(xer),route:'/schedule/uploads',
      headers:{'x-upload-intent':'add_update','x-evidence-category':'schedule','x-schedule-role':'update','x-schedule-role-confirmed':'1'}},
    {filename:'Main_Contract.pdf',mediaType:'application/pdf',text:CONTRACT_LINES.join('\n'),bytes:await contractPdf(),route:'/contract/uploads',headers:{'x-contract-role':'main'}},
    {filename:'RFI_Register.csv',mediaType:'text/csv',text:rfiCsv,bytes:text(rfiCsv),route:'/evidence/uploads',headers:evidence},
    {filename:'Payment_Certificates.csv',mediaType:'text/csv',text:payCsv,bytes:text(payCsv),route:'/evidence/uploads',headers:evidence},
  ];
}

// ---------- independent answer key: read back from the source text only
function readCsv(text:string){
  const rows=text.split(/\r?\n/).filter(Boolean).map(line=>[...line.matchAll(/"((?:[^"]|"")*)"/g)].map(m=>m[1]!.replaceAll('""','"')));
  const [headers,...body]=rows;return body.map(row=>Object.fromEntries(headers!.map((h,i)=>[h,row[i]??''])));
}
export function answerKey(files:SourceFile[]){
  const byName=(name:string)=>files.find(file=>file.filename===name)!.text;
  const xer=byName('Programme_Update.xer').split('\n');
  const tableRows=(table:string)=>{const at=xer.indexOf('%T\t'+table);const out:string[][]=[];let fields:string[]=[];
    for(let i=at+1;i<xer.length&&!xer[i]!.startsWith('%T')&&xer[i]!=='%E';i++){
      const cells=xer[i]!.split('\t');if(cells[0]==='%F')fields=cells.slice(1);else if(cells[0]==='%R')out.push(cells.slice(1));}
    return out.map(r=>Object.fromEntries(fields.map((f,i)=>[f,r[i]??''])));};
  const dataDate=tableRows('PROJECT')[0]!.last_recalc_date!.slice(0,10);
  const activityCount=tableRows('TASK').length;
  const contractCompletion=/Date for Completion:\s*(\d{4}-\d{2}-\d{2})/.exec(byName('Main_Contract.pdf'))![1]!;
  const rfis=readCsv(byName('RFI_Register.csv')).filter(r=>r['Raised Date']!<=dataDate);
  const openRfis=rfis.filter(r=>r.Status==='Open').length;
  const overdueRfis=rfis.filter(r=>r.Status==='Open'&&r['Due Date']!<dataDate).length;
  const ipcs=readCsv(byName('Payment_Certificates.csv')).filter(r=>r['Certificate Date']!<=dataDate);
  const certifiedGross=ipcs.reduce((sum,r)=>sum+Number(r['Gross Certified Amount']),0);
  const certifiedNet=ipcs.reduce((sum,r)=>sum+Number(r['Net Certified']),0);
  const paid=ipcs.filter(r=>r['Payment Date']!<=dataDate).reduce((sum,r)=>sum+Number(r['Paid Amount']),0);
  return {dataDate,activityCount,documentCount:files.length,contractCompletion,openRfis,overdueRfis,rfiRows:rfis.length,
    certificates:ipcs.length,certifiedGross,certifiedNet,paid};
}

// ---------- process helpers (only processes started here are ever stopped)
async function freePort(){
  return new Promise<number>((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=(s.address() as any).port;s.close(()=>resolve(port));});});
}
function stop(child:ChildProcess|null){
  if(!child||child.exitCode!==null||child.signalCode!==null)return Promise.resolve();
  return new Promise<void>(resolve=>{const timer=setTimeout(()=>{try{child.kill('SIGKILL');}catch{}resolve();},5000);
    child.once('exit',()=>{clearTimeout(timer);resolve();});try{child.kill('SIGTERM');}catch{clearTimeout(timer);resolve();}});
}
function chromeBinary(){
  if(process.env.CHROME_PATH)return existsSync(process.env.CHROME_PATH)?process.env.CHROME_PATH:null;
  if(existsSync('/usr/bin/google-chrome'))return '/usr/bin/google-chrome';
  const root='/opt/pw-browsers';
  if(existsSync(root))for(const dir of readdirSync(root).filter(d=>/^chromium-\d+$/.test(d)).sort().reverse()){
    const candidate=join(root,dir,'chrome-linux','chrome');if(existsSync(candidate))return candidate;}
  return null;
}

// ---------- minimal Chrome DevTools Protocol client over the global WebSocket
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
  const child=spawn(binary,['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--no-sandbox','--disable-gpu',
    '--disable-dev-shm-usage','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking',
    '--window-size=1440,1000','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
  const url=await new Promise<string>((resolve,reject)=>{
    let log='';const timer=setTimeout(()=>reject(new Error('Chrome did not start: '+log.slice(-2000))),30_000);
    child.stderr!.on('data',d=>{log+=d;const m=/DevTools listening on (ws:\/\/\S+)/.exec(log);if(m){clearTimeout(timer);resolve(m[1]!);}});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('Chrome exited '+code+': '+log.slice(-2000)));});
  });
  return {child,url};
}

// ---------- what the screen says: facts read from innerText by their on-screen label
type Kind='date'|'count'|'money';
/** next: the label is a line and the value is the next line (a KPI card); cell: label and value are
 * neighbouring table cells; column: the label is a column heading and the value is in the row below;
 * inline: a sentence carrying the value. onlyOn limits a generic label to the page that uses it. */
type Reader={next?:RegExp;cell?:RegExp;column?:RegExp;inline?:RegExp;onlyOn?:string[]};
type FactRule={name:string;kind:Kind;expected:string|number;readers:Reader[];requiredOn:(surface:string)=>boolean};
type Reading={fact:string;surface:string;raw:string;value:string|number|null;context:string};
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const UNKNOWN=/^(?:not established|not confirmed|missing|not in source|not available|not calculable|records disagree|withheld|not applicable|not recorded)\b/i;
function parseShown(kind:Kind,raw:string):string|number|null{
  const text=raw.trim();
  if(kind==='date'){const m=/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})\b/.exec(text);if(!m||!MONTHS.includes(m[1]!))return null;
    return m[3]+'-'+String(MONTHS.indexOf(m[1]!)+1).padStart(2,'0')+'-'+m[2]!.padStart(2,'0');}
  if(kind==='count'){const m=/^(\d[\d,]*)(?![\d.,]*\d)/.exec(text);return m?Number(m[1]!.replaceAll(',','')):null;}
  const m=/^(?:[A-Z]{3}\s+)?(-?[\d,]+(?:\.\d+)?)\s*([kMB])?(?=$|\s|[A-Z]{3}\b)/.exec(text);
  if(!m)return null;
  return Number(m[1]!.replaceAll(',',''))*(({k:1e3,M:1e6,B:1e9} as Record<string,number>)[m[2]??'']??1);
}
/** The displayed precision decides the tolerance: "9.64M" stands for 9,635,000 to 9,645,000. */
function sameAsShown(kind:Kind,raw:string,shown:string|number,expected:string|number){
  if(kind!=='money')return shown===expected;
  const m=/(-?[\d,]+)(?:\.(\d+))?\s*([kMB])?/.exec(raw)!,scale=({k:1e3,M:1e6,B:1e9} as Record<string,number>)[m[3]??'']??1;
  return Math.abs(Number(shown)-Number(expected))<=0.5*scale*10**-(m[2]?.length??0)+1e-6;
}
function readFacts(surface:string,text:string,rules:FactRule[]){
  const lines=text.split('\n').map(l=>l.replace(/ /g,' ').trim()).filter(Boolean),out:Reading[]=[];
  for(const rule of rules)for(const reader of rule.readers){
    if(reader.onlyOn&&!reader.onlyOn.includes(surface))continue;
    const add=(raw:string,context:string)=>{
      const value=UNKNOWN.test(raw.trim())?null:parseShown(rule.kind,raw);
      if(value===null&&!UNKNOWN.test(raw.trim()))return; // a label used as a heading, not a value
      out.push({fact:rule.name,surface,raw:raw.trim().slice(0,60),value,context:context.slice(0,160)});
    };
    lines.forEach((line,i)=>{
      if(reader.next&&reader.next.test(line)&&lines[i+1]!==undefined)add(lines[i+1]!,line+' | '+lines[i+1]);
      if(reader.cell){const cells=line.split('\t').map(c=>c.trim());cells.forEach((c,j)=>{if(reader.cell!.test(c)&&cells[j+1]!==undefined)add(cells[j+1]!,line);});}
      if(reader.column&&line.includes('\t')&&lines[i+1]?.includes('\t')){const heads=line.split('\t').map(c=>c.trim()),cells=lines[i+1]!.split('\t').map(c=>c.trim());
        heads.forEach((h,j)=>{if(reader.column!.test(h)&&cells[j]!==undefined)add(cells[j]!,line+' | '+lines[i+1]);});}
      if(reader.inline)for(const m of line.matchAll(reader.inline))add(m[1]!,line);
    });
  }
  return out;
}
function displayDate(iso:string){const [y,m,d]=iso.split('-');return MONTHS[Number(m)-1]+' '+Number(d)+', '+y;}
function factRules(key:ReturnType<typeof answerKey>):FactRule[]{
  const modulePage=(s:string)=>!['director drawer','project review','documents','portfolio','ask cmeng'].includes(s);
  const on=(...surfaces:string[])=>(s:string)=>surfaces.includes(s);
  const full=(...labels:string[])=>new RegExp('^(?:'+labels.join('|')+')$','i');
  return [
    {name:'Data date',kind:'date',expected:key.dataDate,readers:[{next:full('data date'),inline:/\bData Date:?\s+([A-Z][a-z]{2} \d{1,2}, \d{4})/gi}],
      requiredOn:s=>modulePage(s)||['director drawer','portfolio'].includes(s)},
    {name:'Activity count',kind:'count',expected:key.activityCount,readers:[{inline:/\b(\d[\d,]*) activities recognised/g},
      {inline:/\bExecution activities:\s*(\d[\d,]*)/g},{inline:/\b(\d[\d,]*) activities and \d[\d,]* relationships read/g},
      {next:full('execution activities','programme activities','programme records')}],requiredOn:s=>modulePage(s)||s==='documents'},
    {name:'Project documents',kind:'count',expected:key.documentCount,readers:[{inline:/\b(\d+) project documents\b/g},{inline:/^(\d+) documents$/g}],
      requiredOn:s=>modulePage(s)||s==='documents'},
    {name:'Open RFIs',kind:'count',expected:key.openRfis,readers:[{next:full('open rfis?'),inline:/\b(\d+) open RFIs?\b/gi},
      {next:full('open records'),onlyOn:['delivery-design']}],requiredOn:on('master-dashboard','delivery-design')},
    {name:'Overdue RFIs',kind:'count',expected:key.overdueRfis,readers:[{next:full('overdue rfis?'),inline:/\b(\d+) overdue RFIs?\b/gi},
      {next:full('overdue records'),onlyOn:['delivery-design']}],requiredOn:on('master-dashboard','director drawer','delivery-design')},
    {name:'RFI register rows',kind:'count',expected:key.rfiRows,readers:[{next:full('design rows','design source rows')},
      {next:full('current records','known source rows'),onlyOn:['delivery-design']}],requiredOn:on('master-dashboard','delivery-design')},
    {name:'Contract completion',kind:'date',expected:key.contractCompletion,
      readers:[{next:full('contractual completion','recorded contractual completion','original contractual completion','contract completion date'),
        cell:full('contractual completion','contract completion date','original contractual completion')}],requiredOn:on('master-dashboard','director drawer')},
    {name:'Dated certificates',kind:'count',expected:key.certificates,readers:[{next:full('dated certificates'),inline:/\bCertificate periods:\s*(\d+)/g}],requiredOn:on('payments')},
    {name:'Gross certified',kind:'money',expected:key.certifiedGross,readers:[{next:full('gross certified','gross certified to date','dated gross certification')}],
      requiredOn:on('payments','commercial-overview','cash-flow')},
    {name:'Net certified',kind:'money',expected:key.certifiedNet,readers:[{next:full('net certified','net certified to date'),
      inline:/\bCertificate-period net through Data Date:\s*([\d,.]+\s*[kMB]?)/g}],requiredOn:on('payments')},
    {name:'Paid',kind:'money',expected:key.paid,readers:[{next:full('paid','paid to date'),inline:/\bCash received:\s*([\d,.]+\s*[kMB]?)/g}],
      requiredOn:on('payments','commercial-overview','cash-flow')},
    {name:'Certified unpaid',kind:'money',expected:key.certifiedNet-key.paid,readers:[{next:full('certified unpaid'),column:full('certified unpaid')}],
      requiredOn:on('payments','commercial-overview','cash-flow','master-dashboard')},
  ];
}
// The existing forbidden screen text of scripts/cmeng-all-project-screen-acceptance.mjs (INTERNAL_ID,
// SIX_DECIMAL, NOT_ASSIGNED, UNRESOLVED_RECORD_ID) plus raw script values that must never reach a reader.
// "Not established" is the platform's own shared unknown-state label (managementValue, STATUS_LABELS):
// it is not banned here; showing it where the source has the value fails the answer-key check instead.
const BANNED:Array<[string,RegExp]>=[
  ['NOT_ASSIGNED',/\bnot assigned\b/gi],['UNRESOLVED_RECORD_ID',/\brecord id unresolved\b/gi],
  ['INTERNAL_ID',/\b(?:evidence-document:|schedrev_|boqingest_|delivery:[a-f0-9]{12,}|data\.position|data\.reportingContract)/gi],
  ['SIX_DECIMAL',/\b-?\d+\.\d{5,}\b/g],['undefined',/\bundefined\b/g],['NaN',/\bNaN\b/g],['null',/\bnull\b/g],
  ['Infinity',/\bInfinity\b/g],['[object Object]',/\[object Object\]/g],
];

// ---------- the walk
/** text: everything the reader sees (banned words); plain: the same without chart drawings, whose axis and
 * legend labels are not stated values (fact readings). */
type Shown={surface:string;route:string;text:string;plain:string;apiBytes:Array<{url:string;bytes:number}>;error:string|null};
const screenText=(element:string)=>'(()=>{const node='+element+',text=node.innerText,style=document.createElement("style");'+
  'style.textContent="svg,canvas{display:none!important}";document.head.appendChild(style);const plain=node.innerText;style.remove();return {text,plain};})()';

test('F01 real browser: every page shows the source answer key, one value per fact, no banned words, pages under 2 MB',{timeout:1_500_000},async t=>{
  const binary=chromeBinary();
  if(!binary){
    if(process.env.CI)assert.fail('F01 needs a Chrome/Chromium binary: set CHROME_PATH, or install /usr/bin/google-chrome. None was found on this CI runner.');
    t.skip('No Chrome/Chromium binary found (set CHROME_PATH); this test is mandatory on CI');return;
  }
  assert.ok(existsSync(SERVER),'built server missing: '+SERVER);
  const root=await mkdtemp(join(tmpdir(),'cmeng-f01-browser-'));
  let server:ChildProcess|null=null,chrome:ChildProcess|null=null,cdp:Cdp|null=null;
  try{
    // 1. The real built server, own data directory and port.
    const port=await freePort(),base='http://127.0.0.1:'+port;
    const env:NodeJS.ProcessEnv={...process.env,CMENG_DATA_DIR:join(root,'data'),PORT:String(port),HOST:'127.0.0.1'};
    for(const name of ['RAILWAY_VOLUME_MOUNT_PATH','NODE_TEST_CONTEXT','CMENG_PROJECT_WORKER','NODE_OPTIONS'])delete env[name];
    server=spawn(process.execPath,[SERVER],{env,stdio:['ignore','pipe','pipe']});
    let serverLog='';server.stdout!.on('data',d=>{serverLog=(serverLog+d).slice(-20000);});server.stderr!.on('data',d=>{serverLog=(serverLog+d).slice(-20000);});
    const deadline=Date.now()+60_000;
    for(;;){
      if(server.exitCode!==null)assert.fail('server exited during start: '+serverLog.slice(-3000));
      try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(2000)});if(r.ok)break;}catch{}
      if(Date.now()>deadline)assert.fail('server did not answer /health within 60 s: '+serverLog.slice(-3000));
      await new Promise(r=>setTimeout(r,300));
    }
    // 2. Upload the source files through the upload routes and headers the browser itself uses.
    const files=await sourceFiles(),key=answerKey(files),rules=factRules(key);
    const created=await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:PROJECT_ID,testProject:false})});
    assert.equal(created.status,201,'project creation failed: '+await created.text());
    for(const [index,file] of files.entries()){
      const uploaded=await fetch(base+'/api/projects/'+encodeURIComponent(PROJECT_ID)+file.route,{method:'POST',
        headers:{'content-type':file.mediaType,'x-source-filename-encoded':encodeURIComponent(file.filename),'x-source-relative-path-encoded':encodeURIComponent(file.filename),
          'x-upload-id':'F01-'+index,...file.headers},body:Buffer.from(file.bytes),signal:AbortSignal.timeout(180_000)});
      assert.equal(uploaded.status,201,file.filename+' upload failed: '+(await uploaded.text()).slice(0,800));
    }
    // 3. Real headless Chrome over the DevTools Protocol.
    const launched=await launchChrome(binary,join(root,'chrome-profile'));chrome=launched.child;
    cdp=await Cdp.connect(launched.url);
    const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
    const send=(method:string,params:Record<string,unknown>={},timeoutMs?:number)=>cdp!.send(method,params,sessionId,timeoutMs);
    const inflight=new Map<string,string>(),received=new Map<string,number>();let lastNetwork=Date.now(),pageErrors:string[]=[];
    let apiLog:Array<{url:string;bytes:number}>=[];
    cdp.on((method,params,sid)=>{
      if(sid!==sessionId)return;
      if(method==='Network.requestWillBeSent'){inflight.set(params.requestId,params.request.url);received.set(params.requestId,0);lastNetwork=Date.now();}
      else if(method==='Network.dataReceived'){received.set(params.requestId,(received.get(params.requestId)??0)+params.dataLength);lastNetwork=Date.now();}
      else if(method==='Network.loadingFinished'||method==='Network.loadingFailed'){
        const url=inflight.get(params.requestId);inflight.delete(params.requestId);lastNetwork=Date.now();
        if(url&&new URL(url).pathname.startsWith('/api/'))apiLog.push({url:new URL(url).pathname+new URL(url).search,bytes:received.get(params.requestId)??0});
      }
      else if(method==='Runtime.exceptionThrown')pageErrors.push(String(params.exceptionDetails?.exception?.description??params.exceptionDetails?.text).slice(0,300));
    });
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const evaluate=async(expression:string,timeoutMs=PAGE_TIMEOUT_MS)=>{
      const reply=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},timeoutMs);
      if(reply.exceptionDetails)throw new Error('page script failed: '+(reply.exceptionDetails.exception?.description??reply.exceptionDetails.text));
      return reply.result.value;
    };
    // Rendered = the page's own ready condition holds and the network has been quiet for 700 ms.
    const settle=async(ready:string,label:string)=>{
      const until=Date.now()+PAGE_TIMEOUT_MS;
      for(;;){
        const ok=await evaluate('(()=>{try{return !!('+ready+')}catch{return false}})()',10_000).catch(()=>false);
        if(ok&&inflight.size===0&&Date.now()-lastNetwork>700)return;
        if(Date.now()>until)throw new Error(label+' did not finish rendering within '+PAGE_TIMEOUT_MS/1000+' s');
        await new Promise(r=>setTimeout(r,250));
      }
    };
    const shown:Shown[]=[];
    const surface=async(name:string,route:string|null,ready:string,textExpression:string,before?:string)=>{
      apiLog=[];pageErrors=[];
      try{
        if(route!==null)await send('Page.navigate',{url:base+route});
        if(before){if(route!==null)await settle(ready.split('&&__then__')[0]!,name);await evaluate(before);}
        await settle(ready.replace('&&__then__','&&'),name);
        const read=await evaluate(screenText(textExpression)) as {text:string;plain:string};
        shown.push({surface:name,route:route??'(same page)',text:String(read.text),plain:String(read.plain),apiBytes:apiLog.slice(),error:pageErrors.length?pageErrors.join(' | '):null});
      }catch(error){shown.push({surface:name,route:route??'(same page)',text:'',plain:'',apiBytes:apiLog.slice(),error:'navigation: '+(error as Error).message});}
    };
    const projectRoute=(module:string)=>'/?view=project&project='+encodeURIComponent(PROJECT_ID)+'&module='+encodeURIComponent(module);
    const moduleReady=(module:string)=>'typeof currentModuleResult!=="undefined"&&(currentModuleResult?.key==='+JSON.stringify(module)+
      '||/Unable to load/.test(document.getElementById("moduleContent").innerText))&&document.getElementById("moduleBadge").textContent!=="Updating"&&'+
      '!document.getElementById("projectModulePanel").hidden';

    // Menu pages: the left navigation as the browser renders it; each opened by its own route.
    await send('Page.navigate',{url:base+projectRoute('master-dashboard')});await settle(moduleReady('master-dashboard'),'first page');
    const menu:string[]=await evaluate('[...document.querySelectorAll("#nav .nav-item[data-key]")].map(b=>b.dataset.key)');
    const registry:string[]=await evaluate('moduleRegistry.map(m=>m.key)');
    assert.ok(menu.length>=40,'left navigation lists the menu pages ('+menu.length+')');
    const visited=new Set<string>(),workspaceTabs:string[]=[];
    for(const page of menu){
      await surface(page,projectRoute(page),moduleReady(page),'document.body');visited.add(page);
      const tabs:string[]=await evaluate('[...document.querySelectorAll("#moduleWorkspaceTabs button[data-key]")].map(b=>b.dataset.key)').catch(()=>[]);
      for(const tab of tabs){
        if(visited.has(tab))continue;
        workspaceTabs.push(tab);
        await surface(tab,projectRoute(tab),moduleReady(tab),'document.body');visited.add(tab);
      }
    }
    // A registry page outside the menu still has a real route (for example Source Quality).
    for(const page of registry.filter(page=>!visited.has(page))){await surface(page,projectRoute(page),moduleReady(page),'document.body');visited.add(page);}
    // Director drawer (Management Brief), project review, documents, Ask CMeng and the portfolio.
    await surface('director drawer',projectRoute('pmo-analysis'),moduleReady('pmo-analysis')+'&&__then__document.getElementById("directorDrawer").open&&!document.getElementById("directorDrawer").hidden',
      'document.getElementById("directorDrawer")','document.getElementById("directorDrawer").open=true');
    await surface('project review',projectRoute('master-dashboard'),moduleReady('master-dashboard')+'&&__then__document.getElementById("projectReviewDrawer").open&&!document.getElementById("projectReviewDrawer").hidden&&!/Loading/i.test(document.getElementById("projectReviewPanel").innerText)',
      'document.getElementById("projectReviewDrawer")','document.getElementById("openProjectActions").click()');
    await surface('documents',null,'document.getElementById("evidenceLibraryDrawer").open&&!/Loading/i.test(document.getElementById("evidenceLibrary").innerText)',
      'document.getElementById("evidenceLibraryDrawer")','document.getElementById("openLibraryQuick").click()');
    await surface('ask cmeng','/?view=ai&project='+encodeURIComponent(PROJECT_ID),'!document.getElementById("aiView").hidden&&!/Loading/i.test(document.getElementById("aiView").innerText)',
      'document.getElementById("aiView")');
    await surface('portfolio','/?view=portfolio','!document.getElementById("portfolioView").hidden&&!/Loading projects/i.test(document.getElementById("portfolioProjects").innerText)',
      'document.getElementById("portfolioView")');

    // ---------- checks
    const failures:string[]=[];
    for(const s of shown){
      if(s.error)failures.push(s.surface+': '+s.error);
      else if(s.text.trim().length<40||/Unable to load|Try this view again/i.test(s.text))failures.push(s.surface+': blank or failed screen');
    }
    // (a) and (b): every reading of a fact equals the source answer key; required pages show it.
    const readings=shown.flatMap(s=>readFacts(s.surface,s.plain,rules));
    for(const rule of rules){
      const mine=readings.filter(r=>r.fact===rule.name);
      for(const r of mine){
        if(r.value===null)failures.push('(b) '+r.surface+' shows "'+r.raw+'" for '+rule.name+'; the source gives '+(rule.kind==='date'?displayDate(String(rule.expected)):rule.expected)+' ['+r.context+']');
        else if(!sameAsShown(rule.kind,r.raw,r.value,rule.expected))failures.push('(b) '+r.surface+' shows '+rule.name+' '+r.raw+'; the source gives '+(rule.kind==='date'?displayDate(String(rule.expected)):rule.expected)+' ['+r.context+']');
      }
      for(const s of shown.filter(s=>!s.error&&rule.requiredOn(s.surface)))
        if(!mine.some(r=>r.surface===s.surface&&r.value!==null&&sameAsShown(rule.kind,r.raw,r.value,rule.expected)))
          failures.push('(a) '+s.surface+' does not show '+rule.name+' '+(rule.kind==='date'?displayDate(String(rule.expected)):rule.expected));
      const values=new Set(mine.map(r=>r.raw));
      console.log('F01 fact '+rule.name+': source '+rule.expected+' · shown on '+new Set(mine.map(r=>r.surface)).size+' pages as '+[...values].slice(0,6).join(' / '));
    }
    // (c) banned words.
    for(const s of shown)for(const [code,pattern] of BANNED){
      const hits=[...s.text.matchAll(pattern)].map(m=>s.text.slice(Math.max(0,m.index!-50),m.index!+m[0].length+30).replace(/\s+/g,' '));
      if(hits.length)failures.push('(c) '+s.surface+' shows banned text '+code+' x'+hits.length+': '+hits.slice(0,2).join(' … '));
    }
    // (d) page data size: every API response a page loads stays under 2 MB, and module pages loaded their own result.
    for(const s of shown){
      for(const r of s.apiBytes)if(r.bytes>MAX_PAGE_BYTES)failures.push('(d) '+s.surface+' loaded '+r.url+' of '+r.bytes+' bytes (limit '+MAX_PAGE_BYTES+')');
      if(registry.includes(s.surface)&&!s.error&&!s.apiBytes.some(r=>/\/(?:modules|management)\//.test(r.url)&&r.bytes>0))
        failures.push('(d) '+s.surface+' has no measured page API response');
    }
    const pages=shown.length,largest=Math.max(...shown.flatMap(s=>s.apiBytes.map(r=>r.bytes)));
    console.log('F01 walked '+pages+' surfaces ('+menu.length+' menu pages, '+workspaceTabs.length+' workspace tabs: '+workspaceTabs.join(', ')+'); readings '+readings.length+'; largest API response '+largest+' bytes');
    assert.equal(new Set(shown.map(s=>s.surface)).size,registry.length+5,'every registry page plus director drawer, project review, documents, Ask CMeng and portfolio is walked');
    assert.ok(workspaceTabs.length>=7,'the workspace tabs are walked ('+workspaceTabs.length+')');
    assert.deepEqual(failures,[],'what the screen shows must equal the source answer key');
  }finally{
    cdp?.close();
    await stop(chrome);await stop(server);
    await rm(root,{recursive:true,force:true}).catch(()=>{});
  }
});
