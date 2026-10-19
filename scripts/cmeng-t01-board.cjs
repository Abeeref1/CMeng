'use strict';
// T01 board builder. Reads the original evidence ledger and the hand-kept
// repair links, adds to every row: repair reference, verification method,
// live state and board status, then writes the ledger back and renders
// docs/repair-notes/CMeng_T01_Board.md. Original fields are never changed or
// removed. Run from the repository root with git available:
//   node scripts/cmeng-t01-board.cjs
const {readFileSync,writeFileSync,existsSync}=require('node:fs');
const {join}=require('node:path');
const {execFileSync}=require('node:child_process');
const root=join(__dirname,'..');
const ledgerPath='docs/repair-notes/cmeng-t01-original-defect-evidence-ledger.json';
const ledger=JSON.parse(readFileSync(join(root,ledgerPath),'utf8'));
const links=JSON.parse(readFileSync(join(root,'docs/repair-notes/cmeng-t01-repair-links.json'),'utf8'));
const LIVE=links.liveRelease;

const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
const commitCache=new Map();
function commitInfo(sha){
  if(commitCache.has(sha))return commitCache.get(sha);
  let info;
  try{
    const full=git('rev-parse','--verify',sha+'^{commit}');
    let live=false;
    try{git('merge-base','--is-ancestor',full,links.liveReleaseFull);live=true;}catch{live=false;}
    let onBranch=false;
    try{git('merge-base','--is-ancestor',full,'HEAD');onBranch=true;}catch{onBranch=false;}
    info={sha:full.slice(0,8),subject:git('log','-1','--format=%s',full),liveState:live?'live':'saved_not_live',
      onBranch,history:onBranch?'on this branch':'per-fix history only (v/history1); the same change is in squashed commit 413524f5'};
  }catch{
    info={sha:sha.slice(0,8),subject:null,liveState:'commit_not_in_this_repository'};
  }
  commitCache.set(sha,info);
  return info;
}

const GUARD_IDS=new Set('N1 N2 N3 N4 N5 N6 N7 N8 N9 N10 N11 N12 S1 S2 S3 S4 W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 C1 C2 L1 L2 L3 L4 L5 L6 A1 A2 A3 A4 A5 R1 R2 R3 R4 R5 P1 P2 V1 V2 X1 X2 X3'.split(' '));
const CALCULATORS=['CPM solver','EVM workbook','commercial ledger','notice calculator','delivery state tables'];
function swVerification(sw){
  const text=sw.guardRules,kinds=new Set(),rules=[],tools=[];
  for(const t of text.split(',').map(x=>x.trim())){
    if(GUARD_IDS.has(t)){kinds.add('guard_rule');rules.push(t);}
    else if(t==='reader'){kinds.add('independent_reader');tools.push('independent reader');}
    else if(CALCULATORS.includes(t)){kinds.add('independent_calculator');tools.push(t);}
    else if(t==='design rule'){kinds.add('expert_review');tools.push('design decision, then a rule');}
    else throw new Error('unknown check '+t+' on '+sw.id);
  }
  return {kinds:[...kinds],guardRules:rules,tools,checkState:sw.originalCheckState,
    detail:'Plan check: '+text+' ('+sw.originalCheckState+')',
    namedTests:[...(sw.implementation.regressionFiles??[])]};
}

const swById=new Map(ledger.sw.map(x=>[x.id,x]));
// Cause table from the verifier's SW review (13 Oct): what the user sees and the cause.
const causeRows=JSON.parse(readFileSync(join(root,'docs/repair-notes/cmeng-sw-57-causes.json'),'utf8')).filter(r=>/^SW-\d\d$/.test(r[0]));
// 1. Merge the linked repairs into SW, F and S rows (append only, never remove).
function mergeLinks(row,add){
  if(!add)return;
  const commits=row.implementation.sourceCommits??[];
  for(const c of add.commits)if(!commits.some(x=>x.startsWith(c)||c.startsWith(x)))commits.push(c);
  row.implementation.sourceCommits=commits;
  const files=row.implementation.regressionFiles??[];
  for(const f of add.tests)if(!files.includes(f))files.push(f);
  row.implementation.regressionFiles=files;
  if(row.implementation.status==='not_reconciled')row.implementation.status='partial_source_repair_saved';
  row.implementation.repairNotes=add.what;
  row.implementation.notCovered=add.notCovered;
}
for(const sw of ledger.sw){
  mergeLinks(sw,links.sw[sw.id]);
  const c=causeRows.find(r=>r[0]===sw.id);
  if(!c)throw new Error('no cause row for '+sw.id);
  sw.cause={whatUserSees:c[2],cause:c[3],reviewStatus:c[5],sourceTitle:c[1],
    source:'docs/repair-notes/cmeng-sw-57-causes.json (verifier SW review, 13 Oct 2026)'};
  const rel=links.relatedNotRepair?.[sw.id];
  if(rel)sw.relatedNotRepair={commits:rel.commits.map(commitInfo),why:rel.why};
}
for(const f of ledger.f)mergeLinks(f,links.f?.[f.id]);
for(const s of ledger.s)mergeLinks(s,links.s?.[s.id]);
function liveOf(commits){
  if(!commits.length)return 'no_repair';
  const live=commits.filter(c=>c.liveState==='live').length;
  return live===commits.length?'live':live?'partly_live':'saved_not_live';
}
function repairFromCommits(shas,tasks){
  const commits=shas.map(commitInfo);
  return {state:'commits',commits,plannedTasks:tasks,liveState:liveOf(commits)};
}
function boardStatusFor(repair,tests){
  if(repair.state==='not_applicable_originally_correct')return 'originally_correct_watch';
  if(repair.state==='commits'){
    if(repair.liveState==='live')return tests.length?'repair_live_named_test_not_certified':'repair_live_no_named_test';
    return tests.length?'repair_saved_not_live_named_test':'repair_saved_not_live_no_named_test';
  }
  if(repair.state==='via_proposed_sw_root')return repair.commits.length?'open_root_repair_'+(repair.liveState==='live'?'live':'saved_not_live'):'open_root_not_repaired';
  return 'open_no_repair_linked';
}
for(const sw of ledger.sw){
  const shas=sw.implementation.sourceCommits??[];
  const repair=shas.length?repairFromCommits(shas,sw.tasks):{state:'none_yet',commits:[],plannedTasks:sw.tasks,liveState:'no_repair'};
  sw.repairReference=repair;
  sw.verificationMethod=swVerification(sw);
  sw.boardStatus=boardStatusFor(repair,sw.verificationMethod.namedTests);
}
// 2. Consultant F rows (274 D/N findings are their children).
for(const f of ledger.f){
  const v=links.fRootVerification[f.root];
  if(!v)throw new Error('no verification route for root '+f.root);
  const overlaps=links.fOverlaps[f.id]??[];
  f.proposedSwOverlapIds=overlaps;
  const roots=overlaps.map(id=>swById.get(id));
  const own=f.implementation.sourceCommits??[];
  let repair;
  if(own.length){
    repair=repairFromCommits(own,[...new Set(roots.flatMap(r=>r.tasks))]);
  }else if(overlaps.length){
    const shas=[...new Set(roots.flatMap(r=>r.implementation.sourceCommits??[]))];
    const commits=shas.map(commitInfo);
    repair={state:'via_proposed_sw_root',swRootIds:overlaps,commits,
      plannedTasks:[...new Set(roots.flatMap(r=>r.tasks))],liveState:liveOf(commits),basis:links.fOverlapBasis};
  }else repair={state:'none_yet',commits:[],plannedTasks:[],liveState:'no_repair'};
  repair.plannedConsultantRoot=f.root;repair.plannedConsultantStep=f.step;
  f.repairReference=repair;
  const kinds=new Set(v.kinds),rules=new Set(v.rules);
  for(const r of roots){for(const k of r.verificationMethod.kinds)kinds.add(k);for(const g of r.verificationMethod.guardRules)rules.add(g);}
  f.verificationMethod={kinds:[...kinds],guardRules:[...rules],tools:[],detail:v.detail,
    consultantExpectedCheck:f.expectedSourceCheck,basis:links.fRootBasis+(roots.length?' Rules of the overlapping SW item added.':''),
    namedTests:[...(f.implementation.regressionFiles??[])]};
  f.boardStatus=boardStatusFor(repair,f.verificationMethod.namedTests);
}
// 3. S-items: only the IDs are in the plan; definitions are not in the repository.
for(const s of ledger.s){
  const own=s.implementation.sourceCommits??[];
  s.repairReference=own.length?repairFromCommits(own,['T01']):{state:'none_yet',commits:[],plannedTasks:['T01'],liveState:'no_repair'};
  s.repairReference.note=own.length
    ?'Linked because the commit subject names this S-item. The S-item definition is not in the repository, so coverage cannot be judged.'
    :'S-item definition not found in the repository and no commit names it; repair cannot be linked until the definition is supplied.';
  s.verificationMethod={kinds:['expert_review'],guardRules:[],tools:[],namedTests:[...(s.implementation.regressionFiles??[])],
    detail:'Verifier review against the original S-item definition once supplied.'};
  s.boardStatus=boardStatusFor(s.repairReference,s.verificationMethod.namedTests);
}
// 4. The 641 ABB page findings.
const ROUTE={
  independent_domain_then_screen_export:['independent_calculator','expert_review'],
  missing_source_and_input_route:['independent_reader','expert_review'],
  decision_persistence_and_consumers:['expert_review'],
  source_ai_lineage_and_output:['independent_reader','expert_review'],
  originally_correct_regression:['expert_review'],
};
for(const a of ledger.abb.individualObservations){
  const roots=a.proposedSwRootIds??[];
  let repair,kinds,rules=[];
  if(a.historicalVerdict==='Originally correct'){
    repair={state:'not_applicable_originally_correct',commits:[],plannedTasks:[],liveState:'no_repair',
      note:'Originally correct in the review; kept as a regression watch, no repair needed.'};
  }else if(roots.length){
    const rs=roots.map(id=>swById.get(id));
    const shas=[...new Set(rs.flatMap(r=>r.implementation.sourceCommits??[]))];
    const commits=shas.map(commitInfo);
    repair={state:'via_proposed_sw_root',swRootIds:roots,commits,
      plannedTasks:[...new Set(rs.flatMap(r=>r.tasks))],liveState:liveOf(commits),
      basis:'Owner workbook candidate SW overlap (unverified).'};
  }else{
    repair={state:'none_yet',commits:[],plannedTasks:['T01'],liveState:'no_repair',
      note:'Problem with no proposed SW root yet; root mapping pending.'};
  }
  if(a.proposedVerificationGroup.route==='root_guard_and_consumer'){
    const rs=roots.map(id=>swById.get(id));
    const set=new Set(rs.flatMap(r=>r.verificationMethod.kinds));set.add('expert_review');
    kinds=[...set];rules=[...new Set(rs.flatMap(r=>r.verificationMethod.guardRules))];
  }else kinds=ROUTE[a.proposedVerificationGroup.route];
  if(!kinds)throw new Error('no method for '+a.id);
  a.repairReference=repair;
  a.verificationMethod={kinds,guardRules:rules,tools:[],namedTests:[],
    detail:a.proposedVerificationGroup.sourceCheck,route:a.proposedVerificationGroup.route};
  a.boardStatus=boardStatusFor(repair,[]);
}
// 5. Projects (rule V2) and board summary.
const projectsText=execFileSync('unzip',['-p',join(root,'docs/repair-notes/CMeng_Repair_Pack_original_20261014.zip'),'cmeng-guard/projects.txt'],{encoding:'utf8'});
const projects=projectsText.split('\n').map(x=>x.trim()).filter(Boolean);
ledger.projects=projects.map(id=>({id,
  testMarking:/^QA-/.test(id)?'test_by_own_name':'not_established',
  basis:/^QA-/.test(id)?'Project ID starts with QA, the naming used for quality-assurance data; owner to confirm.':'No source in the repository says whether this project is live or test; owner to mark.'}));
const all=[['SW',ledger.sw],['F',ledger.f],['S',ledger.s],['ABB',ledger.abb.individualObservations]];
const counts={};
for(const [name,rows] of all){counts[name]={};for(const r of rows)counts[name][r.boardStatus]=(counts[name][r.boardStatus]??0)+1;}
ledger.board={
  schema:'cmeng-t01-board-v1',
  boardFile:'docs/repair-notes/CMeng_T01_Board.md',
  liveRelease:LIVE,
  liveRule:'Any commit not inside live release '+LIVE+' is saved, not live. No row is fixed until a named test proves it, it is live, and it is independently checked.',
  startingPoint:{file:'docs/repair-notes/CMeng_Repair_Pack_original_20261014.zip',member:'cmeng-guard/starting_point_b3c76d6.json',
    release:LIVE,checksRun:43401,checksFailing:11822,rules:39,projects:23},
  statusCounts:counts,
  sourcesNotInRepository:[
    'Text of the 8 S-items (S02, S06, S07, S17, S21, S32, S35, S45): only the IDs are in the plan.',
    'Full complaint text of the 641 page findings: only IDs, verdicts and SW overlaps are here; the text is in the owner workbook CMeng_T01_Full_Defect_Traceability_2026-10-14.xlsx, sheet 04 ABB 641.',
    'Per-finding text of the 274 consultant D/N findings: only their F-item grouping, repair text and expected check are here (docs/acceptance/cmeng-f01-f61-274-defect-plan.json).',
    'An owner list of which of the 23 projects are test projects (rule V2).',
  ],
};
writeFileSync(join(root,ledgerPath),JSON.stringify(ledger,null,2)+'\n');

// 6. Render the board.
const esc=s=>String(s??'').replace(/\|/g,'/').replace(/\n/g,' ');
const commitsCell=r=>r.commits.length?r.commits.map(c=>c.sha+(c.liveState==='saved_not_live'?' (saved, not live'+(c.onBranch?'':', per-fix history')+')':c.liveState==='live'?' (live)':' (not in repo)')).join(', '):'none yet'+(r.plannedTasks.length?'; planned '+r.plannedTasks.join(', '):'');
const L=[];
L.push('# CMeng T01 Board','');
L.push('Generated by `node scripts/cmeng-t01-board.cjs` from `'+ledgerPath+'` and `docs/repair-notes/cmeng-t01-repair-links.json`. Checked by `node scripts/verify-cmeng-t01-ledger.cjs`. Edit the links file and re-run; do not edit this page by hand.','');
L.push('Plan: `docs/repair-notes/CMeng_Repair_Plan.md`. Live release: '+LIVE+'. Every commit after '+LIVE+' is **saved, not live**. No row says fixed: a row closes only on a named test, live evidence, independent check and owner acceptance.','');
L.push('Starting point: guard run at '+LIVE+', 11,822 failing of 43,401 checks, 39 rules, 23 projects; saved in `docs/repair-notes/CMeng_Repair_Pack_original_20261014.zip` (`cmeng-guard/starting_point_b3c76d6.json`).','');
const STATUS_ORDER=['open_no_repair_linked','open_root_not_repaired','open_root_repair_saved_not_live','open_root_repair_live','repair_saved_not_live_no_named_test','repair_saved_not_live_named_test','repair_live_no_named_test','repair_live_named_test_not_certified','originally_correct_watch'];
for(const c of Object.values(counts))for(const k of Object.keys(c))if(!STATUS_ORDER.includes(k))throw new Error('status not in board order: '+k);
const used=STATUS_ORDER.filter(k=>Object.values(counts).some(c=>c[k]));
L.push('## Counts by status','','| Group | Rows | '+used.join(' | ')+' |','| --- | --- | '+used.map(()=>'---').join(' | ')+' |');
for(const [name,rows] of all){
  const c=counts[name];
  L.push('| '+name+' | '+rows.length+' | '+used.map(k=>c[k]??0).join(' | ')+' |');
}
L.push('| All | '+all.reduce((n,[,r])=>n+r.length,0)+' | '+used.map(k=>Object.values(counts).reduce((n,c)=>n+(c[k]??0),0)).join(' | ')+' |');
if(links.countsBeforeRound2){const b=links.countsBeforeRound2;L.push('','Before round-2 linking (commit '+b.commit+'), all groups: '+used.map(k=>k+' '+(b[k]??0)).join(', ')+'.');}
L.push('','Status meaning: `open_no_repair_linked` no repair commit linked; `open_root_*` the finding links to a proposed SW root, with or without saved repair on that root, and the finding itself is not reconciled; `repair_saved_not_live_*` a repair commit exists after the live release, with or without a named regression test, not independently checked (partial, not fixed); `repair_live_*` the repair commit is inside the live release, but the item was still open in the 13 Oct plan or guard and is not certified; `originally_correct_watch` correct in the original review, watched for regression.','');
L.push('## System defects SW-01 to SW-57','','| ID | Defect | Cause | Tasks | Repair reference | Verification method | Named tests | Status |','| --- | --- | --- | --- | --- | --- | --- | --- |');
for(const s of ledger.sw)L.push('| '+[s.id,esc(s.description),esc(s.cause.cause),s.tasks.join(', '),commitsCell(s.repairReference),s.verificationMethod.kinds.join(', ')+': '+esc(s.guardRules),s.verificationMethod.namedTests.map(x=>x.replace('tests/','')).join(', ')||'none',s.boardStatus].join(' | ')+' |');
L.push('','Notes on linked repairs:','');
for(const [id,a] of [...Object.entries(links.sw),...Object.entries(links.f),...Object.entries(links.s)])L.push('- **'+id+'**: '+a.what+' Not covered: '+a.notCovered);
for(const [id,a] of Object.entries(links.relatedNotRepair))L.push('- **'+id+'** related, not a repair: '+a.commits.join(', ')+'. '+a.why);
L.push('','How links were found: '+links.idMentionSearch+' '+links.round2Search+' '+(links.round3Search??'')+' A commit marked "per-fix history" is on v/history1 only; the same change is in squashed commit 413524f5 on this branch.');
L.push('','Repairs saved with no SW row:','');
for(const a of links.withoutSwRow)L.push('- Rule '+a.rule+': '+a.what+' Commits '+a.commits.join(', ')+' (saved, not live). Tests: '+a.tests.join(', ')+'. '+a.why);
const fRef=f=>commitsCell(f.repairReference)+'; consultant root '+f.root+' step '+f.step;
L.push('','## Consultant items F01 to F61 (274 findings D-001 to D-266 and N-1 to N-8)','','| ID | Item | Findings | Root | Overlap | Repair reference | Verification method | Status |','| --- | --- | --- | --- | --- | --- | --- | --- |');
for(const f of ledger.f)L.push('| '+[f.id,esc(f.title),f.originalDefectIds.length,f.root,f.proposedSwOverlapIds.join(', ')||'none',fRef(f),f.verificationMethod.kinds.join(', ')+(f.verificationMethod.guardRules.length?' ('+f.verificationMethod.guardRules.join(', ')+')':''),f.boardStatus].join(' | ')+' |');
L.push('','Each F row keeps the consultant\'s expected check word for word in the ledger (`expectedSourceCheck`). Overlaps are proposed from titles and are unverified.','');
if(links.fNotCoveredRound8){
  const n=links.fNotCoveredRound8;
  L.push('### F rows not covered by any tested shared fix','',n.note,'');
  for(const [id,why] of Object.entries(n.rows)){
    const f=ledger.f.find(x=>x.id===id);
    if(!f)throw new Error('not-covered note for unknown F row '+id);
    if(f.repairReference.state==='commits')throw new Error('F row '+id+' is linked to a repair and listed as not covered');
    L.push('- **'+id+'** ('+f.boardStatus+'): '+why);
  }
  L.push('',links.round8Search??'','');
}
L.push('## S-items','','| ID | Repair reference | Verification method | Status |','| --- | --- | --- | --- |');
for(const s of ledger.s)L.push('| '+[s.id,commitsCell(s.repairReference)+'. '+s.repairReference.note,'expert review once defined',s.boardStatus].join(' | ')+' |');
L.push('','## Page findings (641, owner workbook sheet 04 ABB 641)','','Per-row repair reference and method are in the ledger. Summary by proposed SW root:','','| SW root | Findings | Root repair | Status of these findings |','| --- | --- | --- | --- |');
for(const s of ledger.sw.filter(x=>x.candidateAbbObservationIds?.length))L.push('| '+[s.id,s.candidateAbbObservationIds.length,commitsCell(s.repairReference),s.repairReference.commits.length?'open_root_repair_'+(s.repairReference.liveState==='live'?'live':'saved_not_live'):'open_root_not_repaired'].join(' | ')+' |');
const unm=ledger.abb.individualObservations.filter(a=>a.historicalVerdict==='Problem'&&!(a.proposedSwRootIds??[]).length);
L.push('| no root yet | '+unm.length+' | none yet (root mapping pending) | open_no_repair_linked |');
L.push('| originally correct | '+ledger.abb.historicalPasses+' | not needed | originally_correct_watch |','','A finding with two roots appears under both; overlaps are kept, never forced to one owner.','');
L.push('## Projects (rule V2)','','| Project | Test marking | Basis |','| --- | --- | --- |');
for(const p of ledger.projects)L.push('| '+[p.id,p.testMarking,p.basis].join(' | ')+' |');
L.push('','The product has a saved test-project flag and a separate test list (commits 2f5fc187 and 445e678d, live). SW-55 and check V2 stay open: the verifier still saw test data in the live portfolio at b3c76d6, the owner has not marked the projects, and V2 is still to add. This board does not mark live projects; marking is the owner action on the live system.','');
if(links.namedTestRun){const t=links.namedTestRun;L.push('## Named test run','','On '+t.when+', build '+t.build+': '+t.result+' ('+t.files.join(', ')+'). '+t.notRun+' A passing test proves only the case it names; it does not close the row.','');}
if(links.independentTools){const t=links.independentTools;L.push('## Independent calculators (T12)','',t.what+' Commits '+t.commits.join(', ')+'. Tests: '+t.tests.join(', ')+'.','');}
if(links.agentBranches){const a=links.agentBranches;L.push('## Saved on agent branches, not in this build','',a.note,'');for(const b of a.branches)L.push('- '+b.branch+': '+b.commits.map(c=>c.sha+' '+c.subject).join('; '));L.push('');}
L.push('## Still open with no repair linked','');
const stillOpen=[...ledger.sw,...ledger.f,...ledger.s].filter(x=>x.boardStatus==='open_no_repair_linked').map(x=>x.id);
L.push('Rows: '+stillOpen.join(', ')+'. Plus '+ledger.abb.individualObservations.filter(a=>a.boardStatus==='open_no_repair_linked').length+' page findings.','');
for(const [id,n] of Object.entries(links.stillOpenNotes??{}))L.push('- '+id+': '+n);
L.push('');
L.push('## Sources not in the repository','');
for(const x of ledger.board.sourcesNotInRepository)L.push('- '+x);
L.push('');
writeFileSync(join(root,'docs/repair-notes/CMeng_T01_Board.md'),L.join('\n'));
console.log(JSON.stringify(counts));
