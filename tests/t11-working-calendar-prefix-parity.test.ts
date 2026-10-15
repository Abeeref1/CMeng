import test from 'node:test';
import assert from 'node:assert/strict';
import {workingHoursBetween,ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalCalendar} from '../packages/schedule-analysis-core/src';

const DAY=86400000,HOUR=3600000;
const day=(value:number)=>Math.floor(value/DAY)*DAY;
const index=(ms:number)=>new Date(ms).getUTCDay()+1;
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const minute=(x:string)=>{const [h,m]=x.split(':').map(Number);return h!*60+m!};
function rawIntervals(c:CanonicalCalendar,ms:number){
 const exception=c.exceptions?.find(e=>e.isoDate===iso(ms));
 return exception?(exception.nonWorking?[]:exception.workIntervals):
   c.weeklyWorkIntervals?.find(x=>x.dayIndex===index(ms))?.intervals??[];
}
// This deliberately independent oracle reproduces the original uncached
// day-by-day segment arithmetic, not the new yearly-prefix producer.
function originalDaily(c:CanonicalCalendar,from:number,to:number):number{
 if(from===to)return 0;
 if(to<from)return -originalDaily(c,to,from);
 let total=0;
 const first=day(from),last=day(to);
 for(let d=first;d<=last;d+=DAY){
   const segments:Array<[number,number]>=[];
   for(const p of rawIntervals(c,d-DAY)){
     const a=minute(p.start),b=minute(p.finish);
     if(b<a)segments.push([d,d+b*60000]);
   }
   for(const p of rawIntervals(c,d)){
     const a=minute(p.start),b=minute(p.finish);
     if(b>a)segments.push([d+a*60000,d+b*60000]);
     if(b<a)segments.push([d+a*60000,d+DAY]);
   }
   for(const [begin,end] of segments){
     const lo=Math.max(from,begin),hi=Math.min(to,end);
     if(hi>lo)total+=hi-lo;
   }
 }
 return total/HOUR;
}
const cal=(id:string,intervals:Array<{dayIndex:number;start:string;finish:string}>,exceptions:CanonicalCalendar['exceptions']=[]):CanonicalCalendar=>({
 calendarId:id,name:'Original '+id,semanticComplete:true,standardDayHours:8,standardWeekHours:40,
 weeklyWorkMinutes:[480,480,480,480,480,0,0],
 weeklyWorkIntervals:intervals.map(r=>({dayIndex:r.dayIndex,intervals:[{start:r.start,finish:r.finish,minutes:480}]})),
 exceptions,sourceRefs:[],
});

test('T11 exact yearly source working-time prefix equals independent original day-by-day calendar arithmetic',()=>{
 const weekday=cal('C', [1,2,3,4,5].map(dayIndex=>({dayIndex,start:'08:00',finish:'16:00'})),[
  {isoDate:'2032-02-29',nonWorking:true,workIntervals:[]},
  {isoDate:'2032-03-01',nonWorking:false,workIntervals:[{start:'04:00',finish:'17:00',minutes:780}]},
 ]);
 const overnight=cal('C',[1,2,3,4,5,6].map(dayIndex=>({dayIndex,start:'20:00',finish:'04:00'})),[
  {isoDate:'2031-12-30',nonWorking:true,workIntervals:[]},
  {isoDate:'2032-01-01',nonWorking:false,workIntervals:[{start:'22:00',finish:'02:00',minutes:240}]},
 ]);
 const other=cal('C',[1,2,3,4,5].map(dayIndex=>({dayIndex,start:'10:00',finish:'22:00'})));
 const population=[weekday,overnight,other,ELAPSED_24H_CALENDAR];
 const sourceSnapshot=JSON.stringify(population);
 for(const calendar of population)for(let i=0;i<181;i++){
   const from=Date.UTC(2030+i%4,Math.floor(i%12),1+i%27, i%23,i%5*10);
   const span=(i%17===0?0:i%3===0?1:i%3===1?31:469)*DAY+(i%19)*HOUR;
   const to=from+span;
   const expected=originalDaily(calendar,from,to);
   const found=workingHoursBetween(calendar,from,to);
   assert.equal(found,expected,calendar.name+' iteration '+i+' exact original working hour semantics');
   assert.equal(workingHoursBetween(calendar,to,from),-expected,'negative direction exact');
   assert.equal(workingHoursBetween(calendar,from,from),0,'same instant exact');
 }
 assert.equal(JSON.stringify(population),sourceSnapshot,'every source calendar retained byte-for-byte');
});
test('T11 separated projects with identical calendar IDs have independent time bases',()=>{
 const start=Date.UTC(2031,0,1),end=Date.UTC(2033,3,10);
 const a=cal('COMMON',[1,2,3,4,5].map(dayIndex=>({dayIndex,start:'08:00',finish:'16:00'})));
 const b=cal('COMMON',[1,2,3,4,5].map(dayIndex=>({dayIndex,start:'10:00',finish:'22:00'})));
 const wantA=originalDaily(a,start,end),wantB=originalDaily(b,start,end);
 assert.notEqual(wantA,wantB);
 assert.equal(workingHoursBetween(a,start,end),wantA);
 assert.equal(workingHoursBetween(b,start,end),wantB);
 assert.equal(workingHoursBetween(a,start,end),wantA,'repeat unaffected by other project');
});
