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
