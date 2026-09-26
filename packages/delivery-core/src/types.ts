import type {SourceReceipt} from '../../truth-kernel/src';
export const deliveryKinds=['package','supplier','submittal','design','workfront','quality','permit','hse','commissioning','asset','snag','spare','handover','weather','location','lifecycle','gate'] as const;
export type DeliveryKind=typeof deliveryKinds[number];
export type DeliveryState='source_evidence'|'extracted_candidate'|'working'|'governed'|'verified'|'calculated'|'scenario'|'conflicted'|'stale'|'not_established';
export type DeliveryFields=Record<string,string|number|null>;
export interface DeliveryLinks {
 activityIds:string[];boqItemIds:string[];packageIds:string[];supplierIds:string[];locationIds:string[];assetIds:string[];recordIds:string[];
 boqAllocations:Array<{boqItemId:string;quantity:number;unit:string}>;
}
export interface DeliveryRecord {
 recordId:string;projectId:string;kind:DeliveryKind;reference:string|null;description:string|null;
 revision:string;state:DeliveryState;fields:DeliveryFields;links:DeliveryLinks;
 receipts:SourceReceipt[];diagnostics:string[];sourceActive:boolean;
}
export interface DeliveryDecision {
 recordId:string;sourceRevision:string;state:'working'|'governed'|'verified'|'scenario';note:string;
 fields:DeliveryFields;links:DeliveryLinks;supersedesId:string|null;actorId:string;recordedAt:string;
}
export interface DeliveryPopulation {
 kind:DeliveryKind;scopeId:string|null;recordIds:string[];fingerprint:string;note:string;actorId:string;recordedAt:string;
}
export interface DeliveryStateStore {
 schemaVersion:1;manual:DeliveryRecord[];decisions:DeliveryDecision[];populations:DeliveryPopulation[];
 mappings?:Array<{documentId:string;sourceHash:string;kind:DeliveryKind;columns:Record<string,string>;actorId:string;recordedAt:string}>;
}
export const emptyLinks=():DeliveryLinks=>({activityIds:[],boqItemIds:[],packageIds:[],supplierIds:[],locationIds:[],assetIds:[],recordIds:[],boqAllocations:[]});
export const deliveryLabels:Record<DeliveryKind,string>={package:'Procurement packages',supplier:'Suppliers & subcontractors',submittal:'Submittals',design:'RFI & design',workfront:'Construction workfronts',quality:'Quality & inspections',permit:'Permits & authorities',hse:'Construction HSE',commissioning:'Testing & commissioning',asset:'Asset & system handover',snag:'Snag & closeout',spare:'Spares & special tools',handover:'Handover requirements',weather:'Weather & disruption',location:'Locations',lifecycle:'Lifecycle templates',gate:'Readiness gates'};
export const kindIdentities:Record<DeliveryKind,string[]>={package:['package id','procurement package id'],supplier:['supplier id','subcontractor id'],submittal:['submittal id'],design:['rfi id','deliverable id','design id'],workfront:['workfront id'],quality:['ncr id','inspection id','wir id','mir id','quality id'],permit:['permit id'],hse:['incident id','hse record id','exposure id'],commissioning:['test id','test pack id'],asset:['asset id','asset tag'],snag:['snag id','punch id'],spare:['spare id','part id'],handover:['requirement id','handover requirement id'],weather:['weather id','disruption id'],location:['location id'],lifecycle:['lifecycle id'],gate:['gate id']};
export const lifecycleExamples=[
 {name:'Bulk local material',stages:['approval','po','delivery','acceptance','release','installation']},
 {name:'Imported long-lead equipment',stages:['submittal','approval','rfq','award','po','manufacturing','fat','shipping','customs','delivery','installation','commissioning']},
 {name:'Specialist subcontract',stages:['rfq','technical evaluation','commercial evaluation','recommendation','award','mobilisation','execution','inspection','handover']},
 {name:'Architectural finish',stages:['sample','mockup','approval','po','manufacturing','delivery','installation','inspection']},
];
