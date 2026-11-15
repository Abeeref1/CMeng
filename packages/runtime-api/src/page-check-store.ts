/**
 * Mechanism 14: the saved result of the complete page check.
 *
 * Control Readiness, cross-page consistency and the shared action list are
 * checks on the whole page set. The Dashboard answers without building that
 * set; it shows the saved check only when the check was made for this exact
 * project version and calculation release. Any evidence change gives a new
 * project version, so an older check is never shown as current.
 */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {calculationRelease} from './project-catalog';

export type SavedPageCheck={
  schemaVersion:1;projectId:string;projectVersion:number;projectStamp:string;release:string;checkedAt:string;
  readiness:unknown;consistency:unknown;issueAssessment:unknown;actions:unknown;factsActions:unknown;
};
let directoryOverride:string|null|undefined;
const memory=new Map<string,SavedPageCheck>();
/** Tests choose the folder explicitly; null keeps checks in memory only. */
export function setPageCheckDirectory(directory:string|null|undefined){directoryOverride=directory;memory.clear();}
function directory():string|null{
  if(directoryOverride!==undefined)return directoryOverride;
  const root=process.env.CMENG_DATA_DIR?.trim();
  if(!root||process.env.CMENG_TEST_MODE?.trim()==='1'||process.env.NODE_TEST_CONTEXT)return null;
  return join(root,'page-checks');
}
const fileFor=(projectId:string)=>createHash('sha256').update(projectId).digest('hex')+'.json';

/**
 * A cheap identity of the project's stored sources (programme revisions and
 * documents). With the project version it ties a check to this exact project:
 * a project deleted and created again under the same name starts a new stamp.
 */
export function projectSourceStamp(state:{schedules?:Array<{sourceHashSha256?:string|null;revision?:{revisionId?:string}}>;evidenceDocuments?:Array<{documentId?:string;sourceHashSha256?:string|null}>}){
  const hash=createHash('sha256');
  for(const schedule of state.schedules??[])hash.update('s\0'+String(schedule.revision?.revisionId??'')+'\0'+String(schedule.sourceHashSha256??'')+'\n');
  for(const document of state.evidenceDocuments??[])hash.update('d\0'+String(document.documentId??'')+'\0'+String(document.sourceHashSha256??'')+'\n');
  return hash.digest('hex');
}
const current=(saved:SavedPageCheck,projectVersion:number,projectStamp:string)=>
  saved.projectVersion===projectVersion&&saved.projectStamp===projectStamp&&saved.release===calculationRelease();

/** The saved check for this exact project version, sources and release, or null. */
export function savedPageCheck(projectId:string,projectVersion:number,projectStamp:string):SavedPageCheck|null{
  const remembered=memory.get(projectId);
  if(remembered)return current(remembered,projectVersion,projectStamp)?remembered:null;
  const folder=directory();if(!folder)return null;
  try{
    const saved=JSON.parse(readFileSync(join(folder,fileFor(projectId)),'utf8')) as SavedPageCheck;
    if(saved?.schemaVersion!==1||saved.projectId!==projectId)return null;
    memory.set(projectId,saved);
    return current(saved,projectVersion,projectStamp)?saved:null;
  }catch{return null;}
}
export function savePageCheck(check:Omit<SavedPageCheck,'schemaVersion'|'release'|'checkedAt'>){
  const saved:SavedPageCheck={schemaVersion:1,release:calculationRelease(),checkedAt:new Date().toISOString(),...check};
  memory.set(check.projectId,saved);
  const folder=directory();if(!folder)return saved;
  try{
    mkdirSync(folder,{recursive:true});
    const path=join(folder,fileFor(check.projectId)),temporary=path+'.'+process.pid+'.tmp';
    writeFileSync(temporary,JSON.stringify(saved));renameSync(temporary,path);
  }catch(error){console.warn('[page-check] save failed: '+String(error).slice(0,200));}
  return saved;
}
