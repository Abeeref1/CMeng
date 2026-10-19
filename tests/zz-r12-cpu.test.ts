import test from 'node:test';
import {readFileSync} from 'node:fs';
// TEMPORARY: prints the runner CPU for the j8-final duration in the same CI run.
test('r12-perf2 runner CPU',()=>{
  let model='unknown';try{model=(/model name\s*:\s*(.*)/.exec(readFileSync('/proc/cpuinfo','utf8'))?.[1]??'unknown').trim();}catch{}
  console.log('R12CPU '+model);
});
