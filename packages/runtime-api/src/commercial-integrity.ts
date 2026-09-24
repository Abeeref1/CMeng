import type {CommercialControlPosition} from '../../commercial-control/src';

export interface CommercialIntegrityCheck {metric:string;expected:unknown;actual:unknown;passed:boolean}

/** Check arithmetic and source-population boundaries. This never certifies a
 * source amount as correct, confirms a payment, or decides contract entitlement. */
export function commercialIntegrityChecks(key:string, position:CommercialControlPosition):CommercialIntegrityCheck[]{
  const checks:CommercialIntegrityCheck[]=[];
  const compare=(metric:string,actual:unknown,expected:unknown)=>checks.push({metric,actual,expected,passed:
    typeof actual==='number'&&typeof expected==='number'?Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(.00001,Math.abs(expected)*1e-10):actual===expected});
  const ledger=position.sourceLedger;
  if(!ledger)return checks;
  if(['cost-forecast','commercial-overview'].includes(key))for(const row of position.performance.costControl.positions){
    const id=row.currency+':'+row.taxBasis+':'+row.asOf;
    const ratio=(a:number|null,b:number|null)=>a!==null&&b!==null&&b>0?a/b:null;
    compare('cost_spi_arithmetic:'+id,row.spi.value,ratio(row.ev.value,row.pv.value));
    compare('cost_cpi_arithmetic:'+id,row.cpi.value,ratio(row.ev.value,row.ac.value));
    compare('cost_schedule_variance:'+id,row.sv.value,row.ev.value!==null&&row.pv.value!==null?row.ev.value-row.pv.value:null);
  }
  if(['payments','cash-flow','commercial-overview'].includes(key))for(const group of position.certificateProfile?.groups??[]){
    const id=group.currency+':'+group.taxBasis;
    const source=ledger.payments.filter(p=>p.amounts.netCertifiedAmount.currency===group.currency&&p.amounts.netCertifiedAmount.taxBasis===group.taxBasis);
    const rows=[...group.as_of,...group.future,...group.undated];
    compare('certificate_source_population:'+id,rows.length,source.length);
    compare('certificate_source_identities:'+id,rows.map(r=>r.id).sort().join('\n'),source.map(r=>r.paymentId).sort().join('\n'));
    compare('certificate_current_cutoff:'+id,group.as_of.every(r=>Boolean(r.date&&ledger.dataDateIso&&r.date.slice(0,10)<=ledger.dataDateIso.slice(0,10))),true);
    compare('certificate_future_cutoff:'+id,group.future.every(r=>Boolean(r.date&&ledger.dataDateIso&&r.date.slice(0,10)>ledger.dataDateIso.slice(0,10))),true);
    for(const component of ['grossWork','variations','retentionDeduction','advanceRecovery','netCertifiedAmount'] as const){
      if(group.totals?.[component]===null||group.totals?.[component]===undefined)continue;
      const ids=new Set(group.as_of.map(r=>r.id)),current=source.filter(r=>ids.has(r.paymentId));
      const amounts=current.map(r=>r.amounts[component]);
      const valid=amounts.length>0&&amounts.every(a=>a.value!==null&&a.currency===group.currency&&a.taxBasis===group.taxBasis);
      compare('certificate_component_sum:'+id+':'+component,group.totals[component],valid?amounts.reduce((n,a)=>n+a.value!,0):null);
    }
  }
  if(ledger.dataDateIso&&['variations-change','commercial-overview'].includes(key))for(const g of position.variationBasisReview?.groups??[]){
    compare('variation_partition:'+g.currency+':'+g.taxBasis,g.current.count+g.future.count+g.undatedCount,g.approvedSourceCount);
  }
  if(key==='commercial-claims-notices'){
    const p=position.claimsNotices;
    compare('notice_outcome_population',Object.values(p.noticeTimelinessCounts).reduce((n,v)=>n+v,0),p.noticeAssessments.length);
    compare('notice_missing_rules_are_not_unselected_rules',p.dimensionalEvidenceGaps.requirementMissing,p.noticeTimelinessCounts.requirement_missing);
    compare('notice_date_gap_population',p.dimensionalEvidenceGaps.noticeDateMissing,p.noticeAssessments.filter(a=>!a.noticeIssuedAt||!Number.isFinite(Date.parse(a.noticeIssuedAt))).length);
  }
  return checks;
}
