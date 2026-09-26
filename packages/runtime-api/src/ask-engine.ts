import {randomUUID} from 'node:crypto';
import type {AnalysisPlan,AnalysisResult,AskRequest,AskSession,AuthorityResult,NarrativeBlock,Presentation,ProjectScope,SavedView} from '../../project-ask/src/types';
import {AskError,resolveAskScopeType} from '../../project-ask/src/catalogue';
import {resolveIntent} from '../../project-ask/src/intent';
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
function narrativeFor(result:AnalysisResult):NarrativeBlock[]{
  const ar=result.presentation.language==='ar';
  const metrics=result.sections.flatMap(s=>s.metrics).filter(m=>!result.plan.metricIds.length||result.plan.metricIds.some(id=>m.id.includes('.'+id)));
  const lines=metrics.slice(0,result.presentation.detail==='short'?6:18).map(m=>m.label+': '+(m.value===null?(ar?'غير مثبت':'Not established'):String(m.value)+(m.unit?' '+m.unit:''))+(m.state==='candidate'?' · candidate source, not governed':''));
  const blocks:NarrativeBlock[]=[{heading:ar?'الوضع الحالي':'Current position',text:lines.length?lines.join('\n'):result.sections.map(s=>s.title+': '+s.explanation).slice(0,8).join('\n'),classification:'calculated_intelligence',traceIds:metrics.slice(0,18).map(m=>m.traceId)}];
  const findings=result.sections.flatMap(s=>s.findings);
  if(findings.length)blocks.push({heading:ar?'ما يحتاج الى اهتمام':'What requires attention',text:findings.slice(0,8).map(f=>f.title+': '+f.explanation).join('\n'),classification:'calculated_intelligence',traceIds:findings.slice(0,8).flatMap(f=>f.traceIds)});
  if(findings.length)blocks.push({heading:ar?'الاجراءات المقترحة':'Recommended actions',text:[...new Set(findings.map(f=>f.action))].slice(0,8).join('\n'),classification:'professional_guidance',traceIds:findings.slice(0,8).flatMap(f=>f.traceIds)});
  if(result.plan.kind==='analysis')blocks.push({heading:ar?'اساس التفسير':'Why',text:ar?'تظهر الجداول الادلة المتاحة. الارتباط بين السجلات لا يثبت السببية دون روابط وادلة مؤرخة.':'The tables show the available evidence. Correlation across registers does not establish a cause without explicit links and dated supporting records.',classification:'professional_guidance',traceIds:[]});
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
    const text=page.text;for(const line of text.split(/[\n\r]+/).filter(s=>s.trim()).slice(0,100)){
      excerpts.push({filename:file.filename,page:page.page,statement:line.slice(0,1200),sourceHash:file.hash});
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
    const {scope,state}=this.scope(projectId,user,request),catalogue=askCatalogue.available(user);
    let previous:AnalysisResult|null=null;
    if(request.conversationId){const conversation=await this.store.conversation(request.conversationId,projectId,user);const id=conversation.analysisIds.at(-1);if(request.analysisId&&id!==request.analysisId)throw new AskError(409,'conversation_updated','This conversation has a newer answer. Refresh it before adding another follow-up.');if(id)previous=await this.store.result(id,projectId,user);}
    if(previous&&scope.pageContext&&previous.scope.pageContext?.page!==scope.pageContext.page)previous=null;
    const intent=resolveIntent(request.question,catalogue,user,scope.pageContext,previous);
    let plan=view?structuredClone(view.plan):intent.plan,presentation=view?structuredClone(view.presentation):intent.presentation;
    const unresolved=[...intent.gaps,...(intent.purePresentation&&previous?previous.unresolved:[])];let providerStatus:AnalysisResult['providerStatus']=!this.model?'not_configured':!user.allowModel?'not_permitted':'not_needed';
    const precise=/^(what is |what's |show )?(cpi|spi|ev|pv|ac|data date)\??$/i.test(request.question.trim());
    if(this.model&&user.allowModel&&!intent.purePresentation&&!precise&&!view&&plan.kind!=='historical'&&plan.kind!=='scenario'){
      try{plan=await this.model.plan(request.question,plan,catalogue);providerStatus='available';}catch{providerStatus='failed';unresolved.push('The AI interpreter is unavailable. The deterministic project analysis below remains usable.');}
    }
    if(request.attachmentIds){if(!Array.isArray(request.attachmentIds)||request.attachmentIds.length>8||request.attachmentIds.some(id=>typeof id!=='string'))throw new AskError(400,'invalid_attachments','Attach up to eight reference documents.');plan.attachmentIds=[...new Set([...plan.attachmentIds,...request.attachmentIds])];}
    const files:ReferenceFile[]=[];for(const id of plan.attachmentIds)files.push(await this.store.reference(id,projectId,user));
    let sections:AuthorityResult[]=[];
    if(intent.purePresentation&&previous&&!view){sections=structuredClone(previous.sections);scope.dataDate=previous.scope.dataDate;scope.projectVersion=previous.scope.projectVersion;scope.programmeRevision=previous.scope.programmeRevision;scope.authorityState=previous.scope.authorityState;if(state.version!==scope.projectVersion)unresolved.push('This is the retained analysis snapshot. Re-run the analysis or open a saved live view for the latest position.');}
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
        if(plan.filters.length||plan.groupBy.length||plan.criticalOnly||plan.issuesOnly||plan.limit!==null||plan.nextDays!==null||plan.deliveryBelowPercent!==null){
          result.tables=result.tables.map(table=>{const queried=queryTable(table,plan);unresolved.push(...queried.gaps);return queried.table;});
          if(plan.filters.length||plan.criticalOnly||plan.issuesOnly||plan.nextDays!==null||plan.deliveryBelowPercent!==null)result.metrics=result.metrics.map(m=>({...m,value:null,state:'unavailable',basis:m.basis+' The project total is not a valid KPI for this filtered subset; see the matching records.'}));
        }
        result.charts=presentation.charts?result.tables.map(t=>chooseChart(t,scope.dataDate)).filter((c):c is NonNullable<typeof c>=>c!==null):[];sections.push(result);
      }
      materialReconciliation(sections);
      if(precise&&/data date/i.test(request.question))sections.forEach(s=>{s.metrics=s.metrics.filter(m=>m.id==='programme.dataDate');s.tables=[];});
      if(precise&&plan.metricIds.length)sections.forEach(s=>{s.metrics=s.metrics.filter(m=>plan.metricIds.some(id=>m.id.includes('.'+id)));s.tables=[];s.charts=[];});
      if(plan.kind==='scenario')sections.push(applyScenario(state,scope,plan));
      if(files.length)sections.push(referenceSection(scope,files,sections));
    }
    if(plan.kind==='historical')scope.dataDate=plan.asOf==='unresolved'?null:plan.asOf;
    sections.forEach(s=>s.charts=presentation.charts?s.tables.map(t=>chooseChart(t,scope.dataDate)).filter((c):c is NonNullable<typeof c>=>c!==null):[]);
    const result:AnalysisResult={schemaVersion:1,id:randomUUID(),conversationId:request.conversationId??randomUUID(),createdAt:new Date().toISOString(),scope,plan,presentation,sections,narrative:[],unresolved:[...new Set(unresolved)],mode:'Deterministic CMeng Summary',providerStatus,
      referenceFiles:files.map(({id,filename,hash,state,reading})=>({id,filename,hash,state,reading})),factsHash:askHash(sections),snapshotHash:''};
    result.narrative=narrativeFor(result);
    if(this.model&&user.allowModel&&!precise&&!intent.purePresentation&&plan.kind!=='proposal'){
      try{const blocks=await this.model.explain(result,files.flatMap(f=>f.pages.map(p=>({filename:f.filename,page:p.page,text:p.text}))));result.narrative.push(...blocks);result.mode='CMeng AI Analysis';result.providerStatus='available';}
      catch{result.providerStatus='failed';result.unresolved.push('AI commentary is unavailable. The tables and calculations are the deterministic CMeng result.');}
    }
    if(!intent.purePresentation&&state.version!==scope.projectVersion)throw new AskError(409,'project_updated','The project changed while this analysis was being prepared. Run it again for a consistent position.');
    result.snapshotHash=askHash({scope:result.scope,plan:result.plan,sections:result.sections});await this.store.saveResult(result,user);return result;
  }
}
export function compactAskResult(result:AnalysisResult){return {...result,sections:result.sections.map(s=>({...s,tables:s.tables.map(t=>({...t,rows:t.rows.slice(0,50),returnedRows:Math.min(t.rows.length,50),totalRows:t.rows.length}))})),
  projectId:result.scope.projectId,answer:result.narrative.map(n=>n.heading+'\n'+n.text).join('\n\n'),managementActions:result.sections.flatMap(s=>s.findings.map(f=>f.action)).slice(0,12),
  relevantModules:result.sections.map(s=>({key:s.traces[0]?.module??s.authorityId,status:s.state==='established'?'ready':s.state==='unavailable'?'blocked':'partial'})),
  authority:'advisory_only',modelBacked:result.mode==='CMeng AI Analysis',governance:'Analysis and recommendations do not change the adopted project position. Attachments remain reference only.'};}
