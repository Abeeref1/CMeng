import {commonDeliveryFields,deliveryFields,deliveryLifecycleStages} from './fields';
import {kindIdentities,lifecycleExamples,type DeliveryKind} from './types';

/** The document types the Delivery reader reads as one record kind when the
 * rows carry no stronger identity (delivery-records classifies each row). */
export const deliveryDocumentKinds:Readonly<Record<string,DeliveryKind>>={procurement_register:'package',interface_register:'interface',submittal_register:'submittal',rfi_register:'design',quality_ncr_register:'quality',permit_register:'permit',asset_register:'asset',testing_commissioning_register:'commissioning',hse_report:'hse'};

// Every record keeps its source cells; these are the column names the Delivery
// reader and its projections read from a record: identity and description,
// links to activities, BOQ items, packages, suppliers, locations and assets,
// the kind's own fields, and for packages and lifecycle templates the dated,
// duration and quantity columns of each lifecycle stage.
const linkColumns=['record reference','delivery record type','linked activity','boq item id','boq item','boq items','boq item no','boq ref','boq reference','boq item ref','boq item reference',
 'package id','procurement package id','supplier id','subcontractor id','location id','asset id','asset tag'];
const descriptionColumns=['description','package name','name','subject','test'];
const stageNames=[...new Set([...deliveryLifecycleStages,...lifecycleExamples.flatMap(example=>example.stages)])];
const stageDurationColumns=stageNames.flatMap(stage=>[stage+' duration',stage+' day basis',stage+' duration source',stage+' calendar id']);
const stageDateColumns=stageNames.flatMap(stage=>[stage+' planned date','planned '+stage+' date',stage+' planned','planned '+stage,
 stage+' forecast date','forecast '+stage+' date',stage+' forecast','forecast '+stage,
 stage+' actual date','actual '+stage+' date',stage+' date',stage+' actual','actual '+stage]);
const quantityColumns=['ordered','manufactured','shipped','delivered','accepted','released'].flatMap(stage=>[stage+' qty',stage+' as of']);
const packageColumns=[...stageDateColumns,...stageDurationColumns,...quantityColumns,'required on site','actual delivery','actual delivery date','current stage','stage'];

/** R1: the source column names the Delivery reader reads for one record kind. */
export function deliveryReaderColumns(kind:DeliveryKind):readonly string[]{
 return [...commonDeliveryFields,...deliveryFields[kind],...kindIdentities[kind],...linkColumns,...descriptionColumns,
  ...(kind==='package'?packageColumns:kind==='lifecycle'?stageDurationColumns:[]),
  ...(kind==='permit'?['permit type']:[])];
}
