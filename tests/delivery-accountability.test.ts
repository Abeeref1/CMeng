import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {changeDelivery,deliveryRecords,deliveryStore} from '../packages/runtime-api/src/delivery-records';
import {deliveryDashboard,deliveryModule,deliveryPosition} from '../packages/runtime-api/src/delivery-projections';

let sequence=0;
function programme(projectId:string){
 return Buffer.from(['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\t'+projectId+'\t2031-08-31',
 '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
 '%R\t1\t1\tA1\tInterface workfront\tTK_NotStart\t2031-09-01\t2031-09-10\t80\t80\t8','%E'].join('\n'));
}
test('interface management and cross-domain accountability use the same governed Delivery records',async()=>{
 const id='DELIVERY-ACCOUNTABILITY-'+(++sequence);
 await runtimeProjects.ingestSchedule({projectId:id,sourceFilename:'Current.xer',bytes:programme(id),mediaType:'text/plain',uploadedAt:'2031-09-01',role:'update',uploadIntent:'replace_current_basis'});
 const state=runtimeProjects.get(id)!;
 const change=(input:any)=>{changeDelivery(state,{expectedVersion:state.version,...input});runtimeProjects.touch(state);};
 const create=(kind:string,reference:string,fields:any,links:any={})=>{
   change({action:'create',kind,fields:{'record reference':reference,description:reference,...fields}});
   const record=deliveryRecords(state).records.find(r=>r.recordId===deliveryStore(state).manual.at(-1)!.recordId)!;
   change({action:'review',recordId:record.recordId,sourceRevision:record.revision,state:'governed',fields:{},links,note:'Reviewed source position'});
   return deliveryRecords(state).records.find(r=>r.recordId===record.recordId)!;
 };
 create('interface','INT-001',{'giving party':'Civil JV','receiving party':'MEP JV','owner':'ABC Contractor','status':'open','raised date':'2031-08-01','due date':'2031-08-15','required deliverable':'Approved builder-work drawing','consequence':'MEP riser cannot start'},{activityIds:['A1']});
 create('quality','NCR-001',{'owner':'ABC Contractor','status':'open','raised date':'2031-08-02','due date':'2031-08-20','severity':'major'},{activityIds:['A1']});
 create('permit','PER-001',{'owner':'XYZ Contractor','status':'open','raised date':'2031-08-03','due date':'2031-08-10'},{activityIds:['A1']});

 const interfacePage=deliveryModule(state,'delivery-interfaces');
 assert.notEqual(interfacePage.status,'blocked');
 const data:any=interfacePage.data;
 assert.equal(data.rows.length,1);
 assert.equal(data.rows[0].reference,'INT-001');
 assert.equal(data.rows[0].fields['giving party'],'Civil JV');
 assert.equal(data.rows[0].fields['receiving party'],'MEP JV');
 assert.equal(data.rows[0].owner,'ABC Contractor');
 assert.equal(data.rows[0].overdue,true);

 const position:any=deliveryPosition(state);
 const abc=position.accountabilityRows.find((r:any)=>r.owner==='ABC Contractor');
 assert.ok(abc);
 assert.equal(abc.openItemCount,2);
 assert.equal(abc.overdueItemCount,2);
 assert.equal(abc.affectedActivityCount,1);
 assert.equal(abc.interfaceCount,1);
 assert.equal(abc.qualityCount,1);
 const xyz=position.accountabilityRows.find((r:any)=>r.owner==='XYZ Contractor');
 assert.equal(xyz.openItemCount,1);
 assert.equal(xyz.permitCount,1);

 const dashboard:any=deliveryDashboard(state);
 assert.equal(dashboard.interfaceOpenKnownCount,1);
 assert.equal(dashboard.interfaceOverdueKnownCount,1);
 assert.equal(dashboard.accountabilityRows[0].owner,'ABC Contractor');
});
