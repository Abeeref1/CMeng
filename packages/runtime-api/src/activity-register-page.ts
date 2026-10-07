const fields=['wbsId','zone','floor','tower','building','area','workFront','phase','section','chainage','discipline','trade','system','package','cbs','contractor','subcontractor','status','criticality'];
export function activityRegisterPage(source:readonly any[],query:URLSearchParams){
 const all=source.filter(row=>!['level_of_effort','wbs_summary'].includes(row.activityType));
 const text=(query.get('q')??'').trim().toLowerCase(),condition=query.get('condition');
 const rows=all.filter(row=>{
  if(text&&![row.activityId,row.name,row.wbsId,row.wbsPath,row.location,...fields.map(key=>row[key])].filter(Boolean).join(' ').toLowerCase().includes(text))return false;
  if(fields.some(key=>query.get(key)&&String(key==='floor'?row.floor??row.level??'':row[key]??'')!==query.get(key)))return false;
  return condition==='delayed'?row.scheduleDelayed===true:condition==='missed_start'?row.missedPlannedStart===true:condition==='overdue_finish'?row.finishOverdue===true:condition==='negative_float'?typeof row.totalFloatHours==='number'&&row.totalFloatHours<0:condition==='zero_float'?row.totalFloatHours===0:condition==='float_risk'?row.floatRiskWatchlist===true:condition==='open_logic'?row.openStart||row.openFinish||row.isolated:true;
 });
 const score=(r:any)=>(r.scheduleDelayed?1500:0)+(r.criticality==='critical'?1000:r.criticality==='near_critical'?500:0)+(r.totalFloatHours<0?200:0)+(r.finishVarianceDays>0?r.finishVarianceDays:0);
 rows.sort((a,b)=>score(b)-score(a)||String(a.activityId).localeCompare(String(b.activityId)));
 const requestedSize=Number(query.get('pageSize')??50),pageSize=Number.isFinite(requestedSize)?Math.max(1,Math.min(100,Math.floor(requestedSize))):50;
 const pageCount=Math.max(1,Math.ceil(rows.length/pageSize)),requestedPage=Number(query.get('page')??0);
 const page=Number.isFinite(requestedPage)?Math.min(pageCount-1,Math.max(0,Math.floor(requestedPage))):0;
 return {rows:rows.slice(page*pageSize,(page+1)*pageSize),page,pageSize,pageCount,matchingCount:rows.length,totalCount:all.length};
}

/** Browser view: first register page plus chart inputs and full filter options.
 * Full rows remain available from the paged register and report endpoints. */
export function activityRegisterView(data:any){
 const all=Array.isArray(data?.rows)?data.rows:[],execution=all.filter((r:any)=>!['level_of_effort','wbs_summary'].includes(r.activityType));
 const keys=['activityId','name','activityType','status','criticality','totalFloatHours','nearCriticalThresholdHours','floatRiskWatchlist','finishVarianceDays','openStart','openFinish','isolated'];
 const filterOptions=Object.fromEntries(fields.map(key=>[key,[...new Set(execution.map((r:any)=>key==='floor'?r.floor??r.level:r[key]).filter((v:any)=>v!==null&&v!==undefined&&String(v).trim()))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true}))]));
 return {...data,rows:activityRegisterPage(all,new URLSearchParams('pageSize=50')).rows,
  analysisRows:all.map((r:any)=>Object.fromEntries(keys.map(k=>[k,r[k]]))),activitySummary:{sourceRecordCount:all.length,executionCount:execution.length,filterOptions},
  ...(data.scopeClassification?{scopeClassification:{...data.scopeClassification,rows:undefined}}:{})};
}
