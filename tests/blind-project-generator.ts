import ExcelJS from 'exceljs';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createHash,randomBytes} from 'node:crypto';

export type BlindScenario =
  | 'complete'
  | 'partial'
  | 'sparse'
  | 'conflicted'
  | 'candidate'
  | 'genuine_zero'
  | 'future_dated'
  | 'undated';

export type BlindLanguage = 'en'|'ar'|'mixed';

export interface BlindDocument {
  filename:string;
  mediaType:string;
  bytes:Uint8Array;
  kind:'xer'|'csv'|'xlsx'|'text'|'pdf';
  domain:string;
  truth:{rows:number;scenario:BlindScenario;facts:Record<string,unknown>};
}

export interface BlindProject {
  seed:string;
  projectId:string;
  projectName:string;
  language:BlindLanguage;
  currency:string;
  dataDateIso:string;
  scenario:BlindScenario;
  documents:BlindDocument[];
  truth:{
    scheduleActivities:number;
    payments:number|null;
    variations:number|null;
    risks:number|null;
    claims:number|null;
    procurement:number|null;
    quality:number|null;
    expectedDomains:string[];
  };
}

function seedNumber(seed:string){
  return Number.parseInt(createHash('sha256').update(seed).digest('hex').slice(0,8),16)>>>0;
}
function rng(seed:string){
  let a=seedNumber(seed);
  return ()=>{
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
function helpers(seed:string){
  const r=rng(seed);
  const pick=<T>(xs:readonly T[])=>xs[Math.floor(r()*xs.length)]!;
  const int=(min:number,max:number)=>Math.floor(r()*(max-min+1))+min;
  const chance=(p:number)=>r()<p;
  const shuffle=<T>(xs:readonly T[])=>{
    const out=[...xs];
    for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j]!,out[i]!];}
    return out;
  };
  return {r,pick,int,chance,shuffle};
}
const englishNames=['Metro Extension','Medical City','Water Transmission','Airport Expansion','Data Centre Campus','University Development','Industrial Utilities','Mixed Use District'];
const arabicNames=['توسعة المطار','مدينة طبية','مشروع الجامعة','شبكة المياه','المجمع الصناعي','مركز البيانات','تطوير المنطقة'];
const currencies=['AED','SAR','USD','EUR','GBP','QAR','JOD'];
const scenarios:BlindScenario[]=['complete','partial','sparse','conflicted','candidate','genuine_zero','future_dated','undated'];
const languages:BlindLanguage[]=['en','ar','mixed'];

const labels={
  certificate:['Certificate Ref','IPC No','Valuation ID','Ref','رقم المستخلص','مرجع الدفعة','ABC'],
  period:['Period End','As Of','Cutoff','Date','نهاية الفترة','تاريخ البيان','XYZ'],
  certified:['Certified Amount','Gross Value','Approved Value','Cumulative Certified','القيمة المعتمدة','إجمالي المستخلص','Q1'],
  paid:['Paid Amount','Cash Paid','Settled Value','Disbursed','المدفوع','قيمة الدفع','Q2'],
  retention:['Retention','Held Amount','Deduction','الاستقطاع','المحتجز','Q3'],
  currency:['Currency','CCY','Curr','العملة','عملة','FX'],
  status:['Status','State','Stage','الحالة','الوضع','S'],
  variation:['Variation Ref','VO No','Change ID','Ref','رقم التغيير','مرجع التغيير','V'],
  approved:['Approved Amount','Agreed Value','Authorised Cost','القيمة المعتمدة','المبلغ الموافق','A'],
  risk:['Risk Ref','Risk ID','Register No','Ref','رقم الخطر','مرجع المخاطر','R'],
  description:['Description','Narrative','Subject','Details','الوصف','الموضوع','D'],
  owner:['Owner','Responsible','Assigned To','المسؤول','المالك','O'],
  due:['Due Date','Target','Required By','تاريخ الاستحقاق','مطلوب بتاريخ','T'],
  claim:['Claim Ref','Claim ID','Case No','Ref','رقم المطالبة','مرجع المطالبة','C'],
  event:['Event','Cause','Delay Event','Description','الحدث','سبب التأخير','E'],
  days:['Days Claimed','Time Requested','Duration','أيام المطالبة','المدة','N'],
  notice:['Notice Date','Issued','Notification','تاريخ الإشعار','تاريخ التبليغ','ND'],
  package:['Package Ref','PO Ref','Material ID','Ref','رقم الحزمة','مرجع التوريد','P'],
  required:['Required On Site','Need Date','Required Date','تاريخ الحاجة','مطلوب بالموقع','RD'],
  forecast:['Forecast Delivery','Expected Arrival','ETA','التوريد المتوقع','تاريخ الوصول','FD'],
  ncr:['NCR Ref','Quality Ref','Issue ID','Ref','رقم عدم المطابقة','مرجع الجودة','NCR'],
  closed:['Closed Date','Closure','Resolved On','تاريخ الإغلاق','تاريخ المعالجة','CD'],
} as const;

function fmtDate(iso:string,variant:number,language:BlindLanguage){
  const [y,m,d]=iso.split('-');
  if(variant%4===0)return iso;
  if(variant%4===1)return d+'/'+m+'/'+y;
  if(variant%4===2)return d+'.'+m+'.'+y;
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const value=d+' '+months[Number(m)-1]+' '+y;
  if(language==='ar'&&variant%3===0)return value.replace(/[0-9]/g,x=>'٠١٢٣٤٥٦٧٨٩'[Number(x)]!);
  return value;
}
function fmtNumber(value:number,variant:number,language:BlindLanguage){
  if(variant%5===0)return value.toFixed(2);
  if(variant%5===1)return value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(variant%5===2)return '('+Math.abs(value).toLocaleString('en-US')+')';
  if(variant%5===3)return String(value);
  const s=value.toLocaleString('en-US');
  return language==='ar'?s.replace(/,/g,'٬').replace(/\./g,'٫').replace(/[0-9]/g,x=>'٠١٢٣٤٥٦٧٨٩'[Number(x)]!):s;
}
function csv(rows:string[][],delimiter:string){
  const q=(v:string)=>'"'+v.replaceAll('"','""')+'"';
  return Buffer.from(rows.map(r=>r.map(q).join(delimiter)).join('\r\n'));
}
function shiftDate(iso:string,days:number){
  const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);
}
function chooseLabel(h:ReturnType<typeof helpers>,key:keyof typeof labels,language:BlindLanguage){
  const options=labels[key];
  const preferred=language==='ar'?options.filter(x=>/[\u0600-\u06ff]/.test(x)):language==='en'?options.filter(x=>!/[\u0600-\u06ff]/.test(x)):options;
  return h.pick(preferred.length?preferred:options);
}
function withJunk(h:ReturnType<typeof helpers>,headers:string[],rows:string[][]){
  const count=h.int(0,3);
  const hs=[...headers],rs=rows.map(r=>[...r]);
  for(let j=0;j<count;j++){
    const at=h.int(0,hs.length),name=h.pick(['Comment '+j,'Misc '+j,'ملاحظات '+j,'Extra_'+j,'X'+j]);
    hs.splice(at,0,name);
    rs.forEach((row,i)=>row.splice(at,0,h.pick(['','n/a','-',String(i+1),'note'])));
  }
  return {headers:hs,rows:rs};
}
function makeXer(h:ReturnType<typeof helpers>,projectId:string,projectName:string,dataDate:string,count:number,language:BlindLanguage){
  const wbsName=language==='ar'?'الأعمال الرئيسية':language==='mixed'?'Main Works / الأعمال الرئيسية':'Main Works';
  const calendar=p6FiveDayCalendarData();
  const lines=[
    'ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date',
    '%R\t1\t'+projectId+'\t'+dataDate,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name',
    '%R\t10\t1\t\tROOT\t'+wbsName,
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    '%R\tC1\tFive Day 8h\t8\t40\t'+calendar,
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'
  ];
  const ids:string[]=[];
  for(let i=0;i<count;i++){
    const id='A'+(1000+i),isFinishMilestone=i===count-1;
    const code=isFinishMilestone?'MS-'+h.int(10,999):h.pick(['CIV','MEP','PRC','TST','ARC'])+'-'+h.int(10,999);
    const name=isFinishMilestone
      ? (language==='ar'?'إنجاز المشروع':language==='mixed'?'Project Completion / إنجاز المشروع':'Project Completion')
      : (language==='ar'?'نشاط '+(i+1):language==='mixed'&&i%3===0?'Activity '+(i+1)+' / نشاط':'Activity '+(i+1));
    const start=shiftDate(dataDate,-h.int(1,120)),finish=shiftDate(dataDate,h.int(1,240));
    const pct=isFinishMilestone?0:h.int(0,100),tf=isFinishMilestone?0:(i===0?8:h.pick([-80,-24,0,8,24,80]));
    const taskType=isFinishMilestone?'TT_FinMile':'TT_Task';
    const duration=isFinishMilestone?0:80,remaining=isFinishMilestone?0:Math.max(0,80*(100-pct)/100);
    const milestoneDate=isFinishMilestone?finish:start;
    lines.push('%R\t'+id.slice(1)+'\t1\t10\tC1\t'+code+'\t'+name+'\t'+taskType+'\t'+(pct===100?'TK_Complete':pct>0?'TK_Active':'TK_NotStart')+'\t'+milestoneDate+'\t'+finish+'\t'+milestoneDate+'\t'+finish+'\t'+duration+'\t'+remaining+'\t'+tf+'\t'+pct);
    ids.push(id.slice(1));
  }
  if(count>1){
    lines.push('%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt');
    for(let i=1;i<count;i++)lines.push('%R\t'+(5000+i)+'\t'+ids[i]+'\t'+ids[i-1]+'\tPR_FS\t0');
  }
  lines.push('%E');
  return Buffer.from(lines.join('\n'));
}

function paymentTable(h:ReturnType<typeof helpers>,currency:string,dataDate:string,scenario:BlindScenario,language:BlindLanguage,variant:number){
  const n=scenario==='genuine_zero'?0:h.int(2,8);
  let cumulative=0;
  const headers=[chooseLabel(h,'certificate',language),chooseLabel(h,'period',language),chooseLabel(h,'certified',language),chooseLabel(h,'paid',language),chooseLabel(h,'retention',language),chooseLabel(h,'currency',language),chooseLabel(h,'status',language)];
  const rows:string[][]=[];
  for(let i=0;i<n;i++){
    cumulative+=h.int(50_000,300_000);
    const date=scenario==='future_dated'?shiftDate(dataDate,h.int(10,90)):scenario==='undated'?'':shiftDate(dataDate,-h.int(1,180));
    const paid=Math.max(0,cumulative-h.int(0,50_000));
    rows.push(['PC-'+h.int(100,999),date?fmtDate(date,variant+i,language):'',fmtNumber(cumulative,variant+i,language),fmtNumber(paid,variant+i+1,language),fmtNumber(h.int(0,30_000),variant+i+2,language),currency,h.pick(['Certified','Paid','Open','معتمد','مدفوع'])]);
  }
  if(scenario==='partial'&&rows.length)rows[0]![3]='';
  if(scenario==='conflicted'&&rows.length>1)rows.push([...rows[0]!.slice(0,2),fmtNumber(cumulative+h.int(10000,40000),variant,language),...rows[0]!.slice(3)]);
  return {headers,rows,facts:{paymentRows:rows.length,currency}};
}
function genericRegister(h:ReturnType<typeof helpers>,domain:string,dataDate:string,scenario:BlindScenario,language:BlindLanguage,variant:number){
  const count=scenario==='genuine_zero'?0:h.int(1,7);
  let headers:string[]=[];const rows:string[][]=[];
  if(domain==='variations'){
    headers=[chooseLabel(h,'variation',language),chooseLabel(h,'description',language),chooseLabel(h,'approved',language),chooseLabel(h,'period',language),chooseLabel(h,'status',language)];
    for(let i=0;i<count;i++)rows.push(['VO-'+h.int(1,999),language==='ar'?'تغيير '+i:'Change '+i,fmtNumber(h.int(5000,250000),variant+i,language),scenario==='undated'?'':fmtDate(shiftDate(dataDate,-h.int(1,120)),variant+i,language),h.pick(['Approved','Pending','موافق','قيد المراجعة'])]);
  }else if(domain==='risks'){
    headers=[chooseLabel(h,'risk',language),chooseLabel(h,'description',language),chooseLabel(h,'owner',language),chooseLabel(h,'due',language),chooseLabel(h,'status',language)];
    for(let i=0;i<count;i++)rows.push(['R-'+h.int(1,999),language==='ar'?'خطر '+i:'Risk '+i,h.pick(['PM','Contractor','Designer','المقاول','الاستشاري','']),fmtDate(shiftDate(dataDate,h.int(-30,90)),variant+i,language),h.pick(['Open','Closed','High','مفتوح','مغلق'])]);
  }else if(domain==='claims'){
    headers=[chooseLabel(h,'claim',language),chooseLabel(h,'event',language),chooseLabel(h,'days',language),chooseLabel(h,'notice',language),chooseLabel(h,'status',language)];
    for(let i=0;i<count;i++)rows.push(['C-'+h.int(1,999),language==='ar'?'حدث تأخير '+i:'Delay event '+i,String(h.int(0,60)),scenario==='undated'?'':fmtDate(shiftDate(dataDate,-h.int(1,90)),variant+i,language),h.pick(['Submitted','Under Review','مقدم','قيد المراجعة'])]);
  }else if(domain==='procurement'){
    headers=[chooseLabel(h,'package',language),chooseLabel(h,'description',language),chooseLabel(h,'required',language),chooseLabel(h,'forecast',language),chooseLabel(h,'status',language)];
    for(let i=0;i<count;i++)rows.push(['PK-'+h.int(1,999),language==='ar'?'مادة '+i:'Material '+i,fmtDate(shiftDate(dataDate,h.int(10,150)),variant+i,language),fmtDate(shiftDate(dataDate,h.int(20,200)),variant+i+1,language),h.pick(['Ordered','Delivered','Late','مطلوب','متأخر'])]);
  }else{
    headers=[chooseLabel(h,'ncr',language),chooseLabel(h,'description',language),chooseLabel(h,'owner',language),chooseLabel(h,'closed',language),chooseLabel(h,'status',language)];
    for(let i=0;i<count;i++)rows.push(['NCR-'+h.int(1,999),language==='ar'?'ملاحظة جودة '+i:'Quality issue '+i,h.pick(['QA/QC','Contractor','المقاول','']),scenario==='undated'?'':fmtDate(shiftDate(dataDate,h.int(-30,90)),variant+i,language),h.pick(['Open','Closed','مفتوح','مغلق'])]);
  }
  return {headers,rows,facts:{rows:rows.length}};
}

async function xlsxBytes(h:ReturnType<typeof helpers>,title:string,headers:string[],rows:string[][],language:BlindLanguage){
  const wb=new ExcelJS.Workbook();
  if(h.chance(0.6)){
    const intro=wb.addWorksheet(h.pick(['Cover','Notes','ملاحظات','Summary']));
    intro.addRow([title]);intro.addRow(['Generated blind evidence']);intro.addRow(['Ignore this worksheet']);
  }
  const sheet=wb.addWorksheet(h.pick(['Data','Register','Sheet '+h.int(2,9),'البيانات','السجل']));
  const topJunk=h.int(0,4);
  for(let i=0;i<topJunk;i++)sheet.addRow([i===0?title:'',h.pick(['','Generated','Confidential','سري'])]);
  if(h.chance(0.35)){
    sheet.addRow([language==='ar'?'بيانات المشروع':'Project Data']);
  }
  sheet.addRow(headers);
  rows.forEach(r=>sheet.addRow(r));
  if(h.chance(0.4))sheet.addRow(['TOTAL','','','','']);
  if(h.chance(0.3)){
    const extra=wb.addWorksheet(h.pick(['Archive','Old','مرجع']));
    extra.addRow(['Reference only']);extra.addRow(['X','Y']);extra.addRow(['1','2']);
  }
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

export async function generateBlindProject(seed:string,index=0):Promise<BlindProject>{
  const h=helpers(seed+'::'+index);
  const language=languages[index%languages.length]!,scenario=scenarios[index%scenarios.length]!,currency=currencies[index%currencies.length]!;
  const projectId='BLIND-'+createHash('sha256').update(seed+'|'+index).digest('hex').slice(0,10).toUpperCase();
  const baseName=language==='ar'?h.pick(arabicNames):language==='mixed'?h.pick(englishNames)+' / '+h.pick(arabicNames):h.pick(englishNames);
  const projectName=baseName+' '+h.int(1,999);
  const dataDateIso='2036-'+String(h.int(2,10)).padStart(2,'0')+'-'+String(h.int(2,24)).padStart(2,'0');
  const docs:BlindDocument[]=[];
  const activityCount=h.int(4,24);
  docs.push({filename:h.pick(['programme.xer','Schedule_Update.xer','P6_'+h.int(1,99)+'.xer','البرنامج.xer']),mediaType:'text/plain',bytes:makeXer(h,projectId,projectName,dataDateIso,activityCount,language),kind:'xer',domain:'schedule',truth:{rows:activityCount,scenario,facts:{activityCount}}});

  const candidateDomains=h.shuffle(['payments','variations','risks','claims','procurement','quality']);
  const domainCount=scenario==='sparse'?h.int(1,2):h.int(3,6);
  const chosen=candidateDomains.slice(0,domainCount);
  for(let d=0;d<chosen.length;d++){
    const domain=chosen[d]!;
    const built=domain==='payments'?paymentTable(h,currency,dataDateIso,scenario,language,index+d):genericRegister(h,domain,dataDateIso,scenario,language,index+d);
    let {headers,rows}=withJunk(h,built.headers,built.rows);
    const order=h.shuffle(headers.map((_,i)=>i));
    headers=order.map(i=>headers[i]!);
    rows=rows.map(row=>order.map(i=>row[i]??''));
    const useXlsx=h.chance(0.5);
    const filenameStem=h.pick(['data','register','control','evidence','records','بيانات','سجل'])+'_'+h.int(1,999);
    const bytes=useXlsx?await xlsxBytes(h,projectName,headers,rows,language):csv([...(h.chance(0.35)?[[projectName],['']]:[]),headers,...rows],h.pick([',',';','\t']));
    docs.push({filename:filenameStem+(useXlsx?'.xlsx':'.csv'),mediaType:useXlsx?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv',bytes,kind:useXlsx?'xlsx':'csv',domain,truth:{rows:rows.length,scenario,facts:built.facts}});
  }
  if(h.chance(0.4))docs.push({filename:h.pick(['readme.txt','Notes.txt','ملاحظات.txt']),mediaType:'text/plain',bytes:Buffer.from(language==='ar'?'ملاحظات عامة للمشروع':'General project notes. No tabular authority.'),kind:'text',domain:'other',truth:{rows:0,scenario,facts:{}}});

  const count=(domain:string)=>docs.filter(d=>d.domain===domain).reduce((s,d)=>s+d.truth.rows,0);
  return {
    seed,projectId,projectName,language,currency,dataDateIso,scenario,documents:h.shuffle(docs),
    truth:{
      scheduleActivities:activityCount,
      payments:chosen.includes('payments')?count('payments'):null,
      variations:chosen.includes('variations')?count('variations'):null,
      risks:chosen.includes('risks')?count('risks'):null,
      claims:chosen.includes('claims')?count('claims'):null,
      procurement:chosen.includes('procurement')?count('procurement'):null,
      quality:chosen.includes('quality')?count('quality'):null,
      expectedDomains:['schedule',...chosen],
    },
  };
}

export async function generateBlindRound(seed:string,count:number){
  const projects:BlindProject[]=[];
  for(let i=0;i<count;i++)projects.push(await generateBlindProject(seed,i));
  return {seed,projects};
}

export interface StorageBlindProject extends BlindProject {
  storageActivityCount:number;
}
export async function generateStorageBlindProject(seed:string,index=0):Promise<StorageBlindProject>{
  const project=await generateBlindProject(seed,index);
  const h=helpers(seed+'::storage::'+index);
  const storageActivityCount=h.int(250,1500);
  const schedule=project.documents.find(document=>document.domain==='schedule');
  if(!schedule)throw new Error('STORAGE_BLIND_SCHEDULE_REQUIRED');
  schedule.bytes=makeXer(h,project.projectId,project.projectName,project.dataDateIso,storageActivityCount,project.language);
  schedule.truth={...schedule.truth,rows:storageActivityCount,facts:{...schedule.truth.facts,activityCount:storageActivityCount}};
  project.truth.scheduleActivities=storageActivityCount;
  return {...project,storageActivityCount};
}
export async function generateStorageBlindRound(seed:string,count:number){
  const projects:StorageBlindProject[]=[];
  for(let i=0;i<count;i++)projects.push(await generateStorageBlindProject(seed,i));
  return {seed,projects};
}

const mixedHeaders:Record<string,string[]>={
  payments:['Certificate No','Period End','Net Certified','Paid Amount','Retention','Currency','Status'],
  variations:['Variation ID','Description','Approved Amount','Period End','Status','Currency'],
  risks:['Risk ID','Description','Owner','Due Date','Status'],
  claims:['Claim ID','Event','Days Claimed','Notice Date','Status'],
  procurement:['Package ID','Description','Required On Site','Forecast Delivery','Status','Linked Activity'],
  quality:['NCR ID','Description','Owner','Closed Date','Status'],
};

async function mixedWorkbookBytes(
  h:ReturnType<typeof helpers>,
  projectName:string,
  currency:string,
  dataDateIso:string,
  scenario:BlindScenario,
  language:BlindLanguage,
  domains:string[],
  variant:number,
){
  const workbook=new ExcelJS.Workbook();
  const cover=workbook.addWorksheet(language==='ar'?'ملخص '+h.int(10,999):'Summary '+h.int(10,999));
  cover.addRow([projectName]);cover.addRow([language==='ar'?'تقرير متابعة المشروع':'Project control report']);cover.addRow(['']);
  const domainRows:Record<string,number>={};
  for(const [offset,domain] of domains.entries()){
    const built=domain==='payments'?paymentTable(h,currency,dataDateIso,scenario,language,variant+offset):genericRegister(h,domain,dataDateIso,scenario,language,variant+offset);
    let headers=[...mixedHeaders[domain]!],rows=built.rows.map(row=>[...row]);
    if(domain==='variations')rows=rows.map(row=>[...row,currency]);
    if(domain==='procurement')rows=rows.map(row=>[...row,'1000']);
    ({headers,rows}=withJunk(h,headers,rows));
    const order=h.shuffle(headers.map((_,index)=>index));
    headers=order.map(index=>headers[index]!);
    rows=rows.map(row=>order.map(index=>row[index]??''));
    const sheet=workbook.addWorksheet((language==='ar'?'بيانات ':'Data ')+(offset+1)+' '+h.int(10,999));
    for(let i=0;i<h.int(0,3);i++)sheet.addRow([i===0?projectName:'',h.pick(['','Control report','سري','Monthly'])]);
    sheet.addRow(headers);rows.forEach(row=>sheet.addRow(row));
    if(h.chance(0.35))sheet.addRow(['TOTAL','','','','','','']);
    domainRows[domain]=rows.length;
  }
  if(h.chance(0.5)){
    const notes=workbook.addWorksheet(language==='ar'?'ملاحظات '+h.int(10,999):'Notes '+h.int(10,999));
    notes.addRow(['Reference only']);notes.addRow(['Comment','Value']);notes.addRow(['Prepared','Yes']);
  }
  return {bytes:new Uint8Array(await workbook.xlsx.writeBuffer()),domainRows};
}

export async function generateMixedWorkbookBlindProject(seed:string,index=0):Promise<BlindProject>{
  const h=helpers(seed+'::mixed::'+index);
  const language=languages[(index+1)%languages.length]!,scenario=scenarios[(index+3)%scenarios.length]!,currency=currencies[(index+2)%currencies.length]!;
  const projectId='BLIND-MIX-'+createHash('sha256').update(seed+'|mixed|'+index).digest('hex').slice(0,10).toUpperCase();
  const baseName=language==='ar'?h.pick(arabicNames):language==='mixed'?h.pick(englishNames)+' / '+h.pick(arabicNames):h.pick(englishNames);
  const projectName=baseName+' '+h.int(100,999),dataDateIso='2037-'+String(h.int(2,10)).padStart(2,'0')+'-'+String(h.int(2,24)).padStart(2,'0');
  const activityCount=h.int(8,30),docs:BlindDocument[]=[];
  docs.push({filename:h.pick(['programme.xer','Update_'+h.int(1,99)+'.xer','البرنامج.xer']),mediaType:'text/plain',
    bytes:makeXer(h,projectId,projectName,dataDateIso,activityCount,language),kind:'xer',domain:'schedule',truth:{rows:activityCount,scenario,facts:{activityCount}}});
  const selected=h.shuffle(['payments','variations','risks','claims','procurement','quality']).slice(0,h.int(3,6));
  const mixed=await mixedWorkbookBytes(h,projectName,currency,dataDateIso,scenario,language,selected,index*7);
  docs.push({filename:h.pick(['monthly_control','project_data','status_pack','controls','متابعة'])+'_'+h.int(100,999)+'.xlsx',
    mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bytes:mixed.bytes,kind:'xlsx',domain:'mixed_registers',
    truth:{rows:Object.values(mixed.domainRows).reduce((a,b)=>a+b,0),scenario,facts:{domainRows:mixed.domainRows,domains:selected}}});
  const count=(domain:string)=>mixed.domainRows[domain]??null;
  return {seed,projectId,projectName,language,currency,dataDateIso,scenario,documents:docs,
    truth:{scheduleActivities:activityCount,payments:selected.includes('payments')?count('payments'):null,
      variations:selected.includes('variations')?count('variations'):null,risks:selected.includes('risks')?count('risks'):null,
      claims:selected.includes('claims')?count('claims'):null,procurement:selected.includes('procurement')?count('procurement'):null,
      quality:selected.includes('quality')?count('quality'):null,expectedDomains:['schedule',...selected]}};
}

export async function generateMixedWorkbookBlindRound(seed:string,count:number){
  const projects:BlindProject[]=[];
  for(let i=0;i<count;i++)projects.push(await generateMixedWorkbookBlindProject(seed,i));
  return {seed,projects};
}


export type LifecycleBlindDomain='interfaces'|'submittals'|'assets'|'commissioning'|'hse'|'resources'|'measurements'|'evm';
export interface LifecycleMixedBlindProject {
  seed:string;projectId:string;projectName:string;dataDateIso:string;currency:string;language:BlindLanguage;
  documents:BlindDocument[];expectedDomains:LifecycleBlindDomain[];expectedTypes:string[];
}
const lifecycleType:Record<LifecycleBlindDomain,string>={
  interfaces:'interface_register',submittals:'submittal_register',assets:'asset_register',
  commissioning:'testing_commissioning_register',hse:'hse_report',resources:'resource_register',
  measurements:'installed_measurement_register',evm:'cost_evm_report',
};
function lifecycleTable(h:ReturnType<typeof helpers>,domain:LifecycleBlindDomain,dataDate:string,currency:string,index:number){
  const date=shiftDate(dataDate,-h.int(1,30)),future=shiftDate(dataDate,h.int(5,60));
  if(domain==='interfaces')return {headers:['Interface ID','Giving Party','Receiving Party','Required Deliverable','Status','Linked Activity'],
    rows:[[ 'IF-'+h.int(10,999),'Contractor','Designer','Approved drawing','Open','1000' ]]};
  if(domain==='submittals')return {headers:['Submittal ID','Submitted Date','Approval Date','Status','Procurement Package','Linked Activity'],
    rows:[[ 'SUB-'+h.int(10,999),date,index%3===0?'':future,index%3===0?'Under Review':'Approved','PK-1','1000' ]]};
  if(domain==='assets')return {headers:['Asset ID','System','Tag Installed','Commissioned','O&M Manual','Warranty','Status'],
    rows:[[ 'AST-'+h.int(10,999),'HVAC','Yes',index%2?'Yes':'No',index%3?'Yes':'No','Yes',index%2?'Ready':'In Progress' ]]};
  if(domain==='commissioning')return {headers:['Test ID','Test','Planned Date','Actual Date','Authority Witness','Status','Linked Activity'],
    rows:[[ 'T-'+h.int(10,999),'Functional test',date,index%2?date:'','Client',index%2?'Passed':'Planned','1000' ]]};
  if(domain==='hse')return {headers:['Report Date','Man Hours','Lost Time Injuries','Medical Treatment Cases','First Aid Cases','Near Misses','TRIR'],
    rows:[[date,'12000',String(index%2),String(index%3===0?1:0),'2','3',String(((index%2+(index%3===0?1:0))/12000*200000).toFixed(2))]]};
  if(domain==='resources')return {headers:['Resource ID','Resource Name','Class','Unit','Utilization Applicable','Week Start','Available Capacity','Planned Demand','Actual Approved Usage'],
    rows:[[ 'LAB-'+h.int(10,99),'Civil Labour','Labor','labor_hour','Yes',date,'1000','900','820' ]]};
  if(domain==='measurements')return {headers:['Measurement Date','Item No','Cumulative Installed Qty','Unit'],
    rows:[[date,'B1',String(10+index),'m3']]};
  return {headers:['Metric','Value','Unit','Status','As Of','VAT Basis'],
    rows:[['EV',String(700+index),currency,'Approved',date,'Exclusive'],['AC',String(800+index),currency,'Actual',date,'Exclusive'],['PV',String(750+index),currency,'Plan',date,'Exclusive']]};
}
async function lifecycleWorkbookBytes(h:ReturnType<typeof helpers>,projectName:string,dataDate:string,currency:string,domains:LifecycleBlindDomain[],index:number){
  const workbook=new ExcelJS.Workbook();
  const cover=workbook.addWorksheet(h.pick(['Summary','Overview','ملخص','Notes']));
  cover.addRow([projectName]);cover.addRow(['Monthly controls']);cover.addRow(['']);
  for(const [offset,domain] of domains.entries()){
    let {headers,rows}=lifecycleTable(h,domain,dataDate,currency,index+offset);
    ({headers,rows}=withJunk(h,headers,rows));
    const order=h.shuffle(headers.map((_,i)=>i));headers=order.map(i=>headers[i]!);rows=rows.map(row=>order.map(i=>row[i]??''));
    const sheet=workbook.addWorksheet(h.pick(['Data','Register','Sheet','بيانات'])+' '+(offset+1)+' '+h.int(10,999));
    for(let n=0;n<h.int(0,2);n++)sheet.addRow([n===0?projectName:'',h.pick(['','Monthly','سري'])]);
    sheet.addRow(headers);rows.forEach(row=>sheet.addRow(row));
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export async function generateLifecycleMixedWorkbookBlindProject(seed:string,index=0):Promise<LifecycleMixedBlindProject>{
  const h=helpers(seed+'::lifecycle::'+index),all:LifecycleBlindDomain[]=['interfaces','submittals','assets','commissioning','hse','resources','measurements','evm'];
  const mandatory=all[index%all.length]!,selected=[mandatory,...h.shuffle(all.filter(x=>x!==mandatory)).slice(0,h.int(4,7))];
  const domains=[...new Set(selected)] as LifecycleBlindDomain[];
  const language=languages[(index+2)%languages.length]!,currency=currencies[(index+3)%currencies.length]!;
  const projectId='BLIND-LIFE-'+createHash('sha256').update(seed+'|lifecycle|'+index).digest('hex').slice(0,10).toUpperCase();
  const projectName=(language==='ar'?h.pick(arabicNames):h.pick(englishNames))+' '+h.int(100,999);
  const dataDateIso='2038-'+String(h.int(2,10)).padStart(2,'0')+'-'+String(h.int(2,24)).padStart(2,'0');
  const docs:BlindDocument[]=[{filename:h.pick(['programme.xer','Current_'+h.int(1,99)+'.xer','البرنامج.xer']),mediaType:'text/plain',
    bytes:makeXer(h,projectId,projectName,dataDateIso,h.int(10,35),language),kind:'xer',domain:'schedule',truth:{rows:1,scenario:'complete',facts:{}}}];
  if(domains.includes('measurements'))docs.push({filename:'scope_'+h.int(10,999)+'.csv',mediaType:'text/csv',
    bytes:csv([['Item No','Description','Unit','Quantity','Rate','Amount','Currency'],['B1','Concrete','m3','100','10','1000',currency]],','),
    kind:'csv',domain:'boq',truth:{rows:1,scenario:'complete',facts:{}}});
  docs.push({filename:h.pick(['information','monthly_pack','project_controls','records','بيانات'])+'_'+h.int(100,999)+'.xlsx',
    mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    bytes:await lifecycleWorkbookBytes(h,projectName,dataDateIso,currency,domains,index),kind:'xlsx',domain:'mixed_lifecycle',
    truth:{rows:domains.length,scenario:'complete',facts:{domains}}});
  return {seed,projectId,projectName,dataDateIso,currency,language,documents:docs,expectedDomains:domains,expectedTypes:domains.map(d=>lifecycleType[d])};
}
export async function generateLifecycleMixedWorkbookBlindRound(seed:string,count:number){
  const projects:LifecycleMixedBlindProject[]=[];
  for(let i=0;i<count;i++)projects.push(await generateLifecycleMixedWorkbookBlindProject(seed,i));
  return {seed,projects};
}


export type SemanticAiBlindDomain='payments'|'variations'|'risks'|'claims'|'procurement'|'quality';
export interface SemanticAiBlindProject {
  seed:string;projectId:string;projectName:string;dataDateIso:string;currency:string;language:BlindLanguage;
  domain:SemanticAiBlindDomain;expectedDocumentType:string;documents:BlindDocument[];
}
const semanticAiType:Record<SemanticAiBlindDomain,string>={
  payments:'payment_certificates',variations:'variation_register',risks:'risk_register',
  claims:'delay_eot_claims_register',procurement:'procurement_register',quality:'quality_ncr_register',
};
function semanticAiOpaqueTable(h:ReturnType<typeof helpers>,domain:SemanticAiBlindDomain,dataDate:string,currency:string,index:number){
  let meanings:string[]=[],rows:string[][]=[];
  if(domain==='payments'){
    meanings=['certificate no','period end','net certified','paid amount','currency','status'];
    rows=Array.from({length:3},(_,i)=>['PC-'+h.int(100,999),shiftDate(dataDate,-30*(3-i)),String(1000+(i+1)*700+index),String(900+(i+1)*650+index),currency,i===2?'Paid':'Certified']);
  }else if(domain==='variations'){
    meanings=['variation id','description','approved amount','currency','status'];
    rows=Array.from({length:2},(_,i)=>['VO-'+h.int(10,999),'Scope change '+(i+1),String(5000+h.int(100,9000)+index),currency,i?'Pending':'Approved']);
  }else if(domain==='risks'){
    meanings=['risk id','description','owner','due date','status'];
    rows=Array.from({length:2},(_,i)=>['R-'+h.int(10,999),i?'Design coordination exposure':'Access constraint',i?'Designer':'Contractor',shiftDate(dataDate,10+i*20),i?'High':'Open']);
  }else if(domain==='claims'){
    meanings=['claim id','event','days claimed','notice date','status'];
    rows=Array.from({length:2},(_,i)=>['C-'+h.int(10,999),i?'Late design release':'Restricted access',String(10+i*7),shiftDate(dataDate,-40+i*10),i?'Under Review':'Submitted']);
  }else if(domain==='procurement'){
    meanings=['package id','description','required on site','forecast delivery','status','linked activity'];
    rows=Array.from({length:2},(_,i)=>['PK-'+h.int(10,999),i?'Switchgear':'Chiller',shiftDate(dataDate,30+i*20),shiftDate(dataDate,45+i*25),i?'Late':'Ordered','1000']);
  }else{
    meanings=['ncr id','description','owner','closed date','status'];
    rows=Array.from({length:2},(_,i)=>['NCR-'+h.int(10,999),i?'Waterproofing defect':'Concrete surface defect',i?'Contractor':'QA/QC',i?shiftDate(dataDate,-5):'',i?'Closed':'Open']);
  }
  const order=h.shuffle(meanings.map((_,i)=>i));
  const shuffledMeanings=order.map(i=>meanings[i]!);
  const shuffledRows=rows.map(row=>order.map(i=>row[i]??''));
  const headers=shuffledMeanings.map((_,i)=>'ZX'+String(index+1).padStart(2,'0')+'_'+String(i+1).padStart(2,'0')+'_'+h.int(100,999));
  return {headers,rows:shuffledRows,meanings:shuffledMeanings};
}
export async function generateSemanticAiBlindProject(seed:string,index=0):Promise<SemanticAiBlindProject>{
  const h=helpers(seed+'::semantic-ai::'+index),domains:SemanticAiBlindDomain[]=['payments','variations','risks','claims','procurement','quality'];
  const domain=domains[index%domains.length]!,language=languages[(index+1)%languages.length]!,currency=currencies[(index+4)%currencies.length]!;
  const projectId='BLIND-AI-'+createHash('sha256').update(seed+'|semantic-ai|'+index).digest('hex').slice(0,10).toUpperCase();
  const projectName=(language==='ar'?h.pick(arabicNames):language==='mixed'?h.pick(englishNames)+' / '+h.pick(arabicNames):h.pick(englishNames))+' '+h.int(100,999);
  const dataDateIso='2039-'+String(h.int(2,10)).padStart(2,'0')+'-'+String(h.int(2,24)).padStart(2,'0');
  const table=semanticAiOpaqueTable(h,domain,dataDateIso,currency,index),activityCount=h.int(8,25);
  const docs:BlindDocument[]=[
    {filename:h.pick(['programme.xer','Current_'+h.int(1,99)+'.xer','البرنامج.xer']),mediaType:'text/plain',
      bytes:makeXer(h,projectId,projectName,dataDateIso,activityCount,language),kind:'xer',domain:'schedule',
      truth:{rows:activityCount,scenario:'complete',facts:{activityCount}}},
    {filename:h.pick(['payload','information','records','source'])+'_'+h.int(100,999)+'.csv',mediaType:'text/csv',
      bytes:csv([table.headers,...table.rows],h.pick([',',';','\t'])),kind:'csv',domain,
      truth:{rows:table.rows.length,scenario:'complete',facts:{expectedDocumentType:semanticAiType[domain],meanings:table.meanings}}},
  ];
  return {seed,projectId,projectName,dataDateIso,currency,language,domain,expectedDocumentType:semanticAiType[domain],documents:h.shuffle(docs)};
}
export async function generateSemanticAiBlindRound(seed:string,count:number){
  const projects:SemanticAiBlindProject[]=[];
  for(let i=0;i<count;i++)projects.push(await generateSemanticAiBlindProject(seed,i));
  return {seed,projects};
}


export type ScheduleLifecycleBlindStage='baseline'|'current'|'same'|'earlier'|'later'|'undated'|'recovery'|'draft'|'revised_baseline';
export interface ScheduleLifecycleBlindProject {
  seed:string;projectId:string;projectName:string;language:BlindLanguage;
  baseDataDateIso:string;laterDataDateIso:string;baselineDataDateIso:string;
  stages:Record<ScheduleLifecycleBlindStage,BlindDocument>;
}
function scheduleLifecycleDocument(filename:string,bytes:Uint8Array,stage:ScheduleLifecycleBlindStage,rows:number):BlindDocument{
  return {filename,mediaType:'text/plain',bytes,kind:'xer',domain:'schedule_'+stage,
    truth:{rows,scenario:'complete',facts:{stage}}};
}
function undatedScheduleBytes(h:ReturnType<typeof helpers>,projectId:string,projectName:string,dateIso:string,count:number,language:BlindLanguage){
  const source=makeXer(h,projectId,projectName,dateIso,count,language).toString('utf8');
  return Buffer.from(source.replace('%R\t1\t'+projectId+'\t'+dateIso,'%R\t1\t'+projectId+'\t'));
}
export async function generateScheduleLifecycleBlindProject(seed:string,index=0):Promise<ScheduleLifecycleBlindProject>{
  const h=helpers(seed+'::schedule-lifecycle::'+index),language=languages[index%languages.length]!;
  const projectId='BLIND-SCH-'+createHash('sha256').update(seed+'|schedule-lifecycle|'+index).digest('hex').slice(0,10).toUpperCase();
  const projectName=(language==='ar'?h.pick(arabicNames):language==='mixed'?h.pick(englishNames)+' / '+h.pick(arabicNames):h.pick(englishNames))+' '+h.int(100,999);
  const baseDataDateIso='2040-'+String(h.int(3,8)).padStart(2,'0')+'-'+String(h.int(5,20)).padStart(2,'0');
  const baselineDataDateIso=shiftDate(baseDataDateIso,-h.int(56,180));
  const earlier=shiftDate(baseDataDateIso,-h.int(7,45));
  const laterDataDateIso=shiftDate(baseDataDateIso,h.int(7,45));
  const recovery=shiftDate(baseDataDateIso,h.int(14,75));
  const draft=shiftDate(baseDataDateIso,h.int(21,100));
  const revised=shiftDate(baseDataDateIso,h.int(35,140));
  // J4 accuracy cohorts should resemble unfamiliar project programmes, not tiny toy fixtures.
  // Scale is certified elsewhere; this wider range is for semantic/lifecycle variety.
  const count=h.int(35,160);
  const stages:Record<ScheduleLifecycleBlindStage,BlindDocument>={
    baseline:scheduleLifecycleDocument(h.pick(['Baseline_Rev0_','Contract_Baseline_','Tender_Baseline_','Baseline_Programme_'])+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,baselineDataDateIso,count,language),'baseline',count),
    current:scheduleLifecycleDocument(h.pick(['Current_Programme_','Weekly_Update_','Progress_Update_','Programme_Status_'])+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,baseDataDateIso,count,language),'current',count),
    same:scheduleLifecycleDocument(h.pick(['Weekly_Update_','Progress_Cutoff_','Status_Programme_'])+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,baseDataDateIso,count,language),'same',count),
    earlier:scheduleLifecycleDocument(h.pick(['Previous_Update_','Archive_Programme_','Prior_Status_'])+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,earlier,count,language),'earlier',count),
    later:scheduleLifecycleDocument(h.pick(['Latest_Update_','Monthly_Programme_','Progress_Update_','Programme_Status_'])+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,laterDataDateIso,count,language),'later',count),
    undated:scheduleLifecycleDocument(h.pick(['Update_No_DD_','Programme_Extract_','Status_Undated_'])+h.int(10,999)+'.xer',undatedScheduleBytes(h,projectId,projectName,baseDataDateIso,count,language),'undated',count),
    recovery:scheduleLifecycleDocument(h.pick(['Recovery_Plan_','Mitigation_Programme_','Acceleration_Programme_'])+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,recovery,count,language),'recovery',count),
    draft:scheduleLifecycleDocument(h.pick(['DRAFT_Future_','WhatIf_Programme_','Scenario_Draft_'])+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,draft,count,language),'draft',count),
    revised_baseline:scheduleLifecycleDocument(h.pick(['Revised_Baseline_','Proposed_Baseline_','Rebaseline_Submission_'])+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,revised,count,language),'revised_baseline',count),
  };
  return {seed,projectId,projectName,language,baseDataDateIso,laterDataDateIso,baselineDataDateIso,stages};
}
export async function generateScheduleLifecycleBlindRound(seed:string,count:number){
  const projects:ScheduleLifecycleBlindProject[]=[];
  for(let i=0;i<count;i++)projects.push(await generateScheduleLifecycleBlindProject(seed,i));
  return {seed,projects};
}


export type DeliveryFeatureBlindKind=
  'package'|'supplier'|'submittal'|'design'|'workfront'|'interface'|'quality'|'permit'|'hse'|'commissioning'|'asset'|'snag'|'spare'|'handover'|'weather'|'location'|'lifecycle'|'gate';
export interface DeliveryFeatureBlindProject {
  seed:string;projectId:string;projectName:string;dataDateIso:string;currency:string;language:BlindLanguage;
  documents:BlindDocument[];expectedKinds:DeliveryFeatureBlindKind[];
  featureTruth:{items:Array<{itemNumber:string;description:string;unit:string;quantity:number;installed:number;activityId:string}>};
}
const deliveryFeatureKinds:DeliveryFeatureBlindKind[]=[
  'package','supplier','submittal','design','workfront','interface','quality','permit','hse',
  'commissioning','asset','snag','spare','handover','weather','location','lifecycle','gate'
];
function deliveryFeatureTable(h:ReturnType<typeof helpers>,kind:DeliveryFeatureBlindKind,dataDate:string,currency:string,index:number){
  const past=(n=0)=>shiftDate(dataDate,-h.int(1+n,30+n)),future=(n=0)=>shiftDate(dataDate,h.int(5+n,60+n));
  if(kind==='package')return {headers:['Package ID','Description','Required On Site','Forecast Delivery','Status','Linked Activity','Package Value','Currency','Unit','Ordered Quantity','Ordered Date','Delivered Quantity','Delivered Date','Accepted Quantity','Accepted Date','PO Planned Date','PO Forecast Date','PO Actual Date','Delivery Planned Date','Delivery Forecast Date','Delivery Actual Date'],
    rows:[['PK-'+h.int(100,999),'Transformer package',future(),future(10),'Ordered','1000',String(h.int(100000,900000)),currency,'No.','10',past(20),'8',past(5),'7',past(2),past(40),past(35),past(30),past(12),past(8),past(5)]]};
  if(kind==='supplier')return {headers:['Supplier ID','Description','Status','Owner'],rows:[['SUP-'+h.int(100,999),'Specialist supplier','Active','Procurement']]};
  if(kind==='submittal')return {headers:['Submittal ID','Description','Submitted Date','Actual Submission Date','Approval Date','Status','Linked Activity'],
    rows:[['SUB-'+h.int(100,999),'Technical submittal',past(20),past(20),index%2?past():'',index%2?'Approved':'Under Review','1000']]};
  if(kind==='design')return {headers:['RFI ID','Description','Raised Date','Required Response','Response Date','Status','Linked Activity'],
    rows:[['RFI-'+h.int(100,999),'Design coordination query',past(20),past(5),index%3?past():'',index%3?'Closed':'Open','1000']]};
  if(kind==='workfront')return {headers:['Workfront ID','Description','Discipline','Status','Owner','Linked Activity'],
    rows:[['WF-'+h.int(100,999),'Main construction workfront',h.pick(['Civil','MEP','Architectural']),'Active','Construction','1000']]};
  if(kind==='interface')return {headers:['Interface ID','Description','Giving Party','Receiving Party','Required Deliverable','Status','Linked Activity'],
    rows:[['IF-'+h.int(100,999),'Design / construction interface','Designer','Contractor','Approved IFC information','Open','1000']]};
  if(kind==='quality')return {headers:['NCR ID','Description','Raised Date','Closed Date','Verification Date','Status','Linked Activity'],
    rows:[['NCR-'+h.int(100,999),'Blind quality issue',past(25),index%2?past(2):'',index%2?past():'',index%2?'Closed':'Open','1000']]};
  if(kind==='permit')return {headers:['Permit ID','Description','Issue Date','Valid From','Expiry Date','Required By','Status','Linked Activity'],
    rows:[['PER-'+h.int(100,999),'Authority work permit',past(10),past(10),future(60),past(2),'Issued','1000']]};
  if(kind==='hse')return {headers:['Incident ID','Description','Incident Date','Status','Man Hours','Lost Time Injuries','Medical Treatment Cases','First Aid Cases'],
    rows:[['HSE-'+h.int(100,999),'Site safety observation',past(3),'Closed','12000',String(index%2),String(index%3===0?1:0),'2']]};
  if(kind==='commissioning')return {headers:['Test ID','Description','Planned Date','Actual Date','Outcome Date','Status','Authority Witness','Linked Activity'],
    rows:[['T-'+h.int(100,999),'Functional performance test',past(5),index%2?past(2):'',index%2?past(1):'',index%2?'Passed':'Planned','Client','1000']]};
  if(kind==='asset')return {headers:['Asset ID','Description','System','Tag Installed','Commissioned','O&M Manual','Warranty','Status','Linked Activity'],
    rows:[['AST-'+h.int(100,999),'AHU asset','HVAC','Yes',index%2?'Yes':'No','Yes','Yes',index%2?'Ready':'In Progress','1000']]};
  if(kind==='snag')return {headers:['Snag ID','Description','Raised Date','Due Date','Rectified Date','Verification Date','Closed Date','Status','Linked Activity'],
    rows:[['SN-'+h.int(100,999),'Closeout snag',past(20),past(5),index%2?past(3):'',index%2?past(2):'',index%2?past(1):'',index%2?'Closed':'Open','1000']]};
  if(kind==='spare')return {headers:['Spare ID','Description','Unit','Required Quantity','Delivered Quantity','Accepted Quantity','Stored Quantity','Handed Over Quantity','Status As Of'],
    rows:[['SP-'+h.int(100,999),'Critical spare','No.',String(10+h.int(0,5)),String(8+h.int(0,3)),String(7+h.int(0,2)),String(7+h.int(0,2)),String(5+h.int(0,2)),dataDate]]};
  if(kind==='handover')return {headers:['Requirement ID','Description','Due Date','Acceptance Date','Verification Date','Status','Linked Activity'],
    rows:[['HO-'+h.int(100,999),'O&M dossier',future(20),index%2?past(2):'',index%2?past(1):'',index%2?'Accepted':'Open','1000']]};
  if(kind==='weather')return {headers:['Weather ID','Description','Event Start','Event End','Status','Linked Activity'],
    rows:[['W-'+h.int(100,999),'High wind disruption',past(4),past(3),'Recorded','1000']]};
  if(kind==='location')return {headers:['Location ID','Description','Parent Location ID','Status'],rows:[['LOC-'+h.int(100,999),'Zone '+h.int(1,9),'','Active']]};
  if(kind==='lifecycle')return {headers:['Lifecycle ID','Description','Stages','PO Duration','PO Day Basis','PO Duration Source','Delivery Duration','Delivery Day Basis','Delivery Duration Source','Installation Duration','Installation Day Basis','Installation Duration Source'],
    rows:[['LC-'+h.int(100,999),'Imported equipment lifecycle','po;delivery;installation','10','working days','Supplier programme','20','calendar days','Supplier programme','5','working days','Method statement']]};
  return {headers:['Gate ID','Requirement','Applicable','Outcome','Outcome Date','Satisfied Date','Owner'],
    rows:[
      ['G-PKG-'+h.int(10,99),'Approved material submittal','Yes',index%2?'Ready':'Blocked',dataDate,index%2?past():'','Design'],
      ['G-WF-'+h.int(10,99),'Released workfront','Yes','Ready',dataDate,past(),'Construction'],
      ['G-COM-'+h.int(10,99),'Commissioning prerequisite','Yes',index%3?'Ready':'At Risk',dataDate,index%3?past():'','Commissioning'],
      ['G-AST-'+h.int(10,99),'Asset handover prerequisite','Yes','Ready',dataDate,past(),'Handover'],
    ]};
}
async function deliveryFeatureWorkbookBytes(h:ReturnType<typeof helpers>,projectName:string,dataDate:string,currency:string,index:number){
  const workbook=new ExcelJS.Workbook();
  const cover=workbook.addWorksheet(h.pick(['Summary','Overview','ملخص','Control']));
  cover.addRow([projectName]);cover.addRow(['Delivery control evidence']);cover.addRow(['']);
  for(const kind of h.shuffle(deliveryFeatureKinds)){
    let {headers,rows}=deliveryFeatureTable(h,kind,dataDate,currency,index);
    ({headers,rows}=withJunk(h,headers,rows));
    const order=h.shuffle(headers.map((_,i)=>i));headers=order.map(i=>headers[i]!);rows=rows.map(row=>order.map(i=>row[i]??''));
    const sheet=workbook.addWorksheet((kind.replaceAll('_',' ')+' '+h.int(10,999)).slice(0,31));
    for(let n=0;n<h.int(0,2);n++)sheet.addRow([n===0?projectName:'',h.pick(['','Monthly','Source register'])]);
    sheet.addRow(headers);rows.forEach(row=>sheet.addRow(row));
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
export async function generateDeliveryFeatureBlindProject(seed:string,index=0):Promise<DeliveryFeatureBlindProject>{
  const h=helpers(seed+'::delivery-feature::'+index),language=languages[index%languages.length]!,currency=currencies[(index+1)%currencies.length]!;
  const projectId='BLIND-DEL-'+createHash('sha256').update(seed+'|delivery-feature|'+index).digest('hex').slice(0,10).toUpperCase();
  const projectName=(language==='ar'?h.pick(arabicNames):language==='mixed'?h.pick(englishNames)+' / '+h.pick(arabicNames):h.pick(englishNames))+' '+h.int(100,999);
  const dataDateIso='2041-'+String(h.int(2,10)).padStart(2,'0')+'-'+String(h.int(2,24)).padStart(2,'0'),activityCount=h.int(30,120);
  const featureItems=[
    {itemNumber:'B1',description:'Concrete',unit:'m3',quantity:100,installed:20+h.int(0,20),activityId:'1000'},
    {itemNumber:'B2',description:'Equipment',unit:'No.',quantity:10,installed:3+h.int(0,3),activityId:'1001'},
  ];
  const docs:BlindDocument[]=[
    {filename:h.pick(['programme.xer','Current_'+h.int(1,99)+'.xer','البرنامج.xer']),mediaType:'text/plain',
      bytes:makeXer(h,projectId,projectName,dataDateIso,activityCount,language),kind:'xer',domain:'schedule',truth:{rows:activityCount,scenario:'complete',facts:{activityCount}}},
    {filename:'boq_'+h.int(10,999)+'.csv',mediaType:'text/csv',
      bytes:csv([['Item No','Description','Unit','Quantity','Rate','Amount','Currency'],['B1','Concrete','m3','100','10','1000',currency],['B2','Equipment','No.','10','5000','50000',currency]],','),
      kind:'csv',domain:'boq',truth:{rows:2,scenario:'complete',facts:{}}},
    {filename:'installed_'+h.int(10,999)+'.csv',mediaType:'text/csv',
      bytes:csv([['Measurement Date','Item No','Cumulative Installed Qty','Unit'],
        [shiftDate(dataDateIso,-3),featureItems[0]!.itemNumber,String(featureItems[0]!.installed),featureItems[0]!.unit],
        [shiftDate(dataDateIso,-2),featureItems[1]!.itemNumber,String(featureItems[1]!.installed),featureItems[1]!.unit]],','),
      kind:'csv',domain:'measurements',truth:{rows:2,scenario:'complete',facts:{}}},
    {filename:h.pick(['delivery_controls','site_records','monthly_delivery','سجل_التسليم'])+'_'+h.int(100,999)+'.xlsx',
      mediaType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      bytes:await deliveryFeatureWorkbookBytes(h,projectName,dataDateIso,currency,index),kind:'xlsx',domain:'delivery_features',
      truth:{rows:deliveryFeatureKinds.length+3,scenario:'complete',facts:{kinds:deliveryFeatureKinds}}},
    shuffledCsvDocument(h,'Delivery_Risk_Register_'+h.int(10,999)+'.csv','risks',
      ['Risk ID','Description','Probability','Impact','Rating','Owner','Due Date','Status','Status As Of','Linked Activity'],
      [['R-DEL-'+h.int(10,999),'Delivery access and coordination risk','Medium','High','High','Project Manager',shiftDate(dataDateIso,20),'Open',dataDateIso,'1000']]),
  ];
  return {seed,projectId,projectName,dataDateIso,currency,language,documents:h.shuffle(docs),expectedKinds:[...deliveryFeatureKinds],featureTruth:{items:featureItems}};
}
export async function generateDeliveryFeatureBlindRound(seed:string,count:number){
  const projects:DeliveryFeatureBlindProject[]=[];
  for(let i=0;i<count;i++)projects.push(await generateDeliveryFeatureBlindProject(seed,i));
  return {seed,projects};
}


export interface CommercialFeatureBlindProject extends BlindProject {}
function shuffledCsvDocument(
  h:ReturnType<typeof helpers>,
  filename:string,
  domain:string,
  headers:string[],
  rows:string[][],
  scenario:BlindScenario='complete',
):BlindDocument{
  const order=h.shuffle(headers.map((_,i)=>i));
  const shuffledHeaders=order.map(i=>headers[i]!);
  const shuffledRows=rows.map(row=>order.map(i=>row[i]??''));
  const delimiter=h.pick([',',';','\t']);
  return {filename,mediaType:'text/csv',bytes:csv([shuffledHeaders,...shuffledRows],delimiter),kind:'csv',domain,
    truth:{rows:rows.length,scenario,facts:{headers:shuffledHeaders}}};
}
export async function generateCommercialFeatureBlindProject(seed:string,index=0):Promise<CommercialFeatureBlindProject>{
  const h=helpers(seed+'::commercial-feature::'+index),language=languages[index%languages.length]!,currency=currencies[(index+2)%currencies.length]!;
  const projectId='BLIND-COM-'+createHash('sha256').update(seed+'|commercial-feature|'+index).digest('hex').slice(0,10).toUpperCase();
  const projectName=(language==='ar'?h.pick(arabicNames):language==='mixed'?h.pick(englishNames)+' / '+h.pick(arabicNames):h.pick(englishNames))+' '+h.int(100,999);
  const dataDateIso='2042-'+String(h.int(4,9)).padStart(2,'0')+'-'+String(h.int(10,24)).padStart(2,'0');
  const activityCount=h.int(45,140),baseValue=h.int(8_000_000,30_000_000),approvedVariation=h.int(250_000,1_500_000),pendingVariation=h.int(100_000,600_000),currentValue=baseValue+approvedVariation;
  const prior2=shiftDate(dataDateIso,-60),prior1=shiftDate(dataDateIso,-30),prior0=shiftDate(dataDateIso,-5),future=shiftDate(dataDateIso,30);
  const contractualCompletion=shiftDate(dataDateIso,365),ldRate=h.int(10_000,50_000);
  const contractLines=[
    'CONSTRUCTION CONTRACT',
    '1 Contract Particulars',
    'Contract currency is '+currency+'.',
    'Accepted Contract Amount: '+currency+' '+baseValue+'.',
    'Original Contract Value: '+currency+' '+baseValue+'.',
    'Contractual completion date: '+contractualCompletion+'.',
    '2 Certification and Payment',
    'The Engineer shall certify within 7 calendar days.',
    'Payment shall be made within 28 calendar days after certification.',
    '3 Retention',
    'Retention rate: 10%.',
    'Retention cap: 5% of the Accepted Contract Amount.',
    '4 Securities',
    'Performance security: 10% of the Accepted Contract Amount.',
    'Advance-payment security: 100% of the outstanding advance.',
    '5 Delay Damages',
    'Delay damages rate: '+currency+' '+ldRate+' per calendar day.',
    'Delay damages cap: 10% of the Contract Amount.',
    'The delay damages shall not exceed 10% of the Contract Amount.',
    '6 Notices and Claims',
    'Initial claim notice: 14 calendar days after the event occurs.'
  ];
  const contractPdf=await PDFDocument.create(),font=await contractPdf.embedFont(StandardFonts.Helvetica);
  const page=contractPdf.addPage([595,842]);
  page.drawText(contractLines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
  const contract=new Uint8Array(await contractPdf.save());
  const docs:BlindDocument[]=[
    {filename:'Main_Works_Contract_'+h.int(100,999)+'.pdf',mediaType:'application/pdf',bytes:contract,kind:'pdf',domain:'contract',
      truth:{rows:1,scenario:'complete',facts:{currency,baseValue,currentValue,contractualCompletion,ldRate}}},
    {filename:h.pick(['programme.xer','Current_Programme.xer','البرنامج.xer']),mediaType:'text/plain',
      bytes:makeXer(h,projectId,projectName,dataDateIso,activityCount,language),kind:'xer',domain:'schedule',
      truth:{rows:activityCount,scenario:'complete',facts:{activityCount}}},
  ];
  const costHeaders=['Metric','Value','Currency','Status','As Of','Amount Basis','VAT Basis','CBS ID','CBS Description','WBS ID'];
  const costRows=[
    ['EVM','1',currency,'Approved',dataDateIso,'snapshot','Exclusive','CBS-ROOT','Project Controls','ROOT'],
    ['Original Contract Value',String(baseValue),currency,'Approved',dataDateIso,'snapshot','Exclusive'],
    ['Approved Variations',String(approvedVariation),currency,'Approved',dataDateIso,'snapshot','Exclusive'],
    ['Current Contract Value',String(currentValue),currency,'Approved',dataDateIso,'snapshot','Exclusive'],
    ['Actual Expenditure',String(Math.round(currentValue*.09)),currency,'Actual',prior2,'incremental','Exclusive'],
    ['Actual Expenditure',String(Math.round(currentValue*.17)),currency,'Actual',prior1,'incremental','Exclusive'],
    ['Actual Expenditure',String(Math.round(currentValue*.21)),currency,'Actual',prior0,'incremental','Exclusive'],
    ['Expenditure Budget',String(Math.round(currentValue*.24)),currency,'Approved',dataDateIso,'incremental','Exclusive'],
    ['Expenditure Forecast',String(Math.round(currentValue*.26)),currency,'Forecast',dataDateIso,'incremental','Exclusive'],
  ];
  // Complete dated submissions exercise EVM and forecasts on the same basis.
  // BAC at the Data Date cannot supply missing PV/EV/AC for that date, and a
  // forecast from an earlier period must not silently become the current one.
  const costSnapshots=[
    {asOf:prior2,bac:baseValue,pvFraction:.35,evFraction:.31,acFraction:.33,eacFraction:1.05},
    {asOf:prior1,bac:currentValue,pvFraction:.55,evFraction:.50,acFraction:.53,eacFraction:1.06},
    {asOf:prior0,bac:currentValue,pvFraction:.72,evFraction:.66,acFraction:.70,eacFraction:1.06},
    {asOf:dataDateIso,bac:currentValue,pvFraction:.74,evFraction:.69,acFraction:.73,eacFraction:1.08},
  ].map(period=>{
    const {asOf,bac}=period,pv=Math.round(bac*period.pvFraction),ev=Math.round(bac*period.evFraction),
      ac=Math.round(bac*period.acFraction),eac=Math.round(bac*period.eacFraction),cv=ev-ac,
      priceVariance=Math.round(cv*.4),quantityVariance=Math.round(cv*.35),productivityVariance=cv-priceVariance-quantityVariance;
    const values={BAC:bac,PV:pv,EV:ev,AC:ac,EAC:eac,ETC:eac-ac,VAC:bac-eac,
      'Price Variance':priceVariance,'Quantity Variance':quantityVariance,'Productivity Variance':productivityVariance};
    for(const [metric,value] of Object.entries(values))costRows.push([
      metric,String(value),currency,metric==='AC'?'Actual':['EAC','ETC','VAC'].includes(metric)?'Forecast':'Approved',asOf,'snapshot','Exclusive',
    ]);
    return {asOf,bac,pv,ev,ac,eac,etc:eac-ac,vac:bac-eac,priceVariance,quantityVariance,productivityVariance};
  });
  for(const row of costRows){
    const metric=String(row[0]??'Cost');
    while(row.length<costHeaders.length)row.push(metric==='EVM'?'CBS-ROOT':metric.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').toUpperCase()||'CBS-COST',metric+' control','ROOT');
  }
  const costDocument=shuffledCsvDocument(h,'EVM_Cost_Report_'+h.int(10,999)+'.csv','evm',costHeaders,costRows);
  Object.assign(costDocument.truth.facts,{costSnapshots});
  docs.push(costDocument);
  const paymentHeaders=['Certificate No','Payment Type','Period End','Application Date','Assessment Date','Certificate Date','Payment Due Date','Payment Date','Payment Reference','Payment Source Status','Gross Work','Variations','Gross Certified Amount','Employer Certified Amount','Net Certified','Paid Amount','Retention','Advance Recovery','Other Deductions','Tax Amount','Outstanding Amount','Currency','Status','Certified Amount Basis','Paid Amount Basis','VAT Basis','Application Amount','Engineer Assessed Amount','Variation Certified Amount','Paid Allocation Basis','Retention Release Due Date'];
  const paymentRows=[prior2,prior1,prior0].map((period,i)=>{
    const net=Math.round(currentValue*(.10+i*.08)),retention=Math.round(net*.05),advance=Math.round(net*.02),other=Math.round(net*.01),variationCertified=Math.round(net*.03);
    const grossWork=net+retention+advance+other-variationCertified,grossCertified=grossWork+variationCertified,employerCertified=grossCertified;
    const paid=Math.round(net*.92);
    return ['IPC-'+(i+1),'Interim',period,shiftDate(period,-10),shiftDate(period,-5),shiftDate(period,-3),shiftDate(period,25),period,'PAY-'+(i+1),'Posted',
      String(grossWork),String(variationCertified),String(grossCertified),String(employerCertified),String(net),String(paid),String(retention),String(advance),String(other),'0',String(net-paid),currency,'Paid','incremental','incremental','Exclusive',
      String(Math.round(grossCertified*1.02)),String(grossCertified),String(variationCertified),'certificate cumulative',shiftDate(contractualCompletion,30)];
  });
  docs.push(shuffledCsvDocument(h,'Payment_Certificates_'+h.int(10,999)+'.csv','payments',paymentHeaders,paymentRows));
  const variationHeaders=['Variation ID','Description','Status','Submitted Date','Assessment Date','Agreed Date','Approval Date','Claimed Amount','Assessed Amount','Agreed Amount','Approved Amount','Schedule Impact Days','Claim ID','Payment ID','Activity ID','Clause','Currency','VAT Basis','Instruction ID','Instruction Date','Quotation Date'];
  const variationRows=[
    ['VO-1','Scope change A','Approved',prior2,shiftDate(prior2,7),shiftDate(prior2,14),shiftDate(prior2,21),String(Math.round(approvedVariation*1.08)),String(Math.round(approvedVariation*.96)),String(approvedVariation),String(approvedVariation),'5','CLM-1','IPC-2','','13.3',currency,'Exclusive','SI-1',shiftDate(prior2,-2),shiftDate(prior2,3)],
    ['VO-2','Scope change B','Pending',prior1,shiftDate(prior1,8),'','',String(pendingVariation),String(Math.round(pendingVariation*.8)),'','','3','','','','13.3',currency,'Exclusive','SI-2',shiftDate(prior1,-2),shiftDate(prior1,3)],
  ];
  docs.push(shuffledCsvDocument(h,'Variation_Register_'+h.int(10,999)+'.csv','variations',variationHeaders,variationRows));
  docs.push(shuffledCsvDocument(h,'Site_Instructions_'+h.int(10,999)+'.csv','variations',
    ['Instruction ID','Description','Issue Date','Status','Variation ID','Quotation Due Date','Quotation Date','Schedule Impact Days','Estimated Amount','Currency','VAT Basis'],
    [
      ['SI-1','Scope change A instruction',shiftDate(prior2,-2),'Issued','VO-1',shiftDate(prior2,5),shiftDate(prior2,3),'5',String(approvedVariation),currency,'Exclusive'],
      ['SI-2','Scope change B instruction',shiftDate(prior1,-2),'Issued','VO-2',shiftDate(prior1,5),shiftDate(prior1,3),'3',String(pendingVariation),currency,'Exclusive'],
    ]));
  docs.push(shuffledCsvDocument(h,'Contract_Obligations_'+h.int(10,999)+'.csv','contract',
    ['Obligation ID','Clause','Description','Responsible Party','Due Date','Completed Date','Status','Evidence Reference'],
    [['OBL-2','2','Current certification and payment control','Engineer',shiftDate(dataDateIso,7),'','Open','Payment_Certificates']]));
  docs.push(shuffledCsvDocument(h,'Retention_Balance_'+h.int(10,999)+'.csv','payments',
    ['Retention ID','Status','Retention Amount','Currency','VAT Basis','As Of','Due Date','Trigger'],
    [['RET-CURRENT','Held',String(Math.round(baseValue*.04)),currency,'Exclusive',dataDateIso,shiftDate(contractualCompletion,30),'Taking Over Certificate']]));
  const claimHeaders=['Claim ID','Event ID','Event','Event Start','Event End','Responsibility','Category','Impact Days','Activity ID','Notice Date','Days Claimed','Days Granted','Claimed Amount','Assessed Amount','Status','Clause','Determination ID','Day Basis','Currency','Submitted Date','Assessment Date'];
  const claim1Claimed=h.int(200_000,800_000),claim1Assessed=h.int(150_000,Math.max(150_001,claim1Claimed));
  const claim2Claimed=h.int(150_000,500_000),claim2Assessed=h.int(100_000,Math.max(100_001,claim2Claimed));
  const claimRows=[
    ['CLM-1','EV-1','Late access',shiftDate(prior2,-10),shiftDate(prior2,-2),'Employer','late access','8','',shiftDate(prior2,-8),'8','5',String(claim1Claimed),String(claim1Assessed),'Engineer Determined','20.1','DET-1','calendar days',currency,prior2,shiftDate(prior2,7)],
    ['CLM-2','EV-2','Late design information',shiftDate(prior1,-14),shiftDate(prior1,-4),'Employer','design','10','',shiftDate(prior1,-11),'10','6',String(claim2Claimed),String(claim2Assessed),'Engineer Determined','20.1','DET-2','calendar days',currency,prior1,shiftDate(prior1,7)],
  ];
  docs.push(shuffledCsvDocument(h,'Claims_Register_'+h.int(10,999)+'.csv','claims',claimHeaders,claimRows));
  const bondHeaders=['Bond ID','Bond Type','Bond Amount','Status','Expiry Date','Currency'];
  const bondRows=[
    ['BG-PERF','Performance',String(Math.round(baseValue*.10)),'Active',shiftDate(dataDateIso,300),currency],
    ['BG-ADV','Advance Payment',String(Math.round(baseValue*.08)),'Active',shiftDate(dataDateIso,180),currency],
  ];
  docs.push(shuffledCsvDocument(h,'Bond_Register_'+h.int(10,999)+'.csv','bonds',bondHeaders,bondRows));
  const grossCertifiedAmount=paymentRows
    .filter(row=>String(row[5]??'')<=dataDateIso)
    .reduce((sum,row)=>sum+Number(row[12]??0),0);
  const paidAmount=paymentRows
    .filter(row=>String(row[7]??'')&&String(row[7])<=dataDateIso)
    .reduce((sum,row)=>sum+Number(row[15]??0),0);
  const contractTruth=docs.find(document=>document.domain==='contract');
  if(contractTruth)Object.assign(contractTruth.truth.facts,{
    approvedVariation,
    pendingVariation,
    grossCertifiedAmount,
    paidAmount,
    claimedAmount:claim1Claimed+claim2Claimed,
    assessedClaimAmount:claim1Assessed+claim2Assessed,
    claimCommercials:[
      {claimId:'CLM-1',eventId:'EV-1',title:'Late access',eventStart:shiftDate(prior2,-10),noticeDate:shiftDate(prior2,-8),submittedAt:prior2,assessedAt:shiftDate(prior2,7),claimedDays:8,claimedAmount:claim1Claimed,assessedAmount:claim1Assessed},
      {claimId:'CLM-2',eventId:'EV-2',title:'Late design information',eventStart:shiftDate(prior1,-14),noticeDate:shiftDate(prior1,-11),submittedAt:prior1,assessedAt:shiftDate(prior1,7),claimedDays:10,claimedAmount:claim2Claimed,assessedAmount:claim2Assessed},
    ],
    ldCapPercent:10,
  });
  return {seed,projectId,projectName,language,currency,dataDateIso,scenario:'complete',documents:h.shuffle(docs),
    truth:{scheduleActivities:activityCount,payments:paymentRows.length,variations:variationRows.length,risks:null,claims:claimRows.length,procurement:null,quality:null,
      expectedDomains:['schedule','contract','evm','payments','variations','claims','bonds']}};
}
export async function generateCommercialFeatureBlindRound(seed:string,count:number){
  const projects:CommercialFeatureBlindProject[]=[];for(let i=0;i<count;i++)projects.push(await generateCommercialFeatureBlindProject(seed,i));return {seed,projects};
}

export interface DelayFeatureBlindProject extends BlindProject {}
export async function generateDelayFeatureBlindProject(seed:string,index=0):Promise<DelayFeatureBlindProject>{
  const lifecycle=await generateScheduleLifecycleBlindProject(seed+'::delay-schedule',index);
  const h=helpers(seed+'::delay-feature::'+index),currency=currencies[(index+3)%currencies.length]!,dataDateIso=lifecycle.laterDataDateIso;
  const projectId=lifecycle.projectId.replace('BLIND-SCH-','BLIND-DLY-'),projectName=lifecycle.projectName,language=lifecycle.language;
  // Rebuild schedule files under one project identity so every retained programme and claim belongs to the same blind project.
  const activityCount=lifecycle.stages.current.truth.rows;
  const scheduleDates=[lifecycle.baseDataDateIso,shiftDate(lifecycle.baseDataDateIso,-28),dataDateIso];
  const schedules=scheduleDates.map((dateIso,i):BlindDocument=>({
    filename:(['Current_Programme_','Previous_Update_','Latest_Update_'][i]??'Programme_Update_')+h.int(10,999)+'.xer',mediaType:'text/plain',
    bytes:makeXer(h,projectId,projectName,dateIso,activityCount,language),kind:'xer',domain:'schedule',
    truth:{rows:activityCount,scenario:'complete',facts:{dataDateIso}},
  }));
  const contract=Buffer.from([
    'MAIN WORKS CONTRACT AGREEMENT','Conditions of Contract and Contract Data.','Contract currency is '+currency+'.',
    'Accepted Contract Amount is '+currency+' '+h.int(8_000_000,25_000_000)+'.','Contractual completion date: '+shiftDate(dataDateIso,280)+'.',
    'The Contractor shall give notice within 14 calendar days as a condition precedent to an extension of time.',
    'The Engineer shall determine extensions of time in calendar days.','Delay damages apply per calendar day subject to the stated cap.'
  ].join('\n'),'utf8');
  const claimHeaders=['Claim ID','Event ID','Event','Event Start','Event End','Responsibility','Category','Impact Days','Activity ID','Notice Date','Days Claimed','Days Granted','Status','Clause','Determination ID','Day Basis','Currency'];
  const claimRows=[
    ['CLM-'+index+'A','EV-'+index+'A','Late access',shiftDate(dataDateIso,-45),shiftDate(dataDateIso,-30),'Employer','late access','12','1000',shiftDate(dataDateIso,-42),'12','7','Engineer Determined','20.1','DET-'+index+'A','calendar days',currency],
    ['CLM-'+index+'B','EV-'+index+'B','Late design information',shiftDate(dataDateIso,-30),shiftDate(dataDateIso,-18),'Employer','design','9','1001',shiftDate(dataDateIso,-26),'9','','Under Review','20.1','','calendar days',currency],
    ['CLM-'+index+'C','EV-'+index+'C','Contractor productivity',shiftDate(dataDateIso,-20),shiftDate(dataDateIso,-8),'Contractor','performance','6','1002',shiftDate(dataDateIso,-15),'6','','Submitted','20.1','','calendar days',currency],
  ];
  const docs:BlindDocument[]=[
    ...schedules,
    {filename:'Main_Contract_'+h.int(100,999)+'.txt',mediaType:'text/plain',bytes:contract,kind:'text',domain:'contract',truth:{rows:1,scenario:'complete',facts:{}}},
    shuffledCsvDocument(h,'Delay_Claims_Register_'+h.int(10,999)+'.csv','claims',claimHeaders,claimRows),
  ];
  return {seed,projectId,projectName,language,currency,dataDateIso,scenario:'complete',documents:h.shuffle(docs),
    truth:{scheduleActivities:activityCount,payments:null,variations:null,risks:null,claims:claimRows.length,procurement:null,quality:null,expectedDomains:['schedule','contract','claims']}};
}
export async function generateDelayFeatureBlindRound(seed:string,count:number){
  const projects:DelayFeatureBlindProject[]=[];for(let i=0;i<count;i++)projects.push(await generateDelayFeatureBlindProject(seed,i));return {seed,projects};
}


export interface ProgressFeatureBlindProject extends BlindProject {}
export async function generateProgressFeatureBlindProject(seed:string,index=0):Promise<ProgressFeatureBlindProject>{
  const h=helpers(seed+'::progress-feature::'+index),language=languages[index%languages.length]!,currency=currencies[(index+4)%currencies.length]!;
  const projectId='BLIND-PRG-'+createHash('sha256').update(seed+'|progress-feature|'+index).digest('hex').slice(0,10).toUpperCase();
  const projectName=(language==='ar'?h.pick(arabicNames):language==='mixed'?h.pick(englishNames)+' / '+h.pick(arabicNames):h.pick(englishNames))+' '+h.int(100,999);
  const dataDateIso='2043-'+String(h.int(3,8)).padStart(2,'0')+'-'+String(h.int(10,22)).padStart(2,'0'),activityCount=h.int(60,180);
  const previous=shiftDate(dataDateIso,-28),earlier=shiftDate(dataDateIso,-56);
  const docs:BlindDocument[]=[
    {filename:'Programme_Earlier_'+h.int(10,999)+'.xer',mediaType:'text/plain',bytes:makeXer(h,projectId,projectName,earlier,activityCount,language),kind:'xer',domain:'schedule',truth:{rows:activityCount,scenario:'complete',facts:{dataDateIso:earlier}}},
    {filename:'Programme_Previous_'+h.int(10,999)+'.xer',mediaType:'text/plain',bytes:makeXer(h,projectId,projectName,previous,activityCount,language),kind:'xer',domain:'schedule',truth:{rows:activityCount,scenario:'complete',facts:{dataDateIso:previous}}},
    {filename:'Programme_Current_'+h.int(10,999)+'.xer',mediaType:'text/plain',bytes:makeXer(h,projectId,projectName,dataDateIso,activityCount,language),kind:'xer',domain:'schedule',truth:{rows:activityCount,scenario:'complete',facts:{dataDateIso}}},
  ];
  const boqRows=[
    ['B1','Concrete foundations','m3','1000','120','120000',currency],
    ['B2','Cable installation','m','5000','25','125000',currency],
    ['B3','Mechanical equipment','No.','20','15000','300000',currency],
  ];
  docs.push(shuffledCsvDocument(h,'BOQ_'+h.int(10,999)+'.csv','boq',['Item No','Description','Unit','Quantity','Rate','Amount','Currency'],boqRows));
  const measuredRows=[
    [dataDateIso,'B1',String(h.int(250,650)),'m3'],
    [dataDateIso,'B2',String(h.int(1200,3600)),'m'],
    [dataDateIso,'B3',String(h.int(4,14)),'No.'],
    [previous,'B1',String(h.int(100,240)),'m3'],
    [previous,'B2',String(h.int(500,1100)),'m'],
  ];
  docs.push(shuffledCsvDocument(h,'Installed_Quantities_'+h.int(10,999)+'.csv','measurements',['Measurement Date','Item No','Cumulative Installed Qty','Unit'],measuredRows));
  const resources=[
    ['R-LAB-1','U-LAB-1','Civil Labour','Yes','Labor','labor_hour'],
    ['R-LAB-2','U-LAB-2','MEP Labour','Yes','Labor','labor_hour'],
  ];
  docs.push(shuffledCsvDocument(h,'Resource_Master_'+h.int(10,999)+'.csv','resources',['Resource ID','Resource UID','Resource Name','Utilization Applicable','Class','Unit'],resources));
  const weekly:string[][]=[],actual:string[][]=[];
  for(let w=-6;w<=3;w++){
    const week=shiftDate(dataDateIso,w*7);
    for(const [ri,id] of ['R-LAB-1','R-LAB-2'].entries()){
      const capacity=160+h.int(0,40),planned=120+h.int(0,80),forecast=Math.max(planned,h.int(130,220));
      weekly.push([id,week,String(capacity),String(planned),String(forecast),'labor_hour','Labor']);
      if(w<=0)actual.push([id,week,String(Math.max(0,planned+h.int(-25,30))),'Approved','labor_hour']);
    }
  }
  docs.push(shuffledCsvDocument(h,'Weekly_Resource_Capacity_'+h.int(10,999)+'.csv','resources',['Resource ID','Week Start','Available Capacity','Planned Demand','Forecast Demand','Unit','Class'],weekly));
  docs.push(shuffledCsvDocument(h,'Approved_Resource_Usage_'+h.int(10,999)+'.csv','resources',['Resource ID','Week Start','Actual Approved Usage','Source Status','Unit'],actual));
  return {seed,projectId,projectName,language,currency,dataDateIso,scenario:'complete',documents:h.shuffle(docs),
    truth:{scheduleActivities:activityCount,payments:null,variations:null,risks:null,claims:null,procurement:null,quality:null,
      expectedDomains:['schedule','boq','measurements','resources']}};
}
export async function generateProgressFeatureBlindRound(seed:string,count:number){
  const projects:ProgressFeatureBlindProject[]=[];for(let i=0;i<count;i++)projects.push(await generateProgressFeatureBlindProject(seed,i));return {seed,projects};
}


export interface ForecastFeatureTruthItem {
  itemNumber:string;description:string;unit:string;quantity:number;installed:number;activityId:string;laborHoursPerUnit:number;
}
export interface ForecastFeatureBlindProject extends BlindProject {
  featureTruth:{items:ForecastFeatureTruthItem[]};
}
function p6FiveDayCalendarData(){
  const shifts=[['08:00','12:00'],['13:00','17:00']] as const;
  const intervals=shifts.map(([s,e],i)=>'(0||'+i+'(s|'+s+'|f|'+e+')())').join('');
  const days=[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()('+(d>=2&&d<=6?intervals:'')+'))').join('');
  return '(0||CalendarData()((0||DaysOfWeek()('+days+'))(0||Exceptions()())))'.replaceAll('(0||','\x7f\x7f  (0||');
}
function makeForecastResourceXer(h:ReturnType<typeof helpers>,projectId:string,projectName:string,dataDate:string,revision:number,language:BlindLanguage){
  const calendar=p6FiveDayCalendarData(),wbsName=language==='ar'?'الأعمال الرئيسية':'Main Works';
  const lines=[
    'ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectId+'\t'+dataDate+' 08:00',
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t10\t1\t\tROOT\t'+wbsName,
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\tC1\tFive Day 8h\t8\t40\t'+calendar,
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'
  ];
  for(let i=0;i<6;i++){
    const id=String(1000+i),start=shiftDate(dataDate,-10+i*4),finish=shiftDate(dataDate,25+i*12+revision*2),pct=i===0?40:i===1?20:0;
    lines.push('%R\t'+id+'\t1\t10\tC1\tWP-'+(i+1)+'\t'+(language==='ar'?'حزمة عمل ':'Work Package ')+(i+1)+'\tTT_Task\t'+(pct?'TK_Active':'TK_NotStart')+'\t'+start+' 08:00\t'+finish+' 17:00\t'+start+' 08:00\t'+finish+' 17:00\t320\t'+(320-Math.round(320*pct/100))+'\t'+(i===0?-16:8+i*8)+'\t'+pct);
  }
  lines.push('%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tpred_type\tlag_hr_cnt');
  for(let i=1;i<6;i++)lines.push('%R\t'+(5000+i)+'\t'+(1000+i)+'\t'+(999+i)+'\tPR_FS\t0');
  lines.push(
    '%T\tUMEASURE','%F\tunit_id\tunit_name\tunit_abbrev\tseq_num','%R\t500\tHour\thr\t1',
    '%T\tRSRC','%F\trsrc_id\tparent_rsrc_id\tclndr_id\trsrc_short_name\trsrc_name\trsrc_type\tunit_id\tcost_qty_type',
    '%R\tR1\t\tC1\tLAB\tGeneral Labour\tRT_Labor\t500\tQT_Hour',
    '%T\tRSRCRATE','%F\trsrc_rate_id\trsrc_id\tstart_date\tmax_qty_per_hr','%R\t1\tR1\t'+shiftDate(dataDate,-365)+'\t6',
    '%T\tTASKRSRC','%F\ttaskrsrc_id\tproj_id\ttask_id\trsrc_id\trsrc_type\ttarget_qty\tact_reg_qty\tact_ot_qty\tremain_qty\ttotal_qty\ttarget_qty_per_hr\tremain_qty_per_hr\ttarget_start_date\ttarget_end_date\tact_start_date\tact_end_date\trestart_date\treend_date\ttarget_cost\tact_reg_cost\tact_ot_cost\tremain_cost'
  );
  for(let i=0;i<6;i++){
    const people=2+(i%2),remain=people*240,cost=remain*(45+h.int(0,15)),start=shiftDate(dataDate,-10+i*4),finish=shiftDate(dataDate,25+i*12+revision*2);
    lines.push('%R\tAR'+i+'\t1\t'+(1000+i)+'\tR1\tRT_Labor\t960\t'+(120+i*20)+'\t0\t'+remain+'\t1080\t3\t'+people+'\t'+start+'\t'+finish+'\t'+start+'\t\t'+dataDate+'\t'+finish+'\t48000\t6000\t0\t'+cost);
  }
  lines.push('%E');return Buffer.from(lines.join('\n'));
}
export async function generateForecastFeatureBlindProject(seed:string,index=0):Promise<ForecastFeatureBlindProject>{
  const h=helpers(seed+'::forecast-feature::'+index),language=languages[index%languages.length]!,currency=currencies[(index+5)%currencies.length]!;
  const projectId='BLIND-FRC-'+createHash('sha256').update(seed+'|forecast-feature|'+index).digest('hex').slice(0,10).toUpperCase();
  const projectName=(language==='ar'?h.pick(arabicNames):language==='mixed'?h.pick(englishNames)+' / '+h.pick(arabicNames):h.pick(englishNames))+' '+h.int(100,999);
  const dataDateIso='2044-'+String(h.int(4,8)).padStart(2,'0')+'-'+String(h.int(10,20)).padStart(2,'0');
  const dates=[shiftDate(dataDateIso,-56),shiftDate(dataDateIso,-28),dataDateIso];
  const items:ForecastFeatureTruthItem[]=[
    {itemNumber:'B1',description:'Concrete works',unit:'m3',quantity:1000,installed:220+h.int(0,80),activityId:'WP-1',laborHoursPerUnit:4},
    {itemNumber:'B2',description:'Cable installation',unit:'m',quantity:5000,installed:1000+h.int(0,600),activityId:'WP-2',laborHoursPerUnit:1.5},
    {itemNumber:'B3',description:'Mechanical equipment',unit:'No.',quantity:20,installed:3+h.int(0,4),activityId:'WP-3',laborHoursPerUnit:40},
  ];
  const docs:BlindDocument[]=dates.map((date,i)=>({filename:'Programme_Update_'+(i+1)+'_'+h.int(10,999)+'.xer',mediaType:'text/plain',
    bytes:makeForecastResourceXer(h,projectId,projectName,date,i,language),kind:'xer',domain:'schedule',
    truth:{rows:6,scenario:'complete',facts:{dataDateIso:date,calendar:'C1',resource:'R1'}}}));
  docs.push(shuffledCsvDocument(h,'BOQ_'+h.int(10,999)+'.csv','boq',['Item No','Description','Unit','Quantity','Rate','Amount','Currency'],
    items.map(row=>[row.itemNumber,row.description,row.unit,String(row.quantity),'100',String(row.quantity*100),currency])));
  docs.push(shuffledCsvDocument(h,'Installed_Quantities_'+h.int(10,999)+'.csv','measurements',['Measurement Date','Item No','Cumulative Installed Qty','Unit'],
    items.map(row=>[dataDateIso,row.itemNumber,String(row.installed),row.unit])));
  docs.push(shuffledCsvDocument(h,'IF01_Productivity_Work_Package_Register_'+h.int(10,999)+'.csv','productivity',
    ['Work Package ID','Quantity Item ID','Description','Unit','Activity ID','As Of','Total Quantity','Installed Quantity','Remaining Quantity','Labor Hours Per Unit','Productivity Rate Per Hour','Calendar ID','Interface Allowance Days'],
    items.map((row,i)=>['WP-'+(i+1),row.itemNumber,row.description,row.unit,row.activityId,dataDateIso,String(row.quantity),String(row.installed),String(row.quantity-row.installed),String(row.laborHoursPerUnit),String(1/row.laborHoursPerUnit),'C1','1'])));
  const contract=Buffer.from([
    'MAIN WORKS CONTRACT AGREEMENT','Conditions of Contract.','Contract currency is '+currency+'.',
    'Accepted Contract Amount is '+currency+' '+h.int(10_000_000,30_000_000)+'.','Contractual completion date: '+shiftDate(dataDateIso,300)+'.',
    'The Contractor shall give notice within 14 calendar days. Extension of time shall be determined against the accepted programme.',
    'Variations and change orders require written instruction. Interim payment certificates are issued monthly.',
    'Delay damages apply per calendar day. Contemporary records shall be maintained for all claims.'
  ].join('\n'),'utf8');
  docs.push({filename:'Main_Contract_'+h.int(10,999)+'.txt',mediaType:'text/plain',bytes:contract,kind:'text',domain:'contract',truth:{rows:1,scenario:'complete',facts:{}}});
  return {seed,projectId,projectName,language,currency,dataDateIso,scenario:'complete',documents:h.shuffle(docs),featureTruth:{items},
    truth:{scheduleActivities:6,payments:null,variations:null,risks:null,claims:null,procurement:null,quality:null,expectedDomains:['schedule','boq','measurements','productivity','contract']}};
}
export async function generateForecastFeatureBlindRound(seed:string,count:number){
  const projects:ForecastFeatureBlindProject[]=[];for(let i=0;i<count;i++)projects.push(await generateForecastFeatureBlindProject(seed,i));return {seed,projects};
}

export function defaultBlindSeed(){
  // Acceptance cohorts are generated only after the code under test has been fixed.
  // The seed is intentionally unknowable before execution; it is printed by each blind test
  // so a failure can be reproduced later as a regression case without reusing it for acceptance.
  return process.env.CMENG_GENERATOR_SEED?.trim()
    ||'fresh:'+randomBytes(18).toString('hex');
}
