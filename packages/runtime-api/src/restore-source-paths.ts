import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import type {ProjectRuntimeState} from './project-state-types';

/** A volume can be restored under a different mount. Reconnect only the same
 * project, retained filename and verified bytes; never search other projects. */
export function restoreSourcePaths(state:ProjectRuntimeState,dataDir:string):boolean {
  let changed=false;
  const projectSegment=state.projectId.replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^\.+/,'').slice(0,120)||'unknown';
  for(const scope of [state,...state.phaseProgrammes??[]])for(const document of scope.evidenceDocuments){
    if(!document.storedPath||!/^[a-f0-9]{64}$/.test(document.sourceHashSha256))continue;
    const parts=document.storedPath.replace(/\\/g,'/').split('/');
    const index=parts.lastIndexOf('uploads'),suffix=parts.slice(index+1);
    if(index<0||suffix.length!==3||suffix[0]!==projectSegment||
       !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(suffix[1]!)||
       !new RegExp('^'+document.sourceHashSha256+'(?:\\.[a-z0-9.]{1,11})?$').test(suffix[2]!))continue;
    const candidate=join(dataDir,'uploads',...suffix);
    if(resolve(candidate)===resolve(document.storedPath)||!existsSync(candidate))continue;
    const bytes=readFileSync(candidate);
    if(createHash('sha256').update(bytes).digest('hex')!==document.sourceHashSha256)continue;
    document.storedPath=candidate;changed=true;
  }
  return changed;
}
