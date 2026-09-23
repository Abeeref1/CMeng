import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createSourceFile, ScriptTarget, isFunctionDeclaration } from 'typescript';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';

function browserFunctions(names: string[]) {
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
  const chosen=source.statements.filter(isFunctionDeclaration).filter(node=>node.name && names.includes(node.name.text));
  assert.equal(chosen.length,names.length);
  return chosen.map(node=>node.getText(source)).join('\n');
}

test('opening a project loads and renders the canonical Director position with its module',async()=>{
  const nodes:Record<string,any>={};
  const requested:string[]=[];
  const rendered:any[]=[];
  const director={projectId:'OTHER-2032',schedule:{contractualCompletionIso:'2032-03-18'},controls:{overdueRfiCount:9}};
  const api=async(path:string)=>{
    requested.push(path);
    if(path.endsWith('/overview'))return {projectId:'OTHER-2032'};
    if(path.endsWith('/director-position'))return director;
    throw new Error('Unexpected endpoint');
  };
  await runInNewContext('let directorRequestSeq=0; let overview=null;'+browserFunctions(['refresh','loadDirector'])+';refresh(false)',{
    api,project:()=> 'OTHER-2032',el:(id:string)=>nodes[id]??(nodes[id]={}),
    selected:'command-center',renderDirector:(data:any)=>rendered.push(data),
    renderStatus:()=>{},renderNav:()=>{},updateActiveProjectShell:()=>{},setBusy:()=>{},
    loadModule:async()=>{},loadEvidence:async()=>{},localStorage:{setItem:()=>{}},escapeHtml:String,
  });
  assert.ok(requested.includes('/api/projects/OTHER-2032/director-position'));
  assert.deepEqual(rendered,[director]);
});

test('Director request failures are retryable CMeng loading failures, not missing source evidence',async()=>{
  const nodes:Record<string,any>={};
  let attempts=0;let rendered:any=null;
  const director={projectId:'SECOND'};
  await runInNewContext('let directorRequestSeq=0;'+browserFunctions(['loadDirector'])+';loadDirector()',{
    api:async()=>{if(++attempts===1)throw new Error('Service unavailable');return director;},
    project:()=> 'SECOND',el:(id:string)=>nodes[id]??(nodes[id]={}),escapeHtml:String,
    renderDirector:(value:any)=>{rendered=value;},
  });
  assert.match(nodes.director.innerHTML,/loading failure/);
  assert.match(nodes.director.innerHTML,/does not establish missing project evidence/);
  assert.equal(rendered,null);
  await nodes.retryDirector.onclick();
  assert.equal(rendered,director);
});

test('late Director responses cannot put a previous project into the active project drawer',async()=>{
  let active='FIRST';let rendered=0;
  let resolve!:(value:any)=>void;
  const response=new Promise(done=>{resolve=done;});
  const pending=runInNewContext('let directorRequestSeq=0;'+browserFunctions(['loadDirector'])+';loadDirector()',{
    api:()=>response,project:()=>active,el:()=>({innerHTML:''}),escapeHtml:String,
    renderDirector:()=>{rendered++;},
  });
  active='SECOND';resolve({projectId:'FIRST'});await pending;
  assert.equal(rendered,0);
});
