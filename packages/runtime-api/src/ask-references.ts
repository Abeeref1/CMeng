import {createHash,randomUUID} from 'node:crypto';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import {parsePdfDocument,TesseractOcrProvider} from '../../pdf-document-parser/src';
import {AskError} from '../../project-ask/src/catalogue';
import type {AskSession} from '../../project-ask/src/types';
import type {ReferenceFile} from './ask-store';
export async function readAskReference(projectId:string,user:AskSession,filename:string,bytes:Buffer):Promise<ReferenceFile>{
  if(bytes.length>20*1024*1024)throw new AskError(413,'reference_too_large','Reference files may be up to 20 MB. Split larger reports into relevant sections.');
  const name=filename.replace(/[\\/\x00-\x1f]/g,'_').slice(0,180);
  if(!name)throw new AskError(400,'filename_required','A filename is required.');
  let pages:ReferenceFile['pages']=[],reading='Read successfully; reference only.';
  if(bytes.subarray(0,5).toString()==='%PDF-'){
    const ocr=new TesseractOcrProvider({languages:'eng+ara',timeoutMs:45000});
    try{const parsed=await parsePdfDocument(bytes,{ocrProvider:ocr});pages=parsed.pages.map(p=>({page:p.pageNumber,text:p.text,method:p.method}));reading=parsed.complete?'All '+parsed.totalPages+' pages read. OCR text remains subject to review.':parsed.processedPages+' of '+parsed.totalPages+' pages processed; '+parsed.unresolvedPages+' unresolved pages. Do not treat missing text as absent evidence.';}
    finally{await ocr.close();}
  }else if(/\.xlsx$/i.test(name)){
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as any);
    workbook.eachSheet(sheet=>{const lines:string[]=[];sheet.eachRow(row=>{lines.push((row.values as unknown[]).slice(1).map(v=>typeof v==='object'&&v!==null?JSON.stringify(v):String(v??'')).join('\t'));});pages.push({page:pages.length+1,text:sheet.name+'\n'+lines.join('\n'),method:'spreadsheet'});});
  }else if(/\.docx$/i.test(name)){
    const zip=await JSZip.loadAsync(bytes);const xml=await zip.file('word/document.xml')?.async('string');if(!xml)throw new AskError(422,'reference_unreadable','This Word document has no readable document body.');
    const text=xml.replace(/<\/w:p>/g,'\n').replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');pages=[{page:1,text,method:'word_text'}];reading='Word body read; pagination and embedded images require separate inspection.';
  }else if(/\.(txt|csv|tsv|md|json)$/i.test(name)){pages=[{page:1,text:bytes.toString('utf8'),method:'text'}];}
  else throw new AskError(415,'reference_type_unsupported','Attach PDF, Word, Excel, CSV, TSV, JSON or text.');
  if(pages.reduce((n,p)=>n+p.text.length,0)>4_000_000)throw new AskError(413,'reference_text_too_large','This reference contains too much text for a conversation. Attach the relevant report sections.');
  return {schemaVersion:1,id:randomUUID(),projectId,workspaceId:user.workspaceId,ownerId:user.userId,filename:name,hash:createHash('sha256').update(bytes).digest('hex'),createdAt:new Date().toISOString(),state:'reference_only',reading,pages};
}
