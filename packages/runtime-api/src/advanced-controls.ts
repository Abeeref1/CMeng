import type {ModuleRuntimeResult,ProjectRuntimeState} from './project-state-types';
import {commercialPerformanceForState} from './commercial-performance-runtime';
import {commercialCanonical} from './commercial-canonical';
import {commercialContractControlsForState} from './commercial-contract-controls-runtime';
import {commercialFoundationForState} from './commercial-foundation-runtime';
import {commercialPositionForState} from './commercial-runtime';
import {operationalReporting} from './reporting-state';
import {projectDataDate} from './canonical-time-claims';
import {deliveryModule} from './delivery-projections';

const norm=(value:string)=>value.trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ');
const day=(iso:string)=>Date.parse(iso.slice(0,10)+'T00:00:00Z');
const days=(from:string,to:string)=>Number(((day(to)-day(from))/86400000).toFixed(6));
const ratio=(a:number|null,b:number|null)=>a===null||b===null||b===0?null:Number((a/b).toFixed(6));
const value=(finding:any):number|null=>typeof finding?.value==='number'&&Number.isFinite(finding.value)?finding.value:null;

function earnedDate(points:Array<{asOf:string;pv:number}>,ev:number){
  if(!points.length)return null;
  if(ev<points[0]!.pv||ev>points.at(-1)!.pv)return null;
  for(let i=0;i<points.length;i++){
    if(ev===points[i]!.pv)return points[i]!.asOf;
    if(i===0)continue;
    const left=points[i-1]!,right=points[i]!;
    if(ev<left.pv||ev>right.pv)continue;
    if(right.pv===left.pv)return right.asOf;
    const t=(ev-left.pv)/(right.pv-left.pv),ms=day(left.asOf)+(day(right.asOf)-day(left.asOf))*t;
    return new Date(ms).toISOString();
  }
  return null;
}
export function earnedScheduleForState(state:ProjectRuntimeState):ModuleRuntimeResult{
  const performance=commercialPerformanceForState(state),series=performance.evmPerformance.series;
  const outputs=series.map(s=>{
    const source=(s.points??[]).map(p=>({asOf:p.asOf,pv:value(p.pv),ev:value(p.ev)})).filter((p):p is {asOf:string;pv:number;ev:number}=>p.pv!==null&&p.ev!==null).sort((a,b)=>a.asOf.localeCompare(b.asOf));
    const pvCurve=source.map(p=>({asOf:p.asOf,pv:p.pv}));
    const monotonic=pvCurve.every((p,i)=>i===0||p.pv>=pvCurve[i-1]!.pv);
    const opening=source[0]??null,latest=source.at(-1)??null;
    const openingNearZero=opening&&Math.abs(opening.pv)<=Math.max(0.000001,Math.abs(latest?.pv??0)*0.001);
    const valid=source.length>=2&&monotonic&&Boolean(openingNearZero)&&latest!==null&&days(opening!.asOf,latest!.asOf)>0;
    const pointRows=valid?source.map(p=>{
      const es=earnedDate(pvCurve,p.ev),at=days(opening!.asOf,p.asOf),esDays=es?days(opening!.asOf,es):null;
      return {asOf:p.asOf,pv:p.pv,ev:p.ev,earnedScheduleIso:es,actualTimeDays:at,earnedScheduleDays:esDays,
        scheduleVarianceTimeDays:esDays===null?null:Number((esDays-at).toFixed(6)),schedulePerformanceIndexTime:ratio(esDays,at)};
    }):[];
    const current=pointRows.at(-1)??null;
    return {currency:s.currency,taxBasis:s.taxBasis,state:valid&&current?.earnedScheduleIso?'established':'unavailable',
      sourcePointCount:s.points.length,completePvEvPointCount:source.length,openingPointIso:opening?.asOf??null,
      openingPv:opening?.pv??null,monotonicPv:monotonic,openingReferenceEstablished:Boolean(openingNearZero),
      current,points:pointRows,
      basis:valid?'PV and EV are source time-phased cumulative positions. Earned Schedule is the interpolated date on the PV curve where PV equals each EV; AT and ES use elapsed calendar days from the zero/near-zero opening PV observation.':
        'Earned Schedule requires at least two complete PV/EV observations, a monotonic PV curve and an opening zero/near-zero PV reference. No time index is manufactured when that basis is missing.'};
  });
  const established=outputs.filter(r=>r.state==='established');
  return {key:'earned-schedule',status:established.length?'ready':'partial',engineState:'ready',evidenceState:established.length?'established':'partial',
    professionalState:established.length?'defensible':'review_required',
    reason:established.length?null:'Earned Schedule is not established from the current PV/EV series. Review the time-phased opening reference and cumulative PV/EV basis.',
    dependencies:['time-phased PV and EV','compatible currency/tax basis','opening PV reference'],
    data:{projectionKey:'earned_schedule',schemaVersion:'1.0',projectId:state.projectId,dataDateIso:projectDataDate(state),series:outputs,
      interpretation:'SV(t) is measured in elapsed calendar days and SPI(t) is ES / AT. These are Earned Schedule time measures; they are not the value-based EVM SV and SPI.'}};
}

const metricAlias=(metric:string)=>{
  const n=norm(metric);
  if(['pv','planned value'].includes(n))return'pv';
  if(['ev','earned value'].includes(n))return'ev';
  if(['ac','actual cost','actual incurred cost'].includes(n))return'ac';
  if(['bac','budget at completion','approved budget','current control budget'].includes(n))return'bac';
  if(['eac','estimate at completion','forecast final cost','current forecast'].includes(n))return'eac';
  return null;
};
export function evmByWbsForState(state:ProjectRuntimeState):ModuleRuntimeResult{
  const ledger=commercialCanonical(state),dd=projectDataDate(state);
  const eligible=ledger.costMetrics.filter(r=>r.wbsId&&r.amount.currency&&r.amount.asOf&&(!dd||r.amount.asOf.slice(0,10)<=dd)&&metricAlias(r.metric));
  const groups=new Map<string,typeof eligible>();
  for(const row of eligible){const key=[row.wbsId,row.amount.currency,row.amount.taxBasis].join('|'),list=groups.get(key)??[];list.push(row);groups.set(key,list);}
  const rows=[...groups].map(([key,list])=>{
    const [wbsId,currency,taxBasis]=key.split('|'),metrics:Record<string,number|null>={pv:null,ev:null,ac:null,bac:null,eac:null},refs:string[]=[];
    let conflicted=false;
    for(const metric of ['pv','ev','ac','bac','eac']){
      const candidates=list.filter(r=>metricAlias(r.metric)===metric).sort((a,b)=>String(a.amount.asOf).localeCompare(String(b.amount.asOf)));
      if(!candidates.length)continue;const latestDate=candidates.at(-1)!.amount.asOf!;
      const current=candidates.filter(r=>r.amount.asOf===latestDate&&r.amount.value!==null);
      const distinct=[...new Set(current.map(r=>r.amount.value))];
      if(distinct.length===1)metrics[metric]=distinct[0] as number;else if(distinct.length>1)conflicted=true;
      for(const r of current)refs.push(...r.amount.receipts.map(x=>'evidence-document:'+x.documentId+':'+x.locator));
    }
    return {wbsId,currency,taxBasis,pv:metrics.pv,ev:metrics.ev,ac:metrics.ac,bac:metrics.bac,eac:metrics.eac,
      spi:ratio(metrics.ev,metrics.pv),cpi:ratio(metrics.ev,metrics.ac),
      scheduleVariance:metrics.ev!==null&&metrics.pv!==null?Number((metrics.ev-metrics.pv).toFixed(6)):null,
      costVariance:metrics.ev!==null&&metrics.ac!==null?Number((metrics.ev-metrics.ac).toFixed(6)):null,
      sourceState:conflicted?'conflicting':metrics.pv!==null&&metrics.ev!==null&&metrics.ac!==null?'established':'partial',
      sourceRefs:[...new Set(refs)]};
  }).sort((a,b)=>String(a.wbsId).localeCompare(String(b.wbsId))||String(a.currency).localeCompare(String(b.currency)));
  const complete=rows.filter(r=>r.sourceState==='established').length;
  return {key:'evm-by-wbs',status:rows.length?'partial':'blocked',engineState:'ready',evidenceState:complete===rows.length&&rows.length?'established':rows.length?'partial':'missing',
    professionalState:complete?'review_required':'not_defensible',
    reason:rows.length?(complete===rows.length?null:'Some WBS positions lack compatible PV, EV or AC or contain conflicting same-date values.'):'No source cost metrics with explicit WBS linkage are established.',
    dependencies:['cost metrics','explicit WBS linkage','PV / EV / AC','currency and tax basis'],
    data:{projectionKey:'evm_by_wbs',schemaVersion:'1.0',projectId:state.projectId,dataDateIso:dd,rowCount:rows.length,completeRowCount:complete,rows,
      basis:'Latest source metric at or before the Data Date for each WBS, currency and tax basis. No cross-currency or cross-tax aggregation is performed.'}};
}

export function riskRegisterForState(state:ProjectRuntimeState):ModuleRuntimeResult{
  const reporting=operationalReporting(state),risk=reporting.risk,score=new Map((risk.validation?.scoreRows??[]).map((r:any)=>[r.riskId,r]));
  const rows=(risk.current??[]).map((r:any)=>{const s:any=score.get(r.riskId);const inconsistent=(risk.validation?.ratingInconsistencyGroups??[]).some((g:any)=>g.riskIds?.includes(r.riskId));return {
    riskId:r.riskId,subject:r.subject??null,category:r.category??null,status:r.status,owner:r.owner??null,dueIso:r.dueIso??null,linkedActivityId:r.linkedActivityId??null,
    probability:s?.probability??null,impact:s?.impact??null,calculatedScore:s?.score??null,suppliedRating:r.rating??s?.rating??null,
    ratingCheck:inconsistent?'conflict':'not contradicted by equal-score check',sourceRefs:(r.sourceRefs??[]).join('; ')
  };});
  return {key:'risk-register',status:risk.state==='established'?'ready':rows.length?'partial':'blocked',engineState:'ready',evidenceState:rows.length?(risk.complete?'established':'partial'):'missing',
    professionalState:risk.validation?.state==='conflicted'?'review_required':rows.length?'defensible':'not_defensible',
    reason:rows.length?(risk.validation?.explanation??null):'No governed risk-register population is established.',
    dependencies:['risk register','dated risk status','documented rating method'],
    data:{projectionKey:'risk_register_control',schemaVersion:'1.0',projectId:state.projectId,dataDateIso:reporting.dataDateIso,state:risk.state,
      currentRecordCount:risk.currentRecordCount,futureRecordCount:risk.futureRecordCount,undatedRecordCount:risk.undatedRecordCount,
      validation:risk.validation,rows,basis:'Source risk status is reconstructed as of the programme Data Date. Probability × impact is checked only where source values exist; rating thresholds are never invented.'}};
}

export function contractRiskForState(state:ProjectRuntimeState):ModuleRuntimeResult{
  const controls=commercialContractControlsForState(state),terms=commercialFoundationForState(state).commercialTerms;
  const items:Array<{id:string;area:string;condition:string;state:'action'|'review'|'information';basis:string;action:string}>=[];
  const push=(id:string,area:string,condition:string,stateValue:'action'|'review'|'information',basis:string,action:string)=>items.push({id,area,condition,state:stateValue,basis,action});
  if((controls.contractObligations.overdueCount??0)>0)push('overdue-obligations','Contract obligations',controls.contractObligations.overdueCount+' obligations are overdue.','action','Explicit obligation due dates and current status.','Resolve or formally update the overdue obligations and retain completion evidence.');
  if(controls.contractObligations.state!=='established')push('obligations-coverage','Contract obligations','Obligation population is not fully established.','review','Contract obligation evidence state: '+controls.contractObligations.state+'.','Complete the obligations register or confirm the applicable clause population.');
  if((controls.siteInstructions.overdueQuotationCount??0)>0)push('si-overdue-quotes','Site instructions',controls.siteInstructions.overdueQuotationCount+' instructions are past the evidenced quotation due date.','action','Instruction and quotation dates in the current register.','Complete the quotation response or record the agreed commercial treatment.');
  if((controls.variations.pendingCount??0)>0)push('pending-variations','Variations',controls.variations.pendingCount+' variations remain pending.','review','Current variation lifecycle at the Data Date.','Progress assessment/agreement/approval and reconcile linked schedule and payment records.');
  if((controls.bondsInsurance.expiredBondCount??0)>0)push('expired-bonds','Bonds',controls.bondsInsurance.expiredBondCount+' bonds are expired in the current record.','action','Explicit bond expiry dates.','Confirm renewal, release or replacement evidence.');
  if((controls.bondsInsurance.expiringBondCount??0)>0)push('expiring-bonds','Bonds',controls.bondsInsurance.expiringBondCount+' bonds expire within the controlled warning window.','review','Explicit bond expiry dates.','Confirm extension or release before expiry.');
  if((controls.bondsInsurance.expiredInsuranceCount??0)>0)push('expired-insurance','Insurance',controls.bondsInsurance.expiredInsuranceCount+' insurance policies are expired in the current record.','action','Explicit insurance expiry dates.','Confirm renewal/replacement and coverage evidence.');
  if((controls.retentionCalendar.overdueCount??0)>0)push('retention-overdue','Retention',controls.retentionCalendar.overdueCount+' retention releases are overdue on the evidenced calendar.','review','Explicit release due dates; missing due dates are excluded.','Reconcile release trigger, certificate and payment evidence.');
  const ld=controls.liquidatedDamages.scenarios.filter(s=>value(s.cappedExposure)!==null&&value(s.cappedExposure)!>0);
  if(ld.length)push('ld-exposure','Liquidated damages','A schedule-based LD exposure scenario is calculable.','review','Contract LD terms and current schedule dates; scenario is not liability.','Review entitlement, EOT, mitigation and applicable contractual defences before any liability conclusion.');
  for(const [id,label,term] of [['completion','Contract completion',terms.contractualCompletionDate],['notice','Notice period',terms.noticePeriodDays],['ld-rate','LD rate',terms.ldRate],['ld-cap','LD cap',terms.ldCap]] as const)
    if(term.value===null)push('missing-'+id,label,label+' is not established.','review','Commercial Terms evidence.','Confirm the applicable dated contract term.');
  return {key:'contract-risk',status:items.length?'partial':'ready',engineState:'ready',evidenceState:'partial',professionalState:'review_required',
    reason:items.length?items.length+' contract-control conditions require attention or confirmation.':'No exception was identified by the listed deterministic contract-control checks.',
    dependencies:['commercial terms','contract controls','current schedule/claims where applicable'],
    data:{projectionKey:'contract_risk',schemaVersion:'1.0',projectId:state.projectId,dataDateIso:projectDataDate(state),itemCount:items.length,items,
      basis:'This is a deterministic contract-control exception lens. It does not assign legal probability, liability or entitlement and does not replace legal review.'}};
}

export function finalAccountForState(state:ProjectRuntimeState):ModuleRuntimeResult{
  const commercial=commercialPositionForState(state),controls=commercialContractControlsForState(state);
  const closeout=deliveryModule(state,'delivery-closeout'),handover=deliveryModule(state,'handover-readiness');
  const checks:Array<{key:string;label:string;state:'clear'|'open'|'unresolved';detail:string;source:string}>=[];
  const check=(key:string,label:string,stateValue:'clear'|'open'|'unresolved',detail:string,source:string)=>checks.push({key,label,state:stateValue,detail,source});
  const variations=controls.variations;
  check('variations','Variations',variations.state==='missing'?'unresolved':(variations.pendingCount??0)>0?'open':'clear',variations.state==='missing'?'Variation population not established.':(variations.pendingCount??0)+' pending variation(s).','Variations & Change');
  const obligations=controls.contractObligations;
  check('obligations','Contract obligations',obligations.state==='missing'?'unresolved':(obligations.openCount??0)>0||(obligations.overdueCount??0)>0?'open':'clear',
    obligations.state==='missing'?'Obligation population not established.':String(obligations.openCount??0)+' open · '+String(obligations.overdueCount??0)+' overdue.','Contract Obligations');
  const retention=controls.retentionCalendar;
  check('retention','Retention',retention.state==='missing'?'unresolved':(retention.heldCount??0)>0||(retention.overdueCount??0)>0?'open':'clear',
    retention.state==='missing'?'Retention calendar not established.':String(retention.heldCount??0)+' held · '+String(retention.overdueCount??0)+' overdue release(s).','Retention Calendar');
  check('closeout','Snag / closeout',closeout.status==='blocked'?'unresolved':closeout.status==='ready'?'clear':'open',closeout.reason??(closeout.status==='ready'?'Current closeout checks passed.':'Closeout requires review.'),'Snag & Closeout');
  check('handover','Handover',handover.status==='blocked'?'unresolved':handover.status==='ready'?'clear':'open',handover.reason??(handover.status==='ready'?'Current handover checks passed.':'Handover requires review.'),'Handover Readiness');
  const currencies=(commercial.currencies??[]).map((r:any)=>({currency:r.currency,originalContractValue:value(r.originalContractValue),currentContractValue:value(r.currentContractValue),
    approvedVariationAmount:value(r.approvedVariationAmount),pendingVariationAmount:value(r.pendingVariationAmount),grossCertifiedAmount:value(r.grossCertifiedAmount),paidAmount:value(r.paidAmount),
    certifiedUnpaidAmount:value(r.certifiedUnpaidAmount),retentionHeldAmount:value(r.retentionHeldAmount),claimedAmount:value(r.claimedAmount),assessedClaimAmount:value(r.assessedClaimAmount)}));
  const unresolved=checks.filter(c=>c.state==='unresolved').length,open=checks.filter(c=>c.state==='open').length;
  const stateValue=unresolved?'unresolved':open?'open':'clear';
  return {key:'final-account',status:stateValue==='clear'?'ready':'partial',engineState:'ready',evidenceState:unresolved?'partial':'established',professionalState:stateValue==='clear'?'defensible':'review_required',
    reason:stateValue==='clear'?null:unresolved+' final-account control areas are unresolved and '+open+' remain open.',
    dependencies:['commercial position','variations','payments','retention','obligations','construction closeout/handover'],
    data:{projectionKey:'final_account_closeout',schemaVersion:'1.0',projectId:state.projectId,dataDateIso:projectDataDate(state),state:stateValue,checks,currencies,
      basis:'Final-account readiness is withheld where an applicable population is not established. Currency positions remain separate; open items are not assumed settled.'}};
}
