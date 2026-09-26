import type {AnalysisPlan, AnalysisResult, AuthorityDescriptor, PageContext, Presentation, AskSession} from './types';
import {AskError} from './catalogue';
import {normalized} from './primitives';

const formats: [RegExp,Presentation['format']][]=[[/\bexcel\b|xlsx|اكسل|إكسل/i,'xlsx'],[/\bpdf\b/i,'pdf'],[/\bword\b|docx|وورد/i,'docx'],[/\bcsv\b/i,'csv'],[/power\s?bi|\bpbix\b/i,'powerbi'],[/\bjson\b/i,'json']];
const defaults=(question:string):AnalysisPlan=>({objective:question,kind:'facts',authorities:[],filters:[],groupBy:[],rankBy:null,rankDirection:'desc',limit:null,metricIds:[],issuesOnly:false,criticalOnly:false,nextDays:null,deliveryBelowPercent:null,asOf:null,scenario:null,attachmentIds:[]});
const mentions=(q:string,concept:string)=>/^[a-z]{1,3}$/i.test(concept)?new RegExp('\\b'+concept+'\\b','i').test(q):q.includes(normalized(concept));
export function resolveIntent(question:string,catalogue:AuthorityDescriptor[],principal:AskSession,page:PageContext|null,previous:AnalysisResult|null){
  const q=normalized(question).replace(/worst(\d)/g,'worst $1').replace(/\bprocument\b/g,'procurement').replace(/\bprogess\b/g,'progress');
  if(/\b(across|all|compare|other|another)\s+(projects|portfolios|programmes)\b|organization.wide|portfolio.rollup|cross.project|جميع المشاريع|كل المشاريع/.test(q))
    throw new AskError(422,'capability_not_enabled','Capability not enabled. Select one Project for this analysis.');
  const transform=/^(excel|xlsx|pdf|word|docx|csv|json|power ?bi|better|shorter|more detail|ceo|executive|project director|planner detail|commercial manager|only |by |add |remove |put my name|prepared by|our logo|change chart|sar\b|aed\b|usd\b|tower |floor |zone |بالعربي|بالعربية|عربي|مختصر|اكسل|إكسل)/i.test(question.trim());
  const purePresentation=transform&&!/^(only |by |add (?:value|procurement|progress)|remove |tower |floor |zone |sar\b|aed\b|usd\b)/.test(q);
  const inherited=!!previous&&transform;
  const plan:AnalysisPlan=inherited?structuredClone(previous.plan):defaults(question);
  const presentation:Presentation=inherited?structuredClone(previous.presentation):{
    title:question.slice(0,160),audience:'project',language:/[\u0600-\u06ff]/.test(question)?'ar':'en',detail:'normal',charts:true,
    preparedBy:null,jobTitle:null,company:null,reportNumber:null,confidentiality:'Project Internal',status:'Draft / Prepared',format:'interactive'};
  const gaps:string[]=[];presentation.format='interactive';
  for(const [pattern,format] of formats)if(pattern.test(question))presentation.format=format;
  if(/shorter|brief|مختصر/.test(q))presentation.detail='short';
  if(/more detail|detailed|تفصيل/.test(q))presentation.detail='detailed';
  if(/ceo|executive|board.level|تنفيذي/.test(q))presentation.audience='executive';
  else if(/project director/.test(q))presentation.audience='director';
  else if(/planner|planning engineer/.test(q))presentation.audience='planner';
  else if(/commercial manager/.test(q))presentation.audience='commercial';
  if(/arabic|بالعربي|بالعربيه|عربي/.test(q))presentation.language='ar';
  if(/bilingual|english and arabic|عربي وانجليزي/.test(q))presentation.language='bilingual';
  if(/english/.test(q)&&!/bilingual|and arabic/.test(q))presentation.language='en';
  if(/put my name|prepared by me|باسمي/.test(q)){
    presentation.preparedBy=principal.name;presentation.jobTitle=principal.title;presentation.company=principal.company;
    if(!principal.name)gaps.push('Prepared By is not configured for your report profile. No name has been invented.');
  }
  if(/our logo|client logo/.test(q))gaps.push('Use the configured CMeng branding. An authorized organization logo has not been configured.');
  if(/without charts|remove charts/.test(q))presentation.charts=false;
  if(/add charts?|with charts?/.test(q))presentation.charts=true;
  if(!inherited){
    const broad=/full.*(report|package)|construction intelligence|monthly project|project director meeting|everything|joined.*today|what killing us|what needs management|تقرير شامل/.test(q);
    if(broad)plan.authorities=catalogue.map(c=>c.id);
    else plan.authorities=catalogue.filter(c=>c.concepts.some(concept=>mentions(q,concept))).map(c=>c.id);
    if(!plan.authorities.length&&page?.page){const match=catalogue.find(c=>c.module===page.page||c.id===page.page);if(match)plan.authorities=[match.id];}
    if(!plan.authorities.length){plan.authorities=catalogue.filter(c=>['programme','progress','risks'].includes(c.id)).map(c=>c.id);if(!plan.authorities.length)plan.authorities=catalogue.slice(0,2).map(c=>c.id);}
    if(/why|behind|delaying|bad|wrong|reconcil|compare|لماذا|متاخر/.test(q)){
      plan.kind='analysis';for(const id of ['programme','progress','materials','productivity','design','quality','construction-readiness'])if(catalogue.some(c=>c.id===id)&&!plan.authorities.includes(id))plan.authorities.push(id);
    }
    if(/reconcil|compare|conflict|difference|قارن/.test(q))plan.kind='reconcile';
    if(/report|package|dashboard|meeting|تقرير|لوحه/.test(q))plan.kind='report';
    if(/review (this|the) (file|document|report)|attached|contractor update|المرفق/.test(q))plan.kind='document';
    if(/draft|response to|challenge.*claim|counterposition|صياغه/.test(q))plan.kind='draft';
    if(/\b(mark|approve|adopt|replace|close|certify|promote|change risk)\b/.test(q)&&!/approved|marked|closed|approval/.test(q))plan.kind='proposal';
    if(page){
      for(const [field,value] of Object.entries(page.filters))if(value)plan.filters.push({field,operator:'eq',value,upper:null});
      for(const [field,value] of [['activityId',page.selectedActivity],['wbsId',page.selectedWbs],['location',page.selectedLocation],['reference',page.selectedPackage]] as const)if(value)plan.filters.push({field,operator:'eq',value,upper:null});
    }
  }
  if(inherited&&/^remove /.test(q))plan.authorities=plan.authorities.filter(id=>!catalogue.find(c=>c.id===id)?.concepts.some(c=>q.slice(7).includes(normalized(c))));
  if(inherited&&/add .*curve/.test(q))for(const c of catalogue.filter(c=>c.concepts.some(k=>mentions(q,k))))if(!plan.authorities.includes(c.id))plan.authorities.push(c.id);
  if(/only critical|critical.*(?:packages|activities|mep)|الحرجه/.test(q))plan.criticalOnly=true;
  if(/only (problems|bad|issues)|bad material|material problem|only exceptions|المشاكل/.test(q))plan.issuesOnly=true;
  const rank=/\b(top|worst)\s*(\d{1,4})/.exec(q);if(rank){plan.limit=Math.min(1000,Math.max(1,Number(rank[2])));plan.rankBy=/cost|value|boq/.test(q)?'amount':/risk/.test(q)&&!/float|activit/.test(q)?'score':/material|procurement/.test(q)?'headroomCalendarDays':'totalFloatHours';plan.rankDirection=plan.rankBy==='amount'||plan.rankBy==='score'?'desc':'asc';}
  for(const dimension of ['discipline','location','floor','zone','supplier','wbs','trade','currency'])if(new RegExp('\\bby '+dimension+'\\b').test(q))plan.groupBy=[dimension==='wbs'?'wbsId':dimension==='trade'?'discipline':dimension];
  const location=/\b(tower\s+[a-z0-9]+|floor\s+\d+|zone\s+[a-z0-9]+)\b/i.exec(question);
  if(location){plan.filters=plan.filters.filter(f=>f.field!=='location');plan.filters.push({field:'location',operator:'contains',value:location[1]!,upper:null});}
  if(/\bmep\b|\bmechanical\b|\belectrical\b|\bcivil\b/.test(q)){const value=/\b(mep|mechanical|electrical|civil)\b/.exec(q)![1]!;plan.filters=plan.filters.filter(f=>f.field!=='discipline');plan.filters.push({field:'discipline',operator:'contains',value,upper:null});}
  const currency=/^(SAR|AED|USD|EUR|GBP)$/i.exec(question.trim());if(currency){plan.filters=plan.filters.filter(f=>f.field!=='currency');plan.filters.push({field:'currency',operator:'eq',value:currency[1]!.toUpperCase(),upper:null});gaps.push('Currency filtering does not convert values. No exchange rate is assumed.');}
  const days=/next\s+(\d+)\s+days|القادمه\s+(\d+)/.exec(q);if(days)plan.nextDays=Math.min(3650,Number(days[1]??days[2]));
  const coverage=/(?:delivery|delivered|التسليم).*?(?:under|below|less than|اقل من)\s+(\d+(?:\.\d+)?)\s*%/.exec(q);if(coverage)plan.deliveryBelowPercent=Number(coverage[1]);
  const asOf=/(?:as of|at|on|before|position at|بتاريخ)\s+(\d{4}-\d{2}-\d{2})\b/.exec(q);
  if(asOf){const date=Date.parse(asOf[1]!);if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==asOf[1])throw new AskError(422,'invalid_reporting_date','Enter a valid historical cut-off date.');plan.asOf=asOf[1]!;plan.kind='historical';}
  else if(/what (was|did)|historical|time.machine|position at|as of|at \d{1,2} (?:january|february|march|april|may|june|july|august|september|october|november|december)/.test(q)){
    gaps.push('Confirm the historical cut-off as YYYY-MM-DD. A year or reporting date is missing; current values have not been substituted.');plan.kind='historical';plan.asOf='unresolved';
  }
  const scenario=/assume|what if|scenario|افترض/.test(q);
  if(scenario){plan.kind='scenario';const lead=/(\d+(?:\.\d+)?)\s*(weeks?|days?)/.exec(q);if(lead)plan.scenario={field:'manufacturingLeadTime',value:Number(lead[1]),unit:lead[2]!.startsWith('week')?'weeks':'days',target:/transformer/.test(q)?'transformer':null};else gaps.push('The scenario assumption needs a numeric duration and its unit.');}
  for(const metric of ['cpi','spi','ev','pv','ac'])if(new RegExp('\\b'+metric+'\\b').test(q))plan.metricIds.push(metric);
  plan.authorities=[...new Set(plan.authorities)];plan.metricIds=[...new Set(plan.metricIds)];
  if(plan.kind==='proposal')gaps.push('This is a proposed change only. Use the record’s governed review workflow to approve any change.');
  return {plan,presentation,gaps,inherited,purePresentation:inherited&&purePresentation};
}

/** Model proposals are untrusted query plans, never executable code or authority. */
export function validateProposedPlan(value:unknown,base:AnalysisPlan,catalogue:AuthorityDescriptor[]):AnalysisPlan{
  if(!value||typeof value!=='object')throw new Error('Invalid analysis plan');const p=value as Record<string,unknown>;
  const ids=new Set(catalogue.map(c=>c.id)),fields=new Set(catalogue.flatMap(c=>c.fields));
  if(!Array.isArray(p.authorities)||!p.authorities.length||p.authorities.some(id=>typeof id!=='string'||!ids.has(id)))throw new Error('Unregistered or unauthorized authority');
  const plan=structuredClone(base);plan.authorities=p.authorities as string[];
  if(Array.isArray(p.filters)){if(p.filters.length>12)throw new Error('Too many filters');const proposed=p.filters.map((f:any)=>{if(!f||!fields.has(f.field)||!['eq','contains','lt','lte','gt','gte','between'].includes(f.operator)||!['string','number','boolean'].includes(typeof f.value)||typeof f.value==='number'&&!Number.isFinite(f.value))throw new Error('Unsupported filter');return {field:f.field,operator:f.operator,value:f.value,upper:typeof f.upper==='number'||typeof f.upper==='string'?f.upper:null};});plan.filters=[...base.filters,...proposed.filter((f:any)=>!base.filters.some(b=>b.field===f.field))];}
  if(Array.isArray(p.groupBy)){if(p.groupBy.some(f=>typeof f!=='string'||!fields.has(f)))throw new Error('Unsupported grouping');plan.groupBy=p.groupBy.length?p.groupBy as string[]:base.groupBy;}
  if(typeof p.rankBy==='string'&&fields.has(p.rankBy))plan.rankBy=p.rankBy;
  if(p.rankDirection==='asc'||p.rankDirection==='desc')plan.rankDirection=p.rankDirection;
  if(typeof p.limit==='number'&&Number.isInteger(p.limit)&&p.limit>0&&p.limit<=1000)plan.limit=p.limit;
  // Time, scenario, scope, identity, permissions and attachments are resolved by CMeng, never copied from model output.
  return plan;
}
