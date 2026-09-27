import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer,DEFAULT_SCHEDULE_ANALYSIS_CONFIG,analyzeSchedule} from '../packages/schedule-analysis-core/src';
import {addWorkingHours,calculateCpm} from '../packages/schedule-cpm/src';
import {buildNearCriticalProjection} from '../packages/near-critical-analysis/src';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {readSnapshotJson,writeSnapshotJson} from '../packages/runtime-api/src/snapshot-json';
import {XER_CALENDAR_READER_VERSION} from '../packages/runtime-api/src/refresh-xer-calendars';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

function calendar(days:number[],shifts:[string,string][],holidays:string[]=[]) {
  const intervals=shifts.map(([s,f],i)=>`(0||${i}(s|${s}|f|${f})())`).join('');
  const exceptions=holidays.map((date,i)=>`(0||${i}(d|${(Date.parse(date)-Date.UTC(1899,11,30))/86400000})())`).join('');
  return `(0||CalendarData()((0||DaysOfWeek()(${[1,2,3,4,5,6,7].map(d=>`(0||${d}()(${days.includes(d)?intervals:''}))`).join('')}))(0||Exceptions()(${exceptions}))))`
    .replaceAll('(0||','\x7f\x7f  (0||');
}
const patterns={
  FIVE:calendar([2,3,4,5,6],[['08:00','12:00'],['13:00','17:00']],['2026-09-21']),
  SIX:calendar([1,2,3,4,5,7],[['07:00','17:00']]),
  SEVEN:calendar([1,2,3,4,5,6,7],[['00:00','24:00']]),
  NIGHT:calendar([1,2,3,4,5,7],[['22:00','06:00']]),
};
function xer(project='CALENDARS',selected:keyof typeof patterns='FIVE',float='-8') {
  return Buffer.from([
    'ERMHDR\t6.1','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date',`%R\t1\t${project}\t2026-09-18 08:00`,
    '%T\tPROJWBS','%F\twbs_id\tproj_id\twbs_name','%R\t10\t1\tWorks',
    '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data',
    ...Object.entries(patterns).map(([id,data])=>`%R\t${id}\t${id}\t8\t48\t${data}`),
    '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tearly_start_date\tearly_end_date',
    `%R\t1\t1\t10\t${selected}\tA\tWork A\tTT_Task\tTK_NotStart\t16\t16\t${float}\t2026-09-18 08:00\t2026-09-22 17:00`,
    '%E',
  ].join('\n'));
}
const options={generatedAt:'2026-09-27',producerVersion:'calendar-regression',config:{...DEFAULT_SCHEDULE_ANALYSIS_CONFIG,nearCriticalWorkingDays:5}};

test('native XER calendars calculate different hand-checked finishes for five, six, seven days and night shifts',()=>{
  const model=canonicalScheduleFromXer(parseXerBytes(xer()),{sourceRevisionId:'R',projectId:'CALENDARS'});
  assert.ok(model.calendars.every(c=>c.semanticComplete));
  const finishes:Record<string,string>={FIVE:'2026-09-22T17:00:00.000Z',SIX:'2026-09-20T13:00:00.000Z',SEVEN:'2026-09-19T00:00:00.000Z',NIGHT:'2026-09-21T06:00:00.000Z'};
  const weekHours:Record<string,number>={FIVE:40,SIX:60,SEVEN:168,NIGHT:48};
  for(const c of model.calendars){
    assert.equal(new Date(addWorkingHours(c,Date.parse('2026-09-18T08:00:00Z'),16)).toISOString(),finishes[c.calendarId],c.calendarId);
    assert.equal(c.standardWeekHours,weekHours[c.calendarId]);
    assert.equal(c.sourceConversionWeekHours,48,'retain the P6 display factor separately');
    const scoped=structuredClone(model);scoped.activities[0]!.calendarId=c.calendarId;
    const result=calculateCpm(scoped,{allowElapsedFallback:false});
    assert.equal(result.complete,true,c.calendarId);
    assert.equal(Date.parse(result.projectFinishIso!),Date.parse(finishes[c.calendarId]!),c.calendarId);
  }
  assert.ok(model.diagnostics.some(d=>d.includes('CALENDAR_CONVERSION_REVIEW')));
  assert.ok(!model.diagnostics.some(d=>d.includes('CALENDAR_SEMANTICS_UNRESOLVED')));
});

test('near-critical working-day boundaries use the assigned timetable, not a fixed eight-hour day',()=>{
  for(const [id,boundary] of [['FIVE',40],['SIX',50],['SEVEN',120],['NIGHT',40]] as const){
    const model=canonicalScheduleFromXer(parseXerBytes(xer('BOUNDARY',id,String(boundary))),{sourceRevisionId:id});
    let result=buildNearCriticalProjection(model,options);
    assert.equal(result.nearCriticalCount,1,id);
    assert.equal(result.rows[0]!.nearCriticalThresholdHours,boundary,id);
    model.activities[0]!.totalFloatHours=boundary+0.01;
    result=buildNearCriticalProjection(model,options);assert.equal(result.nearCriticalCount,0,id);
  }
});

test('known critical and negative float stay visible with unreadable calendars and incomplete source float',()=>{
  const model=canonicalScheduleFromXer(parseXerBytes(xer()),{sourceRevisionId:'PARTIAL'});
  model.calendars.forEach(c=>c.semanticComplete=false);
  const task=model.activities[0]!;
  model.activities=[task,{...task,activityId:'ZERO',totalFloatHours:0},{...task,activityId:'POSITIVE',totalFloatHours:8},{...task,activityId:'UNKNOWN',totalFloatHours:null}];
  const result=buildNearCriticalProjection(model,options);
  assert.equal(result.knownCriticalCount,2);assert.equal(result.knownNegativeFloatCount,1);assert.equal(result.knownZeroFloatCount,1);
  assert.equal(result.unknownFloatCount,1);assert.equal(result.negativeFloatCount,null);assert.equal(result.nearCriticalCount,null);
  assert.deepEqual(result.criticalRows.map(r=>r.activityId),['A','ZERO']);
  assert.deepEqual(result.negativeFloatRows.map(r=>r.activityId),['A']);
  assert.equal(analyzeSchedule(model,options.config).float.knownClassifications.critical,result.knownCriticalCount);
  assert.equal(result.watchlistRows.length,0,'retain the original calendar-dependent band');
  assert.equal(calculateCpm(model,{allowElapsedFallback:false}).complete,false,'known source float never establishes a calculated driving path');

  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source=createSourceFile('ui.js',script,ScriptTarget.Latest,true);
  const fn=source.statements.filter(isFunctionDeclaration).find(n=>n.name?.text==='renderNearCriticalVisual')!.getText(source);
  const html=runInNewContext(fn+';renderNearCriticalVisual(data)',{data:result,projectionFor:(d:unknown)=>d,fmt:String,escapeHtml:String,
    planningDaysBetween:()=>null,planningShortDate:(d:unknown)=>d??'Unresolved',planningStateLabel:String,
    planningKpis:(rows:unknown)=>JSON.stringify(rows),planningFloatHistogram:()=>'',planningFinishPeriodBars:()=>'',distributionSummary:()=>''});
  assert.match(html,/Known critical and negative-float activities/);assert.match(html,/1 known; total unconfirmed/);
  assert.match(html,/<b>A<\/b>/);assert.match(html,/<b>ZERO<\/b>/);
  assert.doesNotMatch(html,/<b>POSITIVE<\/b>|<b>UNKNOWN<\/b>/);
});

const oldDiagnostic='CALENDAR_SEMANTICS_UNRESOLVED:FIVE:CALENDAR_DATA_SYNTAX_ERROR:Expected ")" at offset 19, found "\x7f"';
function legacy(stored:any,documents:any[]){
  delete stored.calendarReaderVersion;
  stored.revision.model.calendars.forEach((c:any)=>{c.semanticComplete=false;c.weeklyWorkMinutes=[0,0,0,0,0,0,0];c.weeklyWorkIntervals=[];c.exceptions=[];});
  stored.revision.model.diagnostics=[oldDiagnostic];
  documents.find(d=>d.linkedArtifactId===stored.revision.revisionId).diagnostics=[oldDiagnostic];
}

test('restart refreshes affected current, pending and phase calendars without changing adoption, source rows or other projects',async t=>{
  const root=mkdtempSync(join(tmpdir(),'cmeng-calendar-recovery-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:root,durable:true});
  for(const input of [{projectId:'A',uploadIntent:'replace_current_basis' as const},{projectId:'A',uploadIntent:'add_update' as const},{projectId:'A',uploadIntent:'replace_current_basis' as const,phaseId:'Next phase'},{projectId:'B',uploadIntent:'replace_current_basis' as const}]){
    await store.ingestSchedule({...input,bytes:xer(input.phaseId??input.projectId+input.uploadIntent),sourceFilename:'same-name.xer',mediaType:'text/plain',role:'update',uploadedAt:'2026-09-27T00:00:00Z'});
  }
  // Settle the existing source migrations before testing calendar-only recovery.
  new RuntimeProjectStore({dataDir:root,durable:true});
  const file=store.persistenceStatus().stateFile;
  const snapshot=readSnapshotJson<any>(file),a=snapshot.projects.find((p:any)=>p.projectId==='A'),b=snapshot.projects.find((p:any)=>p.projectId==='B');
  for(const scope of [a,...a.phaseProgrammes])for(const s of scope.schedules)legacy(s,scope.evidenceDocuments);
  writeSnapshotJson(file,snapshot);
  const before=structuredClone(a),other=JSON.stringify(b);
  const next=new RuntimeProjectStore({dataDir:root,durable:true}),restored=next.get('A')!;
  assert.equal(restored.version,before.version+1);
  assert.deepEqual(restored.activeEvidenceBasis,before.activeEvidenceBasis);
  for(const [index,scope] of [restored,...restored.phaseProgrammes!].entries()){
    const old=[before,...before.phaseProgrammes][index];
    assert.deepEqual(scope.activeEvidenceBasis,old.activeEvidenceBasis);
    for(const [i,s] of scope.schedules.entries()){
      assert.ok(s.revision.model.calendars.every(c=>c.semanticComplete));
      assert.deepEqual(s.revision.model.activities,old.schedules[i].revision.model.activities);
      assert.deepEqual(s.revision.model.relationships,old.schedules[i].revision.model.relationships);
      assert.equal(s.sourceHashSha256,old.schedules[i].sourceHashSha256);
      assert.equal(s.revision.revisionId,old.schedules[i].revision.revisionId);
      assert.equal(s.calendarReaderVersion,XER_CALENDAR_READER_VERSION);
      assert.deepEqual(s.calendarReadRefresh!.previousDiagnostics,[oldDiagnostic]);
    }
    assert.deepEqual(scope.evidenceDocuments.map(d=>({id:d.documentId,state:d.basisState,adoption:d.scheduleAdoption})),old.evidenceDocuments.map((d:any)=>({id:d.documentId,state:d.basisState,adoption:d.scheduleAdoption})));
  }
  const persisted=readSnapshotJson<any>(file);assert.deepEqual(persisted.projects.find((p:any)=>p.projectId==='B'),JSON.parse(other));
  assert.equal(new RuntimeProjectStore({dataDir:root,durable:true}).get('A')!.version,restored.version,'second restart is idempotent');
});

test('calendar refresh refuses changed source bytes and keeps the saved project available',async t=>{
  const root=mkdtempSync(join(tmpdir(),'cmeng-calendar-hash-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:root,durable:true});
  await store.ingestSchedule({projectId:'HASH',bytes:xer(),sourceFilename:'schedule.xer',mediaType:'text/plain',role:'update',uploadedAt:'2026-09-27',uploadIntent:'replace_current_basis'});
  const file=store.persistenceStatus().stateFile,snapshot=readSnapshotJson<any>(file),project=snapshot.projects[0];
  legacy(project.schedules[0],project.evidenceDocuments);writeSnapshotJson(file,snapshot);
  writeFileSync(project.evidenceDocuments[0].storedPath,xer('CHANGED','SEVEN'));
  const restored=new RuntimeProjectStore({dataDir:root,durable:true}).get('HASH')!;
  assert.deepEqual(restored.schedules[0]!.revision.model,project.schedules[0].revision.model);
  assert.ok(restored.evidenceDocuments[0]!.diagnostics.includes('CALENDAR_REFRESH_SOURCE_HASH_MISMATCH'));
  assert.deepEqual(restored.activeEvidenceBasis,project.activeEvidenceBasis);
});
