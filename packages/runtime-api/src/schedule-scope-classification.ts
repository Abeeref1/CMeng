import type {CanonicalScheduleActivity,CanonicalScheduleModel,CanonicalWbsNode} from '../../schedule-analysis-core/src';

export type ScopeClassificationBasis='source_wbs'|'source_activity_text'|'source_derived'|'user_reviewed'|'unavailable';
export interface ActivityScopeClassification {
  activityId:string;
  wbsId:string|null;
  wbsPath:string|null;
  wbsLevel:number|null;
  zone:string|null;
  floor:string|null;
  level:string|null;
  tower:string|null;
  building:string|null;
  area:string|null;
  workFront:string|null;
  phase:string|null;
  section:string|null;
  chainage:string|null;
  discipline:string|null;
  trade:string|null;
  system:string|null;
  package:string|null;
  cbs:string|null;
  contractor:string|null;
  subcontractor:string|null;
  plot:string|null;
  location:string|null;
  classificationBasis:Record<string,ScopeClassificationBasis>;
}
export interface ClassificationCoverage {
  key:keyof Omit<ActivityScopeClassification,'activityId'|'classificationBasis'>;
  label:string;
  classified:number;
  total:number;
  coveragePercent:number|null;
  basis:string;
}
export interface ScheduleScopeClassification {
  activityCount:number;
  rows:ActivityScopeClassification[];
  coverage:ClassificationCoverage[];
}

/** Group complete classification rows before HTTP response paging. */
export function scopeClassificationGroups(classification:ScheduleScopeClassification){
 return Object.fromEntries(classification.coverage.map(({key})=>{
  const counts=new Map<string,number>();
  let notGrouped=0;
  for(const row of classification.rows){const value=row[key];if(value!==null&&value!==undefined&&String(value).trim())counts.set(String(value),(counts.get(String(value))??0)+1);else notGrouped++;}
  // SW-27: activities matching no group are an explicit, counted bucket.
  return [key,{valueCount:counts.size,rows:[...counts].map(([value,activityCount])=>({value,activityCount})).sort((a,b)=>b.activityCount-a.activityCount||a.value.localeCompare(b.value)),
   notGrouped:{label:'Not grouped',activityCount:notGrouped}}];
 }));
}

const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
/** Required-literal prefilter. Each listed expression is case-insensitive
 * WITHOUT the `u` flag and not global/sticky. In that mode an ASCII letter of
 * the pattern matches only its two ASCII case forms (no non-ASCII character
 * canonicalizes to ASCII), and `toLowerCase` maps those to the lowercase ASCII
 * letter while keeping a contiguous ASCII run contiguous. So any match of the
 * expression puts one of its listed literals into `text.toLowerCase()`. When
 * none is present the expression cannot match and is skipped: same result as
 * running it. Expressions with no entry (the `u` Arabic readers) always run.
 * Proven per pattern by tests/t11-scope-literal-prefilter.test.ts. */
const requiredLiterals=new WeakMap<RegExp,readonly string[]>();
const withLiterals=(pattern:RegExp,...literals:string[])=>{requiredLiterals.set(pattern,literals);return pattern;};
const mayMatch=(pattern:RegExp,lowered:string|undefined)=>{
  if(lowered===undefined)return true;
  const literals=requiredLiterals.get(pattern);if(!literals)return true;
  for(const literal of literals)if(lowered.includes(literal))return true;
  return false;
};
const first=(text:string,patterns:RegExp[],lowered?:string)=>{
  for(const pattern of patterns){if(!mayMatch(pattern,lowered))continue;const match=pattern.exec(text);if(match?.[1])return clean(match[1]);}
  return null;
};
const normalizedToken=(label:string,value:string)=>clean(label+' '+value).replace(/\s+/g,' ');
function wbsPath(node:CanonicalWbsNode|undefined,nodes:Map<string,CanonicalWbsNode>){
  if(!node)return {path:null as string|null,level:null as number|null};
  const names:string[]=[];let current:CanonicalWbsNode|undefined=node;const seen=new Set<string>();
  while(current&&!seen.has(current.wbsId)){seen.add(current.wbsId);names.push(current.name??current.wbsId);current=current.parentWbsId?nodes.get(current.parentWbsId):undefined;}
  names.reverse();return {path:names.join(' > '),level:names.length||null};
}
const disciplineRules:[string,RegExp[]][]=[
  ['Electrical',[/\belectrical\b/i,/\blv\b/i,/\bmv\b/i,/\bhv\b/i,/\bswitchgear\b/i,/\btransformer\b/i]],
  ['Mechanical',[/\bmechanical\b/i,/\bhvac\b/i,/\bchiller\b/i,/\bahu\b/i,/\bfcu\b/i,/\bduct(?:work)?\b/i]],
  ['Plumbing',[/\bplumbing\b/i,/\bdrainage\b/i,/\bwater supply\b/i]],
  ['Fire Fighting',[/\bfire[ -]?fighting\b/i,/\bsprinkler\b/i,/\bfire pump\b/i]],
  ['Fire Alarm',[/\bfire alarm\b/i]],
  ['ELV',[/\belv\b/i,/\bextra low voltage\b/i,/\bcctv\b/i,/\baccess control\b/i,/\bstructured cabling\b/i]],
  ['ICT',[/\bict\b/i,/\binformation (?:and |& )?communications? technology\b/i]],
  ['Automation',[/\bautomation\b/i,/\bscada\b/i,/\bprogrammable logic controller\b/i]],
  ['Process',[/\bprocess (?:engineering|systems?|equipment|piping|activity)\b/i,/(?:^|[|>])\s*process\s*(?:$|[|>])/i,/\bclean utilities\b/i]],
  ['Structural',[/\bstructur(?:al|e)\b/i,/\brebar\b/i,/\bconcrete\b/i,/\bsteel structure\b/i]],
  ['Architectural',[/\barchitectural\b/i,/\bfinishes?\b/i,/\bblockwork\b/i,/\bplaster\b/i,/\bceiling\b/i,/\btil(?:e|ing)\b/i]],
  ['Facade',[/\bfa[cç]ade\b/i,/\bcurtain wall\b/i,/\bcladding\b/i]],
  ['Civil',[/\bcivil\b/i,/\bearthworks?\b/i,/\broadworks?\b/i]],
  ['Infrastructure',[/\binfrastructure\b/i,/(?<!clean )\butilities\b/i]],
  ['Landscape',[/\blandscap(?:e|ing)\b/i]],
  ['MEP',[/\bmep\b/i]]
];
/** Per rule, one literal per source pattern above (same order) that every match
 * of that pattern contains, lowercase ASCII. The rule's joined matcher can only
 * match when one of these is in the lowercased text (see requiredLiterals). */
const disciplineRuleLiterals:Record<string,readonly string[]>={
  'Electrical':['electrical','lv','mv','hv','switchgear','transformer'],
  'Mechanical':['mechanical','hvac','chiller','ahu','fcu','duct'],
  'Plumbing':['plumbing','drainage','water supply'],
  'Fire Fighting':['fire','sprinkler','fire pump'],
  'Fire Alarm':['fire alarm'],
  'ELV':['elv','extra low voltage','cctv','access control','structured cabling'],
  'ICT':['ict','information'],
  'Automation':['automation','scada','programmable logic controller'],
  'Process':['process','process','clean utilities'],
  'Structural':['structur','rebar','concrete','steel structure'],
  'Architectural':['architectural','finish','blockwork','plaster','ceiling','til'],
  'Facade':['ade','curtain wall','cladding'],
  'Civil':['civil','earthwork','roadwork'],
  'Infrastructure':['infrastructure','utilities'],
  'Landscape':['landscap'],
  'MEP':['mep'],
};
// One alternation per rule. None of these expressions is global/sticky or has
// capture groups, so `rule.test(text)` is true exactly when some single
// pattern of that rule matches: identical hits with one scan per rule.
const disciplineRuleMatchers:[string,RegExp][]=disciplineRules.map(([name,patterns])=>
  [name,withLiterals(new RegExp(patterns.map(pattern=>'(?:'+pattern.source+')').join('|'),'i'),...disciplineRuleLiterals[name]!)]);
function derivedDiscipline(text:string,lowered?:string){
  // Same rule order and outcome as collecting every hit, without three arrays
  // per activity. `test` on these non-global expressions has no side effect,
  // so stopping once a second specific discipline matches (always ambiguous,
  // null) cannot change the result.
  let specific:string|null=null,specificCount=0,mep=false;
  for(const [name,matcher] of disciplineRuleMatchers){
    if(!mayMatch(matcher,lowered)||!matcher.test(text))continue;
    if(name==='MEP'){mep=true;continue;}
    if(++specificCount>1)return null;
    specific=name;
  }
  if(specificCount===1)return specific!;
  return mep?'MEP':null;
}
/** Immutable regex definitions: they contain no global/sticky expressions.
 * Reusing these source rules avoids allocating the same ~20 spatial readers for
 * every activity in cold 8k–100k-row schedule and Delivery classification.
 * No classification, WBS precedence, missing state, or source mutation changes.
 */
const sourceScopePatterns={
  plot: [withLiterals(/\bplot\s*[-:#]?\s*([a-z]?\s*\d+[a-z]?)\b/i,'plot')],
  zone: [withLiterals(/\bzone\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i,'zone'),/\bمنطق(?:ة|ه)\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu],
  floor: [withLiterals(/\b(?:floor|flr|storey|story)\s*[-:#]?\s*(B?\d+[A-Z]?|G|GF|LG\d*|UG\d*|P\d*|RF|ROOF)\b/i,'floor','flr','storey','story'),/\b(?:طابق|دور)\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu],
  level: [withLiterals(/\b(?:level|lvl)\s*[-:#]?\s*(B?\d+[A-Z]?|G|GF|LG\d*|UG\d*|P\d*|RF|ROOF)\b/i,'level','lvl'),/\bمستوى\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu],
  tower: [withLiterals(/\btower\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i,'tower'),/\bبرج\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu],
  building: [withLiterals(/\b(?:building|bldg|block)\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i,'building','bldg','block'),/\bمبنى\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu],
  area: [withLiterals(/\barea\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z][a-z0-9 -]{1,30})\b/i,'area')],
  workFront: [withLiterals(/\bwork\s*front\s*[-:#]?\s*([a-z0-9][a-z0-9 _-]{0,30})\b/i,'front'),withLiterals(/\bworkfront\s*[-:#]?\s*([a-z0-9][a-z0-9 _-]{0,30})\b/i,'workfront')],
  phase: [withLiterals(/\bphase\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,24})\b/i,'phase')],
  section: [withLiterals(/\bsection\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,24})\b/i,'section')],
  chainage: [withLiterals(/\b(?:chainage|ch)\s*[-:#]?\s*(\d+\+\d+(?:\.\d+)?)\b/i,'ch')],
  trade: [withLiterals(/\btrade\s*[-:#]?\s*([a-z0-9][a-z0-9 _\/-]{0,30})\b/i,'trade')],
  system: [withLiterals(/\bsystem\b\s*[-:#]?\s*([a-z]*\d+[a-z0-9_.\/-]*)\b/i,'system'),withLiterals(/\bsystem\b\s*[-:#]\s*([a-z0-9][a-z0-9 _\/-]{0,30})\b/i,'system')],
  packageValue: [withLiterals(/\bpackage\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,30})\b/i,'package'),withLiterals(/\bpkg\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,30})\b/i,'pkg')],
  cbs: [withLiterals(/\bcbs\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,30})\b/i,'cbs'),withLiterals(/\bcost\s*code\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,30})\b/i,'cost')],
  subcontractor: [withLiterals(/\bsubcontractor\s*[-:#]?\s*([a-z0-9][a-z0-9 &_.\/-]{1,40})\b/i,'subcontractor')],
  contractor: [withLiterals(/\b(?<!sub)contractor\s*[-:#]?\s*([a-z0-9][a-z0-9 &_.\/-]{1,40})\b/i,'contractor')],
};
/** Test hook only: every prefiltered expression with its required literals. */
export function scopeLiteralPrefilterRulesForTest():{pattern:RegExp;literals:readonly string[];source:string}[]{
  const rows:{pattern:RegExp;literals:readonly string[];source:string}[]=[];
  for(const [label,patterns] of Object.entries(sourceScopePatterns))for(const pattern of patterns)rows.push({pattern,literals:requiredLiterals.get(pattern)??[],source:label});
  for(const [name,pattern] of disciplineRuleMatchers)rows.push({pattern,literals:requiredLiterals.get(pattern)??[],source:'discipline:'+name});
  for(const [name,patterns] of disciplineRules)patterns.forEach((pattern,index)=>rows.push({pattern,literals:[disciplineRuleLiterals[name]![index]!],source:'discipline-part:'+name+':'+index}));
  return rows;
}

export function classifyScheduleActivity(model:CanonicalScheduleModel,activity:CanonicalScheduleActivity,nodes=new Map(model.wbs.map(node=>[node.wbsId,node])),
  pathCache?:Map<string,ReturnType<typeof wbsPath>>,
  wbsPickCache?:Map<string,Map<string,string|null>>,
  wbsDisciplineCache?:Map<string,string|null>):ActivityScopeClassification{
  const node=activity.wbsId?nodes.get(activity.wbsId):undefined;
  const hierarchy=node&&pathCache?.has(node.wbsId)?pathCache.get(node.wbsId)!:wbsPath(node,nodes);
  if(node&&pathCache&&!pathCache.has(node.wbsId))pathCache.set(node.wbsId,hierarchy);
  const wbsText=hierarchy.path??'';
  const activityText=clean([activity.name,activity.activityId].filter(Boolean).join(' | '));
  const activityLowered=activityText.toLowerCase();
  const pick=(label:string,patterns:RegExp[])=>{
    // The same WBS source text is shared across hundreds of activities.
    // Cache only during this single classification pass; never across edits.
    let fromWbs:string|null;
    if(node&&wbsPickCache){
      const memo=wbsPickCache.get(node.wbsId)??new Map<string,string|null>();
      if(!wbsPickCache.has(node.wbsId))wbsPickCache.set(node.wbsId,memo);
      if(memo.has(label))fromWbs=memo.get(label)!;
      else{fromWbs=first(wbsText,patterns);memo.set(label,fromWbs);}
    }else fromWbs=first(wbsText,patterns);
    if(fromWbs)return {value:normalizedToken(label,fromWbs),basis:'source_wbs' as const};
    const fromActivity=first(activityText,patterns,activityLowered);if(fromActivity)return {value:normalizedToken(label,fromActivity),basis:'source_activity_text' as const};
    return {value:null,basis:'unavailable' as const};
  };
  const plot=pick('Plot',sourceScopePatterns.plot);
  const zone=pick('Zone',sourceScopePatterns.zone);
  const floor=pick('Floor',sourceScopePatterns.floor);
  const level=pick('Level',sourceScopePatterns.level);
  const tower=pick('Tower',sourceScopePatterns.tower);
  const building=pick('Building',sourceScopePatterns.building);
  const area=pick('Area',sourceScopePatterns.area);
  const workFront=pick('Work Front',sourceScopePatterns.workFront);
  const phase=pick('Phase',sourceScopePatterns.phase);
  const section=pick('Section',sourceScopePatterns.section);
  const chainage=pick('Chainage',sourceScopePatterns.chainage);
  const trade=pick('Trade',sourceScopePatterns.trade);
  const system=pick('System',sourceScopePatterns.system);
  const packageValue=pick('Package',sourceScopePatterns.packageValue);
  const cbs=pick('CBS',sourceScopePatterns.cbs);
  const subcontractor=pick('Subcontractor',sourceScopePatterns.subcontractor);
  const contractor=pick('Contractor',sourceScopePatterns.contractor);
  // The specific task or nearest WBS wins over a broad multi-discipline parent.
  // A parent containing both civil and MEP work must not erase a clear task label.
  // Task wording has precedence. When it cannot establish one discipline,
  // hundreds of activities in the same WBS previously repeated identical
  // parent-path splits and all discipline regex checks. Cache only the source
  // WBS fallback within this one immutable classification calculation.
  const explicitDiscipline=derivedDiscipline(activityText,activityLowered);
  let parentDiscipline:string|null=null;
  if(!explicitDiscipline){
    if(node&&wbsDisciplineCache?.has(node.wbsId))parentDiscipline=wbsDisciplineCache.get(node.wbsId)!;
    else{
      parentDiscipline=wbsText.split(' > ').reverse().map(segment=>derivedDiscipline(segment)).find(Boolean)??null;
      if(node&&wbsDisciplineCache)wbsDisciplineCache.set(node.wbsId,parentDiscipline);
    }
  }
  const discipline=explicitDiscipline??parentDiscipline;
  const spatial=[plot.value,tower.value,building.value,area.value,zone.value,floor.value,level.value,section.value,chainage.value,workFront.value].filter(Boolean) as string[];
  const basis:Record<string,ScopeClassificationBasis>={
    wbsId:activity.wbsId?'source_wbs':'unavailable',wbsPath:hierarchy.path?'source_wbs':'unavailable',wbsLevel:hierarchy.level?'source_wbs':'unavailable',
    plot:plot.basis,zone:zone.basis,floor:floor.basis,level:level.basis,tower:tower.basis,building:building.basis,area:area.basis,workFront:workFront.basis,
    phase:phase.basis,section:section.basis,chainage:chainage.basis,discipline:discipline?'source_derived':'unavailable',trade:trade.basis,system:system.basis,
    package:packageValue.basis,cbs:cbs.basis,contractor:contractor.basis,subcontractor:subcontractor.basis,location:spatial.length?'source_derived':'unavailable'
  };
  return {activityId:activity.activityId,wbsId:activity.wbsId,wbsPath:hierarchy.path,wbsLevel:hierarchy.level,zone:zone.value,floor:floor.value,level:level.value,tower:tower.value,building:building.value,area:area.value,workFront:workFront.value,
    phase:phase.value,section:section.value,chainage:chainage.value,discipline,trade:trade.value,system:system.value,package:packageValue.value,cbs:cbs.value,contractor:contractor.value,subcontractor:subcontractor.value,
    plot:plot.value,location:spatial.length?spatial.join(' / '):null,classificationBasis:basis};
}
const classificationCache=new WeakMap<CanonicalScheduleModel,ScheduleScopeClassification>();
export function scheduleScopeClassification(model:CanonicalScheduleModel):ScheduleScopeClassification{
  const cached=classificationCache.get(model);if(cached)return cached;
  const nodes=new Map(model.wbs.map(node=>[node.wbsId,node]));
  const activities=model.activities.filter(activity=>!['level_of_effort','wbs_summary'].includes(activity.activityType));
  const pathCache=new Map<string,ReturnType<typeof wbsPath>>();
  const wbsPickCache=new Map<string,Map<string,string|null>>();
  const wbsDisciplineCache=new Map<string,string|null>();
  const rows=activities.map(activity=>classifyScheduleActivity(model,activity,nodes,pathCache,wbsPickCache,wbsDisciplineCache));
  const dimensions:[ClassificationCoverage['key'],string,string][]=[
    ['plot','Plot','Explicit plot identifier in WBS or activity text'],
    ['wbsId','WBS','Explicit activity WBS resolved to the source WBS hierarchy'],
    ['wbsPath','WBS path','Source WBS parent hierarchy'],
    ['wbsLevel','WBS hierarchy level','Root level is 1 and depth follows source parent relationships'],
    ['zone','Zone','Explicit Zone wording found in source WBS or activity text'],
    ['floor','Floor','Explicit Floor/Storey wording found in source WBS or activity text'],
    ['level','Level','Explicit Level wording found in source WBS or activity text'],
    ['tower','Tower','Explicit Tower wording found in source WBS or activity text'],
    ['building','Building','Explicit Building/Block wording found in source WBS or activity text'],
    ['area','Area','Explicit Area wording found in source WBS or activity text'],
    ['workFront','Work front','Explicit Work Front wording found in source WBS or activity text'],
    ['phase','Phase','Explicit Phase wording found in source WBS or activity text'],
    ['section','Section','Explicit Section wording found in source WBS or activity text'],
    ['chainage','Chainage','Explicit Chainage/CH wording found in source WBS or activity text'],
    ['discipline','Discipline','Deterministic source-text classification from WBS/activity terminology; ambiguous multi-discipline rows remain unclassified'],
    ['trade','Trade','Explicit Trade wording found in source WBS or activity text'],
    ['system','System','Explicit System wording found in source WBS or activity text'],
    ['package','Package','Explicit Package/PKG wording found in source WBS or activity text'],
    ['cbs','CBS / cost code','Explicit CBS/Cost Code wording found in source WBS or activity text; no WBS-to-CBS allocation is invented'],
    ['contractor','Contractor','Explicit Contractor wording found in source WBS or activity text'],
    ['subcontractor','Subcontractor','Explicit Subcontractor wording found in source WBS or activity text'],
    ['location','Location','Composite of explicit source-derived spatial classifications']
  ];
  const coverage=dimensions.map(([key,label,basis])=>{let classified=0;for(const row of rows)if(row[key]!==null)classified++;return {key,label,classified,total:rows.length,coveragePercent:rows.length?Number((classified/rows.length*100).toFixed(4)):null,basis};});
  const result={activityCount:rows.length,rows,coverage};classificationCache.set(model,result);return result;
}
