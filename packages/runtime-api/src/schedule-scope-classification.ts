import type {CanonicalScheduleActivity,CanonicalScheduleModel,CanonicalWbsNode} from '../../schedule-analysis-core/src';

export type ScopeClassificationBasis='source_wbs'|'source_activity_text'|'source_derived'|'unavailable';
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

const clean=(value:string)=>value.replace(/\s+/g,' ').trim();
const first=(text:string,patterns:RegExp[])=>{
  for(const pattern of patterns){const match=pattern.exec(text);if(match?.[1])return clean(match[1]);}
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
  ['Structural',[/\bstructur(?:al|e)\b/i,/\brebar\b/i,/\bconcrete\b/i,/\bsteel structure\b/i]],
  ['Architectural',[/\barchitectural\b/i,/\bfinishes?\b/i,/\bblockwork\b/i,/\bplaster\b/i,/\bceiling\b/i,/\btil(?:e|ing)\b/i]],
  ['Facade',[/\bfa[cç]ade\b/i,/\bcurtain wall\b/i,/\bcladding\b/i]],
  ['Civil',[/\bcivil\b/i,/\bearthworks?\b/i,/\broadworks?\b/i]],
  ['Infrastructure',[/\binfrastructure\b/i,/\butilities\b/i]],
  ['Landscape',[/\blandscap(?:e|ing)\b/i]],
  ['MEP',[/\bmep\b/i]]
];
function derivedDiscipline(text:string){
  const hits=disciplineRules.filter(([,patterns])=>patterns.some(pattern=>pattern.test(text))).map(([name])=>name);
  const specific=hits.filter(name=>name!=='MEP');
  if(specific.length===1)return specific[0]!;
  if(specific.length>1)return null;
  return hits.includes('MEP')?'MEP':null;
}
export function classifyScheduleActivity(model:CanonicalScheduleModel,activity:CanonicalScheduleActivity,nodes=new Map(model.wbs.map(node=>[node.wbsId,node]))):ActivityScopeClassification{
  const node=activity.wbsId?nodes.get(activity.wbsId):undefined;
  const hierarchy=wbsPath(node,nodes);
  const sourceText=clean([hierarchy.path,activity.name,activity.activityId].filter(Boolean).join(' | '));
  const wbsText=hierarchy.path??'';
  const activityText=clean([activity.name,activity.activityId].filter(Boolean).join(' | '));
  const pick=(label:string,patterns:RegExp[])=>{
    const fromWbs=first(wbsText,patterns);if(fromWbs)return {value:normalizedToken(label,fromWbs),basis:'source_wbs' as const};
    const fromActivity=first(activityText,patterns);if(fromActivity)return {value:normalizedToken(label,fromActivity),basis:'source_activity_text' as const};
    return {value:null,basis:'unavailable' as const};
  };
  const plot=pick('Plot',[/\bplot\s*[-:#]?\s*([a-z]?\d+[a-z]?)\b/i]);
  const zone=pick('Zone',[/\bzone\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i,/\bمنطق(?:ة|ه)\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu]);
  const floor=pick('Floor',[/\b(?:floor|flr|storey|story)\s*[-:#]?\s*(B?\d+[A-Z]?|G|GF|LG\d*|UG\d*|P\d*|RF|ROOF)\b/i,/\b(?:طابق|دور)\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu]);
  const level=pick('Level',[/\b(?:level|lvl)\s*[-:#]?\s*(B?\d+[A-Z]?|G|GF|LG\d*|UG\d*|P\d*|RF|ROOF)\b/i,/\bمستوى\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu]);
  const tower=pick('Tower',[/\btower\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i,/\bبرج\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu]);
  const building=pick('Building',[/\b(?:building|bldg|block)\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i,/\bمبنى\s*[-:#]?\s*([\p{L}\p{N}-]+)/iu]);
  const area=pick('Area',[/\barea\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z][a-z0-9 -]{1,30})\b/i]);
  const workFront=pick('Work Front',[/\bwork\s*front\s*[-:#]?\s*([a-z0-9][a-z0-9 _-]{0,30})\b/i,/\bworkfront\s*[-:#]?\s*([a-z0-9][a-z0-9 _-]{0,30})\b/i]);
  const phase=pick('Phase',[/\bphase\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,24})\b/i]);
  const section=pick('Section',[/\bsection\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,24})\b/i]);
  const chainage=pick('Chainage',[/\b(?:chainage|ch)\s*[-:#]?\s*(\d+\+\d+(?:\.\d+)?)\b/i]);
  const trade=pick('Trade',[/\btrade\s*[-:#]?\s*([a-z0-9][a-z0-9 _\/-]{0,30})\b/i]);
  const system=pick('System',[/\bsystem\s*[-:#]?\s*([a-z0-9][a-z0-9 _\/-]{0,30})\b/i]);
  const packageValue=pick('Package',[/\bpackage\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,30})\b/i,/\bpkg\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,30})\b/i]);
  const cbs=pick('CBS',[/\bcbs\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,30})\b/i,/\bcost\s*code\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,30})\b/i]);
  const subcontractor=pick('Subcontractor',[/\bsubcontractor\s*[-:#]?\s*([a-z0-9][a-z0-9 &_.\/-]{1,40})\b/i]);
  const contractor=pick('Contractor',[/\b(?<!sub)contractor\s*[-:#]?\s*([a-z0-9][a-z0-9 &_.\/-]{1,40})\b/i]);
  const discipline=derivedDiscipline(sourceText);
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
  const rows=activities.map(activity=>classifyScheduleActivity(model,activity,nodes));
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
  const coverage=dimensions.map(([key,label,basis])=>{const classified=rows.filter(row=>row[key]!==null).length;return {key,label,classified,total:rows.length,coveragePercent:rows.length?Number((classified/rows.length*100).toFixed(4)):null,basis};});
  const result={activityCount:rows.length,rows,coverage};classificationCache.set(model,result);return result;
}
