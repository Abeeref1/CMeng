import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execSync} from 'node:child_process';
import {mkdtempSync,readFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// TEMPORARY r12-perf2 A/B: the unchanged j8-final-blind-release-acceptance test
// file of the base build (v/int5 92d3c03f) and of this build, run on the SAME
// runner with the same fixed project-set seed, base then fixed.
const BASE='92d3c03fe57c653c2acf8f2ce3217cdac5cf6cf4';
const cpuModel=(()=>{try{return (/model name\s*:\s*(.*)/.exec(readFileSync('/proc/cpuinfo','utf8'))?.[1]??'unknown').trim();}catch{return 'unknown';}})();
async function j8(file:string){
  const started=Date.now();
  const env={...process.env,CMENG_GENERATOR_SEED:'r12-perf2-j8-ab-fixed-seed'};delete (env as any).NODE_TEST_CONTEXT;
  const child=spawn(process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',file],{env,stdio:['ignore','pipe','pipe']});
  let out='';child.stdout.on('data',chunk=>{out+=chunk;});child.stderr.on('data',chunk=>{out+=chunk;});
  const code=await new Promise<number|null>(resolve=>child.on('close',resolve));
  const duration=/duration_ms:? ([0-9.]+)/.exec(out)?.[1];
  const result=/CMENG_J8_FINAL_RESULT=(\{.*\})/.exec(out)?.[1]??null;
  return {code,wallMs:Date.now()-started,testMs:duration?Math.round(Number(duration)):null,result,tail:code===0?'':out.slice(-1500).replace(/\n/g,' | ')};
}
test('r12-perf2 j8-final A/B on one runner',{timeout:2_400_000},async()=>{
  console.log('R12CPU '+cpuModel);
  const repo=process.cwd(),work=mkdtempSync(join(tmpdir(),'r12-j8ab-')),base=join(work,'base');
  let s=Date.now();
  execSync('git fetch -q --depth=1 origin '+BASE,{cwd:repo,stdio:'inherit'});
  const sha=BASE;
  execSync('git worktree add -q --detach '+base+' '+(sha||BASE),{cwd:repo,stdio:'inherit'});
  symlinkSync(resolve(repo,'node_modules'),join(base,'node_modules'));
  execSync('npm run -s build',{cwd:base,stdio:'inherit'});
  console.log('R12J8AB base '+(sha||BASE)+' built in '+(Date.now()-s)+' ms');
  const baseRun=await j8(join(base,'dist','tests','j8-final-blind-release-acceptance.test.js'));
  console.log('R12J8AB base exit '+baseRun.code+' test '+baseRun.testMs+' ms wall '+baseRun.wallMs+' ms '+(baseRun.result??'')+' '+baseRun.tail);
  const fixedRun=await j8(join(repo,'dist','tests','j8-final-blind-release-acceptance.test.js'));
  console.log('R12J8AB fixed exit '+fixedRun.code+' test '+fixedRun.testMs+' ms wall '+fixedRun.wallMs+' ms '+(fixedRun.result??'')+' '+fixedRun.tail);
  execSync('git worktree remove --force '+base,{cwd:repo});
  assert.equal(fixedRun.code,0);
});
