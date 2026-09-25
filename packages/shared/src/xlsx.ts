import JSZip from 'jszip';
/** ExcelJS expects the usual default SpreadsheetML namespace. Valid producers
 * may bind it to a prefix. Normalize XML names, preserving source cell text. */
export async function readableXlsx(bytes:Uint8Array):Promise<Buffer>{
 const zip=await JSZip.loadAsync(bytes);let changed=false;
 for(const file of Object.values(zip.files).filter(f=>!f.dir&&/\.xml$/.test(f.name))){
  const xml=await file.async('string');
  const prefixes=[...xml.matchAll(/xmlns:([\w.-]+)=["'](http:\/\/schemas\.openxmlformats\.org\/(?:spreadsheetml\/2006\/main|package\/2006\/(?:relationships|content-types)))["']/g)];
  if(!prefixes.length)continue;
  const namespace=new Map(prefixes.map(m=>[m[1]!,m[2]!]));
  const normalized=xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]+>/g,tag=>{
   if(tag.startsWith('<!')||tag.startsWith('<?'))return tag;
   const prefix=/^<\/?([\w.-]+):/.exec(tag)?.[1];
   if(!prefix||!namespace.has(prefix))return tag;
   let out=tag.replace(new RegExp('^(</?)'+prefix+':'),'$1');
   const declaration=new RegExp('\\sxmlns:'+prefix+'=(["\'])[^"\']+\\1');
   if(declaration.test(out))out=out.replace(declaration,' xmlns="'+namespace.get(prefix)+'"');
   return out;
  });
  if(normalized!==xml){zip.file(file.name,normalized);changed=true;}
 }
 return changed?zip.generateAsync({type:'nodebuffer'}):Buffer.from(bytes);
}
