import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

// Older explicit-result APIs used process-local Maps. Workers can be retired
// between requests, so retain these results alongside their owning project.
export function projectResultMap<T>(name:string,directory?:string):Map<string,T>{
  if(!directory)return new Map<string,T>();
  const path=join(directory,name+'.json');
  let entries:Array<[string,T]>=[];
  try{entries=JSON.parse(readFileSync(path,'utf8'));}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const map=new Map<string,T>(entries);
  map.set=(key,value)=>{
    const next=new Map(map);next.set(key,value);
    const temporary=path+'.'+randomUUID()+'.tmp';
    writeFileSync(temporary,JSON.stringify([...next]));renameSync(temporary,path);
    Map.prototype.set.call(map,key,value);return map;
  };
  return map;
}
