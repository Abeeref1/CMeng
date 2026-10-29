/** Shared semantic headers for register ingestion. Unknown columns are retained. */
import {deliveryFields} from '../../delivery-core/src/fields';
import {deliveryKinds,kindIdentities,type DeliveryKind} from '../../delivery-core/src/types';
import {deliveryDocumentKinds,deliveryReaderColumns} from '../../delivery-core/src/reader-columns';
// A CPU profile over 51,700 source rows showed that the same 40–200 column
// names are normalised millions of times across lookups. Cache their exact
// semantic result, but bound memory for user-supplied arbitrary column names.
const HEADER_MEMO_LIMIT=4096;
const normalizedHeaderMemo=new Map<string,string>();
const canonicalHeaderMemo=new Map<string,string>();
const memo=(map:Map<string,string>,key:string,value:string)=>{
  if(map.size>=HEADER_MEMO_LIMIT)map.clear();
  map.set(key,value);
  return value;
};
/** The actual business status of a source register, not document governance. 
 * Consumers use the same domain-specific alternatives for every page. */
export function registerBusinessStatusFields(documentType:string):readonly string[] {
  switch(documentType) {
    case 'ncr': case 'quality_ncr_register':
      return ['ncr status','nonconformance status','non conformance status','status of ncr','closure status','current status','status'];
    case 'rfi': case 'rfi_register':
      return ['rfi status','rfi current status','response status','answer status','current status','status'];
    case 'risk': case 'risk_register':
      return ['risk status','risk current status','risk treatment status','current status','status'];
    case 'submittal_register':
      return ['submittal status','approval status','review status','current status','status'];
    case 'procurement_register':
      return ['delivery status','procurement status','package status','current status','status'];
    default:
      return ['current status','status'];
  }
}

/** R12 follow-up: a payment certificate's Net Payable column is its net certified
 * amount. Readers use it only where no Net Certified column exists. */
export const NET_PAYABLE_HEADERS:readonly string[]=['net payable','net amount payable','net payable amount'];

export const normalizeHeader=(v:string)=>{
  const hit=normalizedHeaderMemo.get(v);
  if(hit!==undefined)return hit;
  const value=v.normalize('NFKC').replace(/^\uFEFF/,'')
    .replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/([A-Z]{2,})s\b/g,word=>word.toLowerCase())
    .replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  return memo(normalizedHeaderMemo,v,value);
};
const groups:Record<string,string[]>={
  'claim id':['claim ref','claim reference','claim no','claim number','رقم المطالبة','مرجع المطالبة'],
  'event':['event description','delay event','delay description','وصف الحدث'],
  'notice date':['date of notice','notice issued date','تاريخ الإشعار','تاريخ الاشعار'],
  'event start':['event date','event start date','date of event','تاريخ الحدث'],
  'variation id':['variation no','variation number','variation ref','vo no','vo id','change order no','رقم التغيير'],
  'certificate no':['certificate','certificate number','certificate id','ipc no','ipc number','payment certificate no','رقم المستخلص'],
  'rfi id':['rfi no','rfi number','rfi ref','رقم الاستفسار'],
  'ncr id':['ncr no','ncr number','ncr ref','رقم عدم المطابقة'],
  'risk id':['risk no','risk number','risk ref','رقم الخطر'],
  'package id':['package no','procurement package','procurement package id','procurement ref','procurement no','purchase order no','po no','رقم الحزمة'],
  'submittal id':['submittal no','submittal number','submittal ref'],
  'bond id':['bond no','bond number','guarantee no','guarantee number','security id','security no','instrument id','instrument no','رقم الضمان'],
  'determination id':['determination no','determination ref','decision no','award no','رقم القرار'],
  'permit id':['permit no','permit number','permit ref','permit reference','authority permit no','approval permit no'],
  'policy id':['policy no','policy number','insurance policy no','insurance policy number'],
  'reference':['ref','reference no','reference number','المرجع'],
  'status':['state','الحالة'], 'description':['details','الوصف'], 'currency':['العملة'],
  'awareness date':['date of awareness','became aware date','date became aware','awareness','تاريخ العلم'],
  'responsibility':['responsibility claimed','claimed responsibility','responsibility category','المسؤولية المدعاة'],
  'owner':['responsible','responsible person','assigned to','assignee','action owner','action by','مسؤول','المسؤول'],
  'impact':['impact 1 5','impact score','consequence impact','impact rating'],
  'score':['risk score','risk score value'],
  'last reviewed':['last review','last review date','reviewed date'],
  'bond type':['instrument','instrument type','security type','guarantee type','policy type'],
  'supplier':['vendor','vendor name','supplier name'],
  'long lead':['long lead flag','long lead item','long lead yes no'],
  'gross work':['gross','gross amount','gross work done','gross work done (period)','gross work (period)','قيمة الأعمال','اجمالي الاعمال'],
  'gross certified amount':['gross certified','gross certified value'],
  'net certified':['net','net certified amount','net amount','net certificate value','صافي المستخلص'],
  'retention':['retention amount','retention deduction','retention deducted','مبلغ الاستقطاع'],
  'advance recovery':['advance payment recovery','advance deduction','استرداد الدفعة المقدمة'],
  'period end':['period ending','period end date','نهاية الفترة'],
  'certificate date':['date of certification','certification date','تاريخ الاعتماد'],
  'payment date':['date paid','paid date','actual payment date','receipt date','date received','تاريخ الدفع'],
  'paid amount':['amount paid','actual paid amount','payment amount','receipt amount','amount received'],
  'raised date':['raised','date raised','date opened','opened date','تاريخ الفتح'],
  'identified date':['date identified','risk identified date','risk date','تاريخ تحديد الخطر'],
  'status as of':['status date','status as of date','تاريخ الحالة'],
  'due date':['date due','target date','required response','response due','reply due date','action due date','target action date','تاريخ الاستحقاق'],
  'expiry date':['valid to','valid until','date of expiry','expiration date','guarantee expiry','تاريخ الانتهاء'],
  'approval date':['date approved','date of approval','تاريخ الموافقة'],
  'days claimed':['claimed days','claimed delay days','أيام المطالبة'],
  // The claimant's Source Granted Days is an asserted assessment, not an
  // Engineer's dated determination. Never alias it to awarded EOT.
  'source granted days':['days granted','register granted days','source days granted','source grant days'],
  'awarded eot days':['granted days','awarded days','determined days','أيام التمديد المعتمدة'],
  'determination date':['decision date','award date','date of determination'],
  'linked activity':['activity id','activity code','affected activity','linked schedule activity','schedule activity','activity ref','activity reference','linked activity id','رقم النشاط'],
  'incident date':['date of incident','date occurred','occurrence date','تاريخ الحادث'],
  'man hours':['manhours','man hours worked','exposure hours','ساعات العمل'],
  'lost time injuries':['lti','lost time injury count','إصابات الوقت الضائع'],
  'medical treatment cases':['mtc'], 'first aid cases':['fac'], 'near misses':['near miss count'],
  'report date':['reporting date','as of date','تاريخ التقرير'],
  'forecast delivery':['forecast delivery date','forecast delivery','expected delivery','expected delivery date','forecast on site'],
  'planned issue':['planned issue date','planned submission','planned submission date'],
  'actual issue':['actual issue date','actual submission','actual submission date'],
  'planned date':['planned test date','target test date'],
  'actual date':['actual test date','completed date'],
  'week start':['week commencing','week beginning','week start date'],
  // C7 / M2.2: the resource headings both resource readers accept, in one place.
  'available capacity':['weekly capacity','capacity available','available hours','weekly available capacity','available capacity hours'],
  'planned demand':['planned hours','demand hours','required hours','weekly demand','required demand'],
  'actual approved usage':['actual usage','approved usage','actual hours used','used hours'],
  'conservative achievable rate day':['conservative rate day','conservative rate per day','conservative rate'],
  'recent achieved rate day':['recent rate day','recent rate per day','achieved rate day','recent achieved rate'],
  'submitted date':['date submitted','submission date'],
  'assessment date':['date assessed','assessed date'],
  'closed date':['date closed','closure date'],
  'effective date':['date effective','effective from','effective from date'],
  'release date':['date released','release issued date'],
  'measurement date':['measured date','date measured','measurement as of','تاريخ القياس'],
  'item no':['item number','رقم البند'],
  // A BOQ-qualified number cites a BOQ item; it is never a register's own row number.
  'boq item no':['boq item number','boq ref no','boq reference no','boq item ref no','boq item reference no'],
  'cumulative installed qty':['cumulative installed quantity','installed quantity to date','cumulative measured quantity'],
  'pv':['planned value','bcws'],
  'ev':['earned value','bcwp'],
  'ac':['actual cost','acwp'],
  'bac':['budget at completion'],
  'eac':['estimate at completion'],
  'etc':['estimate to complete'],
  'sv':['schedule variance'],
  'cv':['cost variance'],
};
const aliases=new Map(Object.entries(groups).flatMap(([key,values])=>[key,...values].map(value=>[normalizeHeader(value),key] as const)));
// Third-party register headings often reverse an abbreviation and "Status".
// Keep each business status distinct from closure, response, approval and
// document governance; this changes no source cell or adoption decision.
const sourceBusinessStatusNames:readonly (readonly [string,readonly string[]])[]=[
  ['ncr status',['NCR Status','Status NCR']],
  ['rfi status',['RFI Status','Status RFI']],
  ['risk status',['Risk Status','Status Risk']],
  ['submittal status',['Submittal Status','Status Submittal']],
  ['procurement status',['Procurement Status','Status Procurement']],
  ['delivery status',['Delivery Status','Status Delivery']],
  ['package status',['Package Status','Status Package']],
];
for(const [canonical,spellings] of sourceBusinessStatusNames)
  for(const spelling of spellings)aliases.set(normalizeHeader(spelling),canonical);
// C7: one tolerant reading of a heading. Word order, simple plurals, common
// abbreviations and filler words do not change the field. A shape shared by two
// fields is never guessed.
const SIGNATURE_SYNONYMS:Record<string,string>={qty:'quantity',quantities:'quantity',no:'number',num:'number',nr:'number',ref:'reference',refs:'reference',
  hrs:'hour',hr:'hour',hours:'hour',days:'day',dt:'date',dates:'date',wk:'week',weeks:'week',amt:'amount',approved:'approve',awarded:'award',granted:'grant',determined:'determine'};
const SIGNATURE_FILLER=new Set(['of','the','a','an','per','in','on','for','by','to','and']);
function headerSignature(normalized:string){
  const tokens=normalized.split(' ').filter(t=>t&&!SIGNATURE_FILLER.has(t)).map(t=>SIGNATURE_SYNONYMS[t]??(t.length>4&&/s$/.test(t)&&!/(ss|us|is)$/.test(t)?t.slice(0,-1):t));
  return [...new Set(tokens)].sort().join(' ');
}
let signatureIndex:Map<string,string|null>|null=null;
function signatureField(normalized:string):string|undefined{
  if(!signatureIndex){
    signatureIndex=new Map();
    const add=(name:string,key:string)=>{const sig=headerSignature(normalizeHeader(name));if(!sig)return;const prior=signatureIndex!.get(sig);signatureIndex!.set(sig,prior===undefined||prior===key?key:null);};
    for(const [key,values] of Object.entries(groups))for(const name of [key,...values])add(name,key);
    for(const name of fields)add(name,name);
  }
  const hit=signatureIndex.get(headerSignature(normalized));
  return hit??undefined;
}
export function canonicalHeader(value:string,documentType=''):string {
  // Document-type identity is part of the cache key (a generic "Reference"
  // legitimately means different things in an RFI versus a payment register).
  const memoKey=documentType+'\u0000'+value;
  const hit=canonicalHeaderMemo.get(memoKey);
  if(hit!==undefined)return hit;
  const normalized=normalizeHeader(value);
  let key=aliases.get(normalized);
  if(!key){const parts=value.split(/[|/\n]+/).map(normalizeHeader).filter(Boolean);const matches=[...new Set(parts.map(p=>aliases.get(p)).filter(Boolean))];if(matches.length===1)key=matches[0];
    // A bilingual translation can use a broader Arabic word (for example
    // approval/certification). Retain the single explicit English field name.
    if(!key&&parts.some(p=>/[\u0600-\u06ff]/.test(p))){const english=parts.filter(p=>/^[a-z0-9 ]+$/.test(p)).map(p=>aliases.get(p)).filter(Boolean);if(english.length===1)key=english[0];}
  }
  // C7: the same heading in another word order, number or abbreviation ("Days Awarded",
  // "Qty Installed") is the same field, when exactly one known field has that shape.
  if(!key)key=signatureField(normalized);
  if(!key){const currency=/\b([A-Z]{3})\b/.exec(value)?.[1];if(currency){const base=aliases.get(normalizeHeader(value.replace(currency,'')));if(base)return base+' '+currency.toLowerCase();}}
  key=key??normalized;
  // M12.1: in NCR, RFI, risk, submittal and design registers the responsible party is the
  // record's owner (in claim and obligation registers it keeps its own meaning).
  if(key==='responsible party'&&/ncr|rfi|risk|submittal|design|quality/.test(documentType))return memo(canonicalHeaderMemo,memoKey,'owner');
  if(key==='reference'){
    const identity=/claim/.test(documentType)?'claim id':/variation/.test(documentType)?'variation id':/payment/.test(documentType)?'certificate no':/rfi/.test(documentType)?'rfi id':/ncr/.test(documentType)?'ncr id':/risk/.test(documentType)?'risk id':/procurement/.test(documentType)?'package id':/bond/.test(documentType)?'bond id':/determination/.test(documentType)?'determination id':null;
    if(identity)return memo(canonicalHeaderMemo,memoKey,identity);
  }
  return memo(canonicalHeaderMemo,memoKey,key);
}
// These are actual business-status columns read by the shared register
// consumers. Without registering them as recognized headers, source audits
// incorrectly label their populated cells unused and a short register can
// lose its header row to a later, unrelated row.
const businessStatusFields=[...new Set(
  ['quality_ncr_register','rfi_register','risk_register','submittal_register','procurement_register']
    .flatMap(registerBusinessStatusFields)
)];
const fields=new Set([...Object.keys(groups),...businessStatusFields,
  'section','quantity','rate','category','instruction date','claimed amount','amount','value','unit','metric','as of','date','probability','impact','score','rating','owner','title','event','responsibility','awareness date','last reviewed','notice id','long lead',
  'permit id','permit type','issuing authority','policy id','authority','submission date','review date','issue date','valid from','expiry applicable','renewal required','required by','blocker',
  'subject','response date','close date','severity','order value','time impact days','outcome','engineer letter ref','notice letter ref','contract clause',
  'pv','ev','ac','bac','eac','etc','sv','cv',
  'approved amount','submitted amount','payment type','type','bond type','issuer','beneficiary','actual delivery','required on site','supplier',
  'trir','ltifr','reporting month','tax basis','vat basis',
  'application amount','engineer assessed amount','employer certified amount','variation certified amount','variations',
  'paid amount','outstanding amount','other deductions','other deduction','tax amount','payment reference','payment source status',...NET_PAYABLE_HEADERS,
  'certified amount basis','paid amount basis','paid allocation basis','payment allocation basis',
  'application date','payment due date','retention release date','retention release due date','certification due date',
  'instruction id','issue date','quotation due date','quotation date','estimated amount','schedule impact days',
  'obligation id','clause','responsible party','evidence reference','retention id','trigger',
  'calculated critical impact days','concurrency days','mitigation days','net assessed impact days','assessed days','employer delay days','contractor delay days','analysis status','approved',
  // Project-control register schemas. Recognition means the columns were read;
  // it does not establish lifecycle completeness, mapping or authority.
  'wbs id','wbs code','wbs name','level','parent wbs id',
  'resource id','resource uid','resource name','class','trade','trade discipline','utilization applicable','available units',
  'hours per unit per week','base weekly capacity','available capacity','planned demand','actual approved usage','forecast demand',
  'planned utilization','actual utilization','planned overallocated','actual overallocated','assignment id','planned quantity','actual quantity','remaining forecast quantity',
  'deliverable id','discipline','revision',
  'asset id','system','location','criticality','tag installed','commissioned','o m manual','warranty',
  'test id','test','authority witness',
  'document class','pmo admin','project director','planner','commercial manager','engineer','contractor user','external viewer',
  'sequence','task uid','float path','float path order','total float days','free float days',
  'baseline start','baseline finish','current start','current finish','baseline status','current status','identity status',
  'obs code','obs name','parent obs','responsible manager','primary wbs',
  'work package','work package id','remaining quantity','recent achieved rate day','conservative achievable rate day','independent forecast finish',
  'measured by','filename','file name','file path','relative path','sha256','source hash','document type','purpose','expected role','notes'
]);
export function isRegisterHeader(value:string):boolean {
  const key=canonicalHeader(value);
  return fields.has(key)||fields.has(key.replace(/ [a-z]{3}$/, ''));
}
const registerDateHeaders=new Set([
  'notice date','event start','period end','certificate date','payment date','raised date','identified date','status as of','due date',
  'release date','expiry date','approval date','determination date','incident date','report date','required on site','forecast delivery','actual delivery',
  'planned issue','actual issue','planned date','actual date','week start','as of','date','submitted date','submission date','review date','issue date','valid from',
  'assessment date','closed date','effective date','measurement date','awareness date','last reviewed',
]);
export function isRegisterDateHeader(value:string):boolean {
  return registerDateHeaders.has(canonicalHeader(value));
}

/** Shared unused-column report entry for every source table (registers and
 * programme files): a column is either read into a field or listed as unused
 * with its name, and its values are retained, never treated as zero. */
export function sourceColumnAuditEntry<K extends string>(sourceHeader:string,canonicalHeader:string,kind:K,mapped:boolean,readReason:string,sample?:string|null,unusedReason?:string){
  return {sourceHeader,canonicalHeader,kind,mappingState:mapped?'schema_recognized' as const:'unused' as const,
    reason:mapped?readReason
      :unusedReason??'No canonical calculation consumes this source header. The source column and its values remain retained and must not be silently treated as zero.',
    ...(sample!==undefined?{sample}:{})};
}

/** R1: why a register column is not used, in plain words, for the document's
 * reading record. A placeholder heading (Extra_0, Misc 1, X2, a blank heading)
 * has no field meaning; a comment or note column is free text; any other
 * column is one no CMeng reader uses for this kind of register. */
export function unusedColumnReason(rawHeader:string):string{
  const name=normalizeHeader(rawHeader??'');
  if(!name||/^(?:extra|misc|miscellaneous|unnamed|untitled|blank|column|col|field)(?: ?\d+)?$|^x ?\d+$|^unlabelled column \d+$/.test(name))
    return 'Placeholder heading with no field meaning. Its values are kept in the source file and not used in any figure.';
  if(/^(?:comments?|notes?|remarks?|memo|ملاحظات|ملاحظة|تعليق|تعليقات)(?: ?\d+)?$/u.test(name))
    return 'Free-text comment. It is kept in the source file and not used in any figure.';
  return 'No CMeng reader uses this column for this kind of register. Its values are kept in the source file and never treated as zero.';
}

/** Cover-sheet title reason: a one-column sheet that is not a table. */
export const TITLE_SHEET_COLUMN_REASON='Cover sheet title. The sheet holds no register columns; all of its text is read.';

// R1: the shared specialist readers read more columns than the recognition
// schema above lists. Each reader is named with the columns it reads and the
// table shape it reads, so a column it reads is never reported as unused, and
// a column is counted as read only for the kind of register that reader owns.
const BOND_READER_COLUMNS=['bond id','bond type','type','expiry date','expiration date','valid until','status','release date','released on','return date',
  'bond amount','guarantee amount','amount','currency','coverage amount','insured amount','policy limit','inception date','start date','effective date','valid from'];
const VARIATION_READER_COLUMNS=['variation id','description','variation description','approval date','status','authority','instruction id','site instruction id','si id',
  'instruction date','site instruction date','si date','submitted date','submission date','quotation date','quote date','assessment date','assessed date','agreed date',
  'schedule impact days','time impact days','eot days','claim id','payment id','certificate no','ipc','activity ids','activity id','schedule activity ids',
  'clause','clause identifiers','clause references','approved amount','agreed amount','assessed amount','claimed amount','submitted amount','currency'];
const COST_READER_COLUMNS=['as of','period end','date','pv','ev','ac','bac','eac','etc','sv','cv','currency','unit','status','cbs','cbs id','cost code',
  'cbs description','cost code description','description','parent cbs','parent cbs id','parent cost code','wbs','wbs id','wbs code','metric','value',
  'amount basis','value basis','series basis','cash basis','counterparty','vendor','subcontractor','boq item','boq item id','boq line','payment id','certificate no','ipc'];
const CLAIMS_READER_COLUMNS=['claim id','claim no','claim number','event id','delay event id','event no','event number','related event id','event reference',
  'event','event title','title','description','event start','start date','delay start','from date','event end','end date','delay end','to date',
  'responsibility','responsible party','delay responsibility','category','event category','delay type','impact days','delay days','event days',
  'activity id','activity ids','schedule activity','notice date','submitted date','days claimed','claimed days','days granted','granted days','determined days',
  'approved eot days','claimed amount','amount claimed','claim amount','submitted amount','assessed amount','determined amount','approved amount','amount assessed',
  'amount awarded','status','determination status','clause','clause reference','determination id','determination no','engineer determination',
  'day basis','eot day basis','calendar working','currency'];
type ReaderIndex={commercial:Array<{label:string;columns:Set<string>;reads:(keys:ReadonlySet<string>,documentType:string)=>boolean}>;
  delivery:Map<DeliveryKind,{identities:string[];signature:string[];columns:Set<string>}>;recordType:string};
let readerIndex:ReaderIndex|null=null;
function registerReaders():ReaderIndex{
  if(readerIndex)return readerIndex;
  const keys=(names:readonly string[])=>new Set(names.map(name=>canonicalHeader(name)));
  const k=(name:string)=>canonicalHeader(name);
  readerIndex={
    commercial:[
      {label:'bond register reader',columns:keys(BOND_READER_COLUMNS),reads:h=>h.has(k('bond id'))&&(h.has(k('bond type'))||h.has(k('type')))},
      {label:'variation register reader',columns:keys(VARIATION_READER_COLUMNS),reads:h=>h.has(k('variation id'))&&h.has(k('status'))},
      {label:'cost report reader',columns:keys(COST_READER_COLUMNS),reads:(h,type)=>type==='cost_evm_report'||['pv','ev','ac'].every(n=>h.has(k(n)))||h.has(k('metric'))&&h.has(k('as of'))},
      {label:'claims register reader',columns:keys(CLAIMS_READER_COLUMNS),reads:(h,type)=>type==='delay_eot_claims_register'},
    ],
    delivery:new Map(deliveryKinds.map(kind=>[kind,{identities:kindIdentities[kind].map(k),signature:deliveryFields[kind].map(k),columns:keys(deliveryReaderColumns(kind))}] as const)),
    recordType:k('delivery record type'),
  };
  return readerIndex;
}
/** The Delivery record kinds the Delivery reader reads from a table with these
 * headings, by the same order of evidence it uses for each row: an explicit
 * record-type column, one identity column, the best kind signature among
 * several identities, then the register's document type. */
function deliveryKindsForHeaders(keys:ReadonlySet<string>,documentType:string):DeliveryKind[]{
  const index=registerReaders();
  if(keys.has(index.recordType))return [...deliveryKinds];
  const candidates=deliveryKinds.filter(kind=>index.delivery.get(kind)!.identities.some(id=>keys.has(id)));
  if(candidates.length===1)return candidates;
  if(candidates.length>1){
    const ranked=candidates.map(kind=>({kind,score:index.delivery.get(kind)!.signature.filter(key=>keys.has(key)).length}))
      .sort((a,b)=>b.score-a.score||a.kind.localeCompare(b.kind));
    if(ranked[0]!.score>0&&ranked[0]!.score>(ranked[1]?.score??-1))return [ranked[0]!.kind];
  }
  const typed=deliveryDocumentKinds[documentType];
  return typed?[typed]:[];
}
/** R1: canonical column -> the shared reader that reads it, for one table. */
export function registerReaderColumns(headers:readonly string[],documentType=''):Map<string,string>{
  const index=registerReaders(),keys=new Set(headers),out=new Map<string,string>();
  for(const kind of deliveryKindsForHeaders(keys,documentType))
    for(const column of index.delivery.get(kind)!.columns)if(!out.has(column))out.set(column,'Delivery reader');
  for(const reader of index.commercial)if(reader.reads(keys,documentType))
    for(const column of reader.columns)if(!out.has(column))out.set(column,reader.label.charAt(0).toUpperCase()+reader.label.slice(1));
  return out;
}
const registerDateMemo=new Map<string,string|null>();
const memoRegisterDate=(source:string,parsed:string|null)=>{
  // Source date parsing is pure; bounded memoization avoids parsing identical
  // lifecycle dates thousands of times while preventing unbounded input caches.
  if(registerDateMemo.size>=4096)registerDateMemo.clear();
  registerDateMemo.set(source,parsed);
  return parsed;
};
export function registerDate(value:string):string|null {
  const existing=registerDateMemo.get(value);
  if(existing!==undefined)return existing;
  const text=value.trim().replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660))
    .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0));
  const iso=/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(text);
  const numeric=/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text);
  const words=/^(\d{1,2})[ -]+([A-Za-z]+)[ ,\-]+(\d{4})$/.exec(text);
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  let y:number,m:number,d:number;
  if(iso){y=+iso[1]!;m=+iso[2]!;d=+iso[3]!;}else if(numeric){y=+numeric[3]!;m=+numeric[2]!;d=+numeric[1]!;}else if(words){y=+words[3]!;m=months.indexOf(words[2]!.slice(0,3).toLowerCase())+1;d=+words[1]!;}else return memoRegisterDate(value,null);
  const date=new Date(Date.UTC(y,m-1,d));
  const parsed=m>0&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?date.toISOString().slice(0,10):null;
  return memoRegisterDate(value,parsed);
}
function registerSummaryRow(row:readonly string[]):boolean{
  const values=row.map(value=>value.normalize('NFKC').trim()).filter(Boolean);
  if(!values.length)return false;
  const first=values[0]!.toLowerCase().replace(/[.:：\-]+$/g,'').replace(/\s+/g,' ').trim();
  // Spreadsheet footers must never become source records merely because their
  // first physical cell happens to sit under an ID column after column reordering.
  // Match only standalone summary labels; legitimate identifiers such as
  // TOTAL-01 or SUBTOTAL-A remain ordinary source values.
  return /^(?:grand total|sub ?total|total|totals|الإجمالي|الاجمالي|المجموع)$/.test(first);
}

/** Shared column-audit kind for one source column (date, days, amount or other), from its raw and canonical header. */
export function registerColumnKind(rawHeader:string,field:string):'date'|'days'|'amount'|'other' {
  const text=normalizeHeader(rawHeader+' '+field);
  return isRegisterDateHeader(field)||/(?:^| )(date|dated|issued|expiry|expired|closed|raised|deadline|as of|period end)(?: |$)/.test(text)?'date':
    /(?:^| )(days|day count|duration|working days|calendar days)(?: |$)/.test(text)?'days':
    // A code, id or reference names a record (cost code, payment no); it is never a money amount.
    /(?:^| )(code|id|no|number|ref|reference)$/.test(normalizeHeader(rawHeader))?'other':
    /(?:^| )(amount|rate|value|cost|payment|paid|certified|retention|balance|sum|currency|cap)(?: |$)/.test(text)?'amount':'other';
}

/** C7: a bare generic heading ("Date", "Days", "Capacity") means one field when the
 * table it sits in says which: a determination register's only date is its
 * determination date. It is resolved only when exactly one such column exists and
 * the specific field is not already present. */
const GENERIC_HEADER_RULES:ReadonlyArray<{when:readonly string[];generic:readonly string[];to:string}>=[
  {when:['determination id'],generic:['date'],to:'determination date'},
  {when:['determination id'],generic:['days','eot days','award'],to:'awarded eot days'},
  {when:['resource id'],generic:['capacity'],to:'available capacity'},
  {when:['resource id'],generic:['demand'],to:'planned demand'},
  {when:['resource id'],generic:['usage','actual'],to:'actual approved usage'},
];
export function resolveGenericHeaders(headers:string[]):string[]{
  let out=headers;
  for(const rule of GENERIC_HEADER_RULES){
    if(!rule.when.every(key=>out.includes(key))||out.includes(rule.to))continue;
    const at=out.map((h,i)=>rule.generic.includes(h)?i:-1).filter(i=>i>=0);
    if(at.length!==1)continue;
    out=out.map((h,i)=>i===at[0]?rule.to:h);
  }
  return out;
}
export function prepareRegisterRows(input:readonly string[][],documentType='') {
  let headerIndex=0,best=0;
  input.slice(0,50).forEach((row,index)=>{const score=new Set(row.map(h=>canonicalHeader(h,documentType)).filter(h=>fields.has(h)||fields.has(h.replace(/ [a-z]{3}$/,'')))).size;if(score>best){best=score;headerIndex=index;}});
  if(best<2){const firstWide=input.findIndex(r=>r.filter(v=>v.trim()).length>=2);headerIndex=Math.max(0,firstWide);}
  const rawHeaders=input[headerIndex]??[],headers=resolveGenericHeaders(rawHeaders.map(h=>canonicalHeader(h,documentType)));
  const readers=registerReaderColumns(headers,documentType);
  const columnAudit=rawHeaders.map((rawHeader,index)=>{
    const field=headers[index]??normalizeHeader(rawHeader);
    const schema=fields.has(field)||fields.has(field.replace(/ [a-z]{3}$/,''));
    const reader=schema?undefined:readers.get(field)??readers.get(field.replace(/ [a-z]{3}$/,''));
    const kind=registerColumnKind(rawHeader,field);
    return sourceColumnAuditEntry(rawHeader,field,kind,schema||reader!==undefined,
      reader?'Read by the shared '+reader.charAt(0).toLowerCase()+reader.slice(1)+'; original source values retained.'
        :'Recognized by the shared register schema; original source values retained. Consumer use requires separate reconciliation.',
      undefined,unusedColumnReason(rawHeader));
  });
  const unknown=columnAudit.filter(column=>column.mappingState==='unused').map(column=>column.sourceHeader);
  // A table owned by a shared reader is recognised when at least two of its
  // headings are read, by the schema or by that reader.
  const readHeadings=new Set(headers.filter((_,index)=>columnAudit[index]?.mappingState!=='unused')).size;
  // Column meaning is constant for the table. Do not normalise and match the
  // same header again for every cell in a large BOQ/resource register.
  const dateColumns=headers.map(isRegisterDateHeader);
  const rows=input.slice(headerIndex+1)
    .filter(r=>r.some(v=>v.trim()))
    .filter(r=>!registerSummaryRow(r))
    .map(row=>row.map((raw,i)=>dateColumns[i]?registerDate(raw)??raw:raw));
  const required=/claim/.test(documentType)?['claim id']:/variation/.test(documentType)?['variation id']:/payment_cert/.test(documentType)?['certificate no']:/rfi/.test(documentType)?['rfi id']:/ncr/.test(documentType)?['ncr id']:/risk_register/.test(documentType)?['risk id']:/bond|security_register/.test(documentType)?['bond id']:[];
  // R12 follow-up: a payment register is recognised by its certificate number and
  // a stated certified column: net certified, net payable, or gross certified.
  const requiredAny=/payment_cert/.test(documentType)?['net certified',...NET_PAYABLE_HEADERS,'gross certified amount']:[];
  const recognized=(best>=2||readers.size>0&&readHeadings>=2)&&required.every(key=>headers.includes(key))&&(!requiredAny.length||requiredAny.some(key=>headers.includes(key)));
  return {headerRow:headerIndex+1,rawHeaders,headers,rows,unknown,columnAudit,recognized,readRowCount:rows.length};
}
