import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import type {DocumentAssertion} from '../../module-challenge/src';

type ReadResult={assertions:DocumentAssertion[];diagnostics:string[]};
type ReadInput={bytes:Uint8Array;sourceRef:string;metrics:ReadonlySet<string>;requiredMetrics:ReadonlySet<string>;readerConfig:readonly unknown[]};
/** Retain completed extraction attempts, including "fact not found". A read
 * receipt never establishes a missing fact or full physical page coverage.
 * Reader failures are retried; a changed source, scope or OCR setting is read
 * again. Keeping this outside the derived position also survives eviction. */
export async function retainedControlAssertionRead(directory:string,input:ReadInput,read:()=>Promise<ReadResult>):Promise<ReadResult>{
  const sourceHash=createHash('sha256').update(input.bytes).digest('hex');
  const identity=JSON.stringify(['control-assertion-read-v1',sourceHash,input.sourceRef,[...input.requiredMetrics].sort(),input.readerConfig]);
  const file=join(directory,'control-read-cache',createHash('sha256').update(identity).digest('hex')+'.json');
  try{
    const saved=JSON.parse(await readFile(file,'utf8'));
    if(saved.identity===identity&&Array.isArray(saved.metrics)&&[...input.metrics].every(m=>saved.metrics.includes(m))&&Array.isArray(saved.result?.assertions)&&Array.isArray(saved.result?.diagnostics))
      return {assertions:saved.result.assertions.filter((a:DocumentAssertion)=>input.metrics.has(a.metric)),diagnostics:saved.result.diagnostics};
  }catch{/* A missing/unreadable receipt requires the original read. */}
  const result=await read();
  if(!result.diagnostics.some(d=>/PARSE_ERROR|OCR.*(?:ERROR|FAIL)|SOURCE_UNAVAILABLE/.test(d))){
    const temporary=file+'.'+randomUUID()+'.tmp';
    try{await mkdir(join(directory,'control-read-cache'),{recursive:true});await writeFile(temporary,JSON.stringify({identity,metrics:[...input.metrics],result}));await rename(temporary,file);}
    catch{await rm(temporary,{force:true}).catch(()=>{});}
  }
  return result;
}
