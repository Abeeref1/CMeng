type IdentifiedItem={id:string;itemNumber:string|null;section:string|null;description:string|null;unit:string|null};
/** Identity is exact, unique in both revisions and independent of filename and row
 * position. Changed scope/unit, missing identifiers and duplicate item codes stay unresolved. */
export function boqItemContinuity(previous:IdentifiedItem[],current:IdentifiedItem[]){
  // A full retained BOQ can repeat its section, item description and unit
  // tens of thousands of times. Normalize each exact source string once for
  // this invocation, without storing evidence or decisions outside this call.
  // This is a bounded read cache, not an identity shortcut: source rows and
  // ambiguity checks below remain complete and unchanged.
  const normalizedValues=new Map<string,string>();
  const normalized=(value:string|null)=>{
    const raw=value??'';
    const cached=normalizedValues.get(raw);
    if(cached!==undefined)return cached;
    const clean=raw.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
    if(normalizedValues.size>=4096)normalizedValues.clear();
    normalizedValues.set(raw,clean);
    return clean;
  };
  const identity=(item:IdentifiedItem)=>item.itemNumber&&item.description&&item.unit
    ?JSON.stringify([normalized(item.itemNumber),normalized(item.section),normalized(item.description),normalized(item.unit)])
    :null;
  // Retain the complete identity comparison but not duplicate source rows in
  // each index entry. Repeated BOQ numbers/sections used to copy the whole
  // existing group on every insert (quadratic work for large source packets).
  // The only consumer needs uniqueness, not an array of duplicate rows.
  const index=(items:IdentifiedItem[])=>{
    const groups=new Map<string,{count:number;first:IdentifiedItem}>();
    const keys:(string|null)[]=[];
    for(const item of items){
      const key=identity(item);
      keys.push(key);
      if(!key)continue;
      const entry=groups.get(key);
      if(entry)entry.count++;
      else groups.set(key,{count:1,first:item});
    }
    return {groups,keys};
  };
  const before=index(previous),after=index(current),mapping=new Map<string,string>(),ids=new Set(current.map(i=>i.id));
  for(let index=0;index<previous.length;index++){
    const item=previous[index]!;
    // An unchanged native item ID remains the same identity, as before.
    if(ids.has(item.id)){mapping.set(item.id,item.id);continue;}
    const key=before.keys[index];
    // A repeated source identity in EITHER revision remains unresolved.
    if(key&&before.groups.get(key)?.count===1&&after.groups.get(key)?.count===1){
      mapping.set(item.id,after.groups.get(key)!.first.id);
    }
  }
  return mapping;
}
