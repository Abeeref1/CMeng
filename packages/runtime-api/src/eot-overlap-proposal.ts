// P0-C (C9): when an effective amendment restates the completion date and the
// determinations register also awards EOT, CMeng does not know how much of the
// awarded EOT the amendment already contains. It proposes its best answer,
// with the basis stated, so a governing date always exists; the user confirms
// or corrects it once in Project Review. An unknown award is never treated as
// none: the proposal counts every awarded day it cannot place in the amendment.
// Best answer, in order of strength:
//   1. the difference between the original and the amended completion dates
//      (what the amended date actually contains);
//   2. the days the amendment states it incorporates;
//   3. the determination dates: those after the amendment took effect are
//      additional; earlier ones are taken as incorporated, and undated ones
//      as additional (never silently dropped).
export type OverlapProposalBasis='stated_in_amendment'|'amendment_date_difference'|'determination_dates';
export interface OverlapProposal{days:number;basis:OverlapProposalBasis;incorporatedDays:number|null;inEffectDays:number;reason:string}

const DAY=86400000;
const iso=(value:string|null)=>value&&/^\d{4}-\d{2}-\d{2}/.test(value)?Date.parse(value.slice(0,10)+'T00:00:00Z'):NaN;
const plural=(n:number)=>n+' day'+(n===1?'':'s');

export function amendmentOverlapProposal(input:{amendedIso:string;effectiveDate:string|null;statedIncorporatedDays:number|null;originalIso:string|null;
  determinations:ReadonlyArray<{days:number|null;dateIso:string|null}>;dataDateIso:string|null}):OverlapProposal{
  const cutoff=input.dataDateIso?.slice(0,10)??null;
  // In effect at the reporting date: dated on or before it, or undated (it is in the register).
  const inEffect=input.determinations.filter(d=>typeof d.days==='number'&&Number.isFinite(d.days)&&(d.dateIso===null||cutoff===null||d.dateIso.slice(0,10)<=cutoff));
  const total=inEffect.reduce((sum,d)=>sum+d.days!,0);
  const undated=inEffect.filter(d=>d.dateIso===null).length;
  const undatedNote=undated?' '+undated+' undated determination'+(undated===1?' is':'s are')+' counted as in effect.':'';
  const unknownDays=input.determinations.filter(d=>!(typeof d.days==='number'&&Number.isFinite(d.days))).length;
  const unknownNote=unknownDays?' '+unknownDays+' determination'+(unknownDays===1?' states':'s state')+' no days and '+(unknownDays===1?'is':'are')+' not counted; confirm '+(unknownDays===1?'it':'them')+'.':'';
  const original=iso(input.originalIso),amended=iso(input.amendedIso);
  if(Number.isFinite(original)&&Number.isFinite(amended)){
    const incorporated=Math.max(0,Math.round((amended-original)/DAY)),days=Math.max(0,total-incorporated);
    return {days,basis:'amendment_date_difference',incorporatedDays:incorporated,inEffectDays:total,
      reason:'The amendment moves completion from '+input.originalIso!.slice(0,10)+' to '+input.amendedIso.slice(0,10)+' ('+plural(incorporated)+'); the register awards '+plural(total)+' in effect, so '+plural(days)+' are additional.'+(typeof input.statedIncorporatedDays==='number'&&input.statedIncorporatedDays!==incorporated?' The amendment text also states '+plural(input.statedIncorporatedDays)+', which differs from its dates; the dates are used.':'')+undatedNote+unknownNote};
  }
  if(typeof input.statedIncorporatedDays==='number'&&Number.isFinite(input.statedIncorporatedDays)){
    const days=Math.max(0,total-input.statedIncorporatedDays);
    return {days,basis:'stated_in_amendment',incorporatedDays:input.statedIncorporatedDays,inEffectDays:total,
      reason:'The amendment states it includes '+plural(input.statedIncorporatedDays)+'; the register awards '+plural(total)+' in effect, so '+plural(days)+' are additional.'+undatedNote+unknownNote};
  }
  const effective=input.effectiveDate?.slice(0,10)??null;
  const after=inEffect.filter(d=>d.dateIso===null||effective===null||d.dateIso.slice(0,10)>effective);
  const days=effective===null?inEffect.filter(d=>d.dateIso===null).reduce((s,d)=>s+d.days!,0):after.reduce((sum,d)=>sum+d.days!,0);
  return {days,basis:'determination_dates',incorporatedDays:null,inEffectDays:total,
    reason:(effective?'Determinations dated after the amendment took effect ('+effective+') are taken as additional; earlier ones as already in the amendment':'The amendment has no effective date, so dated determinations are taken as already in it')+
      (undated?'; '+undated+' undated determination'+(undated===1?' is':'s are')+' taken as additional':'')+'. That gives '+plural(days)+' additional.'+unknownNote};
}

/** The proposal for a time basis: the one CMeng read from the sources, or, for a
 * basis entered without one, the stated days in the amendment against the awards. */
export function overlapProposalFor(basis:{overlapProposal?:OverlapProposal|null|{days:number;basis:string;incorporatedDays:number|null;inEffectDays:number;reason:string};incorporatedEotDays?:number|null;
  officialApprovedEotDays:number|null;registerDeterminationDays?:number|null}|null|undefined):OverlapProposal|null{
  if(!basis)return null;
  if(basis.overlapProposal)return basis.overlapProposal as OverlapProposal;
  const awarded=basis.officialApprovedEotDays??basis.registerDeterminationDays??null;
  if(awarded===null)return null;
  const stated=basis.incorporatedEotDays??null,days=Math.max(0,awarded-(stated??0));
  return {days,basis:stated===null?'determination_dates':'stated_in_amendment',incorporatedDays:stated,inEffectDays:awarded,
    reason:stated===null?'No incorporated days are stated, so all '+plural(awarded)+' awarded are taken as additional.':'The amendment states it includes '+plural(stated)+'; '+plural(awarded)+' are awarded, so '+plural(days)+' are additional.'};
}
