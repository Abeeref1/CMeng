import {canonicalHeader} from '../../truth-kernel/src';
import {deliveryPosition} from './delivery-projections';
import {deliveryRecords} from './delivery-records';
import {operationalReporting,claimsReporting} from './reporting-state';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {scheduleScopeClassification} from './schedule-scope-classification';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';
import type {DeliveryRecord} from '../../delivery-core/src/types';

const field=(r:DeliveryRecord,...names:string[])=>{for(const name of names){const value=r.fields[canonicalHeader(name)];if(value!==null&&value!==undefined&&String(value).trim())return String(value).trim();}return '';};
const daysOver=(due:string|null,date:string|null)=>due&&date&&due<date?Math.max(0,Math.floor((Date.parse(date.slice(0,10))-Date.parse(due.slice(0,10)))/86400000)):null;
type Dimension='organisation'|'party_role'|'contractor'|'subcontractor'|'discipline'|'package'|'workfront';
export interface AccountabilityDetail {
  dimension:Dimension;value:string;domain:string;recordId:string;reference:string|null;issue:string;dueDate:string|null;overdueDays:number|null;
  activityIds:string[];sourceRefs:string[];authority:'confirmed_record'|'programme_scope';
}
export function crossDomainAccountability(state:ProjectRuntimeState){
  const dataDateIso=projectDataDate(state),delivery=deliveryPosition(state),source=deliveryRecords(state),recordById=new Map(source.records.map(r=>[r.recordId,r]));
  const operations=operationalReporting(state),details:AccountabilityDetail[]=[];
  const add=(dimension:Dimension,value:string|null|undefined,detail:Omit<AccountabilityDetail,'dimension'|'value'>)=>{const v=String(value??'').trim();if(v)details.push({dimension,value:v,...detail});};
  const addDelivery=(recordId:string,domain:string,issue:string,dueDate:string|null,activityIds:string[],sourceRefs:string[])=>{
    const r=recordById.get(recordId);if(!r)return;const base={domain,recordId,reference:r.reference,issue,dueDate,overdueDays:daysOver(dueDate,dataDateIso),activityIds,sourceRefs,authority:'confirmed_record' as const};
    add('organisation',field(r,'owner','responsible party'),base);
    const explicitRole=field(r,'party role','responsible party role','party type','organisation type','organization type');
    if(explicitRole)add('party_role',explicitRole,base);
    add('contractor',field(r,'contractor'),base);add('subcontractor',field(r,'subcontractor'),base);
    add('discipline',field(r,'discipline'),base);add('package',field(r,'work package','package')||r.links.packageIds.map(id=>recordById.get(id)?.reference??id).join('; '),base);
    add('workfront',field(r,'workfront','affected workfront')||(r.kind==='workfront'?(r.reference??r.description):null),base);
  };
  for(const row of delivery.registerRows){
    if(row.scope!=='current'||(!row.overdue&&!['failed','rejected','retest required','blocked'].includes(row.currentStatus)))continue;
    const sourceRow=recordById.get(row.recordId)!;addDelivery(row.recordId,row.kind,row.overdue?'Overdue '+row.kind+' record':row.currentStatus+' '+row.kind+' outcome',row.dueDate??null,sourceRow.links.activityIds,sourceRow.receipts.map(x=>x.documentId+':'+x.locator));
  }
  for(const p of delivery.packageRows)if(typeof p.headroomCalendarDays==='number'&&p.headroomCalendarDays<0){
    const r=recordById.get(p.recordId)!;const issue='Package forecast delivery is '+(-p.headroomCalendarDays)+' calendar days after programme need';
    addDelivery(p.recordId,'procurement',issue,p.programmeNeedDate,p.activityIds,r.receipts.map(x=>x.documentId+':'+x.locator));
    for(const supplierId of p.supplierIds){const supplier=recordById.get(supplierId);if(supplier){const base={domain:'procurement',recordId:p.recordId,reference:p.reference,issue,dueDate:p.programmeNeedDate,overdueDays:-p.headroomCalendarDays,activityIds:p.activityIds,sourceRefs:r.receipts.map(x=>x.documentId+':'+x.locator),authority:'confirmed_record' as const};add('organisation',field(supplier,'company')||supplier.description||supplier.reference,base);}}
  }
  const op=(domain:string,row:any,id:string,issue:string)=>{const base={domain,recordId:id,reference:id,issue,dueDate:row.dueIso??null,overdueDays:daysOver(row.dueIso??null,dataDateIso),activityIds:row.linkedActivityId?[row.linkedActivityId]:[],sourceRefs:row.sourceRefs??[],authority:'confirmed_record' as const};add('organisation',row.owner,base);};
  for(const r of operations.quality.current)if(r.status==='open')op('NCR',r,r.ncrId,(r.severity??'unknown')+' NCR remains open');
  for(const r of operations.rfi.current)if(r.status==='open')op('RFI',r,r.rfiId,r.dueIso&&dataDateIso&&r.dueIso<dataDateIso?'RFI response is overdue':'RFI remains open');
  for(const r of operations.risk.current)if(r.status==='open')op('risk',r,r.riskId,'Open Project risk');
  const claims=claimsReporting(state);
  if(claims){
    const current=claims.current,events=new Map(current.events.map(event=>[event.eventId,event]));
    const sourceRef=(ref:any)=>String(ref.sourceType??'evidence')+':'+String(ref.sourceId??'unknown')+(ref.locator?':'+String(ref.locator):'');
    const partyRole=(responsibility:string,stateValue:string)=>{
      if(!['official','provisional'].includes(stateValue))return null;
      if(responsibility==='employer')return 'Client / Employer';
      if(responsibility==='contractor')return 'Contractor';
      if(responsibility==='concurrent')return 'Client / Employer + Contractor';
      return null;
    };
    const openClaimIds=new Set<string>();
    for(const claim of current.claims){
      if(['determined','rejected','withdrawn'].includes(claim.state))continue;
      openClaimIds.add(claim.claimId);
      const linkedEvents=claim.eventIds.map(id=>events.get(id)).filter((event):event is NonNullable<typeof event>=>!!event);
      const activityIds=[...new Set(linkedEvents.flatMap(event=>event.relatedActivityIds))];
      const base={domain:'claim',recordId:claim.claimId,reference:claim.claimId,issue:'Claim is '+claim.state.replace(/_/g,' '),dueDate:null,overdueDays:null,activityIds,
        sourceRefs:claim.evidenceRefs.map(sourceRef),authority:'confirmed_record' as const};
      const roles=[...new Set(linkedEvents.map(event=>partyRole(event.responsibility,event.responsibilityState)).filter((value):value is string=>!!value))];
      roles.forEach(role=>add('party_role',role,base));
    }
    for(const notice of current.notices){
      if(!notice.claimId||!openClaimIds.has(notice.claimId)||notice.kind==='determination')continue;
      const event=notice.eventId?events.get(notice.eventId):null;
      const base={domain:'notice',recordId:notice.noticeId,reference:notice.noticeId,issue:(notice.kind.replace(/_/g,' ')+' linked to open claim '+notice.claimId),dueDate:null,overdueDays:null,
        activityIds:event?.relatedActivityIds??[],sourceRefs:notice.evidenceRefs.map(sourceRef),authority:'confirmed_record' as const};
      if(event){const role=partyRole(event.responsibility,event.responsibilityState);if(role)add('party_role',role,base);}
    }
  }
  const programme=projectControlSchedule(state)?.revision.model??null;
  if(programme){
    const classification=scheduleScopeClassification(programme),byId=new Map(classification.rows.map(r=>[r.activityId,r]));
    for(const a of programme.activities){
      if(['completed','wbs_summary','level_of_effort'].includes(String((a as any).status??a.activityType)))continue;
      const pressure=(typeof a.totalFloatHours==='number'&&a.totalFloatHours<0)||(a.currentFinishIso&&dataDateIso&&a.currentFinishIso.slice(0,10)<dataDateIso&&!(a.actualFinishIso));
      if(!pressure)continue;const c=byId.get(a.activityId);if(!c)continue;
      const base={domain:'schedule',recordId:a.activityId,reference:a.activityId,issue:typeof a.totalFloatHours==='number'&&a.totalFloatHours<0?'Activity has '+a.totalFloatHours+' hours total float':'Unfinished activity is past its current finish',dueDate:a.currentFinishIso?.slice(0,10)??null,overdueDays:daysOver(a.currentFinishIso?.slice(0,10)??null,dataDateIso),activityIds:[a.activityId],sourceRefs:[],authority:'programme_scope' as const};
      add('contractor',c.contractor,base);add('subcontractor',c.subcontractor,base);add('discipline',c.discipline,base);add('package',c.package,base);add('workfront',c.workFront,base);
    }
  }
  const grouped=new Map<string,{dimension:Dimension;value:string;detailIds:Set<string>;domains:Set<string>;overdueCount:number;openNcrCount:number;overdueRfiCount:number;latePackageCount:number;openSnagCount:number;permitIssueCount:number;openRiskCount:number;affectedActivityIds:Set<string>;worstOverdueDays:number|null}>();
  for(const d of details){const key=d.dimension+'|'+d.value.toLowerCase(),g=grouped.get(key)??{dimension:d.dimension,value:d.value,detailIds:new Set(),domains:new Set(),overdueCount:0,openNcrCount:0,overdueRfiCount:0,latePackageCount:0,openSnagCount:0,permitIssueCount:0,openRiskCount:0,affectedActivityIds:new Set(),worstOverdueDays:null};
    g.detailIds.add(d.domain+'|'+d.recordId);g.domains.add(d.domain);if((d.overdueDays??0)>0)g.overdueCount++;if(d.domain==='NCR')g.openNcrCount++;if(d.domain==='RFI'&&(d.overdueDays??0)>0)g.overdueRfiCount++;if(d.domain==='procurement')g.latePackageCount++;if(d.domain==='snag')g.openSnagCount++;if(d.domain==='permit')g.permitIssueCount++;if(d.domain==='risk')g.openRiskCount++;d.activityIds.forEach(id=>g.affectedActivityIds.add(id));if(d.overdueDays!==null)g.worstOverdueDays=g.worstOverdueDays===null?d.overdueDays:Math.max(g.worstOverdueDays,d.overdueDays);grouped.set(key,g);}
  const rows=[...grouped.values()].map(g=>({dimension:g.dimension,value:g.value,openIssueCount:g.detailIds.size,domainCount:g.domains.size,overdueCount:g.overdueCount,openNcrCount:g.openNcrCount,overdueRfiCount:g.overdueRfiCount,latePackageCount:g.latePackageCount,openSnagCount:g.openSnagCount,permitIssueCount:g.permitIssueCount,openRiskCount:g.openRiskCount,affectedActivityCount:g.affectedActivityIds.size,worstOverdueDays:g.worstOverdueDays,
    domains:[...g.domains].sort(),detailRecordIds:[...g.detailIds]})).sort((a,b)=>b.openIssueCount-a.openIssueCount||b.overdueCount-a.overdueCount||(b.worstOverdueDays??-1)-(a.worstOverdueDays??-1)||a.value.localeCompare(b.value));
  return {schemaVersion:'1.0',projectionKey:'cross_domain_accountability',projectId:state.projectId,projectVersion:state.version,dataDateIso,rows,details,
    managementPosition:rows.length?rows[0]!.value+' has the largest identified concentration: '+rows[0]!.openIssueCount+' open/pressure items across '+rows[0]!.domainCount+' domain'+(rows[0]!.domainCount===1?'':'s')+'. This is an accountability workload concentration, not a finding of contractual delay responsibility.':'No accountable party can be ranked because current open/overdue records do not contain reusable ownership or scope classifications.',
    basis:'Counts are deduplicated within each accountability dimension and drill back to confirmed records or programme scope classifications. CMeng does not infer contractual responsibility from ownership, correlation or schedule pressure.'};
}
export function accountabilityModule(state:ProjectRuntimeState):ModuleRuntimeResult{
  const data=crossDomainAccountability(state);return {key:'cross-domain-accountability',status:data.rows.length?'partial':'blocked',reason:data.managementPosition,dependencies:data.rows.length?[]:['dated open records with owner/contractor/scope information'],data};
}
