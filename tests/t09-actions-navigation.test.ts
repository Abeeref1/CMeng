import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext, runInContext} from 'node:vm';
import {createSourceFile, ScriptTarget, isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {ownerDisplayState, pmcRoleOwner} from '../packages/runtime-api/src/action-priority';

// T09 rules A1, A2 and A4, checked against the real assembled browser script.
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
function functions(names:string[]){
  const found=source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&names.includes(n.name.text));
  assert.equal(found.length,names.length,'every helper must exist in the assembled browser script');
  return found.map(n=>n.getText(source)).join('\n');
}
const escapeHtml=(s:unknown)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
const registryKeys=new Set(moduleRegistry.map(m=>m.key));

test('A4: an owner assigned only as a PMC role is shown as missing, with its role and a way to set it', ()=>{
  const ctx=createContext({escapeHtml});
  runInContext(functions(['pmcRoleOwner','ownerDisplayState','ownerMissingHtml']),ctx);
  const ownerMissingHtml=(owner:unknown)=>runInContext('ownerMissingHtml('+JSON.stringify(owner)+')',ctx) as string;
  const assigned=pmcRoleOwner('risk',null);
  for(const owner of [assigned,'Not assigned','',null]){
    const html=ownerMissingHtml(owner);
    assert.match(html,/data-owner-missing>Owner not set</,String(owner));
    assert.doesNotMatch(html,/not designated|Suggested/i,String(owner));
    // The control opens the project documents, where a named owner in the source register is kept.
    assert.match(html,/<button[^>]*class="management-module-link"[^>]*data-module="documents"/);
  }
  assert.match(ownerMissingHtml(assigned),/Accountable role: PMC Risk Manager/);
  assert.equal(ownerMissingHtml('Jane Smith'),'Jane Smith','a named source owner is shown unchanged');
});

test('A4: the stored owner and keys built from it are unchanged; only the display state is added', ()=>{
  assert.equal(pmcRoleOwner('risk',null),'PMC Risk Manager — individual not designated');
  assert.deepEqual(ownerDisplayState(pmcRoleOwner('schedule',null)),{named:false,role:'PMC Planning Engineer'});
  assert.deepEqual(ownerDisplayState('Procurement Manager'),{named:true,role:null});
  assert.deepEqual(ownerDisplayState('Unassigned'),{named:false,role:null});
});

test('A4: action cards and owner columns never print a placeholder role as the owner', ()=>{
  assert.ok(!script.includes('Suggested review role'),'review cards must not label the owner as suggested');
  assert.ok(!script.includes("cell.textContent=pmcDisplayOwner("),'owner cells must not be filled with a placeholder role');
  assert.ok(!script.includes("escapeHtml(a.owner||'PMC Project Controls Manager')"),'a missing action owner must not default to a role');
  assert.ok(script.includes('ownerMissingHtml(a.owner)'));
});

test('A1: every static button target in the browser script is a registered page', ()=>{
  const targets=[
    ...[...script.matchAll(/managementModuleLink\(\s*["']([a-z0-9-]+)["']/g)].map(m=>m[1]!),
    ...[...script.matchAll(/data-action-module="([a-z0-9-]+)"/g)].map(m=>m[1]!),
    ...[...script.matchAll(/data-module="([a-z0-9-]+)"/g)].map(m=>m[1]!)
  ];
  assert.ok(targets.length>20,'the walk must find the real targets');
  const missing=[...new Set(targets)].filter(key=>key!=='documents'&&!registryKeys.has(key));
  assert.deepEqual(missing,[]);
  // A target that is not a registered page is never followed.
  assert.match(script,/\[data-action-module\]'\)\.forEach\(b=>b\.onclick=\(\)=>\{if\(!names\[b\.dataset\.actionModule\]\)return;/);
});

test('A1/A2: module links go to an existing page and never back to the page they are on', ()=>{
  const ctx=createContext({escapeHtml,names:Object.fromEntries(moduleRegistry.map(m=>[m.key,m.title])),selected:'payments',appView:'project'});
  runInContext(functions(['managementModuleLink']),ctx);
  const link=(key:string)=>runInContext('managementModuleLink('+JSON.stringify(key)+')',ctx) as string;
  assert.doesNotMatch(link('payments'),/<button/,'a link to the open page is not a button');
  assert.match(link('payments'),/Shown on this page/);
  assert.match(link('cost-forecast'),/<button[^>]*data-module="cost-forecast"/);
  assert.doesNotMatch(link('no-such-page'),/<button/);
  assert.match(link('documents'),/data-module="documents"/);
  for(const key of registryKeys){
    const html=link(key);
    if(key==='payments')continue;
    assert.match(html,new RegExp('data-module="'+key+'"'),key);
  }
});

test('A5: opening a page from any button writes its own address, and Back restores it', ()=>{
  const pushed:string[]=[];let href='http://x/?view=project&project=P1&module=payments';
  const history={pushState:(_s:unknown,_t:string,next:string)=>{pushed.push(next);href='http://x'+next;},replaceState:(_s:unknown,_t:string,next:string)=>{href='http://x'+next;}};
  const location={get href(){return href;},get pathname(){return new URL(href).pathname;},get search(){return new URL(href).search;},get hash(){return new URL(href).hash;}};
  const ctx=createContext({URL,window:{history,location},browserRouteRestoring:false,browserRouteBooting:false,appView:'project',selected:'payments',project:()=>'P1'});
  runInContext(functions(['syncBrowserRoute']),ctx);
  runInContext('selected="cost-forecast";syncBrowserRoute();',ctx);
  assert.deepEqual(pushed,['/?view=project&project=P1&module=cost-forecast']);
  runInContext('syncBrowserRoute();',ctx);
  assert.equal(pushed.length,1,'the same page does not add a second history entry');
  runInContext('browserRouteRestoring=true;selected="payments";syncBrowserRoute();',ctx);
  assert.equal(pushed.length,1,'restoring from Back never pushes a new entry');
  // Every button that changes the page writes the address before the page loads:
  // main navigation and tabs (already), module links, action buttons and the delivery shortcut.
  const changes=[...script.matchAll(/selected=[^;]{1,60};(?:localStorage\.setItem\([^)]*\);)?([^\n]{0,80})loadModule\(selected\)/g)].map(m=>m[0]);
  assert.ok(changes.length>=3,'the walk must find the page-change handlers');
  for(const change of changes)assert.match(change,/syncBrowserRoute\(\)|setAppView\(/,change);
  assert.match(script,/selected=key;\s*localStorage\.setItem\("cmeng-module",selected\);\s*syncBrowserRoute\(\);/);
  assert.match(script,/window\.addEventListener\('popstate',\(\)=>\{void restoreBrowserRoute\(\);\}\)/);
});
