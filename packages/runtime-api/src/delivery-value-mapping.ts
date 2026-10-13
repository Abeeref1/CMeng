import {canonicalHeader,type SourceRow} from '../../truth-kernel/src';
export const assetFlagFields=['tag installed','commissioned','o m manual','warranty'] as const;
export function assetValueMapping(input:unknown,columns:Record<string,string>,rows:SourceRow[],kind:string,referenceInput:unknown){
 if(input===undefined)return {};
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Asset value mappings must name source fields and exact retained values.');
 const valueMappings:Record<string,Record<string,'Yes'|'No'|null>>={};
 for(const [rawField,mapping] of Object.entries(input)){
  const field=canonicalHeader(rawField);if(kind!=='asset'||!assetFlagFields.includes(field as any)||!Object.hasOwn(columns,field))throw new Error('Value mapping requires an asset flag field and its selected source column.');
  if(Object.hasOwn(valueMappings,field)||!mapping||typeof mapping!=='object'||Array.isArray(mapping))throw new Error('Each flag field must have one exact-value mapping.');
  const values=new Set(rows.map(r=>String(r.cells[canonicalHeader(columns[field]!)]??''))),mapped:Record<string,'Yes'|'No'|null>=Object.create(null);
  for(const [source,target] of Object.entries(mapping)){
   if(!values.has(source)||['__proto__','constructor','prototype'].includes(source))throw new Error('Map only exact values present in the retained source column.');
   if(target!==null&&target!=='Yes'&&target!=='No')throw new Error('Interpret asset flags as Yes, No or unresolved.');
   if(!source.trim()&&target!==null)throw new Error('A blank source flag must remain unresolved.');
   mapped[source]=target;
  }
  if(Object.keys(mapped).length)valueMappings[field]=mapped;
 }
 const reference=String(referenceInput??'').trim();if(Object.keys(valueMappings).length&&!reference)throw new Error('Enter the supporting source flag interpretation reference.');
 return {valueMappings,reference};
}
