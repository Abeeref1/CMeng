import {mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

// Published standard text-token rates, not an estimate of actual account billing.
// Unknown providers/models require explicit rates; they never get a free pass.
const rates:Record<string,[number,number]>={'gpt-4.1-mini':[0.4,1.6],'gpt-4.1-mini-2025-04-14':[0.4,1.6]};
interface Ledger {schema:1;month:string;reservedMicros:number;calls:number;inputTokens:number;outputTokens:number}
export interface BudgetReservation {finish(inputTokens:number|null,outputTokens:number|null):void}
const write=(path:string,value:unknown)=>{const temp=path+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(value),{mode:0o600});const fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,path);};
export function reserveModelUsage(model:string,inputUpper:number,outputUpper:number,env:NodeJS.ProcessEnv=process.env):BudgetReservation|null{
 const directory=env.CMENG_AI_USAGE_DIR;if(!directory)return null;
 const cap=Number(env.CMENG_AI_MONTHLY_USD??20);if(!Number.isFinite(cap)||cap<0||cap>20)throw Error('MODEL_BUDGET_CONFIGURATION_INVALID');
 const configuredIn=Number(env.CMENG_AI_INPUT_USD_PER_MILLION),configuredOut=Number(env.CMENG_AI_OUTPUT_USD_PER_MILLION);
 const rate=Number.isFinite(configuredIn)&&configuredIn>=0&&Number.isFinite(configuredOut)&&configuredOut>=0?[configuredIn,configuredOut]:rates[model];
 if(!rate)throw Error('MODEL_BUDGET_RATE_NOT_CONFIGURED');
 if(!Number.isSafeInteger(inputUpper)||inputUpper<0||!Number.isSafeInteger(outputUpper)||outputUpper<0)throw Error('MODEL_BUDGET_ESTIMATE_INVALID');
 const upper=Math.ceil(inputUpper*rate[0]!+outputUpper*rate[1]!);
 const month=new Date().toISOString().slice(0,7);mkdirSync(directory,{recursive:true,mode:0o700});
 const path=join(directory,month+'.json'),lock=join(directory,month+'.lock');
 const transact=(change:(v:Ledger)=>void)=>{let fd:number;try{fd=openSync(lock,'wx',0o600);}catch{throw Error('MODEL_BUDGET_BUSY');}
  try{let v:Ledger;try{v=JSON.parse(readFileSync(path,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('MODEL_BUDGET_LEDGER_INVALID');v={schema:1,month,reservedMicros:0,calls:0,inputTokens:0,outputTokens:0};}
   if(v.schema!==1||v.month!==month||!Number.isSafeInteger(v.reservedMicros)||v.reservedMicros<0||!Number.isSafeInteger(v.calls)||v.calls<0)throw Error('MODEL_BUDGET_LEDGER_INVALID');
   change(v);write(path,v);
  }finally{closeSync(fd);rmSync(lock,{force:true});}
 };
 transact(v=>{if(v.reservedMicros+upper>Math.floor(cap*1e6))throw Error('MODEL_MONTHLY_BUDGET_EXHAUSTED');v.reservedMicros+=upper;v.calls++;});
 let finished=false;return {finish(input,output){if(finished)return;finished=true;
  // Keep the entire reservation if usage is absent, a call fails, or its process
  // is interrupted. An uncertain charge never releases budget for another call.
  if(input===null||output===null||!Number.isSafeInteger(input)||!Number.isSafeInteger(output)||input<0||output<0)return;
  const actual=Math.ceil(input*rate[0]!+output*rate[1]!);
  try{transact(v=>{v.reservedMicros=Math.max(0,v.reservedMicros-upper+actual);v.inputTokens+=input;v.outputTokens+=output;});}catch{/* Conservative reservation is retained on accounting contention. */}
 }};
}
