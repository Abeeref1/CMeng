import {operationalReporting,claimsReporting} from './reporting-state';
import {commercialCanonical} from './commercial-canonical';
import type {ProjectRuntimeState} from './project-state-types';

/** Relationships point to existing producers; Delivery does not own these facts. */
export function deliveryAuthorityCatalog(state:ProjectRuntimeState,kind:string):Array<{id:string;label:string;source:unknown}>{
 if(kind==='risk')return operationalReporting(state).risk.sourceRows.map(r=>({id:r.riskId,label:r.riskId+' · '+(r.rating??'Rating unresolved'),source:r}));
 if(kind==='variation')return commercialCanonical(state).variations.map(r=>({id:r.variationId,label:r.variationId+' · '+r.description,source:r}));
 const claims=claimsReporting(state);
 if(kind==='claim')return (claims?.source.claims??[]).map(r=>({id:r.claimId,label:r.claimId+' · '+r.title,source:r}));
 if(kind==='notice')return (claims?.source.notices??[]).map(r=>({id:r.noticeId,label:r.noticeId+' · '+r.subject,source:r}));
 return [];
}
