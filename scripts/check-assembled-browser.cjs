'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const ts=require('typescript');
const {cmengUatHtml}=require('../dist/packages/runtime-api/src/ui.js');

// Inspect the exact assembled page served by the built product, not fragments
// from unrelated source modules or an artificially shortened test fixture.
const html=cmengUatHtml(),match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'the served project browser script must exist');
const script=match[1];
new vm.Script(script,{filename:'cmeng-assembled-browser.js'});
const ast=ts.createSourceFile('cmeng-assembled-browser.js',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
assert.equal(ast.parseDiagnostics.length,0,'the complete browser source must parse');
const declarations=new Set();
for(const item of ast.statements){
  if(ts.isFunctionDeclaration(item)&&item.name)declarations.add(item.name.text);
  if(ts.isVariableStatement(item))for(const declaration of item.declarationList.declarations)
    if(ts.isIdentifier(declaration.name))declarations.add(declaration.name.text);
}
const required=[
 'projectRequestIsCurrent','clearProjectWorkspace','openProject','refresh','loadModule',
 'loadEvidence','loadDirector','renderModuleResult','renderModuleResultBody',
 'renderMilestonesVisual','loadMilestoneSourcePage','fmtForField','humanizeIsoText',
 'readerText','readerReference','renderRegisterContractQueries','suppliedBoqPaging'
];
const missing=required.filter(name=>!declarations.has(name));
assert.deepEqual(missing,[], 'every management and paging handler must be declared in the served browser script');
assert.match(script,/await loadModule\(selected\)/,'the selected project page must load first');
console.log('Assembled browser syntax and '+required.length+' required functions verified.');
