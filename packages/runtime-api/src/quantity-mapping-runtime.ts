import {buildQuantityScheduleMapping, type QuantityScheduleMappingResult} from '../../cross-domain-mapping/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {cell,governedTables} from '../../truth-kernel/src';
import {resolveBoqSource} from './boq-source';
import {reportingState} from './reporting-state';
import {projectControlSchedule} from './canonical-time-claims';
import {reviewedBoqSections} from './boq-section-review';

/** Resolve only punctuation/space variants of *explicit* WBS identifiers.
 * Codes are not matched by similarity, suffix, activity title or number order.
 * Multiple matching WBS nodes remain ambiguous, never auto-selected. */
export const wbsSeparatorKey=(value:string|null|undefined)=>String(value??'').normalize('NFKC')
 .trim().toLowerCase().replace(/[\s_\\\/-]+/g,'.').replace(/\.+/g,'.').replace(/^\.|\.$/g,'');
export function indexWbsSeparatorCodes(nodes:CanonicalScheduleModel['wbs']){
 const index=new Map<string,CanonicalScheduleModel['wbs']>();
 for(const node of nodes)for(const key of new Set([node.wbsId,node.code].map(wbsSeparatorKey).filter(Boolean))){
  const matches=index.get(key)??[];
  matches.push(node);index.set(key,matches);
 }
 return index;
}

const mappings = new WeakMap<ProjectRuntimeState, {
  version: number;
  quantities: ProjectRuntimeState['quantities'];
  schedule: CanonicalScheduleModel;
  result: QuantityScheduleMappingResult | null;
}>();

/** All pages in one project version share the same mapping calculation. Source
 * changes advance the version; replacing either model also invalidates reuse. */
export function quantityMappingForState(state: ProjectRuntimeState, schedule: CanonicalScheduleModel) {
  // The raw state and its read-only Data-Date view previously scored every
  // BOQ/activity pair twice. Current-programme consumers now share the same
  // governed view, source revision, quantities and exact versioned result.
  // Non-current revisions keep their own original calculation authority.
  // Some direct callers supply only the version, quantities and schedule.
  // Such inputs have no adopted-programme evidence to scope; keep their
  // source-specific calculation without entering full-project reporting.
  // Real initialized project states still share their governed view.
  if(Array.isArray(state.schedules)&&Array.isArray(state.evidenceDocuments)&&state.controls&&state.activeEvidenceBasis){
    const scoped=reportingState(state);
    const current=projectControlSchedule(scoped)?.revision.model;
    if(current&&current.projectId===schedule.projectId&&current.sourceRevisionId===schedule.sourceRevisionId){
      state=scoped;schedule=current;
    }
  }
  const cached = mappings.get(state);
  if (cached?.version === state.version && cached.quantities === state.quantities && cached.schedule === schedule) {
    return cached.result;
  }
  const quantities=resolveBoqSource(state,schedule.sourceRevisionId).quantities??state.quantities;
  const result = quantities ? buildQuantityScheduleMapping(quantities, schedule) : null;
  if(result&&quantities&&Array.isArray(state.evidenceDocuments)){
    const source=resolveBoqSource(state,schedule.sourceRevisionId).boq;
    const tables=governedTables(state.evidenceDocuments.filter(d=>d.basisState!=='superseded'&&(d.sourceHashSha256===source?.sourceHashSha256||/boq|quantity|mapping/i.test(d.documentType))),[]);
    const sectionName=(s:string|null|undefined)=>String(s??'').normalize('NFKC').trim().replace(/&/g,' and ').replace(/^(?:section\s+)?\d+(?:\.\d+)*[.)\s:–—-]+/i,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
    const normalized=(s:string|null|undefined)=>String(s??'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
    const rows=tables.flatMap(t=>t.rows),byItem=new Map<string,typeof rows>();
    for(const row of rows){const key=normalized(cell(row,'item no','item number','boq item','boq item id'));if(!key)continue;const group=byItem.get(key)??[];group.push(row);byItem.set(key,group);}
    const wbs=new Map(schedule.wbs.map(w=>[w.wbsId,w]));
    const activitiesByWbs=new Map<string,string[]>();
    // The cycle-safe ancestor walk depends only on the start WBS; walk it once
    // per WBS and append each activity in the same source and ancestor order.
    const ancestorChains=new Map<string,string[]>();
    for(const activity of schedule.activities){
      if(!activity.wbsId)continue;
      let chain=ancestorChains.get(activity.wbsId);
      if(!chain){chain=[];let id:string|null=activity.wbsId;const seen=new Set<string>();while(id&&!seen.has(id)){seen.add(id);chain.push(id);id=wbs.get(id)?.parentWbsId??null;}ancestorChains.set(activity.wbsId,chain);}
      for(const id of chain){const list=activitiesByWbs.get(id);if(list)list.push(activity.activityId);else activitiesByWbs.set(id,[activity.activityId]);}
    }
    const wbsByCode=new Map<string,typeof schedule.wbs>();
    for(const node of schedule.wbs)for(const value of new Set([node.wbsId,node.code,node.name].map(normalized).filter(Boolean))){const list=wbsByCode.get(value)??[];list.push(node);wbsByCode.set(value,list);}
    const wbsBySeparatorCode=indexWbsSeparatorCodes(schedule.wbs);
    const wbsByName=new Map<string,typeof schedule.wbs>();
    for(const node of schedule.wbs){const k=sectionName(node.name);if(k)wbsByName.set(k,[...(wbsByName.get(k)??[]),node]);}
    const originalItems=new Map((source?.canonicalItems??[]).map(item=>[item.itemId,item]));
    const sectionReviews=reviewedBoqSections(state,schedule,quantities);
    const allocatedItemIds=new Set(quantities.scheduleRevisionId===schedule.sourceRevisionId?quantities.allocations.map(a=>a.quantityItemId):[]);
    // F45: an item number can repeat per BOQ bill. A source row belongs to an
    // item only when its stated section is the item's section, or, without a
    // stated section, when that item number is carried by one BOQ item only.
    // Rows of another bill never lend their section or WBS code to this item.
    const numberCounts=new Map<string,number>();
    for(const item of quantities.items){const key=normalized(item.itemNumber);if(key)numberCounts.set(key,(numberCounts.get(key)??0)+1);}
    result.sourceWbsLinks=quantities.items.map(item=>{
      const sameNumber=byItem.get(normalized(item.itemNumber))??[];
      const sourceRows=(numberCounts.get(normalized(item.itemNumber))??0)<=1?sameNumber:sameNumber.filter(r=>{
        const section=cell(r,'section','boq section','bill section');
        return !!section&&normalized(section)===normalized(item.section);
      });
      const original=originalItems.get(item.quantityItemId) as any;
      const codes=[...new Set([...sourceRows.map(r=>cell(r,'wbs code','wbs id','wbs','programme wbs','schedule wbs')),(item as any).wbsId,(item as any).wbsCode,original?.wbsId,original?.wbsCode].filter(Boolean).map(String))];
      // Repeated spellings of the same explicit code (VLC.01/VLC-01) do not
      // constitute a disagreement. Materially different codes still do.
      const codeIdentities=[...new Set(codes.map(wbsSeparatorKey).filter(Boolean))];
      const sourceCodeConflict=codeIdentities.length>1;
      const code=sourceCodeConflict?null:codes[0]??null;
      const explicit=code?wbsByCode.get(normalized(code))??[]:[];
      const separatorMatches=code&&explicit.length===0?wbsBySeparatorCode.get(wbsSeparatorKey(code))??[]:[];
      const sectionKeys=[...new Set([item.section,original?.section,...sourceRows.map(r=>cell(r,'section','section name','bill section','work section','work package','package'))].map(sectionName).filter(Boolean))];
      const exactSections=[item.section,original?.section].map(normalized).filter(Boolean);
      const sectionMatches=[...new Map([...sectionKeys.flatMap(section=>wbsByName.get(section)??[]),...exactSections.flatMap(section=>wbsByCode.get(section)??[])].map(node=>[node.wbsId,node])).values()];
      const review=item.section?sectionReviews.get(item.section):undefined;
      const canReviewSection=!sourceCodeConflict&&explicit.length===0&&separatorMatches.length===0&&!allocatedItemIds.has(item.quantityItemId);
      const reviewed=canReviewSection&&review;
      const selected=sourceCodeConflict?null:explicit.length===1?explicit[0]!:
        explicit.length===0&&separatorMatches.length===1?separatorMatches[0]!:
        reviewed?review.decision==='confirm'?wbs.get(review.wbsId!)??null:null:
        explicit.length===0&&separatorMatches.length===0&&sectionMatches.length===1?sectionMatches[0]!:null;
      const under=(id:string|null)=>{const seen=new Set<string>();while(id&&!seen.has(id)){if(id===selected?.wbsId)return true;seen.add(id);id=wbs.get(id)?.parentWbsId??null;}return false;};
      return {quantityItemId:item.quantityItemId,wbsCode:code,wbsId:selected?.wbsId??null,activityIds:selected?activitiesByWbs.get(selected.wbsId)??[]:[],
        ...(reviewed?{sectionReview:{decision:review.decision,reference:review.reference}}:{}),
        basis:sourceCodeConflict?'Conflicting source WBS codes':
          selected&&explicit.length===1?'Source WBS code matches the programme':
          selected&&separatorMatches.length===1?'Source WBS code uniquely matches the programme with separator normalisation; no item quantity allocated':
          reviewed?'User-'+(review.decision==='confirm'?'confirmed section-to-WBS scope association':'rejected section-based association')+'; reference: '+review.reference+'. No item quantity allocated':
          selected?'Source BOQ section matches one programme WBS name'+(code?'; supplied code '+code+' has no exact programme match':'')+'; quantity allocation remains separate':
          separatorMatches.length>1?'Ambiguous programme WBS code after separator normalisation; no mapping assigned':
          'WBS relationship is missing or does not resolve uniquely',
        sourceRefs:[...sourceRows.map(r=>'evidence-document:'+r.receipt.documentId+':'+r.receipt.locator),...(reviewed?['section-scope-review:'+review.reference]:[])]};
    });
    result.sourceWbsCoveragePercent=result.sourceWbsLinks.length?result.sourceWbsLinks.filter(r=>r.wbsId).length/result.sourceWbsLinks.length*100:null;
  }
  if(result)result.userCandidateLinks=(state.boqActivityLinkCandidates??[])
    .filter(row=>row.sourceRevisionId===schedule.sourceRevisionId&&row.boqRevisionId===result.boqRevisionId)
    .map(row=>({quantityItemId:row.quantityItemId,activityId:row.activityId,state:row.state,
      reason:row.reason,sourceRef:row.sourceRef,proposedBy:row.proposedBy}));
  mappings.set(state, {version: state.version, quantities: state.quantities, schedule, result});
  return result;
}
