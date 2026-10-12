export const answerFirstStyles=String.raw`
.completion-position{border:1px solid #cddbea;border-radius:10px;padding:20px;margin:0 0 22px;background:#f8fbfe}.completion-position h4{margin:0 0 12px;font-size:20px}.completion-position p{margin:10px 0;line-height:1.6}.completion-position .planning-kpi-grid{background:#fff}.completion-position details{margin-top:14px}.completion-position summary{cursor:pointer;font-weight:650;color:#245783}.analysis-summary{color:#344f69;font-size:13px;line-height:1.6}.review-inline{margin-top:14px;padding:16px;background:#f8fbfe;border:1px solid #dce4ee;border-radius:8px}.review-inline summary{cursor:pointer}.review-inline p{overflow-wrap:anywhere}.review-inline .table-wrap{max-height:440px}.project-action-list .completion-position{margin-top:12px}.position-qualifications{margin-top:22px}.position-qualifications>summary{cursor:pointer}.project-review-drawer{border:1px solid #dce4ee;background:#fff;border-radius:10px;padding:18px;margin:12px 0 22px}.project-review-drawer>summary{font-size:17px;font-weight:650;cursor:pointer}
`;
export const answerFirstScript=String.raw`
function renderCompletionPosition(p,detailsOpen=false){
 if(!p)return '';
 const difference=p.differenceElapsedDays;
 const delta=typeof difference==='number'?(difference>0?'+':'')+fmt(difference)+' elapsed days':'Not comparable';
 const values=planningKpis([
  ['Submitted programme finish',p.submittedFinishIso?planningShortDate(p.submittedFinishIso):'Not available','Current reporting programme'],
  ['CMeng calendar recalculation',p.independentFinishIso?planningShortDate(p.independentFinishIso):'Not available',p.calculationState==='scenario'?'Calculated with assumptions':p.calculationState==='calculated'?'Calculated from programme calendars':'Full network not calculable'],
  ['Difference',delta,'Recalculation minus submitted finish; includes time of day'],
  [p.extendedContractFinishIso?'Contract completion including awarded EOT':'Contractual completion',(p.extendedContractFinishIso||p.contractualFinishIso)?planningShortDate(p.extendedContractFinishIso||p.contractualFinishIso):'Not confirmed',p.extendedContractFinishIso?'Original completion '+planningShortDate(p.contractualFinishIso)+' plus awarded time':'Separate contract comparison']
 ]);
 const limits=p.limitations||[];
 return '<section class="completion-position" aria-label="Completion position"><h4>Completion position</h4>'+values+'<p><b>What this means:</b> '+escapeHtml(p.interpretation)+'</p><p>'+escapeHtml(p.contractNote)+'</p>'+
 '<details class="completion-difference"'+(detailsOpen?' open':'')+'><summary>Calculation basis'+(limits.length?' · '+fmt(limits.length)+' qualifications':'')+'</summary><p>'+escapeHtml(p.differenceBasis)+'</p>'+
 (p.coveragePercent!==null?'<p>'+escapeHtml(fmt(p.coveragePercent))+'% of execution activities calculated'+(p.activityCount!==null?' · '+fmt(p.activityCount)+' activities':'')+'.</p>':'')+
 (limits.length?'<ul>'+limits.map(l=>'<li>'+escapeHtml(l.text)+'</li>').join('')+'</ul>':'<p>No additional calculation assumptions are listed for this comparison.</p>')+
  '<p>The comparison identifies a difference; it does not by itself prove which activity or event caused project delay.</p>'+
  (p.differenceRows?.length?'<h5>Largest activity finish differences</h5><p>Showing '+fmt(p.differenceRows.length)+' of '+fmt(p.comparableActivityCount)+' comparable activities. These are date differences, not a ranking of proven delay causes.</p>'+basisTable(['Activity','Submitted finish','Recalculated finish','Elapsed days'],p.differenceRows.map(r=>[r.activityId+' · '+r.name,planningShortDate(r.submittedFinishIso),planningShortDate(r.calculatedFinishIso),fmt(r.differenceElapsedDays)])):'')+'</details></section>';
}
`;
