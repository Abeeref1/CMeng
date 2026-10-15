import test from 'node:test';
import assert from 'node:assert/strict';
import {programmeCompletionAsOf} from '../packages/runtime-api/src/handover-source-review';

test('T08 independent date oracle retains submitted completion while distinguishing qualified as-of evidence',()=>{
 const rows=[
  {status:'completed',actualFinishIso:'2031-08-15'},
  {status:'completed',actualFinishIso:null},
  {status:'completed',actualFinishIso:'2031-09-05'},
  {status:'in_progress',actualFinishIso:null},
  {status:'unknown',actualFinishIso:null}
 ];
 const before=structuredClone(rows);
 const x=programmeCompletionAsOf(rows,'2031-08-31');
 assert.equal(x.sourceCompletedCount,3);
 assert.equal(x.knownAsOfCount,1);
 assert.equal(x.futureCompletionDates,1);
 assert.equal(x.missingCompletionDates,1);
 assert.equal(x.unknown,1);
 assert.equal(x.percentage,null);
 assert.deepEqual(rows,before);
});

test('T08 independently established zero differs from completed-without-date and absent Data Date',()=>{
 const zero=programmeCompletionAsOf([{status:'not_started',actualFinishIso:null}],'2031-08-31');
 assert.deepEqual([zero.sourceCompletedCount,zero.knownAsOfCount,zero.percentage],[0,0,0]);
 const undated=programmeCompletionAsOf([{status:'completed',actualFinishIso:null}],'2031-08-31');
 assert.deepEqual([undated.sourceCompletedCount,undated.knownAsOfCount,undated.missingCompletionDates,undated.percentage],[1,0,1,null]);
 const absent=programmeCompletionAsOf([{status:'completed',actualFinishIso:'2031-08-15'}],null);
 assert.deepEqual([absent.sourceCompletedCount,absent.knownAsOfCount,absent.percentage],[1,null,null]);
});
