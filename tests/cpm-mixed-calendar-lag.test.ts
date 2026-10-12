import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {CanonicalScheduleModel, CanonicalScheduleActivity} from '../packages/schedule-analysis-core/src';
import {calculateCpm, workingHoursBetween} from '../packages/schedule-cpm/src';

// Frozen independent slot-enumeration answers. This cohort initially exposed
// 49 failures on 7a4c40e; it is permanent regression material, never fresh proof.
const reference = JSON.parse(readFileSync('tests/fixtures/cpm-mixed-calendar-lag-retained.json', 'utf8'));

test('retained signed-lag mixed-calendar networks preserve feasible late dates, float and critical membership', () => {
  assert.equal(reference.cases.length, 120);
  for (const c of reference.cases) {
    const activities: CanonicalScheduleActivity[] = c.durations.map((duration: number, i: number) => ({
      projectId:c.id, activityId:'A'+i, nativeId:null, name:'A'+i, wbsId:null,
      calendarId:c.calendarIds[i], activityType:'task', status:'not_started',
      baselineStartIso:null, baselineFinishIso:null, currentStartIso:null, currentFinishIso:null,
      actualStartIso:null, actualFinishIso:null, forecastStartIso:null, forecastFinishIso:null,
      originalDurationHours:duration, remainingDurationHours:duration,
      totalFloatHours:null, freeFloatHours:null, percentComplete:0, sourceRefs:[], diagnostics:[],
    }));
    const model: CanonicalScheduleModel = {projectId:c.id, source:'xer', sourceRevisionId:c.id,
      dataDateIso:c.anchor, activities, calendars:c.calendars, wbs:[], diagnostics:[],
      relationships:c.relationships.map(([p,s,type,lag]:[number,number,'FS'|'SS'|'FF'|'SF',number], i:number) => ({
        relationshipId:'R'+i, predecessorActivityId:'A'+p, successorActivityId:'A'+s,
        type, lagHours:lag, external:false, sourceRefs:[], diagnostics:[],
      })),
    };
    const actual = calculateCpm(model, {allowElapsedFallback:false, assumeMissingLagZero:false, assumeUnknownRelationshipTypeFs:false});
    assert.equal(actual.complete, true, c.id);
    assert.equal(actual.relationshipLagCalendarMethod, 'successor_calendar_forward_and_backward');
    assert.equal(actual.projectFinishIso, c.projectFinishIso, c.id);
    for (const expected of c.expected) {
      const row = actual.activities.find(a => a.activityId === expected.activityId)!;
      for (const [field,value] of Object.entries(expected)) {
        assert.deepEqual(row[field as keyof typeof row], value, `${c.id}/${expected.activityId}/${field}`);
      }
      const calendar = model.calendars.find(cal => cal.calendarId === row.calendarId)!;
      assert.equal(workingHoursBetween(calendar, Date.parse(row.lateStartIso!), Date.parse(row.lateFinishIso!)), row.durationHours,
        `${c.id}: retaining a start boundary must preserve exactly the required work`);
      assert.ok(row.lateFinishIso! <= actual.projectFinishIso!, c.id);
    }
  }
});
