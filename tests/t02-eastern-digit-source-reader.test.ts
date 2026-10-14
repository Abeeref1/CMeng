import test from 'node:test';
import assert from 'node:assert/strict';
import {numberValue,prepareRegisterRows} from '../packages/truth-kernel/src';

test('T02 SW-13 native Persian and Arabic register numerals retain zero and exact source cells',()=>{
 const cases:Array<[string,number|null]>=[
  ['۱٬۲۳۴٫۵',1234.5],['١٬٢٣٤٫٥',1234.5],
  ['(۱٬۲۳۴٫۵)',-1234.5],['(١٬٢٣٤٫٥)',-1234.5],
  ['۰',0],['٠',0],['0',0],['-۰',0],
  ['12.75',12.75],['1,234.5',1234.5],
  ['(−۱۰۰)',null],['۱٫۲٫۳',null],['1,23,4',null],['missing',null],['',null],
 ];
 for(const [source,expected] of cases)
   assert.equal(numberValue(source),expected,'input '+JSON.stringify(source));
 const original=[
  ['Package ID','Package Value','Currency'],
  ['PK-EASTERN','۱٬۲۳۴٫۵','AED'],
  ['PK-ZERO','۰','AED'],
  ['PK-INVALID','۱٫۲٫۳','AED'],
 ];
 const frozen=JSON.stringify(original);
 const read=prepareRegisterRows(original,'procurement_register');
 assert.equal(read.rows.length,3);
 assert.equal(read.rows[0]?.[1],'۱٬۲۳۴٫۵');
 assert.equal(numberValue(read.rows[0]![1]!),1234.5);
 assert.equal(numberValue(read.rows[1]![1]!),0);
 assert.equal(numberValue(read.rows[2]![1]!),null);
 assert.equal(JSON.stringify(original),frozen,'reader must not edit the source');
});
