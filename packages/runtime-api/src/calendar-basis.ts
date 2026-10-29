import {createHash} from 'node:crypto';
import type {CanonicalCalendar,CanonicalScheduleModel} from '../../schedule-analysis-core/src';
import type {ProjectRuntimeState} from './project-state-types';

// M6.3: ONE governed planner decision on the programme's calendar basis and ONE
// place that applies it. The control-schedule accessor returns the effective
// model with the confirmed basis applied (a derived object; the stored source is
// never changed), so every forecast consumer (CPM, gate, facts, history,
// criticality, Project Review) reads the same basis. Without a decision nothing
// changes: CMeng's finish stays visible and qualified. CMeng never chooses a
// calendar: the planner chooses, from what the source states.

type StoredSchedule=ProjectRuntimeState['schedules'][number];
export const CALENDAR_BASIS_KEY='calendar-basis';
export const CALENDAR_PATTERN_PREFIX='calendar-pattern:';
export type DurationBasis='working_days'|'calendar_days';
export interface CalendarBasisDecision{durationBasis:DurationBasis|null;patterns:Array<{calendarId:string;days:number[];hours:number;label:string}>;confirmedAt:string|null;fingerprint:string}

const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);

/** The calendars a decision answers; a new revision with changed calendars makes it stale. */
const fingerprints=new WeakMap<CanonicalScheduleModel,string>();
export function calendarBasisFingerprint(model:CanonicalScheduleModel):string{
  const hit=fingerprints.get(model);if(hit)return hit;
  const value=calendarBasisFingerprintOf(model);fingerprints.set(model,value);return value;
}
function calendarBasisFingerprintOf(model:CanonicalScheduleModel):string{
  return 'calendar-basis-v1:'+hash(model.calendars.map(c=>[c.calendarId,c.name,c.semanticComplete,c.weeklyWorkMinutes??null,c.sourceConversionDayHours??null,c.sourceConversionWeekHours??null,(c.exceptions??[]).length]));
}
export function calendarPatternFingerprint(calendar:CanonicalCalendar):string{
  return 'calendar-pattern-v1:'+hash([calendar.calendarId,calendar.name,calendar.semanticComplete,calendar.weeklyWorkMinutes??null,calendar.sourceConversionDayHours??null,calendar.sourceConversionWeekHours??null]);
}

/** Calendars used by unfinished work whose working days are not stated, but whose
 * day and week hours are (a "6D-8H" style calendar): the known part, and the
 * working weeks the planner can choose from. Nothing is chosen for the planner. */
export function shorthandCalendars(model:CanonicalScheduleModel){
  const used=new Set(model.activities.filter(a=>a.status!=='completed'&&a.activityType!=='wbs_summary'&&a.activityType!=='level_of_effort').map(a=>a.calendarId).filter((id):id is string=>!!id));
  return model.calendars.filter(c=>used.has(c.calendarId)&&!c.semanticComplete&&!(c.weeklyWorkMinutes??[]).some(m=>m>0)).flatMap(c=>{
    const dayHours=c.sourceConversionDayHours??null,weekHours=c.sourceConversionWeekHours??null;
    if(!dayHours||!weekHours||dayHours<=0||dayHours>24)return [];
    const days=weekHours/dayHours;
    if(!Number.isInteger(days)||days<1||days>7)return [];
    return [{calendarId:c.calendarId,name:c.name,dayHours,days,fingerprint:calendarPatternFingerprint(c),options:workingWeeks(days).map(set=>({value:'week:'+set.join(''),days:set,
      label:weekLabel(set)+', '+dayHours+' h a day (the source states '+days+' days of '+dayHours+' h; shift times are not stated, so dates are counted in whole working days)'}))}];
  });
}
function workingWeeks(days:number):number[][]{
  if(days===7)return [[0,1,2,3,4,5,6]];
  // Consecutive working weeks starting on each day; the planner picks the real one.
  return [6,0,1].map(start=>Array.from({length:days},(_,i)=>(start+i)%7).sort((a,b)=>a-b)).filter((set,i,all)=>all.findIndex(o=>o.join()===set.join())===i);
}
function weekLabel(set:number[]):string{
  const ordered=[...set].sort((a,b)=>((a+1)%7)-((b+1)%7));
  return set.length===7?'Every day':DAY_NAMES[ordered[0]!]+' to '+DAY_NAMES[ordered.at(-1)!];
}

/** The saved planner decision that still answers this model's calendars (else none). */
export function savedCalendarBasis(state:ProjectRuntimeState,model:CanonicalScheduleModel):CalendarBasisDecision{
  const decisions=(state.controls?.reviewDecisions??{}) as Record<string,{choice?:string;sourceFingerprint?:string;confirmedAt?:string}|undefined>;
  const fingerprint=calendarBasisFingerprint(model);
  const basis=decisions[CALENDAR_BASIS_KEY];
  const durationBasis=basis&&basis.sourceFingerprint===fingerprint&&(basis.choice==='working_days'||basis.choice==='calendar_days')?basis.choice:null;
  const patterns:CalendarBasisDecision['patterns']=[];
  let confirmedAt=durationBasis?basis!.confirmedAt??null:null;
  for(const c of shorthandCalendars(model)){
    const saved=decisions[CALENDAR_PATTERN_PREFIX+c.calendarId];
    const option=saved&&saved.sourceFingerprint===c.fingerprint?c.options.find(o=>o.value===saved.choice):undefined;
    if(option){patterns.push({calendarId:c.calendarId,days:option.days,hours:c.dayHours,label:option.label});confirmedAt=confirmedAt??saved!.confirmedAt??null;}
  }
  return {durationBasis,patterns,confirmedAt,fingerprint};
}

const effective=new WeakMap<StoredSchedule,{signature:string;value:StoredSchedule}>();
/** The control schedule with the planner's confirmed calendar basis applied. Called by
 * the shared control-schedule accessor only; the stored source is never changed. */
export function applyCalendarBasis(state:ProjectRuntimeState,stored:StoredSchedule):StoredSchedule{
  // Hot path (every control-schedule read): nothing to do unless a calendar decision was ever saved.
  const saved=state.controls?.reviewDecisions;
  if(!saved||!Object.keys(saved).some(key=>key===CALENDAR_BASIS_KEY||key.startsWith(CALENDAR_PATTERN_PREFIX)))return stored;
  const model=stored.revision.model;
  const decision=savedCalendarBasis(state,model);
  if(!decision.durationBasis&&!decision.patterns.length)return stored;
  const signature=JSON.stringify([decision.durationBasis,decision.patterns.map(p=>[p.calendarId,p.days,p.hours]),decision.fingerprint]);
  const hit=effective.get(stored);
  if(hit&&hit.signature===signature)return hit.value;
  const minutesText=(minutes:number)=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  const calendars=model.calendars.map(calendar=>{
    let c:CanonicalCalendar=calendar;
    const pattern=decision.patterns.find(p=>p.calendarId===calendar.calendarId);
    if(pattern){
      const minutes=Math.round(pattern.hours*60),interval={start:'00:00',finish:minutesText(minutes),minutes};
      c={...c,semanticComplete:true,exceptions:[],standardDayHours:pattern.hours,standardWeekHours:pattern.hours*pattern.days.length,
        weeklyWorkMinutes:[0,1,2,3,4,5,6].map(d=>pattern.days.includes(d)?minutes:0) as [number,number,number,number,number,number,number],
        weeklyWorkIntervals:[0,1,2,3,4,5,6].map(d=>({dayIndex:d+1,intervals:pattern.days.includes(d)?[interval]:[]}))}; // P6 day index: 1 = Sunday
    }
    if(decision.durationBasis==='calendar_days'&&c.semanticComplete){
      // Durations are calendar days: every day is worked with the programme's own shift.
      const shift=(c.weeklyWorkIntervals??[]).find(day=>day.intervals.length)?.intervals??[];
      if(shift.length){
        const minutes=shift.reduce((sum,i)=>sum+i.minutes,0);
        c={...c,exceptions:[],standardDayHours:minutes/60,standardWeekHours:minutes*7/60,
          weeklyWorkMinutes:[minutes,minutes,minutes,minutes,minutes,minutes,minutes],
          weeklyWorkIntervals:[1,2,3,4,5,6,7].map(dayIndex=>({dayIndex,intervals:shift.map(i=>({...i}))}))};
      }
    }
    return c;
  });
  const value:StoredSchedule={...stored,revision:{...stored.revision,model:{...model,calendars,
    calendarBasisDecision:{durationBasis:decision.durationBasis,patternCalendarIds:decision.patterns.map(p=>p.calendarId),confirmedAt:decision.confirmedAt,fingerprint:decision.fingerprint,
      statement:calendarBasisStatement(decision)}}}};
  effective.set(stored,{signature,value});
  return value;
}

export function calendarBasisStatement(decision:Pick<CalendarBasisDecision,'durationBasis'|'patterns'>):string{
  return [decision.durationBasis==='calendar_days'?'The planner confirmed that durations are calendar days; CMeng runs the remaining work every day on the programme\'s own shifts.':
    decision.durationBasis==='working_days'?'The planner confirmed that durations are working days on the programme calendars; CMeng\'s calculation uses them as stated.':'',
    ...decision.patterns.map(p=>'The planner confirmed calendar '+p.calendarId+': '+p.label.replace(/ \(the source states.*$/,'')+'.')].filter(Boolean).join(' ');
}
