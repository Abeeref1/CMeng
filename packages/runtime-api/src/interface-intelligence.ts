import {canonicalHeader,registerDate} from '../../truth-kernel/src';
import {deliveryRecords} from './delivery-records';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {scheduleAuthorityReview} from './schedule-authority';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';
import type {DeliveryRecord} from '../../delivery-core/src/types';

const field=(r:DeliveryRecord,...names:string[])=>{for(const name of names){const value=r.fields[canonicalHeader(name)];if(value!==null&&value!==undefined&&String(value).trim())return String(value).trim();}return '';};
const current=(r:DeliveryRecord)=>r.state==='governed'||r.state==='verified';
const closed=(value:string)=>/^(closed|resolved|accepted|complete|completed)$/i.test(value.trim());
const days=(later:string|null,earlier:string|null)=>later&&earlier&&Number.isFinite(Date.parse(later))&&Number.isFinite(Date.parse(earlier))?Math.round((Date.parse(later)-Date.parse(earlier))/86400000):null;

export interface InterfaceIntelligenceRow {
  interfaceId:string; authority:'confirmed'|'candidate'; state:'open'|'blocked'|'overdue'|'closed'|'candidate'|'unknown';
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
  for(const r of governed.filter(r=>r.kind==='interface')){
    const raw=field(r,'current status','status'),requiredDate=registerDate(field(r,'required date','due date'));
    const overdue=!!dataDateIso&&!!requiredDate&&requiredDate<dataDateIso&&!closed(raw);
    const blocked=/blocked|hold|stopped|unresolved/i.test(raw);
    const linkedKinds=(kind:string)=>r.links.recordIds.map(id=>byId.get(id)).filter(x=>x?.kind===kind).map(x=>x!.reference??x!.recordId);
    const pkgRefs=r.links.packageIds.map(id=>byId.get(id)?.reference??id),locRefs=r.links.locationIds.map(id=>byId.get(id)?.description??byId.get(id)?.reference??id);
    rows.push({interfaceId:r.reference??r.recordId,authority:'confirmed',state:closed(raw)?'closed':overdue?'overdue':blocked?'blocked':raw?'open':'unknown',
      givingParty:field(r,'giving party')||null,receivingParty:field(r,'receiving party')||null,package:field(r,'package')||pkgRefs.join('; ')||null,
      discipline:field(r,'discipline')||null,system:field(r,'system')||null,location:field(r,'location')||locRefs.join('; ')||null,
      requiredDeliverable:field(r,'required deliverable','description')||r.description||null,requiredDate,currentStatus:raw||null,
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
        package:[a.reference??a.recordId,b.reference??b.recordId].join(' ↔ '),discipline:[...new Set(discipline)].join(' / ')||null,system:null,
        location:[...new Set([...a.links.locationIds,...b.links.locationIds])].map(id=>byId.get(id)?.description??byId.get(id)?.reference??id).join(' / ')||null,
        requiredDeliverable:null,requiredDate,currentStatus:'Candidate interface — confirmation required',responsibleParty:null,affectedWorkfront:workfront?.reference??workfront?.description??null,
        linkedActivity:activityId,linkedRfi:null,linkedSubmittal:null,linkedRisk:[...new Set([...a.links.riskIds,...b.links.riskIds])].join('; ')||null,
        consequence:'Two confirmed packages converge on the same programme activity. This identifies an interface to review; it does not establish a blocker or responsibility.',
        escalation:'Confirm the giving/receiving deliverable, owner and required date before treating this interface as a management blocker.',
        packageIds:[a.recordId,b.recordId],workfrontIds:workfront?[workfront.recordId]:[],sourceRecordIds:[a.recordId,b.recordId],sourceRefs:[...a.receipts,...b.receipts].map(x=>x.documentId+':'+x.locator)});
    }
  }
  const confirmed=rows.filter(r=>r.authority==='confirmed'),candidates=rows.filter(r=>r.authority==='candidate'),open=confirmed.filter(r=>!['closed'].includes(r.state));
  const blockers=confirmed.filter(r=>['blocked','overdue'].includes(r.state));
  const overdue=confirmed.filter(r=>r.state==='overdue');
  const linkedActivityCount=new Set(rows.flatMap(r=>r.linkedActivity?r.linkedActivity.split(';').map(x=>x.trim()).filter(Boolean):[])).size;
  return {schemaVersion:'1.0',projectionKey:'interface_intelligence',projectId:state.projectId,projectVersion:state.version,dataDateIso,programmeRevisionId:programme?.sourceRevisionId??null,
    managementPosition:blockers.length?blockers.length+' confirmed interface'+(blockers.length===1?'':'s')+' require management action now. '+candidates.length+' additional interface candidate'+(candidates.length===1?' is':'s are')+' retained for review.':
      confirmed.length?open.length+' confirmed interfaces remain open; no confirmed overdue/blocked interface is established from the current records. '+candidates.length+' candidates require review.':
      candidates.length?candidates.length+' candidate interfaces were identified from confirmed package-to-activity relationships. No formal Interface Register is yet confirmed.':'No confirmed or derivable interface population is available from the current Project information.',
    rows,confirmedCount:confirmed.length,candidateCount:candidates.length,openCount:open.length,blockerCount:blockers.length,overdueCount:overdue.length,linkedActivityCount,
    blockers,candidates,basis:'Confirmed interfaces come from governed Interface records. Candidate interfaces are created only where two confirmed packages converge on the same programme activity; candidates do not establish responsibility, causation or delay.'};
}
export function interfaceModule(state:ProjectRuntimeState):ModuleRuntimeResult{
  const data=interfaceIntelligence(state),has=data.rows.length>0;
  return {key:'delivery-interfaces',status:!has?'blocked':'partial',reason:data.managementPosition,dependencies:has?[]:['governed interface records or package-to-activity relationships'],scheduleAuthorityReview:scheduleAuthorityReview(state),data};
}
