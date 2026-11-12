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
  const definition=/const pageDataRoute=(function pageDataRoute[\s\S]*?\n\})\s*;/.exec(script)??/const pageDataRoute=(function pageDataRoute\([^)]*\)\s*\{[^\n]*\})\s*;/.exec(script);
  assert.ok(definition,'the browser script defines pageDataRoute');
  const browserRoute=vm.runInNewContext('('+definition![1]+')') as (page:unknown)=>string;
  const browserRegistry=JSON.parse(/const moduleRegistry=(\[[\s\S]*?\]);\n/.exec(script)![1]!) as typeof moduleRegistry;
  assert.equal(browserRegistry.length,moduleRegistry.length);
  const prepared=new Set(projectPageRoutes('ABB-100'));
  const missing=browserRegistry.map(page=>'/api/projects/ABB-100'+browserRoute(page)).filter(route=>!prepared.has(route));
  assert.deepEqual(missing,[],'pages the browser opens that release preparation never saves');
  // The pages that were cold on 12 Nov, by name.
  for(const route of ['/management/accountability','/management/actions-required','/schedule/modules/near-critical-and-float-risk','/delivery/modules/procurement-s-curves','/schedule/modules/activity-review?view=page'])
    assert.ok(prepared.has('/api/projects/ABB-100'+route),route);
});

test('the browser page loader builds its data route only through pageDataRoute',()=>{
  const script=browserScript();
  assert.ok(script.includes('result=await api("/api/projects/"+encodeURIComponent(project())+pageDataRoute('),'the page loader uses the shared route');
  // No second construction of a page route from apiKeys anywhere in the browser script.
  assert.doesNotMatch(script,/"\/modules\/"\+encodeURIComponent\(apiKeys\[/);
  assert.doesNotMatch(script,/"\/management\/"\+encodeURIComponent\(apiKeys\[/);
});
