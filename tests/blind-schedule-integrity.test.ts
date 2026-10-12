import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src';
import {defaultBlindSeed,generateBlindRound,generateForecastFeatureBlindRound} from './blind-project-generator';

test('fresh general and resource XER cohorts contain resolvable connected schedule links',async()=>{
  const seed=defaultBlindSeed()+'::LINK-INTEGRITY';
  const rounds=await Promise.all([generateBlindRound(seed+'::general',10),generateForecastFeatureBlindRound(seed+'::forecast',10)]);
  for(const round of rounds)for(const project of round.projects)for(const document of project.documents.filter(d=>d.kind==='xer')){
    const parsed=parseXerBytes(document.bytes);
    const model=canonicalScheduleFromXer(parsed,{projectId:project.projectId,sourceRevisionId:'link-integrity'});
    const ids=new Set(model.activities.map(a=>a.activityId));
    assert.equal(ids.size,model.activities.length,'Generated activity codes must be unique');
    assert.equal(model.relationships.length,model.activities.length-1,'Every intended chain link must survive source reading');
    for(const relationship of model.relationships){
      assert.ok(ids.has(relationship.predecessorActivityId),'Generated predecessor project/native identity must resolve');
      assert.ok(ids.has(relationship.successorActivityId),'Generated successor project/native identity must resolve');
      assert.notEqual(relationship.predecessorActivityId,relationship.successorActivityId);
    }
  }
});
