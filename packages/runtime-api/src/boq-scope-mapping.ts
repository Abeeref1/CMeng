/** F21: one shared rule that places each BOQ item in an area and in a
 * procurement package, used by Progress Breakdown (areas) and Delivery
 * (packages).
 *
 * Order: an explicit reference first (the BOQ row's own area / zone / plot /
 * package code, or the item reference a package register cites), then a
 * unique match only. More than one candidate at a step is ambiguous: the item
 * stays unmapped and the candidates are listed. Nothing is chosen by
 * similarity, order or value. Totals per group plus the unmapped part always
 * add up to the BOQ totals, because every item sits in exactly one bucket. */

import {cell} from '../../truth-kernel/src';

export type ScopeAssignmentState='explicit'|'unique_match'|'ambiguous'|'unmapped';
export interface ScopeAssignment {group:string|null;state:ScopeAssignmentState;basis:string;candidates:string[]}
export interface ScopeStep {values:Array<string|null|undefined>;basis:string}

const key=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const distinct=(values:Array<string|null|undefined>)=>{
 const seen=new Map<string,string>();
 for(const raw of values){const value=String(raw??'').normalize('NFKC').trim().replace(/\s+/g,' ');if(value&&!seen.has(key(value)))seen.set(key(value),value);}
 return [...seen.values()];
};

/** The first step with any candidate decides: one candidate maps the item,
 * several leave it unmapped with the candidates listed. The first step is the
 * explicit source reference; the later steps are unique matches. */
export function assignScope(explicit:ScopeStep,matches:ScopeStep[]=[]):ScopeAssignment{
 for(const [index,step] of [explicit,...matches].entries()){
  const candidates=distinct(step.values);
  if(!candidates.length)continue;
  if(candidates.length===1)return {group:candidates[0]!,state:index===0?'explicit':'unique_match',basis:step.basis,candidates};
  return {group:null,state:'ambiguous',basis:step.basis+': '+candidates.length+' different values; not chosen',candidates};
 }
 return {group:null,state:'unmapped',basis:'No explicit reference and no unique match',candidates:[]};
}

export interface ScopeReconciliationRow {itemId:string;itemNumber?:string|null;currency:string|null;value:number|null}
/** Count and value per group and currency, with the unmapped part shown, so
 * that groups + unmapped = BOQ total for every currency. Values are summed
 * only within one currency; an item without a readable value counts in the
 * item totals and never as zero value. */
export function reconcileScope<T extends ScopeReconciliationRow>(rows:T[],assignmentOf:(row:T)=>ScopeAssignment,unmappedLabel:string){
 const round=(v:number)=>Number(v.toFixed(6));
 const groups=new Map<string,{group:string;currency:string|null;itemCount:number;valuedItemCount:number;value:number|null;itemIds:string[]}>();
 const unmapped=new Map<string,{currency:string|null;itemCount:number;valuedItemCount:number;value:number|null;ambiguousItemCount:number}>();
 const totals=new Map<string,{currency:string|null;itemCount:number;valuedItemCount:number;value:number|null}>();
 const unmappedItems:Array<{itemId:string;itemNumber:string|null;currency:string|null;state:ScopeAssignmentState;basis:string;candidates:string[]}>=[];
 const add=(target:{itemCount:number;valuedItemCount:number;value:number|null},value:number|null)=>{target.itemCount++;if(value!==null){target.valuedItemCount++;target.value=round((target.value??0)+value);}};
 for(const row of rows){
  const value=typeof row.value==='number'&&Number.isFinite(row.value)?row.value:null,currencyKey=row.currency??'';
  const total=totals.get(currencyKey)??{currency:row.currency,itemCount:0,valuedItemCount:0,value:null};add(total,value);totals.set(currencyKey,total);
  const assignment=assignmentOf(row);
  if(assignment.group!==null){
   const id=JSON.stringify([assignment.group,currencyKey]);
   const group=groups.get(id)??{group:assignment.group,currency:row.currency,itemCount:0,valuedItemCount:0,value:null,itemIds:[]};
   add(group,value);group.itemIds.push(row.itemId);groups.set(id,group);
  }else{
   const part=unmapped.get(currencyKey)??{currency:row.currency,itemCount:0,valuedItemCount:0,value:null,ambiguousItemCount:0};
   add(part,value);if(assignment.state==='ambiguous')part.ambiguousItemCount++;unmapped.set(currencyKey,part);
   unmappedItems.push({itemId:row.itemId,itemNumber:row.itemNumber??null,currency:row.currency,state:assignment.state,basis:assignment.basis,candidates:assignment.candidates});
  }
 }
 const byCurrency=[...totals].map(([currencyKey,total])=>{
  const mapped=[...groups.values()].filter(g=>(g.currency??'')===currencyKey);
  const part=unmapped.get(currencyKey)??{currency:total.currency,itemCount:0,valuedItemCount:0,value:null,ambiguousItemCount:0};
  const mappedItemCount=mapped.reduce((n,g)=>n+g.itemCount,0);
  const mappedValued=mapped.filter(g=>g.value!==null);
  const mappedValue=mappedValued.length?round(mappedValued.reduce((s,g)=>s+g.value!,0)):null;
  const sum=mappedValue===null&&part.value===null?null:round((mappedValue??0)+(part.value??0));
  return {currency:total.currency,totalItemCount:total.itemCount,totalValue:total.value,valuedItemCount:total.valuedItemCount,
   mappedItemCount,mappedValue,unmappedItemCount:part.itemCount,unmappedValue:part.value,ambiguousItemCount:part.ambiguousItemCount,
   addsUp:mappedItemCount+part.itemCount===total.itemCount&&(sum===null?total.value===null:total.value!==null&&Math.abs(sum-total.value)<=1e-6*Math.max(1,Math.abs(total.value)))};
 });
 return {groups:[...groups.values()].sort((a,b)=>String(a.currency).localeCompare(String(b.currency))||(b.value??-Infinity)-(a.value??-Infinity)||a.group.localeCompare(b.group)),
  unmapped:{label:unmappedLabel,byCurrency:[...unmapped.values()],items:unmappedItems},
  byCurrency,addsUp:byCurrency.every(r=>r.addsUp),
  basis:'Every BOQ item is counted once: in its one group, or in the unmapped part when it has no explicit reference and no unique match, or when its candidates disagree (listed). Values are summed within one currency only.'};
}

export interface BoqReferenceItem {quantityItemId:string;itemNumber:string|null;section?:string|null}
export interface BoqReferenceResolution {reference:string;itemId:string|null;state:'exact_item_id'|'unique_item_number'|'ambiguous'|'not_found';candidates:string[]}
/** Resolve a BOQ item reference cited by another register: the exact BOQ item
 * ID, else an item number carried by exactly one BOQ item. A repeated item
 * number is ambiguous and lists the candidate item IDs; nothing is guessed. */
export function boqReferenceResolver(items:BoqReferenceItem[]){
 const ids=new Set(items.map(i=>i.quantityItemId)),byNumber=new Map<string,string[]>();
 for(const item of items){const k=key(String(item.itemNumber??''));if(!k)continue;byNumber.set(k,[...(byNumber.get(k)??[]),item.quantityItemId]);}
 return (reference:string):BoqReferenceResolution=>{
  const value=reference.trim();
  if(ids.has(value))return {reference:value,itemId:value,state:'exact_item_id',candidates:[value]};
  const matches=byNumber.get(key(value))??[];
  if(matches.length===1)return {reference:value,itemId:matches[0]!,state:'unique_item_number',candidates:matches};
  return {reference:value,itemId:null,state:matches.length?'ambiguous':'not_found',candidates:matches};
 };
}

/** The BOQ document's own source rows for each BOQ item: same item number,
 * and the same section when the row states one (else only when that item
 * number is carried by one BOQ item). Rows come from governed tables only. */
export function boqItemSourceRows(tables:import('../../truth-kernel/src').SourceTable[],boqHash:string|null|undefined,items:BoqReferenceItem[]){
 const result=new Map<string,import('../../truth-kernel/src').SourceRow[]>();
 if(!boqHash)return result;
 const byNumber=new Map<string,BoqReferenceItem[]>();
 for(const item of items){const k=key(String(item.itemNumber??''));if(k)byNumber.set(k,[...(byNumber.get(k)??[]),item]);}
 for(const table of tables){
  if(table.document.sourceHashSha256!==boqHash)continue;
  for(const row of table.rows){
   const number=key(cellOf(row,'item no','item number','boq item','boq item id'));if(!number)continue;
   const sameNumber=byNumber.get(number)??[],section=key(cellOf(row,'section','boq section','bill section'));
   const matches=section?sameNumber.filter(item=>key(String(item.section??''))===section):sameNumber.length===1?sameNumber:[];
   if(matches.length!==1)continue;
   const id=matches[0]!.quantityItemId;result.set(id,[...(result.get(id)??[]),row]);
  }
 }
 return result;
}
const cellOf=(row:import('../../truth-kernel/src').SourceRow,...names:string[])=>cell(row,...names);
