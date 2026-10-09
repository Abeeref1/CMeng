import {canonicalHeader,managementAction,type ManagementAction} from '../../truth-kernel/src';
import {deliveryPosition} from './delivery-projections';
import {operationalReporting,claimsReporting} from './reporting-state';
import {projectControlSchedule,projectDataDate} from './canonical-time-claims';
import {scheduleScopeClassification} from './schedule-scope-classification';
import type {ProjectRuntimeState,ModuleRuntimeResult} from './project-state-types';
import type {DeliveryRecord} from '../../delivery-core/src/types';
import {actionRecordKey,prioritizeActions,pmcRoleOwner} from './action-priority';
import {commercialCanonical} from './commercial-canonical';
import {registerProgrammeContext} from './register-programme-context';

const field=(r:DeliveryRecord,...names:string[])=>{for(const name of names){const value=r.fields[canonicalHeader(name)];if(value!==null&&value!==undefined&&String(value).trim())return String(value).trim();}return '';};
const daysOver=(due:string|null,date:string|null)=>due&&date&&due<date?Math.max(0,Math.floor((Date.parse(date.slice(0,10))-Date.parse(due.slice(0,10)))/86400000)):null;
type Dimension='owner'|'organisation'|'party_role'|'contractor'|'subcontractor'|'discipline'|'package'|'workfront';
export interface AccountabilityDetail {
  dimension:Dimension;value:string;domain:string;recordId:string;reference:string|null;issue:string;dueDate:string|null;overdueDays:number|null;
  activityIds:string[];sourceRefs:string[];authority:'confirmed_record'|'programme_scope';
}
export function crossDomainAccountability(state:ProjectRuntimeState){
  const dataDateIso=projectDataDate(state),delivery=deliveryPosition(state),recordById=new Map(delivery.records.map(r=>[r.recordId,r]));
  const packageById=new Map(delivery.packageRows.map(row=>[row.recordId,row]));
  const operations=operationalReporting(state),details:AccountabilityDetail[]=[];
  // Action eligibility is independent of whether ownership/scope is assigned.
  // Keep concentration groups without using them to erase eligible records.
  type Item=Omit<AccountabilityDetail,'dimension'|'value'>;
  const eligible=new Map<string,Item>();
  const retain=(item:Item)=>{
    const key=actionRecordKey(item.domain,item.reference??item.recordId),previous=eligible.get(key);
    eligible.set(key,previous?{...previous,activityIds:[...new Set([...previous.activityIds,...item.activityIds])],sourceRefs:[...new Set([...previous.sourceRefs,...item.sourceRefs])]}:item);
  };
  const add=(dimension:Dimension,value:string|null|undefined,detail:Item)=>{retain(detail);const v=String(value??'').trim();if(v)details.push({dimension,value:v,...detail});};
  const addDelivery=(recordId:string,domain:string,issue:string,dueDate:string|null,activityIds:string[],sourceRefs:string[])=>{
    const r=recordById.get(recordId);if(!r)return;const base={domain,recordId,reference:r.reference,issue:[r.description,issue].filter(Boolean).join(' · '),dueDate,overdueDays:daysOver(dueDate,dataDateIso),activityIds,sourceRefs,authority:'confirmed_record' as const};
    add('owner',pmcRoleOwner(domain,field(r,'owner','responsible party')),base);
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
  // Reuse the same as-of procurement flags used by the specialist Delivery page.
  // Reported delivered is not an actual delivery date, but it is not evidence
  // of an outstanding late shipment merely because the old forecast was late.
  for(const p of delivery.packageRows)if(!p.registerCleanup&&(p.forecastLate||p.overdueUndelivered)){
    const r=recordById.get(p.recordId)!;const issue=p.overdueUndelivered?'Package is still undelivered after its required-on-site date':'Package forecast delivery is '+(-p.headroomCalendarDays!)+' calendar days after '+p.needDateBasis.toLowerCase();
    addDelivery(p.recordId,'procurement',issue,p.needDate,p.activityIds,r.receipts.map(x=>x.documentId+':'+x.locator));
    for(const supplierId of p.supplierIds){const supplier=recordById.get(supplierId);if(supplier){const base={domain:'procurement',recordId:p.recordId,reference:p.reference,issue,dueDate:p.needDate,overdueDays:p.headroomCalendarDays===null?daysOver(p.needDate,dataDateIso):-p.headroomCalendarDays,activityIds:p.activityIds,sourceRefs:r.receipts.map(x=>x.documentId+':'+x.locator),authority:'confirmed_record' as const};add('organisation',field(supplier,'company')||supplier.description||supplier.reference,base);}}
  }
  const op=(domain:string,row:any,id:string,issue:string)=>{const base={domain,recordId:id,reference:id,issue:[row.subject,issue].filter(Boolean).join(' · '),dueDate:row.dueIso??null,overdueDays:daysOver(row.dueIso??null,dataDateIso),activityIds:row.linkedActivityId?[row.linkedActivityId]:[],sourceRefs:row.sourceRefs??[],authority:'confirmed_record' as const};add('owner',pmcRoleOwner(domain,row.owner),base);add('organisation',row.owner,base);};
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
      const roles=[...new Set(linkedEvents.map(event=>partyRole(event.responsibility,event.responsibilityState)).filter((value):value is NonNullable<ReturnType<typeof partyRole>>=>value!==null))];
      retain(base);add('owner',pmcRoleOwner('claim',null),base);roles.forEach(role=>add('party_role',role,base));
    }
    for(const notice of current.notices){
      if(!notice.claimId||!openClaimIds.has(notice.claimId)||notice.kind==='determination')continue;
      const event=notice.eventId?events.get(notice.eventId):null;
      const base={domain:'notice',recordId:notice.noticeId,reference:notice.noticeId,issue:(notice.kind.replace(/_/g,' ')+' linked to open claim '+notice.claimId),dueDate:null,overdueDays:null,
        activityIds:event?.relatedActivityIds??[],sourceRefs:notice.evidenceRefs.map(sourceRef),authority:'confirmed_record' as const};
      retain(base);add('owner',pmcRoleOwner('notice',null),base);if(event){const role=partyRole(event.responsibility,event.responsibilityState);if(role)add('party_role',role,base);}
    }
  }
  const programme=projectControlSchedule(state)?.revision.model??null;
  const programmeActivities=new Map(programme?.activities.map(a=>[a.activityId,a])??[]);
  if(programme){
    const classification=scheduleScopeClassification(programme),byId=new Map(classification.rows.map(r=>[r.activityId,r]));
    for(const a of programme.activities){
      if(a.status==='completed'||['wbs_summary','level_of_effort'].includes(a.activityType))continue;
      const missedStart=!!a.currentStartIso&&!!dataDateIso&&a.currentStartIso.slice(0,10)<dataDateIso&&a.status==='not_started';
      const pressure=(typeof a.totalFloatHours==='number'&&a.totalFloatHours<0)||(a.currentFinishIso&&dataDateIso&&a.currentFinishIso.slice(0,10)<dataDateIso&&!(a.actualFinishIso))||missedStart;
      if(!pressure)continue;const c=byId.get(a.activityId);
      const missedFinish=!!a.currentFinishIso&&!!dataDateIso&&a.currentFinishIso.slice(0,10)<dataDateIso;
      const dueDate=(missedStart&&!missedFinish?a.currentStartIso:a.currentFinishIso)?.slice(0,10)??null;
      const base={domain:'schedule',recordId:a.activityId,reference:a.activityId,issue:(a.name?a.name+' · ':'')+(typeof a.totalFloatHours==='number'&&a.totalFloatHours<0?'Activity has '+a.totalFloatHours+' hours total float':missedStart&&!missedFinish?'Activity has not started after its planned start':'Unfinished activity is past its current finish'),dueDate,overdueDays:daysOver(dueDate,dataDateIso),activityIds:[a.activityId],sourceRefs:[],authority:'programme_scope' as const};
      retain(base);add('owner',pmcRoleOwner('schedule',null),base);if(!c)continue;
      add('contractor',c.contractor,base);add('subcontractor',c.subcontractor,base);add('discipline',c.discipline,base);add('package',c.package,base);add('workfront',c.workFront,base);
    }
  }
  const grouped=new Map<string,{dimension:Dimension;value:string;detailIds:Set<string>;domains:Set<string>;overdueCount:number;openNcrCount:number;overdueRfiCount:number;latePackageCount:number;openSnagCount:number;permitIssueCount:number;openRiskCount:number;affectedActivityIds:Set<string>;worstOverdueDays:number|null}>();
  for(const d of details){const key=d.dimension+'|'+d.value.toLowerCase(),g=grouped.get(key)??{dimension:d.dimension,value:d.value,detailIds:new Set(),domains:new Set(),overdueCount:0,openNcrCount:0,overdueRfiCount:0,latePackageCount:0,openSnagCount:0,permitIssueCount:0,openRiskCount:0,affectedActivityIds:new Set(),worstOverdueDays:null};
    const detailKey=actionRecordKey(d.domain,d.reference??d.recordId),isNew=!g.detailIds.has(detailKey);g.detailIds.add(detailKey);g.domains.add(d.domain);
    if(isNew){const kind=detailKey.split('|')[0];if((d.overdueDays??0)>0)g.overdueCount++;if(kind==='ncr')g.openNcrCount++;if(kind==='rfi'&&(d.overdueDays??0)>0)g.overdueRfiCount++;if(d.domain==='procurement')g.latePackageCount++;if(d.domain==='snag')g.openSnagCount++;if(d.domain==='permit')g.permitIssueCount++;if(d.domain==='risk')g.openRiskCount++;}
    d.activityIds.forEach(id=>g.affectedActivityIds.add(id));if(d.overdueDays!==null)g.worstOverdueDays=g.worstOverdueDays===null?d.overdueDays:Math.max(g.worstOverdueDays,d.overdueDays);grouped.set(key,g);}
  const rows=[...grouped.values()].map(g=>({dimension:g.dimension,value:g.value,openIssueCount:g.detailIds.size,domainCount:g.domains.size,overdueCount:g.overdueCount,openNcrCount:g.openNcrCount,overdueRfiCount:g.overdueRfiCount,latePackageCount:g.latePackageCount,openSnagCount:g.openSnagCount,permitIssueCount:g.permitIssueCount,openRiskCount:g.openRiskCount,affectedActivityCount:g.affectedActivityIds.size,worstOverdueDays:g.worstOverdueDays,
    domains:[...g.domains].sort(),detailRecordIds:[...g.detailIds]})).sort((a,b)=>Number(b.dimension==='owner')-Number(a.dimension==='owner')||b.openIssueCount-a.openIssueCount||b.overdueCount-a.overdueCount||(b.worstOverdueDays??-1)-(a.worstOverdueDays??-1)||a.value.localeCompare(b.value));

  const byRecord=new Map<string,AccountabilityDetail[]>([...eligible.keys()].map(key=>[key,[]]));
  for(const detail of details){const key=actionRecordKey(detail.domain,detail.reference??detail.recordId),items=byRecord.get(key)??[];items.push(detail);byRecord.set(key,items);}
  // An unassigned person is never an unassigned responsibility. Keep the
  // original missing-person evidence and show the accountable PMC role.
  const accountablePmcRole=(domain:string)=>{
    const d=domain.toLowerCase();
    return d==='procurement'?'Procurement Manager':
      d==='rfi'||d==='design'?'Design Manager':
      d==='ncr'||d==='quality'?'QA/QC Manager':
      d==='schedule'||d==='activity'||d==='programme'?'Planning Manager':
      d==='claim'||d==='notice'?'Contracts Manager':
      d==='risk'?'Risk Manager':
      d==='security'||d==='bond'||d==='insurance'?'Commercial Manager':
      'Project Controls Manager';
  };
  const actionRows:ManagementAction[]=[...byRecord.entries()].map(([key,items])=>{
    const first=eligible.get(key)!,dimension=(name:Dimension)=>items.find(item=>item.dimension===name)?.value??null;
    const organisation=dimension('organisation')??dimension('contractor')??dimension('subcontractor');
    const scope=[dimension('package'),dimension('workfront'),dimension('discipline'),...first.activityIds].filter((value):value is string=>!!value);
    const overdue=Math.max(0,first.overdueDays??0,...items.map(item=>item.overdueDays??0));
    const domain=actionRecordKey(first.domain,'').split('|')[0]!;
    const owner=pmcRoleOwner(domain,dimension('organisation')??dimension('party_role')??dimension('contractor')??dimension('subcontractor'));
    const procurement=domain==='procurement'?packageById.get(first.recordId)??null:null;
    const completedRegisterFollowUp=['rfi','ncr'].includes(domain)&&registerProgrammeContext(first.activityIds,programmeActivities).state==='completed_work';
    const consequence=
      completedRegisterFollowUp?'All linked activities are complete. Close or reconcile this open register record and check any remaining acceptance obligation.':
      domain==='procurement'?'Programme need dates may be affected by the late package.':
      domain==='rfi'?'The unresolved design response may constrain linked programme work.':
      domain==='ncr'?'The open quality issue may prevent acceptance or downstream work.':
      domain==='risk'?'The open risk requires an owned mitigation and current status.':
      domain==='claim'||domain==='notice'?'The claim/notice evidence chain remains open and may affect entitlement assessment.':
      domain==='schedule'?'The activity is under current schedule pressure and may affect dependent work or milestones.':
      'The open control item requires resolution before its affected scope can be treated as clear.';
    const requiredAction=
      completedRegisterFollowUp?'Reconcile the open record with the completed programme work, confirm any outstanding acceptance obligation and record the close-out decision.':
      domain==='procurement'?'Confirm vendor status, recovery delivery date and affected programme need dates; expedite where required.':
      domain==='rfi'?'Obtain the response, confirm the affected activities and update the required date.':
      domain==='ncr'?'Close the NCR with corrective evidence and confirm downstream release.':
      domain==='risk'?'Confirm risk owner, mitigation, due date and residual exposure.':
      domain==='claim'||domain==='notice'?'Complete the event, notice, activity and determination evidence chain.':
      domain==='schedule'?'Confirm the remaining work, driving logic, accountable delivery party and recovery date.':
      'Assign ownership, confirm the required completion date and close the underlying control item.';
    return managementAction({
      actionId:'accountability:'+(['rfi','ncr'].includes(domain)?domain.toUpperCase():domain)+'|'+(first.reference??first.recordId),recordKey:actionRecordKey(first.domain,first.reference??first.recordId),issue:(first.reference?first.reference+' · ':'')+first.issue,consequence,affectedScope:scope,affectedMilestones:[],
      owner,organisation,requiredAction:owner?requiredAction:'Assign an accountable party. '+requiredAction,dueIso:first.dueDate,escalation:overdue>0?'Escalate because the required date is already past.':null,
      severity:completedRegisterFollowUp?'low':overdue>0||['procurement','ncr','rfi','schedule'].includes(domain)?'high':'medium',
      authority:first.authority==='confirmed_record'?'source':'source',sourceRefs:first.sourceRefs,
      moneyAtRisk:procurement?.packageValue!==null&&procurement?.packageValue!==undefined&&procurement.currency?[{amount:procurement.packageValue,currency:procurement.currency}]:[],
      owningModule:({rfi:'delivery-design',ncr:'delivery-quality',procurement:'procurement-packages',schedule:'activity-analytics',risk:'delivery-risks',claim:'delay-claims',notice:'notices-claims'} as Record<string,string>)[domain]??'delivery-control',
    });
  });
  for(const bond of commercialCanonical(state).bonds??state.controls.bonds){
    if(bond.status!=='expired')continue;
    actionRows.push(managementAction({actionId:'security:'+bond.bondId,recordKey:actionRecordKey('security',bond.bondId),issue:bond.bondId+' · security expired',
      consequence:'Contract security is no longer valid at the reporting date.',affectedScope:[],affectedMilestones:[],owner:pmcRoleOwner('bond',null),organisation:null,
      requiredAction:'Obtain the renewed instrument and record its expiry date and responsible owner.',dueIso:bond.expiryIso,escalation:'Escalate the uncovered security exposure.',
      severity:'high',authority:'source',owningModule:'contract-particulars-bonds',sourceRefs:bond.sourceRefs,moneyAtRisk:bond.amount===null?[]:[{amount:bond.amount,currency:bond.currency}]}));
  }
  const recordActions=prioritizeActions(actionRows,programme);
  // A source register row is evidence, not a separate executive decision.
  // Group it by accountable party, register/control and completed-work cleanup state.
  // All individual records remain traceable in "details"; no source row is removed.
  const buckets=new Map<string,typeof recordActions>();
  for(const action of recordActions){
    const cleanup=(action.consequence??'').startsWith('All linked activities are complete.');
    const key=[action.owner??pmcRoleOwner(action.owningModule??'project controls',null),action.owningModule??'project controls',cleanup?'register_cleanup':'active_control'].join('|');
    const members=buckets.get(key)??[];members.push(action);buckets.set(key,members);
  }
  const actions=[...buckets.entries()].map(([key,members],index)=>{
    const first=members[0]!,owner=first.owner??pmcRoleOwner(first.owningModule??'project controls',null);
    const cleanup=(first.consequence??'').startsWith('All linked activities are complete.');
    const sourceCount=members.length;
    const references=[...new Set(members.flatMap(item=>item.sourceRefs))];
    const scope=[...new Set(members.flatMap(item=>item.affectedScope))];
    return {...first,
      actionId:'accountability-owner-group:'+index,
      recordKey:'accountability-owner-group:'+key,
      issue:sourceCount+' '+(cleanup?'register clean-up':'open control')+' record'+(sourceCount===1?'':'s')+' · '+(first.owningModule??'project control'),
      consequence:cleanup?'All linked programme activities are complete; register close-out and any contractual acceptance obligations need confirmation.':first.consequence,
      affectedScope:scope.slice(0,20),
      requiredAction:(cleanup?'Reconcile completed-work records with the register and confirm close-out evidence. ':'Review source records by the accountable party; prioritise driving work and approaching due dates. ')+first.requiredAction,
      sourceRefs:references.slice(0,50),owner,
    };
  });
  const owned=actions.filter(action=>action.owner).length,unassigned=actions.length-owned;
  return {schemaVersion:'1.0',projectionKey:'cross_domain_accountability',projectId:state.projectId,projectVersion:state.version,dataDateIso,rows,details,actions,recordActionCount:recordActions.length,
    managementPosition:recordActions.length
      ?recordActions.length+' underlying control records are organised into '+actions.length+' accountable owner/register action groups; '+owned+' groups have an accountable role'+(unassigned?' and '+unassigned+' still need ownership.':'.')
      :'No actionable ownership chain is established from the current open/overdue records.',
    basis:'One owner/register group is the management action, not one action per register row. The complete individual records and source references are retained under supporting drill-down. No claim of contractual delay responsibility follows merely from the assigned role.'};
}
export function accountabilityModule(state:ProjectRuntimeState):ModuleRuntimeResult{
  const data=crossDomainAccountability(state);return {key:'cross-domain-accountability',status:data.actions.length||data.rows.length?'partial':'blocked',reason:data.managementPosition,dependencies:data.actions.length||data.rows.length?[]:['dated open records with owner/contractor/scope information'],data};
}
