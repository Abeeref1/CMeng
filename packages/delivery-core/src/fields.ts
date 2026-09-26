import type {DeliveryKind} from './types';
export const commonDeliveryFields=['record reference','description','type','discipline','owner','status','status as of','raised date','due date','effective date'];
export const deliveryFields:Record<DeliveryKind,string[]>={
 package:['procurement type','lifecycle id','required on site date','forecast delivery date','package value','currency','unit','weighting basis','management weight','scope basis','high value scope','procurement required','programme representation required','material class',...['ordered','manufactured','shipped','delivered','accepted','released'].flatMap(s=>[s+' quantity',s+' date']),...['rfq','tender return','technical evaluation','commercial evaluation','recommendation','award','po','approval','manufacturing','fat','shipping','customs','delivery','acceptance','release','installation'].flatMap(s=>[s+' planned date',s+' forecast date',s+' actual date'])],
 supplier:['company','contact','email','phone','scope','mobilisation date'],
 submittal:['revision','planned issue','forecast issue','actual issue','required response','response date','approval date','rejection date','resubmission date','review cycles','ifc date','blocking work','variation reference','claim reference'],
 design:['revision','planned issue','forecast issue','actual issue','required response','response date','approval date','rejection date','resubmission date','review cycles','ifc date','blocking work','variation reference','claim reference'],
 workfront:['workfront type','work package','readiness basis'],
 quality:['severity','contractor','outcome','outcome date','actual date','rectified date','verification date','closed date','acceptance date','root cause','corrective action','preventive action','rework hours','rework cost','currency','handover blocker','programme consequence'],
 permit:['authority','submission date','review date','issue date','valid from','expiry date','expiry applicable','renewal required','required by','blocker'],
 hse:['incident date','report date','period start','period end','man hours','lost time injuries','frequency rate basis','corrective action','due date','actual date','verification date','closed date','programme consequence'],
 commissioning:['system','subsystem','test type','planned date','forecast date','actual date','outcome','outcome date','retest required','retest date','verification date','acceptance date','blocking issue'],
 asset:['category','criticality','manufacturer','make','model','serial number','installation date','inspection acceptance date','commissioning date','taking over date','warranty start','warranty end','om manual reference','as built reference','training reference'],
 snag:['severity','rectified date','verification date','closed date','acceptance date','handover blocker','corrective action','contractor'],
 spare:['part number','unit','required quantity','required date','delivered quantity','delivered date','accepted quantity','accepted date','stored quantity','stored date','asset linked quantity','asset linked date','handed over quantity','handed over date','storage location'],
 handover:['requirement','required evidence','blocking issue','verification date','acceptance date','handover blocker'],
 weather:['event start','event end','duration hours','weather source','recorded working impact hours','operational disruption','notice reference','claim reference','eot reference'],
 location:['location type','parent location id'],
 lifecycle:['stages','approval basis'],
 gate:['requirement','applicable','outcome','outcome date','satisfied date','required evidence','blocker'],
};
