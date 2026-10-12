/* Release gate: ensure the actual assembled inline browser scripts parse.
   TypeScript compilation alone cannot detect malformed JS inside template literals. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {cmengUatHtml}=require('../dist/packages/runtime-api/src/ui.js');
const html=cmengUatHtml();
const inline=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([,attributes,code])=>!(/\bsrc\s*=/.test(attributes))&&code.trim())
  .map((match)=>match[2]);
assert.ok(inline.length>0,'No inline application script found in compiled CMeng page.');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cmeng-browser-check-'));
try{
  for(let i=0;i<inline.length;i++){
    const file=path.join(directory,'browser-'+i+'.js');
    fs.writeFileSync(file,inline[i]);
    const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(checked.status!==0){
      process.stderr.write('CMeng browser script '+(i+1)+' failed node --check:\n'+(checked.stderr||checked.stdout||'Unknown error')+'\n');
      process.exitCode=1;
      break;
    }
  }
  if(!process.exitCode)console.log('CMeng browser bootstrap: '+inline.length+' inline script(s) passed node --check.');
}finally{fs.rmSync(directory,{recursive:true,force:true});}
