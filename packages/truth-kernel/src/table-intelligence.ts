import {canonicalHeader,isRegisterHeader} from './register-schema';

export type EvidenceValueShape =
  | 'empty'
  | 'date'
  | 'number'
  | 'percentage'
  | 'currency_code'
  | 'boolean'
  | 'identifier'
  | 'categorical'
  | 'text'
  | 'mixed';

export interface EvidenceColumnConfirmation {
  sheetName: string;
  columnIndex: number;
  rawHeader: string;
  meaning: string;
  confirmedAt: string;
  note?: string | null;
}

export type EvidenceRoleKey =
  | 'record_identifier'
  | 'reporting_date'
  | 'status'
  | 'currency'
  | 'percentage'
  | 'amount'
  | 'quantity'
  | 'owner_or_party'
  | 'description_or_subject'
  | 'cumulative_value'
  | 'incremental_value';

export interface EvidenceRoleCandidate {
  role: EvidenceRoleKey;
  confidence: number;
  basis: string[];
}

export interface EvidenceColumnProfile {
  columnIndex: number;
  rawHeader: string;
  headerContext: string;
  headerTokens: string[];
  nonEmptyCount: number;
  uniqueCount: number;
  uniqueRatio: number | null;
  dateRatio: number | null;
  numericRatio: number | null;
  percentageRatio: number | null;
  currencyCodeRatio: number | null;
  booleanRatio: number | null;
  codeLikeRatio: number | null;
  monotonicNonDecreasingRatio: number | null;
  dominantShape: EvidenceValueShape;
  confidence: number;
  identifierCandidate: boolean;
  statusCandidate: boolean;
  cumulativeCandidate: boolean;
  roleCandidates: EvidenceRoleCandidate[];
  confirmedMeaning: string | null;
  samples: string[];
}

export interface EvidenceTableRelationship {
  kind: 'chronology' | 'cumulative_delta' | 'row_arithmetic';
  columns: number[];
  confidence: number;
  support: number;
  detail: string;
}

export interface EvidenceTableIntelligence {
  producerVersion: 'evidence-table-intelligence-v1' | 'evidence-table-intelligence-v2';
  headerRowIndex: number;
  headerRow: number;
  structurallyReadable: boolean;
  confidence: number;
  dataRowCount: number;
  columnCount: number;
  columns: EvidenceColumnProfile[];
  relationships: EvidenceTableRelationship[];
  diagnostics: string[];
}

const normalizeDigits=(value:string)=>value
  .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660))
  .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6f0));

const normalizeText=(value:string)=>normalizeDigits(value)
  .normalize('NFKC')
  .replace(/^\uFEFF/,'')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}%]+/gu,' ')
  .trim();

const headerTokens=(value:string)=>normalizeText(value).split(/\s+/).filter(Boolean);

function parseDateLike(value:string):string|null{
  const text=normalizeDigits(value).trim();
  if(!text)return null;
  let y=0,m=0,d=0;
  const iso=/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(text);
  const dmy=/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  const words=/^(\d{1,2})[ -]+([A-Za-z]+)[ ,\-]+(\d{4})$/.exec(text);
  const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  if(iso){y=+iso[1]!;m=+iso[2]!;d=+iso[3]!;}
  else if(dmy){y=+dmy[3]!;m=+dmy[2]!;d=+dmy[1]!;}
  else if(words){y=+words[3]!;m=months.indexOf(words[2]!.slice(0,3).toLowerCase())+1;d=+words[1]!;}
  else return null;
  const date=new Date(Date.UTC(y,m-1,d));
  return m>0&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d
    ?date.toISOString().slice(0,10):null;
}

function parseNumberLike(value:string):number|null{
  let text=normalizeDigits(value).trim();
  if(!text||parseDateLike(text))return null;
  const negative=/^\(.*\)$/.test(text);
  if(negative)text=text.slice(1,-1);
  text=text
    .replace(/[٬]/g,',')
    .replace(/[٫]/g,'.')
    .replace(/[\s\u00a0]/g,'')
    .replace(/^[^\d+\-.]+|[^\d%+\-.]+$/g,'');
  if(text.endsWith('%'))text=text.slice(0,-1);
  if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))return null;
  const number=Number(text.replace(/,/g,''));
  if(!Number.isFinite(number)||Math.abs(number)>Number.MAX_SAFE_INTEGER)return null;
  return negative?-Math.abs(number):number;
}

const percentageLike=(value:string)=>/%\s*$/.test(normalizeDigits(value).trim());
const currencyCodeLike=(value:string)=>/^[A-Z]{3}$/.test(value.trim());
const booleanLike=(value:string)=>/^(?:yes|no|y|n|true|false|1|0|نعم|لا)$/i.test(value.trim());
const codeLike=(value:string)=>{
  const text=value.trim();
  return text.length>0&&text.length<=64&&/[\p{L}]/u.test(text)&&/\d/.test(text)&&!/\s{2,}/.test(text);
};

function typeHints(header:string){
  const text=normalizeText(header);
  return {
    date:/\b(?:date|dated|day|month|week|period)\b|تاريخ|فترة|شهر|اسبوع|أسبوع/u.test(text),
    percentage:/%|\b(?:percent|percentage|pct)\b|نسبة/u.test(text),
    currency:/\b(?:currency|curr)\b|عملة/u.test(text),
    amount:/\b(?:amount|value|cost|price|rate|total|balance)\b|قيمة|مبلغ|تكلفة|سعر|اجمالي|إجمالي|رصيد/u.test(text),
    quantity:/\b(?:qty|quantity|units?)\b|كمية|عدد/u.test(text),
    identifier:/\b(?:id|ref|reference|no|number|code)\b|رقم|مرجع|كود/u.test(text),
    status:/\b(?:status|state|stage)\b|حالة|الحالة/u.test(text),
    cumulative:/\b(?:cumulative|accumulated|to date|ytd)\b|تراكمي|حتى تاريخه/u.test(text),
    owner:/\b(?:owner|responsible|assigned|party|engineer|contractor|consultant|supplier)\b|مسؤول|المسؤول|مالك|طرف|مقاول|استشاري|مورد/u.test(text),
    description:/\b(?:description|details|subject|narrative|title|comment|remarks)\b|وصف|الموضوع|تفاصيل|ملاحظات/u.test(text),
  };
}

function rowHeaderScore(rows:readonly string[][],index:number):number{
  const row=rows[index]??[];
  const nonEmpty=row.map(v=>v.trim()).filter(Boolean);
  if(nonEmpty.length<2)return -100;
  const uniqueRatio=new Set(nonEmpty.map(normalizeText)).size/nonEmpty.length;
  const dataLike=nonEmpty.filter(v=>parseDateLike(v)!==null||parseNumberLike(v)!==null||percentageLike(v)||currencyCodeLike(v)||booleanLike(v)).length/nonEmpty.length;
  const textLike=1-dataLike;
  const width=row.length;
  const following=rows.slice(index+1,index+13).filter(r=>r.some(v=>v.trim()));
  const sameWidth=following.length
    ?following.filter(r=>Math.abs(r.length-width)<=1).length/following.length
    :0;
  let followingData=0,followingCells=0;
  for(const candidate of following){
    for(const value of candidate.slice(0,width)){
      if(!value?.trim())continue;
      followingCells++;
      if(parseDateLike(value)!==null||parseNumberLike(value)!==null||percentageLike(value)||currencyCodeLike(value)||booleanLike(value)||codeLike(value))followingData++;
    }
  }
  const followingDataRatio=followingCells?followingData/followingCells:0;
  const hints=nonEmpty.filter(v=>{
    const h=typeHints(v);return Object.values(h).some(Boolean);
  }).length/nonEmpty.length;
  // Annotation headings such as Comment 1, Extra_0 and X2 look numeric to
  // structural profiling. Explicit shared register fields carry stronger
  // header evidence than the shape of a later, sparse source data row.
  // Exact field recognition does not assign an unknown table a business role.
  const registerHeaders=new Set(nonEmpty.filter(isRegisterHeader).map(value=>canonicalHeader(value))).size;
  return nonEmpty.length*0.12+uniqueRatio*1.8+textLike*2.4+sameWidth*2+followingDataRatio*2+hints*0.8+registerHeaders*2-dataLike*2;
}

function detectHeaderRow(rows:readonly string[][]):number{
  const limit=Math.min(50,rows.length);
  let bestIndex=0,bestScore=-Infinity;
  for(let i=0;i<limit;i++){
    const score=rowHeaderScore(rows,i);
    if(score>bestScore){bestScore=score;bestIndex=i;}
  }
  if(bestScore<-20){
    const firstWide=rows.findIndex(r=>r.filter(v=>v.trim()).length>=2);
    return Math.max(0,firstWide);
  }
  return bestIndex;
}

function headerContext(rows:readonly string[][],headerRowIndex:number,columnIndex:number):string{
  const parts:string[]=[];
  for(let r=Math.max(0,headerRowIndex-2);r<=headerRowIndex;r++){
    const row=rows[r]??[];
    let value=(row[columnIndex]??'').trim();
    if(!value&&r<headerRowIndex){
      for(let c=columnIndex-1;c>=0;c--){
        const prior=(row[c]??'').trim();
        if(prior){value=prior;break;}
      }
    }
    if(value&&!parts.includes(value))parts.push(value);
  }
  return parts.join(' / ');
}

function ratio(count:number,total:number):number|null{return total?count/total:null;}

function monotonicRatio(values:(number|null)[]):number|null{
  const nums=values.filter((v):v is number=>v!==null);
  if(nums.length<3)return null;
  let ok=0,total=0;
  for(let i=1;i<nums.length;i++){total++;if(nums[i]!>=nums[i-1]!)ok++;}
  return total?ok/total:null;
}

function approx(a:number,b:number,tolerance=0.02){
  const scale=Math.max(1,Math.abs(a),Math.abs(b));
  return Math.abs(a-b)<=scale*tolerance;
}

function genericRoleCandidates(input:{
  hints:ReturnType<typeof typeHints>;
  dominantShape:EvidenceValueShape;
  identifierCandidate:boolean;
  statusCandidate:boolean;
  cumulativeCandidate:boolean;
  uniqueRatio:number|null;
  numericRatio:number|null;
  dateRatio:number|null;
  percentageRatio:number|null;
  currencyCodeRatio:number|null;
  monotonicNonDecreasingRatio:number|null;
  samples:string[];
}):EvidenceRoleCandidate[]{
  const result:EvidenceRoleCandidate[]=[];
  const add=(role:EvidenceRoleKey,confidence:number,...basis:string[])=>{
    if(confidence>=0.55)result.push({role,confidence:Math.min(0.99,Number(confidence.toFixed(3))),basis});
  };
  if(input.identifierCandidate)add('record_identifier',Math.max(0.65,input.uniqueRatio??0),...(input.hints.identifier?['header suggests identifier']:[]),'values are highly unique');
  if(input.dominantShape==='date'||(input.dateRatio??0)>=0.75)add('reporting_date',Math.max(input.dateRatio??0,input.hints.date?0.82:0),...(input.hints.date?['header suggests date']:[]),'values parse as dates');
  if(input.statusCandidate)add('status',input.hints.status?0.9:0.68,...(input.hints.status?['header suggests state/status']:[]),'values form a low-cardinality category');
  if(input.dominantShape==='currency_code'||(input.currencyCodeRatio??0)>=0.75)add('currency',Math.max(input.currencyCodeRatio??0,input.hints.currency?0.9:0),...(input.hints.currency?['header suggests currency']:[]),'values resemble currency codes');
  if(input.dominantShape==='percentage'||(input.percentageRatio??0)>=0.7)add('percentage',Math.max(input.percentageRatio??0,input.hints.percentage?0.88:0),...(input.hints.percentage?['header suggests percentage']:[]),'values behave like percentages');
  if((input.numericRatio??0)>=0.75){
    if(input.hints.amount)add('amount',0.86,'header suggests monetary/value measure','values are numeric');
    else add('amount',0.58,'values are numeric; monetary meaning is unconfirmed');
    if(input.hints.quantity)add('quantity',0.86,'header suggests quantity/unit count','values are numeric');
    if(input.cumulativeCandidate)add('cumulative_value',Math.max(0.78,input.monotonicNonDecreasingRatio??0),'numeric series is predominantly non-decreasing',...(input.hints.cumulative?['header suggests cumulative/to-date value']:[]));
    if(!input.cumulativeCandidate&&input.samples.length>=3)add('incremental_value',0.56,'numeric series is not strongly cumulative; incremental meaning remains tentative');
  }
  if(input.hints.owner)add('owner_or_party',0.82,'header suggests responsibility/party');
  if(input.hints.description||input.dominantShape==='text')add('description_or_subject',input.hints.description?0.86:0.62,...(input.hints.description?['header suggests description/subject']:[]),'values are narrative text');
  return result.sort((a,b)=>b.confidence-a.confidence);
}

function columnProfile(
  rows:readonly string[][],
  headerRowIndex:number,
  columnIndex:number,
  confirmation:EvidenceColumnConfirmation|undefined,
):EvidenceColumnProfile{
  const rawHeader=(rows[headerRowIndex]?.[columnIndex]??'').trim()||('Column '+(columnIndex+1));
  const context=headerContext(rows,headerRowIndex,columnIndex);
  const values=rows.slice(headerRowIndex+1).map(r=>(r[columnIndex]??'').trim()).filter(Boolean).slice(0,2000);
  const unique=new Set(values.map(v=>normalizeText(v)));
  let dates=0,numeric=0,percent=0,currency=0,bool=0,codes=0;
  const numbers:(number|null)[]=[];
  for(const value of values){
    const d=parseDateLike(value);if(d)dates++;
    const n=parseNumberLike(value);numbers.push(n);if(n!==null)numeric++;
    if(percentageLike(value))percent++;
    if(currencyCodeLike(value))currency++;
    if(booleanLike(value))bool++;
    if(codeLike(value))codes++;
  }
  const nonEmpty=values.length;
  const dateRatio=ratio(dates,nonEmpty),numericRatio=ratio(numeric,nonEmpty),percentageRatio=ratio(percent,nonEmpty);
  const currencyCodeRatio=ratio(currency,nonEmpty),booleanRatio=ratio(bool,nonEmpty),codeLikeRatio=ratio(codes,nonEmpty);
  const uniqueRatio=ratio(unique.size,nonEmpty),monotonicNonDecreasingRatio=monotonicRatio(numbers);
  const hints=typeHints(context||rawHeader);
  const identifierCandidate=!!nonEmpty&&((uniqueRatio??0)>=0.85&&((codeLikeRatio??0)>=0.45||(numericRatio??0)<0.5)||hints.identifier);
  const statusCandidate=!!nonEmpty&&(((uniqueRatio??1)<=0.25&&unique.size<=30&&(numericRatio??0)<0.5)||hints.status);
  const cumulativeCandidate=!!nonEmpty&&(numericRatio??0)>=0.8&&(monotonicNonDecreasingRatio??0)>=0.9&&((uniqueRatio??0)>=0.25||hints.cumulative);
  let dominantShape:EvidenceValueShape='mixed',confidence=0.45;
  const scored:Array<[EvidenceValueShape,number]>=[
    ['date',Math.max(dateRatio??0,hints.date?(dateRatio??0)*0.6+0.35:0)],
    ['percentage',Math.max(percentageRatio??0,hints.percentage?(numericRatio??0)*0.5+0.4:0)],
    ['currency_code',Math.max(currencyCodeRatio??0,hints.currency?(currencyCodeRatio??0)*0.6+0.3:0)],
    ['boolean',booleanRatio??0],
    ['number',Math.max(numericRatio??0,(hints.amount||hints.quantity)?(numericRatio??0)*0.7+0.2:0)],
    ['identifier',identifierCandidate?Math.max(0.68,uniqueRatio??0):0],
    ['categorical',statusCandidate?0.72:0],
  ];
  scored.sort((a,b)=>b[1]-a[1]);
  if(!nonEmpty){dominantShape='empty';confidence=1;}
  else if((scored[0]?.[1]??0)>=0.65){dominantShape=scored[0]![0];confidence=Math.min(1,scored[0]![1]);}
  else {
    const longText=values.filter(v=>v.length>40||/\s/.test(v)).length/nonEmpty;
    dominantShape=longText>=0.55?'text':'mixed';
    confidence=Math.max(0.45,longText);
  }
  const samples=[...new Set(values)].slice(0,8);
  const roleCandidates=genericRoleCandidates({
    hints,dominantShape,identifierCandidate,statusCandidate,cumulativeCandidate,uniqueRatio,numericRatio,dateRatio,
    percentageRatio,currencyCodeRatio,monotonicNonDecreasingRatio,samples,
  });
  return {
    columnIndex,rawHeader,headerContext:context||rawHeader,headerTokens:headerTokens(context||rawHeader),
    nonEmptyCount:nonEmpty,uniqueCount:unique.size,uniqueRatio,dateRatio,numericRatio,percentageRatio,
    currencyCodeRatio,booleanRatio,codeLikeRatio,monotonicNonDecreasingRatio,dominantShape,confidence,
    identifierCandidate,statusCandidate,cumulativeCandidate,roleCandidates,confirmedMeaning:confirmation?.meaning?.trim()||null,
    samples,
  };
}

function relationships(rows:readonly string[][],headerRowIndex:number,columns:EvidenceColumnProfile[]):EvidenceTableRelationship[]{
  const result:EvidenceTableRelationship[]=[];
  const data=rows.slice(headerRowIndex+1).filter(r=>r.some(v=>v.trim())).slice(0,600);
  const dateColumns=columns.filter(c=>c.dominantShape==='date'||(c.dateRatio??0)>=0.65).slice(0,12);
  for(let a=0;a<dateColumns.length;a++)for(let b=a+1;b<dateColumns.length;b++){
    const left=dateColumns[a]!,right=dateColumns[b]!;
    let support=0,forward=0;
    for(const row of data){
      const x=parseDateLike(row[left.columnIndex]??''),y=parseDateLike(row[right.columnIndex]??'');
      if(!x||!y)continue;support++;if(x<=y)forward++;
    }
    if(support>=3&&forward/support>=0.85)result.push({
      kind:'chronology',columns:[left.columnIndex,right.columnIndex],confidence:forward/support,support,
      detail:'Column '+(left.columnIndex+1)+' is on or before column '+(right.columnIndex+1)+' in '+forward+' of '+support+' comparable rows.',
    });
  }
  const numeric=columns.filter(c=>(c.numericRatio??0)>=0.75).slice(0,12);
  for(const cumulative of numeric.filter(c=>c.cumulativeCandidate)){
    for(const incremental of numeric){
      if(cumulative.columnIndex===incremental.columnIndex)continue;
      let prior:number|null=null,support=0,matched=0;
      for(const row of data){
        const total=parseNumberLike(row[cumulative.columnIndex]??''),inc=parseNumberLike(row[incremental.columnIndex]??'');
        if(total===null){continue;}
        if(prior!==null&&inc!==null){support++;if(approx(total-prior,inc))matched++;}
        prior=total;
      }
      if(support>=4&&matched/support>=0.8)result.push({
        kind:'cumulative_delta',columns:[cumulative.columnIndex,incremental.columnIndex],confidence:matched/support,support,
        detail:'Row-to-row movement in column '+(cumulative.columnIndex+1)+' matches column '+(incremental.columnIndex+1)+'.',
      });
    }
  }
  for(let a=0;a<numeric.length;a++)for(let b=a+1;b<numeric.length;b++)for(let c=0;c<numeric.length;c++){
    if(c===a||c===b)continue;
    const x=numeric[a]!,y=numeric[b]!,z=numeric[c]!;
    let support=0,sumMatch=0,diffMatch=0;
    for(const row of data){
      const xv=parseNumberLike(row[x.columnIndex]??''),yv=parseNumberLike(row[y.columnIndex]??''),zv=parseNumberLike(row[z.columnIndex]??'');
      if(xv===null||yv===null||zv===null)continue;
      support++;if(approx(xv+yv,zv))sumMatch++;if(approx(xv-yv,zv))diffMatch++;
    }
    if(support<4)continue;
    if(sumMatch/support>=0.9)result.push({kind:'row_arithmetic',columns:[x.columnIndex,y.columnIndex,z.columnIndex],confidence:sumMatch/support,support,detail:'Column '+(x.columnIndex+1)+' + column '+(y.columnIndex+1)+' ≈ column '+(z.columnIndex+1)+'.'});
    else if(diffMatch/support>=0.9)result.push({kind:'row_arithmetic',columns:[x.columnIndex,y.columnIndex,z.columnIndex],confidence:diffMatch/support,support,detail:'Column '+(x.columnIndex+1)+' - column '+(y.columnIndex+1)+' ≈ column '+(z.columnIndex+1)+'.'});
  }
  const dedup=new Map<string,EvidenceTableRelationship>();
  for(const relation of result){
    const key=relation.kind+':'+relation.columns.join(':')+':'+relation.detail;
    if(!dedup.has(key))dedup.set(key,relation);
  }
  return [...dedup.values()].sort((a,b)=>b.confidence-a.confidence||b.support-a.support).slice(0,80);
}

export function analyzeEvidenceTable(
  input:readonly string[][],
  confirmations:readonly EvidenceColumnConfirmation[]=[],
):EvidenceTableIntelligence{
  const diagnostics:string[]=[];
  const rows=input.filter((row,index)=>index<60||row.some(v=>v.trim()));
  if(!rows.length)return {
    producerVersion:'evidence-table-intelligence-v2',headerRowIndex:0,headerRow:1,structurallyReadable:false,
    confidence:0,dataRowCount:0,columnCount:0,columns:[],relationships:[],diagnostics:['TABLE_EMPTY'],
  };
  const headerRowIndex=detectHeaderRow(rows);
  const width=Math.max(0,...rows.slice(headerRowIndex,headerRowIndex+25).map(r=>r.length));
  const confirmationByColumn=new Map(confirmations.map(c=>[c.columnIndex,c] as const));
  const columns=Array.from({length:width},(_,columnIndex)=>columnProfile(rows,headerRowIndex,columnIndex,confirmationByColumn.get(columnIndex)));
  const dataRows=rows.slice(headerRowIndex+1).filter(r=>r.some(v=>v.trim()));
  const usefulColumns=columns.filter(c=>c.nonEmptyCount>0);
  const meanConfidence=usefulColumns.length?usefulColumns.reduce((s,c)=>s+c.confidence,0)/usefulColumns.length:0;
  const widthConsistency=dataRows.length?dataRows.filter(r=>Math.abs(r.length-width)<=1).length/dataRows.length:0;
  const confidence=Math.max(0,Math.min(1,meanConfidence*0.55+widthConsistency*0.35+Math.min(1,usefulColumns.length/4)*0.1));
  const structurallyReadable=usefulColumns.length>=2&&dataRows.length>0&&widthConsistency>=0.6;
  if(!structurallyReadable)diagnostics.push('TABLE_STRUCTURE_REVIEW_REQUIRED');
  if(columns.some(c=>c.dominantShape==='mixed'&&c.nonEmptyCount>0))diagnostics.push('MIXED_COLUMN_TYPES_RETAINED');
  if(columns.some(c=>c.confirmedMeaning))diagnostics.push('USER_CONFIRMED_COLUMN_MEANING_APPLIED');
  return {
    producerVersion:'evidence-table-intelligence-v2',headerRowIndex,headerRow:headerRowIndex+1,
    structurallyReadable,confidence,dataRowCount:dataRows.length,columnCount:width,columns,
    relationships:relationships(rows,headerRowIndex,columns),diagnostics,
  };
}
