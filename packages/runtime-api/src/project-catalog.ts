import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {statSync,writeFileSync,renameSync} from 'node:fs';
import {isProgrammeScheduleRevision} from './project-identity';
import type {ProjectRuntimeState} from './project-state-types';

export const release=()=>process.env.RAILWAY_GIT_COMMIT_SHA??process.env.GIT_COMMIT_SHA??'local';
export const projectDirectory=(root:string,id:string)=>join(root,'projects',createHash('sha256').update(id).digest('hex'));
export async function atomicJson(path:string,value:unknown){
  const temporary=path+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,JSON.stringify(value));await rename(temporary,path);
}
export function projectMetadata(state:ProjectRuntimeState){
  const schedules=state.schedules.filter(isProgrammeScheduleRevision);
  return {projectId:state.projectId,demo:state.demo===true,version:state.version,
    evidenceDocumentCount:state.evidenceDocuments.length,revisionCount:schedules.length,
    latestDataDateIso:null as string|null};
}
export function snapshotStamp(directory:string){const s=statSync(join(directory,'cmeng-project-state.json'));return String(s.mtimeMs)+':'+s.size;}
export function persistProjectMetadata(directory:string,state:ProjectRuntimeState){
  const target=join(directory,'metadata.json'),temp=target+'.'+randomUUID()+'.tmp';
  writeFileSync(temp,JSON.stringify({metadata:projectMetadata(state),stamp:snapshotStamp(directory)}));renameSync(temp,target);
}
export type ProjectMetadata=ReturnType<typeof projectMetadata>;
export type CatalogEntry={projectId:string;metadata:ProjectMetadata|null;summary:Record<string,any>|null;summaryRelease:string|null};
export async function loadProjectCatalog(root:string):Promise<Map<string,CatalogEntry>>{
  await mkdir(join(root,'projects'),{recursive:true});
  const manifest=join(root,'project-catalog.json');
  let ids:string[];
  try{ids=(JSON.parse(await readFile(manifest,'utf8')) as {schemaVersion:number;projectIds:string[]}).projectIds;if(!Array.isArray(ids))throw new Error('INVALID_PROJECT_CATALOG');}
  catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    let legacy:{schemaVersion:number;projects:ProjectRuntimeState[]};
    try{legacy=JSON.parse(await readFile(join(root,'cmeng-project-state.json'),'utf8'));}
    catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;legacy={schemaVersion:1,projects:[]};}
    if(legacy.schemaVersion!==1||!Array.isArray(legacy.projects))throw new Error('CMENG_STATE_SCHEMA_UNSUPPORTED');
    ids=[];
    for(const state of legacy.projects){
      if(!state.projectId||ids.includes(state.projectId))throw new Error('INVALID_PROJECT_ID_IN_SNAPSHOT');
      const directory=projectDirectory(root,state.projectId);await mkdir(directory,{recursive:true});
      // Copy the complete retained state and all original upload paths. Never remove the legacy snapshot.
      await atomicJson(join(directory,'cmeng-project-state.json'),{schemaVersion:1,projects:[state]});
      persistProjectMetadata(directory,state);ids.push(state.projectId);
    }
    // Publish only after every project copy succeeds. An interrupted migration is safe to repeat.
    await atomicJson(manifest,{schemaVersion:1,projectIds:ids});
  }
  const result=new Map<string,CatalogEntry>();
  for(const projectId of ids){
    const directory=projectDirectory(root,projectId);
    let metadata:ProjectMetadata|null=null,summary:Record<string,any>|null=null,summaryRelease:string|null=null;
    try{const saved=JSON.parse(await readFile(join(directory,'metadata.json'),'utf8'));if(saved.stamp===snapshotStamp(directory))metadata=saved.metadata;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    try{const saved=JSON.parse(await readFile(join(directory,'portfolio.json'),'utf8'));summary=saved.summary;summaryRelease=saved.release;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
    if(!metadata)summaryRelease=null;
    if(metadata&&metadata.projectId!==projectId)throw new Error('PROJECT_METADATA_ID_MISMATCH');
    result.set(projectId,{projectId,metadata,summary,summaryRelease});
  }
  return result;
}
