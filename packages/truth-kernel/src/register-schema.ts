/** Shared semantic headers for register ingestion. Unknown columns are retained. */
export const normalizeHeader=(v:string)=>v.normalize('NFKC').replace(/^\uFEFF/,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const groups:Record<string,string[]>={
  'claim id':['claim ref','claim reference','claim no','claim number','رقم المطالبة','مرجع المطالبة'],
  'notice date':['date of notice','notice issued date','تاريخ الإشعار','تاريخ الاشعار'],
  'event start':['event date','event start date','date of event','تاريخ الحدث'],
  'variation id':['variation no','variation number','variation ref','vo no','vo id','change order no','رقم التغيير'],
  'certificate no':['certificate number','certificate id','ipc no','ipc number','payment certificate no','رقم المستخلص'],
  'rfi id':['rfi no','rfi number','rfi ref','رقم الاستفسار'],
  'ncr id':['ncr no','ncr number','ncr ref','رقم عدم المطابقة'],
  'risk id':['risk no','risk number','risk ref','رقم الخطر'],
  'package id':['package no','procurement ref','procurement no','purchase order no','po no','رقم الحزمة'],
  'bond id':['bond no','bond number','guarantee no','guarantee number','رقم الضمان'],
  'determination id':['determination no','determination ref','decision no','award no','رقم القرار'],
  'reference':['ref','reference no','reference number','المرجع'],
  'status':['state','الحالة'], 'description':['details','الوصف'], 'currency':['العملة'],
  'gross work':['gross certified','gross amount','gross certified amount','قيمة الأعمال','اجمالي الاعمال'],
  'net certified':['net certified amount','net amount','net certificate value','صافي المستخلص'],
  'retention':['retention amount','retention deduction','مبلغ الاستقطاع'],
  'advance recovery':['advance payment recovery','advance deduction','استرداد الدفعة المقدمة'],
  'period end':['period ending','period end date','نهاية الفترة'],
  'certificate date':['date of certification','certification date','تاريخ الاعتماد'],
  'payment date':['date paid','paid date','تاريخ الدفع'],
  'raised date':['date raised','date opened','opened date','تاريخ الفتح'],
  'identified date':['date identified','risk identified date','risk date','تاريخ تحديد الخطر'],
  'status as of':['status date','status as of date','تاريخ الحالة'],
  'due date':['date due','target date','تاريخ الاستحقاق'],
  'expiry date':['date of expiry','expiration date','guarantee expiry','تاريخ الانتهاء'],
  'approval date':['date approved','date of approval','تاريخ الموافقة'],
  'days claimed':['claimed days','claimed delay days','أيام المطالبة'],
  'awarded eot days':['granted days','awarded days','determined days','أيام التمديد المعتمدة'],
  'determination date':['decision date','award date','date of determination'],
  'linked activity':['activity ref','activity reference','linked activity id','رقم النشاط'],
  'man hours':['manhours','man hours worked','exposure hours','ساعات العمل'],
  'lost time injuries':['lti','lost time injury count','إصابات الوقت الضائع'],
  'medical treatment cases':['mtc'], 'first aid cases':['fac'], 'near misses':['near miss count'],
  'report date':['reporting date','as of date','تاريخ التقرير'],
};
const aliases=new Map(Object.entries(groups).flatMap(([key,values])=>[key,...values].map(value=>[normalizeHeader(value),key] as const)));
export function canonicalHeader(value:string,documentType=''):string {
  const normalized=normalizeHeader(value);
  let key=aliases.get(normalized);
  if(!key){const parts=value.split(/[|/\n]+/).map(normalizeHeader).filter(Boolean);const matches=[...new Set(parts.map(p=>aliases.get(p)).filter(Boolean))];if(matches.length===1)key=matches[0];}
  if(!key){const currency=/\b([A-Z]{3})\b/.exec(value)?.[1];if(currency){const base=aliases.get(normalizeHeader(value.replace(currency,'')));if(base)return base+' '+currency.toLowerCase();}}
  key=key??normalized;
  if(key==='reference'){
    const identity=/claim/.test(documentType)?'claim id':/variation/.test(documentType)?'variation id':/payment/.test(documentType)?'certificate no':/rfi/.test(documentType)?'rfi id':/ncr/.test(documentType)?'ncr id':/risk/.test(documentType)?'risk id':/procurement/.test(documentType)?'package id':/bond/.test(documentType)?'bond id':/determination/.test(documentType)?'determination id':null;
    if(identity)return identity;
  }
  return key;
}
const fields=new Set([...Object.keys(groups),'amount','value','unit','metric','as of','probability','impact','rating','owner','title','event','responsibility','assessment date','notice id','approved amount','submitted amount','payment type','type','bond type','issuer','beneficiary','actual delivery','required on site','supplier','trir','ltifr','reporting month','tax basis','vat basis']);
export function registerDate(value:string):string|null {
  const text=value.trim().replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660));
  const iso=/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  const numeric=/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
  const words=/^(\d{1,2})[ -]+([A-Za-z]+)[ ,\-]+(\d{4})$/.exec(text);
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  let y:number,m:number,d:number;
  if(iso){y=+iso[1]!;m=+iso[2]!;d=+iso[3]!;}else if(numeric){y=+numeric[3]!;m=+numeric[2]!;d=+numeric[1]!;}else if(words){y=+words[3]!;m=months.indexOf(words[2]!.slice(0,3).toLowerCase())+1;d=+words[1]!;}else return null;
  const date=new Date(Date.UTC(y,m-1,d));return m>0&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):null;
}
export function prepareRegisterRows(input:readonly string[][],documentType='') {
  let headerIndex=0,best=0;
  input.slice(0,50).forEach((row,index)=>{const score=new Set(row.map(h=>canonicalHeader(h,documentType)).filter(h=>fields.has(h)||fields.has(h.replace(/ [a-z]{3}$/,'')))).size;if(score>best){best=score;headerIndex=index;}});
  if(best<2){const firstWide=input.findIndex(r=>r.filter(v=>v.trim()).length>=2);headerIndex=Math.max(0,firstWide);}
  const rawHeaders=input[headerIndex]??[],headers=rawHeaders.map(h=>canonicalHeader(h,documentType));
  const unknown=rawHeaders.filter((h,i)=>!fields.has(headers[i]!)&&!fields.has(headers[i]!.replace(/ [a-z]{3}$/,'')));
  const rows=input.slice(headerIndex+1).filter(r=>r.some(v=>v.trim())).map(row=>row.map((raw,i)=>{
    const header=headers[i]??'';
    return /(?:date|period end|as of|event start|event end|week start|raised|closed)$/.test(header)?registerDate(raw)??raw:raw;
  }));
  const required=/claim/.test(documentType)?['claim id']:/variation/.test(documentType)?['variation id']:/payment_cert/.test(documentType)?['certificate no','net certified']:/rfi/.test(documentType)?['rfi id']:/ncr/.test(documentType)?['ncr id']:/risk_register/.test(documentType)?['risk id']:/bond|security_register/.test(documentType)?['bond id']:[];
  const recognized=best>=2&&required.every(key=>headers.includes(key));
  return {headerRow:headerIndex+1,rawHeaders,headers,rows,unknown,recognized,readRowCount:rows.length};
}
