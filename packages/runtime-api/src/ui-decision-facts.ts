/** One reader for server-computed engineering decisions. It formats but never
 * calculates a KPI, joins source populations or decides a missing-value state. */
export const decisionFactsScript=String.raw`
const decisionColumns={
 productivity:[['BOQ item','itemNumber'],['Description','description'],['Area / section','area'],['Unit','unit'],['Contract quantity','contractQuantity'],['Installed quantity','installedQuantity'],['Installed %','installedPercent'],['Period installed','periodInstalledQuantity'],['Period progress %','periodProgressPercent'],['Required quantity / calendar day','requiredRatePerCalendarDay'],['Earned hours','earnedHours'],['Actual period hours','actualHours'],['Output / actual hour','productivityPerActualHour'],['Installed value','installedValue'],['Currency','currency'],['Target finish','targetFinishIso'],['Exact missing inputs','missingInputs']],
 areas:[['Area / section','area'],['Currency','currency'],['BOQ items','itemCount'],['Measured items','measuredItemCount'],['Priced scope value','contractValue'],['Installed value','installedValue'],['Measured physical %','physicalProgressPercent'],['Certified value','certifiedValue'],['Certified %','certifiedProgressPercent'],['Installed less certified','installedAgainstCertified'],['Exact missing inputs','missingInputs']],
 erosion:[['Activity','activityReference'],['Name','name'],['Current float h','currentFloatHours'],['Previous float h','previousFloatHours'],['Erosion h / month','floatErosionHoursPerMonth'],['Turns critical by · scenario','turnsCriticalByIso'],['Finish slip days / month','slipDaysPerMonth'],['Trend state','state']],
 claims:[['Claim / event','claimReference'],['Event notice','noticeDateIso'],['Detailed claim due','dueDateIso'],['Detailed submission','detailedSubmissionDateIso'],['Allowed calendar days','allowedDays'],['Days after due','daysAfterDue'],['Detailed-claim check','detailedClaimState'],['Window start','windowStartIso'],['Window end','windowEndIso'],['Long-window review','warning'],['Exact missing inputs','missingInputs']],
 windows:[['Claim / event','claimReference'],['Window start','windowStartIso'],['Window end','windowEndIso'],['Calendar days','windowCalendarDays'],['Review','warning']],
 paymentDue:[['Certificate','certificateReference'],['Stage','sourceStatus'],['Certification date','certificationDateIso'],['Contract period days','paymentPeriodDays'],['Contract due date','contractDueDateIso'],['Actual payment date','actualPaymentDateIso'],['Days late','daysLate'],['Check','state'],['Included in certification','includedInCertifiedTotals'],['Contract due-date basis','basis'],['Exact missing inputs','missingInputs']],
 registers:[['Register','register'],['Currency','currency'],['Register total','registerTotal'],['Current contract sum','currentContractValue'],['Excess to reconcile','excess'],['Required review','action']]
};
function decisionDisplay(value,key){
 if(value===null||value===undefined)return 'Not in source';
 if(Array.isArray(value))return value.length?value.map(v=>readerText(v)).join('; '):'None identified';
 if(value&&typeof value==='object'&&Object.hasOwn(value,'value'))return managementValue(value);
 if(typeof value==='number')return managementNumber(value);
 if(typeof value==='boolean')return value?'Yes':'No';
 if(/Iso$/.test(key))return planningShortDate(value);
 if(key==='state'||key==='detailedClaimState'){
  const labels={already_critical:'Already critical at the Data Date',comparison_missing:'Previous comparable float not recorded',no_positive_erosion:'No positive float erosion',erosion_scenario:'Continuing-erosion scenario',notice_date_missing:'Event notice date missing',within_period:'Within the stated period',late:'Submitted after the stated period',overdue_no_submission:'Due date passed; submission not recorded',submission_not_recorded:'Submission not recorded',application_not_certified:'Application — not certified',due_basis_missing:'Contract due-date basis missing',payment_not_recorded:'Actual payment not recorded',paid_late:'Paid after the contract due date',paid_within_period:'Paid within the contract period'};
  return labels[value]||readerText(value);
 }
 return readerText(value);
}
function decisionPointer(root,pointer){let value=root;for(const k of pointer.split('/').slice(1))value=value?.[k.replace(/~1/g,'/').replace(/~0/g,'~')];return value;}
function decisionTable(kind,rows,pointer,total,offset=0,pageData=null){
 const cols=decisionColumns[kind]||[],meta=currentModuleResult?.responsePaging;
 const entry=meta?.tables?.find(t=>t.pointer===pointer&&t.kind==='array');
 const size=pageData?.total??entry?.total??total;
 const at=pageData?.offset??offset,available=pageData?.rows??rows??[],visible=available.slice(0,25);
 const start=visible.length?at+1:0,end=at+visible.length;
 const hasMore=pageData?Boolean(pageData.hasMore):typeof size==='number'&&end<size;
 const caption='Showing '+managementNumber(start)+'–'+managementNumber(end)+' of '+(typeof size==='number'?managementNumber(size):'total not established');
 const body=visible.map(row=>'<tr>'+cols.map(([label,key])=>'<td>'+escapeHtml(decisionDisplay(row[key],key))+'</td>').join('')+'</tr>').join('');
 return '<p class="decision-population">'+escapeHtml(caption)+'</p><div class="table-wrap"><table><thead><tr>'+cols.map(([label])=>'<th>'+escapeHtml(label)+'</th>').join('')+'</tr></thead><tbody>'+(body||'<tr><td colspan="'+cols.length+'">No applicable dated records were found in this source population.</td></tr>')+'</tbody></table></div><div class="actions">'+
  '<button class="btn small" '+(at===0?'disabled ':'')+'onclick="loadDecisionPage(&quot;'+kind+'&quot;,&quot;'+pointer+'&quot;,'+Math.max(0,at-25)+')">Previous records</button>'+
  '<button class="btn small" '+(hasMore?'':'disabled ')+'onclick="loadDecisionPage(&quot;'+kind+'&quot;,&quot;'+pointer+'&quot;,'+(at+25)+')">Next records</button></div>';
}
async function loadDecisionPage(kind,pointer,offset){
 const owner=project(),seq=projectRequestSeq,result=currentModuleResult,target=el('decision-'+kind);if(!result||!target)return;
 const metadata=result.responsePaging;
 try{
  let page;
  if(metadata?.source){
   const params=new URLSearchParams({source:metadata.source,pointer,offset:String(offset),limit:'25'});
   if(Number.isInteger(metadata.projectVersion))params.set('version',String(metadata.projectVersion));
   page=await api('/api/projects/'+encodeURIComponent(owner)+'/record-page?'+params);
  }else{const all=decisionPointer(result,pointer)||[];page={rows:all.slice(offset,offset+25),offset,total:all.length,hasMore:offset+25<all.length};}
  if(project()!==owner||projectRequestSeq!==seq||currentModuleResult!==result||!target.isConnected)return;
  if(!Array.isArray(page.rows))throw Error('Source row page was not returned');
  if(page.sourceLabels)Object.assign(result.data.sourceLabels??={},page.sourceLabels);
  target.innerHTML=decisionTable(kind,[],pointer,page.total,page.offset,page);
 }catch(e){if(project()===owner&&projectRequestSeq===seq&&currentModuleResult===result)target.insertAdjacentHTML('beforeend','<p role="alert">This source page could not be retrieved. The previous values are retained; retry the page.</p>');}
}
function decisionPanel(title,basis,kind,rows,pointer,total){return '<section class="planning-panel decision-panel"><div class="planning-panel-head"><h4>'+escapeHtml(title)+'</h4><p>'+escapeHtml(basis)+'</p></div><div class="planning-panel-body" id="decision-'+kind+'">'+decisionTable(kind,rows,pointer,total)+'</div></section>';}
function renderManagementCommercialFacts(data){
 const rows=data.briefCommercialPosition?.currencies??data.decisionAnalysis?.commercialSummary??data.projectFacts?.commercial?.currencies??[];
 if(!rows.length)return '<section class="planning-panel"><h4>Cost and certified cash position</h4><p>No dated cost/certification currency position has been established. Missing: a dated EAC or earned-value cost record and issued certificates with linked payment evidence. No zero is inferred.</p>'+managementModuleLink('cost-forecast','Review cost records')+'</section>';
 return '<section class="planning-panel"><h4>Commercial position · source period and currency retained</h4>'+rows.map(r=>'<h5>'+escapeHtml(r.currency)+(r.taxBasis?' · '+escapeHtml(humanizeKey(r.taxBasis))+' tax basis':'')+(r.asOf?' · '+escapeHtml(planningShortDate(r.asOf)):'')+'</h5>'+planningKpis([
  ['Current contract',r.currentContractValue,r.currency],['EAC · source reported',r.forecastEac,r.currency],['CPI',r.cpi,'Same period and money basis'],['Certified unpaid',r.certifiedUnpaidAmount,r.currency+' · issued certificates less linked cash']
 ])+(r.eacScenarios?.length?basisTable(['EAC scenario','Amount','Qualification'],r.eacScenarios.map(x=>[x.methodology??x.key??'Cost scenario',managementValue(x.value,r.currency),'Calculated scenario, not the source EAC'])):'')+'<p>'+escapeHtml(r.forecastEac?.basis?.method??r.forecastEac?.basis??'Source-reported EAC, not a determination')+'</p>').join('')+managementModuleLink('cost-forecast','Review cost and CPI evidence')+'</section>';
}
function renderDecisionAnalysis(key,data){
 const a=data?.decisionAnalysis;if(!a)return '';
 if(a.kind==='management_commercial')return '';
 if(a.kind==='float_erosion'){const t=a.trends;return '<p><b>Float erosion scenario:</b> '+escapeHtml(t.comparisonDateIso?'Comparison from '+planningShortDate(t.comparisonDateIso)+' to '+planningShortDate(a.dataDateIso):'A prior dated programme with comparable activity float is required.')+' No missing float becomes zero and no nonpositive erosion produces an invented critical date.</p>'+decisionPanel('When remaining float would be exhausted','Data Date plus remaining float divided by positive erosion per calendar month. The observed erosion is assumed to continue; this is a scenario, not a guaranteed forecast.','erosion',t.rows,'/data/decisionAnalysis/trends/rows',t.population);}
 if(a.kind==='finish_slip')return '<section class="planning-panel"><h4>Submitted finish slip rate</h4>'+planningKpis([['Slip rate',a.slipRate,'Calendar days per month; positive means slipping']])+'<p>'+escapeHtml(a.slipRate.basis)+'</p><p>'+escapeHtml(a.comparisonDateIso?'Comparison starts '+planningShortDate(a.comparisonDateIso):'Missing: previous and current comparable dated programmes.')+'</p>'+managementModuleLink('near-critical','Review activity float-erosion scenarios')+'</section>';
 if(a.kind==='measured_productivity')return decisionPanel('Installed progress, required production and earned hours',a.quantities.basis+' Missing productivity inputs are named per item. Planned programme progress never substitutes for measured installation.','productivity',a.quantities.items,'/data/decisionAnalysis/quantities/items',a.quantities.itemCount);
 if(a.kind==='area_progress')return decisionPanel('Measured physical and certified progress by area','Area totals use explicit source area or BOQ section associations within one currency. Whole-project certificates are not allocated across areas without source evidence. Coverage is shown alongside each measure.','areas',a.areas,'/data/decisionAnalysis/areas',a.areaCount);
 if(a.kind==='detailed_claims')return decisionPanel('Fully detailed claim deadlines',a.claimChecks.basis,'claims',a.claimChecks.rows,'/data/decisionAnalysis/claimChecks/rows',a.claimChecks.total);
 if(a.kind==='long_windows')return decisionPanel('Delay windows requiring review','Windows longer than three calendar months require subdivision or a recorded analytical justification. This screening does not award time or determine causation.','windows',a.claimChecks.rows,'/data/decisionAnalysis/claimChecks/rows',a.claimChecks.windowCount);
 if(a.kind==='payment_due')return decisionPanel('Contract payment due dates and actual receipt',a.paymentChecks.basis,'paymentDue',a.paymentChecks.rows,'/data/decisionAnalysis/paymentChecks/rows',a.paymentChecks.total);
 if(a.kind==='register_reconciliation')return decisionPanel('Register totals above the current contract sum','A larger register total is a reconciliation question, not proof of overpayment. Confirm scope, currency, tax and incremental/cumulative basis before relying on it.','registers',a.registerValueChecks.rows,'/data/decisionAnalysis/registerValueChecks/rows',a.registerValueChecks.count);
 if(a.kind==='monthly_evm')return '<section class="planning-panel"><h4>Monthly earned-value history</h4>'+(a.series?.length?a.series.map(s=>'<h5>'+escapeHtml(s.currency)+' · '+escapeHtml(humanizeKey(s.taxBasis))+' tax basis</h5>'+renderLineChart(s.points,[{key:'pv',label:'Planned value',color:'#4f7fb4'},{key:'ev',label:'Earned value',color:'#2c7a57'},{key:'ac',label:'Actual cost',color:'#b57922'}],null,{title:'Monthly earned value · '+s.currency,unit:s.currency,dataDateIso:a.dataDateIso,dateKey:'dateIso'})+'<p>'+escapeHtml(s.basis)+'</p>'+basisTable(['Source date','Planned value','Earned value','Actual cost','CPI','SPI'],s.points.map(p=>[planningShortDate(p.dateIso),managementValue(p.pv),managementValue(p.ev),managementValue(p.ac),managementValue(p.cpi),managementValue(p.spi)]))).join(''):'<p>Missing: dated monthly earned-value records containing PV, EV and AC in a comparable currency and tax basis. Schedule percentages do not substitute for money-based earned value.</p>')+'</section>';
 return '';
}
`;
