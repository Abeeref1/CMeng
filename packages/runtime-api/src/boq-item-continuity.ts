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
  const before=index(previous),after=index(current),mapping=new Map<string,string>();
  // A native BOQ ID is authoritative only when it denotes exactly one source
  // row in EACH revision. A duplicate native ID makes every apparent match
  // ambiguous, even if its descriptions or positions appear similar.
  const idCounts=(items:IdentifiedItem[])=>{
    const counts=new Map<string,number>();
    for(const item of items)counts.set(item.id,(counts.get(item.id)??0)+1);
    return counts;
  };
  const previousIds=idCounts(previous),currentIds=idCounts(current);
  for(let index=0;index<previous.length;index++){
    const item=previous[index]!;
    // Do not accept the last row for a repeated prior native ID.
    if(previousIds.get(item.id)!==1)continue;
    // Native identity is strongest where unique; a duplicate in the current
    // source forbids fallback guessing for that same native ID.
    if(currentIds.has(item.id)){
      if(currentIds.get(item.id)===1)mapping.set(item.id,item.id);
      continue;
    }
    const key=before.keys[index];
    // A repeated source identity or duplicate target native ID is unresolved.
    if(key&&before.groups.get(key)?.count===1&&after.groups.get(key)?.count===1){
      const target=after.groups.get(key)!.first;
      if(currentIds.get(target.id)===1)mapping.set(item.id,target.id);
    }
  }
  return mapping;
}
