import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createProjectGateway} from '../packages/runtime-api/src/project-gateway';

test('Look-Ahead supports 2/4/6/8/12 week windows and report uses the selected horizon',async t=>{
 const root=mkdtempSync(join(tmpdir(),'cmeng-lookahead-window-')),g=await createProjectGateway(root,{maxWorkers:1});
 t.after(async()=>{await g.close();rmSync(root,{recursive:true,force:true});});
 await new Promise<void>(r=>g.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+(g.server.address() as any).port;
 let response=await fetch(base+'/api/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({projectId:'LOOKAHEAD-WINDOW'})});assert.equal(response.status,201);
 const xer=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tLOOKAHEAD-WINDOW\t2031-01-01',
 '%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
 '%R\t1\t1\tA14\tTwo week work\tTK_NotStart\t2031-01-05\t2031-01-10\t40\t40\t8',
 '%R\t2\t1\tA35\tSix week work\tTK_NotStart\t2031-02-01\t2031-02-05\t40\t40\t8',
 '%R\t3\t1\tA70\tTwelve week work\tTK_NotStart\t2031-03-05\t2031-03-10\t40\t40\t8','%E'].join('\n');
 response=await fetch(base+'/api/projects/LOOKAHEAD-WINDOW/evidence/uploads',{method:'POST',headers:{'content-type':'text/plain','x-source-filename':'Current.xer','x-upload-intent':'replace_current_basis'},body:xer});assert.equal(response.status,201,await response.text());
 const get=async(days:number)=>{const r=await fetch(base+'/api/projects/LOOKAHEAD-WINDOW/schedule/modules/lookahead-schedule?windowDays='+days);assert.equal(r.status,200,await r.text());return r.json() as Promise<any>;};
 const two=await get(14),six=await get(42),twelve=await get(84);
 assert.equal(two.data.windowDays,14);assert.equal(six.data.windowDays,42);assert.equal(twelve.data.windowDays,84);
 assert.ok(two.data.rows.length<six.data.rows.length);assert.ok(six.data.rows.length<twelve.data.rows.length);
 assert.deepEqual(twelve.data.rows.map((r:any)=>r.activityId).sort(),['A14','A35','A70']);
 const invalid=await fetch(base+'/api/projects/LOOKAHEAD-WINDOW/schedule/modules/lookahead-schedule?windowDays=21');assert.equal(invalid.status,400);
 const report=await fetch(base+'/api/projects/LOOKAHEAD-WINDOW/schedule/modules/lookahead-schedule/report.xlsx?windowDays=84');assert.equal(report.status,200);assert.match(report.headers.get('content-type')!,/spreadsheetml/);assert.ok((await report.arrayBuffer()).byteLength>1000);
});
