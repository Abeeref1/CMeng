import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

test('T04 candidate source analysis is visible separately from formal adoption',()=>{
 const page=cmengUatHtml();
 const embedded=page.match(/<script>([\s\S]*?)<\/script>/)![1]!;
 const ast=createSourceFile('browser.js',embedded,ScriptTarget.Latest,true);
 const fn=ast.statements.filter(isFunctionDeclaration).find(x=>x.name?.text==='documentUseLabel');
 assert.ok(fn,'the shared document status display producer is present');
 const label=(basis:string,use:string|null)=>runInNewContext(fn.getText(ast)+
   ';documentUseLabel('+JSON.stringify(basis)+',{sourceAnalyticalUse:'+JSON.stringify(use)+'})',{humanizeKey:(x:string)=>x});
 assert.equal(label('candidate','qualified_source_read'),'Source read and used in analysis · not approved');
 assert.equal(label('candidate',null),'Needs review before current');
 assert.equal(label('active',null),'Current / used now');
 assert.equal(label('superseded',null),'Previous version');
 assert.equal(label('historical',null),'Reference only');
 assert.match(label('candidate','qualified_source_read'),/not approved/);
});

test('T04 document list retains truthful source qualifications without a fake confirmation button',()=>{
 const source=cmengUatHtml();
 assert.ok(source.includes('Readable source records are used with qualifications'));
 assert.ok(source.includes('sourceAnalyticalUse==="qualified_source_read"'));
 assert.match(source,/sourceAnalyticalUse==="qualified_source_read"\?"ready"/);
});
