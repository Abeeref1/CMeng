export const recoveryScenarioScript=String.raw`
function recoveryScenarioResult(result){
 const r=result||{};
 return '<p>'+escapeHtml(r.qualification||'User assumptions remain separate from source evidence and approved dates.')+'</p>'+
  (r.state==='programme_changed'?'<p class="notice warn">'+escapeHtml(r.reason)+'</p>':'')+
  (r.reference?'<p>Reference: '+escapeHtml(r.reference)+'</p>':'')+
  (r.fromIso?'<p>'+escapeHtml(r.fromIso)+' to '+escapeHtml(r.targetIso)+' (target day excluded). Scope: '+escapeHtml(r.scopeCoverage)+'</p>':'')+
  ((r.rows||[]).length?basisTable(['Trade / work front','Required labour hours','Capacity hours in period','Capacity less demand (h)','Required working days','Required people per shift','Assumed units / working day','Conditional result'],r.rows.map(row=>[
    row.scope,row.requiredLaborHours,row.availableLaborHours,row.capacityGapHours,row.requiredWorkingDays,row.requiredPeoplePerShift,
    row.assumedProductionUnitsPerWorkingDay===null?null:fmt(row.assumedProductionUnitsPerWorkingDay)+' '+row.unit,
    row.state==='inputs_incomplete'?'Missing: '+row.missingInputs.map(humanizeKey).join(', '):row.state==='conditional_shortfall'?'Capacity shortfall for this scope':'Entered capacity covers this scope'
  ])):'<p>No current numeric scenario is saved.</p>');
}
function recoveryScenarioPanel(result){return '<section class="planning-panel" id="recoveryScenarioSummary"><h4>Recovery assumptions by trade or work front</h4>'+recoveryScenarioResult(result)+'<button class="btn" onclick="openRecoveryScenario()">Enter or edit recovery assumptions</button></section>';}
let recoveryEditorState=null;
function recoveryTradeHtml(row={}){
 const number=(key,label,min=0,max='',step='any')=>'<label>'+label+' <input data-recovery-field="'+key+'" type="number" min="'+min+'" '+(max!==''?'max="'+max+'" ':'')+'step="'+step+'" value="'+escapeHtml(row[key]??'')+'"></label>';
 return '<fieldset data-recovery-trade><legend>Trade or work front</legend><label>Distinct scope <input data-recovery-field="scope" value="'+escapeHtml(row.scope||'')+'" required></label><label>Labour demand basis <select data-recovery-field="demandBasis"><option value="hours" '+(row.demandBasis!=='quantity_norm'?'selected':'')+'>Remaining labour hours</option><option value="quantity_norm" '+(row.demandBasis==='quantity_norm'?'selected':'')+'>Remaining quantity × assumed labour hours/unit</option></select></label>'+
  '<div data-recovery-hours>'+number('remainingHours','Remaining labour hours')+'</div><div data-recovery-norm>'+number('remainingQuantity','Remaining quantity')+'<label>Quantity unit <input data-recovery-field="unit" value="'+escapeHtml(row.unit||'')+'"></label>'+number('laborHoursPerUnit','Assumed labour hours per unit',0)+'</div>'+
  '<div class="delivery-toolbar">'+number('crewCount','Crews per shift',0,'','1')+number('peoplePerCrew','People per crew',1,'','1')+number('productiveHoursPerShift','Productive hours per shift',0,24)+number('shiftsPerWorkingDay','Shifts per working day (separate crews)',1,24,'1')+number('availableWorkingDays','Available working days in this period')+'</div><button class="btn small" type="button" data-recovery-remove>Remove row</button></fieldset>';
}
function bindRecoveryTrade(node){
 const select=node.querySelector('[data-recovery-field="demandBasis"]');
 const toggle=()=>{for(const [selector,active] of [['[data-recovery-hours]',select.value==='hours'],['[data-recovery-norm]',select.value==='quantity_norm']]){const group=node.querySelector(selector);group.hidden=!active;group.querySelectorAll('input').forEach(input=>input.disabled=!active);}};
 select.onchange=toggle;toggle();node.querySelector('[data-recovery-remove]').onclick=()=>node.remove();
}
function recoveryEditorCurrent(state){return recoveryEditorState===state&&project()===state.owner&&projectRequestSeq===state.seq&&state.panel.isConnected;}
function fillRecoveryEditor(state){
 const {view,panel}=state,saved=view.saved?.state==='saved'?view.saved:null;
 panel.innerHTML='<h4>Recovery assumptions</h4><p>'+escapeHtml(view.programme?.sourceFilename||'Current programme')+' · '+escapeHtml(view.programme?.dataDateIso||'Data Date not supplied')+'</p>'+recoveryScenarioResult(view.result)+
  (!view.programme?'<p>Load or select the current programme before saving a scenario.</p>':'<form id="recoveryScenarioForm"><div class="delivery-toolbar"><label>Scenario start <input id="recoveryFrom" type="date" required value="'+escapeHtml(saved?.fromIso||view.programme.dataDateIso?.slice(0,10)||'')+'"></label><label>Target (excluded from day count) <input id="recoveryTarget" type="date" required value="'+escapeHtml(saved?.targetIso||'')+'"></label></div><p>Enter available working days for each scope. No working week, holiday calendar or production rate is assumed. Blank numeric inputs stay unknown; zero crews means no capacity. Quantity units must match the labour norm.</p><label>Scope covered and exclusions <textarea id="recoveryScope" required>'+escapeHtml(saved?.scopeCoverage||'')+'</textarea></label><div id="recoveryTrades">'+(saved?.trades||[{}]).map(recoveryTradeHtml).join('')+'</div><button type="button" class="btn" id="recoveryAddTrade">Add trade / work front</button><label>Assumption or review reference <input id="recoveryReference" required value="'+escapeHtml(saved?.reference||'')+'"></label><p>Saving records assumptions only. It does not approve crew availability, adopt a source productivity rate, change source hours or establish project-wide feasibility.</p><button class="btn primary" type="submit">Save and calculate scenario</button> <button class="btn" type="button" id="recoveryClear">Clear saved scenario</button></form>')+
  '<p id="recoveryFeedback" role="status"></p><button class="btn" id="recoveryClose">Close</button>';
 panel.querySelector('#recoveryClose').onclick=()=>{if(recoveryEditorState===state)recoveryEditorState=null;panel.remove();};
 if(!view.programme)return;
 panel.querySelectorAll('[data-recovery-trade]').forEach(bindRecoveryTrade);
 panel.querySelector('#recoveryAddTrade').onclick=()=>{const host=panel.querySelector('#recoveryTrades');host.insertAdjacentHTML('beforeend',recoveryTradeHtml());bindRecoveryTrade(host.lastElementChild);};
 panel.querySelector('#recoveryScenarioForm').onsubmit=event=>{event.preventDefault();saveRecoveryScenario('save');};
 panel.querySelector('#recoveryClear').onclick=()=>saveRecoveryScenario('clear');
}
async function openRecoveryScenario(){
 const owner=project(),seq=projectRequestSeq;
 el('recoveryScenarioEditor')?.remove();
 const panel=document.createElement('section');panel.id='recoveryScenarioEditor';panel.className='planning-panel primary';panel.innerHTML='<p>Loading saved assumptions…</p>';el('moduleContent').prepend(panel);panel.scrollIntoView({block:'start'});
 const state={owner,seq,panel,view:null};recoveryEditorState=state;
 try{const view=await api('/api/projects/'+encodeURIComponent(owner)+'/recovery-scenario');if(!recoveryEditorCurrent(state))return;state.view=view;fillRecoveryEditor(state);}
 catch(error){if(recoveryEditorCurrent(state))panel.innerHTML='<p>'+escapeHtml(error.message||'Unable to load the scenario. Reopen to retry.')+'</p>';}
}
async function saveRecoveryScenario(action){
 const state=recoveryEditorState;if(!state?.view||!recoveryEditorCurrent(state)||state.saving)return;
 const {panel,view}=state,get=id=>panel.querySelector('#'+id).value;
 const trades=[...panel.querySelectorAll('[data-recovery-trade]')].map(node=>{
  const field=key=>node.querySelector('[data-recovery-field="'+key+'"]'),basis=field('demandBasis').value;
  const number=key=>{const input=field(key);return input.disabled||input.value.trim()===''?null:Number(input.value);};
  return {scope:field('scope').value,demandBasis:basis,remainingHours:number('remainingHours'),remainingQuantity:number('remainingQuantity'),unit:basis==='quantity_norm'?field('unit').value:'',laborHoursPerUnit:number('laborHoursPerUnit'),crewCount:number('crewCount'),peoplePerCrew:number('peoplePerCrew'),productiveHoursPerShift:number('productiveHoursPerShift'),shiftsPerWorkingDay:number('shiftsPerWorkingDay'),availableWorkingDays:number('availableWorkingDays')};
 });
 const request={action,expectedVersion:view.projectVersion,sourceFingerprint:view.programme.sourceFingerprint,reference:get('recoveryReference'),scopeCoverage:get('recoveryScope'),fromIso:get('recoveryFrom'),targetIso:get('recoveryTarget'),trades};
 state.saving=true;panel.querySelector('#recoveryFeedback').textContent='Saving assumptions…';
 try{const next=await api('/api/projects/'+encodeURIComponent(state.owner)+'/recovery-scenario',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(request)});if(!recoveryEditorCurrent(state))return;
  state.view=next;fillRecoveryEditor(state);panel.querySelector('#recoveryFeedback').textContent=action==='clear'?'Saved scenario cleared; its history is retained.':'Scenario saved. Results remain conditional on the entered assumptions.';
  const summary=el('recoveryScenarioSummary');if(summary)summary.outerHTML=recoveryScenarioPanel(next.result);
  if(currentModuleResult?.data)currentModuleResult.data.recoveryScenario=next.result;
 }catch(error){if(recoveryEditorCurrent(state))panel.querySelector('#recoveryFeedback').textContent=error.message||'Scenario not saved. Reopen it if project records changed.';}
 finally{state.saving=false;}
}
`;
