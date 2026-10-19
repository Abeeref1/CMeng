import {riskReviewBasis} from './source-review-decisions';
import {cell,registerBusinessStatusFields,dateValue,norm,numberValue,partitionAsOf,sourceTables,type SourceRow} from '../../truth-kernel/src';
import type {NcrRecord,RfiRecord} from '../../project-director/src';
import type {ProjectRuntimeState,RiskControlRecord,StoredEvidenceDocument} from './project-state-types';

type Lifecycle = {raisedIso?:string|null;closedIso?:string|null;statusAsOfIso?:string|null;sourceRefs:string[]};
const derived=(row:{sourceRefs:string[]})=>row.sourceRefs.some(ref=>ref.startsWith('evidence-document:'));
const refs=(row:SourceRow)=>['evidence-document:'+row.receipt.documentId+':'+row.receipt.locator];
const responsibility=(row:SourceRow)=>({owner:cell(row,'owner','responsible person','assigned to')||null,linkedActivityId:cell(row,'linked activity','activity id')||null,subject:cell(row,'subject','description')||null});
const dates=(row:SourceRow)=>({raisedIso:dateValue(cell(row,'raised date','opened date','issue date','identified date')),
  closedIso:dateValue(cell(row,'close date','closed date','response date','answered date')),
  statusAsOfIso:dateValue(cell(row,'status as of','status date','snapshot date','as of date','last reviewed'))});
const ncrStatus=(raw:string):NcrRecord['status']=>/^(closed|complete|completed|resolved)$/.test(norm(raw))?'closed':/^(open|active|in progress|overdue)$/.test(norm(raw))?'open':'unknown';
const rfiStatus=(raw:string):RfiRecord['status']=>/^(closed|complete|completed)$/.test(norm(raw))?'closed':/^(answered|responded)$/.test(norm(raw))?'answered':/^(open|active|pending|overdue)$/.test(norm(raw))?'open':'unknown';

/** The register's own business-status column takes part in every NCR/RFI/risk
 * calculation. Distinct asserted source statuses require review, rather than
 * silently falling back to an unrelated administrative "status" field. */
export function operationalSourceStatus(row:SourceRow,kind:'ncr'|'rfi'|'risk'){
  const observed=registerBusinessStatusFields(kind).flatMap(field=>{
    const raw=cell(row,field);
    return raw?[{field,raw}]:[];
  });
  const different=new Set(observed.map(x=>norm(x.raw)));
  const conflicted=different.size>1;
  return {value:conflicted?'':observed[0]?.raw??'',conflicted,
    observed:observed.filter((entry,index)=>observed.findIndex(x=>x.field===entry.field)===index)};
}
function sourceStatusFor(row:SourceRow,kind:'ncr'|'rfi'|'risk',diagnostics:string[]){
  const result=operationalSourceStatus(row,kind);
  if(result.conflicted)diagnostics.push('SOURCE_STATUS_COLUMNS_CONFLICT:'+kind+':'+row.receipt.documentId+':'+row.receipt.locator);
  return result;
}


/**
 * T04: a fully read, unique source may participate in source-qualified
 * analysis even when its formal adoption has not been recorded. Competing
 * candidate revisions and documents requiring classification/lineage review
 * remain held; never merge them, infer which one is current, or change stored
 * basisState/contractual authority. Re-use one exact selection for every
 * operational family rather than requiring a manual approval for clear data.
 */
export function analyticalOperationalDocuments(documents:readonly StoredEvidenceDocument[]):StoredEvidenceDocument[]{
  const activeFamilies=new Set(documents.filter(d=>['active','additive'].includes(d.basisState)).map(d=>d.familyKey));
  const candidatesByFamily=new Map<string,number>();
  for(const d of documents)if(d.basisState==='candidate')
    candidatesByFamily.set(d.familyKey,(candidatesByFamily.get(d.familyKey)??0)+1);
  return documents.filter(d=>['active','additive'].includes(d.basisState)||(
    d.basisState==='candidate' && d.parserState==='parsed' &&
    !d.identification?.needsReview && !d.lineage?.needsReview &&
    !d.supersededByDocumentId && Boolean(d.familyKey) &&
    !activeFamilies.has(d.familyKey) && candidatesByFamily.get(d.familyKey)===1
  ));
}

/** Label carried by every result read from a source that is not formally adopted.
 * The same value the document register shows for the source itself. */
export const SOURCE_ANALYTICAL_USE='qualified_source_read' as const;
export const sourceAnalyticalDiagnostic=(documentId:string)=>'SOURCE_ANALYTICAL_NOT_ADOPTED:'+documentId;
/** Candidate documents that the shared T04 rule above admits into analysis
 * (read from source, not formally adopted). No second selection rule. */
export function sourceAnalyticalCandidateIds(documents:readonly StoredEvidenceDocument[]):Set<string>{
  return new Set(analyticalOperationalDocuments(documents).filter(d=>d.basisState==='candidate').map(d=>d.documentId));
}

/** Reconstruct lifecycle status from actual dates. A future closure never closes
 * an earlier reporting position; an undated final status never backdates itself.
 * Original source rows and excluded IDs are retained for inspection. */
function scope<T extends Lifecycle & {status:string}>(rows:T[],name:string,id:(row:T)=>string,date:string|null,hasSource:boolean,diagnostics:string[],sourceOnly=false) {
  const cutoff=dateValue(date??'');
  const partition=partitionAsOf(rows,{name,entity:name,dataDateIso:date,dateBasis:'raised date, with dated closure/response and explicit status snapshot',id,date:r=>r.raisedIso??r.statusAsOfIso});
  const current=partition.asOf.map(row=>{
    const closed=dateValue(row.closedIso??''),raised=dateValue(row.raisedIso??'');
    let status=row.status;
    if(closed&&raised&&closed<raised){status='unknown';diagnostics.push('CLOSURE_BEFORE_RAISED_DATE:'+id(row));}
    else if(closed&&cutoff)status=closed<=cutoff?(row.status==='answered'?'answered':'closed'):'open';
    else if(row.status!=='open'&&(!row.statusAsOfIso||!cutoff||row.statusAsOfIso>cutoff))status='unknown';
    return {...row,status};
  });
  const unknownStatusCount=current.filter(r=>r.status==='unknown').length;
  return {...partition,current,sourceRows:rows,sourceRecordCount:rows.length,currentRecordCount:current.length,
    futureRecordCount:partition.future.length,undatedRecordCount:partition.undated.length,unknownStatusCount,
    // A candidate-only source can give established per-record observations,
    // never an approved/completely reconciled population or an invented zero.
    sourceAnalyticalOnly:sourceOnly,
    state:!hasSource?'missing':sourceOnly||partition.undated.length||unknownStatusCount||diagnostics.length?'partial':'established',
    diagnostics:[...diagnostics],complete:hasSource&&!sourceOnly&&Boolean(cutoff)&&partition.undated.length===0&&unknownStatusCount===0&&diagnostics.length===0};
}

export function operationalControlsAsOf(state:ProjectRuntimeState,date:string|null) {
  const diagnostics:string[]=[];
  const sourceDocuments=analyticalOperationalDocuments(state.evidenceDocuments);
  const tables=sourceTables(sourceDocuments,diagnostics);
  const tablesOf=(type:string)=>tables.filter(t=>t.document.documentType===type);
  const docIds=(type:string)=>new Set(tablesOf(type).map(t=>t.document.documentId));
  const sourceOnly=(type:string)=>tablesOf(type).some(t=>t.document.basisState==='candidate');
  const rows=(type:string)=>tablesOf(type).flatMap(t=>t.rows);
  const manual=<T extends {sourceRefs:string[]}>(items:T[]|undefined,type:string)=>(items??[]).filter(r=>!derived(r)||docIds(type).size===0);
  const ncrs:NcrRecord[]=[...manual(state.controls.ncrs,'quality_ncr_register'),...rows('quality_ncr_register').map(row=>({
    ncrId:cell(row,'ncr id'),severity:(/^(critical)$/.test(norm(cell(row,'severity')))?'critical':/^(major|high)$/.test(norm(cell(row,'severity')))?'major':/^(minor|low)$/.test(norm(cell(row,'severity')))?'minor':'unknown') as NcrRecord['severity'],
    status:ncrStatus(sourceStatusFor(row,'ncr',diagnostics).value),dueIso:dateValue(cell(row,'due date','required close date')),...responsibility(row),...dates(row),sourceRefs:refs(row)}))];
  const rfis:RfiRecord[]=[...manual(state.controls.rfis,'rfi_register'),...rows('rfi_register').map(row=>({rfiId:cell(row,'rfi id'),
    status:rfiStatus(sourceStatusFor(row,'rfi',diagnostics).value),...responsibility(row),dueIso:dateValue(cell(row,'required response','due date')),...dates(row),sourceRefs:refs(row)}))];
  const riskBasis=riskReviewBasis(state);
  const risks:RiskControlRecord[]=[...manual(state.controls.risks,'risk_register'),...rows('risk_register').map(row=>{
    const source=sourceStatusFor(row,'risk',diagnostics);
    const raw=source.value;
    return {riskId:cell(row,'risk id'),...responsibility(row),category:cell(row,'category','risk category','discipline')||null,
      status:(/^(open|active|mitigating|in progress)$/.test(norm(raw))?'open':/^(closed|resolved)$/.test(norm(raw))?'closed':'unknown') as RiskControlRecord['status'],
      sourceStatus:source.conflicted?'Conflicting source status columns: '+source.observed.map(entry=>entry.field+'='+entry.raw).join('; '):raw,
      rating:cell(row,'rating')||null,owner:cell(row,'owner')||null,dueIso:dateValue(cell(row,'due date')),...dates(row),sourceRefs:refs(row)};
  })];
  const prepare=<T>(items:T[],type:string,id:(r:T)=>string)=>{
    const ds=diagnostics.filter(d=>[...docIds(type)].some(key=>d.includes(key)));
    const ids=items.map(id);if(ids.some(x=>!x))ds.push('RECORD_ID_MISSING');
    if(new Set(ids).size!==ids.length)ds.push('DUPLICATE_RECORD_ID');
    return ds;
  };
  const quality=scope(ncrs,'NCR register',r=>r.ncrId,date,tablesOf('quality_ncr_register').length>0||ncrs.length>0,prepare(ncrs,'quality_ncr_register',r=>r.ncrId),sourceOnly('quality_ncr_register'));
  const rfi=scope(rfis,'RFI register',r=>r.rfiId,date,tablesOf('rfi_register').length>0||rfis.length>0,prepare(rfis,'rfi_register',r=>r.rfiId),sourceOnly('rfi_register'));
  const riskSnapshotDate=dateValue(riskBasis.snapshot?.asOfIso??'');
  const suppliedDateRefs=new Set(rows('risk_register').filter(row=>cell(row,'raised date','opened date','issue date','identified date')||cell(row,'status as of','status date','snapshot date','as of date','last reviewed')).flatMap(refs));
  const snapshotCandidates=risks.filter(row=>!row.raisedIso&&!row.statusAsOfIso&&!row.sourceRefs.some(ref=>suppliedDateRefs.has(ref)));
  const snapshotRows=new Set(snapshotCandidates);
  const reportingRisks=risks.map(row=>snapshotRows.has(row)&&riskSnapshotDate?{...row,statusAsOfIso:riskSnapshotDate,sourceRefs:[...row.sourceRefs,'user-confirmation:risk-status-snapshot:'+riskBasis.sourceFingerprint]}:row);
  const risk={...scope(reportingRisks,'Risk register',r=>r.riskId,date,tablesOf('risk_register').length>0||risks.length>0,prepare(risks,'risk_register',r=>r.riskId),sourceOnly('risk_register')),sourceRows:risks};
  const undatedRiskStates=new Map<string,number>();
  for(const row of risk.undated){const status=row.sourceStatus||row.status||'Unknown';undatedRiskStates.set(status,(undatedRiskStates.get(status)??0)+1);}
  const undatedRiskStatusCounts=Object.fromEntries(undatedRiskStates);
  const scoreRows=rows('risk_register').map(row=>{
    const probability=numberValue(cell(row,'probability')),impact=numberValue(cell(row,'impact')),sourceScore=numberValue(cell(row,'score'));
    const calculatedScore=probability!==null&&impact!==null&&probability>=0&&impact>=0?Number((probability*impact).toFixed(6)):null;
    const score=sourceScore??calculatedScore;
    const scoreConflict=sourceScore!==null&&calculatedScore!==null&&Math.abs(sourceScore-calculatedScore)>0.000001;
    return {riskId:cell(row,'risk id'),probability,impact,sourceScore,calculatedScore,score,scoreConflict,
      rating:cell(row,'rating')||null,dueIso:dateValue(cell(row,'due date')),sourceRefs:refs(row)};
  });
  const ratingDecision=riskBasis.rating;
  const currentRisks=new Map(risk.current.map(row=>[row.riskId,row]));
  for(const row of scoreRows){
    const confirmedRating=ratingDecision?.choice==='enter_matrix'&&row.score!==null?ratingDecision.matrix?.[String(row.score)]:undefined;
    if(confirmedRating){
      const current=currentRisks.get(row.riskId);if(current)current.rating=confirmedRating;
    }
  }
  const scoreGroups=[...new Set(scoreRows.map(r=>r.score).filter((n):n is number=>n!==null))].sort((a,b)=>a-b).map(score=>{
    const members=scoreRows.filter(r=>r.score===score);return {score,recordCount:members.length,ratings:[...new Set(members.map(r=>r.rating).filter(Boolean))],counts:[...new Set(members.map(r=>r.rating))].map(rating=>({rating,count:members.filter(r=>r.rating===rating).length})),riskIds:members.map(r=>r.riskId)};
  });
  const ratingInconsistencyGroups=scoreGroups.filter(g=>g.ratings.length>1);
  const scoreConflictRows=scoreRows.filter(r=>r.scoreConflict);
  const missingProbabilityCount=scoreRows.filter(r=>r.probability===null).length,missingImpactCount=scoreRows.filter(r=>r.impact===null).length;
  const ratingConflictsUnresolved=ratingDecision?.choice==='keep_source_ratings'?false:ratingInconsistencyGroups.some(g=>ratingDecision?.choice!=='enter_matrix'||!ratingDecision.matrix?.[String(g.score)]);
  const riskValidation={ratingDecision:ratingDecision?.choice??null,statusSnapshotDate:riskSnapshotDate,state:scoreConflictRows.length||ratingConflictsUnresolved?'conflicted':scoreRows.length&&scoreRows.every(r=>r.score!==null&&r.rating!==null)?'consistent_in_checked_scores':'review_required',sourceRecordCount:risks.length,
    missingProbabilityCount,missingImpactCount,
    sourceFactKey:'RISK_RATING_SCORE_CONFLICT',
    scoreBasis:'Supplied risk Score is retained when present and reconciled against probability × impact. When Score is absent, probability × impact is a calculated comparison value. No rating thresholds are invented.',
    scoreConflictRows,ratingInconsistencyGroups,scoreGroups,scoreRows,
    statusDateMissingCount:risk.undatedRecordCount,
    dueAfterDataDateCount:scoreRows.filter(r=>dateValue(date??'')&&r.dueIso&&r.dueIso>dateValue(date??'')!).length,
    sourceRefs:scoreRows.flatMap(r=>r.sourceRefs),
    diagnostics:[...(scoreConflictRows.length?['RISK_SOURCE_SCORE_CONFLICT']:[]),...(ratingConflictsUnresolved?['RISK_RATING_SCORE_CONFLICT']:[])],
    sourceDiagnostics:[...(scoreConflictRows.length?['RISK_SOURCE_SCORE_CONFLICT']:[]),...(ratingInconsistencyGroups.length?['RISK_RATING_SCORE_CONFLICT']:[])],
    explanation:risks.length+' risk records are present. '+(scoreConflictRows.length?scoreConflictRows.length+' supplied Score value(s) differ from probability × impact. ':'')+(ratingInconsistencyGroups.length?ratingInconsistencyGroups.length+' equal score values have inconsistent supplied ratings. ':'')+
      (missingProbabilityCount||missingImpactCount?'Risk score validation is unresolved: probability is missing or unreadable in '+missingProbabilityCount+' rows; impact is missing or unreadable in '+missingImpactCount+' rows. Provide those source values to assess the scores. ':'')+
      risk.undatedRecordCount+' records lack an identified/status-as-of date. Action due dates do not establish when the risk was open.'};
  const severityKnown=quality.current.every(r=>r.status!=='open'||r.severity!=='unknown');
  const dueKnown=rfi.current.every(r=>r.status!=='open'||r.dueIso!==null);
  const ncrDueKnown=quality.current.every(r=>r.status!=='open'||r.dueIso!==null);
  const dueBefore=(date:string|null,due:string|null|undefined)=>!!date&&!!due&&due<date;
  const actionRows=[
    ...quality.current.filter(r=>r.status==='open'&&['critical','major'].includes(r.severity)).map(r=>({recordId:r.ncrId,type:'NCR',priority:r.severity,owner:r.owner??null,dueIso:r.dueIso??null,raisedIso:r.raisedIso??null,subject:r.subject??null,linkedActivityId:r.linkedActivityId??null,sourceRefs:r.sourceRefs,action:'Resolve the NCR and record closure evidence; confirm the responsible owner and due date where absent.'})),
    ...rfi.current.filter(r=>r.status==='open'&&r.dueIso&&dateValue(date??'')&&r.dueIso<dateValue(date??'')!).map(r=>({recordId:r.rfiId,type:'RFI',priority:'overdue',owner:r.owner??null,dueIso:r.dueIso,raisedIso:r.raisedIso??null,subject:r.subject??null,linkedActivityId:r.linkedActivityId??null,sourceRefs:r.sourceRefs,action:'Obtain the overdue response; record the decision and linked activity impact.'}))
  ].map(row=>({...row,ageDays:row.raisedIso&&date?Math.max(0,Math.floor((Date.parse(date.slice(0,10))-Date.parse(row.raisedIso.slice(0,10)))/86400000)):null,
    overdueDays:row.dueIso&&date?Math.max(0,Math.floor((Date.parse(date.slice(0,10))-Date.parse(row.dueIso.slice(0,10)))/86400000)):null,
    missingActionFields:[...(!row.owner?['Owner']:[]),...(!row.dueIso?['Due date']:[])]}))
    .sort((a,b)=>Number(b.priority==='critical')-Number(a.priority==='critical')||(b.overdueDays??-1)-(a.overdueDays??-1)||(b.ageDays??-1)-(a.ageDays??-1)||a.recordId.localeCompare(b.recordId));
  return {actions:actionRows,dataDateIso:dateValue(date??''),quality,rfi,risk:{...risk,undatedStatusCounts:undatedRiskStatusCounts,snapshotCandidates,validation:riskValidation},knownCounts:{
    openNcrCount:quality.current.filter(r=>r.status==='open').length,
    overdueNcrCount:quality.current.filter(r=>r.status==='open'&&dueBefore(dateValue(date??''),r.dueIso)).length,
    openCriticalMajorNcrCount:quality.current.filter(r=>r.status==='open'&&['critical','major'].includes(r.severity)).length,
    uncertainCriticalMajorNcrCount:quality.current.filter(r=>r.status==='unknown'&&r.severity!=='minor'||r.status==='open'&&r.severity==='unknown').length,
  },counts:{
    openNcrCount:quality.complete?quality.current.filter(r=>r.status==='open').length:null,
    overdueNcrCount:quality.complete&&ncrDueKnown&&!!dateValue(date??'')?
      quality.current.filter(r=>r.status==='open'&&dueBefore(dateValue(date??''),r.dueIso)).length:null,
    openCriticalMajorNcrCount:quality.complete&&severityKnown?quality.current.filter(r=>r.status==='open'&&['critical','major'].includes(r.severity)).length:null,
    openRfiCount:rfi.complete?rfi.current.filter(r=>r.status==='open').length:null,
    overdueRfiCount:rfi.complete&&dueKnown?rfi.current.filter(r=>r.status==='open'&&r.dueIso!<dateValue(date??'')!).length:null,
    openRiskCount:risk.complete?risk.current.filter(r=>r.status==='open').length:null,
  }};
}
export type OperationalReporting = ReturnType<typeof operationalControlsAsOf>;
