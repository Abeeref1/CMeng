import {cell,dateValue,norm,numberValue,partitionAsOf,sourceTables,type SourceRow} from '../../truth-kernel/src';
import type {NcrRecord,RfiRecord} from '../../project-director/src';
import type {ProjectRuntimeState,RiskControlRecord} from './project-state-types';

type Lifecycle = {raisedIso?:string|null;closedIso?:string|null;statusAsOfIso?:string|null;sourceRefs:string[]};
const derived=(row:{sourceRefs:string[]})=>row.sourceRefs.some(ref=>ref.startsWith('evidence-document:'));
const refs=(row:SourceRow)=>['evidence-document:'+row.receipt.documentId+':'+row.receipt.locator];
const responsibility=(row:SourceRow)=>({owner:cell(row,'owner','responsible person','assigned to')||null,linkedActivityId:cell(row,'linked activity','activity id')||null,subject:cell(row,'subject','description')||null});
const dates=(row:SourceRow)=>({raisedIso:dateValue(cell(row,'raised date','opened date','issue date','identified date')),
  closedIso:dateValue(cell(row,'close date','closed date','response date','answered date')),
  statusAsOfIso:dateValue(cell(row,'status as of','status date','snapshot date','as of date'))});
const ncrStatus=(raw:string):NcrRecord['status']=>/^(closed|complete|completed|resolved)$/.test(norm(raw))?'closed':/^(open|active|in progress|overdue)$/.test(norm(raw))?'open':'unknown';
const rfiStatus=(raw:string):RfiRecord['status']=>/^(closed|complete|completed)$/.test(norm(raw))?'closed':/^(answered|responded)$/.test(norm(raw))?'answered':/^(open|active|pending|overdue)$/.test(norm(raw))?'open':'unknown';

/** Reconstruct lifecycle status from actual dates. A future closure never closes
 * an earlier reporting position; an undated final status never backdates itself.
 * Original source rows and excluded IDs are retained for inspection. */
function scope<T extends Lifecycle & {status:string}>(rows:T[],name:string,id:(row:T)=>string,date:string|null,hasSource:boolean,diagnostics:string[]) {
  const cutoff=dateValue(date??'');
  const partition=partitionAsOf(rows,{name,entity:name,dataDateIso:date,dateBasis:'raised date, with dated closure/response and explicit status snapshot',id,date:r=>r.raisedIso??r.statusAsOfIso});
  const current=partition.asOf.map(row=>{
    const closed=dateValue(row.closedIso??''),raised=dateValue(row.raisedIso??'');
    let status=row.status;
    if(closed&&raised&&closed<raised){status='unknown';diagnostics.push('CLOSURE_BEFORE_RAISED_DATE:'+id(row));}
    else if(closed&&cutoff)status=closed<=cutoff?(row.status==='answered'?'answered':'closed'):'open';
    else if(row.status!=='open'&&(!row.statusAsOfIso||row.statusAsOfIso!==cutoff))status='unknown';
    return {...row,status};
  });
  const unknownStatusCount=current.filter(r=>r.status==='unknown').length;
  return {...partition,current,sourceRows:rows,sourceRecordCount:rows.length,currentRecordCount:current.length,
    futureRecordCount:partition.future.length,undatedRecordCount:partition.undated.length,unknownStatusCount,
    state:!hasSource?'missing':partition.undated.length||unknownStatusCount||diagnostics.length?'partial':'established',
    diagnostics:[...diagnostics],complete:hasSource&&Boolean(cutoff)&&partition.undated.length===0&&unknownStatusCount===0&&diagnostics.length===0};
}

export function operationalControlsAsOf(state:ProjectRuntimeState,date:string|null) {
  const docs=state.evidenceDocuments.filter(d=>['quality_ncr_register','rfi_register','risk_register'].includes(d.documentType)&&['active','additive'].includes(d.basisState));
  const diagnostics:string[]=[];
  const tables=sourceTables(docs,diagnostics);
  const docIds=(type:string)=>new Set(docs.filter(d=>d.documentType===type).map(d=>d.documentId));
  const rows=(type:string)=>tables.filter(t=>docIds(type).has(t.document.documentId)).flatMap(t=>t.rows);
  const manual=<T extends {sourceRefs:string[]}>(items:T[]|undefined,type:string)=>(items??[]).filter(r=>!derived(r)||docIds(type).size===0);
  const ncrs:NcrRecord[]=[...manual(state.controls.ncrs,'quality_ncr_register'),...rows('quality_ncr_register').map(row=>({
    ncrId:cell(row,'ncr id'),severity:(/^(critical)$/.test(norm(cell(row,'severity')))?'critical':/^(major|high)$/.test(norm(cell(row,'severity')))?'major':/^(minor|low)$/.test(norm(cell(row,'severity')))?'minor':'unknown') as NcrRecord['severity'],
    status:ncrStatus(cell(row,'status')),dueIso:dateValue(cell(row,'due date','required close date')),...responsibility(row),...dates(row),sourceRefs:refs(row)}))];
  const rfis:RfiRecord[]=[...manual(state.controls.rfis,'rfi_register'),...rows('rfi_register').map(row=>({rfiId:cell(row,'rfi id'),
    status:rfiStatus(cell(row,'status')),...responsibility(row),dueIso:dateValue(cell(row,'required response','due date')),...dates(row),sourceRefs:refs(row)}))];
  const risks:RiskControlRecord[]=[...manual(state.controls.risks,'risk_register'),...rows('risk_register').map(row=>({riskId:cell(row,'risk id'),
    status:(/^(open|active|mitigating|in progress)$/.test(norm(cell(row,'status')))?'open':/^(closed|resolved)$/.test(norm(cell(row,'status')))?'closed':'unknown') as RiskControlRecord['status'],
    sourceStatus:cell(row,'status'),rating:cell(row,'rating')||null,owner:cell(row,'owner')||null,dueIso:dateValue(cell(row,'due date')),...dates(row),sourceRefs:refs(row)}))];
  const prepare=<T>(items:T[],type:string,id:(r:T)=>string)=>{
    const ds=diagnostics.filter(d=>[...docIds(type)].some(key=>d.includes(key)));
    const ids=items.map(id);if(ids.some(x=>!x))ds.push('RECORD_ID_MISSING');
    if(new Set(ids).size!==ids.length)ds.push('DUPLICATE_RECORD_ID');
    return ds;
  };
  const quality=scope(ncrs,'NCR register',r=>r.ncrId,date,docs.some(d=>d.documentType==='quality_ncr_register')||ncrs.length>0,prepare(ncrs,'quality_ncr_register',r=>r.ncrId));
  const rfi=scope(rfis,'RFI register',r=>r.rfiId,date,docs.some(d=>d.documentType==='rfi_register')||rfis.length>0,prepare(rfis,'rfi_register',r=>r.rfiId));
  const risk=scope(risks,'Risk register',r=>r.riskId,date,docs.some(d=>d.documentType==='risk_register')||risks.length>0,prepare(risks,'risk_register',r=>r.riskId));
  const scoreRows=rows('risk_register').map(row=>{
    const probability=numberValue(cell(row,'probability')),impact=numberValue(cell(row,'impact'));
    return {riskId:cell(row,'risk id'),probability,impact,score:probability!==null&&impact!==null&&probability>=0&&impact>=0?Number((probability*impact).toFixed(6)):null,
      rating:cell(row,'rating')||null,dueIso:dateValue(cell(row,'due date')),sourceRefs:refs(row)};
  });
  const scoreGroups=[...new Set(scoreRows.map(r=>r.score).filter((n):n is number=>n!==null))].sort((a,b)=>a-b).map(score=>{
    const members=scoreRows.filter(r=>r.score===score);return {score,recordCount:members.length,ratings:[...new Set(members.map(r=>r.rating).filter(Boolean))],counts:[...new Set(members.map(r=>r.rating))].map(rating=>({rating,count:members.filter(r=>r.rating===rating).length})),riskIds:members.map(r=>r.riskId)};
  });
  const ratingInconsistencyGroups=scoreGroups.filter(g=>g.ratings.length>1);
  const riskValidation={state:ratingInconsistencyGroups.length?'conflicted':scoreRows.length&&scoreRows.every(r=>r.score!==null&&r.rating!==null)?'consistent_in_checked_scores':'review_required',sourceRecordCount:risks.length,
    sourceFactKey:'RISK_RATING_SCORE_CONFLICT',
    scoreBasis:'Source probability × impact; no rating thresholds are invented. Identical scores with different supplied ratings require a documented rating method.',
    ratingInconsistencyGroups,scoreGroups,scoreRows,
    statusDateMissingCount:risk.undatedRecordCount,
    dueAfterDataDateCount:scoreRows.filter(r=>dateValue(date??'')&&r.dueIso&&r.dueIso>dateValue(date??'')!).length,
    sourceRefs:scoreRows.flatMap(r=>r.sourceRefs),
    diagnostics:ratingInconsistencyGroups.length?['RISK_RATING_SCORE_CONFLICT']:[],
    explanation:risks.length+' risk records are present. '+(ratingInconsistencyGroups.length?ratingInconsistencyGroups.length+' probability × impact scores have inconsistent supplied ratings. ':'')+
      risk.undatedRecordCount+' records lack an identified/status-as-of date. Action due dates do not establish when the risk was open.'};
  const severityKnown=quality.current.every(r=>r.status!=='open'||r.severity!=='unknown');
  const dueKnown=rfi.current.every(r=>r.status!=='open'||r.dueIso!==null);
  const actionRows=[
    ...quality.current.filter(r=>r.status==='open'&&['critical','major'].includes(r.severity)).map(r=>({recordId:r.ncrId,type:'NCR',priority:r.severity,owner:r.owner??null,dueIso:r.dueIso??null,raisedIso:r.raisedIso??null,subject:r.subject??null,linkedActivityId:r.linkedActivityId??null,sourceRefs:r.sourceRefs,action:'Resolve the NCR and record closure evidence; confirm the responsible owner and due date where absent.'})),
    ...rfi.current.filter(r=>r.status==='open'&&r.dueIso&&dateValue(date??'')&&r.dueIso<dateValue(date??'')!).map(r=>({recordId:r.rfiId,type:'RFI',priority:'overdue',owner:r.owner??null,dueIso:r.dueIso,raisedIso:r.raisedIso??null,subject:r.subject??null,linkedActivityId:r.linkedActivityId??null,sourceRefs:r.sourceRefs,action:'Obtain the overdue response; record the decision and linked activity impact.'}))
  ].map(row=>({...row,ageDays:row.raisedIso&&date?Math.max(0,Math.floor((Date.parse(date.slice(0,10))-Date.parse(row.raisedIso.slice(0,10)))/86400000)):null,
    overdueDays:row.dueIso&&date?Math.max(0,Math.floor((Date.parse(date.slice(0,10))-Date.parse(row.dueIso.slice(0,10)))/86400000)):null,
    missingActionFields:[...(!row.owner?['Owner']:[]),...(!row.dueIso?['Due date']:[])]}))
    .sort((a,b)=>Number(b.priority==='critical')-Number(a.priority==='critical')||(b.overdueDays??-1)-(a.overdueDays??-1)||(b.ageDays??-1)-(a.ageDays??-1)||a.recordId.localeCompare(b.recordId));
  return {actions:actionRows,dataDateIso:dateValue(date??''),quality,rfi,risk:{...risk,validation:riskValidation},knownCounts:{
    openCriticalMajorNcrCount:quality.current.filter(r=>r.status==='open'&&['critical','major'].includes(r.severity)).length,
    uncertainCriticalMajorNcrCount:quality.current.filter(r=>r.status==='unknown'&&r.severity!=='minor'||r.status==='open'&&r.severity==='unknown').length,
  },counts:{
    openCriticalMajorNcrCount:quality.complete&&severityKnown?quality.current.filter(r=>r.status==='open'&&['critical','major'].includes(r.severity)).length:null,
    openRfiCount:rfi.complete?rfi.current.filter(r=>r.status==='open').length:null,
    overdueRfiCount:rfi.complete&&dueKnown?rfi.current.filter(r=>r.status==='open'&&r.dueIso!<dateValue(date??'')!).length:null,
    openRiskCount:risk.complete?risk.current.filter(r=>r.status==='open').length:null,
  }};
}
export type OperationalReporting = ReturnType<typeof operationalControlsAsOf>;
