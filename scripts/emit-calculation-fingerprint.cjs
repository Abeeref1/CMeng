'use strict';
/** Derive the CMeng calculation identity from all TypeScript producers,
 * contracts and runtime behavior. Purely browser-facing UI modules and the
 * gateway/cache transport do not change the source-derived calculation.
 * The exact Git release still identifies the running application and its UI.
 * If any calculation source changes, this hash changes automatically. */
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=process.cwd();
const excluded=new Set([
 'packages/runtime-api/src/project-gateway.ts',
 'packages/runtime-api/src/project-read-cache.ts',
 'packages/runtime-api/src/http-response.ts'
]);
function walk(directory,results=[]){
 for(const ent of fs.readdirSync(path.join(root,directory),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
  const rel=directory+'/'+ent.name;
  if(ent.isDirectory())walk(rel,results);
  else if(ent.isFile()&&/\.(?:ts|json)$/.test(rel)&&!excluded.has(rel)&&
    !/^packages\/runtime-api\/src\/(?:ui(?:-[a-z0-9-]+)?|brand-logo(?:-[a-z0-9-]+)?)\.ts$/.test(rel))
   results.push(rel);
 }
 return results;
}
const files=[...walk('packages'),'package.json','package-lock.json','tsconfig.json'].sort();
const hash=createHash('sha256');
for(const filename of files){hash.update(filename+'\0');hash.update(fs.readFileSync(path.join(root,filename)));hash.update('\0');}
const fingerprint=hash.digest('hex');
fs.mkdirSync(path.join(root,'dist'),{recursive:true});
fs.writeFileSync(path.join(root,'dist','calculation-fingerprint.txt'),fingerprint+'\n');
console.log('CMeng calculation fingerprint '+fingerprint.slice(0,16)+' ('+files.length+' source files)');

/* Mechanism 14: the programme results (CPM, criticality, near-critical, schedule
 * analysis, revision comparison, scope classification, BOQ-to-programme scoring)
 * are saved per revision
 * and keyed by this narrower fingerprint: the source files those calculations
 * import, followed through every relative import. A change to any of them
 * recalculates the saved results; a change elsewhere keeps them. */
const programmeEntries=[
 'packages/runtime-api/src/programme-results.ts',
 'packages/runtime-api/src/forecast-cache.ts',
 'packages/runtime-api/src/schedule-scope-classification.ts',
 'packages/independent-forecast/src/index.ts',
 'packages/schedule-analysis-core/src/index.ts',
 'packages/schedule-revision-core/src/index.ts',
 'packages/near-critical-analysis/src/index.ts',
 'packages/runtime-api/src/saved-programme-analyses.ts',
 'packages/cross-domain-mapping/src/index.ts',
 'packages/activity-analytics/src/index.ts',
 'packages/progress-scurve/src/index.ts',
 'packages/progress-breakdown/src/index.ts',
 'packages/revision-trend/src/index.ts',
 'packages/schedule-change-report/src/index.ts',
 'packages/windows-analysis/src/index.ts',
 'packages/manhour-scurve/src/index.ts',
 'packages/resource-utilization/src/index.ts',
 'packages/runtime-api/src/schedule-basis-review.ts',
];
function resolveImport(fromFile,spec){
 const base=path.join(path.dirname(fromFile),spec);
 for(const candidate of [base+'.ts',base+'.json',path.join(base,'index.ts'),base])
  if(fs.existsSync(path.join(root,candidate))&&fs.statSync(path.join(root,candidate)).isFile())return path.normalize(candidate);
 return null;
}
const closure=new Set();const queue=[...programmeEntries];
while(queue.length){
 const file=path.normalize(queue.shift());if(closure.has(file))continue;
 if(!fs.existsSync(path.join(root,file)))throw new Error('Programme fingerprint entry missing: '+file);
 closure.add(file);
 // Type-only imports do not run; follow only imports that execute.
 const text=fs.readFileSync(path.join(root,file),'utf8').replace(/(?:import|export)\s+type\s+[^;]*?from\s+['"][^'"]+['"];?/gs,'');
 for(const match of text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g)){
  const resolved=resolveImport(file,match[1]);if(resolved&&!closure.has(resolved))queue.push(resolved);
 }
}
const programmeHash=createHash('sha256');
for(const filename of [...closure].sort().concat(['package-lock.json','tsconfig.json'])){programmeHash.update(filename+'\0');programmeHash.update(fs.readFileSync(path.join(root,filename)));programmeHash.update('\0');}
const programmeFingerprint=programmeHash.digest('hex');
fs.writeFileSync(path.join(root,'dist','programme-fingerprint.txt'),programmeFingerprint+'\n');
console.log('CMeng programme fingerprint '+programmeFingerprint.slice(0,16)+' ('+closure.size+' source files)');
