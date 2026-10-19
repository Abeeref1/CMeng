import test from 'node:test';
import assert from 'node:assert/strict';
import {parseXerBytes} from '../packages/xer-parser/src';
import {canonicalScheduleFromXer} from '../packages/schedule-analysis-core/src';
import {scheduleScopeClassification,scopeClassificationGroups} from '../packages/runtime-api/src/schedule-scope-classification';

// SW-27: discipline and location groups come first from the programme's own
// structure (XER activity codes, then WBS levels), labelled with their source.
// Name keywords are only a labelled fallback, counted apart; the rest is
// counted as Not grouped.
function xer(withCodes:boolean){
 const tasks=[
  ['1','A100','Install cable trays','W-N'],
  ['2','A200','Pour slab','W-S'],
  ['3','A300','Electrical testing','W-S'],
  ['4','A400','Snagging','W-S'],
 ];
 const lines=['ERMHDR\t23.12',
  '%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tSW27\t2031-01-05 08:00',
  '%T\tPROJWBS','%F\twbs_id\tproj_id\tparent_wbs_id\twbs_short_name\twbs_name',
  '%R\tW-ROOT\t1\t\tROOT\tTower Project','%R\tW-N\t1\tW-ROOT\tN\tNorth Wing','%R\tW-S\t1\tW-ROOT\tS\tSouth Wing',
  '%T\tTASK','%F\ttask_id\tproj_id\twbs_id\tclndr_id\ttask_code\ttask_name\ttask_type\tstatus_code\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt',
  ...tasks.map(([id,code,name,wbs])=>['%R',id,'1',wbs,'',code,name,'TT_Task','TK_NotStart','8','8'].join('\t')),
 ];
 if(withCodes)lines.push(
  '%T\tACTVTYPE','%F\tactv_code_type_id\tactv_code_type','%R\tT1\tArea','%R\tT2\tDiscipline',
  '%T\tACTVCODE','%F\tactv_code_id\tactv_code_type_id\tshort_name\tactv_code_name',
  '%R\tC1\tT1\tA-01\tPlant room','%R\tC2\tT1\tA-02\tLobby','%R\tC3\tT2\tCIV\tCivil',
  '%T\tTASKACTV','%F\ttask_id\tactv_code_type_id\tactv_code_id\tproj_id',
  '%R\t1\tT1\tC1\t1','%R\t2\tT1\tC2\t1','%R\t2\tT2\tC3\t1');
 lines.push('%E');
 return canonicalScheduleFromXer(parseXerBytes(new TextEncoder().encode(lines.join('\n'))),{sourceRevisionId:'R1',projectId:'SW27'});
}

test('SW-27 an XER Area/Discipline activity code groups by that code with the source label',()=>{
 const model=xer(true);
 assert.deepEqual(model.activities.find(a=>a.activityId==='A100')?.activityCodes,[{typeName:'Area',value:'A-01',description:'Plant room'}]);
 const groups=scopeClassificationGroups(scheduleScopeClassification(model)) as any;
 const location=groups.location.sourceGrouping,discipline=groups.discipline.sourceGrouping;
 assert.deepEqual(location.rows.filter((r:any)=>r.basis==='activity_code').map((r:any)=>[r.value,r.source,r.activityCount]).sort(),
  [['A-01','From activity code: Area',1],['A-02','From activity code: Area',1]]);
 // Activities without an Area code fall back to the programme's own WBS level, labelled.
 assert.deepEqual(location.rows.filter((r:any)=>r.basis==='wbs_level').map((r:any)=>[r.value,r.source,r.activityCount]),[['South Wing','From WBS level 2',2]]);
 assert.equal(location.sourceGroupedActivityCount,4);
 assert.equal(location.nameMatchActivityCount,0);
 assert.deepEqual(discipline.rows.find((r:any)=>r.basis==='activity_code'),{value:'CIV',source:'From activity code: Discipline',basis:'activity_code',activityCount:1});
 // Keyword discipline stays only as a labelled, separately counted fallback.
 const named=discipline.rows.filter((r:any)=>r.basis==='name_match');
 assert.ok(named.length>0&&named.every((r:any)=>r.source==='Grouped by name match'));
 assert.equal(discipline.nameMatchActivityCount,named.reduce((n:number,r:any)=>n+r.activityCount,0));
 assert.equal(discipline.sourceGroupedActivityCount+discipline.nameMatchActivityCount+discipline.notGrouped.activityCount,4,'every activity counted once');
 assert.ok(discipline.notGrouped.activityCount>=1,'Snagging matches nothing and is counted as Not grouped');
});

test('SW-27 without activity codes, location groups come from the WBS level',()=>{
 const model=xer(false);
 assert.ok(model.activities.every(a=>a.activityCodes===undefined),'no codes are invented');
 const location=(scopeClassificationGroups(scheduleScopeClassification(model)) as any).location.sourceGrouping;
 assert.deepEqual(location.rows.map((r:any)=>[r.value,r.source,r.activityCount]),[['South Wing','From WBS level 2',3],['North Wing','From WBS level 2',1]]);
 assert.equal(location.sourceGroupedActivityCount,4);
 assert.equal(location.notGrouped.activityCount,0);
});
