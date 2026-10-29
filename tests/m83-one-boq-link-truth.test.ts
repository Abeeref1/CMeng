import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {governedQuantityModel,boqProgrammeLinks} from '../packages/runtime-api/src/boq-programme-links';
import {deliveryPosition} from '../packages/runtime-api/src/delivery-projections';
import {projectControlSchedule} from '../packages/runtime-api/src/canonical-time-claims';
import {boqItemLinkEntity,activityLinkEntity} from '../packages/runtime-api/src/link-validity';
import {linkEntityFingerprint} from '../packages/runtime-api/src/link-candidate-core';
import {buildBoqFeasibility} from '../packages/delivery-challenge/src/boq-feasibility';
import {smallProgrammeXer} from './real-browser-harness';

// M8.3 + M11.2 invariant: one BOQ-to-activity allocation truth. A user-confirmed
// link to one activity, or a labour-rate table naming the item and one activity,
// allocates the item; the shared link rows, Delivery, the quantity S-curve and
// feasibility all read the same allocation. A CMeng proposal never allocates.

const DATA_DATE='2033-03-15';
const BOQ='Item No,Description,Unit,Quantity,Rate,Amount,Currency\n1.1,Concrete to raft slab,m3,100,50,5000,SAR\n1.2,Formwork to raft edges,m2,200,20,4000,SAR\n1.3,General attendance,item,1,1000,1000,SAR\n';
const RATES='Item Number,Activity ID,Unit,Labour Hours Per Unit\n1.2,ACT-104,m2,0.5\n';

async function project(id:string){
  runtimeProjects.getOrCreate(id);
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'Programme.xer',bytes:Buffer.from(smallProgrammeXer(id,DATA_DATE)),mediaType:'text/plain',uploadedAt:'2033-03-16T09:00:00Z',uploadIntent:'add_update'});
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'BOQ.csv',bytes:Buffer.from(BOQ),mediaType:'text/csv',uploadedAt:'2033-03-16T09:00:00Z',uploadIntent:'add_update'});
  await runtimeProjects.ingestEvidenceFile({projectId:id,sourceFilename:'Crew_Rates.csv',bytes:Buffer.from(RATES),mediaType:'text/csv',uploadedAt:'2033-03-16T09:00:00Z',uploadIntent:'add_update'});
  return runtimeProjects.getOrCreate(id);
}
function confirm(state:any,itemNumber:string,activityId:string,decision:'confirmed'|'proposed'='confirmed'){
  const model=projectControlSchedule(state)!.revision.model;
  const quantities=governedQuantityModel(state,model).quantities!;
  const item=quantities.items.find(i=>i.itemNumber===itemNumber)!;
  const activity=model.activities.find(a=>a.activityId===activityId)!;
  const wbs=model.wbs.find(w=>w.wbsId===activity.wbsId)?.name;
  state.linkCandidateReviews=[...(state.linkCandidateReviews??[]),{id:'review-'+itemNumber+'-'+activityId,kind:'boq_activity',projectId:state.projectId,basisVersion:state.version,requestHash:'t',
    sourceId:item.quantityItemId,targetId:activityId,sourceLabel:itemNumber,targetLabel:activityId,confidence:1,state:decision,
    sourceFingerprint:linkEntityFingerprint('boq_activity',boqItemLinkEntity(item,state.projectId)),
    targetFingerprint:linkEntityFingerprint('boq_activity',activityLinkEntity(activity,wbs,model.sourceRevisionId,state.projectId))}];
  state.version++;
  return item.quantityItemId;
}
const allocationOf=(state:any,itemId:string)=>{const model=projectControlSchedule(state)!.revision.model;return governedQuantityModel(state,model).quantities!.allocations.filter(a=>a.quantityItemId===itemId);};

test('M8.3: a confirmed BOQ link and a rate-table link allocate the item, and every consumer uses that one allocation',async()=>{
  const state=await project('M83-ONE-TRUTH');
  const model=projectControlSchedule(state)!.revision.model;
  const confirmedItem=confirm(state,'1.1','ACT-101');
  const proposedItem=confirm(state,'1.3','ACT-103','proposed');
  const rated=governedQuantityModel(state,model).quantities!.items.find(i=>i.itemNumber==='1.2')!.quantityItemId;
  const check=(step:string)=>{
    const current=projectControlSchedule(state)!.revision.model;
    assert.deepEqual(allocationOf(state,confirmedItem).map(a=>[a.activityId,a.allocatedQuantity]),[['ACT-101',100]],step+': confirmed link allocates the whole item');
    assert.deepEqual(allocationOf(state,rated).map(a=>[a.activityId,a.allocatedQuantity]),[['ACT-104',200]],step+': the rate table links and allocates its item');
    assert.deepEqual(allocationOf(state,proposedItem),[],step+': a proposal never allocates');
    // Shared link rows.
    const rows=boqProgrammeLinks(state,current).rows;
    assert.deepEqual(rows.find((r:any)=>r.itemId===confirmedItem).activityIds,['ACT-101'],step+': shared rows');
    assert.equal(rows.find((r:any)=>r.itemId===confirmedItem).allocationBasis,'confirmed_link');
    // Delivery BOQ mapping.
    const delivery=deliveryPosition(state) as any;
    const boqRow=(delivery.boqIntelligence?.rows??[]).find((r:any)=>r.itemId===confirmedItem);
    assert.ok(boqRow,step+': Delivery lists the BOQ item');assert.ok(boqRow.programmeActivityIds.includes('ACT-101'),step+': Delivery');
    // Quantity S-curve.
    const curve=moduleForProject(state.projectId,'quantity-scurve').data as any;
    assert.ok(curve.allocatedItemCount>=2,step+': the S-curve counts both allocated items: '+curve.allocatedItemCount);
    assert.equal(curve.mappingBasis,'governed',step+': S-curve basis');
    // Feasibility and challenge read the same allocation.
    const governed=governedQuantityModel(state,current).quantities!;
    const feasibility=buildBoqFeasibility({schedule:current,quantities:{...governed,installedSnapshots:[{snapshotId:'s',quantityItemId:confirmedItem,asOfIso:DATA_DATE+'T00:00:00Z',installedQuantity:40,sourceRefs:[]}]} as any,resources:null,rates:[]});
    assert.equal(feasibility.rows.find((r:any)=>r.quantityItemId===confirmedItem)!.activityId,'ACT-101',step+': feasibility uses the confirmed link');
  };
  check('after confirming');
  // An unrelated upload keeps it.
  await runtimeProjects.ingestEvidenceFile({projectId:state.projectId,sourceFilename:'RFI.csv',bytes:Buffer.from('RFI No,Subject,Raised Date,Status\nRFI-1,Levels,2033-03-01,Open\n'),mediaType:'text/csv',uploadedAt:'2033-03-17T09:00:00Z',uploadIntent:'add_update'});
  check('after an unrelated upload');
});
