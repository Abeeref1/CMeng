import {randomUUID} from 'node:crypto';
import type {AnalysisPlan,AnalysisResult,AskRequest,AskSession,AuthorityResult,NarrativeBlock,Presentation,ProjectScope,SavedView} from '../../project-ask/src/types';
import {AskError,resolveAskScopeType} from '../../project-ask/src/catalogue';
import {resolveIntent} from '../../project-ask/src/intent';
import {isSocial,socialReply,routeRequest,needsInterpretation} from '../../project-ask/src/router';
import {selectEvidence} from '../../project-ask/src/evidence';
import {chooseChart,queryTable,normalized} from '../../project-ask/src/primitives';
import {configuredAskModel,type AskModel} from '../../project-ask/src/provider';
import {createAskAuthorityCatalogue} from './ask-authorities';
import {AskStore,askHash,type ReferenceFile} from './ask-store';
import {runtimeProjects} from './project-state';
import {projectDataDate,projectControlSchedule} from './canonical-time-claims';
import {scheduleAuthorityReview} from './schedule-authority';
import {historicalAskAuthority} from './ask-history';
import {AuthorityBuilder} from './ask-authority-builder';
import {deliveryPosition} from './delivery-projections';
import {deliveryRecords} from './delivery-records';
import type {ProjectRuntimeState} from './project-state-types';

export const askCatalogue=createAskAuthorityCatalogue();
function diagnosisAnswer(result:AnalysisResult):NarrativeBlock|null{
  const section=result.sections.find(s=>s.authorityId==='project-diagnosis');if(!section)return null;
  const actions=section.tables.find(t=>t.id==='project-diagnosis.actions');
  const previews=(actions?.rows??[]).slice(0,result.presentation.detail==='short'?3:5).map(r=>String(r.activityId)+' — '+String(r.name)+'; '+String(r.reason??'')+(r.previousPredecessorSlippage?' Predecessor change: '+r.previousPredecessorSlippage+'.':'')+(r.linkedEvidence?' '+r.linkedEvidence:''));
  return {heading:result.plan.questionRecipe==='revision_change'?'What changed':result.plan.questionRecipe==='wbs_pressure'?'WBS pressure':result.plan.questionRecipe==='no_change_outlook'?'If nothing changes':'Project schedule analysis',text:section.explanation+(previews.length?'\n\n'+previews.join('\n'):'')+(result.plan.questionRecipe==='delay_diagnosis'?'\n\nThe ordered network, supporting activity lists and linked records are below.':''),classification:'calculated_intelligence',traceIds:section.traces.map(t=>t.id)};
}
function drivingPathAnswer(result:AnalysisResult):NarrativeBlock|null{
  const section=result.sections.find(s=>s.authorityId==='critical-path'),network=section?.tables.find(t=>t.id==='critical-path.network');if(!section||!network)return null;
  const links=section.tables.find(t=>t.id==='critical-path.relationships');
  const preview=(links?.rows??[]).slice(0,5).map(r=>r.predecessorActivityId+' → '+r.successorActivityId+' ('+r.type+', '+r.lagHours+' working hours lag)');
  return {heading:'Driving path to completion',text:section.explanation+'\n\n'+(preview.length?preview.join('\n'):'The maximum calculated finish is reached by the activity or parallel finish activities shown below.')+'\n\nThe ordered table gives names, WBS, dates, remaining hours, float and actual driving links. Adjacent rows may belong to parallel branches; the links show the sequence.',classification:'calculated_intelligence',traceIds:section.traces.map(t=>t.id)};
}
function completionAnswer(result:AnalysisResult):NarrativeBlock|null{
  const section=result.sections.find(s=>s.authorityId==='forecast');
  if(!section||result.sections.some(s=>['activities','critical-path'].includes(s.authorityId)))return null;
  const row=section.tables.find(t=>t.id==='forecast.position')?.rows[0];if(!row)return null;
  const date=(v:unknown)=>typeof v==='string'?v.slice(0,10):'not available';
  return {heading:'Completion position',text:'Submitted programme finish: '+date(row.submittedFinish)+'.\nCMeng calendar recalculation: '+date(row.calendarRecalculation)+(row.calculationState==='scenario'?' (with assumptions)':'')+'.\n'+section.explanation,
    classification:'calculated_intelligence',traceIds:section.traces.map(t=>t.id)};
}
function delayDriversAnswer(result:AnalysisResult):NarrativeBlock|null{
  if(!/\b(?:why|caus\w*|driv\w*|delaying|makes?|making)\b/i.test(result.plan.objective)||!result.sections.some(s=>s.authorityId==='activities'))return null;
  const path=result.sections.find(s=>s.authorityId==='critical-path'),pressure=result.sections.find(s=>s.authorityId==='float');
  const work=result.sections.find(s=>s.authorityId==='lookahead');
  const pathTable=path?.tables[0],activitySection=result.sections.find(s=>s.authorityId==='activities');
  const critical=(pathTable?.rows??[]).filter(r=>['not_started','in_progress'].includes(String(r.status)));
  const delayed=activitySection?.tables[0];
  const negative=pressure?.tables[0];
  const linked=(work?.tables[0]?.rows??[]).filter(r=>typeof r.linkedBlockers==='string'&&r.linkedBlockers!=='No confirmed linked blocker');
  let text=path&&path.state!=='unavailable'?'The programme identifies '+(pathTable?.selection?.matching??pathTable?.rows.length??0)+' '+(path.state==='established'?'calculated critical':'known source-float critical')+' activities in the requested scope'+(result.scope.dataDate?' at '+result.scope.dataDate.slice(0,10):'')+'.':'A critical-activity position is not available from the selected programme.';
  if(delayed&&activitySection?.state!=='unavailable')text+=' '+(delayed.selection?.matching??delayed.rows.length)+' activities show missed dates or baseline slippage.';
  if(negative&&pressure?.state!=='unavailable')text+=' '+(negative.selection?.matching??negative.rows.length)+' have negative float.';
  if(activitySection?.explanation.includes('No baseline has been confirmed'))text+=' No baseline has been confirmed, so delay against the original planned dates cannot be measured.';
  const rows=delayed?.selection?.ranked&&delayed.rows.length?delayed.rows:critical.length?critical:(delayed?.rows??[]);
  if(rows.length)text+='\n\nActivities to focus on:\n'+rows.slice(0,5).map(r=>String(r.activityId)+' — '+String(r.name)+'; finish '+String(r.plannedFinishIso??r.forecastFinishIso??r.currentFinishIso??'not available').slice(0,10)).join('\n')+'\nThe tables below show the matching populations and any requested selection.';
  if(linked.length)text+='\n\nConfirmed linked work blockers:\n'+linked.slice(0,5).map(r=>String(r.activityId)+' — '+String(r.linkedBlockers)).join('\n');
  else text+='\n\nNo specific linked work blocker is established in the available look-ahead records.';
  text+=' These are the schedule pressure points I can identify. A proven cause of project delay requires dated events tied to the controlling path; I cannot infer that from float alone.';
  return {heading:'What is putting completion under pressure',text,classification:'calculated_intelligence',traceIds:[...new Set([...(path?.traces??[]),...(pressure?.traces??[]),...(work?.traces??[])].map(t=>t.id))]};
}
function activityAnswer(result:AnalysisResult):NarrativeBlock|null{
  const section=result.sections.find(s=>['activities','float','critical-path'].includes(s.authorityId));
  if(!section||result.plan.groupBy.length)return null;
  const table=section.tables[0];if(!table)return null;
  const asOf=result.scope.dataDate?' as of '+result.scope.dataDate.slice(0,10):'';
  if(section.state==='unavailable')return {heading:'Answer',text:'I cannot list these activities yet because this project has no adopted programme available. Open Documents to review the programme upload.',classification:'project_fact',traceIds:[table.traceId]};
  const n=table.selection?.matching??table.rows.length,filters=result.plan.authorityFilters?.[section.authorityId]??[];
  const has=(field:string)=>filters.some(f=>f.field===field);
  const phrase=section.authorityId==='critical-path'?(section.state==='established'?'are critical in the calendar calculation':'have known critical float in the uploaded programme')
    :has('missedPlannedStart')?'should have started but have not':has('finishOverdue')?'have passed their finish date and are still unfinished'
    :has('scheduleDelayed')?'show a missed start, overdue finish or finish later than baseline':has('totalFloatHours')?'match your float limit'
    :result.plan.criticalOnly?'have critical float':has('floatRiskWatchlist')?'are in the float-risk band':'match your request';
  const verb=n===1?phrase.replace(/^are /,'is ').replace(/^have /,'has ').replace(/^show /,'shows ').replace(/^match /,'matches '):phrase;
  let text=n+' '+(n===1?'activity':'activities')+' '+verb+asOf+'.';
  const incompleteSelection=n===0&&(section.state==='partial'||table.state==='partial'||result.unresolved.some(g=>/float|critical|date|status|classification|coverage|missing|unconfirmed|unresolved/i.test(g)));
  if(n===0){
    if(incompleteSelection&&(has('totalFloatHours')||has('floatRiskWatchlist')||section.authorityId==='float'))text='No float-risk activity can be confirmed from the currently readable float data'+asOf+'. The float population is incomplete, so this is not confirmation that no float-risk activities exist.';
    else if(incompleteSelection&&section.authorityId==='critical-path')text='The finish-driving / critical-path population is not fully calculable from the current programme fields'+asOf+'. This is not confirmation that no critical path exists.';
    else text='No matching activities were found in the available programme records'+asOf+'.';
  }
  if(section.authorityId==='critical-path'&&section.state!=='established')text+=' The independent critical path is not yet confirmed; this is the programme’s known critical-activity list.';
  if(has('scheduleDelayed')||has('missedPlannedStart')||has('finishOverdue')){
    if(n===0)text=has('missedPlannedStart')?'No confirmed missed starts appear in the uploaded programme'+asOf+'.':has('finishOverdue')?'No unfinished activity is confirmed past its current forecast finish'+asOf+'.':'The uploaded programme shows no confirmed missed starts or overdue finishes'+asOf+'.';
    if(section.explanation.includes('No baseline has been confirmed'))text+=' No baseline has been confirmed, so I cannot measure delay against the original planned dates.';
    const pressure=result.sections.find(s=>s.authorityId==='float')?.tables[0],pressureCount=pressure?.selection?.matching??pressure?.rows.length??0;
    if(pressureCount)text+=' However, '+pressureCount+' '+(pressureCount===1?'activity has':'activities have')+' negative float, which shows pressure against schedule targets. These activities are listed separately below.';
    if(has('scheduleDelayed'))text+=' This does not establish the cause of any project delay.';
  }
  const missing=result.unresolved.map(g=>/(\d+) records lack (?:Missed Planned Start|Finish Overdue|Schedule Delayed)/i.exec(g)).find(Boolean);
  if(missing)text+=' '+missing[1]+(missing[1]==='1'?' activity still needs its':' activities still need their')+' dates or status checked.';
  else if(result.unresolved.some(g=>/lack |excluded|missing|unconfirmed/i.test(g)))text+=' Some records need review; the list contains the matches we can confirm.';
  const preview=table.rows.slice(0,result.presentation.detail==='short'?3:5).map(r=>String(r.activityId)+' — '+String(r.name??'Unnamed activity'));
  if(preview.length)text+='\n\n'+preview.join('\n')+(n>preview.length?'\nThe activity table below contains the rest.':'');
  const breakouts=section.tables.slice(1).filter(t=>t.id.includes('-breakout-'));
  if(breakouts.length)text+='\n\n'+breakouts.map(t=>t.title+': '+String(t.selection?.matching??t.rows.length)+' matching '+((t.selection?.matching??t.rows.length)===1?'activity':'activities')+'.').join('\n');
  return {heading:'Answer',text,classification:'calculated_intelligence',traceIds:[table.traceId,...breakouts.map(t=>t.traceId)]};
}
function plainAskNeed(value:string){
  const text=String(value||'').replace(/\s+/g,' ').trim();
  if(!text)return null;
  if(/AI commentary could not/i.test(text))return null;
  if(/baseline/i.test(text))return 'A confirmed baseline would add original-plan slippage and baseline variance to this answer.';
  if(/contract(?:ual)? completion|contract time basis/i.test(text))return 'A confirmed contractual completion date would add contract-date and time-entitlement comparisons.';
  if(/lead time|manufacturing duration|latest order/i.test(text))return 'Confirmed supplier or approved lead-time evidence would replace planning assumptions and allow firm latest-order dates.';
  if(/procurement|ordered|delivered|supplier|manufactur/i.test(text))return 'A current procurement/material register would add actual ordered, manufacturing and delivery status.';
  if(/installed|measured quantities|quantity progress|physical progress/i.test(text))return 'Dated measured or installed quantities would add actual quantity completion and installation progress.';
  if(/PV|EV|AC|CPI|SPI|earned value/i.test(text))return 'Time-phased PV, EV and AC would add formal EVM performance measures such as SPI and CPI.';
  if(/resource|manpower|labou?r|capacity/i.test(text))return 'Dated manpower/resource usage and capacity would add independent resource and manpower analysis.';
  if(/risk/i.test(text))return 'A dated risk register would add the Project’s confirmed risk status and ownership.';
  if(/location|zone|floor|tower|building|workfront/i.test(text))return 'A confirmed location/workfront mapping would strengthen location-based analysis where the source wording is ambiguous.';
  if(/date|status|field|mapping|link/i.test(text))return text
    .replace(/authority/gi,'basis')
    .replace(/governed/gi,'confirmed')
    .replace(/population/gi,'records')
    .replace(/source rows?/gi,'records')
    .replace(/applicable/gi,'relevant');
  return text
    .replace(/authority/gi,'basis')
    .replace(/governed/gi,'confirmed')
    .replace(/population/gi,'records')
    .replace(/schema|payload|resolver|provider|endpoint/gi,'')
    .replace(/\s+/g,' ')
    .trim();
}
function improvementNeedsFor(result:AnalysisResult){
  const raw=[...result.unresolved,...result.sections.filter(s=>s.state==='unavailable').map(s=>s.explanation)];
  const needs=raw.map(plainAskNeed).filter((v):v is string=>!!v);
  return [...new Set(needs)].slice(0,6);
}
function narrativeFor(result:AnalysisResult):NarrativeBlock[]{
  const ar=result.presentation.language==='ar';
  const allMetrics=result.sections.flatMap(s=>s.metrics),knownMetrics=allMetrics.filter(m=>m.value!==null);
  const metrics=knownMetrics.length?knownMetrics:allMetrics;
  const lines=metrics.slice(0,result.presentation.detail==='short'?6:18).map(m=>m.label+': '+(m.value===null?(ar?'غير مثبت':'Not established'):String(m.value)+(m.unit?' '+m.unit:''))+(m.state==='candidate'?' · candidate source, not governed':''));
  const direct=diagnosisAnswer(result)??drivingPathAnswer(result)??delayDriversAnswer(result)??activityAnswer(result)??completionAnswer(result);
  const blocks:NarrativeBlock[]=direct?[direct]:[{heading:ar?'الوضع الحالي':'Answer',text:lines.length?lines.join('\n'):result.sections.map(s=>s.tables.length?s.tables.reduce((n,t)=>n+(t.selection?.matching??t.rows.length),0)+' matching records in '+s.title+'.':s.title+': '+s.explanation).slice(0,8).join('\n'),classification:'calculated_intelligence',traceIds:metrics.slice(0,18).map(m=>m.traceId)}];
  if(direct&&result.sections.some(s=>!['activities','float','critical-path'].includes(s.authorityId))&&knownMetrics.length)blocks.push({heading:'Other project figures',text:lines.join('\n'),classification:'calculated_intelligence',traceIds:metrics.slice(0,18).map(m=>m.traceId)});
  const findings=result.sections.flatMap(s=>s.findings).filter(f=>f.severity==='action').sort((a,b)=>a.id.localeCompare(b.id));
  if(findings.length)blocks.push({heading:ar?'ما يحتاج الى اهتمام':'What requires attention',text:findings.slice(0,8).map(f=>f.title+': '+f.explanation).join('\n'),classification:'calculated_intelligence',traceIds:findings.slice(0,8).flatMap(f=>f.traceIds)});
  if(findings.length)blocks.push({heading:ar?'الاجراءات المقترحة':'Recommended actions',text:[...new Set(findings.map(f=>f.action))].slice(0,8).join('\n'),classification:'professional_guidance',traceIds:findings.slice(0,8).flatMap(f=>f.traceIds)});
  if(findings.length>8)blocks.push({heading:'Finding coverage',text:'The summary highlights 8 of '+findings.length+' findings. Every finding is retained in the detailed sections and exports; this summary is not a complete exception list.',classification:'calculated_intelligence',traceIds:[]});
  if(result.plan.kind==='analysis'&&!direct)blocks.push({heading:ar?'اساس التفسير':'Interpretation basis',text:ar?'تظهر الجداول الادلة المتاحة. الارتباط بين السجلات لا يثبت السببية دون روابط وادلة مؤرخة.':'The tables show the available evidence. Correlation across registers does not establish a cause without explicit links and dated supporting records.',classification:'professional_guidance',traceIds:[]});
  if(result.plan.kind==='draft')blocks.push({heading:'Draft management response',text:'Please reconcile the reported position against the attached CMeng tables and evidence gaps. Confirm the affected work scope, reporting dates, source records and proposed corrective actions before the next reporting cut-off. Any claim or entitlement requires the applicable contract terms and substantiated causal evidence.',classification:'professional_guidance',traceIds:[]});
  if(result.plan.kind==='proposal')blocks.push({heading:'Proposed change — review required',text:result.plan.objective+'\nNo project record has been changed. Review the current record, proposed value, reason and supporting evidence in its source module.',classification:'professional_guidance',traceIds:[]});
  return blocks;
}
function materialReconciliation(sections:AuthorityResult[]){
  const material=sections.find(s=>s.authorityId==='materials');if(!material)return;
  for(const table of material.tables)for(const r of table.rows){
    for(const [left,right,name]of[['delivered','ordered','Delivered above ordered'],['installed','required','Installed above BOQ requirement'],['accepted','delivered','Accepted above delivered']] as const){
      if(typeof r[left]!=='number'||typeof r[right]!=='number'||Number(r[left])<=Number(r[right]))continue;
      material.findings.push({id:'reconciliation:'+r.recordId+':'+left+':'+right,severity:'action',title:name,
        explanation:String(r.reference)+': '+r[left]+' compared with '+r[right]+' '+r.unit+'; difference '+(Number(r[left])-Number(r[right]))+'.',
        traceIds:[table.traceId],values:{reference:r.reference??null,left:r[left]!,right:r[right]!,difference:Number(r[left])-Number(r[right]),unit:r.unit??null},
        action:'Reconcile the linked BOQ scope and dated procurement records; retain both source values until reviewed.',owner:null,dueBasis:'Before relying on the next procurement position.'});
    }
  }
}
function referenceSection(scope:ProjectScope,files:ReferenceFile[],sections:AuthorityResult[]){
  const b=new AuthorityBuilder('reference-files','Attached reference documents','documents',scope,'candidate','Attachments are reference only. Their statements do not change governed project facts.');
  const metrics=sections.flatMap(s=>s.metrics);const excerpts:{filename:string;page:number;statement:string;sourceHash:string}[]=[];
  for(const file of files)for(const page of file.pages){
    const text=page.text;for(const line of text.split(/[\n\r]+/).filter(s=>s.trim())){
      excerpts.push({filename:file.filename,page:page.page,statement:line,sourceHash:file.hash});
      const match=/^\s*(CPI|SPI|physical progress|Data Date)\s*[:=,\t]\s*(\d+(?:\.\d+)?|\d{4}-\d{2}-\d{2})\s*%?\s*$/i.exec(line);
      if(!match)continue;const metric=metrics.find(m=>normalized(m.label).startsWith(normalized(match[1])));if(!metric||metric.value===null)continue;
      const assertion=/^\d{4}-/.test(match[2]!)?match[2]!:Number(match[2]);if(assertion!==metric.value)b.finding(file.id+':'+page.page+':'+metric.id,'Reference differs from CMeng',file.filename+', page '+page.page+': '+match[1]+' is '+assertion+'; CMeng reports '+metric.value+'.','Reconcile reporting date, units and scope. This difference does not authorize changing the official basis.',{submitted:assertion,cmeng:metric.value},[metric.traceId,b.trace(file.id+':'+page.page,'Reference only; page text, not a governed record.',[file.hash+':page:'+page.page],'candidate')]);
    }
  }
  b.table('excerpts','Reference excerpts',excerpts,'Extracted text only. OCR can misread text; review the source before relying on an assertion.');return b.result;
}
function applyScenario(state:ProjectRuntimeState,scope:ProjectScope,plan:AnalysisPlan){
  const b=new AuthorityBuilder('scenario','SCENARIO — NOT CURRENT PROJECT FACT','long-lead',scope,'scenario','A temporary calculation using the existing Delivery lifecycle engine. No project records are changed.');
  if(!plan.scenario){b.result.explanation='A supported numeric assumption is not established.';return b.result;}
  const clone=structuredClone(state),records=deliveryRecords(clone).records.filter(r=>r.kind==='package'&&['governed','verified'].includes(r.state)&&(!plan.scenario!.target||normalized(r.description).includes(plan.scenario!.target)));
  if(!records.length){b.result.explanation='No governed package matches the scenario target. No package has been invented.';return b.result;}
  const assumption=plan.scenario,days=assumption.unit==='weeks'?assumption.value*7:assumption.value;
  for(const record of records){const decision=clone.delivery?.decisions.filter(d=>d.recordId===record.recordId&&d.sourceRevision===record.revision).at(-1);if(decision)decision.fields={...record.fields,'manufacturing duration':days,'manufacturing day basis':'calendar days','manufacturing duration source':'Explicit user scenario assumption'};}
  clone.version++;const positions=deliveryPosition(clone),ids=new Set(records.map(r=>r.recordId));
  b.table('lead-time','Scenario procurement dates',positions.packageRows.filter(r=>ids.has(r.recordId)),'Existing Delivery backward scheduling with '+days+' calendar days manufacturing assumed. Missing lifecycle, calendar or programme links still withhold dates.');
  b.metric('manufacturing','Assumed manufacturing duration',days,'calendar days','User scenario assumption; not supplier-confirmed.',{state:'scenario'});return b.result;
}
export class ProjectAskEngine {
  constructor(readonly store=new AskStore(),private model:AskModel|null=configuredAskModel(),private getState=(id:string)=>runtimeProjects.get(id)){}
  scope(projectId:string,user:AskSession,request:AskRequest):{scope:ProjectScope;state:ProjectRuntimeState}{
    resolveAskScopeType(request.scopeType);const state=this.getState(projectId);if(!state)throw new AskError(404,'project_not_found','Open an existing project first.');
    if(request.pageContext&&request.pageContext.projectId!==projectId)throw new AskError(409,'page_project_changed','The project changed. Start the analysis from the current project page.');
    const review=scheduleAuthorityReview(state);return {state,scope:{scopeType:'project',projectId,projectName:projectId,workspaceId:user.workspaceId,userId:user.userId,projectVersion:state.version,dataDate:projectDataDate(state),authorityState:review.state,programmeRevision:projectControlSchedule(state)?.revision.revisionId??null,pageContext:request.pageContext??null}};
  }
  async ask(projectId:string,user:AskSession,request:AskRequest,view?:SavedView){
    if(typeof request.question!=='string'||!request.question.trim()||request.question.length>24000)throw new AskError(400,'question_required','Enter a question or report brief of up to 24,000 characters.');
    // Cheap project/session validation is retained for social messages, but no schedule or other producer is executed.
    if(isSocial(request.question)&&!view){
      resolveAskScopeType(request.scopeType);const state=this.getState(projectId);if(!state)throw new AskError(404,'project_not_found','Open an existing project first.');
      if(request.pageContext?.projectId&&request.pageContext.projectId!==projectId)throw new AskError(409,'page_project_changed','The project changed. Start from the current project page.');
      if(request.conversationId){const conversation=await this.store.conversation(request.conversationId,projectId,user);if(request.analysisId&&conversation.analysisIds.at(-1)!==request.analysisId)throw new AskError(409,'conversation_updated','This conversation has a newer answer.');}
      const intent=resolveIntent(request.question,[],user,null,null),result:AnalysisResult={schemaVersion:1,id:randomUUID(),conversationId:request.conversationId??randomUUID(),createdAt:new Date().toISOString(),
        scope:{scopeType:'project',projectId,projectName:projectId,workspaceId:user.workspaceId,userId:user.userId,projectVersion:state.version,dataDate:null,authorityState:'not_evaluated',programmeRevision:null,pageContext:request.pageContext??null},
        plan:{...intent.plan,authorities:[]},presentation:intent.presentation,mode:'Deterministic CMeng Summary',sections:[],narrative:[{heading:'Ask CMeng',text:socialReply(request.question),classification:'professional_guidance',traceIds:[]}],unresolved:[],referenceFiles:[],factsHash:askHash([]),snapshotHash:'',providerStatus:'not_needed',route:'social',
        telemetry:{route:'social',aiInvoked:false,authorities:[],retrievalRounds:0,retrievedRecords:0,calls:[],providerFailures:[],validationFailures:[],criticUsed:false}};
      result.snapshotHash=askHash({scope:result.scope,plan:result.plan});await this.store.saveResult(result,user);return result;
    }
    const {scope,state}=this.scope(projectId,user,request),catalogue=askCatalogue.available(user);
    let previous:AnalysisResult|null=null;
    if(request.conversationId){const conversation=await this.store.conversation(request.conversationId,projectId,user);const id=conversation.analysisIds.at(-1);if(request.analysisId&&id!==request.analysisId)throw new AskError(409,'conversation_updated','This conversation has a newer answer. Refresh it before adding another follow-up.');if(id)previous=await this.store.result(id,projectId,user);if(previous?.route==='social'){previous=null;for(const priorId of [...conversation.analysisIds].reverse()){const prior=await this.store.result(priorId,projectId,user);if(prior.route!=='social'){previous=prior;break;}}}}
    if(previous&&scope.pageContext&&previous.scope.pageContext?.page!==scope.pageContext.page)previous=null;
    const intent=resolveIntent(request.question,catalogue,user,scope.pageContext,previous);
    let plan=view?structuredClone(view.plan):intent.plan,presentation=view?structuredClone(view.presentation):intent.presentation;
    // A saved live view is recalculated against the latest Project position, but it must
    // retain the page scope that defined the view. The saved plan usually already carries
    // these filters; reapply only missing context filters so an older saved definition
    // cannot reopen visually scoped while recalculating the whole project.
    if(view&&scope.pageContext){
      const contextualFilters:AnalysisPlan['filters']=[
        ...Object.entries(scope.pageContext.filters).filter(([,value])=>Boolean(value)).map(([field,value])=>({field,operator:'eq' as const,value,upper:null})),
        ...([
          ['activityId',scope.pageContext.selectedActivity],
          ['wbsId',scope.pageContext.selectedWbs],
          ['location',scope.pageContext.selectedLocation],
          ['reference',scope.pageContext.selectedPackage],
        ] as const).filter(([,value])=>Boolean(value)).map(([field,value])=>({field,operator:'eq' as const,value:value!,upper:null})),
      ];
      for(const filter of contextualFilters)if(!plan.filters.some(existing=>existing.field===filter.field&&existing.operator===filter.operator&&String(existing.value)===String(filter.value)))plan.filters.push(filter);
    }
    const unresolved=[...intent.gaps,...(intent.purePresentation&&previous?previous.unresolved:[])];let providerStatus:AnalysisResult['providerStatus']=!this.model?'not_configured':!user.allowModel?'not_permitted':'not_needed';
    const route=routeRequest(request.question,plan,intent.purePresentation),interpret=needsInterpretation(route)&&plan.kind!=='proposal';
    const precise=!interpret&&!intent.purePresentation&&((plan.metricIds.length>0&&plan.authorities.every(id=>id==='evm'))||plan.authorities.every(id=>id==='programme')&&/data date|reporting date|تاريخ البيانات/i.test(request.question));
    if(!interpret)providerStatus='not_needed';
    if(request.attachmentIds){if(!Array.isArray(request.attachmentIds)||request.attachmentIds.length>8||request.attachmentIds.some(id=>typeof id!=='string'))throw new AskError(400,'invalid_attachments','Attach up to eight reference documents.');plan.attachmentIds=[...new Set(request.attachmentIds)];}
    const files:ReferenceFile[]=[];for(const id of plan.attachmentIds)files.push(await this.store.reference(id,projectId,user));
    let sections:AuthorityResult[]=[];
    if(intent.purePresentation&&previous&&!view){sections=structuredClone(previous.sections).filter(s=>s.authorityId!=='reference-files');if(files.length)sections.push(referenceSection(scope,files,sections));scope.dataDate=previous.scope.dataDate;scope.projectVersion=previous.scope.projectVersion;scope.programmeRevision=previous.scope.programmeRevision;scope.authorityState=previous.scope.authorityState;if(state.version!==scope.projectVersion)unresolved.push('This is the retained analysis snapshot. Re-run the analysis or open a saved live view for the latest position.');}
    else {
      for(const id of plan.authorities){const authority=askCatalogue.resolve(id,user);
        const result=plan.kind==='historical'&&plan.asOf!==scope.dataDate?historicalAskAuthority(state,scope,plan,authority):await authority.produce({state},scope,plan);
        if(result.state!=='established')unresolved.push(result.title+': '+result.explanation);
        for(const table of result.tables){
          if(plan.nextDays!==null||plan.deliveryBelowPercent!==null){
            if(result.authorityId==='materials'||result.authorityId==='procurement'||result.authorityId==='long-lead'){
              if(plan.nextDays!==null){if(!scope.dataDate){table.rows=[];unresolved.push('The adopted programme Data Date is needed for the look-ahead interval.');}else{const end=new Date(Date.parse(scope.dataDate)+plan.nextDays*86400000).toISOString().slice(0,10);const before=table.rows.length;table.rows=table.rows.filter(r=>typeof r.programmeNeedDate==='string'&&r.programmeNeedDate>=scope.dataDate!&&r.programmeNeedDate<=end);table.excluded+=before-table.rows.length;table.basis+=' Need dates between '+scope.dataDate+' and '+end+' inclusive.';}}
              if(plan.deliveryBelowPercent!==null){const before=table.rows.length;table.rows=table.rows.filter(r=>typeof r.deliveryCoveragePercent==='number'&&r.deliveryCoveragePercent<plan.deliveryBelowPercent!);table.excluded+=before-table.rows.length;table.basis+=' Delivery coverage below '+plan.deliveryBelowPercent+'%; missing denominators are excluded, not treated as zero.';}
            }
          }
        }
        const countGapTables=new Set<string>();
        const breakoutSources=result.authorityId==='activities'&&(plan.activityBreakouts?.length??0)>0?result.tables.map(table=>structuredClone(table)):[];
        // Diagnosis has already selected activities and their linked evidence together.
        // Reapplying WBS/activity filters to evidence rows (which lack those dimensions)
        // drops valid linked records and incorrectly invalidates the scoped count.
        const selectedDiagnosis=result.authorityId==='project-diagnosis'&&plan.diagnosisActivityFilters!==undefined&&['delay_diagnosis','wbs_pressure'].includes(plan.questionRecipe??'');
        const authorityPlan={...plan,groupBy:result.authorityId==='wbs'?plan.groupBy.filter(g=>g!=='wbsId'):plan.groupBy,filters:selectedDiagnosis?[]:[...plan.filters,...(plan.authorityFilters?.[result.authorityId]??[])]};
        if(authorityPlan.filters.length||plan.groupBy.length||plan.criticalOnly||plan.issuesOnly||plan.limit!==null||plan.nextDays!==null||plan.deliveryBelowPercent!==null||plan.countRows){
          result.tables=result.tables.map(table=>{const ranking=plan.rankings?.find(r=>r.authorityId===result.authorityId);let queryPlan=plan.rankings?.length?{...authorityPlan,rankBy:ranking?.field??null,rankDirection:ranking?.direction??'desc',limit:ranking?.limit??null}:authorityPlan;
            if(result.authorityId==='float'&&plan.authorityFilters?.activities?.some(f=>f.field==='scheduleDelayed'))queryPlan={...authorityPlan,rankBy:'totalFloatHours',rankDirection:'asc'};
            const queried=queryTable(table,queryPlan);unresolved.push(...queried.gaps);if(queried.gaps.length)countGapTables.add(queried.table.id);return queried.table;});
          if(authorityPlan.filters.length||plan.criticalOnly||plan.issuesOnly||plan.nextDays!==null||plan.deliveryBelowPercent!==null)result.metrics=result.metrics.map(m=>({...m,value:null,state:'unavailable',basis:m.basis+' The project total is not a valid KPI for this filtered subset; see the matching records.'}));
        }
        if(result.authorityId==='activities'&&plan.activityBreakouts?.length&&breakoutSources.length){
          const base=breakoutSources[0]!;
          for(const [index,breakout] of plan.activityBreakouts.entries()){
            const {activityBreakouts:_activityBreakouts,...planWithoutBreakouts}=plan;
            const breakoutPlan:AnalysisPlan={...planWithoutBreakouts,filters:[...breakout.filters],authorityFilters:{},groupBy:[],rankBy:null,rankings:[],limit:null,criticalOnly:false,issuesOnly:false};
            const queried=queryTable(base,breakoutPlan);
            unresolved.push(...queried.gaps);
            result.tables.push({...queried.table,id:base.id+'-breakout-'+index,title:breakout.label,basis:queried.table.basis+' This is an independent result set from the same full programme population; it is not intersected with the primary activity request.'});
          }
        }
        if(plan.countRows)for(const table of result.tables){const missing=countGapTables.has(table.id);result.metrics.push({id:table.id+'.matching-count',label:'Matching '+table.title+' records',value:missing||table.state==='unavailable'?null:table.selection?.matching??table.rows.length,unit:'records',state:missing?'unavailable':table.state,classification:'calculated_intelligence',traceId:table.traceId,basis:'Count after applying all requested filters to the full available population, before Top N selection. '+table.basis});}
        result.charts=presentation.charts?result.tables.map(t=>chooseChart(t,scope.dataDate)).filter((c):c is NonNullable<typeof c>=>c!==null):[];sections.push(result);
      }
      materialReconciliation(sections);
      if(precise&&/data date|reporting date|تاريخ البيانات/i.test(request.question))sections.forEach(s=>{s.metrics=s.metrics.filter(m=>m.id==='programme.dataDate');s.tables=[];});
      if(precise&&plan.metricIds.length)sections.forEach(s=>{const keys=[...plan.metricIds,...(plan.metricIds.includes('cpi')?['ev','ac']:[]),...(plan.metricIds.includes('spi')?['ev','pv']:[])];s.metrics=s.metrics.filter(m=>keys.some(id=>m.id.includes('.'+id))); s.tables=[];s.charts=[];});
      if(plan.kind==='scenario')sections.push(applyScenario(state,scope,plan));
      if(files.length)sections.push(referenceSection(scope,files,sections));
    }
    if(plan.kind==='historical')scope.dataDate=plan.asOf==='unresolved'?null:plan.asOf;
    sections.forEach(s=>s.charts=presentation.charts?s.tables.map(t=>chooseChart(t,scope.dataDate)).filter((c):c is NonNullable<typeof c>=>c!==null):[]);
    const result:AnalysisResult={schemaVersion:1,id:randomUUID(),conversationId:request.conversationId??randomUUID(),createdAt:new Date().toISOString(),scope,plan,presentation,sections,narrative:[],unresolved:[...new Set(unresolved)],mode:'Deterministic CMeng Summary',providerStatus,
      route,telemetry:{route,aiInvoked:false,authorities:sections.map(s=>s.authorityId),retrievalRounds:0,retrievedRecords:0,calls:[],providerFailures:[],validationFailures:[],criticUsed:false},
      referenceFiles:files.map(({id,filename,hash,state,reading})=>({id,filename,hash,state,reading})),factsHash:askHash(sections),snapshotHash:''};
    const references=files.flatMap(f=>f.pages.map(p=>({filename:f.filename,fileId:f.id,hash:f.hash,page:p.page,text:p.text})));
    result.coverage=selectEvidence(result,references).coverage;
    result.improvementNeeds=improvementNeedsFor(result);
    result.narrative=narrativeFor(result);
    for(const metric of sections.flatMap(s=>s.metrics).filter(m=>/\.cpi(?:-|$)/.test(m.id)&&typeof m.value==='number'&&m.value<1))result.narrative.push({heading:'Cost performance',text:'CPI below 1.00 indicates earned value is below actual cost on the stated currency and tax basis. This ratio alone does not establish the cause.',classification:'calculated_intelligence',traceIds:[metric.traceId]});
    if(this.model&&user.allowModel&&interpret&&!intent.purePresentation){
      try{const blocks=await this.model.explain(result,references);result.narrative.push(...blocks);result.mode='CMeng AI Analysis';result.providerStatus='available';}
      catch(error){result.providerStatus='failed';const code=error instanceof Error&&/^(MODEL|RETRIEVAL)_[A-Z_]+$/.test(error.message)?error.message:'MODEL_PROVIDER_UNAVAILABLE';if(!result.telemetry!.providerFailures.includes(code)&&!result.telemetry!.validationFailures.includes(code))result.telemetry!.providerFailures.push(code);result.unresolved.push('The AI explanation could not be completed. CMeng’s calculated tables, findings and figures remain available and unchanged.');}
    }
    if(!intent.purePresentation&&state.version!==scope.projectVersion)throw new AskError(409,'project_updated','The project changed while this analysis was being prepared. Run it again for a consistent position.');
    result.snapshotHash=askHash({scope:result.scope,plan:result.plan,sections:result.sections});await this.store.saveResult(result,user);return result;
  }
}
export function compactAskResult(result:AnalysisResult){return {...result,sections:result.sections.map(s=>({...s,tables:s.tables.map(t=>({...t,rows:t.rows.slice(0,50),returnedRows:Math.min(t.rows.length,50),totalRows:t.rows.length}))})),
  projectId:result.scope.projectId,answer:result.narrative.map(n=>n.heading+'\n'+n.text).join('\n\n'),managementActions:result.sections.flatMap(s=>s.findings.map(f=>f.action)).slice(0,12),
  relevantModules:result.sections.map(s=>({key:s.traces[0]?.module??s.authorityId,status:s.state==='established'?'ready':s.state==='unavailable'?'blocked':'partial'})),
  authority:'advisory_only',modelBacked:result.mode==='CMeng AI Analysis',governance:'Analysis and recommendations do not change the adopted project position. Attachments remain reference only.'};}
