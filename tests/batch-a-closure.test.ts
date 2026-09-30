import test from 'node:test';
import assert from 'node:assert/strict';
import {createSourceFile,isFunctionDeclaration,ScriptTarget} from 'typescript';
import {runInNewContext} from 'node:vm';

import {moduleFeatureAvailability} from '../packages/runtime-api/src/feature-availability';
import {deliveryPopulationAuthority} from '../packages/runtime-api/src/delivery-projections';
import {establishedPopulationCount,managementAction} from '../packages/truth-kernel/src';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

test('conditional feature states prevent analytical shells from pretending to be complete',()=>{
  assert.equal(moduleFeatureAvailability('forecast-history',{points:[{sourceRevisionId:'R1'}]}).state,'evidence_only');
  assert.equal(moduleFeatureAvailability('forecast-history',{points:[{},{}]}).state,'active');
  assert.equal(moduleFeatureAvailability('windows-analysis',{windows:[],revisionLabels:{R1:'Rev 1'}}).state,'evidence_only');
  assert.equal(moduleFeatureAvailability('challenge-contract',{suppliedBoq:{itemCount:25},boqFeasibility:{activityChecks:[]}}).state,'evidence_only');
  assert.equal(moduleFeatureAvailability('quantity-scurve',{boqItemCount:25,series:[],installedQuantityStatus:{state:'unresolved'}}).state,'evidence_only');
});

test('Delivery management zero is authoritative only when its population is established',()=>{
  const established=deliveryPopulationAuthority(
    {state:'established',denominator:0,knownRecordCount:0,pendingRecordCount:0,basis:'Confirmed complete population'},
    0,0,
  );
  assert.equal(established.state,'established');
  assert.equal(establishedPopulationCount(0,established),0);

  const missing=deliveryPopulationAuthority(
    {state:'not_established',denominator:null,knownRecordCount:0,pendingRecordCount:0,basis:'Population not confirmed'},
    0,0,
  );
  assert.equal(missing.state,'missing');
  assert.equal(establishedPopulationCount(0,missing),null);

  const partial=deliveryPopulationAuthority(
    {state:'not_established',denominator:null,knownRecordCount:7,pendingRecordCount:2,basis:'Known subset'},
    12,7,
  );
  assert.equal(partial.state,'partial');
  assert.equal(partial.sourceCount,12);
  assert.equal(partial.currentCount,null);
  assert.equal(establishedPopulationCount(7,partial),null);
});

test('canonical management action retains owning module and deduplicates source/scope metadata',()=>{
  const action=managementAction({
    actionId:'A1',
    issue:'Package late',
    consequence:'Milestone threatened',
    affectedScope:['PKG-01','PKG-01'],
    affectedMilestones:['M1','M1'],
    owner:'Procurement Manager',
    organisation:'Contractor',
    requiredAction:'Expedite delivery',
    dueIso:'2030-02-01',
    escalation:'Escalate if not recovered',
    severity:'high',
    authority:'source',
    sourceRefs:['DOC1:row:7','DOC1:row:7'],
    owningModule:'long-lead',
  });
  assert.equal(action.owningModule,'long-lead');
  assert.deepEqual(action.affectedScope,['PKG-01']);
  assert.deepEqual(action.affectedMilestones,['M1']);
  assert.deepEqual(action.sourceRefs,['DOC1:row:7']);
});

test('primary UI consumes canonical actions and conditional feature states',()=>{
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  assert.match(script,/Array\.isArray\(data\.actions\)\?data\.actions:\[\]/);
  assert.match(script,/Completion history is not yet a trend/);
  assert.match(script,/Delay-window analysis is not yet applicable/);
  assert.match(script,/Challenge the Contract is not yet fully assessable/);
  assert.match(script,/Quantity evidence is available, but a complete quantity curve is not yet established/);
});

test('unknown internal diagnostics do not become mechanical primary-page labels',()=>{
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
  const functionText=(names:string[])=>source.statements
    .filter(isFunctionDeclaration)
    .filter(node=>node.name&&names.includes(node.name.text))
    .map(node=>node.getText(source)).join('\n');
  const code=functionText(['humanizeKey','humanizeDiagnostic']);
  const unknown=runInNewContext(code+';humanizeDiagnostic("UNMAPPED_INTERNAL_ENGINE_TOKEN:ABC")');
  assert.equal(unknown,'Additional calculation qualification');
  const known=runInNewContext(code+';humanizeDiagnostic("SCHEDULE_GRAPH_CYCLES:A1")');
  assert.match(String(known),/circular relationship/i);
});
