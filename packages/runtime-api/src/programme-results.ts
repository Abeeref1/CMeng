/**
 * Mechanism 14: saved programme results, one per source revision.
 *
 * CPM, criticality, near-critical, forecast reconciliation inputs, schedule
 * analysis facts and revision comparisons are calculated once for the exact
 * programme content they read and saved in the project folder. Every page,
 * request and server restart reads the same saved result instead of
 * rebuilding it.
 *
 * Dependency rule: the key is the content of every input the calculation
 * reads (the programme model after calendar basis, constraints and reporting
 * view, plus options) and the code fingerprint of the programme calculation.
 * Any change to an input or to that code gives a new key, so the result is
 * recalculated; an unchanged revision keeps its result. Nothing is reused on
 * the strength of a label, revision name or project version.
 */
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

export type ProgrammeResultKind='independent-forecast'|'schedule-analysis'|'revision-comparison'|'near-critical'|'scope-classification'|'quantity-mapping'|'activity-analytics'|'progress-scurve'|'progress-breakdown';
type Stat={memory:number;disk:number;computed:number;readMs:number;computeMs:number;savedBytes:number};
const stats=new Map<string,Stat>();
const memory=new Map<string,unknown>();
const MEMORY_LIMIT=24;
const touchedKeys=new Set<string>();
let directoryOverride:string|null|undefined;

/** Tests and tools choose the folder explicitly; null keeps results in memory only. */
export function setProgrammeResultsDirectory(directory:string|null|undefined){directoryOverride=directory;memory.clear();}
export function programmeResultsDirectory():string|null{
  if(directoryOverride!==undefined)return directoryOverride;
  if(process.env.CMENG_PROGRAMME_RESULTS?.trim()==='0')return null;
  const explicit=process.env.CMENG_PROGRAMME_RESULTS_DIR?.trim();if(explicit)return explicit;
  const root=process.env.CMENG_DATA_DIR?.trim();
  if(!root||process.env.CMENG_TEST_MODE?.trim()==='1'||process.env.NODE_TEST_CONTEXT)return null;
  return join(root,'programme-results');
}

let codeFingerprint:string|undefined;
/** Hash of the source files the programme calculations import (emitted at build). */
export function programmeCodeFingerprint(){
  if(codeFingerprint)return codeFingerprint;
  try{
    const value=readFileSync(join(__dirname,'../../../programme-fingerprint.txt'),'utf8').trim();
    if(/^[a-f0-9]{64}$/.test(value))return codeFingerprint='programme:'+value;
  }catch{/* Build manifest unavailable: the whole calculation release is the safe key. */}
  return codeFingerprint=calculationReleaseKey();
}
/** The whole-calculation fingerprint (same file the release reads), without importing the catalog. */
function calculationReleaseKey(){
  try{
    const value=readFileSync(join(__dirname,'../../../calculation-fingerprint.txt'),'utf8').trim();
    if(/^[a-f0-9]{64}$/.test(value))return 'calc:'+value;
  }catch{/* fall through */}
  return 'release:'+(process.env.RAILWAY_GIT_COMMIT_SHA?.trim()||process.env.CMENG_RELEASE_COMMIT_SHA?.trim()||'unversioned');
}

/** Strict text of a value for hashing: Map and Set entries are kept (JSON drops
 * them), non-finite numbers are kept, and `generatedAt` (a request stamp) is left out. */
function strictCanonicalText(value:unknown):string{
  return JSON.stringify(value,(key,item)=>{
    if(key==='generatedAt')return undefined;
    if(item instanceof Map)return {'@map':[...item.entries()]};
    if(item instanceof Set)return {'@set':[...item.values()]};
    if(typeof item==='number'&&!Number.isFinite(item))return '@number:'+String(item);
    return item;
  });
}
const verifyKeyMaterial=process.env.CMENG_TEST_MODE?.trim()==='1'||Boolean(process.env.NODE_TEST_CONTEXT)||process.env.CMENG_VERIFY_PROGRAMME_KEYS?.trim()==='1';
/**
 * Text of a key input for hashing. Key inputs are plain data (programme models
 * loaded from JSON, options, and key material built by the callers with Maps
 * turned into entry lists), so plain JSON is exact and fast. Tests (and
 * CMENG_VERIFY_PROGRAMME_KEYS=1) check every input against the strict form,
 * so an input that JSON would not keep whole fails loudly instead of sharing a key.
 */
function canonicalText(value:unknown):string{
  const text=JSON.stringify(value);
  if(verifyKeyMaterial&&strictCanonicalText(value)!==text)throw new Error('PROGRAMME_RESULT_KEY_NOT_PLAIN_DATA');
  return text;
}
/** Key material for small option objects: Maps and Sets become entry lists (recursively), undefined stays out. */
export function programmeKeyMaterial(value:unknown):unknown{
  if(value instanceof Map)return {'@map':[...value.entries()].map(([k,v])=>[programmeKeyMaterial(k),programmeKeyMaterial(v)])};
  if(value instanceof Set)return {'@set':[...value.values()].map(programmeKeyMaterial)};
  if(typeof value==='number'&&!Number.isFinite(value))return '@number:'+String(value);
  if(Array.isArray(value))return value.map(programmeKeyMaterial);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,programmeKeyMaterial(v)]));
  return value;
}
const fingerprints=new WeakMap<object,string>();
/** Content fingerprint of one input, kept per object (models are not mutated after loading). */
export function contentFingerprint(value:unknown):string{
  if(value===null||typeof value!=='object')return createHash('sha256').update(canonicalText(value)).digest('hex');
  const known=fingerprints.get(value);if(known)return known;
  const fingerprint=createHash('sha256').update(canonicalText(value)).digest('hex');
  fingerprints.set(value,fingerprint);return fingerprint;
}
export function programmeResultKey(kind:ProgrammeResultKind,inputs:readonly unknown[]){
  const hash=createHash('sha256').update(programmeCodeFingerprint()).update('\0').update(kind);
  for(const input of inputs)hash.update('\0').update(contentFingerprint(input));
  return hash.digest('hex');
}

function count(kind:string,field:'memory'|'disk'|'computed',ms=0,bytes=0){
  const s=stats.get(kind)??{memory:0,disk:0,computed:0,readMs:0,computeMs:0,savedBytes:0};s[field]++;
  if(field==='disk')s.readMs+=ms;if(field==='computed')s.computeMs+=ms;s.savedBytes+=bytes;stats.set(kind,s);
}
export function programmeResultStats(){return Object.fromEntries([...stats].map(([kind,s])=>[kind,{...s,readMs:Math.round(s.readMs),computeMs:Math.round(s.computeMs)}]));}
export function resetProgrammeResultStats(){stats.clear();}
/** Drop the in-memory copies (saved files stay). Used when a worker must start cold. */
export function clearProgrammeResultMemory(){memory.clear();}

function remember(key:string,value:unknown){memory.delete(key);memory.set(key,value);while(memory.size>MEMORY_LIMIT)memory.delete(memory.keys().next().value!);}
// Saved as plain JSON: reading it back costs one parse; decompression would
// nearly double the read on the cold path for a few megabytes of disk.
const fileName=(kind:string,key:string)=>kind+'-'+key+'.json';

/**
 * Read the saved result for these exact inputs, or calculate and save it.
 * `restamp` puts the caller's request stamp on a result read back from disk,
 * so a saved result is identical to what an on-demand calculation returns.
 */
export function savedProgrammeResult<T>(kind:ProgrammeResultKind,inputs:readonly unknown[],compute:()=>T,restamp?:(value:T)=>T,
  options:{fresh?:boolean}={}):T{
  // fresh: the caller adds to the returned result, so each call gets its own copy (never a shared in-memory one).
  const key=programmeResultKey(kind,inputs);
  touchedKeys.add(fileName(kind,key));
  // A shared result is identified by its own key when it is an input to another saved result.
  const known=(value:T)=>{if(!options.fresh&&value&&typeof value==='object')fingerprints.set(value as object,'result:'+kind+':'+key);return value;};
  if(!options.fresh&&memory.has(key)){count(kind,'memory');return known(memory.get(key) as T);}
  const directory=programmeResultsDirectory();
  if(directory){
    const started=performance.now();
    try{
      const saved=JSON.parse(readFileSync(join(directory,fileName(kind,key)),'utf8')) as {kind:string;key:string;value:T};
      if(saved?.kind===kind&&saved.key===key){
        const value=restamp?restamp(saved.value):saved.value;
        if(!options.fresh)remember(key,value);count(kind,'disk',performance.now()-started);return known(value);
      }
    }catch{/* Not saved yet, or unreadable: calculate it. */}
  }
  const started=performance.now();
  const value=compute();
  const computeMs=performance.now()-started;
  if(!options.fresh)remember(key,value);
  let bytes=0;
  if(directory){
    // Take the text now: a later in-memory annotation by a page must never be saved as the result.
    const text=JSON.stringify({kind,key,code:programmeCodeFingerprint(),value});
    try{
      mkdirSync(directory,{recursive:true});
      const path=join(directory,fileName(kind,key)),temporary=path+'.'+process.pid+'.'+Math.random().toString(36).slice(2)+'.tmp';
      bytes=Buffer.byteLength(text);
      writeFileSync(temporary,text);renameSync(temporary,path);
    }catch(error){console.warn('[programme-results] save failed: '+String(error).slice(0,200));}
  }
  count(kind,'computed',computeMs,bytes);
  return known(value);
}

/** Saved-result files read or written since the last call (used to keep the folder current). */
export function takeTouchedProgrammeResults(){const keys=[...touchedKeys];touchedKeys.clear();return keys;}

export type ProgrammeManifest={schemaVersion:1;code:string;release:string;projectVersion:number;preparedAt:string;files:string[]};
const MANIFEST='manifest.json';
export function readProgrammeManifest(directory=programmeResultsDirectory()):ProgrammeManifest|null{
  if(!directory)return null;
  try{const manifest=JSON.parse(readFileSync(join(directory,MANIFEST),'utf8'));return manifest?.schemaVersion===1?manifest:null;}catch{return null;}
}
/** A manifest is current when it was written by this programme code for this project version. */
export function programmeManifestCurrent(manifest:ProgrammeManifest|null,projectVersion:number|undefined,directory=programmeResultsDirectory()){
  return Boolean(directory&&manifest&&projectVersion!==undefined&&manifest.code===programmeCodeFingerprint()&&manifest.projectVersion===projectVersion&&
    manifest.files.every(file=>existsSync(join(directory,file))));
}
/**
 * Record that every programme result of this project version is saved, and
 * remove saved files no current revision uses any more (only in a project's
 * own folder, never in a shared one).
 */
export function writeProgrammeManifest(projectVersion:number,files:readonly string[],options:{prune:boolean}){
  const directory=programmeResultsDirectory();if(!directory)return null;
  mkdirSync(directory,{recursive:true});
  const manifest:ProgrammeManifest={schemaVersion:1,code:programmeCodeFingerprint(),release:calculationReleaseKey(),projectVersion,preparedAt:new Date().toISOString(),files:[...new Set(files)].sort()};
  const path=join(directory,MANIFEST),temporary=path+'.'+process.pid+'.tmp';
  writeFileSync(temporary,JSON.stringify(manifest));renameSync(temporary,path);
  if(options.prune){
    const keep=new Set([...manifest.files,MANIFEST]);
    for(const name of readdirSync(directory)){
      if(keep.has(name))continue;
      const path=join(directory,name);
      // Leave files another request may be writing right now (newer than a minute).
      try{if(Date.now()-statSync(path).mtimeMs>60000)rmSync(path,{force:true});}catch{/* already gone */}
    }
  }
  return manifest;
}
