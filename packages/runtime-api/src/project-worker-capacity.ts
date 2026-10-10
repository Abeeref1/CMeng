import {availableParallelism} from 'node:os';

export function projectWorkerCapacity(configured:number|undefined,available=availableParallelism(),explicitConcurrentProjects=0){
  const cpuLimit=Math.max(1,Math.floor(available));
  const requested=configured!==undefined&&Number.isInteger(configured)&&configured>0?configured:6;
  // Optional bounded concurrent-project lanes for an I/O-heavy interactive
  // service. The default still honours availableParallelism; only an explicit
  // operator opt-in may exceed the reported per-process CPU parallelism.
  // A tight cap protects memory and processing for large schedule imports.
  const explicit=Number.isInteger(explicitConcurrentProjects)&&explicitConcurrentProjects>0
    ?Math.min(4,explicitConcurrentProjects):0;
  return Math.min(8,Math.max(cpuLimit,explicit),requested);
}
