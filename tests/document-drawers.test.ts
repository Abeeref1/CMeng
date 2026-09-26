import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createSourceFile, ScriptTarget, isFunctionDeclaration, isExpressionStatement } from 'typescript';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';

const html=cmengUatHtml();
const source=createSourceFile('browser.js',html.match(/<script>([\s\S]*?)<\/script>/)![1]!,ScriptTarget.Latest,true);
const functions=source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&['closeProjectDrawer','handleProjectDrawerEscape'].includes(n.name.text)).map(n=>n.getText(source)).join('\n');
const handlers=source.statements.filter(isExpressionStatement).map(n=>n.getText(source)).filter(text=>text.startsWith('el("closeEvidenceLibrary").onclick=')||text.startsWith('el("closeEvidenceControl").onclick=')).join('\n');

for(const [drawer,button,opener,label] of [
  ['evidenceLibraryDrawer','closeEvidenceLibrary','openLibraryQuick','Close documents'],
  ['evidenceControlDrawer','closeEvidenceControl','openEvidenceTop','Close add documents'],
])test(label+' works with one click or Escape, and keeps files and project data intact',()=>{
  assert.match(html,new RegExp('id="'+button+'" aria-label="'+label+'">Close ×</button>'));
  const nodes:Record<string,any>={evidenceLibraryDrawer:{open:false},evidenceControlDrawer:{open:false}};
  let focused='';let prevented=false;let stopped=false;
  const el=(id:string)=>nodes[id]??(nodes[id]={focus:()=>{focused=id;}});
  nodes[drawer!].open=true;
  const file={name:'pending-project-document.csv'};
  const context={el,evidenceSelection:[file],overview:{projectId:'CURRENT'}};
  runInNewContext(functions+'\n'+handlers,context);
  el(button!).onclick({preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
  assert.equal(nodes[drawer!].open,false);assert.equal(prevented,true);assert.equal(stopped,true,'native summary toggle must not reopen the closed drawer');
  assert.equal(focused,opener);assert.equal(context.evidenceSelection[0],file);
  nodes[drawer!].open=true;prevented=false;
  runInNewContext(functions+';handleProjectDrawerEscape(event)',{...context,event:{key:'Escape',preventDefault(){prevented=true;}}});
  assert.equal(nodes[drawer!].open,false);assert.equal(prevented,true);assert.equal(focused,opener);
  assert.equal(context.overview.projectId,'CURRENT');assert.equal(context.evidenceSelection[0],file);
});
