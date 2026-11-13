import {mkdirSync,readFileSync,writeFileSync,renameSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

/** Point 2 (13 Nov): one validated AI answer per source/layout structure, shared by every
 * project on this server. Keyed by the structure fingerprint, which already carries the
 * reader version: a new prompt, answer schema or schema catalogue never reuses an old answer.
 * Only answers that passed CMeng's own validation are stored; every reuse is validated
 * again against the source it is applied to. */
export type SemanticAiCacheKind='table'|'contract';
interface Entry {schema:1;kind:SemanticAiCacheKind;version:string;fingerprint:string;answer:unknown;savedAt:string}

const safe=(value:string)=>value.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,120);
const hex=/^[0-9a-f]{64}$/;

export class SemanticAiCache {
  private memory=new Map<string,unknown>();
  constructor(readonly directory:string|null){}
  private file(kind:SemanticAiCacheKind,version:string,fingerprint:string){return join(this.directory!,kind,safe(version),fingerprint+'.json');}
  get<T>(kind:SemanticAiCacheKind,version:string,fingerprint:string):T|null{
    if(!hex.test(fingerprint))return null;
    const key=kind+'|'+version+'|'+fingerprint;
    if(this.memory.has(key))return this.memory.get(key) as T;
    if(!this.directory)return null;
    try{
      const entry=JSON.parse(readFileSync(this.file(kind,version,fingerprint),'utf8')) as Entry;
      if(entry?.schema!==1||entry.kind!==kind||entry.version!==version||entry.fingerprint!==fingerprint||!entry.answer)return null;
      this.memory.set(key,entry.answer);return entry.answer as T;
    }catch{return null;}
  }
  put(kind:SemanticAiCacheKind,version:string,fingerprint:string,answer:unknown){
    if(!hex.test(fingerprint)||!answer)return;
    this.memory.set(kind+'|'+version+'|'+fingerprint,answer);
    if(!this.directory)return;
    try{
      const directory=join(this.directory,kind,safe(version));mkdirSync(directory,{recursive:true,mode:0o700});
      const path=this.file(kind,version,fingerprint),temp=path+'.'+randomUUID()+'.tmp';
      const entry:Entry={schema:1,kind,version,fingerprint,answer,savedAt:new Date().toISOString()};
      writeFileSync(temp,JSON.stringify(entry),{mode:0o600});
      const fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
      renameSync(temp,path);
    }catch{/* The answer stays in memory; a write failure never fails the reading. */}
  }
}

const shared=new Map<string,SemanticAiCache>();
/** The server's shared cache: CMENG_AI_SEMANTIC_CACHE_DIR, else a folder next to the AI
 * spending ledger (on the persistent volume). Without either it lives in memory only. */
export function configuredSemanticAiCache(env:NodeJS.ProcessEnv=process.env):SemanticAiCache{
  const directory=env.CMENG_AI_SEMANTIC_CACHE_DIR?.trim()||(env.CMENG_AI_USAGE_DIR?.trim()?join(env.CMENG_AI_USAGE_DIR.trim(),'semantic-cache'):'');
  const key=directory||':memory:';
  let cache=shared.get(key);if(!cache){cache=new SemanticAiCache(directory||null);shared.set(key,cache);}
  return cache;
}
