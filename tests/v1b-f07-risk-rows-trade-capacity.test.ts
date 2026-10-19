import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createContext,runInContext} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {deliveryModule} from '../packages/runtime-api/src/delivery-projections';
import {riskRegisterForState} from '../packages/runtime-api/src/advanced-controls';
import {reportingState} from '../packages/runtime-api/src/reporting-state';
import {projectFactsForState} from '../packages/runtime-api/src/project-facts';
import {canonicalResourceModule} from '../packages/runtime-api/src/canonical-resource-runtime';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {deliveryScript} from '../packages/runtime-api/src/ui-delivery';

// F07 follow-up: risk register row counts and per-trade capacity are one shared
// status. Both registers go through the real upload path. Data Date 2031-08-31.
const calendar='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()((0||0(s|08:00|f|16:00)())))').join('')+'))(0||Exceptions()())))';
const programme=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tDELIVERY\t2031-08-31','%T\tCALENDAR','%F\tclndr_id\tclndr_name\tclndr_data','%R\t1\tWorking calendar\t'+calendar,'%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt','%R\t1\t1\t1\tA1\tEquipment installation 1\tTK_NotStart\t2031-09-30 08:00\t2031-10-10 16:00\t80\t80\t16','%E'].join('\n');

const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
function fn(name:string){
  const found=source.statements.filter(isFunctionDeclaration).find(n=>n.name?.text===name);
  assert.ok(found,name+' must exist in the assembled browser script');
  return found!.getText(source);
}
const escapeHtml=(s:unknown)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));

async function project(t:any,id:string){
  const dir=mkdtempSync(join(tmpdir(),'v1b-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate(id);
  const upload=(name:string,content:string,mediaType='text/csv',uploadIntent?:'replace_current_basis')=>store.ingestEvidenceFile({projectId:state.projectId,bytes:Buffer.from(content),mediaType,sourceFilename:name,uploadedAt:'2031-09-01',...(uploadIntent?{uploadIntent}:{})});
  await upload('Current.xer',programme,'text/plain','replace_current_basis');
  return {state,upload};
}

// 110 rows: 66 open and 20 closed by the Data Date (86 current), 14 identified
// after the Data Date, 10 with no identified date.
const id=(i:number)=>'R'+String(i).padStart(3,'0');
const riskCsv='Risk ID,Description,Status,Identified Date,Closed Date,Probability,Impact,Score\n'+[
  ...Array.from({length:66},(_,i)=>id(i+1)+',Open risk '+(i+1)+',Open,2031-06-01,,2,3,6'),
  ...Array.from({length:20},(_,i)=>id(i+67)+',Closed risk '+(i+67)+',Closed,2031-05-01,2031-07-15,1,2,2'),
  ...Array.from({length:14},(_,i)=>id(i+87)+',Later risk '+(i+87)+',Open,2031-09-15,,3,3,9'),
  ...Array.from({length:10},(_,i)=>id(i+101)+',Undated risk '+(i+101)+',Open,,,2,2,4'),
].join('\n')+'\n';

test('F07 risk rows: the risk register and Delivery risks state the same 110-row population and label their own subset',async t=>{
  const {state,upload}=await project(t,'V1B-RISK-ROWS');
  await upload('Risk Register.csv',riskCsv);
  const counts=(projectFactsForState(state).inputs as any).riskRows;
  assert.deepEqual({source:counts.sourceRowCount,current:counts.currentRowCount,open:counts.openCount,closed:counts.closedCount,
    unclear:counts.unclearStatusCount,after:counts.afterDataDateCount,undated:counts.undatedCount},
    {source:110,current:86,open:66,closed:20,unclear:0,after:14,undated:10},'hand count of the uploaded register');
  const register=riskRegisterForState(reportingState(state)).data as any;
  assert.equal(register.rows.length,86,'the risk register lists every current row');
  assert.deepEqual(register.rowCounts,counts,'risk register counts = project facts');
  assert.match(register.rowScopeLabel,/^Showing 86 current at the reporting date of 110 risk register rows \(66 open, 20 closed\)\. Not listed here: 14 dated after the Data Date and 10 without a date; Delivery risks lists all 110\.$/);
  const delivery=deliveryModule(state,'delivery-risks').data as any;
  const registerRows=delivery.rows.filter((r:any)=>!r.candidateGroup);
  assert.equal(registerRows.length,110,'Delivery risks lists every register row');
  assert.deepEqual(delivery.riskRowCounts,counts,'Delivery risk counts = project facts');
  assert.equal(delivery.rowScopeLabel,'110 risk register rows: 86 current at the reporting date (66 open, 20 closed), 14 dated after the Data Date, 10 without a date.');
  // The real page script, given a 25-row preview page of the register, still shows the true counts.
  const ctx=createContext({escapeHtml,humanizeKey:String,planningShortDate:String,fmt:String,apiOwnerText:(r:any)=>r.owner,pmcDisplayOwner:()=>'Owner not set',
    planningKpis:(items:any[])=>items.map(item=>'<kpi>'+item[0]+'='+item[1]+'</kpi>').join('')});
  runInContext(fn('projectionFor')+'\n'+fn('renderRiskRegisterVisual'),ctx);
  const html=runInContext('renderRiskRegisterVisual',ctx)({...register,rows:register.rows.slice(0,25)}) as string;
  assert.match(html,/<kpi>Risk register rows=110<\/kpi>/);
  assert.match(html,/<kpi>Current risks=86<\/kpi>/);
  assert.match(html,/<kpi>Open=66<\/kpi>/,'open count is the register count, not the 25 previewed rows');
  assert.match(html,/<kpi>Closed=20<\/kpi>/);
  assert.ok(html.includes(escapeHtml(register.rowScopeLabel)),'the risk register page shows its subset label');
  assert.match(deliveryScript,/p\.rowScopeLabel/,'the Delivery page shows its row label');
});

// 14 trades: T01-T12 state a weekly capacity, T13 has weekly rows with no
// capacity, T14 is in the resource master with no weekly rows.
const trades=['Masonry','Concrete','Steel fixing','Formwork','Plastering','Tiling','Painting','Carpentry','Electrical','Plumbing','HVAC','Glazing','Scaffolding','Waterproofing'];
const tid=(i:number)=>'T'+String(i+1).padStart(2,'0');
const masterCsv='Resource ID,Resource Name,Class,Unit,Utilization Applicable\n'+trades.map((name,i)=>tid(i)+','+name+',Labour,Hours,Yes').join('\n')+'\n';
const weeks=['2031-08-04','2031-08-11','2031-08-18','2031-08-25'];
const weeklyCsv='Resource ID,Resource Name,Class,Unit,Week Start,Available Capacity,Planned Demand\n'+
  trades.slice(0,13).flatMap((name,i)=>weeks.map(week=>tid(i)+','+name+',Labour,Hours,'+week+','+(i<12?String(40+i*8):'')+','+String(30+i))).join('\n')+'\n';

test('F07 capacity: every trade in the resource register is on the Resources page and in the facts; no stated capacity reads Not stated',async t=>{
  const {state,upload}=await project(t,'V1B-TRADES');
  await upload('Resource Master.csv',masterCsv);
  await upload('Weekly Resource Register.csv',weeklyCsv);
  const capacity=(projectFactsForState(state).inputs as any).capacity;
  assert.equal(capacity.tradeCount,14,'all 14 trades counted');
  assert.equal(capacity.statedCapacityTradeCount,12);
  assert.equal(capacity.notStatedCapacityTradeCount,2);
  const page=canonicalResourceModule(state,'resource-utilization')?.data as any;
  assert.ok(page,'the Resources page reads the weekly register');
  assert.deepEqual(page.capacityStatus,capacity,'Resources page capacity = project facts');
  const rows=page.tradeCapacity as any[];
  assert.deepEqual(rows.map(r=>r.resourceId),trades.map((_,i)=>tid(i)),'no trade dropped');
  for(let i=0;i<12;i++){
    const r=rows[i];
    assert.notEqual(r.capacityState,'not_stated',tid(i)+' states a capacity');
    assert.equal(r.minStatedCapacity,40+i*8);assert.equal(r.maxStatedCapacity,40+i*8);
    assert.equal(r.capacityText,String(40+i*8)+' Hours per week · 4 of 4 weeks stated · stated, not approved');
  }
  assert.equal(rows[12].capacityText,'Not stated');assert.equal(rows[12].periodCount,4);
  assert.equal(rows[13].capacityText,'Not stated');assert.equal(rows[13].periodCount,0);
  const ctx=createContext({escapeHtml});
  runInContext(fn('tradeCapacityPanel'),ctx);
  const html=runInContext('tradeCapacityPanel',ctx)(rows) as string;
  assert.match(html,/Weekly capacity by trade · 12 of 14 trades state a capacity/);
  for(const [i,name] of trades.entries())assert.ok(html.includes('<b>'+tid(i)+'</b><br>'+name),name+' is shown');
  assert.equal(html.split('<td>Not stated</td>').length-1,2,'the two trades without capacity read Not stated');
  assert.match(fn('renderResourceVisual'),/tradeCapacityPanel\(p\.tradeCapacity\)/,'the Resources page renders the trade capacity panel');
});
