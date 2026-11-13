import {mkdirSync,readFileSync,writeFileSync,renameSync,rmSync,openSync,closeSync,fsyncSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

// Published standard text-token rates, not an estimate of actual account billing.
// Unknown providers/models require explicit rates; they never get a free pass.
const rates:Record<string,[number,number]>={'gpt-4.1-mini':[0.4,1.6],'gpt-4.1-mini-2025-04-14':[0.4,1.6]};
interface Ledger {schema:1;month:string;reservedMicros:number;calls:number;inputTokens:number;outputTokens:number}
/** finish: the provider answered (usage known: reconcile to actual; unknown: keep the whole
 * reservation). release: the request never left this server (no paid call): the whole
 * reservation and its call count are returned. */
export interface BudgetReservation {finish(inputTokens:number|null,outputTokens:number|null):void;release():void}
const write=(path:string,value:unknown)=>{const temp=path+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(value),{mode:0o600});const fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,path);};
/** Upper-bound cost in USD of one call, at the same rates and token bounds the ledger reserves.
 * Null when no price is known for the model: the cost is then unknown, never zero. */
export function callUpperBoundUsd(model:string,inputUpper:number,outputUpper:number,env:NodeJS.ProcessEnv=process.env):number|null{
 const inputRate=env.CMENG_AI_INPUT_USD_PER_MILLION,outputRate=env.CMENG_AI_OUTPUT_USD_PER_MILLION,hasRates=inputRate!==undefined||outputRate!==undefined;
 const configured=[Number(inputRate),Number(outputRate)];
 if(hasRates&&(!inputRate?.trim()||!outputRate?.trim()||configured.some(v=>!Number.isFinite(v)||v<0)))return null;
 const rate=hasRates?configured:rates[model];
 if(!rate||!Number.isSafeInteger(inputUpper)||inputUpper<0||!Number.isSafeInteger(outputUpper)||outputUpper<0)return null;
 return Math.ceil(inputUpper*rate[0]!+outputUpper*rate[1]!)/1e6;
}
export function reserveModelUsage(model:string,inputUpper:number,outputUpper:number,env:NodeJS.ProcessEnv=process.env):BudgetReservation|null{
 const directory=env.CMENG_AI_USAGE_DIR;if(!directory)return null;
 const cap=Number(env.CMENG_AI_MONTHLY_USD??20);if(!Number.isFinite(cap)||cap<0||cap>20)throw Error('MODEL_BUDGET_CONFIGURATION_INVALID');
 const inputRate=env.CMENG_AI_INPUT_USD_PER_MILLION,outputRate=env.CMENG_AI_OUTPUT_USD_PER_MILLION;
 const configuredIn=Number(inputRate),configuredOut=Number(outputRate),hasRates=inputRate!==undefined||outputRate!==undefined;
 if(hasRates&&(!inputRate?.trim()||!outputRate?.trim()||!Number.isFinite(configuredIn)||configuredIn<0||!Number.isFinite(configuredOut)||configuredOut<0))throw Error('MODEL_BUDGET_RATE_NOT_CONFIGURED');
 const rate=hasRates?[configuredIn,configuredOut]:rates[model];
 if(!rate)throw Error('MODEL_BUDGET_RATE_NOT_CONFIGURED');
 if(!Number.isSafeInteger(inputUpper)||inputUpper<0||!Number.isSafeInteger(outputUpper)||outputUpper<0)throw Error('MODEL_BUDGET_ESTIMATE_INVALID');
 const upper=Math.ceil(inputUpper*rate[0]!+outputUpper*rate[1]!);
 if(!Number.isSafeInteger(upper))throw Error('MODEL_BUDGET_ESTIMATE_INVALID');
 const month=new Date().toISOString().slice(0,7);mkdirSync(directory,{recursive:true,mode:0o700});
 const path=join(directory,month+'.json'),lock=join(directory,month+'.lock');
 const transact=(change:(v:Ledger)=>void)=>{let fd:number;try{fd=openSync(lock,'wx',0o600);}catch{throw Error('MODEL_BUDGET_BUSY');}
  try{let v:Ledger;try{v=JSON.parse(readFileSync(path,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('MODEL_BUDGET_LEDGER_INVALID');v={schema:1,month,reservedMicros:0,calls:0,inputTokens:0,outputTokens:0};}
   if(v.schema!==1||v.month!==month||!Number.isSafeInteger(v.reservedMicros)||v.reservedMicros<0||!Number.isSafeInteger(v.calls)||v.calls<0)throw Error('MODEL_BUDGET_LEDGER_INVALID');
   change(v);write(path,v);
  }finally{closeSync(fd);rmSync(lock,{force:true});}
 };
 transact(v=>{if(v.reservedMicros+upper>Math.floor(cap*1e6))throw Error('MODEL_MONTHLY_BUDGET_EXHAUSTED');v.reservedMicros+=upper;v.calls++;});
 let finished=false;return {release(){if(finished)return;finished=true;
  try{transact(v=>{v.reservedMicros=Math.max(0,v.reservedMicros-upper);v.calls=Math.max(0,v.calls-1);});}catch{/* On contention the reservation stays: conservative. */}
 },finish(input,output){if(finished)return;finished=true;
  // Keep the entire reservation if usage is absent, a call fails, or its process
  // is interrupted. An uncertain charge never releases budget for another call.
  if(input===null||output===null||!Number.isSafeInteger(input)||!Number.isSafeInteger(output)||input<0||output<0)return;
  const actual=Math.ceil(input*rate[0]!+output*rate[1]!);
  try{transact(v=>{v.reservedMicros=Math.max(0,v.reservedMicros-upper+actual);v.inputTokens+=input;v.outputTokens+=output;});}catch{/* Conservative reservation is retained on accounting contention. */}
 }};
}

/** Month-to-date AI spending from the durable ledger, for the estimate shown before owner
 * approval. committed = everything the cap counts (reconciled actual cost plus reservations
 * still held for calls whose usage is unknown); actual = cost of the reconciled calls only. */
export interface MonthlyAiUsage {month:string;capUsd:number;committedUsd:number;actualUsd:number;heldReservationUsd:number;remainingUsd:number;calls:number;inputTokens:number;outputTokens:number}
export function monthlyAiUsage(model:string,env:NodeJS.ProcessEnv=process.env):MonthlyAiUsage|null{
 const directory=env.CMENG_AI_USAGE_DIR;if(!directory)return null;
 const cap=Number(env.CMENG_AI_MONTHLY_USD??20);if(!Number.isFinite(cap)||cap<0||cap>20)return null;
 const month=new Date().toISOString().slice(0,7);
 let v:Ledger={schema:1,month,reservedMicros:0,calls:0,inputTokens:0,outputTokens:0};
 try{const read=JSON.parse(readFileSync(join(directory,month+'.json'),'utf8'));if(read?.schema===1&&read.month===month)v=read;}catch{/* No ledger yet: nothing spent this month. */}
 const actualMicros=Math.ceil(callUpperBoundUsd(model,v.inputTokens,v.outputTokens,env)!==null?callUpperBoundUsd(model,v.inputTokens,v.outputTokens,env)!*1e6:0);
 const committed=v.reservedMicros/1e6,actual=Math.min(committed,actualMicros/1e6);
 return {month,capUsd:cap,committedUsd:committed,actualUsd:actual,heldReservationUsd:Math.max(0,committed-actual),remainingUsd:Math.max(0,cap-committed),calls:v.calls,inputTokens:v.inputTokens,outputTokens:v.outputTokens};
}
