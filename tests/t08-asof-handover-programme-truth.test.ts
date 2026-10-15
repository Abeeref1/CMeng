import test from 'node:test';
import assert from 'node:assert/strict';
import {programmeCompletionAsOf} from '../packages/runtime-api/src/handover-source-review';

test('T08 future and undated completed tasks cannot inflate as-of handover completion',()=>{
 const source=[
  {status:'completed',actualFinishIso:'2032-02-28'},
  {status:'completed',actualFinishIso:'2032-03-15'},
  {status:'completed',actualFinishIso:null},
  {status:'in_progress',actualFinishIso:null},
 ];
 const original=JSON.stringify(source);
 const position=programmeCompletionAsOf(source,'2032-03-01');
 assert.equal(position.sourceCompletedCount,3,'all original submitted status flags retained');
 assert.equal(position.knownAsOfCount,1,'only dated completion before Data Date counts');
 assert.equal(position.futureCompletionDates,1);
 assert.equal(position.missingCompletionDates,1);
 assert.equal(position.percentage,null,'no falsely complete percentage when status/date disagree');
 assert.equal(JSON.stringify(source),original);
});
test('T08 valid leap-day actual completion is recognized and independently arithmetical',()=>{
 const rows=[{status:'completed',actualFinishIso:'2032-02-29'},{status:'in_progress',actualFinishIso:null}];
 const p=programmeCompletionAsOf(rows,'2032-03-01');
 assert.equal(p.knownAsOfCount,1);
 assert.equal(p.percentage,50);
 assert.equal(p.futureCompletionDates,0);
 assert.equal(p.missingCompletionDates,0);
});
test('T08 unknown programme cutoff does not fabricate current completion or source proportion',()=>{
 const p=programmeCompletionAsOf([{status:'completed',actualFinishIso:'2032-02-29'}],null);
 assert.equal(p.knownAsOfCount,null);assert.equal(p.percentage,null);
 assert.equal(p.sourceCompletedCount,1);
});
test('T08 invalid calendar completion is not treated as a real as-of task',()=>{
 const p=programmeCompletionAsOf([{status:'completed',actualFinishIso:'2032-02-30'}],'2032-03-31');
 assert.equal(p.knownAsOfCount,0);
 assert.equal(p.missingCompletionDates,1);
 assert.equal(p.percentage,null);
});
test('T08 completed all dated at cutoff is exactly 100 percent, not artificially suppressed',()=>{
 const p=programmeCompletionAsOf([{status:'completed',actualFinishIso:'2032-03-01'},{status:'completed',actualFinishIso:'2032-02-29'}],'2032-03-01');
 assert.equal(p.knownAsOfCount,2);assert.equal(p.percentage,100);
});
