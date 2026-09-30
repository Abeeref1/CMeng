import type {CanonicalResource} from './types';

export type ResourceBusinessClass =
  | 'labor'
  | 'equipment'
  | 'material'
  | 'cost'
  | 'quantity'
  | 'weight_progress'
  | 'other';

type ResourceSemanticInput = Pick<CanonicalResource,'resourceType'|'name'|'shortName'|'unitName'|'unitAbbreviation'|'priceTimeUnit'>;

function normalized(values:(string|null|undefined)[]):string {
  return values.filter(Boolean).join(' ').toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
}

export function resourceBusinessClass(resource:ResourceSemanticInput):ResourceBusinessClass {
  const unitText=normalized([resource.unitName,resource.unitAbbreviation,resource.priceTimeUnit]);
  const nameText=normalized([resource.name,resource.shortName]);
  const strongWeight=/^(?:physical\s*)?weight(?:age)?(?:\s*progress)?$|^progress\s*weight$/;
  const strongQuantity=/^(?:qty|quantity|quantities|measured\s*quantity)$/;
  const strongCost=/^(?:cost|amount|value|currency)$/;

  if(/\bphysical\s*weight(?:age)?\b|\bweightage\b|\bprogress\s*weight\b|\bweighted\s*progress\b|\bpercent(?:age)?\b|%/.test(unitText)||strongWeight.test(nameText))return 'weight_progress';
  if(/\bqty\b|\bquantity\b|\bquantities\b|\bmeasured\s*quantity\b/.test(unitText)||strongQuantity.test(nameText))return 'quantity';
  if(/\bcurrency\b|\baed\b|\bsar\b|\busd\b|\beur\b|\bqar\b|\bkwd\b|\bomr\b|\bbhd\b/.test(unitText)||strongCost.test(nameText))return 'cost';

  if(resource.resourceType==='labor')return 'labor';
  if(resource.resourceType==='material')return 'material';
  if(resource.resourceType==='nonlabor')return 'equipment';

  if(/\blabou?r\b|\bmanpower\b|\bcrew\b|\bworker\b|\btechnician\b|\bengineer\b/.test(nameText))return 'labor';
  if(/\bcrane\b|\bplant\b|\bequipment\b|\bmachine\b|\bvehicle\b/.test(nameText))return 'equipment';
  return 'other';
}

export function resourceCapacityEligible(businessClass:ResourceBusinessClass):boolean {
  return businessClass==='labor'||businessClass==='equipment';
}

export function resourceLaborEligible(resource:ResourceSemanticInput):boolean {
  return resourceBusinessClass(resource)==='labor';
}

export function resourceLaborHourEligible(resource:ResourceSemanticInput):boolean {
  if(resourceBusinessClass(resource)!=='labor')return false;
  const unitText=normalized([resource.unitName,resource.unitAbbreviation,resource.priceTimeUnit]);
  return /(?:^|\b)(?:h|hr|hrs|hour|hours)(?:\b|$)|qt\s*hour/.test(unitText);
}
