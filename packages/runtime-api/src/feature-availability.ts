import {featureAvailability,type FeatureAvailability} from '../../truth-kernel/src';

export interface RuntimeFeatureAvailability {
  state: FeatureAvailability;
  reason: string;
  prerequisiteCount: number | null;
  establishedResultCount: number | null;
}

const array=(value:unknown):any[]=>Array.isArray(value)?value:[];
const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;

export function moduleFeatureAvailability(key:string,data:unknown):RuntimeFeatureAvailability {
  const d=(data&&typeof data==='object'?data:{}) as any;
  if(key==='forecast-history'){
    const points=array(d.points);
    return {
      state:featureAvailability({hasEstablishedResult:points.length>=2,hasUsefulEvidence:points.length>=1,prerequisitesSatisfied:points.length>=2}),
      reason:points.length>=2?'Two or more comparable revisions are available for a completion trend.':
        points.length===1?'Only one comparable programme revision exists. Show the current completion position, not a trend.':
        'No comparable programme revision is available for completion history.',
      prerequisiteCount:points.length,establishedResultCount:points.length>=2?points.length:null
    };
  }
  if(key==='windows-analysis'){
    const windows=array(d.windows),revisionLabels=d.revisionLabels&&typeof d.revisionLabels==='object'?Object.keys(d.revisionLabels).length:0;
    const comparable=Math.max(revisionLabels,windows.length?windows.length+1:0);
    return {
      state:featureAvailability({hasEstablishedResult:windows.length>0,hasUsefulEvidence:comparable>0,prerequisitesSatisfied:comparable>=2}),
      reason:windows.length?'Comparable programme states are available for window analysis.':
        comparable===1?'Only one comparable programme state exists. A delay window requires at least two comparable programme states.':
        'No comparable programme states are available for delay-window analysis.',
      prerequisiteCount:comparable,establishedResultCount:windows.length||null
    };
  }
  if(key==='challenge-contract'){
    const f=d.boqFeasibility??{},checks=array(f.activityChecks);
    const calculated=checks.filter((row:any)=>['fits','exceeds'].includes(row?.scheduleState)||typeof row?.requiredAveragePeople==='number').length;
    const boqCount=number(d.suppliedBoq?.itemCount)??array(d.suppliedBoq?.rows).length;
    const useful=boqCount>0||checks.length>0||Boolean(d.sourceLaborEvidence);
    return {
      state:featureAvailability({hasEstablishedResult:calculated>0,hasUsefulEvidence:useful,prerequisitesSatisfied:calculated>0}),
      reason:calculated>0?'Quantity/productivity/resource evidence supports at least one independent feasibility check.':
        useful?'Useful source evidence is available, but the quantity/productivity/resource prerequisites for a defensible challenge are incomplete.':
        'No useful quantity/productivity/resource evidence is available for a feasibility challenge.',
      prerequisiteCount:checks.length||boqCount||null,establishedResultCount:calculated||null
    };
  }
  if(key==='quantity-scurve'){
    const series=array(d.series),mapped=series.filter((row:any)=>array(row?.points).length>0).length;
    const measured=d.installedQuantityStatus?.state==='available'||number(d.measurementReview?.measuredItemCount)!==null&&Number(d.measurementReview?.measuredItemCount)>0;
    const boqCount=number(d.boqItemCount)??0;
    const useful=boqCount>0||series.length>0||Boolean(d.boqRevisionId)||Boolean(d.measurementReview);
    return {
      state:featureAvailability({hasEstablishedResult:mapped>0||measured,hasUsefulEvidence:useful,prerequisitesSatisfied:mapped>0||measured}),
      reason:mapped>0||measured?'A mapped planned quantity curve or measured installed-quantity position is available.':
        useful?'BOQ/quantity evidence is available, but a planned curve needs governed mapping and installed progress needs dated quantity evidence.':
        'No BOQ or installed-quantity evidence is available.',
      prerequisiteCount:boqCount||null,establishedResultCount:mapped||null
    };
  }
  return {state:'active',reason:'The feature has no additional conditional activation rule.',prerequisiteCount:null,establishedResultCount:null};
}
