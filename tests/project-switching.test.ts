import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { createSourceFile, ScriptTarget, isFunctionDeclaration } from 'typescript';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';

const source=createSourceFile('browser.js',cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!,ScriptTarget.Latest,true);
const names=['projectRequestIsCurrent','clearProjectWorkspace','openProject','refresh','updateActiveProjectShell','setAppView','renderNav','loadModule','loadEvidence','loadDirector','askCmeng'];
const code=source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text)).map(n=>n.getText(source)).join('\n');
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
const overview=(projectId:string,count=7)=>({projectId,evidenceDocumentCount:count,revisionCount:2,latestDataDateIso:'2032-04-30',releaseCommitSha:'release',moduleStates:[],managementStates:[]});

function harness() {
  const nodes=new Map<string,any>();
  const el=(id:string)=>{
    if(!nodes.has(id)) {
      let content='OLD-PROJECT';
      nodes.set(id,{get innerHTML(){return content;},set innerHTML(v:string){content=v;},get textContent(){return content;},set textContent(v:string){content=v;},value:'',disabled:false,open:true,hidden:false,style:{},classList:{remove(){},toggle(){}},querySelectorAll:()=>[]});
    }
    return nodes.get(id);
  };
  el('projectId').value='OLD-PROJECT';
  const storage=new Map<string,string>();
  const requests:Array<{path:string,resolve:(v:any)=>void,reject:(e:Error)=>void,done:boolean}>=[];
  const context=createContext({
    el,project:()=>el('projectId').value,overview:overview('OLD-PROJECT',39),selected:'command-center',appView:'project',projectLoadState:'ready',
    projectRequestSeq:0,moduleRequestSeq:0,evidenceRequestSeq:0,directorRequestSeq:0,aiRequestSeq:0,currentModuleResult:{key:'command-center',data:'OLD-PROJECT'},
    scheduleSelection:['old.xer'],boqSelection:['old.csv'],contractSelection:[],evidenceSelection:['old.zip'],selectedEvidenceDocuments:new Set(['old-document']),
    names:{'command-center':'Command Center'},descriptions:{},apiKeys:{},groups:{Management:['command-center']},
    managementSurfaceKeysForApi:new Set(['command-center']),commercialModuleKeysForApi:new Set(),
    fmt:String,planningShortDate:String,escapeHtml:(s:any)=>String(s).replace(/[&<>"']/g,'_'),
    document:{body:{classList:{remove(){},toggle(){}}},querySelectorAll:()=>[]},window:{scrollTo(){}},
    localStorage:{setItem:(key:string,value:string)=>storage.set(key,value)},renderPlatformNav(){},loadPortfolio(){},
    setBusy:(text:string)=>{el('globalStatus').textContent=text;},renderStatus:(o:any)=>{el('projectStatus').textContent=o.projectId;el('projectBadge').textContent='CURRENT PROJECT';},
    renderDirector:(d:any)=>{el('director').textContent=d?.projectId||'No management detail';},
    renderModuleResult:(r:any)=>{context.currentModuleResult=r;el('moduleContent').textContent=r.data.projectId;el('moduleReport').disabled=false;},
    api:(path:string)=>new Promise((resolve,reject)=>requests.push({path,resolve,reject,done:false})),
  });
  runInContext(code,context);
  const call=(expression:string)=>runInContext(expression,context) as Promise<void>;
  const next=(suffix:string,projectId?:string)=>{
    const r=requests.find(r=>!r.done&&r.path.endsWith(suffix)&&(!projectId||r.path.includes('/'+projectId+'/')));
    assert.ok(r,'Expected pending request '+projectId+' '+suffix);r.done=true;return r;
  };
  const finish=async(projectId:string,count=7)=>{
    next('/overview',projectId).resolve(overview(projectId,count));await tick();
    next('/command-center',projectId).resolve({key:'command-center',data:{projectId}});
    next('/documents',projectId).resolve({documentCount:0,documents:[]});
    next('/director-position',projectId).resolve({projectId});await tick();
  };
  return {context,nodes,el,storage,requests,next,finish,call};
}

test('opening another project clears every old-project surface before its first response arrives',async()=>{
  const h=harness();
  const pending=h.call('openProject("NEW-PROJECT")');
  assert.equal(h.context.overview,null);assert.equal(h.context.currentModuleResult,null);
  assert.equal(h.el('activeProjectName').textContent,'NEW-PROJECT');
  for(const id of ['activeProjectMeta','workspaceProjectMeta','projectStatus','director','evidenceLibrary','aiProjectInfo','aiAnswer','moduleContent','nav','uploadMessage']) {
    assert.doesNotMatch(h.el(id).textContent,/OLD-PROJECT|39 documents|2032-04-30/,id);
  }
  assert.match(h.el('moduleContent').innerHTML,/Opening NEW-PROJECT/);
  assert.equal(h.el('moduleReport').disabled,true);
  assert.equal(h.el('runAnalysisTop').disabled,true);
  assert.equal(h.context.selectedEvidenceDocuments.size,0);
  assert.equal(h.context.scheduleSelection.length,0);
  for(const id of ['evidenceControlDrawer','evidenceLibraryDrawer','directorDrawer'])assert.equal(h.el(id).open,false);
  await h.finish('NEW-PROJECT');await pending;
  assert.equal((h.context.overview as any).projectId,'NEW-PROJECT');
  assert.equal(h.el('activeProjectName').textContent,'NEW-PROJECT');
  assert.equal(h.el('moduleContent').textContent,'NEW-PROJECT');
  assert.equal(h.el('moduleReport').disabled,false);
});

test('a late overview cannot change project identity, persisted selection or a newer busy indicator',async()=>{
  const h=harness();
  const first=h.call('openProject("FIRST")');
  const second=h.call('openProject("SECOND")');
  h.next('/overview','FIRST').resolve(overview('FIRST'));await first;
  assert.equal(h.context.overview,null);
  assert.equal(h.el('globalStatus').textContent,'Refreshing project');
  assert.equal(h.storage.get('cmeng-project'),'SECOND');
  assert.equal(h.requests.filter(r=>r.path.includes('/FIRST/')).length,1);
  await h.finish('SECOND');await second;
  assert.equal((h.context.overview as any).projectId,'SECOND');
});

test('A to B to A switching rejects the first A response even when its project ID matches again',async()=>{
  const h=harness();
  const first=h.call('openProject("A")'),firstRequest=h.next('/overview','A');
  const middle=h.call('openProject("B")');
  const latest=h.call('openProject("A")');
  await h.finish('A',11);await latest;
  firstRequest.resolve(overview('A',999));await first;
  h.next('/overview','B').reject(new Error('Old B failure'));await middle;
  assert.equal(h.context.overview.evidenceDocumentCount,11);
  assert.match(h.el('activeProjectMeta').textContent,/11 project documents/);
  assert.equal(h.el('moduleContent').textContent,'A');
});

for(const fails of [false,true])test('late old-project module, documents, director and AI '+(fails?'errors':'results')+' cannot refill the new workspace',async()=>{
  const h=harness();h.el('aiQuestion').value='Question about OLD-PROJECT';
  const old=[h.call('loadModule("command-center")'),h.call('loadEvidence()'),h.call('loadDirector()'),h.call('askCmeng()')];
  const pending=h.call('openProject("NEW-PROJECT")');await h.finish('NEW-PROJECT');await pending;
  for(const r of h.requests.filter(r=>!r.done&&r.path.includes('/OLD-PROJECT/'))) {
    r.done=true;
    if(fails)r.reject(new Error('OLD-PROJECT failed'));
    else if(r.path.endsWith('/documents'))r.resolve({documentCount:99,documents:[]});
    else r.resolve({key:'command-center',data:{projectId:'OLD-PROJECT'},projectId:'OLD-PROJECT',answer:'OLD-PROJECT answer',relevantModules:[]});
  }
  await Promise.all(old);
  for(const id of ['moduleContent','director','evidenceLibrary','aiAnswer','aiProjectInfo'])assert.doesNotMatch(h.el(id).textContent,/OLD-PROJECT/,id);
  assert.equal(h.el('evidenceBadge').textContent,'0 documents','a confirmed empty NEW project retains a real zero');
  assert.equal(h.context.currentModuleResult.data.projectId,'NEW-PROJECT');
});

test('failed project opening shows a retry for the selected project without restoring old data',async()=>{
  const h=harness();const pending=h.call('openProject("UNAVAILABLE")');
  h.next('/overview','UNAVAILABLE').reject(new Error('Connection failed'));await pending;
  assert.equal(h.context.overview,null);assert.equal(h.context.currentModuleResult,null);
  assert.equal(h.el('activeProjectName').textContent,'UNAVAILABLE');
  assert.match(h.el('moduleContent').textContent,/Unable to open UNAVAILABLE/);
  assert.equal(h.el('evidenceBadge').textContent,'Documents not loaded');
  assert.equal(h.el('moduleReport').disabled,true);
  const retry=h.el('retryProject').onclick();await h.finish('UNAVAILABLE');await retry;
  assert.equal(h.el('moduleContent').textContent,'UNAVAILABLE');
});

test('an overview identifying a different project is rejected before any child request or display',async()=>{
  const h=harness();const pending=h.call('openProject("EXPECTED")');
  h.next('/overview','EXPECTED').resolve(overview('WRONG'));await pending;
  assert.equal(h.context.overview,null);assert.equal(h.requests.length,1);
  assert.equal(h.el('activeProjectName').textContent,'EXPECTED');
  assert.match(h.el('moduleContent').textContent,/Unable to open EXPECTED/);
});
