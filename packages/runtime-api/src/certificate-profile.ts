import {dateValue,partitionAsOf} from '../../truth-kernel/src';
import type {CanonicalCommercialModel} from './commercial-canonical';

/** Source certificate arithmetic is useful even when certification events and cash are unknown.
 * These sums never feed certified income, paid income, or a funding requirement. */
export function certificateProfile(ledger:CanonicalCommercialModel){
  const date=ledger.dataDateIso,cutoff=dateValue(date??'');
  const components=['grossWork','variations','retentionDeduction','advanceRecovery','netCertifiedAmount'] as const;
  const groups=new Map<string,typeof ledger.payments>();
  for(const row of ledger.payments){const m=row.amounts.netCertifiedAmount,key=JSON.stringify([m.currency,m.taxBasis]);const g=groups.get(key)??[];g.push(row);groups.set(key,g);}
  return {dataDateIso:cutoff,dateBasis:'Source certificate period end; certification and payment event dates are separate.',
    groups:[...groups.entries()].map(([key,records])=>{
      const [currency,taxBasis]=JSON.parse(key) as [string|null,string];
      const partition=partitionAsOf(records,{name:'Certificate period source values',entity:'certificate',dataDateIso:date,dateBasis:'periodEnd',id:r=>r.paymentId,date:r=>r.periodEnd});
      const project=(rows:typeof records)=>rows.slice().sort((a,b)=>(a.periodEnd??'').localeCompare(b.periodEnd??'')||a.paymentId.localeCompare(b.paymentId)).map(r=>({
        id:r.paymentId,date:r.periodEnd,value:r.amounts.netCertifiedAmount.value,basis:r.certifiedAmountBasis,
        certificationDate:r.certificationDate,certificationConfirmedByDataDate:Boolean(cutoff&&r.certificationDate&&r.certificationDate<=cutoff),
        components:Object.fromEntries(components.map(k=>[k,r.amounts[k].currency===currency&&r.amounts[k].taxBasis===taxBasis?r.amounts[k].value:null])),sourceRefs:r.amounts.netCertifiedAmount.receipts,
        sourceStatus:r.sourceStatus,
      }));
      const asOf=project(partition.asOf),future=project(partition.future),undated=project(partition.undated);
      const total=(rows:typeof asOf)=>Object.fromEntries(components.map(k=>[k,rows.length&&rows.every(r=>r.components[k]!==null)?rows.reduce((n,r)=>n+r.components[k]!,0):null]));
      const duplicateIds=new Set(records.map(r=>r.paymentId)).size!==records.length;
      const incremental=records.length>0&&records.every(r=>r.certifiedAmountBasis==='incremental');
      const cumulative=records.some(r=>r.certifiedAmountBasis==='project_cumulative'||r.certifiedAmountBasis==='certificate_cumulative');
      // Unknown series basis permits an explicitly labelled arithmetic sum, never a certified cumulative balance.
      const summable=!duplicateIds&&!cumulative&&Boolean(currency)&&taxBasis!=='unknown';
      const totals=summable?total(asOf):null,futureTotals=summable?total(future):null;
      return {currency,taxBasis,as_of:asOf,future,undated,population:partition.population,totals,futureTotals,
        cumulativeBasis:incremental?'incremental_confirmed':summable?'source_row_sum_only':'not_aggregable',
        totalLabel:incremental?'Cumulative certificate amounts by period':'Sum of source certificate-period values',
        certificationUnconfirmedIds:asOf.filter(r=>!r.certificationConfirmedByDataDate).map(r=>r.id),
        latestPeriod:asOf.at(-1)??null,beforeLatestTotals:summable?total(asOf.slice(0,-1)):null,
        futureSourceStatusConflictIds:future.filter(r=>/certified|approved|paid/i.test(r.sourceStatus??'')).map(r=>r.id),
        profileEndIso:future.at(-1)?.date??asOf.at(-1)?.date??null,
        advanceRecoverySourceTotal:summable?total([...asOf,...future]).advanceRecovery:null,
        interpretation:'Future-period records are a prospective source profile, not current certification or cash. A source-row running sum does not establish incremental versus cumulative accounting basis.',
      };
    })};
}

export type ReturnCertificateProfile=ReturnType<typeof certificateProfile>;
