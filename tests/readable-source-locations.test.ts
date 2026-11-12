import test from 'node:test';
import assert from 'node:assert/strict';
import {readableAmount,readableSourceLocations} from '../packages/runtime-api/src/source-locations';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// One shared reader: no page shows an internal span code as a location.
test('span codes read as pages, rows and paragraphs; identifiers are never shown',()=>{
  assert.equal(readableSourceLocations(['pdf_page:1:65:102','pdf_page:1:103:168','pdf_page:2:10:40']),'pages 1, 2');
  assert.equal(readableSourceLocations(['pdf_page:3:65:102']),'page 3');
  assert.equal(readableSourceLocations(['evidence-document:evidence_abc123:row:14']),'row 14');
  assert.equal(readableSourceLocations(['docx_block:12:0:40']),'paragraph 12');
  assert.equal(readableSourceLocations(['evidence_979abc81bd603d760dfaf95a']),'retained source text');
  assert.equal(readableSourceLocations(Array.from({length:9},(_,i)=>'pdf_page:'+(i+1)+':0:1')),'pages 1, 2, 3, 4, 5, 6 and 3 more');
  assert.equal(readableAmount(5840000000),'5,840,000,000');
  assert.equal(readableAmount('1234.5'),'1,234.5');
});

test('the review screen embeds the shared reader and no raw span split remains',()=>{
  const html=cmengUatHtml();
  assert.match(html,/function readableSourceLocations\(/);
  assert.doesNotMatch(html,/split\(':'\)\.slice\(-2\)\.join\(' '\)/,'no page prints the last two parts of a span code');
});

test('locations keep the document they belong to when its name is known',()=>{
  const names:Record<string,string>={AMD:'Amendment 2.pdf',MAIN:'Main contract.pdf'};
  assert.equal(readableSourceLocations(['evidence-document:AMD:page:9','evidence-document:MAIN:page:2','evidence-document:MAIN:page:3'],id=>names[id]??null),'Amendment 2.pdf page 9; Main contract.pdf pages 2, 3');
});
