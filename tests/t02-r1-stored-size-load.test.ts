import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';

// T02 / R1 cost check: the R1 reading fields (column list, WBS paths,
// resources, cost accounts, assignment references) must not grow the stored
// project file or its load time by more than 10% on an 8,900-activity XER.
// "Before" is the same stored file with only those R1 fields removed, so the
// comparison isolates exactly what R1 adds.
const R1_KEYS=new Set(['sourceColumnAudit','sourceWbsPaths','sourceResources','sourceCostAccounts','sourceResourceAssignments']);
const strip=(value:unknown):unknown=>Array.isArray(value)?value.map(strip)
 :value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!R1_KEYS.has(key)).map(([key,item])=>[key,strip(item)])):value;
const count=(value:unknown,key:string):number=>Array.isArray(value)?value.reduce((n:number,item)=>n+count(item,key),0)
 :value&&typeof value==='object'?Object.entries(value).reduce((n,[k,item])=>n+(k===key?1:0)+count(item,key),0):0;

function largeXer(activityCount:number){
 const calendar='(0||CalendarData()((0||DaysOfWeek()('+[1,2,3,4,5,6,7].map(d=>'(0||'+d+'()((0||0(s|08:00|f|16:00)())))').join('')+'))))';
 const lines=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tSIZE8900\t2026-01-05 08:00',
  '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tweek_hr_cnt\tclndr_data','%R\t1\tSeven day\t8\t56\t'+calendar,
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name','%R\t1\t1\t\tSIZE8900\tProject'];
 for(let b=1;b<=10;b++){lines.push(`%R\t${100+b}\t1\t1\tB${b}\tBuilding ${b}`);for(let l=1;l<=10;l++)lines.push(`%R\t${1000+b*100+l}\t1\t${100+b}\tL${l}\tLevel ${l}`);}
 lines.push('%T\tACCOUNT','%F\tacct_id\tacct_short_name\tacct_name');for(let a=1;a<=30;a++)lines.push(`%R\t${a}\tCA-${300+a}\tCost account ${a}`);
 lines.push('%T\tRSRC','%F\trsrc_id\trsrc_name\trsrc_short_name\trsrc_type');for(let r=1;r<=50;r++)lines.push(`%R\t${r}\tCrew ${r}\tCR${r}\tRT_Labor`);
 lines.push('%T\tTASK','%F\ttask_id\tproj_id\twbs_id\ttask_code\ttask_name\ttask_type\tstatus_code\tclndr_id\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt\tearly_start_date\tearly_end_date\ttarget_start_date\ttarget_end_date');
 for(let i=1;i<=activityCount;i++){const b=1+(i%10),l=1+(Math.floor(i/10)%10);lines.push(`%R\t${i}\t1\t${1000+b*100+l}\tA${String(i).padStart(5,'0')}\tActivity ${i}\tTT_Task\tTK_NotStart\t1\t16\t16\t0\t2026-01-05 08:00\t2026-01-06 16:00\t2026-01-05 08:00\t2026-01-06 16:00`);}
 lines.push('%T\tTASKPRED','%F\ttask_pred_id\ttask_id\tpred_task_id\tproj_id\tpred_proj_id\tpred_type\tlag_hr_cnt');
 for(let i=2;i<=activityCount;i++)if(i%10!==1)lines.push(`%R\t${i}\t${i}\t${i-1}\t1\t1\tPR_FS\t0`);
 lines.push('%T\tTASKRSRC','%F\ttaskrsrc_id\ttask_id\tproj_id\trsrc_id\tacct_id\ttarget_qty\tremain_qty');
 for(let i=1;i<=activityCount;i++)lines.push(`%R\t${i}\t${i}\t1\t${1+(i%50)}\t${1+(i%30)}\t16\t16`);
 lines.push('%E');
 return Buffer.from(lines.join('\n'),'utf8');
}

test('T02 R1 the stored file and its load time grow by at most 10% on an 8,900-activity XER',{timeout:900000},async t=>{
 const dataDir=await mkdtemp(join(tmpdir(),'cmeng-r1-size-'));
 const store=new RuntimeProjectStore({dataDir,durable:false});
 await store.ingestSchedule({projectId:'R1-SIZE-8900',sourceFilename:'size-8900.xer',bytes:largeXer(8900),mediaType:'text/plain',uploadedAt:'2026-01-05',role:'update',uploadIntent:'replace_current_basis'} as any);
 const stateFile=join(dataDir,'cmeng-project-state.json');
 const stored=JSON.parse(await readFile(stateFile,'utf8'));
 // The R1 fields are really present, so the comparison is not empty.
 assert.ok(count(stored,'sourceColumnAudit')>=1,'column list stored');
 assert.ok(count(stored,'sourceResourceAssignments')>=8900,'assignment references stored per activity');
 assert.equal(count(stored,'sourceWbsPath'),0,'no per-activity WBS path copies');
 const after=JSON.stringify(stored),before=JSON.stringify(strip(stored));
 const sizeRatio=Buffer.byteLength(after)/Buffer.byteLength(before);
 // Load time: the same data directory, alternating the two snapshots.
 const loadMs=async(text:string)=>{await writeFile(stateFile,text);const start=performance.now();const loaded=new RuntimeProjectStore({dataDir,durable:false});const ms=performance.now()-start;assert.ok((loaded as any).projects.get('R1-SIZE-8900'),'project loads');return ms;};
 // Two warm-up loads each, then 15 alternating pairs: the minimum of many samples is a
 // stable estimate of the load cost on a shared runner (5 pairs measured 0.94 to 1.20 for
 // the same build). The 10% limit is unchanged.
 for(let warm=0;warm<2;warm++){await loadMs(before);await loadMs(after);}
 const times={before:[] as number[],after:[] as number[]};
 for(let run=0;run<15;run++){times.before.push(await loadMs(before));times.after.push(await loadMs(after));}
 const loadRatio=Math.min(...times.after)/Math.min(...times.before);
 t.diagnostic(`R1-SIZE before=${Buffer.byteLength(before)} after=${Buffer.byteLength(after)} ratio=${sizeRatio.toFixed(4)}`);
 t.diagnostic(`R1-LOAD beforeMinMs=${Math.min(...times.before).toFixed(1)} afterMinMs=${Math.min(...times.after).toFixed(1)} ratio=${loadRatio.toFixed(4)}`);
 assert.ok(sizeRatio<=1.10,`stored size grows ${((sizeRatio-1)*100).toFixed(2)}% (limit 10%)`);
 assert.ok(loadRatio<=1.10,`load time grows ${((loadRatio-1)*100).toFixed(2)}% (limit 10%)`);
});
