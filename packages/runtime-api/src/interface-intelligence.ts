import {canonicalHeader,registerDate} from '../../truth-kernel/src';
import {deliveryRecords,deliveryCurrentRecord} from './delivery-records';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {scheduleAuthorityReview} from './schedule-authority';
import {contractCompletionDependencies,projectContractSections} from './project-contract-sections';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';
import type {DeliveryRecord} from '../../delivery-core/src/types';

const cleanText=(value:unknown)=>{if(value===null||value===undefined)return '';const text=String(value).trim();return /^(?:undefined|null|nan)$/i.test(text)?'':text;};
const field=(r:DeliveryRecord,...names:string[])=>{for(const name of names){const value=cleanText(r.fields[canonicalHeader(name)]);if(value)return value;}return '';};
const recordLabel=(value:unknown,fallback:string)=>cleanText(value)||fallback;
const current=deliveryCurrentRecord;
const closed=(value:string)=>/^(closed|resolved|accepted|complete|completed)$/i.test(value.trim());
const days=(later:string|null,earlier:string|null)=>later&&earlier&&Number.isFinite(Date.parse(later))&&Number.isFinite(Date.parse(earlier))?Math.round((Date.parse(later)-Date.parse(earlier))/86400000):null;

export interface InterfaceIntelligenceRow {
  interfaceId:string; authority:'confirmed'|'source'|'candidate'; state:'open'|'blocked'|'overdue'|'closed'|'candidate'|'unknown';
  givingParty:string|null; receivingParty:string|null; package:string|null; discipline:string|null; system:string|null; location:string|null;
  requiredDeliverable:string|null; requiredDate:string|null; currentStatus:string|null; responsibleParty:string|null; affectedWorkfront:string|null;
  linkedActivity:string|null; linkedRfi:string|null; linkedSubmittal:string|null; linkedRisk:string|null; consequence:string|null; escalation:string|null;
  packageIds:string[]; workfrontIds:string[]; sourceRecordIds:string[]; sourceRefs:string[];
}
export function interfaceIntelligence(state:ProjectRuntimeState){
  const source=deliveryRecords(state),records=source.records,governed=records.filter(current),byId=new Map(governed.map(r=>[r.recordId,r]));
  const programme=projectControlSchedule(state)?.revision.model??null,dataDateIso=projectDataDate(state);
  const activities=new Map(programme?.activities.map(a=>[a.activityId,a])??[]);
  const packages=governed.filter(r=>r.kind==='package'),workfronts=governed.filter(r=>r.kind==='workfront');
  const rows:InterfaceIntelligenceRow[]=[];
  const sections=projectContractSections(state,null,null);
  for(const dependency of contractCompletionDependencies(state)){const from=sections.find(s=>s.sectionId===dependency.fromSection),to=sections.find(s=>s.sectionId===dependency.toSection);rows.push({
    interfaceId:'Section '+dependency.fromSection+' → Section '+dependency.toSection,authority:'candidate',state:'candidate',
    givingParty:null,receivingParty:null,package:null,discipline:null,system:null,location:null,
    requiredDeliverable:'Completion of Section '+dependency.fromSection+' before Section '+dependency.toSection+' completion can be certified',
    requiredDate:to?.programmeCompletionIso?.slice(0,10)??null,currentStatus:'Contract-stated dependency; required date from programme, completion evidence needs review',responsibleParty:null,affectedWorkfront:'Section '+dependency.toSection,
    linkedActivity:[from?.milestoneId,to?.milestoneId].filter(Boolean).join('; ')||null,linkedRfi:null,linkedSubmittal:null,linkedRisk:null,
    consequence:'The contract explicitly makes completion of the receiving section dependent on completion of the preceding section.',
    escalation:from?.milestoneId&&to?.milestoneId?'Confirm the dated section completion certificates and responsible owner.':'Link the section milestones and dated completion certificates; confirm the responsible owner.',
    packageIds:[],workfrontIds:[],sourceRecordIds:[],sourceRefs:dependency.sourceRefs,
  });}
  for(const r of governed.filter(r=>r.kind==='interface')){
    const raw=field(r,'current status','status'),requiredDate=registerDate(field(r,'required date','due date'));
    const overdue=!!dataDateIso&&!!requiredDate&&requiredDate<dataDateIso&&!closed(raw);
    const blocked=/blocked|hold|stopped|unresolved/i.test(raw);
    const linkedKinds=(kind:string)=>r.links.recordIds.map(id=>byId.get(id)).filter(x=>x?.kind===kind).map(x=>x!.reference??x!.recordId);
    const pkgRefs=r.links.packageIds.map(id=>byId.get(id)?.reference??id),locRefs=r.links.locationIds.map(id=>byId.get(id)?.description??byId.get(id)?.reference??id);
    rows.push({interfaceId:recordLabel(r.reference,r.recordId),authority:r.state==='extracted_candidate'?'source':'confirmed',state:closed(raw)?'closed':overdue?'overdue':blocked?'blocked':raw?'open':'unknown',
      givingParty:field(r,'giving party')||null,receivingParty:field(r,'receiving party')||null,package:field(r,'package')||pkgRefs.map(x=>cleanText(x)).filter(Boolean).join('; ')||null,
      discipline:field(r,'discipline')||null,system:field(r,'system')||null,location:field(r,'location')||locRefs.join('; ')||null,
      requiredDeliverable:field(r,'required deliverable','description')||cleanText(r.description)||null,requiredDate,currentStatus:raw||null,
      responsibleParty:field(r,'responsible party','owner')||null,affectedWorkfront:field(r,'affected workfront')||null,
      linkedActivity:r.links.activityIds.join('; ')||null,linkedRfi:field(r,'linked rfi')||linkedKinds('design').join('; ')||null,
      linkedSubmittal:field(r,'linked submittal')||linkedKinds('submittal').join('; ')||null,linkedRisk:field(r,'linked risk')||r.links.riskIds.join('; ')||null,
      consequence:field(r,'consequence')||null,escalation:field(r,'escalation')||null,packageIds:[...r.links.packageIds],workfrontIds:r.links.recordIds.filter(id=>byId.get(id)?.kind==='workfront'),sourceRecordIds:[r.recordId],sourceRefs:r.receipts.map(x=>x.documentId+':'+x.locator)});
  }
  const explicitPairs=new Set(rows.flatMap(r=>r.sourceRecordIds));
  const byActivity=new Map<string,DeliveryRecord[]>();
  for(const p of packages)for(const id of p.links.activityIds){const list=byActivity.get(id)??[];list.push(p);byActivity.set(id,list);}
  const seen=new Set<string>();
  for(const [activityId,linked] of byActivity){
    if(linked.length<2)continue;
    for(let i=0;i<linked.length;i++)for(let j=i+1;j<linked.length;j++){
      const a=linked[i]!,b=linked[j]!,pair=[a.recordId,b.recordId].sort().join('|');if(seen.has(pair))continue;seen.add(pair);
      const activity=activities.get(activityId),workfront=workfronts.find(w=>w.links.activityIds.includes(activityId));
      const discipline=[field(a,'discipline'),field(b,'discipline')].filter(Boolean);
      const requiredDate=activity?.currentStartIso?.slice(0,10)??activity?.forecastStartIso?.slice(0,10)??null;
      rows.push({interfaceId:'candidate:'+pair,authority:'candidate',state:'candidate',givingParty:field(a,'owner')||null,receivingParty:field(b,'owner')||null,
        package:[recordLabel(a.reference,a.recordId),recordLabel(b.reference,b.recordId)].join(' ↔ '),discipline:[...new Set(discipline)].join(' / ')||null,system:null,
        location:[...new Set([...a.links.locationIds,...b.links.locationIds])].map(id=>byId.get(id)?.description??byId.get(id)?.reference??id).join(' / ')||null,
        requiredDeliverable:null,requiredDate,currentStatus:'Candidate interface — confirmation required',responsibleParty:null,affectedWorkfront:workfront?recordLabel(workfront.reference,cleanText(workfront.description)||workfront.recordId):null,
        linkedActivity:activityId,linkedRfi:null,linkedSubmittal:null,linkedRisk:[...new Set([...a.links.riskIds,...b.links.riskIds])].join('; ')||null,
        consequence:'Two confirmed packages converge on the same programme activity. This identifies an interface to review; it does not establish a blocker or responsibility.',
        escalation:'Confirm the giving/receiving deliverable, owner and required date before treating this interface as a management blocker.',
        packageIds:[a.recordId,b.recordId],workfrontIds:workfront?[workfront.recordId]:[],sourceRecordIds:[a.recordId,b.recordId],sourceRefs:[...a.receipts,...b.receipts].map(x=>x.documentId+':'+x.locator)});
    }
  }
  const confirmed=rows.filter(r=>r.authority!=='candidate'),candidates=rows.filter(r=>r.authority==='candidate'),open=confirmed.filter(r=>!['closed'].includes(r.state));
  const blockers=confirmed.filter(r=>['blocked','overdue'].includes(r.state));
  const overdue=confirmed.filter(r=>r.state==='overdue');
  const linkedActivityCount=new Set(rows.flatMap(r=>r.linkedActivity?r.linkedActivity.split(';').map(x=>x.trim()).filter(Boolean):[])).size;
  return {schemaVersion:'1.0',projectionKey:'interface_intelligence',projectId:state.projectId,projectVersion:state.version,dataDateIso,programmeRevisionId:programme?.sourceRevisionId??null,
    managementPosition:blockers.length?blockers.length+' confirmed interface'+(blockers.length===1?'':'s')+' require management action now. '+candidates.length+' additional interface candidate'+(candidates.length===1?' is':'s are')+' retained for review.':
      confirmed.length?open.length+' confirmed interfaces remain open; no confirmed overdue/blocked interface is established from the current records. '+candidates.length+' candidates require review.':
      candidates.length?candidates.length+' interfaces were identified from contract completion dependencies or package-to-activity relationships. Confirm ownership and completion evidence.':'No confirmed or derivable interface population is available from the current Project information.',
    rows,knownCount:confirmed.length,confirmedCount:rows.filter(r=>r.authority==='confirmed').length,candidateCount:candidates.length,openCount:open.length,blockerCount:blockers.length,overdueCount:overdue.length,linkedActivityCount,
    blockers,candidates,basis:'Confirmed interfaces come from Interface records. Other interfaces retain explicit contract completion dependencies or identify packages converging on the same programme activity. These links do not establish responsibility, causation or delay.'};
}
export function interfaceModule(state:ProjectRuntimeState):ModuleRuntimeResult{
  const data=interfaceIntelligence(state),has=data.rows.length>0;
  return {key:'delivery-interfaces',status:!has?'blocked':'partial',reason:data.managementPosition,dependencies:has?[]:['governed interface records or package-to-activity relationships'],scheduleAuthorityReview:scheduleAuthorityReview(state),data:{...data,title:'Interface Management',projectionKey:'delivery',deliveryPage:'delivery-interfaces',interfaceProjectionKey:data.projectionKey}};
}
