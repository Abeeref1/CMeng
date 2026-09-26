import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createSourceFile, ScriptTarget, isFunctionDeclaration, isExpressionStatement } from 'typescript';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';

const html=cmengUatHtml();
const source=createSourceFile('browser.js',html.match(/<script>([\s\S]*?)<\/script>/)![1]!,ScriptTarget.Latest,true);
const functions=source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&['closeProjectDrawer','handleProjectDrawerEscape','setProjectDrawerExpanded','toggleProjectDrawerExpansion','setFocusMode','handlePageExpansionEscape'].includes(n.name.text)).map(n=>n.getText(source)).join('\n');
const handlers=source.statements.filter(isExpressionStatement).map(n=>n.getText(source)).filter(text=>text.startsWith('el("closeEvidenceLibrary").onclick=')||text.startsWith('el("closeEvidenceControl").onclick=')||text.startsWith('el("expandEvidenceLibrary").onclick=')||text.startsWith('el("expandEvidenceControl").onclick=')).join('\n');

for(const [drawer,button,opener,label] of [
  ['evidenceLibraryDrawer','closeEvidenceLibrary','openLibraryQuick','Close documents'],
  ['evidenceControlDrawer','closeEvidenceControl','openEvidenceTop','Close add documents'],
])test(label+' works with one click or Escape, and keeps files and project data intact',()=>{
  assert.match(html,new RegExp('id="'+button+'" aria-label="'+label+'">Close ×</button>'));
  const nodes:Record<string,any>={};
  let focused='';let prevented=false;let stopped=false;
  const el=(id:string)=>nodes[id]??(nodes[id]={...node(),focus:()=>{focused=id;}});
  el('evidenceLibraryDrawer');el('evidenceControlDrawer');
  nodes[drawer!].open=true;
  const file={name:'pending-project-document.csv'};
  const context={el,evidenceSelection:[file],overview:{projectId:'CURRENT'}};
  runInNewContext(functions+'\n'+handlers,context);
  const expand=drawer==='evidenceLibraryDrawer'?'expandEvidenceLibrary':'expandEvidenceControl';
  const event={preventDefault(){prevented=true;},stopPropagation(){stopped=true;}};
  el(expand).onclick(event);
  assert.equal(el(drawer!).open,true,'expanding must not trigger the native details close');
  assert.equal(el(drawer!).classList.contains('drawer-expanded'),true);
  assert.equal(el(expand).attributes['aria-pressed'],'true');
  assert.equal(prevented,true);assert.equal(stopped,true);
  el(expand).onclick(event);
  assert.equal(el(drawer!).open,true);assert.equal(el(expand).textContent,'Expand');
  assert.equal(el(drawer!).classList.contains('drawer-expanded'),false);
  el(expand).onclick(event);
  el(button!).onclick({preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
  assert.equal(nodes[drawer!].open,false);assert.equal(prevented,true);assert.equal(stopped,true,'native summary toggle must not reopen the closed drawer');
  assert.equal(focused,opener);assert.equal(context.evidenceSelection[0],file);
  assert.equal(el(drawer!).classList.contains('drawer-expanded'),false);assert.equal(el(expand).textContent,'Expand');
  nodes[drawer!].open=true;el(expand).onclick(event);prevented=false;
  runInNewContext(functions+';handleProjectDrawerEscape(event)',{...context,event:{key:'Escape',preventDefault(){prevented=true;}}});
  assert.equal(nodes[drawer!].open,false);assert.equal(prevented,true);assert.equal(focused,opener);
  assert.equal(context.overview.projectId,'CURRENT');assert.equal(context.evidenceSelection[0],file);
});

function node(){
  const classes=new Set<string>();
  const attributes:Record<string,string>={};
  return {open:false,textContent:'',attributes,focus(){},setAttribute:(key:string,value:string)=>{attributes[key]=value;},classList:{contains:(key:string)=>classes.has(key),toggle:(key:string,enabled:boolean)=>{if(enabled)classes.add(key);else classes.delete(key);}}};
}

test('page expansion persists, restores navigation, and lets the open drawer or chart handle Escape first',()=>{
  const body=node();const button=node();const storage=new Map<string,string>();let chartOpen=false;let prevented=false;
  const context={el:()=>button,document:{body,querySelector:()=>chartOpen?{}:null},localStorage:{setItem:(key:string,value:string)=>storage.set(key,value)},event:{key:'Escape',defaultPrevented:false,preventDefault(){prevented=true;}}};
  runInNewContext(functions+';setFocusMode(true);',context);
  assert.equal(body.classList.contains('focus-module'),true);assert.equal(button.textContent,'Restore page');assert.equal(storage.get('cmeng-focus'),'1');
  context.event.defaultPrevented=true;
  runInNewContext(functions+';handlePageExpansionEscape(event);',context);
  assert.equal(body.classList.contains('focus-module'),true,'closing a drawer must preserve page width');
  context.event.defaultPrevented=false;chartOpen=true;
  runInNewContext(functions+';handlePageExpansionEscape(event);',context);
  assert.equal(body.classList.contains('focus-module'),true,'an expanded chart consumes Escape first');
  chartOpen=false;
  runInNewContext(functions+';handlePageExpansionEscape(event);',context);
  assert.equal(body.classList.contains('focus-module'),false);assert.equal(button.textContent,'Expand page');assert.equal(storage.get('cmeng-focus'),'0');assert.equal(prevented,true);
  assert.ok(html.indexOf('id="focusMode"')<html.indexOf('id="portfolioView"'),'page expansion must be available outside every individual view');
});
