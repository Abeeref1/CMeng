import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

import {cmengUatHtml} from '../packages/runtime-api/src/ui';

test('Master Dashboard preserves the executive hierarchy even when no additional executive metric is established',()=>{
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  assert.match(script,/managementPanel\("Executive Project Position"/);
  assert.match(script,/No additional executive metric is established from the current evidence/);
  assert.match(script,/Missing higher-authority measures stay in Control Gaps/);
});

test('Railway browser acceptance recognises the valid conditional Delay Windows state',()=>{
  const source=readFileSync('scripts/railway-browser-acceptance.py','utf8');
  assert.match(source,/movement_position=all\(label in body/);
  assert.match(source,/conditional_position=\("Delay-window analysis is not yet applicable" in body and "comparable programme" in body\)/);
  assert.match(source,/movement_position or conditional_position/);
});
