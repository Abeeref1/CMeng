import {programmeTaskReviewBasis} from './programme-task-review';
import {overlapProposalFor} from './eot-overlap-proposal';
import {countText} from './count-text';
import {handoverSourceComparison} from './handover-source-review';
import {locationReviewBasis} from './location-review';
import {scheduleScopeClassification} from './schedule-scope-classification';
import {milestoneReviewBasis} from './milestone-review';
import {hseReportPosition} from './hse-report-evidence';
import {documentClassificationForReview,documentClassificationChoices} from './document-identification';
import {sourceTables,controlIssueField} from '../../truth-kernel/src';
import {riskReviewBasis,eotOverlapReview,contractValueReview,reportingTimeBasis} from './source-review-decisions';
import {procurementDateBasis} from './procurement-date-basis';
import {commercialCanonical,registerTaxBasisDefault} from './commercial-canonical';
import type {CanonicalCommercialModel} from './commercial-canonical';
import {noticeReviewBasis,contractFactDecisionItemsForState} from './notice-review';
import {completionDecisionItem} from './contract-fact-decisions';
import {operationalControlsAsOf} from './operational-reporting';
import {commercialSourceReadConflicts} from './evidence-control-adapters';
import {sourceAnalyticalCandidateIds} from './operational-reporting';
import {deliveryCurrentRecord} from './delivery-records';
import {pmcRoleOwner} from './action-priority';
import {contractCompletionPosition} from './contract-completion';
import {missingValueInputKind,missingValueInputGroup,openMissingValueInputs} from './missing-value-inputs';
import {commencementDatePosition,COMMENCEMENT_NOT_STATED} from './contract-time-reader';
import {missingFieldSupply,type MissingFieldSupply} from './missing-field-supply';
import {boqPageReviewPendingCount} from './boq-page-review';
import {projectReviewGroup} from './project-review-groups';
import {boqNumericReview} from './boq-numeric-review';
import {projectControlSchedule,canonicalTimeClaims,projectDataDate} from './canonical-time-claims';
import {createHash} from 'node:crypto';
import {cachedIndependentForecast} from './forecast-cache';
import {calendarBasisFingerprint,savedCalendarBasis,shorthandCalendars,calendarBasisStatement} from './calendar-basis';
import {reviewScheduleCalendarBasis} from './schedule-calendar-review';
import {buildForecastReconciliationGate} from './forecast-control';
import type {ControlIssueAssessment,ControlIssue,ControlIssueMember} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';
import {scheduleAuthorityReview} from './schedule-authority';
import {phaseProgrammeState} from './phase-programmes';
import {deliveryPosition} from './delivery-projections';
import {deliveryLabels,deliveryKinds} from '../../delivery-core/src/types';
import {titleForModule} from './registry';
import {deliveryPages} from '../../delivery-core/src/registry';

export interface ProjectAction {
  id:string;category:'confirmation'|'review'|'follow_up'|'information';title:string;reason:string;recordCount:number;
  owner?:string|null;dueIso?:string|null;priorityBasis?:unknown;
  resolution?:{
    kind:'confirm'|'choose'|'upload'|'information';
    requiresUserAction:boolean;
    instruction:string;
    completionRule:string;
  };
  target:{type:'schedule'|'document'|'delivery'|'module'|'upload'|'inline';label:string;documentId?:string;revisionId?:string;phaseId?:string;canConfirm?:boolean;moduleKey?:string;kind?:string;population?:boolean;reviewChoice?:string|null;noticeCandidates?:ReturnType<typeof noticeReviewBasis>['candidates'];noticeSourceKeys?:string[];reviewActivityIds?:string[];reviewLocationsText?:string;reviewMatrixText?:string;reviewDateIso?:string|null;reviewInputType?:'date'|'choice_only';reviewAdditionalDays?:number|null;reviewedRates?:{trir:number|null;ltifr:number|null;trirBasisHours:number|null;ltifrBasisHours:number|null};reviewReference?:string|null;reviewOptions?:Array<{value:string;label:string}>;uploadHint?:string;uploadMode?:'schedule'|'evidence';sourceHash?:string;scheduleRole?:string;needsPurpose?:boolean;approvalRequired?:boolean;suggestedDateIso?:string|null;relationshipOptions?:Array<{value:'new_record'|'replacement'|'amendment';label:string}>;relationshipTargets?:Array<{documentId:string;filename:string;familyKey:string;basisState:string}>};
  issue?:ControlIssue;requestCount?:number;findingIds?:string[];findings?:ControlIssue[];affectedPages?:string[];completionPosition?:unknown;
  correctionRecords?:Array<{source:string;locator:string;documentId?:string;sourceHash?:string}>;
  missingFields?:Array<{field:string;file:string;owner:string;fieldIdentity?:string;headings?:string[];supply?:MissingFieldSupply}>;
  evidenceSummary?:string[];reviewFingerprint?:string;reviewSourceRefs?:string[];
}
const identity=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
/** A finding's id is hashed from machine data only (kind, code, raw field,
 * raw evidence paths, modules and source references), never from its display
 * summary or wording, so a reworded label keeps the same id. */
/** One original finding of a combined request, seen with its own heading,
 * field, pages, paths and references. Used to place and list it; the request
 * itself stays one finding. */
const memberView=(issue:ControlIssue,member:ControlIssueMember):ControlIssue=>{
  const rest:ControlIssue={...issue};delete rest.field;
  return {...rest,summary:member.summary,...(member.detail!==undefined?{detail:member.detail}:{}),moduleKeys:member.moduleKeys,evidencePaths:member.evidencePaths,sourceRefs:member.sourceRefs,...(member.field!==undefined?{field:member.field}:{})};
};
export const actionFindingId=(issue:ControlIssue)=>identity([issue.kind,issue.code,controlIssueField(issue),
  [...issue.evidencePaths].sort(),[...issue.moduleKeys].sort(),[...issue.sourceRefs].sort()]);
type ReviewGroup=ReturnType<typeof projectReviewGroup>;
/** Only original SHA-bound evidence for this project may be opened from an
 * action. A foreign or absent reference never becomes a synthetic link. */
export function actionSourceCorrectionRecord(state:ProjectRuntimeState,ref:string){
 const document=state.evidenceDocuments.find(d=>ref==='evidence-document:'+d.documentId||
   ref.startsWith('evidence-document:'+d.documentId+':'));
 const locator=ref.match(/:(row|page|pdf_page):([\d]+)/);
 return {source:document?.sourceFilename??'Retained source record',
  locator:locator?(locator[1]==='row'?'Row ':'Page ')+locator[2]:'Source section',
  ...(document?{documentId:document.documentId,sourceHash:document.sourceHashSha256}:{})};
}


/** Resolve filenames only from the same exact, project-owned document identity
 * used for an action's SHA-bound source link. An ID mentioned inside a different
 * document ID, issue description or unrelated reference is not source proof. */
export function actionSourceFilenames(state:ProjectRuntimeState,refs:readonly string[]):string[]{
  const files:string[]=[];
  const seen=new Set<string>();
  for(const ref of refs){
    const record=actionSourceCorrectionRecord(state,ref);
    if(!record.documentId||seen.has(record.documentId))continue;
    seen.add(record.documentId);
    files.push(record.source);
  }
  return files;
}

function informationResolution(instruction:string):Pick<ProjectAction,'category'|'resolution'|'target'>{
  return {category:'information',resolution:{kind:'information',requiresUserAction:false,instruction,completionRule:'No user action is required. CMeng will refresh this information automatically when the underlying project evidence or calculation changes.'},target:{type:'inline',label:'Why this is not an action'}};
}
function uploadResolution(label:string,hint:string,instruction:string,uploadMode:'schedule'|'evidence'='evidence'):Pick<ProjectAction,'category'|'resolution'|'target'>{
  return {category:'review',resolution:{kind:'upload',requiresUserAction:true,instruction,completionRule:'This action closes automatically after the uploaded evidence establishes or corrects the required basis.'},target:{type:'upload',label,uploadHint:hint,uploadMode}};
}
function actionResolution(group:ReviewGroup,issues:ControlIssue[],context:{completionPosition?:unknown}={}):Pick<ProjectAction,'category'|'resolution'|'target'>{
  const conflict=issues.some(i=>['source_conflict','data_quality'].includes(i.kind));
  switch(group.key){
    case 'schedule-calculation':
      return informationResolution('CMeng found a difference between submitted dates and its independent calculation. This is a calculation qualification, not something you must confirm. The submitted programme remains the reporting authority unless you explicitly replace it.');
    case 'programme-comparison':
      return informationResolution('A baseline or earlier adopted revision is needed only for baseline/revision comparison. Current programme analysis remains usable. Any uploaded programme that actually needs selection appears separately as a direct programme confirmation action.');
    case 'contract-completion': {
      const completion=context.completionPosition as {submittedFinishIso?:string|null}|undefined;
      const suggestedDateIso=typeof completion?.submittedFinishIso==='string'?completion.submittedFinishIso:null;
      return {
        category:'confirmation',
        resolution:{
          kind:'confirm',
          requiresUserAction:true,
          instruction:suggestedDateIso
            ? 'Confirm the contractual completion date here. The current programme finish is shown only as a suggested candidate; change it if the contract date is different.'
            : 'Enter and confirm the contractual completion date here. Programme and forecast analysis remain available while this date is unconfirmed.',
          completionRule:'This action closes when a contractual completion date is explicitly confirmed.'
        },
        target:{type:'inline',kind:'contract-completion',label:'Confirm contractual completion date',suggestedDateIso}
      };
    }
    // T04 / C2: a missing value the user can supply gets its own input here.
    case 'contract-value-entry':
      return {category:'confirmation',resolution:{kind:'confirm',requiresUserAction:true,
        instruction:'Enter the contract value and its currency here if you hold them. They are saved as your confirmation; nothing is calculated from an unknown value.',
        completionRule:'This action closes when a contract value and currency are saved, or when a source establishes them.'},
        target:{type:'inline',kind:'contract-value',label:'Save contract value'}};
    case 'approved-eot-days-entry':
      return {category:'confirmation',resolution:{kind:'confirm',requiresUserAction:true,
        instruction:'Enter the total approved extension of time in days here if you hold it, including zero when none is approved. It is saved as your confirmation.',
        completionRule:'This action closes when approved EOT days are saved, or when a source establishes them.'},
        target:{type:'inline',kind:'approved-eot-days',label:'Save approved EOT days'}};
    case 'notice-term-versions':
      return {category:'confirmation',resolution:{kind:'choose',requiresUserAction:true,instruction:'Review the original notice periods and dates, then confirm whether the amendment applies prospectively.',completionRule:'The choice is stored against the same contract documents.'},target:{type:'inline',kind:'review-notice',label:'Confirm notice provisions',reviewOptions:[{value:'confirm_versions',label:'Confirm the dated notice provisions'},{value:'refer_contracts',label:'Refer the interpretation to the Contracts Manager'}]}};
    case 'risk-rating-rule':
      return {category:'confirmation',resolution:{kind:'choose',requiresUserAction:true,instruction:'Choose whether to preserve the supplied ratings, or enter an approved score-to-rating matrix.',completionRule:'The chosen treatment is stored with its source version.'},target:{type:'inline',kind:'review-risk',label:'Confirm risk rating basis',reviewOptions:[{value:'keep_source_ratings',label:'Keep the ratings entered in the register'},{value:'enter_matrix',label:'Enter the project risk rating matrix'}]}};
    case 'programme-logic':
      return {category:'follow_up',resolution:{kind:'upload',requiresUserAction:false,instruction:'Planning Engineer: correct the duplicate IDs or invalid programme links and then reissue the programme.',completionRule:'A valid programme revision replaces the affected source.'},target:{type:'upload',label:'Upload planner-corrected programme',uploadHint:'Revised programme',uploadMode:'schedule'}};
    case 'procurement-date-check':
      return {category:'follow_up',resolution:{kind:'information',requiresUserAction:false,instruction:'Procurement Manager: check package need dates, forecast deliveries and linked programme work in the procurement register.',completionRule:'Recheck the updated procurement register.'},target:{type:'module',moduleKey:'procurement-packages',label:'Review affected procurement records'}};
    case 'register-date-check':
      return {category:'follow_up',resolution:{kind:'information',requiresUserAction:false,instruction:'Design and Quality Managers: reconcile dates of the records closed before they were raised.',completionRule:'Recheck the corrected register.'},target:{type:'module',moduleKey:'delivery-design',label:'Review affected design records'}};
    case 'resources':
      return group.available&&conflict
        ? uploadResolution('Upload corrected resource evidence','Corrected manpower/resource plan, usage or capacity record','Upload the corrected resource/manpower source that resolves the conflicting or invalid record.')
        : informationResolution('Resource capacity/manpower evidence is optional for schedule analysis. Add it only when you need manpower or capacity calculations.');
    case 'quantities':
      return group.available&&conflict
        ? uploadResolution('Upload corrected quantity evidence','Corrected BOQ / measured quantity source','Upload the corrected BOQ or measurement source that resolves the conflicting quantity basis.')
        : informationResolution('Quantity evidence is optional for schedule analysis. Add BOQ/measurements only when you need quantity-based progress.');
    case 'productivity':
      return group.available&&conflict
        ? uploadResolution('Upload corrected productivity evidence','Corrected quantity / production-rate evidence','Upload the corrected dated quantity or production-rate source.')
        : informationResolution('Productivity evidence is optional. Add it only when you need an independent productivity forecast.');
    case 'risks':
      return conflict
        ? uploadResolution('Upload corrected risk register','Corrected dated risk register','Upload the corrected risk register that resolves the highlighted rating/date conflict.')
        : informationResolution('No user action is required for an unavailable optional risk field. CMeng will use the risk information that is actually established.');
    case 'hse':
      return conflict
        ? uploadResolution('Upload corrected HSE evidence','Corrected dated HSE / exposure record','Upload the corrected HSE source that resolves the highlighted date, status or exposure conflict.')
        : informationResolution('No user action is required for unavailable optional HSE information.');
    case 'quality':
      return conflict
        ? uploadResolution('Upload corrected quality evidence','Corrected NCR / inspection register','Upload the corrected quality register that resolves the highlighted lifecycle/date conflict.')
        : informationResolution('No user action is required for unavailable optional quality information.');
    case 'design-permits':
      return conflict
        ? uploadResolution('Upload corrected design / permit evidence','Corrected RFI, design or permit register','Upload the corrected source that resolves the highlighted design/permit record conflict.')
        : informationResolution('No user action is required for unavailable optional design or permit information.');
    case 'claims':
      return conflict
        ? uploadResolution('Upload corrected claim / notice evidence','Corrected claim, notice, delay-event or determination evidence','Upload the corrected dated source that resolves the highlighted claim/notice/event conflict.')
        : informationResolution('Missing claim/notice evidence limits entitlement analysis but does not block the established programme position.');
    case 'payments':
      return conflict
        ? uploadResolution('Upload corrected payment evidence','Corrected IPC / payment / retention register','Upload the corrected payment source that resolves the highlighted amount, date or series-basis conflict.')
        : informationResolution('Missing optional payment fields remain unavailable; no user action is required unless you need that commercial measure.');
    case 'commercial':
      return conflict
        ? uploadResolution('Upload corrected commercial evidence','Corrected contract / variation / bond / insurance / cost source','Upload the corrected commercial source that resolves the highlighted conflict.')
        : informationResolution('Missing optional commercial information remains unavailable; it does not require a user confirmation.');
    case 'programme-information':
      return conflict
        ? uploadResolution('Upload corrected programme','Corrected current programme','Upload a corrected programme if the source itself is wrong. CMeng will not ask you to manually repair source schedule fields in another page.','schedule')
        : informationResolution('The programme does not establish this optional field. CMeng will keep the measure unavailable rather than ask you to invent it.');
    default:
      return conflict
        ? uploadResolution('Upload corrected evidence','Corrected source evidence','Upload the corrected source that resolves this conflict. CMeng will recalculate automatically.')
        : informationResolution('No direct user decision is required for this item.');
  }
}

export function programmeActions(state:ProjectRuntimeState):ProjectAction[]{
  const items:ProjectAction[]=[];
  for(const [phaseId,scope]of [[null,state],...(state.phaseProgrammes??[]).map(p=>[p.phaseId,phaseProgrammeState(state,p.phaseId)])] as Array<[string|null,ProjectRuntimeState]>){
    const review=scheduleAuthorityReview(scope),prefix=phaseId?'Phase '+phaseId+': ':'';
    const add=(revisionId:string,documentId:string,filename:string,canConfirm:boolean,reason:string,current=false,inUse=false)=>{
      const stored=scope.schedules.find(r=>r.revision.revisionId===revisionId),model=stored?.revision.model;
      const source=scope.evidenceDocuments.find(d=>d.documentId===documentId);
      const missingDate=!model?.dataDateIso;
      const hashMismatch=!!stored&&!!source&&stored.sourceHashSha256!==source.sourceHashSha256;
      if(!canConfirm&&(missingDate||hashMismatch)){
        items.push({id:'schedule:'+identity([phaseId,revisionId]),category:'review',title:prefix+'Replace unreadable reporting programme',
          reason:filename+'. '+reason+' '+(model?model.activities.length+' activities recognised; Data Date '+(model.dataDateIso??'not supplied')+'.':''),
          recordCount:1,resolution:{kind:'upload',requiresUserAction:true,instruction:'Upload a corrected current programme here. CMeng will process it and use it only after the source is valid.',completionRule:'The action closes when a valid reporting programme is established.'},
          target:{type:'upload',label:'Upload corrected programme',uploadHint:'Corrected current programme',uploadMode:'schedule',...phaseId?{phaseId}:{}}});
        return;
      }
      const needsPurpose=!canConfirm;
      // M13.1: confirming a schedule CMeng already uses changes no figure: it is information, still confirmable.
      items.push({id:'schedule:'+identity([phaseId,revisionId]),category:inUse?'information':'confirmation',title:prefix+(current?'Confirm the schedule used for reporting':'Confirm the uploaded schedule'),reason:filename+'. '+reason+' '+(model?model.activities.length+' activities recognised; Data Date '+(model.dataDateIso??'not supplied')+'.':''),
        recordCount:1,
        resolution:{kind:needsPurpose?'choose':'confirm',requiresUserAction:!inUse,instruction:needsPurpose?'Choose the programme purpose here and provide an approval reference only if you select a baseline. Then CMeng will make the programme current in the same action.':'Confirm here that CMeng should use this programme for the current reporting position.',completionRule:'The action closes when the programme is explicitly selected as the reporting basis.'},
        target:{type:'schedule',label:needsPurpose?'Confirm purpose and use programme':'Use this programme for reporting',revisionId,documentId,canConfirm,
          ...((source?.sourceHashSha256??stored?.sourceHashSha256)?{sourceHash:(source?.sourceHashSha256??stored?.sourceHashSha256)!}:{}),
          scheduleRole:stored?.role??'update',needsPurpose,
          approvalRequired:needsPurpose&&['baseline','revised_baseline'].includes(stored?.role??''),...phaseId?{phaseId}:{}}});
    };
    if(review.state==='pending_review'&&review.currentRevisionId&&review.documentId){
      const revision=scope.schedules.find(r=>r.revision.revisionId===review.currentRevisionId)!;
      const canConfirm=!!review.dataDateIso&&!(revision.roleConfirmed&&['baseline','revised_baseline'].includes(revision.role)&&!revision.approvalReference?.trim());
      const inUse=projectControlSchedule(scope)?.revision.revisionId===review.currentRevisionId;
      add(review.currentRevisionId,review.documentId,revision.sourceFilename??revision.revision.label??'Selected schedule',canConfirm,
        inUse?'CMeng is already using this schedule. Confirming it records your reporting selection; no figure changes.':canConfirm?'Confirm that CMeng should use this schedule for reporting. Until then it is not used.':'Confirm its programme purpose and approval basis here before CMeng makes it current.',true,inUse);
    }
    for(const p of review.pendingSchedules)add(p.revisionId,p.documentId,p.filename,p.canAdopt,p.adoptionBlocker??(review.currentRevisionId?'This upload has not replaced the current reporting schedule.':'Choose the schedule to use for project reporting.'));
    if(review.state==='missing'&&!review.pendingSchedules.length)items.push({id:'schedule-missing:'+identity(phaseId),category:'review',title:prefix+'Add a reporting schedule',reason:'A schedule is needed to establish the reporting date and programme results.',recordCount:0,
      resolution:{kind:'upload',requiresUserAction:true,instruction:'Upload the current reporting programme here. CMeng will process it and establish the schedule position.',completionRule:'The action closes when a valid reporting programme is uploaded and selected.'},
      target:{type:'upload',label:'Upload reporting programme',uploadHint:'Current reporting programme',uploadMode:'schedule',...phaseId?{phaseId}:{}}});
  }
  return items;
}
/** Whether an uploaded document asks the user how it updates the project (the
 * "Confirm how this document updates the project" decision in Actions required). */
function documentDecisionAsked(state:ProjectRuntimeState,d:ProjectRuntimeState['evidenceDocuments'][number],usedInAnalysis:ReadonlySet<string>,hasRecordConflict:()=>boolean):boolean{
  if(d.category==='schedule'||!['candidate','active','additive'].includes(d.basisState))return false;
  const saved=d.relationshipDecision;
  const decided=Boolean(saved&&saved.sourceHash&&saved.sourceHash===d.sourceHashSha256&&(!saved.targetDocumentId||state.evidenceDocuments.some(t=>t.documentId===saved.targetDocumentId&&t.sourceHashSha256===saved.targetSourceHash)));
  const explicitReplacement=d.uploadIntent==='replace_current_basis'&&d.basisState==='active';
  // T04: no approval request for a clear fact. A unique, clearly read
  // candidate that is already used in analysis (labelled not formally
  // adopted) asks nothing unless it disagrees with a record (real conflict).
  const clearFact=d.basisState==='candidate'&&usedInAnalysis.has(d.documentId)&&!saved&&!hasRecordConflict();
  // M3.3: once CMeng has placed a file (active or additive), a "needs review" flag from upload time asks nothing more.
  void explicitReplacement;
  return !decided&&!clearFact&&(d.basisState==='candidate'||Boolean(saved));
}
/** A1: the page where each uploaded candidate document is reviewed and approved.
 * A schedule is confirmed (or replaced) and any other document's relationship is
 * chosen in the shared Actions required list; a clear candidate that analysis
 * already uses asks no decision there and is reached only in the document library. */
export const ACTIONS_REVIEW_PAGE='source-quality';
export function candidateDocumentReviewPages(state:ProjectRuntimeState):Map<string,string>{
  const pages=new Map<string,string>();
  const candidates=state.evidenceDocuments.filter(d=>d.basisState==='candidate');
  if(!candidates.length)return pages;
  for(const action of programmeActions(state))if(action.target.documentId)pages.set(action.target.documentId,ACTIONS_REVIEW_PAGE);
  const usedInAnalysis=sourceAnalyticalCandidateIds(state.evidenceDocuments);
  let conflicts:ReturnType<typeof commercialSourceReadConflicts>|null=null;
  for(const d of candidates){
    if(pages.has(d.documentId))continue;
    if(documentDecisionAsked(state,d,usedInAnalysis,()=>(conflicts??=commercialSourceReadConflicts(state)).some(c=>c.documentId===d.documentId)))pages.set(d.documentId,ACTIONS_REVIEW_PAGE);
  }
  return pages;
}
export function projectActions(state:ProjectRuntimeState,assessment:ControlIssueAssessment,context:{completionPosition?:unknown}={}){
  const programmeItems=programmeActions(state);
  const actions=programmeItems.filter(a=>a.category!=='information');
  const classificationInformation:ProjectAction[]=programmeItems.filter(a=>a.category==='information');
  const uncertainTables=new Map(sourceTables(state.evidenceDocuments.filter(d=>d.identification?.needsReview),[],{includeHistorical:true}).map(t=>[t.document.documentId,t]));
  for(const document of state.evidenceDocuments){
    if(document.category==='schedule'||['superseded','scenario'].includes(document.basisState))continue;
    const table=uncertainTables.get(document.documentId);
    const classification=documentClassificationForReview(document,table?[table.headers,...table.rows.slice(0,3).map(row=>table.headers.map(header=>row.cells[header]??''))]:undefined);
    const saved=document.classificationDecision?.sourceHash===document.sourceHashSha256?document.classificationDecision:null;
    if(!classification.reviewRequired&&!saved)continue;
    const choices=documentClassificationChoices(document);
    const item:ProjectAction={id:'classification:'+document.documentId,category:saved?'information':'confirmation',title:'Review document type: '+document.sourceFilename,
      reason:classification.reason??'Check the retained source before selecting its document type.',recordCount:1,
      reviewFingerprint:identity([document.documentId,document.sourceHashSha256,document.documentType,document.category]),reviewSourceRefs:['evidence-document:'+document.documentId],
      evidenceSummary:['Recorded type: '+document.documentType,'Reader confidence: '+(document.identification?.confidence??'not established'),'Original reader type: '+(document.identification?.detectedDocumentType??'not established')],
      resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Check the source, confirm or correct its type, and record your review reference. Type selection does not adopt, approve or replace the document.',completionRule:'The source-bound classification decision is retained and can be edited here.'},
      target:{type:'inline',kind:'review-document-classification',documentId:document.documentId,sourceHash:document.sourceHashSha256,label:'Record document type review',reviewChoice:saved?.documentType??classification.documentType,
        reviewReference:saved?.reference??null,reviewOptions:choices.map(choice=>({value:choice.documentType,label:choice.documentType.replaceAll('_',' ')}))}};
    (saved?classificationInformation:actions).push(item);
  }
  const numericReview=boqNumericReview(state);
  if(numericReview.pendingCount)actions.push({id:'boq-numeric-review',category:'review',title:'Review BOQ readings together',
    reason:countText(numericReview.pendingCount,'item reading remains','item readings remain')+' to check across '+countText(numericReview.sources.filter(s=>s.pendingCount).length,'source')+'. '+countText(numericReview.automaticCount,'native row needs','native rows need')+' no numeric confirmation; '+countText(numericReview.confirmedCount,'reviewed row is','reviewed rows are')+' already saved.',
    recordCount:numericReview.pendingCount,resolution:{kind:'choose',requiresUserAction:true,
      instruction:'Open one review, check the source and save the reviewed rows together. Each decision is reused in quantities, reports and Ask.',
      completionRule:'Only unresolved readings remain in this action; accepted readings are not requested again.'},
    target:{type:'inline',kind:'boq-numeric-review',label:'Review BOQ readings'}});
  const pendingPageCount=numericReview.pendingCount?0:boqPageReviewPendingCount(state);
  if(pendingPageCount)actions.push({id:'boq-page-review',category:'review',title:'Check BOQ source pages',
    reason:pendingPageCount+' source pages still need their complete item list checked.',recordCount:pendingPageCount,
    resolution:{kind:'choose',requiresUserAction:true,instruction:'Compare each source page with its items, correct missing or combined items and save the page review.',completionRule:'Every required source page has a saved completeness decision.'},
    target:{type:'inline',kind:'boq-numeric-review',label:'Review BOQ source pages'}});
  // T04: a commercial record read from an unadopted source that disagrees with
  // the adopted record (or with another unadopted source) is decided here, at
  // the one source-bound document decision, naming the unadopted source.
  const commercialConflicts=commercialSourceReadConflicts(state);
  const fileOf=(id:string)=>state.evidenceDocuments.find(t=>t.documentId===id)?.sourceFilename??id;
  // Clear, unique candidates the shared rule already uses in analysis.
  const usedInAnalysis=sourceAnalyticalCandidateIds(state.evidenceDocuments);
  // One choosable decision per commercial record whose adopted value differs
  // from an unadopted source: keep adopted, use the source value, type your
  // own; change or undo later. Saved in reviewDecisions (kept after restart).
  // T04: a saved decision (category information) goes to the information list.
  // The register publishes only open decisions as actions; confirm-review also
  // searches the information list, so change and undo stay reachable.
  const savedContractDecisions:ProjectAction[]=[];
  for(const key of [...new Set(commercialConflicts.filter(c=>c.against==='adopted'&&c.decisionKey).map(c=>c.decisionKey!))]){
    const group=commercialConflicts.filter(c=>c.decisionKey===key),first=group[0]!,saved=first.decision??null;
    const label=first.kind.replace(/([A-Z])/g,' $1').toLowerCase();
    (saved?savedContractDecisions:actions).push({id:'matter:'+key,category:saved?'information':'confirmation',title:'Choose the '+label+' value for '+first.recordId,owner:'Commercial Manager',recordCount:group.length,
      reason:'The adopted record ('+first.againstDocumentIds.map(fileOf).join('; ')+') differs from '+group.map(c=>fileOf(c.documentId)).join('; ')+', a source that is not formally adopted. The adopted value is used until you decide.',
      evidenceSummary:[...group.map(c=>'Unadopted source: '+fileOf(c.documentId)),...(saved?['Saved decision: '+saved+(first.enteredValue!=null?' ('+first.enteredValue+')':'')]:[])],
      resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Keep the adopted value, use the value read from the unadopted source, or enter your own'+(first.numericField?' '+first.numericField:'')+'. You can change or undo this later.',completionRule:'The choice is saved, kept after restart and updates every page.'},
      target:{type:'inline',kind:'review-commercial-record',label:'Choose value',reviewChoice:saved,reviewOptions:[{value:'keep_adopted',label:'Keep the adopted value'},
        ...group.map(c=>({value:'use_source:'+c.documentId,label:'Use the value read from '+fileOf(c.documentId)})),
        ...(first.numericField?[{value:'enter_value',label:'Enter my own '+first.numericField}]:[]),...(saved?[{value:'undo',label:'Undo my decision'}]:[])]},
      ...(first.fingerprint?{reviewFingerprint:first.fingerprint}:{}),reviewSourceRefs:[...new Set(group.flatMap(c=>[...c.sourceRefs,...c.againstSourceRefs]))]});
  }
  // T04: contract terms whose read values disagree, or whose reading is unsure,
  // are decided here with both values, their sources and the effect: pick a
  // read value, enter your own, change or undo. One shared reader applies it.
  {
    // T04 (a): the contractual completion date, same decision place and controls.
    const item=completionDecisionItem(state);
    if(item){
      const saved=item.decision,describeDate=(c:typeof item.candidates[number])=>c.date+(c.documentIds.length?' from '+c.documentIds.map(fileOf).join('; '):'')+(c.userConfirmed?' (confirmed by user)':c.adopted?' (adopted)':' (read from source; not formally adopted)');
      // A saved decision stays reachable (change or undo) in the information list.
      (saved?savedContractDecisions:actions).push({id:'matter:'+item.key,category:saved?'information':'confirmation',title:'Choose the contractual completion date',owner:'Contracts Manager',recordCount:item.candidates.length,
        reason:(item.reason==='sources_disagree'?'The sources state different contractual completion dates: '+item.candidates.map(describeDate).join(' versus ')+'.':'The contractual completion date is read as '+item.candidates.map(describeDate).join(' versus ')+', but the amendment applicability is unresolved.')+
          ' Effect: the chosen date drives the completion position, EOT, delay damages, notices, Ask and downloads.',
        evidenceSummary:[...item.candidates.map(c=>'Read value: '+describeDate(c)),...(saved?['Saved decision: '+(saved.choice==='enter_value'?'your own date '+saved.enteredDateIso:'the date '+saved.choice.slice(4))+'. Not formally adopted.']:[])],
        resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Pick one of the dates or enter your own. You can change or undo this later.',completionRule:'The choice is saved, kept after restart and updates every page.'},
        target:{type:'inline',kind:'review-contract-fact',label:'Choose date',reviewChoice:saved?.choice??null,reviewInputType:'date',reviewOptions:[
          ...item.candidates.map(c=>({value:'use:'+c.date,label:'Use '+describeDate(c)})),{value:'enter_value',label:'Enter my own date'},...(saved?[{value:'undo',label:'Undo my decision'}]:[])]},
        reviewFingerprint:item.fingerprint,reviewSourceRefs:[...new Set(item.candidates.flatMap(c=>c.sourceRefs))]});
    }
  }
  for(const item of contractFactDecisionItemsForState(state)){
    const saved=item.decision;
    const describe=(c:typeof item.candidates[number])=>c.value+' '+c.unit+' from '+c.documentIds.map(fileOf).join('; ')+(c.adopted?' (adopted)':' (read from source; not formally adopted)');
    const savedText=saved?(saved.choice==='enter_value'?'your own value '+saved.enteredValue+' '+item.enterUnit:'the read value '+(item.candidates.find(c=>'use:'+c.valueKey===saved.choice)?.value??'')+' '+(item.candidates.find(c=>'use:'+c.valueKey===saved.choice)?.unit??'')):'';
    (saved?savedContractDecisions:actions).push({id:'matter:'+item.key,category:saved?'information':'confirmation',title:'Choose the contract '+item.label,owner:'Contracts Manager',recordCount:item.candidates.length,
      reason:(item.reason==='sources_disagree'?'The contract sources state different values for the '+item.label+(item.dataDateIso?' in force at '+item.dataDateIso:'')+': '+item.candidates.map(describe).join(' versus ')+'.':'The '+item.label+' is read as '+item.candidates.map(describe).join(' versus ')+', but the amendment applicability is unresolved.')+
        ' Effect: until you decide, the '+item.label+' stays unresolved on every page (commercial, notices, delay damages, Ask and downloads).',
      evidenceSummary:[...item.candidates.map(c=>'Read value: '+describe(c)),...(saved?['Saved decision: '+savedText+'. Not formally adopted.']:[])],
      resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Pick one of the read values'+(item.enterUnit?' or enter your own ('+item.enterUnit+')':'')+'. You can change or undo this later.',completionRule:'The choice is saved, kept after restart and updates every page.'},
      target:{type:'inline',kind:'review-contract-fact',label:'Choose value',reviewChoice:saved?.choice??null,reviewOptions:[
        ...item.candidates.map(c=>({value:'use:'+c.valueKey,label:'Use '+describe(c)})),
        ...(item.enterUnit?[{value:'enter_value',label:'Enter my own value ('+item.enterUnit+')'}]:[]),...(saved?[{value:'undo',label:'Undo my decision'}]:[])]},
      reviewFingerprint:item.fingerprint,reviewSourceRefs:[...new Set(item.candidates.flatMap(c=>c.sourceRefs))]});
  }
  for(const d of state.evidenceDocuments){
    if(d.category==='schedule'||!['candidate','active','additive'].includes(d.basisState))continue;
    const recordConflicts=commercialConflicts.filter(c=>c.documentId===d.documentId).map(c=>(c.against==='adopted'?'Differs from adopted ':'Differs from another unadopted source for ')+
      c.kind.replace(/([A-Z])/g,' $1').toLowerCase()+' record '+c.recordId+(c.againstDocumentIds.length?' ('+c.againstDocumentIds.map(fileOf).join('; ')+')':'')+
      '; unadopted source '+d.sourceFilename+(c.against==='adopted'?'. The adopted value is kept until you decide.':'. Both readings are held until you decide.'));
    if(documentDecisionAsked(state,d,usedInAnalysis,()=>recordConflicts.length>0)){
      {
        const targets=state.evidenceDocuments.filter(t=>t.documentId!==d.documentId&&['active','additive'].includes(t.basisState));
        const sameFamily=targets.filter(t=>t.familyKey===d.familyKey);
        const baseContracts=targets.filter(t=>t.familyKey==='contract:base');
        const options:Array<{value:'new_record'|'replacement'|'amendment';label:string}>=[{value:'new_record',label:'New record'},...(sameFamily.length?[{value:'replacement' as const,label:'Replacement'}]:[]),...(d.documentType==='contract_amendment'&&baseContracts.length?[{value:'amendment' as const,label:'Contract amendment'}]:[])];
        const proposed=(d.lineage?.predecessorDocumentIds??[]).map(id=>state.evidenceDocuments.find(t=>t.documentId===id)?.sourceFilename??id);
        const competingCandidates=state.evidenceDocuments.filter(t=>t.documentId!==d.documentId&&t.basisState==='candidate'&&
          t.familyKey&&t.familyKey===d.familyKey);
        const peerNames=competingCandidates.map(t=>t.sourceFilename);
        actions.push({id:'document:'+d.documentId,category:'confirmation',title:'Confirm how this document updates the project',reason:competingCandidates.length
          ?'This source family has '+(competingCandidates.length+1)+' unselected documents. Compare each source before selecting which record becomes current. A candidate cannot be combined with another candidate or treated as an official approval.'
          :d.sourceFilename+'. Choose once; CMeng will apply the relationship and refresh the project.',recordCount:1,
          evidenceSummary:['Source type: '+d.documentType.replaceAll('_',' '),'Current source state: '+d.basisState,
            ...(peerNames.length?['Competing retained candidate(s): '+peerNames.join('; ')]:[]),
            ...recordConflicts,
            ...(proposed.length?['Reader-proposed predecessor: '+proposed.join('; ')]:[])],
          resolution:{kind:'choose',requiresUserAction:true,instruction:'Choose how this uploaded document relates to the current project evidence.',completionRule:'The action closes immediately after the relationship is saved.'},
          // M3.3: pre-filled with CMeng's reading (a later file of the same family replaces it; an amendment amends).
          target:{type:'document',documentId:d.documentId,label:'Confirm relationship',sourceHash:d.sourceHashSha256,relationshipOptions:options,
            reviewChoice:options.some(o=>o.value==='amendment')?'amendment':options.some(o=>o.value==='replacement')&&['revision_snapshot','full_replacement'].includes(String(d.lineage?.effect))?'replacement':'new_record',
            relationshipTargets:targets.filter(t=>t.familyKey===d.familyKey||d.documentType==='contract_amendment'&&t.familyKey==='contract:base').map(t=>({documentId:t.documentId,filename:t.sourceFilename,familyKey:t.familyKey,basisState:t.basisState}))}});
      }
    }
  }
  const delivery=deliveryPosition(state);
  for(const kind of deliveryKinds){const records=delivery.records.filter(r=>r.kind===kind&&!['superseded','scenario'].includes(r.state));if(!records.length)continue;
    const pending=records.filter(r=>!deliveryCurrentRecord(r)),moduleKey=deliveryPages.find(p=>p[3]===kind)?.[0]??'delivery-control';
    if(pending.length){/* Candidate/stale Delivery rows remain supporting information; no page-loop action is created. */}
    else if(delivery.populations[kind]?.state!=='established'&&populationBlockers(state,delivery,kind)){
      // M4.1: confirming completeness alone would not give a percentage; the real blocker is named instead.
      const blocker=populationBlockers(state,delivery,kind)!;
      actions.push({id:'delivery-population:'+kind,category:'review',title:'Add the missing dates and statuses in the '+deliveryLabels[kind]+' register',owner:'Project Controls',recordCount:blocker.count,
        reason:'Percentages for this register need '+blocker.text+'. Confirming the register complete would not change that.',
        resolution:{kind:'upload',requiresUserAction:true,instruction:'Add the missing dates or statuses in the register and upload it again.',completionRule:'The item closes when every current record has a date and a status at the Data Date.'},
        target:{type:'upload',label:'Upload the corrected register',uploadHint:deliveryLabels[kind]+' register with dates and statuses',uploadMode:'evidence'}});
    }
    else if(delivery.populations[kind]?.state!=='established')actions.push({id:'delivery-population:'+kind,category:'confirmation',title:'Confirm the complete '+deliveryLabels[kind]+' register',reason:countText(records.length,'usable source record is','usable source records are')+' available. Confirm only if these are all the applicable records, so percentages can be reported.',recordCount:records.length,
      resolution:{kind:'confirm',requiresUserAction:true,instruction:'Confirm here that the register is complete. If it is not complete, do nothing; CMeng will keep percentages unconfirmed.',completionRule:'The action closes as soon as the register is confirmed complete.'},
      target:{type:'delivery',kind,moduleKey,population:true,label:'Confirm complete register'}});
  }
  const groups=new Map<string,{group:ReturnType<typeof projectReviewGroup>;issues:ControlIssue[]}>();
  const systemItems=assessment.issues.filter(i=>i.owner==='CMeng'||['system_defect','verification_pending'].includes(i.kind));
  // A missing value the user can supply is its own input matter only while no
  // source or confirmation holds it; once held, its findings group as before.
  const openInputs=openMissingValueInputs(state);
  for(const issue of assessment.issues){
    if(systemItems.includes(issue))continue;
    if(/PROGRAMME_ADOPTION|CURRENT_PROGRAMME_ADOPTION|SCHEDULE_ADOPTION/.test(issue.code)&&actions.some(a=>a.target.type==='schedule'))continue;
    // One distinct problem is one request in one matter, so request counts
    // count distinct problems. A combined request keeps every original as a
    // member (pages, source references, fields and actions), so nothing of
    // either original is lost by counting it once.
    const inputKind=missingValueInputKind(issue);
    const group=inputKind&&openInputs.has(inputKind)?missingValueInputGroup(inputKind):projectReviewGroup(issue,state),existing=groups.get(group.key);
    if(existing){existing.issues.push(issue);existing.group.available ||= group.available;}else groups.set(group.key,{group,issues:[issue]});
  }
  const heldCommercial=commercialCanonical(state);
  const heldAdvanceBonds=(heldCommercial.bonds??state.controls.bonds).filter(b=>/advance/i.test(String(b.kind??(b as any).type??(b as any).bondType??'')+' '+b.bondId));
  const dataDate=projectControlSchedule(state)?.revision.model.dataDateIso?.slice(0,10)??null;
  const heldCertificates=heldCommercial.payments.filter(p=>p.certificationDate&&dataDate&&p.certificationDate.slice(0,10)<=dataDate&&
   !/^(applied|application|draft|submitted)$/i.test(p.sourceStatus)&&p.amounts.grossCertifiedAmount.value!==null);
  const information:ProjectAction[]=[...classificationInformation,...savedContractDecisions];
  // C11: CMeng's own activity links for register records, reviewed in one place.
  // Clear links are already used on every page; only unclear matches ask a choice.
  {
    const linked=delivery.records.filter(r=>!['superseded','scenario'].includes(r.state)&&r.activityLink);
    const proposed=linked.filter(r=>r.activityLink!.state==='proposed'),unclear=linked.filter(r=>r.activityLink!.state==='ambiguous');
    if(proposed.length||unclear.length){
      const by=(basis:string)=>proposed.filter(r=>r.activityLink!.basis===basis).length;
      const bases=([['cited_activity_id','a cited activity ID'],['wbs_code','a stated WBS code'],['name_match','a clear name match']] as const).filter(([basis])=>by(basis)>0).map(([basis,label])=>by(basis)+' by '+label);
      const first=(unclear[0]??proposed[0])!,moduleKey=deliveryPages.find(p=>p[3]===first.kind)?.[0]??'delivery-control';
      const item:ProjectAction={id:'delivery-activity-links',category:unclear.length?'confirmation':'information',owner:'Planning Engineer',
        title:'Check CMeng\'s activity links for register records',
        reason:(proposed.length?countText(proposed.length,'register record is','register records are')+' linked to programme activities by CMeng ('+bases.join('; ')+'). These links are used on every page now. ':'')+
          (unclear.length?countText(unclear.length,'record matches','records match')+' several activities equally and stays unlinked until you choose.':''),
        recordCount:proposed.length+unclear.length,
        evidenceSummary:[...unclear.slice(0,10).map(r=>(r.reference??r.recordId)+': '+r.activityLink!.candidates.map(c=>c.activityId+(c.name?' ('+c.name+')':'')).join(' or ')),
          ...proposed.slice(0,10).map(r=>(r.reference??r.recordId)+' to '+r.links.activityIds.join(', ')+': '+r.activityLink!.reason)],
        resolution:{kind:'choose',requiresUserAction:unclear.length>0,instruction:'Open the record, confirm or correct its activity link and save the review. A reviewed link stays through new register revisions.',
          completionRule:'Reviewed links leave this list; only CMeng proposals and unclear matches remain.'},
        target:{type:'module',moduleKey,label:'Review activity links'}};
      (unclear.length?actions:information).push(item);
    }
  }
  const noticeBasis=noticeReviewBasis(state),noticeVersions=noticeBasis.candidates;
  // The saved selection can resolve the original conflict. Keep the decision
  // reachable from its source provisions independently of stale issue groups.
  const noticeFindings=groups.get('notice-term-versions')?.issues??[];
  groups.delete('notice-term-versions');
  if(noticeFindings.length||state.controls.reviewDecisions?.['notice-term-versions']||noticeVersions.some(v=>v.applicability==='unresolved')||new Set(noticeVersions.map(v=>v.value+'|'+v.unit)).size>1){
    const saved=noticeBasis.decision;
    const item:ProjectAction={id:'matter:notice-term-versions',category:saved?'information':'confirmation',title:'Review claim notice provisions',owner:'Contracts Manager',recordCount:noticeVersions.length,
      reason:saved?.choice==='refer_contracts'?'Interpretation remains unresolved for Contracts review. The saved choice can be revised here.':'Compare the source periods and their effective intervals before choosing the reporting provisions.',
      findings:noticeFindings,reviewFingerprint:noticeBasis.sourceFingerprint,reviewSourceRefs:noticeBasis.sourceRefs,
      evidenceSummary:noticeVersions.map(v=>v.value+' '+v.unit+' · '+v.sourceFilename+' · '+v.sourceRefs.map(ref=>ref.split(':').slice(-2).join(' ')).join('; ')+(v.effectiveFromIso?' · from '+v.effectiveFromIso:' · original provision')+(v.effectiveToIso?' · replaced from '+v.effectiveToIso:'')+(v.sourceAnalyticalUse==='qualified_source_read'?' · read from source; not formally adopted':'')),
      resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Confirm the source intervals, choose the applicable retained provisions, or retain the unresolved interpretation. Original periods, triggers and source dates remain unchanged; this is not an entitlement decision.',completionRule:'Saved against these source files and editable after saving. Source changes reopen review.'},
      target:{type:'inline',kind:'review-notice',label:'Record notice review',reviewChoice:saved?.choice??'confirm_versions',reviewReference:saved?.reference??null,noticeCandidates:noticeVersions,noticeSourceKeys:saved?.noticeSourceKeys??noticeVersions.map(v=>v.sourceKey),
        reviewOptions:[{value:'confirm_versions',label:'Confirm all dated source provisions'},{value:'choose_provisions',label:'Use selected source provisions'},{value:'refer_contracts',label:'Keep interpretation unresolved'}]}};
    (saved?information:actions).push(item);
  }
  const riskValidation=operationalControlsAsOf(state,projectControlSchedule(state)?.revision.model.dataDateIso??null).risk.validation;
  // F30: each missing field is listed once across the whole list, by its raw
  // field identity, with the control that supplies it. A later matter that
  // concerns the same field keeps the finding but does not list it again.
  const listedGapFields=new Set<string>();
  for(const {group,issues} of groups.values()){
    // Once a contractual completion date has been explicitly governed, stale
    // missing-only findings must not recreate the same confirmation action.
    // A later genuine source conflict/review remains visible and actionable.
    const sourcedContractDate=state.controls.contractTimeBasis?.contractualCompletionIso??contractCompletionPosition(state,projectControlSchedule(state)?.revision.model.dataDateIso??null).value;
    if(group.key==='contract-completion'&&sourcedContractDate&&issues.every(issue=>issue.kind==='missing_information'))continue;
    const pushMatter=(subset:ControlIssue[],suffix='')=>{
      if(!subset.length)return;
      const refs=[...new Set(subset.flatMap(i=>i.sourceRefs))],pages=[...new Set(subset.flatMap(i=>i.moduleKeys))];
      let resolution=actionResolution(group,subset,context);
      const evidenceSummary:string[]=[];
      if(group.key==='risk-rating-rule')for(const row of (riskValidation.ratingInconsistencyGroups??[]))
        evidenceSummary.push('Score '+row.score+': '+row.recordCount+' risks — '+row.counts.filter(x=>x.rating).map(x=>x.count+' '+x.rating).join(', '));
      const fingerprint=group.key==='risk-rating-rule'?riskReviewBasis(state).sourceFingerprint:undefined;
      const saved=fingerprint?state.controls.reviewDecisions?.[group.key]:undefined;
      if(saved&&saved.sourceFingerprint===fingerprint&&saved.choice==='refer_contracts')
        resolution={category:'follow_up',resolution:{kind:'information',requiresUserAction:false,instruction:'Contracts Manager to determine the applicable interpretation.',completionRule:'A contracts determination is required.'},target:{type:'module',moduleKey:'contract-particulars-bonds',label:'Review the contract terms'}};
      else if(saved&&saved.sourceFingerprint===fingerprint){
        resolution={...resolution,category:'information',target:{...resolution.target,reviewChoice:saved.choice,reviewMatrixText:Object.entries(saved.matrix??{}).map(([score,rating])=>score+'='+rating).join('\n')}};
        if(resolution.resolution)resolution.resolution={...resolution.resolution,requiresUserAction:false};
      }
      const missing=subset.some(issue=>issue.kind==='missing_information');
      // Missing optional or source-unproven fields remain visible as information.
      // Only explicit decisions and proven conflicting records create actions.
      const owner=pmcRoleOwner(group.key,subset.find(issue=>issue.owner&&issue.owner!=='CMeng')?.owner);
      const sourceFiles=actionSourceFilenames(state,refs);
      const file=sourceFiles.join(', ')||(group.key==='programme-information'?'Current programme':group.title+' source register or document');
      // Every distinct affected field of a combined request stays listed.
      const missingFields=missing?subset.filter(issue=>issue.kind==='missing_information').flatMap(issue=>(issue.members?.map(member=>memberView(issue,member))??[issue])
        .filter((member,index,all)=>all.findIndex(other=>controlIssueField(other)===controlIssueField(member))===index))
        .filter(member=>{const id=controlIssueField(member);if(listedGapFields.has(id))return false;listedGapFields.add(id);return true;}).map(issue=>{
        // Every heading under which this one raw field was requested stays on its single entry.
        const id=controlIssueField(issue);
        const headings=[...new Set(subset.filter(i=>i.kind==='missing_information').flatMap(i=>i.members?.map(m=>memberView(i,m))??[i]).filter(m=>controlIssueField(m)===id).map(m=>m.summary?.trim()).filter((h):h is string=>!!h))];
        const subject=[controlIssueField(issue),...(issue.evidencePaths??[])].join(' ');
        const advance=/advance.?payment.?bond|advance.?payment.?security/i.test(subject)&&heldAdvanceBonds.length>0;
        const certified=/certified.?progress/i.test(subject)&&heldCertificates.length>0;
        return {field:advance?'Advance-payment bond is held; confirm only the contractual requirement not stated in its source':
          certified?'Dated certificates are held; the comparable certified-progress denominator or area allocation is not established':
          issue.summary?.trim()||issue.code.replaceAll('_',' ').toLowerCase(),file:advance?heldAdvanceBonds.map(b=>b.bondId).join('; '):file,owner,
          fieldIdentity:id,...(headings.length>1?{headings}:{}),supply:missingFieldSupply(group.key,issue,openInputs)};
      }):undefined;
      const item:ProjectAction={id:'matter:'+group.key+suffix,...resolution,title:group.title,reason:group.note,
        recordCount:refs.length,requestCount:subset.length,owner,...(missingFields?{missingFields}:{}),findings:subset,findingIds:subset.map(actionFindingId),affectedPages:pages,
        ...(group.key==='schedule-calculation'?{completionPosition:context.completionPosition}:{}),...(evidenceSummary.length?{evidenceSummary}:{}),...(fingerprint?{reviewFingerprint:fingerprint}:{})};
      if(refs.length){
        item.correctionRecords=refs.map(ref=>actionSourceCorrectionRecord(state,ref))
          .filter((row,index,all)=>all.findIndex(other=>other.source===row.source&&other.locator===row.locator&&other.documentId===row.documentId)===index);
      }
      if(resolution.resolution?.kind==='upload'||item.category==='follow_up'&&refs.length){
        item.reason=group.key==='notice-term-versions'?'These are successive contractual provisions, not necessarily conflicting records. Check the effective dates.'
          :group.key==='risk-rating-rule'?'The register supplies inconsistent ratings for identical scores. Original ratings are retained until the rating rule is confirmed.'
          :group.key==='programme-logic'?'The submitted programme includes duplicate IDs or missing links. The planner must validate the original programme.'
          :group.key==='procurement-date-check'||group.key==='register-date-check'?group.note
          :'CMeng identified '+subset.length+' source finding'+(subset.length===1?'':'s')+'. Available values remain usable; only the listed fields need correction if the source is wrong. Compare the extracted facts before changing a document.';
      }
      (item.category==='information'?information:actions).push(item);
    };
    const correctionIssues=issues.filter(issue=>['source_conflict','data_quality'].includes(issue.kind));
    const supportingIssues=issues.filter(issue=>!correctionIssues.includes(issue));
    if(correctionIssues.length&&supportingIssues.length){
      pushMatter(correctionIssues,':correction');
      pushMatter(supportingIssues,':information');
    }else pushMatter(issues);
  }

  const dateDifferences=delivery.packageRows.filter(row=>row.programmeNeedDate&&row.sourceRequiredOnSite&&row.programmeNeedDate!==row.sourceRequiredOnSite);
  if(dateDifferences.length){
    const basis=procurementDateBasis(state);
    const action:ProjectAction={id:'matter:procurement-date-basis',category:basis.choice?'information':'confirmation',
      title:'Choose the procurement reporting date basis',owner:'Procurement Manager',recordCount:dateDifferences.length,
      reason:dateDifferences.length+' packages have different register and programme need dates. Both source dates remain visible.',
      reviewFingerprint:basis.sourceFingerprint,
      evidenceSummary:dateDifferences.slice(0,10).map(row=>row.reference+': register '+row.sourceRequiredOnSite+'; programme '+row.programmeNeedDate),
      resolution:{kind:'choose',requiresUserAction:true,instruction:'Choose the date basis for all procurement packages in these source revisions. Where the chosen date is missing, timing remains not established. Until you choose, the earlier date is used only for screening.'+(basis.choice?' Current choice: '+(basis.choice==='programme'?'programme need dates':'register required-on-site dates')+'.':''),completionRule:'Saved against these programme and procurement records; new source versions require a new decision.'},
      target:{type:'inline',kind:'review-procurement-date',label:'Confirm procurement date basis',reviewChoice:basis.choice,reviewOptions:[{value:'programme',label:'Use linked programme need dates'},{value:'register',label:'Use register required-on-site dates'}]}};
    (basis.choice?information:actions).push(action);
  }

  const riskBasis=riskReviewBasis(state),ops=operationalControlsAsOf(state,projectDataDate(state));
  if(ops.risk.validation.ratingInconsistencyGroups.length&&![...actions,...information].some(a=>a.target.kind==='review-risk')){
    const saved=riskBasis.rating;
    const item:ProjectAction={id:'matter:risk-rating-rule',category:saved?'information':'confirmation',title:'Risk score and rating method',owner:'Risk Manager',recordCount:ops.risk.sourceRecordCount,
      reason:'Equal source scores have different supplied ratings. The source ratings remain available beside the selected reporting treatment.',
      reviewFingerprint:riskBasis.sourceFingerprint,reviewSourceRefs:ops.risk.validation.sourceRefs,
      evidenceSummary:ops.risk.validation.ratingInconsistencyGroups.map(g=>'Score '+g.score+': '+g.ratings.join(', ')),
      resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Keep the supplied ratings or enter the approved score-to-rating matrix.',completionRule:'The treatment applies only to the reviewed source revision.'},
      target:{type:'inline',kind:'review-risk',label:'Confirm risk rating basis',reviewChoice:saved?.choice??null,reviewMatrixText:Object.entries(saved?.matrix??{}).map(([score,rating])=>score+'='+rating).join('\n'),reviewOptions:[{value:'keep_source_ratings',label:'Keep the ratings entered in the register'},{value:'enter_matrix',label:'Enter the project risk rating matrix'}]}};
    (saved?information:actions).push(item);
  }
  const undatedRisks=ops.risk.snapshotCandidates;
  if(undatedRisks.length){
    const saved=riskBasis.snapshot;
    const item:ProjectAction={id:'matter:risk-status-snapshot',category:saved?'information':'confirmation',title:'Confirm the risk register status date',owner:'Risk Manager',recordCount:undatedRisks.length,
      reason:undatedRisks.length+' risks have no recorded raised or status date. Confirm when the supplied statuses represent the project position.',
      evidenceSummary:['Current reporting date: '+(projectDataDate(state)??'Not established'),...state.evidenceDocuments.filter(d=>d.documentType==='risk_register').map(d=>d.sourceFilename)],
      reviewFingerprint:riskBasis.sourceFingerprint,reviewSourceRefs:undatedRisks.flatMap(row=>row.sourceRefs),resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Enter the date represented by these register statuses. This does not invent individual raised or closure dates.',completionRule:'The confirmed snapshot date is used for this source revision only.'},
      target:{type:'inline',kind:'review-risk-snapshot',label:'Confirm register status date',reviewChoice:saved?.choice??null,reviewDateIso:saved?.asOfIso??null,reviewOptions:[{value:'confirm_snapshot',label:'Use the supplied statuses at the date I enter'}]}};
    (saved?information:actions).push(item);
  }
  const time=canonicalTimeClaims(state),basis=reportingTimeBasis(state,time.contractTimeBasis);
  // C9: asked whenever an amendment and awarded determinations overlap, with CMeng's best answer filled in;
  // until the user decides, that answer gives the governing date (qualified).
  const overlapBasis=basis,proposal=overlapProposalFor(overlapBasis);
  if(overlapBasis&&proposal&&overlapBasis.registerDeterminationCount&&(overlapBasis.overlapResolution==='unresolved'||overlapBasis.sourceRefs.some(ref=>ref.startsWith('user-confirmation:eot-overlap:')))){
    const review=eotOverlapReview(state,overlapBasis),saved=review.decision;
    const governing=(days:number)=>{const t=Date.parse(String(overlapBasis.contractualCompletionIso).slice(0,10)+'T00:00:00Z');return Number.isFinite(t)?new Date(t+days*86400000).toISOString().slice(0,10):null;};
    const item:ProjectAction={id:'matter:eot-overlap',category:saved?'information':'confirmation',title:'Reconcile the amendment and EOT awards',owner:'Contracts Manager',recordCount:overlapBasis.registerDeterminationCount,
      reason:(saved?'Saved: '+saved.additionalDays+' additional days after the amended completion.':'CMeng proposes '+proposal.days+' additional days after the amended completion, giving a governing completion of '+(governing(proposal.days)??'not established')+'. '+proposal.reason+' This proposal is used, marked as not confirmed, until you decide.'),
      reviewFingerprint:review.sourceFingerprint,reviewSourceRefs:overlapBasis.sourceRefs,
      evidenceSummary:['Amended completion: '+overlapBasis.contractualCompletionIso,'Days the amendment states it includes: '+(overlapBasis.incorporatedEotDays??'not stated'),
        'Awarded days in effect at the reporting date: '+proposal.inEffectDays,'Full register days: '+(overlapBasis.registerDeterminationDays??'not established'),'CMeng proposal: '+proposal.days+' additional days ('+proposal.basis.replaceAll('_',' ')+')',
        ...overlapBasis.sourceRefs.filter(r=>!r.startsWith('user-confirmation:'))],
      resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Accept CMeng\'s proposal, or enter the additional awarded days yourself. A supporting decision reference is kept when you give one.',completionRule:'Every time and commercial view uses the same decision.'},
      target:{type:'inline',kind:'review-eot-overlap',label:'Confirm EOT reconciliation',reviewChoice:saved?.choice??'accept_proposal',reviewAdditionalDays:saved?.additionalDays??proposal.days,reviewReference:saved?.reference??null,
        reviewOptions:[{value:'accept_proposal',label:'Use CMeng\'s proposal: '+proposal.days+' additional days'},{value:'confirm_additional_days',label:'Enter the additional days myself'}]}};
    (saved?information:actions).push(item);
  }
  // M7.1b: undated determined awards are counted (not confirmed) and named here, once.
  {const undated=(time.diagnostics??[]).find((d:string)=>d.startsWith('UNDATED_DETERMINATIONS_COUNTED_NOT_CONFIRMED:'));
   if(undated){const ids=undated.split(':')[1]!.split(',');
    actions.push({id:'matter:undated-determinations',category:'review',title:'Add the dates of '+countText(ids.length,'determination','determinations')+' in the register',owner:'Contracts Manager',recordCount:ids.length,
      reason:countText(ids.length,'determination','determinations')+' ('+ids.slice(0,8).join(', ')+') '+(ids.length===1?'has':'have')+' no determination date. '+(ids.length===1?'Its days are':'Their days are')+' counted in the awarded EOT, marked as not confirmed, until the date is supplied.',
      resolution:{kind:'upload',requiresUserAction:true,instruction:'Add the determination date to the register and upload it again.',completionRule:'The item closes when every counted determination has a date.'},
      target:{type:'upload',label:'Upload the corrected determination register',uploadHint:'Determination register with dates',uploadMode:'evidence'}});}}
  // M13.2 + M6.4: the forecast position decides its own Project Review item
  // (category review: Project Review publishes review and confirmation items). A
  // finish CMeng cannot calculate, or one qualified by something the user can
  // correct (a loop, a repeated ID, a missing or external link, an assumed
  // calendar, the duration basis), gives exactly one item naming each cause
  // and what to do. Correcting it changes the published finish.
  {const item=forecastReviewItem(state);if(item)actions.push(item);}
  // M6.3: the calendar basis is the planner's decision, asked once here and read by every forecast consumer.
  for(const item of calendarBasisItems(state))(item.category==='information'?information:actions).push(item);
  // M10.2: register amounts that state no tax basis use the contract's stated
  // basis (or the user's decision). One pre-filled question, asked once.
  {const model=commercialCanonical(state),rule=model.taxBasisDefault,decision=registerTaxBasisDefault(state);
   const rowsWithout=rule?.rowCount??0,unknownRows=countUnknownTaxRows(model);
   if(rowsWithout>0||unknownRows>0){
    const decided=decision.source==='user';
    const prefill=decision.basis;
    const item:ProjectAction={id:'matter:tax-basis',category:decided?'information':'confirmation',title:'Confirm the tax basis of register amounts',owner:'Commercial Manager',recordCount:rowsWithout+unknownRows,
      reason:countText(rowsWithout+unknownRows,'register amount','register amounts')+' state no VAT basis. '+(decision.contract.basis?'The contract states its values '+decision.contract.basis+' of VAT, so CMeng uses that basis and names it with each total.':decision.contract.conflict?'The contract states both bases, so the amounts stay without a basis until you choose.':'The contract states no basis, so totals that need one stay unconfirmed until you choose.'),
      reviewFingerprint:decision.fingerprint,reviewSourceRefs:decision.contract.sourceRefs,
      resolution:{kind:'choose',requiresUserAction:!decided,instruction:'Choose the VAT basis for register amounts that state none.',completionRule:'Your choice applies to every register amount without a basis column; a row that states its own basis keeps it.'},
      target:{type:'inline',kind:'review-commercial-record',label:'Confirm the tax basis',reviewChoice:prefill,reviewReference:null,reviewInputType:'choice_only',
        reviewOptions:[{value:'exclusive',label:'Exclusive of VAT'+(decision.contract.basis==='exclusive'?' (as the contract states)':'')},{value:'inclusive',label:'Inclusive of VAT'+(decision.contract.basis==='inclusive'?' (as the contract states)':'')},...(decided?[{value:'undo',label:'Undo my decision'}]:[])]}};
    actions.push(item);
   }}
  const valueReview=contractValueReview(state);
  if(!state.controls.contractValue&&valueReview.candidates.length){
    const saved=valueReview.decision;
    const item:ProjectAction={id:'matter:contract-value',category:saved?'information':'confirmation',title:'Confirm the contract value already read',owner:'Commercial Manager',recordCount:valueReview.candidates.length,
      reason:'Select the contract value to use for reporting from the retained source candidates.',reviewFingerprint:valueReview.sourceFingerprint,reviewSourceRefs:valueReview.candidates.flatMap(c=>c.sourceRefs),
      evidenceSummary:valueReview.candidates.map(c=>c.currency+' '+c.amount+' · '+c.sourceRefs.join('; ')),
      resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Check the value against the cited contract and amendment, then confirm the applicable value. Original source candidates are retained.',completionRule:'The selected amount and currency become the shared reporting value for these contract sources.'},
      // M13.1: a single read value is pre-filled; the user confirms or changes it.
      target:{type:'inline',kind:'review-contract-value',label:'Confirm contract value',reviewChoice:saved?.choice??(valueReview.candidates.length===1?'value:'+valueReview.candidates[0]!.currency+':'+valueReview.candidates[0]!.amount:null),reviewOptions:[...valueReview.candidates.map(c=>({value:'value:'+c.currency+':'+c.amount,label:c.currency+' '+c.amount.toLocaleString('en-US')})),
        {value:'enter_value',label:'Enter my own contract value and currency'},...(saved?[{value:'undo',label:'Undo my decision'}]:[])]}};
    if(saved?.choice==='enter_value')item.evidenceSummary=[...(item.evidenceSummary??[]),'Saved decision: your own value '+saved.enteredCurrency+' '+saved.enteredValue+'. Not formally adopted.'];
    (saved?information:actions).push(item);
  }

  const hse=hseReportPosition(state,projectDataDate(state));
  if(hse.review.required||hse.review.decision){
    const saved=hse.review.decision;
    const item:ProjectAction={id:'matter:hse-rate-basis',category:saved?'information':'confirmation',title:'Review HSE reporting rates',owner:'HSE Manager',recordCount:hse.periods.length,
      reason:'Reported rates, incident counts and exposure basis need reconciliation. Original report values remain visible.',reviewFingerprint:hse.review.sourceFingerprint,reviewSourceRefs:hse.sourceRefs,
      evidenceSummary:['Period ending '+hse.periodEndIso,'Reported TRIR '+(hse.rates.reportedRates.trir??'not supplied')+'; LTIFR '+(hse.rates.reportedRates.ltifr??'not supplied'),...hse.rates.comparisons.map(r=>'TRIR comparison per '+r.basisHours+' hours: '+(r.fromReportedCases??'not calculable')+' — '+r.comparisonBasis)],
      resolution:{kind:'choose',requiresUserAction:!saved,instruction:'Check the cited HSE report and the cases and exposure hours it covers. Keep its stated rates or enter reviewed rates with their exposure-hours bases and a supporting reference. Missing rates stay unknown.',completionRule:'The reporting treatment is saved for these HSE sources and reporting date; source changes require review again.'},
      target:{type:'inline',kind:'review-hse-rates',label:'Record HSE rate review',reviewChoice:saved?.choice??null,reviewReference:saved?.reference??null,reviewedRates:saved?.reviewedRates??hse.reportingRates,reviewOptions:[{value:'keep_reported',label:'Keep the reported rates with their qualifications'},{value:'confirm_rates',label:'Enter reviewed reporting rates and bases'}]}};
    (saved?information:actions).push(item);
  }

  const milestoneReview=milestoneReviewBasis(state);
  if(milestoneReview){
    const saved=milestoneReview.decision,required=!saved&&milestoneReview.unknownActivityTypeCount>0;
    const item:ProjectAction={id:'matter:milestone-selection',category:required?'confirmation':'information',title:'Review programme milestones and key dates',owner:'Planning Engineer',recordCount:milestoneReview.schedule.revision.model.activities.length,
      reason:'Source milestones and user-selected key dates remain distinguishable. Unknown source activity types are retained.',reviewFingerprint:milestoneReview.sourceFingerprint,reviewSourceRefs:milestoneReview.sourceRefs,
      evidenceSummary:['Programme: '+milestoneReview.schedule.sourceFilename,'Source milestones: '+milestoneReview.sourceMilestoneCount,'Unknown source activity types: '+milestoneReview.unknownActivityTypeCount],
      resolution:{kind:'choose',requiresUserAction:required,instruction:'Review the current activity register. Enter exact activity IDs to track their finish dates as key dates, or explicitly confirm no programme milestones when none are identified in the source. This does not change activity types, dates or contractual commitments.',completionRule:'The editable selection is saved for this programme source and reporting date. A new programme requires review again.'},
      target:{type:'inline',kind:'review-milestones',label:'Save milestone review',reviewChoice:saved?.choice??null,reviewActivityIds:saved?.activityIds??[],reviewReference:saved?.reference??null,
        reviewOptions:[{value:'track_key_dates',label:'Track selected programme activities as key dates'},...(milestoneReview.sourceMilestoneCount?[]:[{value:'no_programme_milestones',label:'Confirm this programme has no milestones'}])]}};
    (required?actions:information).push(item);
  }

  const locations=locationReviewBasis(state),locationModel=projectControlSchedule(state)?.revision.model;
  if(locations&&locationModel&&(locations.wbsCandidates.length||locations.assetCandidates.length)){
    const saved=locations.decision,unclassified=scheduleScopeClassification(locationModel).rows.filter(r=>!r.location).length,required=!saved&&unclassified>0;
    const item:ProjectAction={id:'matter:location-grouping',category:required?'confirmation':'information',title:'Review candidate programme locations',owner:'Construction Manager',recordCount:unclassified,
      reason:'Source WBS area names and asset locations can support reviewed grouping; their names alone do not establish programme location assignments.',reviewFingerprint:locations.sourceFingerprint,reviewSourceRefs:locations.sourceRefs,
      evidenceSummary:['Programme: '+locations.sourceFilename,locations.wbsCandidates.length+' WBS candidates; '+locations.assetCandidates.length+' asset location values; '+unclassified+' activities without a source location',...locations.wbsCandidates.slice(0,8).map(c=>c.wbsId+': '+c.location)],
      resolution:{kind:'choose',requiresUserAction:required,instruction:'Open Location / Floor / Zone for all WBS and asset candidates. Enter one WBS ID per line to use its source name, or WBS ID | exact candidate location to map an asset location. The nearest selected WBS ancestor supplies otherwise-unclassified activities; explicit source locations remain unchanged.',completionRule:'This review is saved against the programme and asset source versions and can be edited here.'},
      target:{type:'inline',kind:'review-locations',label:'Save location review',reviewChoice:saved?.choice??null,reviewReference:saved?.reference??null,reviewLocationsText:(saved?.locationAssignments??[]).map(a=>a.wbsId+' | '+a.location).join('\n'),
        reviewOptions:[{value:'confirm_wbs_locations',label:'Use the entered WBS-to-location mappings'},{value:'keep_source_locations',label:'Keep explicit source locations only'}]}};
    (required?actions:information).push(item);
  }

  for(const kind of ['testing','handover'] as const){
    const scope=programmeTaskReviewBasis(state,kind);if(!scope)continue;
    const saved=scope.decision,required=!saved&&(scope.nameMatches.length>0||scope.additionalCandidates.length>0);
    const item:ProjectAction={id:'matter:programme-tasks-'+kind,category:required?'confirmation':'information',title:'Review programme '+(kind==='testing'?'testing and commissioning':'handover')+' task scope',owner:'Construction Manager',recordCount:scope.rows.length,
      reason:scope.basis,reviewFingerprint:scope.sourceFingerprint,reviewSourceRefs:scope.sourceRefs,
      evidenceSummary:['Programme: '+scope.sourceFilename,scope.rows.length+' selected tasks; '+scope.additionalCandidates.length+' additional validation name candidates',scope.qualification],
      resolution:{kind:'choose',requiresUserAction:required,instruction:'Review the programme activity IDs below. Add or remove exact IDs to define this reporting scope, including relevant Validation tasks. Open Activity Review for the complete source register. This changes reporting scope only and preserves source activities, progress and formal acceptance.',completionRule:'The editable scope is saved for this programme source and reporting date. A new programme requires review again.'},
      target:{type:'inline',kind:'review-programme-tasks',label:'Save task scope',reviewChoice:saved?.choice??'selected_tasks',reviewActivityIds:scope.rows.map(a=>a.activityId),reviewReference:saved?.reference??null,
        reviewOptions:[{value:'selected_tasks',label:'Use these programme task IDs'},{value:'no_tasks',label:'Confirm no programme tasks for this scope'}]}};
    (required?actions:information).push(item);
  }

  const handoverComparison=handoverSourceComparison(state);
  if(handoverComparison?.reviewAvailable){
    const saved=handoverComparison.decision;
    // M13.1: this choice only orders the presentation; no figure changes, so it is never a required action.
    const item:ProjectAction={id:'matter:handover-source-basis',category:'information',title:'Review asset and programme reporting bases',owner:'Construction Manager',recordCount:handoverComparison.assetRecordCount,
      reason:handoverComparison.basis,reviewFingerprint:handoverComparison.sourceFingerprint,reviewSourceRefs:handoverComparison.sourceRefs,
      evidenceSummary:[...handoverComparison.rows.map(r=>r.label+': '+r.numerator+' / '+r.denominator+'; '+r.unknownCount+' unknown'),handoverComparison.dateQualification],
      resolution:{kind:'choose',requiresUserAction:false,instruction:'Review both sets of source records on Testing & Commissioning, Handover Readiness or Asset & System Handover. Choose the source to lead the comparison or retain equal presentation. Both sources remain visible; this choice does not resolve date/scope gaps or confer acceptance.',completionRule:'The editable presentation choice is saved against these source versions; new programme or asset records require review again.'},
      target:{type:'inline',kind:'review-handover-sources',label:'Save source basis review',reviewChoice:saved?.choice??null,reviewReference:saved?.reference??null,
        reviewOptions:[{value:'keep_separate',label:'Keep both source positions side by side'},{value:'programme_focus',label:'Lead with programme task progress'},{value:'asset_focus',label:'Lead with reported asset status flags'}]}};
    information.push(item);
  }

  // F34: the contract states a Time for Completion as a period counted from the
  // Commencement Date and no source states that date: the user can enter it.
  if(openInputs.has('commencement-date')){
    const commencement=commencementDatePosition(state);
    actions.push({id:'matter:commencement-date-entry',category:'confirmation',title:'Enter the Commencement Date',owner:'Contracts Manager',recordCount:commencement.candidates.length,
      reason:'The contract states the Time for Completion as a period counted from the Commencement Date, but '+(commencement.reason??COMMENCEMENT_NOT_STATED)+'. The Works and section completion dates stay unknown until it is established.',
      ...(commencement.candidates.length?{evidenceSummary:commencement.candidates.map(c=>c.dateIso+' · '+(c.kind==='engineer_notice'?'Engineer\'s notice':'contract')+' · '+c.sourceRef)}:{}),
      resolution:{kind:'confirm',requiresUserAction:true,instruction:'Enter the Commencement Date stated in the Engineer\'s notice of commencement or agreed for the contract. It is saved as your confirmation and every completion date counted from it shows that basis.',
        completionRule:'This action closes when a Commencement Date is saved, or when a source establishes it.'},
      target:{type:'inline',kind:'commencement-date',label:'Save Commencement Date'}});
  }
  const unique=[...new Map(actions.map(a=>[a.id,a])).values()];
  const programme=projectControlSchedule(state),model=programme?.revision.model;
  const ownedActions=unique.map(item=>({...item,owner:pmcRoleOwner(item.target.kind??item.target.moduleKey??item.id,item.owner)}));
  const dataGaps=information.map(item=>({...item,owner:pmcRoleOwner(item.id,item.owner)}));
  return {projectId:state.projectId,projectVersion:state.version,checkedAt:new Date().toISOString(),actionCount:ownedActions.length,actions:ownedActions,information:dataGaps,dataGaps,heldEvidence:{advanceBondCount:heldAdvanceBonds.length,datedCertificateCount:heldCertificates.length},
    analysis:{state:model?'analysed':state.schedules.length?'programme_selection_needed':'no_programme',activityCount:model?.activities.length??null,dataDateIso:model?.dataDateIso??null,sourceFilename:programme?.sourceFilename??null},
    systemCheckCount:systemItems.length,scope:'One matter per underlying information or decision group. Affected pages and all original findings are retained inside each matter. Missing optional domains are shown separately as coverage information. Decisions refresh from the current project records.'};
}

const FORECAST_ACTIONABLE=new Set(['network_repaired','network_references','external_links','assumed_calendar','elapsed_day_pattern','constraints_not_applied','partial_coverage']);
/** M13.2/M6.4: one Project Review item from the forecast position itself. */
export function forecastReviewItem(state:ProjectRuntimeState):ProjectAction|null{
  const model=projectControlSchedule(state)?.revision.model;
  if(!model||!model.activities.length)return null;
  const forecast=cachedIndependentForecast(model,'project-version:'+state.version);
  const managed=buildForecastReconciliationGate({forecast,model,requiredFinishIso:null}).managementForecast;
  if(managed.state==='not_calculable')return {id:'matter:forecast-not-calculable',category:'review',title:'CMeng cannot calculate the finish from this programme yet',owner:'Planning Manager',recordCount:1,
    reason:String(managed.notCalculableReason??'The programme network cannot be calculated.'),
    resolution:{kind:'upload',requiresUserAction:true,instruction:'Correct the cause named here in the programme and upload it again.',completionRule:'The item closes when CMeng can calculate the finish.'},
    target:{type:'upload',label:'Upload the corrected programme',uploadHint:'Corrected programme (XER or XML)',uploadMode:'schedule'}};
  const fixable=managed.qualifications.filter(q=>FORECAST_ACTIONABLE.has(q.code));
  if(!fixable.length)return null;
  return {id:'matter:forecast-qualifications',category:'review',title:'Firm up the CMeng finish ('+(managed.completionIso??'').slice(0,10)+')',owner:'Planning Manager',recordCount:fixable.length,
    reason:'The finish is calculated and shown with '+countText(fixable.length,'qualification','qualifications')+' you can correct: '+fixable.map(q=>q.text.replace(/\.$/,'')).join('; ')+'.',
    resolution:{kind:'upload',requiresUserAction:true,instruction:fixable.map(q=>q.action).join(' '),completionRule:'Each qualification clears when the corrected programme or input removes its cause; the finish is recalculated at once.'},
    target:{type:'upload',label:'Upload the corrected programme',uploadHint:'Corrected programme (XER or XML)',uploadMode:'schedule'}};
}

/** Register amounts read with no tax basis at all (no row column, no contract or user basis). */
function countUnknownTaxRows(model:CanonicalCommercialModel):number{
  const amounts=[...model.payments.flatMap(p=>Object.values(p.amounts)),...model.variations.map(v=>v.approvedAmount)] as Array<{value:number|null;taxBasis:string}>;
  return amounts.filter(a=>a&&a.value!==null&&a.taxBasis==='unknown').length;
}

/** M4.1: what, other than a completeness confirmation, keeps a register's percentages unknown. */
function populationBlockers(state:ProjectRuntimeState,delivery:ReturnType<typeof deliveryPosition>,kind:string):{text:string;count:number}|null{
  const rows=(delivery.registerRows??[]).filter((r:any)=>r.kind===kind) as Array<{scope:string;currentStatus:string;verificationRequired?:boolean}>;
  if(!rows.length)return null;
  if(!projectDataDate(state))return {text:'a Data Date (upload the current programme)',count:rows.length};
  const undated=rows.filter(r=>r.scope==='undated').length,unknown=rows.filter(r=>r.scope==='current'&&r.currentStatus==='not_established').length,verify=rows.filter(r=>r.scope==='current'&&r.verificationRequired).length;
  const parts=[undated?countText(undated,'record','records')+' with no date':'',unknown?countText(unknown,'current record','current records')+' with no status at the Data Date':'',verify?countText(verify,'closure','closures')+' awaiting verification':''].filter(Boolean);
  return parts.length?{text:parts.join(', '),count:undated+unknown+verify}:null;
}

/** M6.3: the calendar-basis questions for the control programme, from what the source states. */
export function calendarBasisItems(state:ProjectRuntimeState):ProjectAction[]{
  const control=projectControlSchedule(state);
  if(!control)return [];
  const stored=state.schedules.find(s=>s.revision.revisionId===control.revision.revisionId)??control;
  const model=stored.revision.model;
  const saved=savedCalendarBasis(state,model),items:ProjectAction[]=[];
  const review=reviewScheduleCalendarBasis(model);
  if(review.state==='calendar_basis_difference'||saved.durationBasis){
    const decided=!!saved.durationBasis,count=review.elapsedDayMismatchCount??0;
    items.push({id:'matter:calendar-basis',category:decided?'information':'confirmation',title:'Confirm the programme duration basis',owner:'Planning Manager',recordCount:count,
      reason:(count?countText(count,'completed task has','completed tasks have')+' a duration equal to its calendar days, not its working days on the assigned calendar. ':'')+
        'CMeng keeps its finish visible on the programme calendars as supplied. Your answer decides the basis every forecast uses; CMeng does not choose a calendar.'+
        (decided?' Saved: '+calendarBasisStatement({durationBasis:saved.durationBasis,patterns:[]}):''),
      reviewFingerprint:calendarBasisFingerprint(model),reviewSourceRefs:[],
      resolution:{kind:'choose',requiresUserAction:!decided,instruction:'Planning Manager: confirm whether the programme durations are working days on its calendars, or calendar days.',completionRule:'Your answer is applied to every forecast at once; you can change or undo it. A programme revision with different calendars asks again.'},
      target:{type:'inline',kind:'review-commercial-record',label:'Confirm duration basis',reviewChoice:saved.durationBasis,reviewReference:null,reviewInputType:'choice_only',
        reviewOptions:[{value:'working_days',label:'Working days on the programme calendars (keep CMeng\'s calculation)'},{value:'calendar_days',label:'Calendar days (run the remaining work every day on the programme\'s own shifts)'},...(decided?[{value:'undo',label:'Undo my decision'}]:[])]}});
  }
  for(const c of shorthandCalendars(model)){
    const pattern=saved.patterns.find(p=>p.calendarId===c.calendarId);
    items.push({id:'matter:calendar-pattern:'+c.calendarId,category:pattern?'information':'confirmation',title:'Confirm the working week of calendar '+(c.name??c.calendarId),owner:'Planning Manager',recordCount:1,
      reason:'The source states '+c.days+' working days of '+c.dayHours+' h for calendar '+(c.name??c.calendarId)+' but not which days or the shift times, so its work cannot be scheduled yet. Choose the working week; CMeng then recalculates.'+(pattern?' Saved: '+pattern.label+'.':''),
      reviewFingerprint:c.fingerprint,reviewSourceRefs:[],
      resolution:{kind:'choose',requiresUserAction:!pattern,instruction:'Planning Manager: choose the working week this calendar uses.',completionRule:'Your choice is applied to every forecast at once; you can change or undo it.'},
      target:{type:'inline',kind:'review-commercial-record',label:'Confirm working week',reviewChoice:pattern?'week:'+pattern.days.join(''):null,reviewReference:null,reviewInputType:'choice_only',
        reviewOptions:[...c.options.map(o=>({value:o.value,label:o.label})),...(pattern?[{value:'undo',label:'Undo my decision'}]:[])]}});
  }
  return items;
}
