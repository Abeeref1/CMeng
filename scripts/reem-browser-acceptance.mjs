// Live rendered 62-surface acceptance: browser text, not API snapshot only.
// Requirements: npm install --no-save playwright && npx playwright install chromium
// A passing result is NOT consultant acceptance; independent source evidence
// and same-SHA review deployment are mandatory.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const base=String(process.env.CMENG_RAILWAY_URL||'').replace(/\/$/,'');
const expectedSha=String(process.env.CMENG_EXPECTED_RELEASE||'');
if(!base||!/^[a-f0-9]{40}$/.test(expectedSha))throw Error('Set CMENG_RAILWAY_URL and CMENG_EXPECTED_RELEASE (exact deployed SHA).');
const pages=JSON.parse(readFileSync(new URL('../tests/fixtures/reem-112-review.json',import.meta.url),'utf8')).pages;
const referencePath=resolve(process.env.CMENG_SCREEN_EXPECTATIONS_PATH||'tests/fixtures/reem-112-screen-answers.json');
const oracle=JSON.parse(readFileSync(referencePath,'utf8'));
if(pages.length!==62||new Set(pages.map(p=>p.key)).size!==62)throw Error('The original 62-surface review inventory is missing or duplicated.');
if(oracle.projectId!=='REEM 112')throw Error('Refusing to test with a different source project.');
const result={release:expectedSha,projectId:oracle.projectId,scope:'Live rendered text of all 62 original surfaces',pages:[],failed:[],dataSizes:[],crossPageChecks:[],sourceChecks:[],errors:[],ready:false};
const fail=(code,detail)=>result.failed.push({code,detail});
const get=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(path+' HTTP '+r.status);return r.json();};
const health=await get('/health');
if(health.release!==expectedSha)throw Error('Review deployment '+health.release+' is not the tested SHA '+expectedSha);
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(90000);
const browserErrors=[];
page.on('pageerror',e=>browserErrors.push(String(e)));
const moduleResults=new Map();
try{
 await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>typeof openProject==='function'&&typeof loadModule==='function');
 const active=await page.evaluate(async id=>{await openProject(id);setAppView('project');return overview?.projectId??null;},oracle.projectId);
 if(active!==oracle.projectId)throw Error('Browser did not select REEM 112; selected '+active);
 const registry=await page.evaluate(()=>moduleRegistry.map(({key})=>key));
 for(const item of pages){
  const key=item.key;
  let rendered;
  if(registry.includes(key)){
   rendered=await page.evaluate(async moduleKey=>{
    setAppView('project');
    await loadModule(moduleKey);
    const container=document.getElementById('moduleContent');
    const value=(typeof currentModuleResult!=='undefined')?currentModuleResult:null;
    const panel=document.getElementById('projectModulePanel');
    return {text:container?.innerText??'',html:container?.innerHTML??'',selected:value?.key??null,
      inViewport:!!panel&&panel.getClientRects().length>0,
      jsonBytes:value?new TextEncoder().encode(JSON.stringify(value)).length:null,
      title:document.getElementById('moduleTitle')?.innerText??''};
   },key);
   if(rendered.selected!==key)fail('NOT_RENDERED',key+' rendered '+rendered.selected);
   if(!rendered.inViewport||rendered.text.trim().length<20||/Unable to load|Try this view again/.test(rendered.text))
     fail('NO_USABLE_PAGE',key+' has no usable rendered result');
   if(rendered.jsonBytes===null||rendered.jsonBytes>2_000_000)
     fail('PAGE_WEIGHT',key+' uncompressed rendered response '+rendered.jsonBytes+' bytes; maximum 2,000,000');
  }else if(key==='project-review'){
   rendered=await page.evaluate(async()=>{
    setAppView('project');
    document.getElementById('openProjectActions')?.click();
    return {text:document.getElementById('projectReviewDrawer')?.innerText??'',html:document.getElementById('projectReviewDrawer')?.innerHTML??'',title:'Project review'};
   });
  }else if(key==='documents'){
   rendered=await page.evaluate(()=>{
    setAppView('project');document.getElementById('openLibraryQuick')?.click();
    return {text:document.getElementById('evidenceLibraryDrawer')?.innerText??'',title:'Documents'};
   });
  }else if(key==='director'){
   rendered=await page.evaluate(async()=>{
    setAppView('project');await loadModule('pmo-analysis');
    const drawer=document.getElementById('directorDrawer');if(drawer)drawer.open=true;
    return {text:drawer?.innerText??'',title:'Management position drawer'};
   });
  }else if(key==='ask-cmeng'){
   rendered=await page.evaluate(()=>{
    setAppView('ai');
    const root=document.getElementById('aiView')??document.getElementById('aiPanel')??document.body;
    return {text:root.innerText.slice(0,40000),title:'Ask CMeng landing; no questions submitted'};
   });
  }else if(key==='portfolio'){
   rendered=await page.evaluate(async()=>{
    setAppView('portfolio');await loadPortfolio();
    return {text:document.getElementById('portfolioProjects')?.innerText??'',title:'Portfolio'};
   });
   if(!rendered.text.includes(oracle.projectId))fail('PORTFOLIO_PROJECT_MISSING','REEM 112 absent from live portfolio');
  }else throw Error('Unknown original surface '+key);
  const text=String(rendered.text??'');
  if(text.length<10)fail('BLANK_SURFACE',key);
  const forbidden=[/\bevidence-document:[\w-]+/i,/\bschedrev_[\w-]+/i,/\b(?:data\.position|data\.basis|data\.reportingContract)\b/];
  for(const rule of forbidden)if(rule.test(text))fail('INTERNAL_TEXT',key+' displays '+rule);
  moduleResults.set(key,text);
  result.pages.push({key,title:rendered.title??item.label,renderedLength:text.length,jsonBytes:rendered.jsonBytes??null});
 }
 if(result.pages.length!==62)fail('INCOMPLETE_WALK','Visited '+result.pages.length+' of 62');
 // All expected answers must have independently identified source evidence.
 // We never promote values copied from the app's output into accepted truth.
 const assertions=Array.isArray(oracle.assertions)?oracle.assertions:[];
 if(assertions.length===0)fail('NO_INDEPENDENT_ANSWER_KEY','No independent source-to-screen assertions were supplied.');
 for(const entry of assertions){
  const {id,surfaces,text:needle,sourceDocument,sourceLocator,approvedBy}=entry;
  if(!sourceDocument||!sourceLocator||!approvedBy){
   fail('UNVERIFIED_EXPECTATION',String(id)+' missing independent source document, locator or consultant sign-off');
   continue;
  }
  if(!Array.isArray(surfaces)||!surfaces.length||typeof needle!=='string'||!needle.trim()){
   fail('INVALID_ASSERTION',String(id));continue;
  }
  const observed=[];
  for(const surface of surfaces){
   const content=moduleResults.get(surface);
   if(!content){fail('ASSERTION_SURFACE_MISSING',String(id)+' '+surface);continue;}
   const matched=content.includes(needle);
   result.sourceChecks.push({id,surface,expected:needle,matched,sourceDocument,sourceLocator,approvedBy});
   if(!matched)fail('SOURCE_TEXT_MISMATCH',String(id)+' '+surface+' missing '+needle);
   observed.push({surface,matched});
  }
  result.crossPageChecks.push({id,sourceDocument,surfaces:observed.map(v=>v.surface),agreed:observed.every(v=>v.matched)});
 }
 // A missing proof for any of the 57 module screens still fails until the
 // consultant supplies an independent per-page answer and source reference.
 const covered=new Set(assertions.filter(a=>a.sourceDocument&&a.sourceLocator&&a.approvedBy)
   .flatMap(a=>a.surfaces??[]));
 for(const item of pages)if(!covered.has(item.key))
   fail('NO_PAGE_LEVEL_SOURCE_PROOF',item.key+' has no signed source-to-screen assertion');
 result.errors=browserErrors;
 if(browserErrors.length)fail('BROWSER_ERROR',browserErrors.slice(0,10).join('; '));
 result.ready=result.failed.length===0;
}finally{
 await browser.close();
 const location=process.env.CMENG_SCREEN_ACCEPTANCE_OUTPUT||'/tmp/cmeng-reem-screen-acceptance.json';
 writeFileSync(location,JSON.stringify(result,null,2));
 console.log(JSON.stringify({release:result.release,surfaces:result.pages.length,sourceChecks:result.sourceChecks.length,
   failures:result.failed.length,firstFailures:result.failed.slice(0,16),evidence:location}));
}
if(!result.ready)process.exitCode=1;
