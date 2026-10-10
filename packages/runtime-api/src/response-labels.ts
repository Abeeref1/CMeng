/** Select presentation aliases only for identities present in the response.
 * Source IDs and the full label catalogue remain in the original producer. */
export function responseSourceLabels(catalogue:Record<string,string>|undefined,value:unknown):Record<string,string>{
 const selected:Record<string,string>={};if(!catalogue)return selected;
 const seen=new Set<object>();
 const add=(token:string)=>{
  let candidate=token;
  for(let depth=0;depth<8&&candidate;depth++){
   if(Object.hasOwn(catalogue,candidate)){selected[candidate]=catalogue[candidate]!;break;}
   const last=candidate.lastIndexOf(':');if(last<0)break;candidate=candidate.slice(0,last);
  }
 };
 const visit=(input:any,key='')=>{
  if(key==='sourceLabels')return;
  if(typeof input==='string'){
   add(input);for(const token of input.match(/[\p{L}\p{N}_:@.\/-]+/gu)??[])add(token);return;
  }
  if(!input||typeof input!=='object'||seen.has(input))return;seen.add(input);
  if(Array.isArray(input))input.forEach(v=>visit(v));else for(const[k,v]of Object.entries(input))visit(v,k);
 };
 visit(value);return selected;
}
