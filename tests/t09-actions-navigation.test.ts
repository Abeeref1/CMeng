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
  assert.ok(script.includes('ownerMissingHtml(a.owner,a.accountableRole)'));
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

test('A4 API: a role-only owner is sent as owner null with an explicit missing state; keys never change', async ()=>{
  const {presentMissingOwners}=await import('../packages/runtime-api/src/action-priority');
  const role=pmcRoleOwner('procurement',null),key=role+'|procurement-packages|active_control';
  const body={data:{actions:[{recordKey:'accountability-owner-group:'+key,ownerGroupKey:key,owner:role,title:'A'},{recordKey:'rfi|r-1',owner:'Jane Smith'}],
    groups:[{key,owner:role}],decisions:[{accountableOwner:role}],records:[{dimension:'owner',value:role,recordId:'D-1'},{dimension:'organisation',value:role}]}};
  const before=JSON.stringify(body);
  const out=presentMissingOwners(body) as any;
  assert.equal(JSON.stringify(body),before,'the calculated result is not mutated');
  assert.equal(JSON.stringify(out).includes('"owner":"'+role+'"'),false);
  assert.deepEqual(out.data.actions[0],{recordKey:'accountability-owner-group:'+key,ownerGroupKey:key,owner:null,title:'A',ownerState:'missing',accountableRole:'PMC Procurement Manager'});
  assert.equal(out.data.actions[1],body.data.actions[1],'a named owner is sent unchanged');
  assert.deepEqual(out.data.groups[0],{key,owner:null,ownerState:'missing',accountableRole:'PMC Procurement Manager'});
  assert.deepEqual(out.data.decisions[0],{accountableOwner:null,accountableOwnerState:'missing',accountableRole:'PMC Procurement Manager'});
  assert.deepEqual(out.data.records[0],{dimension:'owner',value:null,recordId:'D-1',ownerState:'missing',accountableRole:'PMC Procurement Manager'});
  assert.equal(out.data.records[1],body.data.records[1],'only owner values are changed');
  // The JSON boundary applies it to every project response.
  const server=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../packages/runtime-api/src/server.ts'),'utf8');
  assert.match(server,/pageProjectResponse\(body,requestUrl,undefined,present\):projectMatch&&statusCode===200\?presentMissingOwners\(body\):body/);
});

test('A4 screens: an owner the API sends as missing shows "Owner not set" with its role on every owner read; never blank, never another field', async ()=>{
  const {presentMissingOwners}=await import('../packages/runtime-api/src/action-priority');
  const ctx=createContext({escapeHtml});
  runInContext(functions(['apiOwnerText','pmcRoleOwner','ownerDisplayState','ownerMissingHtml']),ctx);
  const text=(row:unknown,field?:string)=>runInContext('apiOwnerText('+JSON.stringify(row)+(field?','+JSON.stringify(field):'')+')',ctx);
  const risk=pmcRoleOwner('risk',null),schedule=pmcRoleOwner('schedule',null);
  const sent=presentMissingOwners({actions:[{owner:risk,organisation:'Main Contractor'},{owner:schedule},{owner:'Jane Smith'},{owner:null}],
    decisions:[{accountableOwner:risk}],rows:[{dimension:'owner',value:risk}]}) as any;
  assert.equal(text(sent.actions[0]),'Owner not set · Accountable role: PMC Risk Manager','not blank and not the organisation');
  assert.equal(text(sent.actions[1]),'Owner not set · Accountable role: PMC Planning Engineer');
  assert.equal(text(sent.actions[2]),'Jane Smith','a named owner is unchanged');
  assert.equal(text(sent.actions[3]),null,'a value the API did not mark as missing is left to the existing fallback');
  assert.equal(text(sent.decisions[0],'accountableOwner'),'Owner not set · Accountable role: PMC Risk Manager');
  assert.equal(text(sent.rows[0],'value'),'Owner not set · Accountable role: PMC Risk Manager');
  // Command-centre owner groups are keyed by this text: different roles stay in different groups, as before.
  assert.notEqual(text(sent.actions[0]),text(sent.actions[1]));
  const card=runInContext('ownerMissingHtml(null,"PMC Risk Manager")',ctx) as string;
  assert.match(card,/data-owner-missing>Owner not set<\/span> <small>Accountable role: PMC Risk Manager<\/small>/);
  // Every owner read in the assembled browser script goes through the helper.
  for(const raw of ['escapeHtml(group.owner)','escapeHtml(g.owner)','const recorded=action.owner||','escapeHtml(action.owner||action.organisation',
    'owner:decision.accountableOwner||null',"escapeHtml(row.value||pmcDisplayOwner('project controls'))","row.file+' · '+row.owner",
    "escapeHtml(row.owner||row.organisation||'Not assigned')","const raw=row?.[column[0]];","String(i.owner&&i.owner!=='Project evidence owner'?i.owner:"])
    assert.ok(!script.includes(raw),'raw owner read left in the browser script: '+raw);
  assert.ok(script.includes("r.dimension==='owner'?(typeof apiOwnerText==='function'?apiOwnerText(r,'value'):r.value):r.value"));
  assert.ok(script.includes("(key==='owner'||key==='accountableOwner')&&typeof apiOwnerText==='function'?apiOwnerText(row,key)"),'delivery register owner cells');
  assert.ok(script.includes("(column[0]==='owner'||column[0]==='accountableOwner')&&typeof apiOwnerText==='function'?apiOwnerText(row,column[0])"),'role lens owner cells');
});

test('A4 downloads: JSON and Excel module downloads carry the same owner presentation as the screen', ()=>{
  // The screen boundary (server json()) and the data downloads use the same presentMissingOwners step,
  // so a downloaded report never differs from the page it was taken from (proved end to end by J8).
  const report=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../packages/runtime-api/src/module-report.ts'),'utf8');
  assert.match(report,/buildModuleWorkbook\(projectId,moduleKey,presentMissingOwners\(prepared\)\)/);
  assert.match(report,/buildModuleJsonDownload\(projectId,moduleKey,presentMissingOwners\(prepared\)\)/);
});
