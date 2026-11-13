// Invariant (12 Nov): the route the browser requests to open a page is the
// route release preparation saves. Saved results are keyed by the exact route,
// so a page prepared under its internal key ("near-critical") and opened under
// its page key ("near-critical-and-float-risk") was calculated again on first
// open: Accountability and Actions required took 15 to 25 s on the largest
// live projects right after a deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {moduleRegistry} from '../packages/runtime-api/src/registry';
import {projectPageRoutes} from '../packages/runtime-api/src/project-gateway';

function browserScript(){
  const html=cmengUatHtml();
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
}

test('every page is opened by the browser with a route that release preparation saves',()=>{
  const script=browserScript();
  const definition=/\n(function pageDataRoute\(page\)\s*\{[\s\S]*?\n\})\n/.exec(script);
  assert.ok(definition,'the browser script defines pageDataRoute');
  const browserRoute=vm.runInNewContext('('+definition![1]+')') as (page:unknown)=>string;
  const browserRegistry=JSON.parse(/const moduleRegistry=(\[[\s\S]*?\]);\n/.exec(script)![1]!) as typeof moduleRegistry;
  assert.equal(browserRegistry.length,moduleRegistry.length);
  const prepared=new Set(projectPageRoutes('ABB-100'));
  // The page as the browser loader describes it: its key, page key (apiKeys) and area.
  const apiKeys=Object.fromEntries(browserRegistry.map(page=>[page.key,page.apiKey]));
  const management=new Set(JSON.parse(/const managementSurfaceKeysForApi=new Set\((\[[^\]]*\])\)/.exec(script)![1]!) as string[]);
  const asLoaded=(page:{key:string;area:string})=>({key:page.key,apiKey:apiKeys[page.key],area:management.has(page.key)?'management':page.area});
  const missing=browserRegistry.map(page=>'/api/projects/ABB-100'+browserRoute(asLoaded(page))).filter(route=>!prepared.has(route));
  assert.deepEqual(missing,[],'pages the browser opens that release preparation never saves');
  // The pages that were cold on 12 Nov, by name.
  for(const route of ['/management/accountability','/management/actions-required','/schedule/modules/near-critical-and-float-risk','/delivery/modules/procurement-s-curves','/schedule/modules/activity-review?view=page'])
    assert.ok(prepared.has('/api/projects/ABB-100'+route),route);
});

test('the browser page loader builds its data route only through pageDataRoute',()=>{
  const script=browserScript();
  assert.ok(script.includes('result=await api("/api/projects/"+encodeURIComponent(project())+pageDataRoute({key,apiKey:apiKeys[key],area:'),'the page loader uses the shared route');
  // No second construction of a page route from apiKeys anywhere in the browser script.
  assert.doesNotMatch(script,/"\/modules\/"\+encodeURIComponent\(apiKeys\[/);
  assert.doesNotMatch(script,/"\/management\/"\+encodeURIComponent\(apiKeys\[/);
});

// 13 Nov audit: the Activity Review table asks for its first page as the page opens
// (13 to 20 s on first open of large projects). Run the real browser loader with no
// filter and check release preparation saves the exact request it makes.
test('the Activity Review table request on page open is prepared',async()=>{
  const {createSourceFile,ScriptTarget,isFunctionDeclaration}=require('typescript') as typeof import('typescript');
  const source=createSourceFile('browser.js',browserScript(),ScriptTarget.Latest,true);
  const wanted=['filterActivityReview','activityFilterValue','activityRegisterParams','activityRegisterRoute'];
  const code=source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&wanted.includes(n.name.text)).map(n=>n.getText(source)).join('\n');
  let requested='';
  const context=vm.createContext({URLSearchParams,currentModuleResult:{key:'activity-analytics'},activityReviewRequest:0,project:()=>'ABB-100',
    el:(id:string)=>id==='activityFilterBody'?{innerHTML:''}:id==='activityFilterCount'?{textContent:''}:{value:''},
    api:async(path:string)=>{requested=path;throw new Error('stop');},escapeHtml:String});
  vm.runInContext(code+';var activityReviewRequest=0;',context);
  await vm.runInContext('filterActivityReview(0)',context);
  assert.match(requested,/view=register/,'the loader asked for the table');
  assert.ok(new Set(projectPageRoutes('ABB-100')).has(requested),'prepared: '+requested);
});
