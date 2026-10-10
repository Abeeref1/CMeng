export function milestonePopulation(rows:readonly any[]){
 const priorityCounts:Record<string,number>={critical:0,high:0,watch:0,normal:0};
 const clusters=new Map<number,number>();
 let openCount=0,completedCount=0,overdueOpenCount=0,openLateBaselineCount=0,completedLateBaselineCount=0,largestMovementDays:number|null=null;
 for(const row of rows){
  const completed=row.status==='completed';
  if(completed)completedCount++;else{openCount++;if(row.dueState==='overdue')overdueOpenCount++;if(row.managementPriority in priorityCounts)priorityCounts[row.managementPriority]=(priorityCounts[row.managementPriority]??0)+1;}
  if(typeof row.varianceDays!=='number'||!Number.isFinite(row.varianceDays))continue;
  const days=row.varianceDays;largestMovementDays=largestMovementDays===null?days:Math.max(largestMovementDays,days);
  if(!completed){if(days>0)openLateBaselineCount++;const rounded=Number(days.toFixed(6));clusters.set(rounded,(clusters.get(rounded)??0)+1);}
  else if(row.movementBasis==='actual_vs_baseline'&&days>0)completedLateBaselineCount++;
 }
 return {sourceRows:rows.length,openCount,completedCount,overdueOpenCount,openLateBaselineCount,completedLateBaselineCount,largestMovementDays,priorityCounts,
  movementClusters:[...clusters].map(([days,count])=>({days,count})).sort((a,b)=>b.count-a.count||a.days-b.days),fullPopulation:true};
}
export function attachMilestonePopulation(projection:any){
 if(!projection||!Array.isArray(projection.rows))return projection;
 return {...projection,milestoneFullCounts:milestonePopulation(projection.rows),
  openMilestones:projection.rows.filter((r:any)=>r.status!=='completed'),completedMilestones:projection.rows.filter((r:any)=>r.status==='completed')};
}
