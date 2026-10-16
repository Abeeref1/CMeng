import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {runInNewContext} from 'node:vm';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

test('T10 internal diagnostic tokens use a professional screen label without erasing source identity',()=>{
 const browser=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(browser,'assembled browser script must exist');
 const ast=createSourceFile('cmeng-ui.js',browser,ScriptTarget.Latest,true);
 const helper=ast.statements.filter(isFunctionDeclaration)
   .find(n=>n.name?.text==='humanizeKey');
 assert.ok(helper,'the actual reader-facing helper, not a test substitute, is used');
 const key='UNMAPPED_INTERNAL_ENGINE_TOKEN:ABC';
 const original=key;
 const data=runInNewContext(helper.getText(ast)+
   ';({internal:humanizeKey("UNMAPPED_INTERNAL_ENGINE_TOKEN:ABC"),specific:humanizeKey("SCHEDULE_GRAPH_CYCLES:A1"),ordinary:humanizeKey("submittal_register")})');
 assert.equal(data.internal,'Additional calculation qualification');
 assert.match(data.specific,/circular relationship/i);
 assert.equal(data.ordinary,'Submittal');
 assert.equal(key,original,'source diagnostic code remains untouched');
});
