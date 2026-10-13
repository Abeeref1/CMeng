import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleIdleProjectWork} from '../packages/runtime-api/src/project-idle-work';

const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));

test('deferred project work never starts while a foreground request is active',async()=>{
  let calls=0;
  const task=scheduleIdleProjectWork(async()=>{calls++;return false;},{idleMillis:10});
  try{
    task.requestStarted();
    task.start();
    await sleep(45);
    assert.equal(calls,0,'foreground request must not wait for new deferred work');
    task.requestFinished();
    await sleep(55);
    assert.equal(calls,1);
    task.requestStarted();
    task.requestFinished();
    await sleep(30);
    assert.equal(calls,1,'completed work cannot restart when another page opens');
  }finally{task.close();}
});

test('multiple retained documents are processed one per idle turn without overlap',async()=>{
  let calls=0,active=0,peak=0;
  const task=scheduleIdleProjectWork(async()=>{
    active++;
    peak=Math.max(peak,active);
    await sleep(12);
    active--;
    calls++;
    return calls<3;
  },{idleMillis:9});
  try{
    task.start();
    await sleep(155);
    assert.equal(calls,3);
    assert.equal(peak,1);
  }finally{task.close();}
});

test('closing a worker cancels scheduled deferred work',async()=>{
  let calls=0;
  const task=scheduleIdleProjectWork(async()=>{calls++;return true;},{idleMillis:25});
  task.start();
  task.close();
  await sleep(65);
  assert.equal(calls,0);
});

test('failed deferred work is surfaced once instead of spinning forever',async()=>{
  let calls=0,failures=0;
  const task=scheduleIdleProjectWork(async()=>{calls++;throw Error('reader failed');},{idleMillis:10,onError:()=>failures++});
  try{
    task.start();
    await sleep(55);
    assert.equal(calls,1);
    assert.equal(failures,1);
  }finally{task.close();}
});
