import type {ProjectRuntimeState} from './project-state-types';
import {resolveBoqSource,suppliedBoqFigures} from './boq-source';
import {projectControlSchedule} from './canonical-time-claims';

type Priority='Critical'|'High'|'Medium'|'Low';
type Basis='source_text'|'source_section'|'source_derived'|'professional_assessment'|'unavailable';
export interface BoqScopeIntelligenceRow{
  itemId:string;itemNumber:string|null;section:string|null;description:string;unit:string|null;quantity:number|null;rate:number|null;amount:number|null;currency:string|null;sourceRefs:string[];
  building:string|null;tower:string|null;zone:string|null;floor:string|null;level:string|null;area:string|null;sectionScope:string|null;chainage:string|null;
  discipline:string|null;trade:string|null;system:string|null;packageCandidate:string|null;itemClass:string|null;
  longLeadCandidate:boolean;procurementPriority:Priority|null;criticalScopeCandidate:boolean;
  classificationBasis:Record<string,Basis>;
}
export interface BoqCandidatePackage{
  package:string;discipline:string|null;system:string|null;itemCount:number;currency:string|null;readableValue:number|null;
  longLeadItemCount:number;criticalItemCount:number;priority:Priority;basis:string;
}
export interface BoqCandidateRisk{
  riskId:string;category:'procurement'|'construction'|'design';risk:string;impact:string;probability:'Professional assessment';severity:Priority;
  mitigation:string;responsibleParty:string;basis:string;relatedPackages:string[];
}
const clean=(v:string)=>v.normalize('NFKC').replace(/\s+/g,' ').trim();
const first=(text:string,patterns:RegExp[])=>{for(const p of patterns){const m=p.exec(text);if(m?.[1])return clean(m[1]);}return null;};
const token=(label:string,value:string|null)=>value?label+' '+clean(value):null;
const pick=(section:string,text:string,label:string,patterns:RegExp[])=>{
 const a=first(section,patterns);if(a)return {value:token(label,a),basis:'source_section' as const};
 const b=first(text,patterns);if(b)return {value:token(label,b),basis:'source_text' as const};
 return {value:null,basis:'unavailable' as const};
};
const disciplineRules:Array<[string,RegExp[]]>= [
 ['Vertical Transportation',[/\belevators?\b/i,/\blifts?\b/i,/\bescalators?\b/i,/\bvertical transportation\b/i]],
 ['Fire Alarm',[/\bfire alarm\b/i,/\baddressable fire\b/i]],
 ['Fire Fighting',[/\bfire ?fighting\b/i,/\bsprinklers?\b/i,/\bfire pumps?\b/i,/\bhydrants?\b/i]],
 ['ELV',[/\belv\b/i,/\bcctv\b/i,/\baccess control\b/i,/\bstructured cabling\b/i,/\bpublic address\b/i,/\bpa system\b/i]],
 ['Electrical',[/\belectrical\b/i,/\bswitchgear\b/i,/\btransformers?\b/i,/\bgenerators?\b/i,/\bups\b/i,/\b(?:lv|mv|hv)\b/i,/\blighting\b/i,/\bcable tray\b/i,/\bcable laying\b/i]],
 ['Mechanical',[/\bmechanical\b/i,/\bhvac\b/i,/\bchillers?\b/i,/\bahus?\b/i,/\bfcus?\b/i,/\bfans?\b/i,/\bduct(?:work)?\b/i,/\bchilled water\b/i]],
 ['Plumbing',[/\bplumbing\b/i,/\bdrainage\b/i,/\bwater supply\b/i,/\bsanitary\b/i,/\bsewage\b/i]],
 ['Facade',[/\bfa[cç]ade\b/i,/\bcurtain wall\b/i,/\bcladding\b/i,/\bglazing\b/i]],
 ['Structural',[/\bstructural\b/i,/\brebar\b/i,/\breinforcement\b/i,/\bconcrete\b/i,/\bstructural steel\b/i,/\bpost[- ]?tension\b/i]],
 ['Architectural',[/\barchitectural\b/i,/\bfinishes?\b/i,/\bblockwork\b/i,/\bplaster\b/i,/\bceilings?\b/i,/\btiles?\b/i,/\bjoinery\b/i,/\bstone cladding\b/i,/\bdoors?\b/i]],
 ['Infrastructure',[/\binfrastructure\b/i,/\butility|utilities\b/i,/\broadworks?\b/i,/\bstormwater\b/i,/\bsewerage\b/i]],
 ['Landscape',[/\blandscap(?:e|ing)\b/i,/\birrigation\b/i]],
 ['Civil',[/\bcivil\b/i,/\bearthworks?\b/i,/\bexcavation\b/i,/\bbackfilling\b/i,/\bsubbase\b/i]]
];
const systemRules:Array<[string,RegExp[]]>= [
 ['Elevators / Lifts',[/\belevators?\b/i,/\blifts?\b/i]],
 ['Escalators',[/\bescalators?\b/i]],
 ['MV / HV Switchgear',[/\b(?:mv|hv)\s*switchgear\b/i,/\bswitchgear\b/i]],
 ['Transformers',[/\btransformers?\b/i]],
 ['Generators',[/\bgenerators?\b/i,/\bdiesel generator\b/i]],
 ['UPS',[/\bups\b/i,/\buninterruptible power\b/i]],
 ['Chillers',[/\bchillers?\b/i]],
 ['AHU',[/\bahus?\b/i,/\bair handling units?\b/i]],
 ['FCU',[/\bfcus?\b/i,/\bfan coil units?\b/i]],
 ['Pumps',[/\bpumps?\b/i]],
 ['BMS',[/\bbms\b/i,/\bbuilding management system\b/i]],
 ['Fire Alarm',[/\bfire alarm\b/i]],
 ['Curtain Wall / Facade',[/\bcurtain wall\b/i,/\bfa[cç]ade system\b/i,/\bunitized facade\b/i]],
 ['Structural Steel',[/\bstructural steel\b/i,/\bsteel structure\b/i]],
 ['Stone Cladding',[/\bstone cladding\b/i,/\bmarble cladding\b/i,/\bgranite cladding\b/i]],
 ['Special Equipment',[/\bspecial equipment\b/i,/\bspecialist equipment\b/i]]
];
const tradeRules:Array<[string,RegExp[]]>= [
 ['LV',[/\blv\b/i,/\blow voltage\b/i]],['MV',[/\bmv\b/i,/\bmedium voltage\b/i]],['HV',[/\bhv\b/i,/\bhigh voltage\b/i]],
 ['HVAC',[/\bhvac\b/i,/\bchiller\b/i,/\bahu\b/i,/\bfcu\b/i,/\bduct\b/i]],['Wet Services',[/\bplumbing\b/i,/\bdrainage\b/i,/\bwater supply\b/i]],
 ['Concrete',[/\bconcrete\b/i,/\bpcc\b/i]],['Rebar',[/\brebar\b/i,/\breinforcement\b/i]],['Blockwork',[/\bblockwork\b/i]],['Finishes',[/\bfinishes?\b/i,/\bplaster\b/i,/\btile\b/i,/\bceiling\b/i]]
];
function firstRule(text:string,rules:Array<[string,RegExp[]]>) {for(const [name,patterns] of rules)if(patterns.some(p=>p.test(text)))return name;return null;}
function systemPriority(system:string|null,description:string):Priority|null{
 const t=(system??'')+' '+description;
 if(/Elevators|Escalators|Switchgear|Transformers|Generators|Chillers|Curtain Wall|Facade/i.test(t))return 'Critical';
 if(/AHU|FCU|Pumps|BMS|Fire Alarm|Structural Steel|Stone Cladding|UPS|Special Equipment/i.test(t))return 'High';
 if(/equipment|specialist|imported|custom|mock-?up/i.test(t))return 'Medium';
 return null;
}
function packageName(discipline:string|null,system:string|null,section:string|null){
 if(system)return system+' package';
 if(discipline)return discipline+' works';
 const s=section?.trim();return s?s.length>80?s.slice(0,80):s:null;
}
function aggregate(rows:BoqScopeIntelligenceRow[],field:keyof BoqScopeIntelligenceRow,label:string){
 const groups=new Map<string,{dimension:string;value:string;currency:string|null;itemCount:number;readableValue:number|null;readableAmountCount:number}>();
 for(const row of rows){const v=row[field];if(typeof v!=='string'||!v)continue;const key=v+'|'+(row.currency??'');const g=groups.get(key)??{dimension:label,value:v,currency:row.currency,itemCount:0,readableValue:0,readableAmountCount:0};g.itemCount++;if(typeof row.amount==='number'){g.readableValue=(g.readableValue??0)+row.amount;g.readableAmountCount++;}groups.set(key,g);}
 return [...groups.values()].map(g=>({...g,readableValue:g.readableAmountCount?Number((g.readableValue??0).toFixed(2)):null})).sort((a,b)=>String(a.currency).localeCompare(String(b.currency))-(0)||((b.readableValue??-Infinity)-(a.readableValue??-Infinity))||a.value.localeCompare(b.value));
}
export function boqScopeIntelligence(state:ProjectRuntimeState){
 const revision=projectControlSchedule(state)?.revision.revisionId??'';
 const source=resolveBoqSource(state,revision),figures=suppliedBoqFigures(source.boq,source.quantities);
 const base=figures.rows;
 const currencyTotals=new Map<string,number>();for(const r of base)if(r.currency&&typeof r.amount==='number')currencyTotals.set(r.currency,(currencyTotals.get(r.currency)??0)+r.amount);
 const rows:BoqScopeIntelligenceRow[]=base.map(r=>{
   const section=clean(r.section??''),desc=clean(r.description??''),text=clean(section+' | '+desc+' | '+(r.itemNumber??''));
   const tower=pick(section,desc,'Tower',[/\btower\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i]);
   const building=pick(section,desc,'Building',[/\b(?:building|bldg|block)\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i]);
   const zone=pick(section,desc,'Zone',[/\bzone\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z])\b/i]);
   const floor=pick(section,desc,'Floor',[/\b(?:floor|flr|storey|story)\s*[-:#]?\s*(B?\d+[A-Z]?|G|GF|LG\d*|UG\d*|P\d*|RF|ROOF)\b/i]);
   const level=pick(section,desc,'Level',[/\b(?:level|lvl)\s*[-:#]?\s*(B?\d+[A-Z]?|G|GF|LG\d*|UG\d*|P\d*|RF|ROOF)\b/i]);
   const area=pick(section,desc,'Area',[/\barea\s*[-:#]?\s*([a-z]?\d+[a-z]?|[a-z][a-z0-9 _-]{1,30})\b/i]);
   const sec=pick(section,desc,'Section',[/\bsection\s*[-:#]?\s*([a-z0-9][a-z0-9_.\/-]{0,24})\b/i]);
   const chainage=pick(section,desc,'CH',[/\b(?:chainage|ch)\s*[-:#]?\s*(\d+\+\d+(?:\.\d+)?)\b/i]);
   const discipline=firstRule(text,disciplineRules),system=firstRule(text,systemRules),trade=firstRule(text,tradeRules);
   const priority=systemPriority(system,desc),longLeadCandidate=priority!==null;
   const packageCandidate=packageName(discipline,system,r.section);
   const total=r.currency?currencyTotals.get(r.currency)??null:null;
   const share=typeof r.amount==='number'&&typeof total==='number'&&total>0?r.amount/total:null;
   const criticalScopeCandidate=priority==='Critical'||(share!==null&&share>=0.05);
   return {...r,building:building.value,tower:tower.value,zone:zone.value,floor:floor.value,level:level.value,area:area.value,sectionScope:sec.value,chainage:chainage.value,
     discipline,trade,system,packageCandidate,itemClass:system?'Equipment / specialist system':discipline?'Construction scope':null,
     longLeadCandidate,procurementPriority:priority,criticalScopeCandidate,
     classificationBasis:{building:building.basis,tower:tower.basis,zone:zone.basis,floor:floor.basis,level:level.basis,area:area.basis,sectionScope:sec.basis,chainage:chainage.basis,
       discipline:discipline?'source_derived':'unavailable',trade:trade?'source_derived':'unavailable',system:system?'source_derived':'unavailable',packageCandidate:packageCandidate?'source_derived':'unavailable',
       longLeadCandidate:priority?'professional_assessment':'unavailable',criticalScopeCandidate:criticalScopeCandidate?'professional_assessment':'unavailable'}};
 });
 const packageMap=new Map<string,BoqCandidatePackage>();
 for(const row of rows){if(!row.packageCandidate)continue;const key=row.packageCandidate+'|'+(row.currency??'');const existing=packageMap.get(key)??{package:row.packageCandidate,discipline:row.discipline,system:row.system,itemCount:0,currency:row.currency,readableValue:0,longLeadItemCount:0,criticalItemCount:0,priority:'Low' as Priority,basis:'Candidate package derived from BOQ section/item descriptions; not a confirmed procurement register.'};existing.itemCount++;if(typeof row.amount==='number')existing.readableValue=(existing.readableValue??0)+row.amount;if(row.longLeadCandidate)existing.longLeadItemCount++;if(row.criticalScopeCandidate)existing.criticalItemCount++;const order:Priority[]=['Low','Medium','High','Critical'];const p=row.procurementPriority??(row.criticalScopeCandidate?'High':'Low');if(order.indexOf(p)>order.indexOf(existing.priority))existing.priority=p;packageMap.set(key,existing);}
 const packages=[...packageMap.values()].map(p=>({...p,readableValue:p.readableValue===0?null:Number((p.readableValue??0).toFixed(2))})).sort((a,b)=>String(a.currency).localeCompare(String(b.currency))||((b.readableValue??-Infinity)-(a.readableValue??-Infinity))||a.package.localeCompare(b.package));
 const longLead=rows.filter(r=>r.longLeadCandidate).sort((a,b)=>{const order:Priority[]=['Critical','High','Medium','Low'];return order.indexOf(a.procurementPriority??'Low')-order.indexOf(b.procurementPriority??'Low')||((b.amount??-Infinity)-(a.amount??-Infinity));});
 const risks:BoqCandidateRisk[]=[];
 const addRisk=(id:string,category:BoqCandidateRisk['category'],risk:string,impact:string,severity:Priority,mitigation:string,owner:string,packages:string[])=>{if(packages.length&&!risks.some(r=>r.riskId===id))risks.push({riskId:id,category,risk,impact,probability:'Professional assessment',severity,mitigation,responsibleParty:owner,basis:'Candidate management risk derived from BOQ scope; not a confirmed Project Risk Register entry.',relatedPackages:packages});};
 const packageNames=(pattern:RegExp)=>[...new Set(rows.filter(r=>pattern.test((r.system??'')+' '+(r.discipline??'')+' '+r.description)).map(r=>r.packageCandidate).filter((v):v is string=>!!v))];
 addRisk('boq-long-lead','procurement','Specialist or manufactured packages may require early procurement and approval.','Late award or manufacturing can constrain downstream installation and completion.','High','Confirm supplier lead times, submittal/approval durations and required-on-site dates.','Procurement / Package Manager',packages.filter(p=>p.longLeadItemCount>0).map(p=>p.package));
 addRisk('boq-facade-interface','design','Facade scope may require coordinated design, mock-ups, interfaces and specialist approvals.','Late design release can affect procurement, enclosure and finishes.','High','Establish facade design release, mock-up and procurement milestones.','Design / Facade Manager',packageNames(/Facade|Curtain Wall/i));
 addRisk('boq-mep-coordination','construction','MEP systems create coordination and commissioning interfaces across trades and locations.','Unresolved interfaces can reduce workfront productivity and delay testing/commissioning.','High','Coordinate system interfaces, builders work, access and commissioning sequence.','MEP Manager',packageNames(/Mechanical|Electrical|Plumbing|Fire|ELV|BMS/i));
 addRisk('boq-vertical-transport','procurement','Vertical transportation is specialist scope with design, manufacture, shaft interface and commissioning dependencies.','Late technical release or manufacture can affect handover and access strategy.','Critical','Confirm technical submissions, shaft readiness, manufacture and commissioning milestones.','Vertical Transportation / Procurement',packageNames(/Elevators|Escalators|Vertical Transportation/i));
 addRisk('boq-major-electrical','procurement','Major electrical equipment may depend on specialist manufacture, approvals, testing and energisation interfaces.','Late equipment or energisation can constrain commissioning and handover.','Critical','Confirm equipment lead times, approvals, FAT, delivery, installation and energisation milestones.','Electrical / Procurement',packageNames(/Switchgear|Transformer|Generator|UPS/i));
 const dimensions={discipline:aggregate(rows,'discipline','Discipline'),system:aggregate(rows,'system','System'),package:aggregate(rows,'packageCandidate','Package'),building:aggregate(rows,'building','Building'),tower:aggregate(rows,'tower','Tower'),zone:aggregate(rows,'zone','Zone'),floor:aggregate(rows,'floor','Floor'),level:aggregate(rows,'level','Level'),area:aggregate(rows,'area','Area')};
 const disciplineCount=new Set(rows.map(r=>r.discipline).filter(Boolean)).size,locationCount=new Set(rows.flatMap(r=>[r.building,r.tower,r.zone,r.floor,r.level,r.area]).filter(Boolean)).size,specialistCount=new Set(rows.map(r=>r.system).filter(Boolean)).size;
 const complexityScore=(disciplineCount>=6?2:disciplineCount>=3?1:0)+(specialistCount>=6?2:specialistCount>=2?1:0)+(locationCount>=10?2:locationCount>=3?1:0)+(longLead.length>=10?2:longLead.length>=3?1:0);
 const complexity=complexityScore>=6?'High':complexityScore>=3?'Medium':'Low';
 const topCostDrivers=[...currencyTotals.keys()].map(currency=>({currency,items:rows.filter(r=>r.currency===currency&&typeof r.amount==='number').sort((a,b)=>b.amount!-a.amount!).slice(0,20)}));
 return {source:source.selection,itemCount:figures.itemCount,rows,dimensions,packages,longLead,risks,topCostDrivers,complexity:{assessment:complexity,score:complexityScore,basis:'Professional assessment from BOQ discipline breadth, specialist systems, readable location complexity and candidate long-lead scope. It is not a contractual classification.'},
   coverage:{discipline:rows.filter(r=>r.discipline).length,system:rows.filter(r=>r.system).length,package:rows.filter(r=>r.packageCandidate).length,location:rows.filter(r=>r.building||r.tower||r.zone||r.floor||r.level||r.area).length,total:rows.length},
   basis:'BOQ scope intelligence uses only the selected BOQ section/item wording and readable quantities/amounts. Professional classifications remain separate from confirmed Project registers.'};
}
