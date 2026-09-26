import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';

export const MAX_PROJECT_READ_BYTES=32*1024*1024;
export function cacheableProjectRead(method:string|undefined,path:string){
  return method==='GET'&&/^\/api\/projects\/[^/]+\/(?:overview|director-position|(?:schedule|commercial|delivery)\/modules\/[a-z-]+|management\/[a-z-]+)$/.test(path);
}
/** Derived read results are scoped to exact project, release and source-state
 * version. They survive worker eviction, never substitute an older position,
 * and contain no cookies or per-request identity headers. */
export class ProjectReadCache {
  constructor(private readonly directory:string){}
  private file(release:string,version:number,path:string){
    const key=createHash('sha256').update(JSON.stringify([release,version,path])).digest('hex');
    return join(this.directory,'.analysis-reads',key+'.json');
  }
  async get(release:string,version:number,path:string):Promise<Buffer|null>{
    try{return await readFile(this.file(release,version,path));}catch{return null;}
  }
  async put(release:string,version:number,path:string,body:Buffer){
    if(body.length>MAX_PROJECT_READ_BYTES)return;
    const file=this.file(release,version,path),temporary=file+'.'+randomUUID()+'.tmp';
    try{await mkdir(join(this.directory,'.analysis-reads'),{recursive:true});await writeFile(temporary,body);await rename(temporary,file);}
    catch{await rm(temporary,{force:true}).catch(()=>{});}
  }
  async invalidate(){await rm(join(this.directory,'.analysis-reads'),{recursive:true,force:true}).catch(()=>{});}
}
