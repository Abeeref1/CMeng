import type {AnalysisPlan, AnalysisResult, AuthorityDescriptor, PageContext, Presentation, AskSession} from './types';
import {AskError} from './catalogue';
import {normalized} from './primitives';
import {mentionsConcept,rankedRequests,substantiveQuestion} from './router';
import {projectQuestionRecipe} from './question-recipes';

const formats: [RegExp,Presentation['format']][]=[[/\bexcel\b|xlsx|اكسل|إكسل/i,'xlsx'],[/\bpdf\b/i,'pdf'],[/\bword\b|docx|وورد/i,'docx'],[/\bcsv\b/i,'csv'],[/power\s?bi|\bpbix\b/i,'powerbi'],[/\bjson\b/i,'json']];
const defaults=(question:string):AnalysisPlan=>({objective:question,kind:'facts',authorities:[],filters:[],groupBy:[],rankBy:null,rankDirection:'desc',limit:null,metricIds:[],issuesOnly:false,criticalOnly:false,nextDays:null,deliveryBelowPercent:null,asOf:null,scenario:null,attachmentIds:[]});
const mentions=mentionsConcept;
export function resolveIntent(question:string,catalogue:AuthorityDescriptor[],principal:AskSession,page:PageContext|null,previous:AnalysisResult|null){
  const q=normalized(substantiveQuestion(question)).replace(/worst(\d)/g,'worst $1').replace(/\bprocument\b/g,'procurement').replace(/\bprogess\b/g,'progress');
  const fullList=/^(?:(?:show|give|list)(?: me)?\s+)?(?:(?:the|a)\s+)?(?:full|complete|all)(?:\s+(?:the\s+)?(?:list|activities|rows|results|details|path|network|of them|\d+))?[.!?]*$/.test(q);
  const simpleFollowup=/^(?:make (?:it|that) (?:easy|simple|simpler)|(?:in )?(?:plain|simple) (?:english|language)|simpler|explain (?:it )?simply)[.!?]*$/.test(q);
  if(/\b(across|all|compare|other|another)\s+(projects|portfolios|programmes)\b|organization.wide|portfolio.rollup|cross.project|جميع المشاريع|كل المشاريع/.test(q))
    throw new AskError(422,'capability_not_enabled','Capability not enabled. Select one Project for this analysis.');
  const transform=/^(excel|xlsx|pdf|word|docx|csv|json|power ?bi|better|shorter|more detail|ceo|executive|project director|planner detail|commercial manager|only |by |add |remove |put my name|prepared by|our logo|change chart|sar\b|aed\b|usd\b|tower |floor |zone |بالعربي|بالعربية|عربي|مختصر|اكسل|إكسل)/i.test(question.trim());
  const purePresentation=transform&&!/^(only |by |add (?:value|procurement|progress)|remove |tower |floor |zone |sar\b|aed\b|usd\b)/.test(q);
  const wbsDrill=previous?.plan.questionRecipe==='wbs_pressure'&&/^show (?:the )?contributing activities for wbs\b/.test(q);
  const inherited=!!previous&&(wbsDrill||transform||fullList||simpleFollowup||/^group by\b|^explain.*\b(?:these|those|they)\b/.test(q));
  const plan:AnalysisPlan=inherited?structuredClone(previous.plan):defaults(question);
  const presentation:Presentation=inherited?structuredClone(previous.presentation):{
    title:question.slice(0,160),audience:'project',language:/[\u0600-\u06ff]/.test(question)?'ar':'en',detail:'normal',charts:true,
    preparedBy:null,jobTitle:null,company:null,reportNumber:null,confidentiality:'Project Internal',status:'Draft / Prepared',format:'interactive'};
  const gaps:string[]=[];presentation.format='interactive';
  if(fullList){plan.limit=null;plan.rankings=[];presentation.detail='detailed';}
  if(simpleFollowup)presentation.detail='short';
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
    const explicitlyRequested=catalogue.filter(c=>c.concepts.some(concept=>mentions(q,concept))).map(c=>c.id);
    if(broad){
      // A broad management brief is not permission to flood the answer with
      // every optional CMeng domain. Start from what the user named and a small
      // cross-domain control core; unavailable specialist domains are added only
      // when the question explicitly asks for them.
      const core=['master-dashboard','programme','progress','boq','forecast','procurement','materials','long-lead','risks','commercial'];
      plan.authorities=[...new Set([...explicitlyRequested,...core.filter(id=>catalogue.some(c=>c.id===id))])];
    }else plan.authorities=explicitlyRequested;
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
  // Resolve activity questions before generic words such as "delayed" can select a claims register.
  const claimsQuestion=/\b(?:claims?|entitlement|delay events?|time impact|windows analysis)\b/.test(q);
  const activityQuestion=/\bactivit(?:y|ies)\b|\b(?:delayed|late|overdue) (?:items|tasks|work)\b|\b(?:critical|driving) path\b|should (?:have )?(?:start|finish)|should have (?:started|finished)|\b(?:missed|overdue|late) starts?\b|\b(?:overdue|late) finishes?\b/.test(q);
  const scheduleQuestion=activityQuestion||/\b(?:project|programme|schedule)\b.*\b(?:delayed|delay|late|behind)\b|\b(?:delay|delaying)\b.*\bproject\b|^(?:show (?:me )?|what (?:is|are) (?:the )?)?(?:delayed|late|overdue)(?: work)?[.!?]*$/.test(q);
  if(!inherited&&!claimsQuestion&&scheduleQuestion){
    const available=(id:string)=>catalogue.some(c=>c.id===id);
    const path=/\b(?:critical|driving) path\b/.test(q);
    // Keep explicitly requested non-schedule domains in a combined question.
    plan.authorities=plan.authorities.filter(id=>!['programme','activities','float','critical-path','forecast','delay','lookahead'].includes(id));
    if(available(path?'critical-path':'activities'))plan.authorities.unshift(path?'critical-path':'activities');
    // A spatial word in an activity question scopes the programme activity
    // population; it does not automatically request the Delivery location register.
    if(activityQuestion&&/\b(?:zone|floor|level|tower|building|area|work ?front)\b/.test(q)&&!/\b(?:location register|location hierarchy|governed locations?)\b/.test(q))
      plan.authorities=plan.authorities.filter(id=>id!=='locations');
    if(/\b(?:why|caus\w*|driv\w*|delaying|makes?|making)\b/.test(q)){
      // A schedule diagnosis starts from schedule facts and linked blockers.
      // Optional domains are added only when the question actually names them.
      plan.authorities=plan.authorities.filter(id=>['activities','critical-path'].includes(id)||catalogue.find(c=>c.id===id)?.concepts.some(c=>mentions(q,c)));
      for(const id of ['critical-path','lookahead','forecast'])if(available(id)&&!plan.authorities.includes(id))plan.authorities.push(id);
    }
  }
  if(/only critical|critical.*(?:packages|activities|mep)|الحرجه/.test(q)&&!/negative.float|near[ -]critical|(?:critical|driving) path/.test(q))plan.criticalOnly=true;
  if(/only (problems|bad|issues)|bad material|material problem|only exceptions|المشاكل/.test(q))plan.issuesOnly=true;
  const rank=/\b(top|worst)\s*(\d{1,4})/.exec(q);if(rank){plan.limit=Math.min(1000,Math.max(1,Number(rank[2])));plan.rankBy=/cost|value|boq/.test(q)?'amount':/risk/.test(q)&&!/float|activit/.test(q)?'score':/material|procurement/.test(q)?'headroomCalendarDays':'totalFloatHours';plan.rankDirection=plan.rankBy==='amount'||plan.rankBy==='score'?'desc':'asc';}
  plan.rankings=rankedRequests(q,catalogue);
  plan.countRows=/\bhow many\b|\bcount\b|عدد/.test(q);
  const scopedFilter=(ids:string[],filter:AnalysisPlan['filters'][number])=>{plan.authorityFilters??={};for(const id of ids)if(plan.authorities.includes(id))plan.authorityFilters[id]=[...(plan.authorityFilters[id]??[]),filter];};
  if(!inherited&&!claimsQuestion&&scheduleQuestion){
    const starts=/should (?:have )?start|should have started|(?:missed|overdue|late) starts?|start.*(?:did(?:n.?t| not)|ha(?:s|ve)(?:n.?t| not)|not yet)|(?:did(?:n.?t| not)|ha(?:s|ve)(?:n.?t| not)).*start/.test(q);
    const finishes=/should (?:have )?finish|should have finished|(?:overdue|late) finish|finish.*(?:overdue|did(?:n.?t| not)|ha(?:s|ve)(?:n.?t| not))/.test(q);
    const field=starts?'missedPlannedStart':finishes?'finishOverdue':/\b(?:delayed|delay|late|overdue|behind|delaying)\b/.test(q)?'scheduleDelayed':null;
    if(field){scopedFilter(['activities'],{field,operator:'eq',value:true,upper:null});plan.rankBy=starts?'startOverdueCalendarDays':'finishOverdueCalendarDays';plan.rankDirection='desc';
      if(field==='scheduleDelayed'&&catalogue.some(c=>c.id==='float')){plan.authorities.push('float');scopedFilter(['float'],{field:'totalFloatHours',operator:'lt',value:0,upper:null});}
    }
    else if(/\bnot started\b/.test(q))scopedFilter(['activities'],{field:'status',operator:'eq',value:'not_started',upper:null});
  }
  if(/near[ -]critical/.test(q))scopedFilter(['activities','float'],{field:'criticality',operator:'eq',value:'near_critical',upper:null});
  else if(/float[ -]risk/.test(q)&&!plan.criticalOnly)scopedFilter(['activities','float'],{field:'floatRiskWatchlist',operator:'eq',value:true,upper:null});
  const threshold=/(?:float\s*(?:below|under|less than|<)\s*|(?:below|under|less than)\s*)(-?\d+(?:\.\d+)?)\s*(hours?|days?)?\s*(?:float)?/.exec(q);
  if(/negative[ -]float/.test(q))scopedFilter(['activities','float'],{field:'totalFloatHours',operator:'lt',value:0,upper:null});
  else if(threshold&&/float/.test(q)){if(threshold[2]?.startsWith('day'))gaps.push('Float is stored in hours. Supply the threshold in hours; no hours-per-day conversion has been assumed.');else scopedFilter(['activities','float'],{field:'totalFloatHours',operator:'lt',value:Number(threshold[1]),upper:null});}
  if(/\bncrs?\b/.test(q))scopedFilter(['quality'],{field:'recordType',operator:'eq',value:'ncr',upper:null});
  if(/\b(?:open|late|overdue)\b/.test(q)){const status=/\b(open|late|overdue)\b/.exec(q)![1]!;scopedFilter(plan.authorities.filter(id=>['quality','milestones','submittals','closeout','handover','permits','risks'].includes(id)),{field:status==='open'?'open':'late',operator:'eq',value:true,upper:null});}
  for(const dimension of ['discipline','location','floor','zone','supplier','wbs','trade','currency'])if(new RegExp('\\bby '+dimension+'\\b').test(q))plan.groupBy=[dimension==='wbs'?'wbsId':dimension==='trade'?'discipline':dimension];
  const location=/\bfor wbs\b/.test(q)?null:/\b(tower\s+[a-z0-9]+|building\s+[a-z0-9]+|block\s+[a-z0-9]+|floor\s+[a-z0-9]+|level\s+[a-z0-9]+|zone\s+[a-z0-9]+|area\s+[a-z0-9]+|work\s*front\s+[a-z0-9_-]+)\b/i.exec(question);
  if(location){
    const scopeFilter={field:'location',operator:'contains' as const,value:location[1]!,upper:null};
    const compoundActivityRequest=!inherited&&!claimsQuestion&&scheduleQuestion&&activityQuestion&&/\b(?:and|also|plus)\b/.test(q)&&/\b(?:delayed|late|overdue)\b/.test(q);
    if(compoundActivityRequest){
      // Keep the primary delayed-activity selection intact and create a
      // second independent result set for the requested spatial scope.
      plan.activityBreakouts=[...(plan.activityBreakouts??[]),{label:'Activities for '+location[1]!,filters:[scopeFilter]}];
    }else{
      plan.filters=plan.filters.filter(f=>f.field!=='location');plan.filters.push(scopeFilter);
    }
  }
  if(!/\bfor wbs\b/.test(q)&&/\bmep\b|\bmechanical\b|\belectrical\b|\bcivil\b/.test(q)){const value=/\b(mep|mechanical|electrical|civil)\b/.exec(q)![1]!;plan.filters=plan.filters.filter(f=>f.field!=='discipline');plan.filters.push({field:'discipline',operator:'contains',value,upper:null});}
  if(!inherited&&!claimsQuestion&&scheduleQuestion&&activityQuestion){
    const explicitScopes:Array<[string,RegExp]>=[
      ['phase',/\bphase\s+([a-z0-9_.\/-]+)/i],['section',/\bsection\s+([a-z0-9_.\/-]+)/i],['chainage',/\b(?:chainage|ch)\s+(\d+\+\d+(?:\.\d+)?)/i],
      ['workFront',/\bwork\s*front\s+([a-z0-9_.\/-]+)/i],['package',/\b(?:package|pkg)\s+([a-z0-9_.\/-]+)/i],['cbs',/\b(?:cbs|cost\s*code)\s+([a-z0-9_.\/-]+)/i],
      ['contractor',/\bcontractor\s+([a-z0-9][a-z0-9 &_.\/-]{1,40}?)(?=\s+(?:and|with|only|status|activities)|$)/i],
      ['subcontractor',/\bsubcontractor\s+([a-z0-9][a-z0-9 &_.\/-]{1,40}?)(?=\s+(?:and|with|only|status|activities)|$)/i],
      ['trade',/\btrade\s+([a-z0-9][a-z0-9 _\/-]{1,30}?)(?=\s+(?:and|with|only|activities)|$)/i],
      ['system',/\bsystem\s+([a-z0-9][a-z0-9 _\/-]{1,30}?)(?=\s+(?:and|with|only|activities)|$)/i]
    ];
    for(const [field,pattern] of explicitScopes){const hit=pattern.exec(question);if(hit?.[1]){plan.filters=plan.filters.filter(f=>f.field!==field);plan.filters.push({field,operator:'contains',value:hit[1].trim(),upper:null});}}
  }
  const currency=/^(SAR|AED|USD|EUR|GBP)$/i.exec(question.trim());if(currency){plan.filters=plan.filters.filter(f=>f.field!=='currency');plan.filters.push({field:'currency',operator:'eq',value:currency[1]!.toUpperCase(),upper:null});gaps.push('Currency filtering does not convert values. No exchange rate is assumed.');}
  const days=/next\s+(\d+)\s+days|القادمه\s+(\d+)/.exec(q);if(days)plan.nextDays=Math.min(3650,Number(days[1]??days[2]));
  const coverage=/(?:delivery|delivered|التسليم).*?(?:under|below|less than|اقل من)\s+(\d+(?:\.\d+)?)\s*%/.exec(q);if(coverage)plan.deliveryBelowPercent=Number(coverage[1]);
  const asOf=/(?:as of|at|on|before|position at|بتاريخ)\s+(\d{4}-\d{2}-\d{2})\b/.exec(q);
  if(asOf){const date=Date.parse(asOf[1]!);if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==asOf[1])throw new AskError(422,'invalid_reporting_date','Enter a valid historical cut-off date.');plan.asOf=asOf[1]!;plan.kind='historical';}
  else if(/what (was|did)|historical|time.machine|position at|as of|at \d{1,2} (?:january|february|march|april|may|june|july|august|september|october|november|december)/.test(q)){
    gaps.push('Confirm the historical cut-off as YYYY-MM-DD. A year or reporting date is missing; current values have not been substituted.');plan.kind='historical';plan.asOf='unresolved';
  }
  const groupingPrevious=inherited&&/^(?:group )?by wbs\b/.test(q);
  const priorSchedule=previous?.plan.authorities.some(id=>['activities','float','critical-path','project-diagnosis'].includes(id));
  const explainPrevious=inherited&&priorSchedule&&/^explain.*\b(?:these|those|they)\b/.test(q);
  const recipe=explainPrevious?'delay_diagnosis':groupingPrevious&&!priorSchedule?null:projectQuestionRecipe(q);
  if(recipe&&catalogue.some(c=>c.id==='project-diagnosis')&&plan.kind!=='historical'&&!/\bphases?\b/.test(q)){
    plan.questionRecipe=recipe;
    delete plan.diagnosisActivityFilters;
    if(recipe==='driving_path')plan.authorities=['critical-path'];
    else if(recipe==='delay_diagnosis')plan.authorities=['project-diagnosis','critical-path','activities','float'];
    else plan.authorities=['project-diagnosis'];
    if(recipe==='delay_diagnosis'){
      plan.authorityFilters??={};
      plan.authorityFilters.activities=[{field:'schedulePressure',operator:'eq',value:true,upper:null}];
      plan.authorityFilters.float=[{field:'totalFloatHours',operator:'lt',value:0,upper:null}];
      if(explainPrevious&&previous){
        plan.diagnosisActivityFilters=[...(previous.plan.authorityFilters?.activities??previous.plan.authorityFilters?.float??[])];
        if(previous.plan.criticalOnly)plan.diagnosisActivityFilters.push({field:'critical',operator:'eq',value:true,upper:null});
        if(previous.plan.authorities.length===1&&previous.plan.authorities[0]==='critical-path')plan.diagnosisActivityFilters.push({field:'onDrivingNetwork',operator:'eq',value:true,upper:null});
        plan.authorities=['project-diagnosis','activities'];plan.authorityFilters.activities=[...plan.diagnosisActivityFilters];plan.criticalOnly=false;
      }
    }
    if(recipe==='wbs_pressure'){
      plan.groupBy=[];
      if(groupingPrevious&&previous){
        plan.diagnosisActivityFilters=[...(previous.plan.authorityFilters?.activities??previous.plan.authorityFilters?.float??[])];
        if(previous.plan.criticalOnly)plan.diagnosisActivityFilters.push({field:'critical',operator:'eq',value:true,upper:null});
        if(previous.plan.authorities.length===1&&previous.plan.authorities[0]==='critical-path')plan.diagnosisActivityFilters.push({field:'onDrivingNetwork',operator:'eq',value:true,upper:null});
      }
      plan.criticalOnly=false;plan.rankBy=null;plan.rankings=[];plan.limit=null;
    }
    if(['management_actions','project_position','revision_change','no_change_outlook','milestone_exposure'].includes(recipe)){plan.rankBy=null;plan.rankings=[];plan.limit=null;}
  }
  if(/\bschedule pressure\b/.test(q)&&plan.authorities.includes('activities'))scopedFilter(['activities'],{field:'schedulePressure',operator:'eq',value:true,upper:null});
  const wbsFilter=/\bfor wbs\s+["']?([^"'?]+)["']?\??$/i.exec(question);
  if(wbsFilter){plan.filters=plan.filters.filter(f=>f.field!=='wbsId');plan.filters.push({field:'wbsId',operator:'eq',value:wbsFilter[1]!.trim(),upper:null});}
  if(wbsFilter&&(wbsDrill||/^show all schedule pressure activities for wbs\b/.test(q))){
    // A WBS row represents its preceding selection, not every activity in that WBS.
    // Keep the contributing filters and avoid generic "pressure" matching other registers.
    const selection=wbsDrill?previous!.plan.diagnosisActivityFilters:undefined;
    plan.authorities=['activities'];plan.kind='facts';plan.groupBy=[];plan.rankBy=null;plan.rankings=[];plan.limit=null;plan.criticalOnly=false;
    plan.authorityFilters={activities:selection?.length?[...selection]:[{field:'schedulePressure',operator:'eq',value:true,upper:null}]};
    delete plan.questionRecipe;delete plan.diagnosisActivityFilters;
  }
  const scenario=recipe!=='no_change_outlook'&&/assume|what if|scenario|افترض/.test(q);
  if(scenario){plan.kind='scenario';const lead=/(\d+(?:\.\d+)?)\s*(weeks?|days?)/.exec(q);if(lead)plan.scenario={field:'manufacturingLeadTime',value:Number(lead[1]),unit:lead[2]!.startsWith('week')?'weeks':'days',target:/transformer/.test(q)?'transformer':null};else gaps.push('The scenario assumption needs a numeric duration and its unit.');}
  for(const metric of ['cpi','spi','ev','pv','ac'])if(new RegExp('\\b'+metric+'\\b').test(q))plan.metricIds.push(metric);
  if(/\bphases?\b/.test(q)&&catalogue.some(c=>c.id==='phase-programmes')){plan.authorities=['phase-programmes'];plan.criticalOnly=false;plan.countRows=false;plan.groupBy=[];plan.rankBy=null;plan.limit=null;gaps.push('Phase requests use separate phase programme positions. Whole-project KPI values are not substituted for phase metrics; combined phase roll-ups are not established.');}
  plan.authorities=[...new Set(plan.authorities)];plan.metricIds=[...new Set(plan.metricIds)];
  if(plan.kind==='proposal')gaps.push('This is a proposed change only. Use the record’s governed review workflow to approve any change.');
  return {plan,presentation,gaps,inherited,purePresentation:inherited&&(simpleFollowup||purePresentation)&&!fullList};
}

/** Model proposals are untrusted query plans, never executable code or authority. */
export function validateProposedPlan(value:unknown,base:AnalysisPlan,catalogue:AuthorityDescriptor[]):AnalysisPlan{
  if(!value||typeof value!=='object')throw new Error('Invalid analysis plan');const p=value as Record<string,unknown>;
  const ids=new Set(catalogue.map(c=>c.id)),fields=new Set(catalogue.flatMap(c=>c.fields));
  if(!Array.isArray(p.authorities)||!p.authorities.length||p.authorities.some(id=>typeof id!=='string'||!ids.has(id)))throw new Error('Unregistered or unauthorized authority');
  const plan=structuredClone(base);plan.authorities=[...new Set([...base.authorities,...p.authorities as string[]])];
  if(Array.isArray(p.filters)){if(p.filters.length>12)throw new Error('Too many filters');const proposed=p.filters.map((f:any)=>{if(!f||!fields.has(f.field)||!['eq','contains','lt','lte','gt','gte','between'].includes(f.operator)||!['string','number','boolean'].includes(typeof f.value)||typeof f.value==='number'&&!Number.isFinite(f.value))throw new Error('Unsupported filter');return {field:f.field,operator:f.operator,value:f.value,upper:typeof f.upper==='number'||typeof f.upper==='string'?f.upper:null};});plan.filters=[...base.filters,...proposed.filter((f:any)=>!base.filters.some(b=>b.field===f.field))];}
  if(Array.isArray(p.groupBy)){if(p.groupBy.some(f=>typeof f!=='string'||!fields.has(f)))throw new Error('Unsupported grouping');plan.groupBy=p.groupBy.length?p.groupBy as string[]:base.groupBy;}
  if(!base.rankBy&&typeof p.rankBy==='string'&&fields.has(p.rankBy))plan.rankBy=p.rankBy;
  if(!base.rankBy&&(p.rankDirection==='asc'||p.rankDirection==='desc'))plan.rankDirection=p.rankDirection;
  if(base.limit===null&&typeof p.limit==='number'&&Number.isInteger(p.limit)&&p.limit>0&&p.limit<=1000)plan.limit=p.limit;
  // Time, scenario, scope, identity, permissions and attachments are resolved by CMeng, never copied from model output.
  return plan;
}
