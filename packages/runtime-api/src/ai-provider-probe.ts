import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {configuredAskModel,configuredProviderState} from '../../project-ask/src/provider';
export function providerProbeState(root:string,release:string){
 try{const v=JSON.parse(readFileSync(join(root,'ai-provider-probe.json'),'utf8'));return v.release===release?{checkedAt:v.checkedAt,successful:v.successful,error:v.error??null}:null;}catch{return null;}
}
/** Explicitly enabled operator self-test. One tiny synthetic handshake per
 * release; no project records, passwords or API keys are sent as evidence. */
export async function probeConfiguredProvider(root:string,release:string){
 if(process.env.CMENG_AI_PROBE_ON_START!=='1'||providerProbeState(root,release))return;
 const env={...process.env,CMENG_ASK_AI_CONFIG_FILE:process.env.CMENG_ASK_AI_CONFIG_FILE??join(root,'ask-ai-provider.json')};
 const config=configuredProviderState(env),model=configuredAskModel(env);let successful=false,error:string|null=null;
 try{if(!model)throw Error('MODEL_NOT_CONFIGURED');const nonce=randomUUID();const v:any=await model.structured('cmeng_provider_connectivity_check',{type:'object',properties:{nonce:{type:'string'}},required:['nonce'],additionalProperties:false},'Echo only the supplied synthetic nonce as JSON. This is a connectivity test with no project evidence.',{nonce});successful=v?.nonce===nonce;if(!successful)error='MODEL_PROBE_RESPONSE_INVALID';}
 catch(e){const code=e instanceof Error?e.message:'';error=/^MODEL_[A-Z_]+$/.test(code)?code:'MODEL_PROVIDER_UNAVAILABLE';}
 const value={release,model:config.model,checkedAt:new Date().toISOString(),successful,error};
 const path=join(root,'ai-provider-probe.json'),tmp=path+'.'+randomUUID()+'.tmp';writeFileSync(tmp,JSON.stringify(value),{mode:0o600});renameSync(tmp,path);
}
