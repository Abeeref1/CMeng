import ExcelJS from 'exceljs';
import {createHash} from 'node:crypto';

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
  kind:'xer'|'csv'|'xlsx'|'text';
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
  const lines=[
    'ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date',
    '%R\t1\t'+projectId+'\t'+dataDate,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name',
    '%R\t10\t1\t\tROOT\t'+wbsName,
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\tstatus_code\ttarget_start_date\ttarget_end_date\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tphys_complete_pct'
  ];
  const ids:string[]=[];
  for(let i=0;i<count;i++){
    const id='A'+(1000+i),code=h.pick(['CIV','MEP','PRC','TST','ARC'])+'-'+h.int(10,999),name=language==='ar'?'نشاط '+(i+1):language==='mixed'&&i%3===0?'Activity '+(i+1)+' / نشاط':'Activity '+(i+1);
    const start=shiftDate(dataDate,-h.int(1,120)),finish=shiftDate(dataDate,h.int(1,240)),pct=h.int(0,100),tf=h.pick([-80,-24,0,8,24,80]);
    lines.push('%R\t'+id.slice(1)+'\t1\t10\t'+code+'\t'+name+'\t'+(pct===100?'TK_Complete':pct>0?'TK_Active':'TK_NotStart')+'\t'+start+'\t'+finish+'\t'+start+'\t'+finish+'\t80\t'+Math.max(0,80*(100-pct)/100)+'\t'+tf+'\t'+pct);
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
  const baselineDataDateIso=shiftDate(baseDataDateIso,-84),earlier=shiftDate(baseDataDateIso,-28),laterDataDateIso=shiftDate(baseDataDateIso,28);
  const recovery=shiftDate(baseDataDateIso,42),draft=shiftDate(baseDataDateIso,56),revised=shiftDate(baseDataDateIso,70),count=h.int(8,24);
  const stages:Record<ScheduleLifecycleBlindStage,BlindDocument>={
    baseline:scheduleLifecycleDocument('Baseline_Rev0_'+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,baselineDataDateIso,count,language),'baseline',count),
    current:scheduleLifecycleDocument(index%2===0?'Current_Programme_'+h.int(10,999)+'.xer':'Weekly_Update_001_'+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,baseDataDateIso,count,language),'current',count),
    same:scheduleLifecycleDocument('Weekly_Update_Same_'+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,baseDataDateIso,count,language),'same',count),
    earlier:scheduleLifecycleDocument('Weekly_Update_Old_'+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,earlier,count,language),'earlier',count),
    later:scheduleLifecycleDocument('Weekly_Update_002_'+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,laterDataDateIso,count,language),'later',count),
    undated:scheduleLifecycleDocument('Weekly_Update_Undated_'+h.int(10,999)+'.xer',undatedScheduleBytes(h,projectId,projectName,baseDataDateIso,count,language),'undated',count),
    recovery:scheduleLifecycleDocument('Recovery_Plan_'+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,recovery,count,language),'recovery',count),
    draft:scheduleLifecycleDocument('DRAFT_Future_'+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,draft,count,language),'draft',count),
    revised_baseline:scheduleLifecycleDocument('Revised_Baseline_'+h.int(10,999)+'.xer',makeXer(h,projectId,projectName,revised,count,language),'revised_baseline',count),
  };
  return {seed,projectId,projectName,language,baseDataDateIso,laterDataDateIso,baselineDataDateIso,stages};
}
export async function generateScheduleLifecycleBlindRound(seed:string,count:number){
  const projects:ScheduleLifecycleBlindProject[]=[];
  for(let i=0;i<count;i++)projects.push(await generateScheduleLifecycleBlindProject(seed,i));
  return {seed,projects};
}

export function defaultBlindSeed(){
  return process.env.CMENG_GENERATOR_SEED?.trim()
    ||[process.env.GITHUB_RUN_ID,process.env.GITHUB_RUN_ATTEMPT,process.env.GITHUB_SHA].filter(Boolean).join(':')
    ||'local:'+new Date().toISOString().slice(0,13);
}
