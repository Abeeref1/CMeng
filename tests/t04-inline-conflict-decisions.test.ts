import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {runInNewContext} from 'node:vm';
import {projectActionsScript} from '../packages/runtime-api/src/ui-project-actions';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

test('T04 conflict actions open the existing source-bound decision form inline beside its page, without duplicating approval controls',async()=>{
 const ast=createSourceFile('action-code.js',projectActionsScript,ScriptTarget.Latest,true);
 const fn=ast.statements.filter(isFunctionDeclaration).find(x=>x.name?.text==='openProjectActions');
 assert.ok(fn,'existing action form owner is retained');
 let moved=0,refreshed=0,scrolled=0;
 const drawer:any={hidden:true,open:false,scrollIntoView:()=>{scrolled++}};
 const modulePanel:any={insertAdjacentElement:(place:string,element:unknown)=>{
   assert.equal(place,'afterend');assert.equal(element,drawer);moved++;
 }};
 const context={overview:{projectId:'P'},el:(id:string)=>id==='projectReviewDrawer'?drawer:
   id==='projectModulePanel'?modulePanel:null,loadProjectActions:async()=>{refreshed++}};
 const launch=runInNewContext(fn.getText(ast)+';openProjectActions(true)',context);
 await launch;
 assert.equal(moved,1,'same page is used, instead of moving to a separate view');
 assert.equal(refreshed,1,'original current/versioned source decision action is loaded');
 assert.equal(scrolled,1,'user is taken to decision beside the current page');
 assert.equal(drawer.hidden,false);assert.equal(drawer.open,true);
 // Non-inline navigation keeps the same existing source-bound form; no extra
 // user accounts or duplicate decision controls are created.
 drawer.open=false;await runInNewContext(fn.getText(ast)+';openProjectActions()',context);
 assert.equal(moved,1);assert.equal(refreshed,2);assert.equal(drawer.open,true);
});

test('T04 conflicted pages offer an actionable same-page source choice, not a dead waiting banner',()=>{
 const src=cmengUatHtml();
 assert.match(src,/sourceConflicts=issues\.filter/);
 assert.match(src,/data-review-conflict-inline/);
 assert.match(src,/openProjectActions\(true\)/);
 assert.match(src,/sourceConflicts\.flatMap\(issue=>issue\.sourceRefs/);
 assert.match(src,/Clear source values remain available in analysis/);
 assert.match(projectActionsScript,/resolveReviewDecision\(b\.dataset\.resolveReview\)/);
 assert.match(projectActionsScript,/resolveDocumentAction\(b\.dataset\.resolveDocument\)/);
});
