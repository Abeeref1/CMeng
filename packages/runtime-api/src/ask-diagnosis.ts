import type {AnalysisPlan,ProjectScope} from '../../project-ask/src/types';
import {AuthorityBuilder} from './ask-authority-builder';
import {moduleForProject} from './project-projections';
import {projectDiagnosisDetails} from './project-diagnosis';
import {matchFilter} from '../../project-ask/src/primitives';

export function askProjectDiagnosis(scope:ProjectScope,plan:AnalysisPlan){
 let d=projectDiagnosisDetails((moduleForProject(scope.projectId,'pmo-analysis').data as any)?.projectDiagnosis);
 const b=new AuthorityBuilder('project-diagnosis','Project diagnosis','pmo-analysis',scope,d?'partial':'unavailable',d?.summary??'Select the reporting programme to establish this project’s schedule diagnosis.');
 if(!d)return b.result;
 const recipe=plan.questionRecipe??'project_position',p=d.completion;
 let selectedIds:Set<string>|null=null;
 if(recipe==='delay_diagnosis'&&plan.diagnosisActivityFilters){
   const driving=new Set(d.network.rows.map((r:any)=>r.activityId)),pressure=new Set(d.pressureActivityIds);
   const rows=d.activities.filter((r:any)=>[...plan.filters,...plan.diagnosisActivityFilters!].every(f=>matchFilter({...r,onDrivingNetwork:d.network.state==='unavailable'?null:driving.has(r.activityId),schedulePressure:pressure.has(r.activityId),critical:r.criticality==='unknown'?null:r.criticality==='critical'},f)));
   selectedIds=new Set(rows.map((r:any)=>r.activityId));const ids=selectedIds;
   d={...d,summary:rows.length+' activities match your preceding selection. '+rows.slice(0,5).map((r:any)=>r.activityId+' — '+r.name+' ('+(r.totalFloatHours===null?'float unavailable':r.totalFloatHours+' hours float')+')').join('; ')+'.',actions:d.actions.filter((r:any)=>ids.has(r.activityId)),evidenceChecks:d.evidenceChecks.filter((r:any)=>ids.has(r.activityId)),milestoneRows:d.milestoneRows.filter((r:any)=>ids.has(r.activityId)),revision:{...d.revision,largestChanges:d.revision.largestChanges.filter((r:any)=>ids.has(r.activityId))}};
 }
 const labels:Record<string,string>={critical:'Critical · known',negativeFloat:'Negative float · known',zeroFloat:'Zero float · known',nearCritical:'Near-critical · known',missedStarts:'Missed starts · known',overdueFinishes:'Overdue finishes · known',baselineSlippage:'Later than baseline · known',previousUpdateSlippage:'Slipped since previous revision · known'};
 for(const [id,label] of Object.entries(labels)){const c=d.counts[id];b.metric(id,label,c.knownCount,'activities','Existing activity authority. '+c.unresolvedCount+' of '+c.population+' activities lack fields needed for the complete count; known matches are not the complete population.',{refs:[scope.programmeRevision??'']});}
 if(p){b.metric('submitted-finish','Submitted finish',p.submittedFinishIso,null,'Current adopted programme.',{fact:true});b.metric('calculated-finish','Calendar recalculation',p.independentFinishIso,null,p.differenceBasis,{state:p.calculationState});}
 let wbs=d.wbsRows.filter((r:any)=>r.pressureCount>0);
 if(recipe==='wbs_pressure'&&plan.diagnosisActivityFilters!==undefined){
   const driving=new Set(d.network.rows.map((r:any)=>r.activityId)),pressure=new Set(d.pressureActivityIds),groups=new Map<string,any>(),wbsById=new Map(d.wbsRows.map((w:any)=>[w.wbsId,w]));
   const filters=[...plan.filters,...plan.diagnosisActivityFilters!];
   const applicable=d.activities.map((r:any)=>({...r,onDrivingNetwork:d.network.state==='unavailable'?null:driving.has(r.activityId),schedulePressure:pressure.has(r.activityId),critical:r.criticality==='unknown'?null:r.criticality==='critical'}))
     .filter((r:any)=>filters.every(f=>matchFilter(r,f)));
   for(const r of applicable){const original:any=wbsById.get(r.wbsId);const key=r.wbsId??'',g=groups.get(key)??{wbsId:r.wbsId,wbs:original?.wbs??key,activityCount:0,pressureCount:0,drivingCount:0,criticalCount:0,negativeFloatCount:0,missedStartCount:0,overdueFinishCount:0,worstFloatHours:null};
     g.activityCount++;g.pressureCount+=pressure.has(r.activityId)?1:0;g.drivingCount+=driving.has(r.activityId)&&['not_started','in_progress'].includes(r.status)?1:0;g.criticalCount+=r.critical===true?1:0;g.negativeFloatCount+=typeof r.totalFloatHours==='number'&&r.totalFloatHours<0?1:0;g.missedStartCount+=r.missedPlannedStart===true?1:0;g.overdueFinishCount+=r.finishOverdue===true?1:0;if(typeof r.totalFloatHours==='number')g.worstFloatHours=g.worstFloatHours===null?r.totalFloatHours:Math.min(g.worstFloatHours,r.totalFloatHours);groups.set(key,g);}
   wbs=[...groups.values()].sort((a,b)=>b.drivingCount-a.drivingCount||b.pressureCount-a.pressureCount||b.activityCount-a.activityCount);
   b.result.metrics=[];b.metric('matching-activities','Activities in your preceding selection',applicable.length,'activities','The previous request’s filters, applied before grouping by WBS. Top N is not treated as the full population. Missing filter values are excluded; no absent value is treated as zero.');
 }
 if(recipe==='wbs_pressure')b.result.explanation=wbs.length?'Schedule pressure is concentrated in '+wbs.slice(0,3).map((r:any)=>r.wbs+' ('+r.drivingCount+' unfinished finish-driving; '+r.pressureCount+' pressure activities)').join('; ')+'. Counts describe concentration, not a proven allocation of delay days.':'No confirmed WBS schedule-pressure concentration is established from the available fields.';
 if(recipe==='revision_change')b.result.explanation=d.revision.state==='available'?'Compared the adopted revisions '+d.revision.fromRevisionId+' and '+d.revision.toRevisionId+'. '+d.revision.modified+' changed, '+d.revision.added+' added and '+d.revision.removed+' removed activities. '+(d.revision.finishMovementCalendarDays===null?'Completion movement is unavailable.':'Submitted completion moved '+d.revision.finishMovementCalendarDays+' elapsed calendar days.'):d.revision.basis;
 if(recipe==='management_actions')b.result.explanation=d.actions.length?'Start with the '+d.actions.length+' actions below. '+d.rankingBasis:'No confirmed activity action can be ranked from the current fields.';
 if(recipe==='no_change_outlook')b.result.explanation=d.noChangeOutlook;
 if(recipe==='milestone_exposure')b.result.explanation=d.milestoneRows.length+' unfinished milestones have exposure in the existing milestone checks. Their individual dates, float and reasons are listed below.';
 if(recipe==='delay_diagnosis'){
   const linked=d.evidenceChecks.filter((c:any)=>c.state==='linked_pressure').slice(0,3);
   b.result.explanation=d.summary+(linked.length?' Linked evidence: '+linked.map((c:any)=>c.activityId+' — '+c.explanation).join(' '):' No specific linked non-schedule blocker is established for these pressure activities.')+' '+d.noChangeOutlook+(d.counts.baselineSlippage.knownCount===null?' No baseline has been confirmed, so delay against the original planned dates cannot be measured.':'');
 }
 if(selectedIds){b.result.metrics=[];b.metric('matching-activities','Activities in your preceding selection',selectedIds.size,'activities','Prior activity filters applied to the full population. Missing filter values are excluded. Whole-project completion remains context, not a recalculated finish for this subset.');}
 if(plan.filters.length&&!selectedIds&&plan.diagnosisActivityFilters===undefined)b.result.explanation='Project-wide context (the tables retain your requested filters): '+b.result.explanation;
 const units={totalFloatHours:{unit:'hours'},worstFloatHours:{unit:'hours'},remainingDurationHours:{unit:'hours'},finishMovementCalendarDays:{unit:'elapsed calendar days'},previousFinishMovementCalendarDays:{unit:'elapsed calendar days'},percentComplete:{unit:'%'},wbsId:{dimension:true}};
 if(!selectedIds&&!['revision_change','no_change_outlook','milestone_exposure'].includes(recipe)){
   b.table('wbs-pressure','Where schedule pressure is concentrated',wbs,'Disjoint assigned WBS groups. Pressure activities are counted once per group; critical, negative-float and driving counts overlap and must not be added together.',units);
   if(recipe!=='wbs_pressure')b.table('actions','Activities needing management attention',d.actions,d.rankingBasis,units);
 }
 if(['delay_diagnosis','project_position','management_actions'].includes(recipe)){
   b.table('linked-evidence','What the linked records show',d.evidenceChecks,d.evidenceCoverage.basis,{},r=>({...r,issueCount:r.state==='linked_pressure'?1:0}));
 }
 if(['delay_diagnosis','project_position','management_actions','milestone_exposure'].includes(recipe)){
   b.table('milestones','Exposed milestones',d.milestoneRows,'Existing milestone priorities, current dates and source float. A forecast exposure is not proof of contractual lateness.',units);
 }
 if(['revision_change','delay_diagnosis','project_position'].includes(recipe))b.table('revision-changes','Largest activity date changes',d.revision.largestChanges,d.revision.basis,units);
 if(recipe==='no_change_outlook')b.table('outlook','Current no-change outlook',[{submittedFinish:p?.submittedFinishIso??null,calendarRecalculation:p?.independentFinishIso??null,calculationState:p?.calculationState??'unavailable',contractCompletion:p?.contractualFinishIso??null,interpretation:d.noChangeOutlook}],p?.differenceBasis??'Current source position only.');
 b.finding('limits','Scope of the diagnosis',d.limitation+(p?' '+p.contractNote:''),'Use the facts and links above; confirm only the missing input needed for the particular contractual or causal conclusion.');
 for(const t of b.result.traces)t.sourceRefs.push(scope.programmeRevision??'');
 return b.result;
}
