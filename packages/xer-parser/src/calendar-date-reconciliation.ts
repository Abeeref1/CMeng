import {parseXerDateStrict} from './dates';
import type {XerRow} from './types';
import type {XerCalendarAssessment} from './calendar-integrity';
import type {P6CalendarDataResult,P6CalendarDay,P6CalendarInterval} from './calendar-data';

/** Recover a missing uniform P6 working pattern only when the source's dated
 * activity calculations uniquely establish it. Conversion hour counts alone
 * NEVER establish which weekdays or shifts are working. A recovered pattern is
 * explicitly qualified, and not equivalent to source-exported calendar data.
 * Malformed work intervals, inheritance and unsupported shifts fail closed. */
export function reconcileCalendarWithP6Dates(
  calendar:XerCalendarAssessment,
  rows:readonly XerRow[],
):P6CalendarDataResult|null {
  if(calendar.baseCalendarId||calendar.data?.status==='invalid'||(calendar.data?.days.length??0)>0)return null;
  const dayHours=calendar.conversionDayHours,weekHours=calendar.conversionWeekHours;
  if(!dayHours||!weekHours||dayHours<=0||dayHours>24||weekHours<=0||weekHours>168)return null;
  const workdayCount=weekHours/dayHours;
  if(!Number.isInteger(workdayCount)||workdayCount<1||workdayCount>7)return null;
  const dated:Array<{start:number;finish:number;hours:number}>=[];
  const get=(row:XerRow,key:string)=>row.data?.[key]?.trim()||'';
  for(const row of rows){
    if(get(row,'clndr_id')!==calendar.calendarId||/complete/i.test(get(row,'status_code')))continue;
    const startRaw=get(row,'early_start_date')||get(row,'restart_date');
    const finishRaw=get(row,'early_end_date')||get(row,'reend_date');
    const startIso=parseXerDateStrict(startRaw).iso;
    const finishIso=parseXerDateStrict(finishRaw).iso;
    const hours=Number(get(row,'remain_drtn_hr_cnt'));
    if(!startIso?.includes('T')||!finishIso?.includes('T')||!Number.isFinite(hours)||hours<=0)continue;
    const start=Date.parse(startIso+'Z'),finish=Date.parse(finishIso+'Z');
    if(!Number.isFinite(start)||!Number.isFinite(finish)||finish<=start||finish-start>730*86400000)continue;
    dated.push({start,finish,hours});
  }
  // Unrelated tasks must witness both the weekly cycle and multiple dates.
  if(dated.length<4)return null;
  dated.sort((a,b)=>a.start-b.start||a.finish-b.finish);
  const sample=[...dated.slice(0,16),...dated.slice(-16)].filter((v,i,arr)=>arr.findIndex(x=>x.start===v.start&&x.finish===v.finish&&x.hours===v.hours)===i);
  if(sample.length<4||new Set(sample.map(row=>new Date(row.start).getUTCDay())).size<2||
    Math.max(...sample.map(row=>row.finish))-Math.min(...sample.map(row=>row.start))<14*86400000)return null;
  const dayMs=86400000, minuteMs=60000, dayMinutes=Math.round(dayHours*60);
  if(Math.abs(dayMinutes-dayHours*60)>0.001)return null;
  const minuteOfDay=(stamp:number)=>Math.floor((stamp%dayMs)/minuteMs);
  const starts=new Set<number>();
  for(const row of sample){
    starts.add(minuteOfDay(row.start));
    starts.add((minuteOfDay(row.finish)-dayMinutes+1440)%1440);
  }
  if(starts.size>16)return null; // No unique uniform shift is supported.
  const exceptions=new Map((calendar.data?.exceptions??[]).map(row=>[row.isoDate,row]));
  const workMinutes=(row:typeof sample[number],weekMask:number,shiftStart:number):number=>{
    let total=0;
    const begin=Math.floor(row.start/dayMs)-1,end=Math.floor(row.finish/dayMs);
    for(let day=begin;day<=end;day++){
      const iso=new Date(day*dayMs).toISOString().slice(0,10);
      const exception=exceptions.get(iso);
      const dow=new Date(day*dayMs).getUTCDay();
      let intervals:Array<{start:number;finish:number}>=[];
      if(exception){
        intervals=exception.intervals.map(period=>{
          const parts=(time:string)=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
          const s=parts(period.start),f=parts(period.finish);
          return {start:s,finish:f<=s?f+1440:f};
        });
      }else if((weekMask&(1<<dow))!==0)intervals=[{start:shiftStart,finish:shiftStart+dayMinutes}];
      for(const period of intervals){
        const a=Math.max(row.start,day*dayMs+period.start*minuteMs);
        const b=Math.min(row.finish,day*dayMs+period.finish*minuteMs);
        if(b>a)total+=(b-a)/minuteMs;
      }
    }
    return total;
  };
  let winner:{mask:number;start:number;error:number;max:number}|null=null;
  let passing=0;
  for(let mask=1;mask<128;mask++){
    if(mask.toString(2).replaceAll('0','').length!==workdayCount)continue;
    for(const start of starts){
      const errors=sample.map(row=>Math.abs(workMinutes(row,mask,start)-row.hours*60));
      const maximum=Math.max(...errors),total=errors.reduce((a,b)=>a+b,0);
      // One hour covers P6's exported working-time boundary convention.
      // A pattern with a larger error is not corroborated by source dates.
      if(maximum>60||total>sample.length*30)continue;
      passing++;
      if(!winner||total<winner.error)winner={mask,start,error:total,max:maximum};
    }
  }
  if(passing!==1||!winner)return null;
  const interval:P6CalendarInterval={
    start:String(Math.floor(winner.start/60)).padStart(2,'0')+':'+String(winner.start%60).padStart(2,'0'),
    finish:String(Math.floor((winner.start+dayMinutes)%1440/60)).padStart(2,'0')+':'+String((winner.start+dayMinutes)%60).padStart(2,'0'),
    minutes:dayMinutes
  };
  if(winner.start+dayMinutes===1440)interval.finish='24:00';
  const days:P6CalendarDay[]=[1,2,3,4,5,6,7].map(dayIndex=>{
    const working=(winner!.mask&(1<<(dayIndex-1)))!==0;
    return {dayIndex,intervals:working?[{...interval}]:[],workMinutes:working?dayMinutes:0};
  });
  return {status:'valid',root:null,days,exceptions:calendar.data?.exceptions??[],unknownTopLevelNodes:[],
    diagnostics:['CALENDAR_P6_DATE_RECONCILIATION_QUALIFIED:'+sample.length]};
}
