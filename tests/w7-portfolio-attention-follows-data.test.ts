import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// F50: the Portfolio card text follows the data. "No immediate management
// action identified." is a claim that the open-action count is zero; it must
// not appear when the count is unknown or above zero.
function attention(p:any){
  const embedded=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const ast=createSourceFile('browser.js',embedded,ScriptTarget.Latest,true);
  const fn=ast.statements.filter(isFunctionDeclaration).find(x=>x.name?.text==='portfolioAttentionText');
  assert.ok(fn,'the Portfolio card attention text has one producer');
  return runInNewContext(fn!.getText(ast)+';portfolioAttentionText('+JSON.stringify(p)+')',{});
}
test('F50 no-action claim only when the shared open-action count is known to be zero',()=>{
  assert.equal(attention({positionState:'current',managementActionCount:0,managementActions:[]}),'No immediate management action identified.');
  assert.equal(attention({positionState:'current',managementActionCount:null,managementActions:[]}),'Management actions not established.');
  assert.equal(attention({positionState:'current',managementActions:[]}),'Management actions not established.');
  assert.equal(attention({positionState:'current',managementActionCount:3,managementActions:[]}),'3 open management actions · open the project for details.');
});
test('F50 existing card priorities are unchanged',()=>{
  assert.equal(attention({analysisError:'Updating',managementActionCount:0}),'Updating');
  assert.equal(attention({positionState:'current',managementActionCount:2,managementActions:['Late RFI — escalate']}),'Late RFI — escalate');
  assert.equal(attention({positionState:'needs_information',managementActionCount:null}),'Add the core programme and BOQ records to establish the current position.');
  assert.equal(attention({positionState:'needs_review',managementActionCount:null}),'Update the project position using the latest project records.');
});
test('F50 the Portfolio card uses the shared attention producer',()=>{
  const embedded=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  assert.match(embedded,/const attention=portfolioAttentionText\(p\);/);
  assert.equal((embedded.match(/No immediate management action identified\./g)||[]).length,1,'one place states the no-action claim');
});
