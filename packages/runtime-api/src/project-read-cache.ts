import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,readdir,stat,statfs} from 'node:fs/promises';
import {join} from 'node:path';

export const MAX_PROJECT_READ_BYTES=32*1024*1024;
const DEFAULT_CACHE_BYTES=64*1024*1024;
const STORAGE_RESERVE_BYTES=512*1024*1024;
/** These are disposable projections, never uploads, snapshots or saved Ask results. */
export async function clearDerivedReadCaches(root:string){
  const projects=join(root,'projects');
  for(const entry of await readdir(projects,{withFileTypes:true}).catch(()=>[])){
    if(!entry.isDirectory()||!/^[a-f0-9]{64}$/.test(entry.name))continue;
    const directory=join(projects,entry.name);
    await rm(join(directory,'.analysis-reads'),{recursive:true,force:true});
    for(const name of await readdir(directory))if(/^(?:portfolio|metadata)\.json\.[a-f0-9-]{36}\.tmp$/.test(name))await rm(join(directory,name),{force:true});
  }
}
export function cacheableProjectRead(method:string|undefined,path:string){
  return method==='GET'&&/^\/api\/projects\/[^/]+\/(?:overview|director-position|(?:schedule|commercial|delivery)\/modules\/[a-z-]+|management\/[a-z-]+)$/.test(path);
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
    try{return await readFile(this.file(release,version,path));}catch{return null;}
  }
  async put(release:string,version:number,path:string,body:Buffer){
    if(body.length>MAX_PROJECT_READ_BYTES||body.length>this.maxBytes)return;
    const file=this.file(release,version,path),temporary=file+'.'+randomUUID()+'.tmp';
    try{
      const directory=join(this.directory,'.analysis-reads');await mkdir(directory,{recursive:true});
      const space=await statfs(directory);if(space.bavail*space.bsize-body.length<STORAGE_RESERVE_BYTES)return;
      const entries=await Promise.all((await readdir(directory)).filter(name=>name.endsWith('.json')).map(async name=>({path:join(directory,name),info:await stat(join(directory,name))})));
      let bytes=entries.reduce((sum,entry)=>sum+entry.info.size,0);
      for(const entry of entries.sort((a,b)=>a.info.mtimeMs-b.info.mtimeMs)){
        if(bytes+body.length<=this.maxBytes)break;
        await rm(entry.path,{force:true});bytes-=entry.info.size;
      }
      await writeFile(temporary,body);await rename(temporary,file);
    }
    catch{await rm(temporary,{force:true}).catch(()=>{});}
  }
  async invalidate(){await rm(join(this.directory,'.analysis-reads'),{recursive:true,force:true}).catch(()=>{});}
}
