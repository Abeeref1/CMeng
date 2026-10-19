import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext, runInContext} from 'node:vm';
import {createSourceFile, ScriptTarget, isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F10 (D-115, D-137, D-170 ...): one page shows each block once. Checked against
// the real assembled browser script, not a copy of it.
const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
function fn(name:string){
  const found=source.statements.filter(isFunctionDeclaration).find(n=>n.name?.text===name);
  assert.ok(found,name+' must exist in the assembled browser script');
  return found!.getText(source);
}

type Block={outerHTML:string,textContent:string,remove():void};
function page(htmls:string[]){
  const children:Block[]=[];
  for(const html of htmls){
    const block:Block={outerHTML:html,textContent:html.replace(/<[^>]*>/g,''),remove(){children.splice(children.indexOf(block),1);}};
    children.push(block);
  }
  return {children};
}

test('F10: a repeated identical block on one page is removed, the first copy and every unique block stay',()=>{
  const ctx=createContext({});
  runInContext(fn('removeDuplicatePageBlocks'),ctx);
  const notice='<div class="notice info"><b>Information needed · 3</b><p>Open the shared Actions & Data gaps list.</p></div>';
  const container=page(['<section class="position-verdict"><h3>Answer</h3></section>',notice,'<section><h4>Float</h4><p>12</p></section>',notice,'<section><h4>Float</h4><p>13</p></section>']);
  const first=container.children[1];
  const removed=runInContext('removeDuplicatePageBlocks',ctx)(container);
  assert.equal(removed,1);
  assert.deepEqual(container.children.map(b=>b.outerHTML),['<section class="position-verdict"><h3>Answer</h3></section>',notice,'<section><h4>Float</h4><p>12</p></section>','<section><h4>Float</h4><p>13</p></section>']);
  assert.equal(container.children[1],first,'the first copy (where handlers are bound) is the one kept');
});

test('F10: empty placeholders are not treated as duplicates (they are filled later)',()=>{
  const ctx=createContext({});
  runInContext(fn('removeDuplicatePageBlocks'),ctx);
  const container=page(['<div class="table-wrap"></div>','<div class="table-wrap"></div>']);
  assert.equal(runInContext('removeDuplicatePageBlocks',ctx)(container),0);
  assert.equal(container.children.length,2);
});

test('F10: every module page render applies the shared duplicate-block rule after all blocks are added',()=>{
  const render=fn('renderModuleResult');
  const call=render.lastIndexOf('removeDuplicatePageBlocks(container)');
  assert.ok(call>0,'renderModuleResult applies removeDuplicatePageBlocks');
  for(const marker of ['Information needed · ','Source figures to reconcile · ','programmeActionLink'])
    assert.ok(render.indexOf(marker)<call,marker+' block is added before duplicates are removed');
});
