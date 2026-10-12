'use strict';
/* Fast release gate. Checks the actual assembled browser and HTTP modules.
 * Optional largestSourceReport is a read-only full production report captured
 * before deployment; its canonical output is passed through this build's
 * transport and rendered by this build's browser, without inventing inputs. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'cmeng-fast-gate-'));
process.env.CMENG_DATA_DIR=root;process.env.CMENG_TEST_MODE='1';process.env.CMENG_OCR_ENABLED='0';
const {createCmengServer}=require('../dist/packages/runtime-api/src/server');
const {loadCertifiedDemoProject}=require('../dist/packages/runtime-api/src/demo-project');
const {moduleRegistry}=require('../dist/packages/runtime-api/src/registry');
const {pageProjectResponse,PROJECT_SCREEN_MAX_BYTES}=require('../dist/packages/runtime-api/src/response-paging');
const report={schema:'cmeng-fast-release-gate-v1',sourceSha:process.env.GITHUB_SHA||null,demoProject:'UAT-FAST-RELEASE',pages:[],largest:null,errors:[],passed:false};
(async()=>{
  loadCertifiedDemoProject(report.demoProject);
  const server=createCmengServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CMENG_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    if(process.env.CMENG_BROWSER_IN_MEMORY==='1'){
      // The local sandbox prohibits browser navigation to loopback. Exercise
      // the same HTTP server through Node and keep the full real browser DOM.
      // CI/release runs use normal navigation below, not this local bridge.
      await page.exposeFunction('__localHttp',async (url,options)=>{
        const requestOptions={...(options||{})};delete requestOptions.signal;
        const response=await fetch(new URL(url,base),requestOptions);
        return {body:await response.text(),status:response.status,headers:Object.fromEntries(response.headers)};
      });
      await page.evaluate(()=>{
        const values=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}});
        window.fetch=async (url,options)=>{const r=await window.__localHttp(String(url),options);return new Response(r.body,{status:r.status,headers:r.headers});};
      });
      const {cmengUatHtml}=require('../dist/packages/runtime-api/src/ui');
      await page.setContent(cmengUatHtml(),{waitUntil:'domcontentloaded'});
    }else await page.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForFunction(()=>typeof openProject==='function'&&typeof loadModule==='function');
    const opened=await page.evaluate(async id=>{await openProject(id);setAppView('project');return {id:overview?.projectId??null,text:document.getElementById('moduleContent')?.innerText};},report.demoProject);
    assert.equal(opened.id,report.demoProject,'Demo open failed: '+opened.text+'; '+errors.join('; '));
    for(const {key} of moduleRegistry){
      const n=errors.length;
      const data=await page.evaluate(async key=>{
        await loadModule(key);
        return {key,selected:currentModuleResult?.key,title:document.getElementById('moduleTitle')?.textContent,text:document.getElementById('moduleContent')?.innerText||'',bytes:currentModuleResult?new TextEncoder().encode(JSON.stringify(currentModuleResult)).length:0};
      },key);
      const passed=data.selected===key&&data.text.trim().length>10&&!/Unable to load|Try this view again|SCREEN_FACTS_EXCEED_RESPONSE_BUDGET/.test(data.text)&&errors.length===n&&data.bytes<2_000_000;
      report.pages.push({key,selected:data.selected,bytes:data.bytes,passed,error:passed?null:data.text.slice(0,400)});
    }
    report.errors.push(...errors);
    const largest=process.env.CMENG_LARGEST_REPORT;
    if(largest){
      const full=JSON.parse(fs.readFileSync(largest,'utf8'));
      const value=full.result??full,id=value.data?.projectId??value.data?.projectFacts?.projectId;
      assert.equal(typeof id,'string','the largest report must retain its source project');
      const route='/api/projects/'+encodeURIComponent(id)+'/management/master-dashboard';
      const projected=pageProjectResponse(value,route),size=Buffer.byteLength(JSON.stringify(projected));
      assert.ok(size<=PROJECT_SCREEN_MAX_BYTES,'largest-project response exceeds unchanged screen budget: '+size);
      const rendered=await page.evaluate(({projected,id})=>{
        ++projectRequestSeq;++moduleRequestSeq;
        document.getElementById('projectId').value=id;
        overview={projectId:id,latestDataDateIso:projected.data?.projectFacts?.dataDateIso,moduleStates:[],managementStates:[]};
        appView='project';projectLoadState='ready';selected='master-dashboard';
        renderModuleResult(projected);
        return {text:document.getElementById('moduleContent')?.innerText||'',selected:currentModuleResult?.key};
      },{projected,id});
      assert.equal(rendered.selected,'master-dashboard');
      assert.ok(rendered.text.length>100&&!/Unable to load|SCREEN_FACTS_EXCEED_RESPONSE_BUDGET/.test(rendered.text));
      // Every scalar fact value/state/basis remains identical. Only long
      // provenance and member identity arrays may be paged in transport.
      const skipped=/(?:sourceRefs|sourceReferences|memberIds|memberActionIds|activityIds|relationshipIds|recordIds|documentIds|receiptIds|checkIds|affectedActivityIds|missingBaselineActivityIds|missingActualFinishActivityIds|unknownLagRelationshipIds|finishActivityIds)$/i;
      const compare=(a,b,field='')=>{if(Array.isArray(a)){if(skipped.test(field))return;assert.ok(Array.isArray(b));assert.equal(a.length,b.length);a.forEach((v,i)=>compare(v,b[i]));}else if(a&&typeof a==='object'){for(const[k,v]of Object.entries(a))compare(v,b?.[k],k);}else assert.deepEqual(b,a);};
      compare(value.data.projectFacts,projected.data.projectFacts);
      report.largest={projectId:id,bytes:size,originalBytes:Buffer.byteLength(JSON.stringify(value)),scalarFactsUnchanged:true,rendered:true};
    }
    report.passed=report.errors.length===0&&report.pages.length===moduleRegistry.length&&report.pages.every(p=>p.passed)&&(!process.env.CMENG_REQUIRE_LARGEST||!!report.largest);
    assert.ok(report.passed,'Fast release gate failed; see report');
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{report.errors.push(String(e));process.exitCode=1;}).finally(()=>{
  fs.writeFileSync(process.env.CMENG_FAST_GATE_REPORT||'fast-release-gate.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  fs.rmSync(root,{recursive:true,force:true,maxRetries:3});
});
