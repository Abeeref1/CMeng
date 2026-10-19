'use strict';
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const text=path=>readFileSync(join(root,path),'utf8');
const json=path=>JSON.parse(text(path));
const ledger=json('docs/repair-notes/cmeng-t01-original-defect-evidence-ledger.json');
const consultant=json('docs/acceptance/cmeng-f01-f61-274-defect-plan.json');
const plan=text('docs/repair-notes/CMeng_Repair_Plan.md');
const assertDistinct=(rows,name,total)=>{
  assert.equal(rows.length,total,name+' complete original item population');
  const ids=rows.map(x=>x.id);
  assert.equal(new Set(ids).size,total,name+' unique IDs');
};
assertDistinct(ledger.sw,'SW',57);
assertDistinct(ledger.f,'F',61);
assertDistinct(ledger.s,'S',8);
assert.deepEqual(ledger.requirements,{sw:57,f:61,consultantFindings:274,s:8,abbObservations:641,
  abbDefects:579,abbHistoricallyPassing:62,projects:23,guardRules:39,guardChecks:43401,
  guardHistoricalFailing:11822,guardHistoricalPassing:31579});
assert.equal(ledger.countedNamedItems,126);
assert.equal(ledger.countedConsultantFindings,274);
assert.equal(ledger.requirements.guardHistoricalFailing+ledger.requirements.guardHistoricalPassing,
  ledger.requirements.guardChecks,'historical rule result population unchanged');
const swOriginal=plan.split('\n').filter(row=>/^\| SW-\d\d \|/.test(row)).map(row=>row.split('|').slice(1,-1).map(x=>x.trim()));
assert.equal(swOriginal.length,57,'all original SW lines remain in owner plan');
for(let i=1;i<=57;i++){
 const id='SW-'+String(i).padStart(2,'0'),original=swOriginal.find(row=>row[0]===id);
 const item=ledger.sw.find(row=>row.id===id);
 assert.ok(original&&item,'original SW item '+id);
 assert.equal(item.description,original[1],'SW wording remains identical to original');
 assert.equal(item.priority,original[2],'SW priority remains identical');
 assert.deepEqual(item.tasks,original[3].split(',').map(x=>x.trim()),'SW tasks cannot be silently dropped');
 assert.equal(item.guardRules,original[4],'SW guard assignment remains unchanged');
}
assert.equal(consultant.items.length,61,'all 61 consultant fix items present');
const defectIds=new Set();
for(let i=1;i<=61;i++){
 const id='F'+String(i).padStart(2,'0');
 const original=consultant.items.find(x=>x.id===id),item=ledger.f.find(x=>x.id===id);
 assert.ok(original&&item,'F item '+id);
 assert.deepEqual(item.originalDefectIds,original.d,'exact consultant source D/N mapping');
 assert.equal(item.repairRequirement,original.fix,'consultant repair must not be shortened');
 assert.equal(item.expectedSourceCheck,original.test,'independent expected source evidence stays original');
 assert.equal(item.consultantObservation.historicalStatus,original.live,'original historical finding status preserved');
 for(const d of item.originalDefectIds){assert.ok(!defectIds.has(d),'duplicate consultant source finding '+d);defectIds.add(d);}
}
assert.equal(defectIds.size,274,'all consultant D/N defects mapped once');
for(let i=1;i<=266;i++)assert.ok(defectIds.has('D-'+String(i).padStart(3,'0')));
for(let i=1;i<=8;i++)assert.ok(defectIds.has('N-'+i));
assert.deepEqual(ledger.s.map(x=>x.id),['S02','S06','S07','S17','S21','S32','S35','S45']);
assert.equal(ledger.abb.originalTotal,641);
assert.equal(ledger.abb.problems,579);
assert.equal(ledger.abb.historicalPasses,62);
assert.equal(ledger.abb.problems+ledger.abb.historicalPasses,ledger.abb.originalTotal);
assert.deepEqual(ledger.abb.historicalSeverities,{Critical:19,High:153,Medium:291,Low:178});
assert.equal(ledger.abb.sourceRef.libraryFileId,'libfile_5b34fb78486c81918ed5d038e1912fd0');
assert.equal(ledger.abb.sourceRef.originalWorkbookSha256,'b30041505c92ce20446ba584a44d69e95d02f7fcb7b98e50abc1e40776e4c296');
assert.equal(ledger.abb.sourceRef.originalWorkbookSizeBytes,276998);
const groupCounts={
 G1_MANAGEMENT:93,G2_PLANNING:83,G3_CHANGES_FORECAST:78,G4_PROGRESS:54,
 G5_DELAY:62,G6_COMMERCIAL:75,G7_PROCUREMENT:65,
 G8_DESIGN_CONSTRUCTION_QUALITY:83,G9_HANDOVER_RISK:48,
};
assert.deepEqual(ledger.abb.groupCounts,groupCounts,'entire original workbook category population');
const ids=new Set();
for(const [group,count] of Object.entries(groupCounts)){
 for(let i=1;i<=count;i++){
  const id=group+'-'+String(i).padStart(2,'0');
  assert.ok(!ids.has(id),'no duplicate ABB IDs');
  ids.add(id);
 }
}
assert.equal(ids.size,641);
assertDistinct(ledger.abb.individualObservations,'ABB',641);
const observed=new Set(ledger.abb.individualObservations.map(x=>x.id));
assert.deepEqual(observed,ids,'every original ABB finding identifier must be present once');
const verdictCounts={Problem:0,'Originally correct':0};
for(const x of ledger.abb.individualObservations){
 assert.equal(x.sourceRef.libraryFileId,ledger.abb.sourceRef.libraryFileId);
 assert.equal(x.sourceRef.workbook,ledger.abb.sourceRef.workbook);
 assert.equal(x.sourceRef.sheet,ledger.abb.sourceRef.sheet);
 assert.equal(x.sourceRef.findExactId,x.id,'each row must point to exact original workbook ID');
 assert.ok(Object.hasOwn(verdictCounts,x.historicalVerdict),'source-only verdict');
 verdictCounts[x.historicalVerdict]++;
}
assert.deepEqual(verdictCounts,{Problem:579,'Originally correct':62});
// Candidate mappings from the unchanged original ABB workbook are a
// prioritization crosswalk, NEVER a substitute for current-release verification.
// One finding may have two distinct shared causes, so do not discard overlaps.
const overlap=ledger.abb.proposedOverlapAudit;
assert.ok(overlap,'original candidate root mapping audit retained');
assert.equal(overlap.candidateSwMappedProblemObservations,522);
assert.equal(overlap.problemObservationsPendingDetailedRootMapping,57);
assert.equal(overlap.originallyCorrectObservationsWithNoProblemMapping,62);
assert.equal(overlap.candidateSwMappedProblemObservations+overlap.problemObservationsPendingDetailedRootMapping,ledger.abb.problems);
assert.equal(overlap.originallyCorrectObservationsWithNoProblemMapping,ledger.abb.historicalPasses);
assert.equal(overlap.originalSourceWorkbookSha256,ledger.abb.sourceRef.originalWorkbookSha256);
assert.equal(new Set(overlap.distinctSwCandidateRootIds).size,15);
for(const id of overlap.distinctSwCandidateRootIds)
 assert.ok(ledger.sw.some(item=>item.id===id),'proposed ABB root exists in original SW population: '+id);

// The exact owner workbook supplied 522 candidate SW overlaps, with 57
// problem observations still lacking a SW label. These are proposed root
// hypotheses, not passed checks or signed acceptance. Retain every dual root.
assert.equal(overlap.individualSourceOverlapImported,true);
assert.equal(overlap.individualMappedProblemCount,522);
assert.equal(overlap.individualUnmappedProblemCount,57);
const rootToIds=new Map();
let proposedMapped=0,notMapped=0,untouchedCorrect=0,multiRoot=0;
for(const row of ledger.abb.individualObservations){
  const roots=row.proposedSwRootIds??[];
  assert.equal(new Set(roots).size,roots.length,'duplicate cause label on '+row.id);
  if(row.historicalVerdict==='Originally correct'){
    untouchedCorrect++;
    assert.equal(roots.length,0,'originally passing ABB case must not be converted into a defect');
    assert.equal(row.originalSwLinkState,'originally_correct_regression');
    continue;
  }
  if(!roots.length){
    notMapped++;
    assert.equal(row.originalSwLinkState,'original_problem_no_proposed_sw_root');
    continue;
  }
  proposedMapped++;
  if(roots.length>1)multiRoot++;
  assert.equal(row.originalSwLinkState,'source_proposed_overlap_unverified');
  for(const root of roots){
    assert.ok(overlap.distinctSwCandidateRootIds.includes(root),'unapproved SW root '+root);
    const list=rootToIds.get(root)??[];
    list.push(row.id);
    rootToIds.set(root,list);
  }
  assert.equal(row.implementation.status,'not_reconciled',
    'grouping proposal is not proof the ABB finding has been fixed: '+row.id);
  assert.equal(row.independentVerification.status,'not_certified',
    'grouping proposal is not independent evidence: '+row.id);
}
assert.equal(proposedMapped,522);
assert.equal(notMapped,57);
assert.equal(untouchedCorrect,62);
assert.ok(multiRoot>0,'preserve overlapping original SW causes, never force single ownership');
const expectedRootCounts={
  'SW-01':64,'SW-04':26,'SW-05':25,'SW-06':48,'SW-09':20,
  'SW-11':38,'SW-13':38,'SW-28':12,'SW-36':34,'SW-37':12,
  'SW-39':36,'SW-40':36,'SW-44':83,'SW-45':184,'SW-46':136,
};
assert.equal(rootToIds.size,15);
for(const [root,total] of Object.entries(expectedRootCounts)){
  const sw=ledger.sw.find(row=>row.id===root);
  assert.ok(sw,'source label has original SW root '+root);
  assert.equal((rootToIds.get(root)??[]).length,total,'fixed owner source workbook overlap count '+root);
  assert.deepEqual(sw.candidateAbbObservationIds,[...rootToIds.get(root)].sort(),
   'original SW root must link both directions to exactly its ABB observations '+root);
  assert.ok(sw.guardRules,'source root must retain its original guard/independent reference '+root);
}
assert.equal(proposedMapped+notMapped+untouchedCorrect,641);

const expectedVerificationRoutes={
 root_guard_and_consumer:522,independent_domain_then_screen_export:44,
 missing_source_and_input_route:11,decision_persistence_and_consumers:1,
 source_ai_lineage_and_output:1,originally_correct_regression:62,
};
const actualVerificationRoutes=Object.fromEntries(Object.keys(expectedVerificationRoutes).map(k=>[k,0]));
const knownSourceGapIds=new Set('G7_PROCUREMENT-33|G3_CHANGES_FORECAST-31|G3_CHANGES_FORECAST-52|G3_CHANGES_FORECAST-68|G5_DELAY-08|G6_COMMERCIAL-18|G6_COMMERCIAL-45|G6_COMMERCIAL-51|G6_COMMERCIAL-67|G8_DESIGN_CONSTRUCTION_QUALITY-60|G8_DESIGN_CONSTRUCTION_QUALITY-64'.split('|'));
for(const row of ledger.abb.individualObservations){
 const route=row.proposedVerificationGroup;
 assert.ok(route&&Object.hasOwn(expectedVerificationRoutes,route.route),'every original finding has a source-backed proposed verifier route: '+row.id);
 assert.equal(route.sourceWorkbookSha256,ledger.abb.sourceRef.originalWorkbookSha256);
 assert.equal(route.status,'not_certified','a candidate root link cannot certify the finding: '+row.id);
 assert.ok(route.sourceCheck,'verifier must state an exact intended source check: '+row.id);
 actualVerificationRoutes[route.route]++;
 if(row.historicalVerdict==='Originally correct')assert.equal(route.route,'originally_correct_regression');
 else if(row.proposedSwRootIds?.length)assert.equal(route.route,'root_guard_and_consumer','source SW candidate must keep root guard and consumer checks: '+row.id);
 else if(knownSourceGapIds.has(row.id))assert.equal(route.route,'missing_source_and_input_route','original source gap method retained: '+row.id);
 else if(row.id==='G3_CHANGES_FORECAST-67')assert.equal(route.route,'decision_persistence_and_consumers');
 else if(row.id==='G5_DELAY-09')assert.equal(route.route,'source_ai_lineage_and_output');
 else assert.equal(route.route,'independent_domain_then_screen_export','unmapped original calculation requires independent calculation: '+row.id);
}
assert.deepEqual(actualVerificationRoutes,expectedVerificationRoutes);
assert.deepEqual(overlap.sourceVerificationRoutes,expectedVerificationRoutes);


const historicallyCorrect=new Set((
 'G1_MANAGEMENT-36,G1_MANAGEMENT-37,G1_MANAGEMENT-38,G1_MANAGEMENT-39,G1_MANAGEMENT-40,G1_MANAGEMENT-41,G1_MANAGEMENT-56,G1_MANAGEMENT-65,G1_MANAGEMENT-66,G1_MANAGEMENT-81,G1_MANAGEMENT-93,G2_PLANNING-21,G2_PLANNING-39,G2_PLANNING-54,G2_PLANNING-62,G2_PLANNING-67,G2_PLANNING-70,G2_PLANNING-83,G3_CHANGES_FORECAST-13,G3_CHANGES_FORECAST-20,G3_CHANGES_FORECAST-32,G3_CHANGES_FORECAST-38,G3_CHANGES_FORECAST-53,G3_CHANGES_FORECAST-69,G3_CHANGES_FORECAST-78,G4_PROGRESS-11,G4_PROGRESS-28,G4_PROGRESS-35,G4_PROGRESS-40,G4_PROGRESS-49,G4_PROGRESS-54,G5_DELAY-25,G5_DELAY-26,G5_DELAY-37,G5_DELAY-38,G5_DELAY-50,G5_DELAY-62,G6_COMMERCIAL-17,G6_COMMERCIAL-19,G6_COMMERCIAL-29,G6_COMMERCIAL-38,G6_COMMERCIAL-62,G6_COMMERCIAL-75,G7_PROCUREMENT-16,G7_PROCUREMENT-30,G7_PROCUREMENT-38,G7_PROCUREMENT-45,G7_PROCUREMENT-53,G7_PROCUREMENT-60,G7_PROCUREMENT-65,G8_DESIGN_CONSTRUCTION_QUALITY-16,G8_DESIGN_CONSTRUCTION_QUALITY-17,G8_DESIGN_CONSTRUCTION_QUALITY-18,G8_DESIGN_CONSTRUCTION_QUALITY-31,G8_DESIGN_CONSTRUCTION_QUALITY-39,G8_DESIGN_CONSTRUCTION_QUALITY-53,G8_DESIGN_CONSTRUCTION_QUALITY-76,G8_DESIGN_CONSTRUCTION_QUALITY-83,G9_HANDOVER_RISK-20,G9_HANDOVER_RISK-22,G9_HANDOVER_RISK-30,G9_HANDOVER_RISK-48'
).split(','));
assert.equal(historicallyCorrect.size,62,'all 62 original passing cases locked by source ID');
for(const item of ledger.abb.individualObservations){
 assert.equal(item.historicalVerdict,
  historicallyCorrect.has(item.id)?'Originally correct':'Problem',
  'original ABB observation verdict cannot be swapped or silently promoted: '+item.id);
}
const all=[...ledger.sw,...ledger.f,...ledger.s,...ledger.abb.individualObservations];
for(const item of all){
 assert.ok(['not_reconciled','partial_source_repair_saved','source_fix_verified','independently_certified'].includes(item.implementation.status),
  'explicit implementation state for '+item.id);
 assert.ok(['not_certified','certified'].includes(item.independentVerification.status),
  'no invented independent status for '+item.id);
 if(item.independentVerification.status==='certified')
  assert.ok(item.independentVerification.exactSha&&item.independentVerification.evidenceReceipt,
   'full exact-SHA independent evidence required for '+item.id);
 if(item.ownerAcceptance==='accepted')
  assert.ok(item.independentVerification.status==='certified'&&item.ownerReceipt,
   'independent evidence and owner receipt required before closure for '+item.id);
}
// T01 board: every row has a repair reference and a verification method.
const {existsSync}=require('node:fs');
const METHOD_KINDS=new Set(['guard_rule','independent_reader','independent_calculator','expert_review']);
const REPAIR_STATES=new Set(['commits','via_proposed_sw_root','none_yet','not_applicable_originally_correct']);
const LIVE_STATES=new Set(['live','partly_live','saved_not_live','no_repair']);
const COMMIT_LIVE=new Set(['live','saved_not_live']);
const BOARD_STATUSES=new Set(['open_no_repair_linked','open_root_not_repaired','open_root_repair_saved_not_live',
 'open_root_repair_live','repair_saved_not_live_no_named_test','repair_saved_not_live_named_test',
 'repair_live_no_named_test','repair_live_named_test_not_certified','originally_correct_watch']);
assert.ok(ledger.board&&ledger.board.liveRelease==='b3c76d6','board records live release b3c76d6');
assert.equal(ledger.board.startingPoint.checksRun,43401);
assert.equal(ledger.board.startingPoint.checksFailing,11822);
const boardCounts={};
for(const item of all){
 const r=item.repairReference,v=item.verificationMethod;
 assert.ok(r&&REPAIR_STATES.has(r.state),'repair reference for '+item.id);
 assert.ok(LIVE_STATES.has(r.liveState),'live state for '+item.id);
 assert.ok(Array.isArray(r.commits),'commit list for '+item.id);
 for(const c of r.commits){
  assert.match(c.sha,/^[0-9a-f]{8}$/,'commit hash on '+item.id);
  assert.ok(COMMIT_LIVE.has(c.liveState),'commit '+c.sha+' resolved in repository and marked live or saved_not_live on '+item.id);
  assert.equal(typeof c.onBranch,'boolean','branch membership recorded for '+c.sha+' on '+item.id);
 }
 if(r.commits.length)assert.ok(r.commits.some(c=>c.onBranch),'at least one repair commit is on the branch itself (not only in per-fix history): '+item.id);
 if(r.state==='commits'){
  assert.ok(r.commits.length>0,'commit repair reference needs a hash: '+item.id);
  assert.deepEqual(r.commits.map(c=>c.sha).sort(),[...new Set((item.implementation.sourceCommits??[]).map(x=>x.slice(0,8)))].sort(),
   'repair reference equals implementation commits: '+item.id);
 }
 if(r.state==='none_yet'){
  assert.equal(r.commits.length,0);
  assert.ok(r.plannedTasks.length>0||r.plannedConsultantRoot,'open row names its planned task or consultant root: '+item.id);
 }
 if(r.state==='via_proposed_sw_root')assert.ok(r.swRootIds.length>0&&r.swRootIds.every(id=>ledger.sw.some(x=>x.id===id)),'overlap roots exist: '+item.id);
 if(r.state==='not_applicable_originally_correct')assert.equal(item.historicalVerdict,'Originally correct');
 const liveCount=r.commits.filter(c=>c.liveState==='live').length;
 assert.equal(r.liveState,!r.commits.length?'no_repair':liveCount===r.commits.length?'live':liveCount?'partly_live':'saved_not_live',
  'live state follows its commits (saved, not live after b3c76d6): '+item.id);
 assert.ok(v&&Array.isArray(v.kinds)&&v.kinds.length>0&&v.kinds.every(k=>METHOD_KINDS.has(k)),'verification method for '+item.id);
 assert.ok(typeof v.detail==='string'&&v.detail.length>0,'verification detail for '+item.id);
 if(v.kinds.includes('guard_rule'))assert.ok(v.guardRules.length>0,'guard method names its rule: '+item.id);
 for(const t of v.namedTests)assert.ok(existsSync(join(root,t)),'named test exists: '+t+' on '+item.id);
 assert.deepEqual(v.namedTests,item.implementation.regressionFiles??[],'named tests equal regression files: '+item.id);
 assert.ok(BOARD_STATUSES.has(item.boardStatus),'board status for '+item.id);
 assert.ok(!/fixed|closed|accepted|(?<!not_)certified$/.test(item.boardStatus),'no row may be called fixed or closed on the board: '+item.id);
 if(/(?<!no_)named_test/.test(item.boardStatus))assert.ok(v.namedTests.length>0,'named-test status needs a named test: '+item.id);
 if(/^repair_saved_not_live/.test(item.boardStatus))assert.ok(['saved_not_live','partly_live'].includes(r.liveState));
 if(/^repair_live/.test(item.boardStatus))assert.equal(r.liveState,'live');
 const g=item.id.startsWith('SW-')?'SW':/^F\d\d$/.test(item.id)?'F':/^S\d\d$/.test(item.id)?'S':'ABB';
 boardCounts[g]??={};boardCounts[g][item.boardStatus]=(boardCounts[g][item.boardStatus]??0)+1;
}
assert.deepEqual(boardCounts,ledger.board.statusCounts,'board counts match rows');
for(const sw of ledger.sw)assert.ok(sw.cause&&sw.cause.cause,'cause recorded for '+sw.id);
assert.equal(ledger.projects.length,23,'all 23 projects on the board (rule V2)');
for(const p of ledger.projects)assert.ok(['test_by_own_name','not_established'].includes(p.testMarking),'test marking for '+p.id);
const boardText=text('docs/repair-notes/CMeng_T01_Board.md');
for(const [g,c] of Object.entries(boardCounts)){
 const rows=Object.values(c).reduce((a,b)=>a+b,0);
 assert.ok(boardText.includes('| '+g+' | '+rows+' | '),'board page shows '+g+' row count');
}
for(const item of [...ledger.sw,...ledger.f,...ledger.s])assert.ok(boardText.includes('| '+item.id+' | '),'board page lists '+item.id);
const agents=text('AGENTS.md');
assert.ok(agents.includes('docs/repair-notes/CMeng_Repair_Plan.md')&&agents.includes('docs/repair-notes/CMeng_T01_Board.md'),'AGENTS.md points to the plan and the board');
assert.match(text('docs/cmeng-fixed-seven-stage-readiness.md'),/Access decision \(owner\)[\s\S]*no sign-in, no user accounts and no role control/i,'no-sign-in decision recorded in the seven-stage document');
const open=all.filter(x=>x.ownerAcceptance!=='accepted').length;
console.log('CMENG_T01_TRACEABILITY_CHECK=PASS original_items='+all.length+
  ' sw='+ledger.sw.length+' f='+ledger.f.length+' consultant_findings='+defectIds.size+
  ' s='+ledger.s.length+' abb_source_rows='+ledger.abb.individualObservations.length+
  ' abb_problem='+verdictCounts.Problem+' abb_originally_correct='+verdictCounts['Originally correct']+
  ' owner_acceptance_outstanding='+open+' board='+JSON.stringify(boardCounts));
