import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,link,unlink} from 'node:fs/promises';
import {join} from 'node:path';

/** Retain the existing anonymous session across restarts and project workers. */
export async function retainedAuditSessionKey(root:string):Promise<string>{
  if(process.env.CMENG_AUDIT_SECRET)return process.env.CMENG_AUDIT_SECRET;
  await mkdir(root,{recursive:true});const path=join(root,'audit-session.key');
  try{return await readFile(path,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const temporary=path+'.'+randomUUID()+'.tmp';
  await writeFile(temporary,randomBytes(32).toString('hex'),{mode:0o600});
  try{await link(temporary,path);}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
  finally{await unlink(temporary);}
  const key=await readFile(path,'utf8');if(!/^[a-f0-9]{64}$/.test(key))throw new Error('INVALID_AUDIT_SESSION_KEY');return key;
}
