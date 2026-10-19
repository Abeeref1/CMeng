const IDENTITY_TOKEN=/[\p{L}\p{N}_:@.\/-]+/gu;
// T11: the identity tokens of a string depend only on the string. Every page of
// a project repeats the same identities and fact strings, so each string is
// tokenised once per worker (bounded; long free text is not kept).
const stringTokens=new Map<string,readonly string[]>();
function identityTokens(text:string):readonly string[]{
 const known=stringTokens.get(text);if(known)return known;
 const tokens=text.match(IDENTITY_TOKEN)??[];
 if(text.length<=2048){if(stringTokens.size>=65536)stringTokens.clear();stringTokens.set(text,tokens);}
 return tokens;
}
const BASIS_LABELS:Record<string,string>={execution_control:'Execution activities',source_records:'Source activity records',unfinished_execution:'Remaining execution activities'};
/** Select presentation aliases only for identities present in the response.
 * Source IDs and the full label catalogue remain in the original producer. */
export function responseSourceLabels(catalogue:Record<string,string>|undefined,value:unknown):Record<string,string>{
 const selected:Record<string,string>={};
 catalogue={...(catalogue??{})};
 const scanned=new Set<object>();
 // T11: the identity pass walks the same objects in the same order (same
 // skipped key, same once-only objects) as the alias pass did, so it records
 // the strings for the alias pass instead of walking the response twice.
 const strings:string[]=[];
 const identify=(input:any):void=>{
  if(typeof input==='string'){strings.push(input);return;}
  if(!input||typeof input!=='object'||scanned.has(input))return;scanned.add(input);
  if(Array.isArray(input)){input.forEach(identify);return;}
  // Same four identities, labels and order as before, without building them as arrays for every object.
  const populationLabel=input.name??input.populationName??BASIS_LABELS[String(input.basis)],revisionLabel=input.label??input.revisionName??input.sourceFilename,itemLabel=input.itemNumber;
  if(typeof input.populationId==='string'&&typeof populationLabel==='string'&&populationLabel.trim())catalogue![input.populationId]=populationLabel.trim();
  if(typeof input.revisionId==='string'&&typeof revisionLabel==='string'&&revisionLabel.trim())catalogue![input.revisionId]=revisionLabel.trim();
  if(typeof input.itemId==='string'&&typeof itemLabel==='string'&&itemLabel.trim())catalogue![input.itemId]=itemLabel.trim();
  if(typeof input.quantityItemId==='string'&&typeof itemLabel==='string'&&itemLabel.trim())catalogue![input.quantityItemId]=itemLabel.trim();
  for(const key in input)if(key!=='sourceLabels'&&Object.hasOwn(input,key))identify(input[key]);
 };
 identify(value);
 // A string or token selects the same aliases every time it is read (the
 // catalogue is complete before this pass), so each is read once.
 const readStrings=new Set<string>(),readTokens=new Set<string>();
 const add=(token:string)=>{
  if(readTokens.has(token))return;readTokens.add(token);
  let candidate=token;
  for(let depth=0;depth<8&&candidate;depth++){
   if(Object.hasOwn(catalogue,candidate)){selected[candidate]=catalogue[candidate]!;break;}
   const last=candidate.lastIndexOf(':');if(last<0)break;candidate=candidate.slice(0,last);
  }
 };
 for(const text of strings){
  if(readStrings.has(text))continue;readStrings.add(text);
  add(text);for(const token of identityTokens(text))add(token);
 }
 return selected;
}
