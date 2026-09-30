import type {CanonicalResource} from './types';

export type ResourceBusinessClass =
  | 'labor'
  | 'equipment'
  | 'material'
  | 'cost'
  | 'quantity'
  | 'weight_progress'
  | 'other';

export function resourceBusinessClass(
  resource: Pick<CanonicalResource,'resourceType'|'name'|'shortName'|'unitName'|'unitAbbreviation'|'priceTimeUnit'>,
): ResourceBusinessClass {
  const text=[
    resource.name,
    resource.shortName,
    resource.unitName,
    resource.unitAbbreviation,
    resource.priceTimeUnit,
  ].filter(Boolean).join(' ').toLowerCase().replace(/[_-]+/g,' ');

  if(/\bphysical\s*weight(?:age)?\b|\bweightage\b|\bprogress\s*weight\b|\bweighted\s*progress\b|\bpercent(?:age)?\b|%/.test(text))return 'weight_progress';
  if(/\bqty\b|\bquantity\b|\bquantities\b|\bmeasured\s*quantity\b/.test(text))return 'quantity';
  if(/\bcost\b|\bamount\b|\bvalue\b|\bcurrency\b|\baed\b|\bsar\b|\busd\b|\beur\b|\bqar\b|\bkwd\b|\bomr\b|\bbhd\b/.test(text))return 'cost';
  if(resource.resourceType==='labor')return 'labor';
  if(resource.resourceType==='material')return 'material';
  if(resource.resourceType==='nonlabor')return 'equipment';
  return 'other';
}

export function resourceCapacityEligible(
  businessClass: ResourceBusinessClass,
): boolean {
  return businessClass==='labor'||businessClass==='equipment';
}

export function resourceLaborEligible(
  resource: Pick<CanonicalResource,'resourceType'|'name'|'shortName'|'unitName'|'unitAbbreviation'|'priceTimeUnit'>,
): boolean {
  return resourceBusinessClass(resource)==='labor';
}
