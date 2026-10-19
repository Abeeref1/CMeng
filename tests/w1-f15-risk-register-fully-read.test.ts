import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryModule,deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {operationalReporting} from '../packages/runtime-api/src/reporting-state';

// F15: the risk register Impact, Score, Last Reviewed and Closed columns are read and used.
// Score ranks the risks; a "Closed: Yes" risk is not open; Last Reviewed is its own field and
// the review is stale only against a stated interval or next review date at the Data Date.
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t2031-08-31','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\t1\tA1\tEquipment installation 1\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16','%E'].join('\n');
const risks='Risk ID,Description,Status,Identified Date,Probability,Impact,Score,Last Reviewed,Review Interval,Closed\n'+
 'R1,Low score open,Open,2031-08-01,1,2,2,2031-08-20,30,No\n'+
 'R2,High score open,Open,2031-08-01,4,5,20,2031-07-01,14,\n'+
 'R3,Closed in the Closed column,,2031-08-01,3,3,9,2031-08-25,,Yes\n'+
 'R4,Mid score never reviewed,Open,2031-08-01,2,4,8,,,\n'+
 'R5,No score,Open,2031-08-01,,,,2031-08-10,7 days,\n'+
 'R6,Open status but Closed column yes,Open,2031-08-01,1,1,1,,,Yes\n';

test('F15 risk register: score ranking, Closed column, Last Reviewed and stale review against the stated interval',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'w1-f15-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('W1-F15');
 const upload=(name:string,content:string,mediaType='text/csv',uploadIntent?:'replace_current_basis')=>store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(content),mediaType,sourceFilename:name,uploadedAt:'2031-09-01',...(uploadIntent?{uploadIntent}:{})});
 await upload('Current.xer',programme,'text/plain','replace_current_basis');
 await upload('Risk.csv',risks);
 const source=new Map(operationalReporting(state).risk.sourceRows.map(r=>[r.riskId,r]));
 assert.equal(source.get('R3')!.status,'closed','Closed column Yes closes a risk with a blank status');
 assert.equal(source.get('R6')!.status,'unknown','Open status contradicted by Closed Yes is neither open nor closed');
 assert.equal(source.get('R1')!.status,'open','Closed column No keeps the stated open status');
 assert.equal(source.get('R1')!.lastReviewedIso,'2031-08-20');
 assert.equal(source.get('R5')!.reviewIntervalDays,7);
 const rows=deliveryPosition(state).riskSourceRows;
 assert.deepEqual(rows.map(r=>r.riskId),['R2','R3','R4','R1','R6','R5'],'ranked by score, highest first; unscored last');
 assert.deepEqual(rows.map(r=>r.scoreRank),[1,2,3,4,5,null]);
 const row=(id:string)=>rows.find(r=>r.riskId===id)!;
 assert.equal(row('R2').impact,5);
 assert.equal(row('R2').reviewDueIso,'2031-07-15');
 assert.equal(row('R2').reviewStale,true,'next review 2031-07-15 is before the Data Date 2031-08-31');
 assert.equal(row('R5').reviewStale,true);
 assert.equal(row('R1').reviewStale,false,'next review 2031-09-19 is after the Data Date');
 assert.equal(row('R3').reviewStale,null,'no stated interval: staleness is not established');
 assert.equal(row('R4').reviewStale,null);
 assert.equal(row('R4').reviewBasis,'Last reviewed date not stated');
 assert.equal(row('R1').lastReviewedIso,'2031-08-20');
 const data=deliveryModule(state,'delivery-risks').data as any;
 assert.equal(data.metrics.find((m:any)=>m.label==='Reported open / mitigating').value,4,'R1, R2, R4, R5 open; closed R3 and contradicted R6 excluded');
});
