import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {projectDiagnosisDetails} from '../packages/runtime-api/src/project-diagnosis';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';

let sequence=0;
function originalProgramme(firstCalendarComplete:boolean){
  const projectId='SOURCE-CALENDAR-IDENTITY-'+(++sequence);
  const resolved={...ELAPSED_24H_CALENDAR,calendarId:'C',
    semanticComplete:true,standardDayHours:8};
  const incomplete={...ELAPSED_24H_CALENDAR,calendarId:'C',
    semanticComplete:false,standardDayHours:null};
  const calendarDefinitions=firstCalendarComplete?[resolved,incomplete]:[incomplete,resolved];
  const activities=Array.from({length:7},(_,i)=>({
    projectId,activityId:'ACT-'+i,nativeId:String(i+1),name:'Original task '+i,
    activityType:'task' as const,status:'not_started' as const,wbsId:'W',
    calendarId:i===6?'UNRESOLVED':'C',
    baselineStartIso:'2031-05-01',baselineFinishIso:'2031-06-01',
    currentStartIso:'2031-05-01',currentFinishIso:'2031-06-01',
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,
    originalDurationHours:8,remainingDurationHours:8,totalFloatHours:16,
    freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[],
  }));
  const model:any={projectId,source:'xer',sourceRevisionId:'SOURCE-REV',
    dataDateIso:'2031-05-01',activities,relationships:[],
    wbs:[{wbsId:'W',name:'Source work',parentWbsId:null,sourceRefs:[]}],
    calendars:calendarDefinitions,diagnostics:[]};
  const state=runtimeProjects.getOrCreate(projectId);
  state.schedules.push({role:'update',format:'xer',sourceFilename:'source-programme.xer',
    sourceHashSha256:'source-hash-'+projectId,uploadedAt:'2031-05-02',
    revision:{revisionId:'SOURCE-REV',label:'Submitted',sequence:1,
      effectiveAt:'2031-05-01',model}});
  runtimeProjects.touch(state);
  return {projectId,state,model};
}
function managementDiagnosis(projectId:string):any{
  const result=moduleForProject(projectId,'pmo-analysis');
  assert.ok(result.data&&typeof result.data==='object','management calculation must exist');
  const diagnosis=projectDiagnosisDetails((result.data as any).projectDiagnosis);
  assert.ok(diagnosis,'source-backed diagnosis must remain available');
  return diagnosis;
}
test('T02/T06 first duplicate source calendar retains diagnosis completeness and project isolation',()=>{
  const a=originalProgramme(true),b=originalProgramme(false);
  const aSource=JSON.stringify(a.model),bSource=JSON.stringify(b.model);
  const expected=(model:any)=>model.activities.filter((activity:any)=>{
    const first=model.calendars.find((calendar:any)=>calendar.calendarId===activity.calendarId);
    return first?.semanticComplete!==true;
  }).length;
  const aDiagnosis=managementDiagnosis(a.projectId);
  const bDiagnosis=managementDiagnosis(b.projectId);
  assert.equal(expected(a.model),1,'one genuinely missing calendar');
  assert.equal(expected(b.model),7,'six activities reference unresolved first source calendar');
  assert.equal(aDiagnosis.anomalies.unresolvedCalendars,expected(a.model),
    'later incomplete duplicate cannot overwrite valid first source definition');
  assert.equal(bDiagnosis.anomalies.unresolvedCalendars,expected(b.model),
    'later valid duplicate cannot silently approve incomplete first source definition');
  assert.equal(aDiagnosis.calendarCount,2,'both submitted duplicate definitions remain retained');
  assert.equal(bDiagnosis.calendarCount,2);
  assert.equal(JSON.stringify(a.model),aSource,'original project A calendar and activity source untouched');
  assert.equal(JSON.stringify(b.model),bSource,'original project B calendar and activity source untouched');
  assert.equal(managementDiagnosis(a.projectId).anomalies.unresolvedCalendars,1,
    'reading another project does not change original source precedence');
});
