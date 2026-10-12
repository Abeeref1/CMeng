import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {restoreSourcePaths} from '../packages/runtime-api/src/restore-source-paths';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

test('relocated sources require the same project, safe retained path and exact original hash',()=>{
 const root=mkdtempSync(join(tmpdir(),'restore-path-')),bytes=Buffer.from('original evidence'),hash=createHash('sha256').update(bytes).digest('hex');
 const candidate=join(root,'uploads','SOURCE-A','schedule',hash+'.xer');mkdirSync(join(root,'uploads','SOURCE-A','schedule'),{recursive:true});writeFileSync(candidate,bytes);
 const document={storedPath:'/old-volume/uploads/SOURCE-A/schedule/'+hash+'.xer',sourceHashSha256:hash};
 const state={projectId:'SOURCE-A',evidenceDocuments:[document],phaseProgrammes:[]} as unknown as ProjectRuntimeState;
 try{
  assert.equal(restoreSourcePaths(state,root),true);assert.equal(document.storedPath,candidate);assert.equal(restoreSourcePaths(state,root),false);
  document.storedPath='/old-volume/uploads/SOURCE-A/schedule/'+hash+'.xer';writeFileSync(candidate,'corrupted');assert.equal(restoreSourcePaths(state,root),false);
  writeFileSync(candidate,bytes);document.storedPath='/old-volume/uploads/SOURCE-A/../'+hash+'.xer';assert.equal(restoreSourcePaths(state,root),false);
  document.storedPath='/old-volume/uploads/SOURCE-A/schedule/'+hash+'.xer';state.projectId='SOURCE-B';assert.equal(restoreSourcePaths(state,root),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
