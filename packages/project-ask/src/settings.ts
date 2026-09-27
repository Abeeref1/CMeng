import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync,openSync,fsyncSync,closeSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
export const ownerOpenAiModels=['gpt-5-mini','gpt-5','gpt-4.1-mini','gpt-4.1'] as const;
export interface ManagedAskSettings {schemaVersion:1;model:string;apiKey:string;ownerOnly:true;updatedAt:string}
export function readManagedAskSettings(path:string|undefined):ManagedAskSettings|null{
  if(!path||!existsSync(path))return null;
  try{const v=JSON.parse(readFileSync(path,'utf8'));if(v.schemaVersion!==1||!ownerOpenAiModels.includes(v.model)||typeof v.apiKey!=='string'||!v.apiKey||v.ownerOnly!==true)throw Error();return v;}catch{throw new Error('The saved Ask CMeng model settings could not be read.');}
}
export function saveManagedAskSettings(path:string,model:unknown,key:unknown){
  if(typeof model!=='string'||!ownerOpenAiModels.includes(model as any))throw new Error('Choose a listed GPT-5 or GPT-4 model.');
  const apiKey=typeof key==='string'&&key.trim()?key.trim():readManagedAskSettings(path)?.apiKey;
  if(!apiKey||!/^sk-[A-Za-z0-9_-]{16,512}$/.test(apiKey))throw new Error('Enter your OpenAI API key in the private key field.');
  const value:ManagedAskSettings={schemaVersion:1,model,apiKey,ownerOnly:true,updatedAt:new Date().toISOString()},temp=path+'.'+randomUUID()+'.tmp';mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(temp,JSON.stringify(value),{mode:0o600});const fd=openSync(temp,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,path);const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}return {model,keyConfigured:true,ownerOnly:true,updatedAt:value.updatedAt};
}
