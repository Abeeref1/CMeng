import type {ProjectRuntimeState} from './project-state-types';
import {commercialPositionForState} from './commercial-runtime';
import {projectDataDate} from './canonical-time-claims';
/** Retained certificate values are a certified financial measure, never a
 * substitute for measured physical installation. Mixed currencies stay apart. */
export function sourceProgressEvidence(state:ProjectRuntimeState){
 const existing=state.controls.progressEvidence;
 if(typeof existing.certified?.valuePercent==='number'&&Number.isFinite(existing.certified.valuePercent))return existing;
 const position=commercialPositionForState(state) as any;
 const rows=position.heldEvidence?.certifiedProgress?.rows??[];
 if(rows.length!==1||typeof rows[0].valuePercent!=='number')return existing;
 const row=rows[0];
 return {...existing,certified:{valuePercent:row.valuePercent,asOfIso:position.sourceLedger?.dataDateIso??position.dataDateIso??projectDataDate(state),coveragePercent:null,
   sourceRefs:[...row.sourceRefs,'Certified financial work / current contract · '+row.currency+' · '+row.taxBasis],
   basis:row.basis}};
}
