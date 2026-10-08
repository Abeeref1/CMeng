import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// This check guards the permanent consultant defect scope. It is NOT the
// independent live-browser page acceptance required by F01.
const sourceRoot=process.cwd();
const fixture=JSON.parse(readFileSync(join(sourceRoot,'tests/fixtures/reem-112-review.json'),'utf8')) as {
  pages:Array<{key:string;verdict:string;defects:Array<{sev:string;root:string;text:string}>}>;
  totals:Record<string,number>;
};
const plan=JSON.parse(readFileSync(join(sourceRoot,'docs/acceptance/cmeng-f01-f61-274-defect-plan.json'),'utf8')) as {
  schema:string;baselineFixture:string;items:Array<{id:string;root:string;step:number;d:string[];fix:string;test:string;where:string;live:string}>;
  newDefects:Array<{id:string;sev:string;root:string;text:string}>;
  allDefectsMapped:number;fixItemCount:number;
};

test('all 266 original CMeng review findings retain identity, root and severity',()=>{
  assert.equal(fixture.pages.length,62);
  const sourceRows=fixture.pages.flatMap(p=>p.defects);
  assert.equal(sourceRows.length,266);
  assert.deepEqual(Object.fromEntries(['Critical','High','Medium','Low'].map(sev=>[sev,sourceRows.filter(d=>d.sev===sev).length])),
    {Critical:28,High:103,Medium:90,Low:45});
  assert.equal(sourceRows.filter(d=>d.root==='R5').length,71);
  assert.equal(sourceRows.filter(d=>d.root==='R1').length,49);
  assert.equal(sourceRows.filter(d=>d.root==='R4').length,43);
  assert.equal(sourceRows.filter(d=>d.root==='R2').length,27);
  assert.equal(sourceRows.filter(d=>d.root==='R3').length,9);
  assert.equal(sourceRows.filter(d=>d.root==='R6').length,2);
  assert.equal(sourceRows.filter(d=>d.root==='R7').length,53);
  assert.equal(sourceRows.filter(d=>d.root==='R8').length,12);
  assert.ok(sourceRows.every(d=>!!d.text?.trim()),'No original consultant narrative is allowed to disappear');
});

test('F01-F61 map each original and new defect exactly once without shrinking scope',()=>{
  assert.equal(plan.schema,'cmeng-consultant-fix-plan-v1');
  assert.equal(plan.baselineFixture,'tests/fixtures/reem-112-review.json');
  assert.equal(plan.items.length,61);
  assert.equal(plan.fixItemCount,61);
  assert.equal(plan.newDefects.length,8);
  assert.deepEqual(plan.items.map(f=>f.id),Array.from({length:61},(_,i)=>'F'+String(i+1).padStart(2,'0')));
  assert.deepEqual(plan.newDefects.map(d=>d.id),Array.from({length:8},(_,i)=>'N-'+(i+1)));
  const observed=new Map<string,number>();
  for(const f of plan.items){
    assert.ok(/R[1-9]/.test(f.root),f.id+' is not linked to a system root');
    assert.ok(f.step>=0&&f.step<=7,f.id+' has no original repair step');
    assert.ok(f.fix.trim()&&f.test.trim()&&f.where.trim(),f.id+' is missing a fix, owner area or acceptance test');
    for(const id of f.d)observed.set(id,(observed.get(id)??0)+1);
  }
  const expected=Array.from({length:266},(_,i)=>'D-'+String(i+1).padStart(3,'0'))
    .concat(Array.from({length:8},(_,i)=>'N-'+(i+1)));
  assert.deepEqual([...observed.keys()].sort(),expected.sort(),'The original 274 identities cannot be removed or replaced');
  assert.ok([...observed.values()].every(count=>count===1),'Every defect must belong to exactly one fix item');
  assert.equal(observed.size,274);
  assert.equal(plan.allDefectsMapped,274);
  assert.ok(plan.items.some(f=>f.id==='F01'&&f.d.includes('N-8')),'Browser answer acceptance gap must remain explicit');
  assert.ok(plan.items.some(f=>f.id==='F61'&&f.d.includes('N-5')),'Heavy quantity payload must remain explicit');
});

test('read-only consultant observations do not masquerade as formal closure',()=>{
  const states=Object.fromEntries(['Fixed','Partly','Open','Not checked'].map(s=>[s,plan.items.filter(f=>f.live===s).length]));
  assert.deepEqual(states,{Fixed:12,Partly:32,Open:4,'Not checked':13});
  assert.ok(plan.items.every(f=>['Fixed','Partly','Open','Not checked'].includes(f.live)));
  assert.ok(plan.items.find(f=>f.id==='F01')?.live==='Open');
});
