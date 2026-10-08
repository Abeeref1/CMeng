// Read-only rendered-screen walk of ALL current portfolio projects.
// Large API pages are rejected before loading into Chromium; never conceal
// missing screens by declaring the browser portion successful.
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const base=String(process.env.CMENG_RAILWAY_URL||'').replace(/\/$/,'');
const expected=String(process.env.CMENG_EXPECTED_RELEASE||'');
const output=process.env.CMENG_SCREEN_ACCEPTANCE_OUTPUT||'cmeng-all-project-screens.json';
const maxBytes=2_000_000;
if(!base||!/^[0-9a-f]{40}$/.test(expected))throw Error('Exact review URL and 40-character SHA are required');
const pages=JSON.parse(readFileSync(new URL('../tests/fixtures/reem-112-review.json',import.meta.url),'utf8')).pages;
if(pages.length!==62||new Set(pages.map(p=>p.key)).size!==62)throw Error('62-surface inventory changed or incomplete');
const report={release:expected,projects:[],errors:[],status:'running'};
const diagnostics=[
  ['NOT_ESTABLISHED',/\bnot established\b/gi],
  ['NOT_ASSIGNED',/\bnot assigned\b/gi],
  ['UNRESOLVED_RECORD_ID',/\brecord id unresolved\b/gi],
  ['INTERNAL_ID',/\b(?:evidence-document:|schedrev_|boqingest_|delivery:[a-f0-9]{12,}|data\.position|data\.reportingContract)/gi],
  ['SIX_DECIMAL',/\b-?\d+\.\d{5,}\b/g],
];
const findBanned=text=>diagnostics.flatMap(([code,regex])=>{
  const n=[...text.matchAll(regex)].length;
  return n?[{code,count:n}]:[];
});
async function json(p){
  const response=await fetch(base+p,{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(p+' HTTP '+response.status);
  return response.json();
}
async function bounded(p){
  const response=await fetch(base+p,{signal:AbortSignal.timeout(45000)});
  if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
  if(!response.body)throw Error('Empty response');
  let n=0;
  const reader=response.body.getReader();
  while(true){
    const x=await reader.read();
    if(x.done)break;
    n+=x.value.byteLength;
    if(n>maxBytes){await reader.cancel();throw Error('PAGE_OVER_2MB:'+n);}
  }
  return n;
}
const urlFor=(id,entry)=>{
  const prefix='/api/projects/'+encodeURIComponent(id);
  return entry.area==='management'?prefix+'/management/'+entry.key:prefix+'/'+entry.area+'/modules/'+entry.key;
};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  const health=await json('/health');
  if(health.release!==expected)throw Error('Review SHA disagrees with expected SHA');
  const inventory=await json('/api/portfolio');
  if(inventory.projects.length!==inventory.projectCount)throw Error('Portfolio inventory incomplete');
  for(const project of inventory.projects){
    const record={projectId:project.projectId,release:expected,surfaces:[],errors:[]};
    report.projects.push(record);
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror',err=>record.errors.push(String(err)));
    try{
      await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>typeof openProject==='function'&&typeof loadModule==='function');
      const opened=await page.evaluate(async id=>{await openProject(id);setAppView('project');return overview?.projectId??null;},project.projectId);
      if(opened!==project.projectId)throw Error('Wrong active project '+opened);
      const registry=await page.evaluate(()=>moduleRegistry.map(({key,area})=>({key,area})));
      const byKey=new Map(registry.map(item=>[item.key,item]));
      for(const item of pages){
        const key=item.key, result={key,bytes:null,renderedLength:0,bannedTokens:[],error:null};
        record.surfaces.push(result);
        try{
          let sourceUrl=null;
          if(byKey.has(key))sourceUrl=urlFor(project.projectId,byKey.get(key));
          else if(key==='project-review')sourceUrl='/api/projects/'+encodeURIComponent(project.projectId)+'/actions';
          else if(key==='documents')sourceUrl='/api/projects/'+encodeURIComponent(project.projectId)+'/evidence/documents';
          else if(key==='director')sourceUrl='/api/projects/'+encodeURIComponent(project.projectId)+'/director-position';
          else if(key==='portfolio')sourceUrl='/api/portfolio';
          if(sourceUrl)result.bytes=await bounded(sourceUrl);
          let rendered;
          if(byKey.has(key)){
            rendered=await page.evaluate(async moduleKey=>{
              setAppView('project');await loadModule(moduleKey);
              const container=document.getElementById('moduleContent');
              const panel=document.getElementById('projectModulePanel');
              return {text:container?.innerText??'',selected:(typeof currentModuleResult!=='undefined')?currentModuleResult?.key:null,
                visible:!!panel&&panel.getClientRects().length>0};
            },key);
            if(rendered.selected!==key||!rendered.visible)throw Error('Expected module not displayed');
          }else if(key==='project-review'){
            rendered=await page.evaluate(()=>{
              setAppView('project');
              document.getElementById('openProjectActions')?.click();
              return {text:document.getElementById('projectReviewDrawer')?.innerText??''};
            });
          }else if(key==='documents'){
            rendered=await page.evaluate(()=>{
              setAppView('project');
              document.getElementById('openLibraryQuick')?.click();
              return {text:document.getElementById('evidenceLibraryDrawer')?.innerText??''};
            });
          }else if(key==='director'){
            rendered=await page.evaluate(async()=>{
              setAppView('project');await loadModule('pmo-analysis');
              const drawer=document.getElementById('directorDrawer');
              if(drawer)drawer.open=true;
              return {text:drawer?.innerText??''};
            });
          }else if(key==='ask-cmeng'){
            rendered=await page.evaluate(()=>{
              setAppView('ai');
              return {text:(document.getElementById('aiView')??document.getElementById('aiPanel')??document.body)?.innerText??''};
            });
          }else if(key==='portfolio'){
            rendered=await page.evaluate(async()=>{
              setAppView('portfolio');await loadPortfolio();
              return {text:document.getElementById('portfolioProjects')?.innerText??''};
            });
            if(!rendered.text.includes(project.projectId))throw Error('Project missing in visible portfolio');
          }else throw Error('Unknown surface '+key);
          const text=String(rendered.text??'');
          result.renderedLength=text.length;
          result.bannedTokens=findBanned(text);
          if(text.length<10||/Unable to load|Try this view again/i.test(text))throw Error('Blank/failed screen');
          if(result.bannedTokens.length)throw Error('Banned screen text: '+result.bannedTokens.map(b=>b.code+'='+b.count).join(','));
          if(result.bytes===null)result.bytes=Buffer.byteLength(text,'utf8');
        }catch(error){result.error=error instanceof Error?error.message:String(error);}
      }
    }catch(error){
      record.errors.push(error instanceof Error?error.message:String(error));
    }finally{
      await context.close();
      writeFileSync(output,JSON.stringify(report,null,2));
      console.log(JSON.stringify({project:project.projectId,completedSurfaces:record.surfaces.length,
        errors:record.errors.length+record.surfaces.filter(s=>s.error).length}));
    }
  }
  const last=await json('/health');
  if(last.release!==expected)report.errors.push('Release changed during rendered-page walk');
  report.status=report.errors.length===0&&report.projects.length===inventory.projectCount&&
    report.projects.every(p=>p.errors.length===0&&p.surfaces.length===62&&
      p.surfaces.every(s=>s.error===null&&s.bytes>0&&s.bytes<=maxBytes&&s.bannedTokens.length===0))?'pass':'fail';
}catch(error){
  report.errors.push(error instanceof Error?error.message:String(error));
  report.status='fail';
}finally{
  await browser.close();
  writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({status:report.status,projects:report.projects.length,errors:report.errors.length}));
  if(report.status!=='pass')process.exitCode=1;
}
