/** One shared reader for retained source references, so no page shows an
 * internal span code ("pdf_page:1:65:102") as if it were a location. The exact
 * references stay in the record for audit; people see "page 1", "pages 1, 2",
 * "row 14" or "paragraph 3". Self-contained so its source can be embedded in
 * the browser scripts, the same way the count helpers are. */
export function readableSourceLocations(refs:readonly unknown[],documentLabel?:(documentId:string)=>string|null|undefined):string{
  // Locations are grouped by the document they belong to when its name is known,
  // so "Amendment 2 page 9; Main contract pages 2, 3" never loses which file.
  const groups=new Map<string,{pages:Set<number>;rows:Set<number>;paragraphs:Set<number>;lines:Set<number>}>(),other:string[]=[];
  const group=(key:string)=>{let g=groups.get(key);if(!g){g={pages:new Set(),rows:new Set(),paragraphs:new Set(),lines:new Set()};groups.set(key,g);}return g;};
  for(const ref of refs){
    const text=String(ref??'').trim();if(!text)continue;
    const documentId=/evidence-document:([^:\s]+)/.exec(text)?.[1]??'';
    const name=documentId&&typeof documentLabel==='function'?documentLabel(documentId)??'':'';
    const page=/(?:^|:)(?:pdf_page|page)[:\s]+(\d+)/i.exec(text);
    if(page){group(name).pages.add(Number(page[1]));continue;}
    const row=/(?:^|:)(?:sheet_row|csv_row|row)[:\s]+(\d+)/i.exec(text);
    if(row){group(name).rows.add(Number(row[1]));continue;}
    const block=/(?:^|:)(?:docx_block|paragraph|docx_table_cell)[:\s]+(\d+)/i.exec(text);
    if(block){group(name).paragraphs.add(Number(block[1]));continue;}
    const line=/(?:^|:)(?:text_line|line)[:\s]+(\d+)/i.exec(text);
    if(line){group(name).lines.add(Number(line[1]));continue;}
    if(name){group(name);continue;}
    // An internal identifier is never shown; a plain written location is.
    if(!/[_:]/.test(text)&&!/^[0-9a-f-]{16,}$/i.test(text))other.push(text);
  }
  const list=(label:string,values:Set<number>)=>{
    const sorted=[...values].sort((a,b)=>a-b);if(!sorted.length)return '';
    const shown=sorted.slice(0,6).join(', ')+(sorted.length>6?' and '+(sorted.length-6)+' more':'');
    return (sorted.length===1?label:label+'s')+' '+shown;
  };
  const parts=[...groups.entries()].map(([name,g])=>{
    const where=[list('page',g.pages),list('row',g.rows),list('paragraph',g.paragraphs),list('line',g.lines)].filter(Boolean).join(', ');
    return [name,where].filter(Boolean).join(' ');
  }).filter(Boolean);
  parts.push(...[...new Set(other)].slice(0,3));
  return parts.length?parts.join('; '):'retained source text';
}
/** A money amount as people read it: 5840000000 becomes 5,840,000,000. */
export function readableAmount(value:unknown):string{
  const number=Number(value);
  if(value===null||value===undefined||value===''||!Number.isFinite(number))return String(value??'');
  return number.toLocaleString('en-US',{maximumFractionDigits:2});
}
declare const currentModuleResult:any;
/** Browser only: the document name for a retained document id, from the page's own source labels. */
export function sourceDocumentLabel(documentId:string):string|null{
  const labels=typeof currentModuleResult==='undefined'||!currentModuleResult?{}:(currentModuleResult.data?.sourceLabels||{});
  return labels['evidence-document:'+documentId]??labels[documentId]??null;
}
/** Browser source for the helpers, for embedding in page scripts. */
export function sourceLocationsSource():string{return readableSourceLocations.toString()+'\n'+readableAmount.toString()+'\n'+sourceDocumentLabel.toString()+'\n';}
