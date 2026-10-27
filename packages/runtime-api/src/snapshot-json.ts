import {openSync,closeSync,readSync,writeSync,fsyncSync,renameSync,unlinkSync,readFileSync,statSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {JSONParser} from '@streamparser/json';

// Retain the ordinary JSON format, but never require the complete snapshot to
// fit in one JavaScript string. This applies to legacy migration and restore too.
// T11: a large snapshot is read into one buffer and split at value boundaries;
// each bounded value is decoded by the native JSON parser. The values are the
// same as JSON.parse gives; only files too large to buffer use the slow
// token-by-token reader.
const SLICE_PARSE_BYTES=8*1024*1024;
const BUFFERED_PARSE_MAX_BYTES=384*1024*1024;
export function readSnapshotJson<T>(path:string):T {
  const size=statSync(path).size;
  if(size<=32*1024*1024)return JSON.parse(readFileSync(path,'utf8')) as T;
  if(size<=BUFFERED_PARSE_MAX_BYTES)return parseJsonBuffer(readFileSync(path)) as T;
  const parser=new JSONParser({paths:['$'],stringBufferSize:64*1024});
  let result:T|undefined,found=false;
  parser.onValue=({value})=>{result=value as T;found=true;};
  const fd=openSync(path,'r'),buffer=Buffer.allocUnsafe(64*1024);
  try{let count;while((count=readSync(fd,buffer,0,buffer.length,null))>0)parser.write(buffer.subarray(0,count));if(!parser.isEnded)parser.end();}
  finally{closeSync(fd);}
  if(!found)throw new Error('PROJECT_SNAPSHOT_INCOMPLETE');
  return result!;
}

/** JSON.parse for a UTF-8 buffer larger than one string should hold: objects and
 * arrays larger than SLICE_PARSE_BYTES are walked here, every smaller value is
 * parsed natively from its own slice. Slices end at ASCII delimiters, so no
 * multi-byte character is ever split. */
export function parseJsonBuffer(buf:Buffer):unknown {
  const end=buf.length;let pos=0;
  const fail=(at:number):never=>{throw new SyntaxError(at>=end?'PROJECT_SNAPSHOT_INCOMPLETE':'Unexpected token in JSON at position '+at);};
  const space=()=>{while(pos<end){const c=buf[pos];if(c===0x20||c===0x0a||c===0x0d||c===0x09)pos++;else break;}};
  const stringEnd=(open:number):number=>{
    let from=open+1;
    for(;;){
      const quote=buf.indexOf(0x22,from);if(quote<0)return fail(end);
      let slash=quote-1;while(slash>open&&buf[slash]===0x5c)slash--;
      if((quote-1-slash)%2===0)return quote+1;
      from=quote+1;
    }
  };
  // End of the container at `open`, or -1 when it is longer than `limit` bytes.
  const containerEnd=(open:number,limit:number):number=>{
    let depth=0,at=open;const stop=Math.min(end,open+limit);
    while(at<stop){
      const c=buf[at];
      if(c===0x22){at=stringEnd(at);continue;}
      if(c===0x7b||c===0x5b)depth++;
      else if(c===0x7d||c===0x5d){if(--depth===0)return at+1;}
      at++;
    }
    return at>=end?fail(end):-1;
  };
  const scalarEnd=(start:number):number=>{
    if(buf[start]===0x22)return stringEnd(start);
    let at=start;
    while(at<end){const c=buf[at];if(c===0x2c||c===0x7d||c===0x5d||c===0x20||c===0x0a||c===0x0d||c===0x09)break;at++;}
    return at;
  };
  const native=(start:number,stop:number):unknown=>JSON.parse(buf.toString('utf8',start,stop));
  const value=():unknown=>{
    space();if(pos>=end)fail(end);
    const start=pos,c=buf[pos];
    if(c!==0x7b&&c!==0x5b){const stop=scalarEnd(start);if(stop===start)fail(start);pos=stop;return native(start,stop);}
    const stop=containerEnd(start,SLICE_PARSE_BYTES);
    if(stop>=0){pos=stop;return native(start,stop);}
    pos++;space();
    if(c===0x5b){
      const out:unknown[]=[];
      if(buf[pos]===0x5d){pos++;return out;}
      for(;;){out.push(value());space();const d=buf[pos++];if(d===0x2c)continue;if(d===0x5d)return out;fail(pos-1);}
    }
    const out:Record<string,unknown>={};
    if(buf[pos]===0x7d){pos++;return out;}
    for(;;){
      space();if(buf[pos]!==0x22)fail(pos);
      const keyStop=stringEnd(pos),key=native(pos,keyStop) as string;pos=keyStop;
      space();if(buf[pos]!==0x3a)fail(pos);pos++;
      const item=value();
      if(key==='__proto__')Object.defineProperty(out,key,{value:item,writable:true,enumerable:true,configurable:true});else out[key]=item;
      space();const d=buf[pos++];if(d===0x2c)continue;if(d===0x7d)return out;fail(pos-1);
    }
  };
  const result=value();space();
  if(pos!==end)fail(pos);
  return result;
}

/** The one streaming JSON encoder: ordinary JSON text in bounded chunks, so no
 * caller ever needs a whole project as one JavaScript string. `filter` works like
 * a JSON.stringify replacer (holder, key, value); returning undefined omits the key. */
const NATIVE_ENCODE_DEPTH=3;
/* `filterApplies(text)` is optional: it returns false only when `filter` leaves
 * every value inside that JSON text unchanged. A value whose plain text the filter
 * cannot touch is then written without calling the filter for each key. */
function encodeJsonChunks(value:unknown,write:(text:string)=>void,filter?:(holder:any,key:string,value:unknown)=>unknown,filterApplies?:(text:string)=>boolean):void {
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
  // T11: below the top levels each value is encoded by the native serializer,
  // which gives the same text; a value too long for one string falls back to
  // this encoder, so no length limit can return.
  const nativeText=(v:any):string|undefined=>{
    if(typeof v.toJSON==='function')return undefined;
    try{
      if(!filter)return JSON.stringify(v);
      if(filterApplies){const plain=JSON.stringify(v);if(!filterApplies(plain))return plain;}
      let top=true;
      return JSON.stringify(v,function(this:any,key:string,item:unknown){if(top){top=false;return item;}return filter(this,key,item);});
    }catch(error){if(error instanceof RangeError)return undefined;throw error;}
  };
  const encode=(v:any,depth:number):void=>{
    if(v===null||omitted(v)){append('null');return;}
    if(typeof v==='string'){string(v);return;}
    if(typeof v!=='object'){append(JSON.stringify(v));return;}
    if(ancestors.has(v))throw new TypeError('Converting circular structure to JSON');
    if(depth>=NATIVE_ENCODE_DEPTH){const text=nativeText(v);if(text!==undefined){append(text);return;}}
    else if(inlineRecord(v)){append(JSON.stringify(v));return;}
    ancestors.add(v);
    if(Array.isArray(v)){
      append('[');for(let i=0;i<v.length;i++){if(i)append(',');encode(prepare(v,v[i],String(i)),depth+1);}append(']');
    }else{
      append('{');let first=true;
      for(const k of Object.keys(v)){const child=prepare(v,v[k],k);if(omitted(child))continue;if(!first)append(',');first=false;string(k);append(':');encode(child,depth+1);}append('}');
    }
    ancestors.delete(v);
  };
  encode(prepare({'':value},value,''),0);flush();
}

/** SHA-256 of the JSON text of a value, streamed: never one whole string. */
export function hashJsonStream(value:unknown,filter?:(holder:any,key:string,value:unknown)=>unknown,filterApplies?:(text:string)=>boolean):string {
  const hash=createHash('sha256');
  encodeJsonChunks(value,text=>hash.update(text,'utf8'),filter,filterApplies);
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
