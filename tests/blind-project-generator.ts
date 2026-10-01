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
  return language==='ar'?s.replace(/,/g,'٬').replace(/./g,'٫').replace(/[0-9]/g,x=>'٠١٢٣٤٥٦٧٨٩'[Number(x)]!):s;
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

export function defaultBlindSeed(){
  return process.env.CMENG_GENERATOR_SEED?.trim()
    ||[process.env.GITHUB_RUN_ID,process.env.GITHUB_RUN_ATTEMPT,process.env.GITHUB_SHA].filter(Boolean).join(':')
    ||'local:'+new Date().toISOString().slice(0,13);
}
