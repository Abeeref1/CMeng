import test from 'node:test';
import assert from 'node:assert/strict';
import {boqItemContinuity} from '../packages/runtime-api/src/boq-item-continuity';

type Item={id:string;itemNumber:string|null;section:string|null;description:string|null;unit:string|null};
const item=(id:string,itemNumber:string|null,section:string|null,description:string|null,unit:string|null):Item=>
  ({id,itemNumber,section,description,unit});

test('T11 BOQ revision continuity preserves unique normalized source identities, without changing source',()=>{
  const before=[
    item('source-old','  B.25  ','  Block   A','Install duct','m'),
    item('unchanged-native-id','C.1','Floor 1','Installed component','ea'),
    item('different-unit','U.1','Zone 1','Cable','m'),
    item('no-evidence','',null,'Unidentified work','m'),
  ];
  const after=[
    item('new-source-id','Ｂ.25','Block A','  INSTALL   duct  ','m'),
    item('unchanged-native-id','C.1','Floor 1','Different scope','hours'),
    item('new-different-unit','U.1','Zone 1','Cable','kg'),
  ];
  const beforeBytes=JSON.stringify(before),afterBytes=JSON.stringify(after);
  const links=boqItemContinuity(before,after);
  assert.deepEqual([...links],[['source-old','new-source-id'],['unchanged-native-id','unchanged-native-id']]);
  assert.equal(links.has('different-unit'),false,'changed quantity unit cannot gain a link');
  assert.equal(links.has('no-evidence'),false,'blank identity cannot create a link');
  assert.equal(JSON.stringify(before),beforeBytes,'earlier source records must not be mutated');
  assert.equal(JSON.stringify(after),afterBytes,'current source records must not be mutated');
});

test('T11 repeated BOQ identities stay unresolved on both sides; native IDs still persist',()=>{
  const prior=[
    item('duplicate-old-A','R.1','Plant','Pump','ea'),
    item('duplicate-old-B','R.1','Plant','Pump','ea'),
    item('unique-old','R.2','Plant','Switchgear','ea'),
    item('fixed-native','S.1','Plant','Existing unit','ea'),
  ];
  const current=[
    item('duplicate-new-A','R.1','Plant','Pump','ea'),
    item('duplicate-new-B','R.1','Plant','Pump','ea'),
    item('unique-new','R.2','Plant','Switchgear','ea'),
    item('fixed-native','S.1','Plant','Different unit','kg'),
  ];
  const mapping=boqItemContinuity(prior,current);
  assert.deepEqual([...mapping],[['unique-old','unique-new'],['fixed-native','fixed-native']]);
  assert.equal(mapping.has('duplicate-old-A'),false);
  assert.equal(mapping.has('duplicate-old-B'),false);
  const singlePrior=[item('unique-prior','D.1','Civil','Trench','m')];
  const duplicatedCurrent=[item('left','D.1','Civil','Trench','m'),item('right','D.1','Civil','Trench','m')];
  assert.equal(boqItemContinuity(singlePrior,duplicatedCurrent).size,0,
    'an ambiguous target must never become a picked project answer');
});

test('T11 full retained population handles 20,000 repeated source BOQ identities without inventing allocations',()=>{
  const count=20000;
  const prior=Array.from({length:count},(_,i)=>
    item('prior-'+i,'P.100','Common construction area','Installation item','m'));
  const current=Array.from({length:count},(_,i)=>
    item('current-'+i,'P.100','Common construction area','Installation item','m'));
  const distinctPrior=item('old-unique','E.2','Electrical','Generator','ea');
  const distinctCurrent=item('new-unique','E.2','Electrical','Generator','ea');
  prior.push(distinctPrior);
  current.push(distinctCurrent);
  const mapping=boqItemContinuity(prior,current);
  assert.equal(mapping.size,1,'unresolved duplicates must not produce false quantity links');
  assert.equal(mapping.get('old-unique'),'new-unique');
  assert.equal(prior.length,count+1,'no source items removed');
  assert.equal(current.length,count+1,'no current source items removed');
  assert.equal(prior[0]?.itemNumber,'P.100');
  assert.equal(current.at(-1)?.unit,'ea');
});
