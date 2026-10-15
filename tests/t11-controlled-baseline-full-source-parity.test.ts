import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScheduleTime, type CanonicalScheduleActivity} from '../packages/schedule-analysis-core/src';
import {latestControlledBaselineCompletion} from '../packages/runtime-api/src/controlled-baseline-completion';

type Activity=Pick<CanonicalScheduleActivity,'activityId'|'baselineFinishIso'|'currentFinishIso'>;
// Independent reference is the original full-source stable map/filter/sort,
// never CMeng's new one-pass implementation or its returned result.
const original=(activities:readonly Activity[])=>activities
  .map(activity=>({activityId:activity.activityId,dateIso:activity.baselineFinishIso??activity.currentFinishIso}))
  .filter((row):row is {activityId:string;dateIso:string}=>row.dateIso!==null&&Number.isFinite(parseScheduleTime(row.dateIso)))
  .sort((a,b)=>a.dateIso.localeCompare(b.dateIso)).at(-1)??null;

const iso=(i:number)=>'2032-'+String(1+(i%12)).padStart(2,'0')+'-'+String(1+(i%28)).padStart(2,'0');

test('T11 cold full bundle retains the original all-row controlled baseline completion and stable source tie precedence',()=>{
  for(const [site,count] of [['SITE-ONE',13991],['SITE-TWO',8103],['EMPTY',0],['SINGLE',1]] as const){
    const rows:Activity[]=Array.from({length:count},(_,i)=>({
      activityId:site+'-'+i,
      baselineFinishIso:i%23===0?null:i%17===0?'invalid-date':i%41===0?'2035-01-01':iso(i),
      currentFinishIso:i%31===0?null:i%29===0?'not-a-date':i%41===0?'2036-07-01':iso(i+6),
    }));
    if(count>1)rows.push(
      {activityId:site+'-TIE-A',baselineFinishIso:'2045-12-01',currentFinishIso:'2045-11-01'},
      {activityId:site+'-TIE-B',baselineFinishIso:null,currentFinishIso:'2045-12-01'},
    );
    const originalBytes=JSON.stringify(rows);
    assert.deepEqual(latestControlledBaselineCompletion(rows),original(rows),site+' complete source population');
    assert.equal(JSON.stringify(rows),originalBytes,'source dates and activity order are immutable');
    assert.deepEqual(latestControlledBaselineCompletion(rows),original(rows),'repeat must have same result');
    if(count>1)assert.equal(latestControlledBaselineCompletion(rows)?.activityId,site+'-TIE-B','last equal-date source row preserved');
  }
});

test('T11 baseline missing and invalid dates do not fabricate an end or replace an earlier valid source',()=>{
 const a:Activity[]=[
   {activityId:'A',baselineFinishIso:null,currentFinishIso:'2030-08-01'},
   {activityId:'B',baselineFinishIso:'invalid',currentFinishIso:'2099-01-01'},
   {activityId:'C',baselineFinishIso:null,currentFinishIso:null},
 ];
 assert.deepEqual(latestControlledBaselineCompletion(a),original(a));
 assert.deepEqual(latestControlledBaselineCompletion(a),{activityId:'A',dateIso:'2030-08-01'});
 assert.equal(latestControlledBaselineCompletion(a.slice(1)),null);
 assert.equal(latestControlledBaselineCompletion([]),null);
 a[0]!.baselineFinishIso='2030-11-30';
 assert.deepEqual(latestControlledBaselineCompletion(a),original(a),'source edit cannot retain stale prior result');
});
