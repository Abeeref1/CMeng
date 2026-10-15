import test from 'node:test';
import assert from 'node:assert/strict';
import {boqItemContinuity} from '../packages/runtime-api/src/boq-item-continuity';

type Item={id:string;itemNumber:string|null;section:string|null;description:string|null;unit:string|null};
const item=(id:string,number:string,description:string,unit='ea'):Item=>
  ({id,itemNumber:number,section:'Original section',description,unit});

test('T02/T05 native BOQ identity must be unique in both revisions',()=>{
  const older=[
    item('DUP-PREV','1','Pump A'),
    item('DUP-PREV','2','Pump B'),
    item('UNCHANGED','3','Old scope'),
    item('TARGET-DUP','4','A different previous scope'),
    item('UNIQUE-OLD','5','Unique package'),
  ];
  const newer=[
    item('DUP-PREV','1','Pump A'),
    item('UNCHANGED','3','Changed scope','kg'),
    item('TARGET-DUP','4','Different current unit'),
    item('TARGET-DUP','5','Unique package'),
    item('UNIQUE-NEW','5','Unique package'),
  ];
  const before=JSON.stringify(older),after=JSON.stringify(newer);
  const links=boqItemContinuity(older,newer);
  assert.equal(links.has('DUP-PREV'),false,'a duplicated previous source ID is not a single record');
  assert.equal(links.get('UNCHANGED'),'UNCHANGED',
    'a unique preserved source ID stays authoritative despite a changed description');
  assert.equal(links.has('TARGET-DUP'),false,'duplicate current native IDs cannot be selected');
  assert.equal(links.get('UNIQUE-OLD'),'UNIQUE-NEW',
    'unique descriptive fallback remains available when both source identities are unambiguous');
  assert.equal(JSON.stringify(older),before,'all original source rows must be retained');
  assert.equal(JSON.stringify(newer),after,'all current source rows must be retained');
});

test('T02/T05 duplicate native target on a unique descriptive fallback cannot receive an allocation',()=>{
  const older=[item('ORIGINAL','B.1','Electrical panel')];
  const newer=[item('SAME','B.1','Electrical panel'),item('SAME','B.2','Transformer')];
  assert.equal(boqItemContinuity(older,newer).size,0,
    'a duplicated native ID is ambiguous even if only one descriptive signature matches');
  const uniqueNewer=[item('UNIQUE-NEW','B.1','Electrical panel')];
  assert.deepEqual([...boqItemContinuity(older,uniqueNewer)],[['ORIGINAL','UNIQUE-NEW']]);
});

test('T02/T05 source identity guard stays isolated for overlapping IDs in separate projects',()=>{
  const a=boqItemContinuity(
    [item('ID-1','1','A'),item('ID-1','2','B')],
    [item('ID-1','1','A')]);
  const b=boqItemContinuity(
    [item('ID-1','1','A')],
    [item('ID-1','1','A')]);
  assert.equal(a.size,0,'ambiguous project A remains unresolved');
  assert.deepEqual([...b],[['ID-1','ID-1']],
    'project B uses its own original population without cross-project contamination');
});
