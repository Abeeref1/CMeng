import test from 'node:test';
import assert from 'node:assert/strict';
import {delayClaimsAsOf} from '../packages/delay-analysis-core/src/reporting';
import {pageProjectResponse,recordDetailPage} from '../packages/runtime-api/src/response-paging';
import {withLinkedClaimFigures} from '../packages/runtime-api/src/project-fact-consumers';
import {runInNewContext} from './browser-context';

function fixture(){
 const date=(i:number)=>i<240?'2026-08-01':i<370?'2027-01-01':null;
 const source:any={projectId:'P',evidenceRevisionId:'CLAIMS-1',dataDateIso:'2026-08-31',noticeRequirements:[],diagnostics:[],
  events:Array.from({length:510},(_,i)=>({eventId:'E'+i,title:'Event '+i,startIso:date(i),endIso:null,relatedActivityIds:[],diagnostics:[],evidenceRefs:[]})),
  claims:Array.from({length:510},(_,i)=>({claimId:'C'+i,eventId:'E'+i,submittedAt:date(i),state:'submitted',claimedDays:i===0?0:1,assessedDays:null,claimedAmount:null,assessedAmount:null,evidenceRefs:[],diagnostics:i<240?['CLAIM_TOTAL_CONFLICT']:[]})),
  notices:Array.from({length:510},(_,i)=>({noticeId:'N'+i,kind:'notice',eventId:'E'+i,claimId:'C'+i,actualIssuedAt:date(i),actualReceivedAt:null,plannedAt:null,subject:'Notice '+i,clauseIdentifiers:[],evidenceRefs:[],diagnostics:[]}))};
 for(const [scope,count]of [['asOf',137],['future',83],['undated',91]] as const)for(let i=0;i<count;i++)source.notices.push({noticeId:'D-'+scope+'-'+i,kind:'determination',eventId:null,claimId:null,actualIssuedAt:scope==='asOf'?'2026-08-01':scope==='future'?'2027-01-01':null,subject:'Determination',diagnostics:[],evidenceRefs:[],clauseIdentifiers:[]});
 return source;
}
function screen(reporting:any){
 return {key:'notices-claims',projectVersion:8,data:{projectionKey:'notices_claims',claimCount:240,eventCount:240,claims:reporting.claims.asOf,events:reporting.events.asOf,
  claimsReporting:reporting,contractorClaimEvidenceSubmitted:true,delayEotEvidenceChain:{populationState:'established',linkOrder:['event'],rows:reporting.events.asOf.map((e:any)=>({eventId:e.eventId,title:e.title,links:[{key:'event',state:'established',value:e.eventId}]}))}}};
}
function context(page:any,kpis:any[]){return {currentModuleResult:page,data:page.data,r:page.data.claimsReporting,escapeHtml:String,fmt:String,humanizeKey:String,planningShortDate:String,readerText:String,planningKpis:(rows:any[])=>{kpis.push(...rows);return '';},experienceDisclosure:(_title:string,html:string)=>html};}

test('complete claim/notice cohorts and conflicts survive paging with determinations counted separately',()=>{
 const source=fixture(),before=JSON.stringify(source),reporting=delayClaimsAsOf(source,'2026-08-31'),full=screen(reporting),page=pageProjectResponse(full,'/api/projects/P/schedule/modules/notices-claims') as any;
 assert.deepEqual(reporting.noticeTypeCounts,{asOf:{claimNotices:240,determinations:137},future:{claimNotices:130,determinations:83},undated:{claimNotices:140,determinations:91}});
 assert.equal(reporting.reported.conflictingRowCount,240);assert.equal(reporting.reported.claimedDays.value,239);assert.equal(reporting.reported.assessedDays.value,null);
 assert.equal(page.data.claimsReporting.claims.asOf.length,25);assert.equal(page.data.claimsReporting.notices.asOf.length,25);assert.equal(page.data.claimsReporting.reported.conflictingRows.length,25);
 const kpis:any[]=[],ctx=context(page,kpis),html=runInNewContext("renderClaimsReporting(r,'notices-claims')",ctx);
 for(const [label,total]of [['Claims known by Data Date',240],['Claim notices by Data Date',240],['Determinations by Data Date',137],['Events evidenced by Data Date',240]])assert.equal(kpis.find(r=>r[0]===label)[1],total);
 assert.match(kpis.find(r=>r[0]==='Claim notices by Data Date')[2],/130 future · 140/);assert.match(kpis.find(r=>r[0]==='Determinations by Data Date')[2],/83 future · 91/);
 assert.match(html,/240 claims known by Data Date/);assert.match(html,/240 register conflicts/);assert.match(html,/Browse all register conflicts/);assert.match(html,/Showing 25 of 213 records/);assert.match(html,/Browse all claims without usable dates/);
 const last=recordDetailPage(full,'/data/claimsReporting/claims/undated',125) as any;assert.equal(last.total,140);assert.equal(last.rows.at(-1).claimId,'C509');
 assert.equal(JSON.stringify(source),before);
});

test('notice assessments, event details and evidence chains expose full totals and browse paths',()=>{
 const reporting=delayClaimsAsOf(fixture(),'2026-08-31'),full=screen(reporting),page=pageProjectResponse(full,'/api/projects/P/schedule/modules/notices-claims') as any;
 const kpis:any[]=[],ctx=context(page,kpis);
 const notices=runInNewContext('renderNoticesClaimsVisual(data)',ctx);assert.match(notices,/Review 240 notice assessments/);assert.match(notices,/Showing 25 of 240 assessments/);assert.match(notices,/Browse all notice assessments/);
 const chain=runInNewContext('renderDelayEvidenceChain(data)',ctx);assert.match(chain,/Showing 25 of 240 event chains/);assert.match(chain,/Browse all event evidence chains/);
 const events=runInNewContext('renderDelayClaimsVisual(data)',ctx);assert.equal(kpis.find(r=>r[0]==='Current delay events')[1],240);assert.equal(kpis.find(r=>r[0]==='Source delay-event rows')[1],510);assert.equal(kpis.find(r=>r[0]==='After Data Date')[1],130);assert.equal(kpis.find(r=>r[0]==='No dated event evidence')[1],140);
 assert.match(events,/Showing 25 of 240 event rows/);assert.match(events,/Browse all delay events/);
 const columns=runInNewContext('decisionColumns.claims.map(c=>c[1]).join(",")',ctx);assert.doesNotMatch(columns,/windowStartIso|windowEndIso|warning/);
 const windows=runInNewContext('decisionColumns.windows.map(c=>c[1]).join(",")',ctx);assert.match(windows,/windowStartIso/);assert.match(windows,/windowEndIso/);
});

test('missing cutoff and legacy paged subtype counts remain unknown, with source rows retained',()=>{
 const source=fixture(),reporting=delayClaimsAsOf(source,null),page=pageProjectResponse(screen(reporting),'/api/projects/P/schedule/modules/notices-claims') as any;
 const kpis:any[]=[],ctx=context(page,kpis),html=runInNewContext("renderClaimsReporting(r,'delay-claims')",ctx);
 for(const row of kpis)assert.equal(row[1],null,'no current dated cohort is established');
 assert.match(html,/reporting Data Date is not established/);assert.doesNotMatch(html,/Register position for 0 claims/);assert.match(html,/Claims outside a dated position/);
 assert.equal(reporting.claims.undated.length,510);assert.equal(reporting.notices.undated.length,821);
 const legacy=pageProjectResponse(screen(delayClaimsAsOf(source,'2026-08-31')),'/api/projects/P/schedule/modules/notices-claims') as any;delete legacy.data.claimsReporting.noticeTypeCounts;
 assert.equal(runInNewContext("claimsReportingNoticeCount(r,'asOf',true)",context(legacy,[])),null,'a partial preview cannot establish a subtype zero');
});

test('window lists expose full activity populations and preserve existing complete event counts',()=>{
 const ids=(n:number,prefix:string)=>Array.from({length:n},(_,i)=>prefix+i);
 const window=(i:number,n:number)=>({sequence:i,fromRevisionId:'R'+i,toRevisionId:'R'+(i+1),windowStartIso:'2026-08-01',windowEndIso:'2026-08-31',sourceForecastMovementDays:0,independentForecastMovementDays:null,progressMovementPercent:null,delayEventCount:n,delayEvents:ids(n,'E'),fromDrivingActivityIds:ids(130,'FROM'),toDrivingActivityIds:ids(140,'TO'),enteredCriticalActivityIds:[],exitedCriticalActivityIds:ids(131,'EXIT')});
 const full={key:'windows-analysis',data:{projectionKey:'windows_analysis',windowCount:2,completeWindowCount:2,partialWindowCount:0,associatedEventCount:240,windows:[window(1,119),window(2,121)]}},before=JSON.stringify(full);
 const page:any=pageProjectResponse(full,'/api/projects/P/schedule/modules/windows-analysis'),kpis:any[]=[];
 const html=runInNewContext('renderWindowsVisual(data)',{...context(page,kpis),planningSignedBars:()=>''});
 assert.match(html,/Finish-driving activities · 130 → 140/);assert.match(html,/Exited critical · first 25 of 131 activities/,'W7: the shared ID list says the shown and true counts in its summary');assert.doesNotMatch(html,/EXIT0, EXIT1/,'W7: no inline line of IDs');assert.match(html,/Browse all exited critical activities/);
 assert.match(html,/119 temporally associated/);assert.match(html,/121 temporally associated/);assert.equal(kpis.find(r=>r[0]==='Window-associated events')[1],240);
 const last:any=recordDetailPage(full,'/data/windows/1/exitedCriticalActivityIds',125);assert.equal(last.total,131);assert.equal(last.rows.at(-1),'EXIT130');
 assert.equal(JSON.stringify(full),before);
});

test('compacted event rows retain all eight evidence links and complete canonical claim facts',()=>{
 const keys=['event','notice','activity','window','impact','responsibility','eot','determination'];
 const facts:any={claims:{pipeline:{rows:Array.from({length:300},(_,i)=>({claimId:'C'+i,state:'submitted',claimedDays:i===299?88.125:1,assessedDays:i===299?0:null}))}}};
 // The server attaches each event's linked claim figures from the same canonical facts (F61).
 const full={key:'delay-claims',data:{...withLinkedClaimFigures({projectionKey:'delay_claims',eventCount:240,claimCount:300,contractorClaimEvidenceSubmitted:true,
  events:Array.from({length:240},(_,i)=>({eventId:'E'+i,title:'Event '+i,linkedClaimIds:['C'+(299-i)]}))},facts),
  projectFacts:facts,
  delayEotEvidenceChain:{populationState:'established',linkOrder:keys,rows:Array.from({length:240},(_,i)=>({eventId:'E'+i,links:keys.map(key=>({key,state:key==='eot'?'established':'missing',value:key==='eot'?0:null}))}))}}};
 const before=JSON.stringify(full),page:any=pageProjectResponse(full,'/api/projects/P/schedule/modules/delay-claims',1);
 assert.equal(page.data.events.length,1,'the tightest screen budget is exercised');
 // F61: the claim list grows with the register, so it is paged like every other
 // fact list (first 25 rows, true total, pointer). The figures the page shows
 // for each event travel on the event itself; the rendered values below are unchanged.
 assert.equal(page.data.projectFacts.claims.pipeline.rows.length,25);
 assert.equal(page.responsePaging.tables.find((t:any)=>t.pointer==='/data/projectFacts/claims/pipeline/rows').total,300,'canonical claim facts keep their true total');
 assert.equal((recordDetailPage(full,'/data/projectFacts/claims/pipeline/rows',299) as any).rows[0].claimedDays,88.125,'every claim stays reachable');
 assert.equal(page.data.delayEotEvidenceChain.rows.length,1);assert.equal(page.data.delayEotEvidenceChain.rows[0].links.length,8,'one chain is not a paged record population');
 assert.equal(page.data.delayEotEvidenceChain.rows[0].links.find((l:any)=>l.key==='eot').value,0);
 const html=runInNewContext('renderDelayClaimsVisual(data)',context(page,[]));assert.match(html,/<td>submitted<\/td><td>88.125<\/td><td>0<\/td><td>0<\/td>/);
 page.data.delayEotEvidenceChain.rows[0].links=page.data.delayEotEvidenceChain.rows[0].links.filter((l:any)=>l.key!=='eot');
 const missing=runInNewContext('renderDelayClaimsVisual(data)',context(page,[]));assert.match(missing,/<td>submitted<\/td><td>88.125<\/td><td>0<\/td><td>Not established<\/td>/);assert.doesNotMatch(missing,/No dated award/);
 assert.equal(JSON.stringify(full),before);
});
