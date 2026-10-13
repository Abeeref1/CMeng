import {aggregateCount} from '../../truth-kernel/src/aggregates';
export function milestonePopulation(rows:readonly any[]){
 const priorityCounts:Record<string,number>={critical:0,high:0,watch:0,normal:0};
 const clusters=new Map<number,number>();
 let openCount=0,completedCount=0,overdueOpenCount=0,openLateBaselineCount=0,completedLateBaselineCount=0,largestMovementDays:number|null=null;
 const statusCounts={completed:0,overdue:0,nonOverdue:0,dueUnknown:0,statusUnknown:0};
 const priorityAssessmentCounts:Record<string,number>={critical:0,high:0,watch:0,normal:0,unresolved:0};
 for(const row of rows){
  const completed=row.status==='completed';
  if(completed)statusCounts.completed++;
  else if(!['not_started','in_progress'].includes(row.status))statusCounts.statusUnknown++;
  else if(row.dueState==='overdue')statusCounts.overdue++;
  else if(['future','due_30_days','due_90_days'].includes(row.dueState))statusCounts.nonOverdue++;
  else statusCounts.dueUnknown++;
  if(!completed){
   const priority=row.managementPriority;
   const resolved=['not_started','in_progress'].includes(row.status)&&(['critical','high','watch'].includes(priority)||priority==='normal'&&row.dueState!=='unknown'&&row.dueState!=null&&row.criticality!=='unknown'&&row.criticality!=null&&typeof row.varianceDays==='number'&&Number.isFinite(row.varianceDays));
   const key=resolved?priority:'unresolved';priorityAssessmentCounts[key]=(priorityAssessmentCounts[key]??0)+1;
  }
  if(completed)completedCount++;else{openCount++;if(row.dueState==='overdue')overdueOpenCount++;if(row.managementPriority in priorityCounts)priorityCounts[row.managementPriority]=(priorityCounts[row.managementPriority]??0)+1;}
  if(typeof row.varianceDays!=='number'||!Number.isFinite(row.varianceDays))continue;
  const days=row.varianceDays;largestMovementDays=largestMovementDays===null?days:Math.max(largestMovementDays,days);
  if(!completed){if(days>0)openLateBaselineCount++;const rounded=Number(days.toFixed(6));clusters.set(rounded,(clusters.get(rounded)??0)+1);}
  else if(row.movementBasis==='actual_vs_baseline'&&days>0)completedLateBaselineCount++;
 }
 const openLateBaselineTotal=aggregateCount(rows,row=>row.status==='completed'?false:row.status==='unknown'||typeof row.varianceDays!=='number'||!Number.isFinite(row.varianceDays)?null:row.varianceDays>0).value;
 const completedLateBaselineTotal=aggregateCount(rows,row=>row.status==='unknown'?null:row.status!=='completed'?false:row.movementBasis!=='actual_vs_baseline'||typeof row.varianceDays!=='number'||!Number.isFinite(row.varianceDays)?null:row.varianceDays>0).value;
 return {sourceRows:rows.length,openCount,completedCount,overdueOpenCount,openLateBaselineCount,completedLateBaselineCount,openLateBaselineTotal,completedLateBaselineTotal,largestMovementDays,priorityCounts,statusCounts,priorityAssessmentCounts,
  movementClusters:[...clusters].map(([days,count])=>({days,count})).sort((a,b)=>b.count-a.count||a.days-b.days),fullPopulation:true};
}
export function attachMilestonePopulation(projection:any){
 if(!projection||!Array.isArray(projection.rows))return projection;
 return {...projection,milestoneFullCounts:{...milestonePopulation(projection.rows),identificationComplete:projection.populationState!=='partial'},
  openMilestones:projection.rows.filter((r:any)=>r.status!=='completed'),completedMilestones:projection.rows.filter((r:any)=>r.status==='completed')};
}
