import {availableParallelism} from 'node:os';

export function projectWorkerCapacity(configured:number|undefined,available=availableParallelism()){
  const cpuLimit=Math.max(1,Math.floor(available));
  const requested=configured!==undefined&&Number.isInteger(configured)&&configured>0?configured:4;
  return Math.min(8,cpuLimit,requested);
}
