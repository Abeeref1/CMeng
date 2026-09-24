import {dateValue, reportingScope} from '../../truth-kernel/src';
import type {CanonicalCommercialModel, CommercialVariation} from './commercial-canonical';
import type {ProjectRuntimeState} from './project-state-types';
import type {ReturnCertificateProfile} from './certificate-profile';

export interface AmendmentAmount {documentId:string;sourceFilename?:string;effectiveDate:string|null;currency:string;taxBasis:string;amount:number;sourceRefs:string[]}

/** Explicit amendment amounts retain their effective date, currency and source.
 * Neither a budget delta nor a future approval is substituted for this evidence. */
export function amendmentAmounts(state:ProjectRuntimeState):AmendmentAmount[]{
  return state.contractDocuments.filter(d=>d.role==='amendment'&&state.evidenceDocuments.some(e=>e.documentId===d.documentId&&['active','additive'].includes(e.basisState))).flatMap(d=>{
    const fragments=[...(d.result.pdf?.pages??[]).map(p=>({text:p.text,locator:'page:'+p.pageNumber})),
      ...d.result.sections.map(s=>({text:s.text,locator:s.startPage?'page:'+s.startPage:s.sectionKey}))];
    const effective=/effective\s+date\s*[:\n]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{4}-\d{2}-\d{2})/i.exec(fragments.map(f=>f.text).join('\n'));
    const groups=new Map<string,AmendmentAmount>();
    for(const f of fragments)for(const m of f.text.matchAll(/amendment\s+(?:value|amount)\s*[:\n]?\s*([A-Z]{3})\s+([\d,]+(?:\.\d+)?)([^\n]*)/gi)){
      const currency=m[1]!.toUpperCase(),amount=Number(m[2]!.replaceAll(',','')),taxBasis=/exclud|excl/i.test(m[3]!)?'exclusive':/includ|incl/i.test(m[3]!)?'inclusive':'unknown';
      const key=[currency,amount,taxBasis].join('|'),ref='evidence-document:'+d.documentId+':'+f.locator;
      const prior=groups.get(key);
      if(prior){if(!prior.sourceRefs.includes(ref))prior.sourceRefs.push(ref);}
      else groups.set(key,{documentId:d.documentId,sourceFilename:state.evidenceDocuments.find(e=>e.documentId===d.documentId)?.sourceFilename??d.documentId,effectiveDate:effective?dateValue(effective[1]!):null,currency,taxBasis,amount,sourceRefs:[ref]});
    }
    return [...groups.values()];
  });
}

/** Review populations, not a project-specific expected total. Negative changes,
 * undated approvals and incompatible money bases remain separate and visible. */
export function variationBasisReview(ledger:CanonicalCommercialModel,amendments:AmendmentAmount[]){
  const groups=new Map<string,CommercialVariation[]>();
  for(const row of ledger.variations){const key=JSON.stringify([row.approvedAmount.currency,row.approvedAmount.taxBasis]);const group=groups.get(key)??[];group.push(row);groups.set(key,group);}
  return {dataDateIso:ledger.dataDateIso,groups:[...groups.values()].map(records=>{
    const {currency,taxBasis}=records[0]!.approvedAmount;
    const approved=records.filter(r=>/^(approved|accepted|executed)$/i.test(r.status.trim()));
    const sum=(rows:CommercialVariation[])=>rows.length?rows.every(r=>r.approvedAmount.value!==null)?rows.reduce((n,r)=>n+r.approvedAmount.value!,0):null:0;
    const slice=(cutoff:string|null)=>{const rows=approved.filter(r=>reportingScope(r.approvalDate,cutoff)==='as_of');return {count:rows.length,amount:cutoff?sum(rows):null};};
    const current=slice(ledger.dataDateIso),future=approved.filter(r=>reportingScope(r.approvalDate,ledger.dataDateIso)==='future');
    const amounts=approved.map(r=>r.approvedAmount.value).filter((v):v is number=>v!==null).sort((a,b)=>a-b);
    const quantile=(p:number)=>{if(!amounts.length)return null;const i=(amounts.length-1)*p,lo=Math.floor(i);return amounts[lo]!+(amounts[Math.ceil(i)]!-amounts[lo]!)*(i-lo);};
    const q1=quantile(.25),q3=quantile(.75),median=quantile(.5);
    const upperFence=q1!==null&&q3!==null?q3+1.5*(q3-q1):null;
    const lowerFence=q1!==null&&q3!==null?q1-1.5*(q3-q1):null;
    const exceptions=approved.filter(r=>amounts.length>=4&&r.approvedAmount.value!==null&&upperFence!==null&&lowerFence!==null&&(r.approvedAmount.value>upperFence||r.approvedAmount.value<lowerFence))
      .sort((a,b)=>Math.abs(b.approvedAmount.value!-median!)-Math.abs(a.approvedAmount.value!-median!))
      .map(r=>({id:r.variationId,approvalDate:r.approvalDate,amount:r.approvedAmount.value!,authority:r.authority,
        scope:reportingScope(r.approvalDate,ledger.dataDateIso),otherRecordsAmount:sum(approved.filter(v=>v!==r)),
        otherMin:approved.filter(v=>v!==r&&v.approvedAmount.value!==null).reduce((n,v)=>Math.min(n,v.approvedAmount.value!),Infinity),
        otherMax:approved.filter(v=>v!==r&&v.approvedAmount.value!==null).reduce((n,v)=>Math.max(n,v.approvedAmount.value!),-Infinity),
        sourceRefs:['evidence-document:'+r.receipt.documentId+':'+r.receipt.locator]}));
    const aggregates=ledger.costPosition.filter(r=>r.currency===currency&&r.taxBasis===taxBasis&&r.values['approved variations']!=null).map(r=>({asOf:r.asOf,amount:r.values['approved variations']!,
      datedApprovals:slice(r.asOf),difference:slice(r.asOf).amount===null?null:r.values['approved variations']!-slice(r.asOf).amount!,sourceRefs:r.receipts}));
    return {currency,taxBasis,sourceCount:records.length,approvedSourceCount:approved.length,current,future:{count:future.length,amount:sum(future)},
      undatedCount:approved.filter(r=>!r.approvalDate).length,unknownAmountCount:approved.filter(r=>r.approvedAmount.value===null).length,fullAmount:sum(approved),median,upperFence,lowerFence,exceptions,aggregates,
      amendments:amendments.filter(a=>a.currency===currency&&a.taxBasis===taxBasis&&taxBasis!=='unknown').map(a=>{const effective=slice(a.effectiveDate);const after=approved.filter(r=>r.approvalDate&&a.effectiveDate&&r.approvalDate>a.effectiveDate&&reportingScope(r.approvalDate,ledger.dataDateIso)==='as_of');return {...a,atEffectiveDate:effective,
        scope:reportingScope(a.effectiveDate,ledger.dataDateIso),afterEffectiveThroughDataDate:{count:after.length,amount:a.effectiveDate&&ledger.dataDateIso?sum(after):null},
        differenceAtEffectiveDate:effective.amount===null?null:a.amount-effective.amount};}),
      interpretation:'Source approval status is preserved. Compare amounts only within the stated currency and tax basis. Amendment and cost totals require a line-item scope reconciliation; date and amount differences do not establish error, intent, or entitlement. Outliers use the 1.5 × interquartile-range rule with at least four known values.'};
  })};
}

/** An index can be arithmetically valid while its underlying amounts have no
 * demonstrated correspondence to schedule progress or certificate periods. */
export function costBasisReview(ledger:CanonicalCommercialModel,certificates:ReturnCertificateProfile){
  return ledger.costPosition.map(row=>{
    const v=row.values,bac=v.bac??null,pv=v.pv??null,ev=v.ev??null,ac=v.ac??null;
    const pct=(n:number|null)=>n!==null&&bac!==null&&bac>0?n/bac*100:null;
    const group=certificates.groups.find(g=>g.currency===row.currency&&g.taxBasis===row.taxBasis&&row.taxBasis!=='unknown');
    const net=group?.totals?.netCertifiedAmount??null;
    return {currency:row.currency,taxBasis:row.taxBasis,asOf:row.asOf,bac,pv,ev,ac,plannedPercentOfBudget:pct(pv),earnedPercentOfBudget:pct(ev),
      certificatePeriodNet:net,certificateDate:certificates.dataDateIso,certificateDateMatches:row.asOf===certificates.dataDateIso,
      actualCostToCertificateRatio:ac!==null&&net!==null&&net!==0&&row.asOf===certificates.dataDateIso?ac/net:null,
      spi:ev!==null&&pv!==null&&pv>0?ev/pv:null,cpi:ev!==null&&ac!==null&&ac>0?ev/ac:null,
      interpretation:'SPI and CPI check arithmetic within the cost source. Cost-weighted EV/PV, duration-weighted schedule progress, accrued cost and certificate-period values are different measures. Their amounts remain unreconciled until a dated CBS/WBS/certificate bridge explains scope, valuation and timing. Multiplying schedule progress by BAC is an illustration, not a calculated PV or EV.'};
  });
}
