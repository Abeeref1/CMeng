type IdentifiedItem={id:string;itemNumber:string|null;section:string|null;description:string|null;unit:string|null};
const normalized=(value:string|null)=>(value??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
function identity(item:IdentifiedItem){return item.itemNumber&&item.description&&item.unit?JSON.stringify([normalized(item.itemNumber),normalized(item.section),normalized(item.description),normalized(item.unit)]):null;}
/** Identity is exact, unique in both revisions and independent of filename and row
 * position. Changed scope/unit, missing identifiers and duplicate item codes stay unresolved. */
export function boqItemContinuity(previous:IdentifiedItem[],current:IdentifiedItem[]){
  const index=(items:IdentifiedItem[])=>{const map=new Map<string,IdentifiedItem[]>();for(const item of items){const key=identity(item);if(key)map.set(key,[...(map.get(key)??[]),item]);}return map;};
  const before=index(previous),after=index(current),mapping=new Map<string,string>(),ids=new Set(current.map(i=>i.id));
  for(const item of previous){if(ids.has(item.id)){mapping.set(item.id,item.id);continue;}const key=identity(item);if(key&&before.get(key)?.length===1&&after.get(key)?.length===1)mapping.set(item.id,after.get(key)![0]!.id);}
  return mapping;
}
