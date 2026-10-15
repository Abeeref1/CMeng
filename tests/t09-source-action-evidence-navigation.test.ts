import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {actionSourceCorrectionRecord} from '../packages/runtime-api/src/project-actions';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import type {ProjectRuntimeState} from '../packages/runtime-api/src/project-state-types';

const projectState={
 projectId:'EXACT-PROJECT',evidenceDocuments:[
  {documentId:'DOC-01',sourceHashSha256:'SHA-BYTES-01',sourceFilename:'Quality register original.pdf'},
  {documentId:'DOC-02',sourceHashSha256:'SHA-BYTES-02',sourceFilename:'Current procurement.xlsx'},
 ]
} as unknown as ProjectRuntimeState;
test('T09 actions identify original source document with SHA and physical locator',()=>{
 const value=actionSourceCorrectionRecord(projectState,'evidence-document:DOC-01:page:7');
 assert.deepEqual(value,{source:'Quality register original.pdf',locator:'Page 7',documentId:'DOC-01',sourceHash:'SHA-BYTES-01'});
 const other=actionSourceCorrectionRecord(projectState,'evidence-document:DOC-02:row:1743');
 assert.equal(other.locator,'Row 1743');assert.equal(other.documentId,'DOC-02');
});
test('T09 foreign or missing source cannot create a fictitious document link',()=>{
 const missing=actionSourceCorrectionRecord(projectState,'evidence-document:OTHER:row:3');
 assert.equal(missing.documentId,undefined);assert.equal(missing.sourceHash,undefined);
});
test('T09 real browser UI builds source link for the project and hash, not an unsupported role or loop',()=>{
 const html=cmengUatHtml();
 const match=/function actionSourceLink\(row\)\{[\s\S]*?\n\}/.exec(html)?.[0];
 assert.ok(match,'inspect real browser source renderer');
 const fn=runInNewContext('('+match+')',{project:()=> 'EXACT-PROJECT',escapeHtml:(v:unknown)=>String(v),encodeURIComponent}) as (row:unknown)=>string;
 const row=actionSourceCorrectionRecord(projectState,'evidence-document:DOC-01:page:7');
 assert.ok(fn(row).includes('/api/projects/EXACT-PROJECT/evidence/documents/DOC-01/source?hash=SHA-BYTES-01'));
 assert.ok(fn(row).includes('Quality register original.pdf · Page 7'));
 assert.ok(!fn(actionSourceCorrectionRecord(projectState,'evidence-document:FOREIGN')).includes('<a '));
});

test('T09 Accountability exposes the exact evidence and owning fix page on the same action row',()=>{
 const html=cmengUatHtml();
 const evidenceSource=/function accountabilityEvidenceLink\(row\)\{[\s\S]*?\n\}/.exec(html)?.[0];
 assert.ok(evidenceSource,'Accountability exact-evidence renderer exists');
 const evidence=runInNewContext('('+evidenceSource+')',{
   project:()=> 'EXACT-PROJECT',escapeHtml:(v:unknown)=>String(v),encodeURIComponent
 }) as (row:unknown)=>string;
 const correction=actionSourceCorrectionRecord(projectState,'evidence-document:DOC-02:row:1743');
 const linked=evidence({correctionRecords:[correction]});
 assert.ok(linked.includes('/api/projects/EXACT-PROJECT/evidence/documents/DOC-02/source?hash=SHA-BYTES-02'));
 assert.ok(linked.includes('Current procurement.xlsx · Row 1743'));
 assert.match(html,/function accountabilityFixLink\(row\)/);
 assert.match(html,/<th>Evidence<\/th><th>Place to fix<\/th>/);
 assert.match(html,/accountabilityEvidenceLink\(action\)/);
 assert.match(html,/accountabilityFixLink\(action\)/);
});

test('T09 module routes have stable browser addresses and restore without overwriting source',async()=>{
 const html=cmengUatHtml();
 const functionCode=(name:string)=>new RegExp('(?:async )?function '+name+'\\([^]*?\\n\\}').exec(html)?.[0];
 const publish=functionCode('syncBrowserRoute');
 const restore=functionCode('restoreBrowserRoute');
 assert.ok(publish&&restore,'both browser URL and Back/Forward handlers are retained');
 const actions:Array<{method:string;url:string}>=[];
 const win:any={location:new URL('https://cmeng.example/app?external=preserved#section'),history:null};
 win.history={
   pushState:(_state:unknown,_title:string,next:string)=>{
     actions.push({method:'push',url:next});win.location=new URL(next,'https://cmeng.example');
   },
   replaceState:(_state:unknown,_title:string,next:string)=>{
     actions.push({method:'replace',url:next});win.location=new URL(next,'https://cmeng.example');
   }
 };
 const env:any={window:win,URL,URLSearchParams,appView:'project',selected:'milestones',
   selectedRoleView:'planning',browserRouteBooting:false,browserRouteRestoring:false,
   project:()=> 'SOURCE-PROJECT'};
 const publishFn=runInNewContext(publish+';syncBrowserRoute',env) as ()=>void;
 publishFn();
 assert.equal(actions.length,1);
 assert.equal(actions[0]!.method,'push');
 const url=new URL(actions[0]!.url,'https://cmeng.example');
 assert.equal(url.searchParams.get('project'),'SOURCE-PROJECT');
 assert.equal(url.searchParams.get('module'),'milestones');
 assert.equal(url.searchParams.get('role'),'planning');
 assert.equal(url.searchParams.get('external'),'preserved','existing unrelated query state must survive');
 publishFn();assert.equal(actions.length,1,'same destination must not create a new history entry');
 env.browserRouteRestoring=true;env.selected='payments';publishFn();
 assert.equal(actions.length,1,'Back/Forward must not push another route');
 env.browserRouteRestoring=false;
 let opened=0,changes=0;
 const restoreEnv:any={window:{location:{search:'?view=project&project=NEW-PROJECT&module=milestones&role=planning'}},
   URLSearchParams,selected:'master-dashboard',selectedRoleView:'overall',appView:'projects',
   browserRouteRestoreSeq:0,browserRouteRestoring:false,roleViewOrder:['overall','planning'],
   names:{milestones:'Milestone Control'},overview:{projectId:'OLD-PROJECT'},
   project:()=> 'OLD-PROJECT',localStorage:{setItem:()=>{}},
   openProject:async(id:string)=>{assert.equal(id,'NEW-PROJECT');opened++;restoreEnv.overview={projectId:id}},
   setAppView:(view:string)=>{assert.equal(view,'project');changes++},
   loadModule:async()=>{throw new Error('an already reopened project must not calculate a second module')},
   renderModuleResult:()=>{}
 };
 await runInNewContext(restore+';restoreBrowserRoute()',restoreEnv);
 assert.equal(opened,1);assert.equal(changes,1);
 assert.equal(restoreEnv.selected,'milestones');assert.equal(restoreEnv.selectedRoleView,'planning');
 assert.equal(restoreEnv.browserRouteRestoring,false);
});
