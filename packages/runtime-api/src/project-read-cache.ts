import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,readdir,stat,statfs} from 'node:fs/promises';
import {join} from 'node:path';
import {gzip,gunzip} from 'node:zlib';
import {promisify} from 'node:util';
const gzipAsync=promisify(gzip),gunzipAsync=promisify(gunzip);
const COMPRESSED_MAGIC=Buffer.from('CMZ001');

// Cache the full calculated response even when its transport body exceeds the
// 2 MB screen budget; disk usage is still capped by the compressed 16 MB
// per-project cache and the free-space reserve. Page rendering limits remain unchanged.
export const MAX_PROJECT_READ_BYTES=8*1024*1024;
const DEFAULT_CACHE_BYTES=16*1024*1024;
const STORAGE_RESERVE_BYTES=512*1024*1024;
/** These are disposable projections, never uploads, snapshots or saved Ask results. */
export async function clearDerivedReadCaches(root:string,currentRelease?:string){
  const projects=join(root,'projects');
  for(const entry of await readdir(projects,{withFileTypes:true}).catch(()=>[])){
    if(!entry.isDirectory()||!/^[a-f0-9]{64}$/.test(entry.name))continue;
    const directory=join(projects,entry.name);
    const cacheDirectory=join(directory,'.analysis-reads');
    const cachedRelease=await readFile(join(cacheDirectory,'release'),'utf8').catch(()=>null);
    // Keep other releases' disposable calculations for safe rollback. Every
    // lookup uses an exact release + project version + page key, so old
    // results cannot be served as new facts. Bound storage per project and
    // remove only very old, orphaned cache entries.
    const expiry=Date.now()-7*24*60*60*1000;
    for(const name of await readdir(cacheDirectory).catch(()=>[])){
      if(!name.endsWith('.json'))continue;
      const file=join(cacheDirectory,name);
      const info=await stat(file).catch(()=>null);
      if(info&&info.mtimeMs<expiry)await rm(file,{force:true}).catch(()=>{});
    }
    void cachedRelease;void currentRelease;
    for(const name of await readdir(directory))if(/^(?:portfolio|metadata)\.json\.[a-f0-9-]{36}\.tmp$/.test(name))await rm(join(directory,name),{force:true});
  }
}
export function cacheableProjectRead(method:string|undefined,path:string){
  if(method!=='GET')return false;
  const url=new URL(path,'http://localhost');
  if(url.searchParams.get('refresh')==='1'||url.searchParams.get('includeItems')==='true')return false;
  return /^\/api\/projects\/[^/]+\/(?:overview|director-position|management-surfaces|(?:schedule|commercial|delivery)\/modules\/[a-z0-9-]+|management\/[a-z0-9-]+|advanced\/[a-z0-9-]+|record-page|actions|evidence\/documents|boq\/(?:page-review|numeric-review))$/.test(url.pathname);
}
/** Derived read results are scoped to exact project, release and source-state
 * version. They survive worker eviction, never substitute an older position,
 * and contain no cookies or per-request identity headers. */
export class ProjectReadCache {
  constructor(private readonly directory:string,private readonly maxBytes=DEFAULT_CACHE_BYTES){}
  private file(release:string,version:number,path:string){
    const key=createHash('sha256').update(JSON.stringify([release,version,path])).digest('hex');
    return join(this.directory,'.analysis-reads',key+'.json');
  }
  async get(release:string,version:number,path:string):Promise<Buffer|null>{
    try{
      const stored=await readFile(this.file(release,version,path));
      return stored.subarray(0,COMPRESSED_MAGIC.length).equals(COMPRESSED_MAGIC)
        ?await gunzipAsync(stored.subarray(COMPRESSED_MAGIC.length)):stored;
    }catch{return null;}
  }
  async put(release:string,version:number,path:string,body:Buffer){
    if(body.length>MAX_PROJECT_READ_BYTES)return;
    const stored=body.length>4096?Buffer.concat([COMPRESSED_MAGIC,await gzipAsync(body,{level:3})]):body;
    if(stored.length>this.maxBytes)return;
    const file=this.file(release,version,path),temporary=file+'.'+randomUUID()+'.tmp';
    try{
      const directory=join(this.directory,'.analysis-reads');await mkdir(directory,{recursive:true});
      const space=await statfs(directory);if(space.bavail*space.bsize-body.length<STORAGE_RESERVE_BYTES)return;
      const entries=await Promise.all((await readdir(directory)).filter(name=>name.endsWith('.json')).map(async name=>({path:join(directory,name),info:await stat(join(directory,name))})));
      let bytes=entries.reduce((sum,entry)=>sum+entry.info.size,0);
      for(const entry of entries.sort((a,b)=>a.info.mtimeMs-b.info.mtimeMs)){
        if(bytes+stored.length<=this.maxBytes)break;
        await rm(entry.path,{force:true});bytes-=entry.info.size;
      }
      await writeFile(temporary,stored);await rename(temporary,file);
      await writeFile(join(directory,'release'),release);
    }
    catch{await rm(temporary,{force:true}).catch(()=>{});}
  }
  async invalidate(){await rm(join(this.directory,'.analysis-reads'),{recursive:true,force:true}).catch(()=>{});}
}
