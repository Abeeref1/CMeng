import test from 'node:test';
import assert from 'node:assert/strict';
import {assessLinkProposal,reviewLink,shortlistLinks,type LinkInput} from '../packages/runtime-api/src/link-candidate-core';
const context=():LinkInput=>({kind:'payment_certificate',projectId:'P1',basisVersion:3,dataDateIso:'2026-08-31',requestHash:'hash',source:{id:'receipt',projectId:'P1',reference:'Bank transfer 42',description:'Works payment',amount:50,currency:'AED',dateIso:'2026-08-20',sourceRefs:['receipt:row:2']},targets:[{id:'cert',projectId:'P1',reference:'IPC-03',description:'Works certificate',amount:100,currency:'AED',dateIso:'2026-08-01',certified:true,sourceRefs:['cert:row:4']}]});
const proposal=()=>({projectId:'P1',requestHash:'hash',sourceId:'receipt',matches:[{targetId:'cert',confidence:.95,reason:'Payment narrative references the issued works certificate; review retained receipts.',sourceRefs:['receipt:row:2','cert:row:4']}]});
test('AI proposal creates a candidate only; explicit named confirmation retains source and amounts',()=>{const c=context(),before=JSON.stringify(c),rows=assessLinkProposal(c,proposal());assert.equal(rows.length,1);assert.equal(rows[0]!.state,'candidate');assert.equal(JSON.stringify(c),before);assert.throws(()=>reviewLink(rows,rows[0]!.id,3,{decision:'confirm',confirmed:false,reviewer:'Person',actor:'owner'}));const reviewed=reviewLink(rows,rows[0]!.id,3,{decision:'confirm',confirmed:true,reviewer:'Person',actor:'owner'});assert.equal(reviewed[0]!.state,'confirmed');assert.equal(reviewed[0]!.basisVersion,3,'the review records the version it was made at, for audit only');assert.ok(reviewed[0]!.sourceFingerprint&&reviewed[0]!.targetFingerprint,'bound to its two records');assert.equal(JSON.stringify(c),before);});
for(const [label,mutate] of [
 ['wrong project',(c:LinkInput)=>{c.targets[0]!.projectId='P2';}],
 ['wrong currency',(c:LinkInput)=>{c.targets[0]!.currency='SAR';}],
 ['missing date',(c:LinkInput)=>{c.source.dateIso=null;}],
 ['future receipt',(c:LinkInput)=>{c.source.dateIso='2026-09-02';}],
 ['uncertified application',(c:LinkInput)=>{c.targets[0]!.certified=false;}],
 ['certificate after payment',(c:LinkInput)=>{c.targets[0]!.dateIso='2026-08-30';}],
 ['missing money',(c:LinkInput)=>{c.source.amount=null;}],
 ['payee mismatch',(c:LinkInput)=>{c.source.party='Company A';c.targets[0]!.party='Company B';}],
] as const)test('Reject '+label,()=>{const c=context();mutate(c);assert.equal(assessLinkProposal(c,proposal()).length,0);});
test('Reject invented IDs, invented numeric fields, bad source refs and low confidence',()=>{for(const change of [(p:any)=>p.matches[0].targetId='invented',(p:any)=>p.matches[0].amount=12,(p:any)=>p.matches[0].sourceRefs=['made up'],(p:any)=>p.matches[0].confidence=.89,(p:any)=>p.requestHash='wrong']){const p=proposal();change(p);assert.equal(assessLinkProposal(context(),p).length,0);}});
test('Reject stale confirmation and retain rejection history',()=>{const rows=assessLinkProposal(context(),proposal());assert.throws(()=>reviewLink(rows,rows[0]!.id,9,{decision:'confirm',confirmed:true,reviewer:'Person',actor:'owner'},()=>false),/LINK_SOURCE_CHANGED/);
 // R2: a later project version alone never makes a relationship stale.
 assert.equal(reviewLink(rows,rows[0]!.id,9,{decision:'confirm',confirmed:true,reviewer:'Person',actor:'owner'})[0]!.state,'confirmed');const rejected=reviewLink(rows,rows[0]!.id,3,{decision:'reject',confirmed:true,reviewer:'Person',actor:'owner'});assert.equal(rejected[0]!.state,'rejected');});
test('BOQ confidence is a proposal, not an approved quantity split',()=>{const c=context();c.kind='boq_activity';c.source.unit='m3';c.targets[0]!.unit='m2';assert.equal(assessLinkProposal(c,proposal()).length,0);c.targets[0]!.unit=null;const rows=assessLinkProposal(c,proposal());assert.equal(rows[0]!.state,'candidate');assert.ok(!('quantity' in rows[0]!));});
test('The shortlist is bounded and its full eligible denominator remains visible',()=>{const c=context(),targets=Array.from({length:1000},(_,i)=>({...c.targets[0]!,id:'c'+i}));const found=shortlistLinks(c.kind,c.source,targets,c.dataDateIso);assert.equal(found.eligibleCount,1000);assert.equal(found.targets.length,20);
 const second=shortlistLinks(c.kind,c.source,targets,c.dataDateIso,20,20);
 const final=shortlistLinks(c.kind,c.source,targets,c.dataDateIso,20,980);
 assert.equal(second.eligibleCount,1000);
 assert.equal(second.targets.length,20);
 assert.equal(final.targets.length,20);
 assert.equal(final.hasMore,false);
 assert.equal(second.hasMore,true);
 assert.equal(new Set([...found.targets,...second.targets,...final.targets].map(t=>t.id)).size,60,
  'Target windows must be disjoint and reach the final source activity, not silently stop after 20');});
