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
  const result = state.quantities ? buildQuantityScheduleMapping(state.quantities, schedule) : null;
  if(result&&state.quantities&&Array.isArray(state.evidenceDocuments)){
    const source=resolveBoqSource(state,schedule.sourceRevisionId).boq;
    const tables=governedTables(state.evidenceDocuments.filter(d=>d.sourceHashSha256===source?.sourceHashSha256),[]);
    const normalized=(s:string|null|undefined)=>String(s??'').trim().replace(/\s+/g,' ').toLowerCase();
    const rows=tables.flatMap(t=>t.rows),byItem=new Map<string,typeof rows>();
    for(const row of rows){const key=normalized(cell(row,'item no','item number','boq item','boq item id'));if(!key)continue;const group=byItem.get(key)??[];group.push(row);byItem.set(key,group);}
    const wbs=new Map(schedule.wbs.map(w=>[w.wbsId,w]));
    result.sourceWbsLinks=state.quantities.items.map(item=>{
      const sourceRows=byItem.get(normalized(item.itemNumber))??[];
      const codes=[...new Set(sourceRows.map(r=>cell(r,'wbs code','wbs id','wbs')).filter(Boolean))];
      const code=codes.length===1?codes[0]!:null;
      const explicit=code?schedule.wbs.filter(w=>[w.wbsId,w.code,w.name].some(v=>normalized(v)===normalized(code))):[];
      const section=normalized(item.section),sectionMatches=section?schedule.wbs.filter(w=>normalized(w.name)===section):[];
      const selected=explicit.length===1?explicit[0]!:explicit.length===0&&sectionMatches.length===1?sectionMatches[0]!:null;
      const under=(id:string|null)=>{const seen=new Set<string>();while(id&&!seen.has(id)){if(id===selected?.wbsId)return true;seen.add(id);id=wbs.get(id)?.parentWbsId??null;}return false;};
      return {quantityItemId:item.quantityItemId,wbsCode:code,wbsId:selected?.wbsId??null,activityIds:selected?schedule.activities.filter(a=>under(a.wbsId)).map(a=>a.activityId):[],
        basis:explicit.length===1?'Source WBS code matches the programme':selected?'Source BOQ section matches one programme WBS name; quantity allocation remains separate':codes.length>1?'Conflicting source WBS codes':'WBS relationship is missing or does not resolve uniquely',
        sourceRefs:sourceRows.map(r=>'evidence-document:'+r.receipt.documentId+':'+r.receipt.locator)};
    });
    result.sourceWbsCoveragePercent=result.sourceWbsLinks.length?result.sourceWbsLinks.filter(r=>r.wbsId).length/result.sourceWbsLinks.length*100:null;
  }
  mappings.set(state, {version: state.version, quantities: state.quantities, schedule, result});
  return result;
}
