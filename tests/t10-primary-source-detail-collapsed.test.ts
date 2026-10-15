import test from 'node:test';
import assert from 'node:assert/strict';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

test('T10 generic structured source detail is retained but closed off the primary view',()=>{
  const html=cmengUatHtml();
  assert.match(html,/supporting-structured-data/);
  assert.match(html,/Supporting source detail/);
  assert.doesNotMatch(html,/<details class="management-detail supporting-structured-data" open>/);
  assert.match(html,/renderStructuredValue\(value,0,key\)/);
});
