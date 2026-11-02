import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// M14.3/K4 invariant, read from the real assembled browser script. A page that
// runs no listed checks (Delivery registers, Accountability, Recovery) shows no
// check badge; a check page that has not run says "Not checked yet" (never zero);
// a page that ran its checks shows its own result, so after the pages calculate
// no page that ran checks shows the not-checked label.
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'real CMeng browser script exists');
const source=createSourceFile('cmeng-screen.js',script,ScriptTarget.Latest,true);
function originalFunction(name:string):string{
 const node=source.statements.find(n=>isFunctionDeclaration(n)&&n.name?.text===name);
 assert.ok(node,'missing production browser function '+name);return node.getText(source);
}

test('M14.3: the nav check badge comes from the page own check state',()=>{
 const badge=runInNewContext([originalFunction('knownScreenCount'),originalFunction('navCheckBadge'),';navCheckBadge'].join('\n')) as (state:unknown)=>string;
 assert.equal(badge(undefined),'','a page with no listed checks shows no check badge');
 assert.match(badge({key:'cost-forecast'}),/Not checked yet/,'a check page that has not run says so');
 assert.doesNotMatch(badge({key:'cost-forecast'}),/Checks not established/);
 assert.equal(badge({issueAssessment:{counts:{system_defect:0}}}),'','checks ran with no failure: no badge');
 assert.match(badge({issueAssessment:{counts:{system_defect:2}}}),/Error 2/);
 // The nav uses the opened page's own result for this project version.
 assert.match(script!,/rememberPageChecks\(result\)/,'an opened page records the checks it ran');
 assert.match(script!,/const count='<span class="nav-counts">'\+navCheckBadge\(state\)\+'<\/span>'/,'the nav badge reads one rule');
 assert.doesNotMatch(script!,/nav-count review">Checks not established/,'the old label for pages without checks is gone');
});
