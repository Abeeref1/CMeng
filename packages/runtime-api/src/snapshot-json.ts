import {openSync,closeSync,readSync,writeSync,fsyncSync,renameSync,unlinkSync,readFileSync,statSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {JSONParser} from '@streamparser/json';

// Retain the ordinary JSON format, but never require the complete snapshot to
// fit in one JavaScript string. This applies to legacy migration and restore too.
export function readSnapshotJson<T>(path:string):T {
  if(statSync(path).size<=32*1024*1024)return JSON.parse(readFileSync(path,'utf8')) as T;
  const parser=new JSONParser({paths:['$'],stringBufferSize:64*1024});
  let result:T|undefined,found=false;
  parser.onValue=({value})=>{result=value as T;found=true;};
  const fd=openSync(path,'r'),buffer=Buffer.allocUnsafe(64*1024);
  try{let count;while((count=readSync(fd,buffer,0,buffer.length,null))>0)parser.write(buffer.subarray(0,count));if(!parser.isEnded)parser.end();}
  finally{closeSync(fd);}
  if(!found)throw new Error('PROJECT_SNAPSHOT_INCOMPLETE');
  return result!;
}

/** The one streaming JSON encoder: ordinary JSON text in bounded chunks, so no
 * caller ever needs a whole project as one JavaScript string. `filter` works like
 * a JSON.stringify replacer (holder, key, value); returning undefined omits the key. */
function encodeJsonChunks(value:unknown,write:(text:string)=>void,filter?:(holder:any,key:string,value:unknown)=>unknown):void {
  let parts:string[]=[],length=0;
  const ancestors=new Set<object>();
  const flush=()=>{if(!length)return;write(parts.join(''));parts=[];length=0;};
  const append=(text:string)=>{parts.push(text);length+=text.length;if(length>=64*1024)flush();};
  const string=(text:string)=>{
    if(text.length<=16*1024){append(JSON.stringify(text));return;}
    append('"');
    for(let i=0;i<text.length;i+=16*1024)append(JSON.stringify(text.slice(i,i+16*1024)).slice(1,-1));
    append('"');
  };
  const omitted=(v:unknown)=>v===undefined||typeof v==='function'||typeof v==='symbol';
  const prepare=(holder:any,input:any,key:string)=>{const v=input&&typeof input.toJSON==='function'?input.toJSON(key):input;return filter?filter(holder,key,v):v;};
  // Native serialization is safe for bounded flat records. Large containers and
  // text still use the streaming path, so the whole-project string limit cannot return.
  const inlineRecord=(v:any):boolean=>{
    if(filter)return false;
    if(Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype||typeof v.toJSON==='function')return false;
    const keys=Object.keys(v);if(keys.length>64)return false;let budget=32*1024;
    const scalar=(value:any)=>{if(value!==null&&typeof value==='object'||typeof value==='bigint')return false;budget-=typeof value==='string'?value.length*6+2:32;return budget>=0;};
    for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(v,key)!;if(descriptor.get||descriptor.set)return false;budget-=key.length*6+4;if(budget<0)return false;const value=descriptor.value;
      if(Array.isArray(value)){if(value.length>8||typeof (value as any).toJSON==='function')return false;for(let i=0;i<value.length;i++){const item=Object.getOwnPropertyDescriptor(value,String(i));if(item&&(item.get||item.set)||!scalar(item?.value))return false;}}
      else if(!scalar(value))return false;
    }
    return true;
  };
  const encode=(v:any):void=>{
    if(v===null||omitted(v)){append('null');return;}
    if(typeof v==='string'){string(v);return;}
    if(typeof v!=='object'){append(JSON.stringify(v));return;}
    if(ancestors.has(v))throw new TypeError('Converting circular structure to JSON');
    if(inlineRecord(v)){append(JSON.stringify(v));return;}
    ancestors.add(v);
    if(Array.isArray(v)){
      append('[');for(let i=0;i<v.length;i++){if(i)append(',');encode(prepare(v,v[i],String(i)));}append(']');
    }else{
      append('{');let first=true;
      for(const k of Object.keys(v)){const child=prepare(v,v[k],k);if(omitted(child))continue;if(!first)append(',');first=false;string(k);append(':');encode(child);}append('}');
    }
    ancestors.delete(v);
  };
  encode(prepare({'':value},value,''));flush();
}

/** SHA-256 of the JSON text of a value, streamed: never one whole string. */
export function hashJsonStream(value:unknown,filter?:(holder:any,key:string,value:unknown)=>unknown):string {
  const hash=createHash('sha256');
  encodeJsonChunks(value,text=>hash.update(text,'utf8'),filter);
  return hash.digest('hex');
}

export function writeSnapshotJson(path:string,value:unknown):void {
  const temporary=path+'.'+process.pid+'.'+randomUUID()+'.tmp';
  let fd:number|undefined;
  try{
    fd=openSync(temporary,'wx',0o600);
    const out=fd;
    encodeJsonChunks(value,text=>{const bytes=Buffer.from(text,'utf8');let offset=0;while(offset<bytes.length)offset+=writeSync(out,bytes,offset,bytes.length-offset);});
    fsyncSync(fd);closeSync(fd);fd=undefined;
    renameSync(temporary,path);
    const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}
  }finally{
    if(fd!==undefined)closeSync(fd);
    try{unlinkSync(temporary);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  }
}

export function writeSourceAtomic(path:string,bytes:Uint8Array):void {
  const temporary=path+'.'+process.pid+'.'+randomUUID()+'.tmp';let fd:number|undefined;
  try{
    fd=openSync(temporary,'wx',0o600);let offset=0;
    while(offset<bytes.length)offset+=writeSync(fd,bytes,offset,bytes.length-offset);
    fsyncSync(fd);closeSync(fd);fd=undefined;renameSync(temporary,path);
    const directory=openSync(dirname(path),'r');try{fsyncSync(directory);}finally{closeSync(directory);}
  }finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temporary);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
}
