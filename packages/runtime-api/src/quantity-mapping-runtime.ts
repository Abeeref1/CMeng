import {buildQuantityScheduleMapping, type QuantityScheduleMappingResult} from '../../cross-domain-mapping/src';
import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';
import {cell,governedTables} from '../../truth-kernel/src';
import {resolveBoqSource} from './boq-source';

const mappings = new WeakMap<ProjectRuntimeState, {
  version: number;
  quantities: ProjectRuntimeState['quantities'];
  schedule: CanonicalScheduleModel;
  result: QuantityScheduleMappingResult | null;
}>();

/** All pages in one project version share the same mapping calculation. Source
 * changes advance the version; replacing either model also invalidates reuse. */
export function quantityMappingForState(state: ProjectRuntimeState, schedule: CanonicalScheduleModel) {
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
    for(const activity of schedule.activities){let id=activity.wbsId;const seen=new Set<string>();while(id&&!seen.has(id)){seen.add(id);const list=activitiesByWbs.get(id)??[];list.push(activity.activityId);activitiesByWbs.set(id,list);id=wbs.get(id)?.parentWbsId??null;}}
    const wbsByCode=new Map<string,typeof schedule.wbs>();
    for(const node of schedule.wbs)for(const value of new Set([node.wbsId,node.code,node.name].map(normalized).filter(Boolean))){const list=wbsByCode.get(value)??[];list.push(node);wbsByCode.set(value,list);}
    const wbsByName=new Map<string,typeof schedule.wbs>();
    for(const node of schedule.wbs){const k=sectionName(node.name);if(k)wbsByName.set(k,[...(wbsByName.get(k)??[]),node]);}
    const originalItems=new Map((source?.canonicalItems??[]).map(item=>[item.itemId,item]));
    result.sourceWbsLinks=quantities.items.map(item=>{
      const sourceRows=byItem.get(normalized(item.itemNumber))??[];
      const original=originalItems.get(item.quantityItemId) as any;
      const codes=[...new Set([...sourceRows.map(r=>cell(r,'wbs code','wbs id','wbs','programme wbs','schedule wbs')),(item as any).wbsId,(item as any).wbsCode,original?.wbsId,original?.wbsCode].filter(Boolean).map(String))];
      const code=codes.length===1?codes[0]!:null;
      const explicit=code?wbsByCode.get(normalized(code))??[]:[];
      const sectionKeys=[...new Set([item.section,original?.section,...sourceRows.map(r=>cell(r,'section','section name','bill section','work section','work package','package'))].map(sectionName).filter(Boolean))];
      const exactSections=[item.section,original?.section].map(normalized).filter(Boolean);
      const sectionMatches=[...new Map([...sectionKeys.flatMap(section=>wbsByName.get(section)??[]),...exactSections.flatMap(section=>wbsByCode.get(section)??[])].map(node=>[node.wbsId,node])).values()];
      const selected=codes.length>1?null:explicit.length===1?explicit[0]!:explicit.length===0&&sectionMatches.length===1?sectionMatches[0]!:null;
      const under=(id:string|null)=>{const seen=new Set<string>();while(id&&!seen.has(id)){if(id===selected?.wbsId)return true;seen.add(id);id=wbs.get(id)?.parentWbsId??null;}return false;};
      return {quantityItemId:item.quantityItemId,wbsCode:code,wbsId:selected?.wbsId??null,activityIds:selected?activitiesByWbs.get(selected.wbsId)??[]:[],
        basis:explicit.length===1?'Source WBS code matches the programme':selected?'Source BOQ section matches one programme WBS name'+(code?'; supplied code '+code+' has no exact programme match':'')+'; quantity allocation remains separate':codes.length>1?'Conflicting source WBS codes':'WBS relationship is missing or does not resolve uniquely',
        sourceRefs:sourceRows.map(r=>'evidence-document:'+r.receipt.documentId+':'+r.receipt.locator)};
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
