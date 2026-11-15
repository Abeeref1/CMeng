// Capture every page of one project as the browser shows it, plus the canonical facts each page received.
// Usage: node capture2.cjs <base> <project> <outDir>
const {chromium}=require('playwright');const fs=require('fs');
const [BASE,PROJECT,OUT]=process.argv.slice(2);
const MODULES=JSON.parse(fs.readFileSync(__dirname+'/modlist.json','utf8')).fromReg.map(x=>({key:x[0],title:x[1],group:x[2]}));
const g=(o,p)=>p.split('.').reduce((a,k)=>a&&typeof a==='object'?a[k]:undefined,o);
function digest(d){const pf=d&&d.projectFacts;if(!pf)return null;
  return {headlineSource:g(pf,'time.forecastHeadline.source')??null,headlineIso:g(pf,'time.forecastHeadline.completionIso')??null,headlineStatement:g(pf,'time.forecastHeadline.statement')??null,
    dataDate:g(pf,'schedule.dataDateIso.value')??null,critical:g(pf,'schedule.criticalActivityCount.value')??null,nearCritical:g(pf,'schedule.nearCriticalActivityCount.value')??null,
    submittedFinish:g(pf,'schedule.submittedProgrammeCompletionIso.value')??null,programmeState:g(pf,'schedule.programmeState')??null,calendar:g(pf,'inputs.calendar')??null,
    cpmPublishable:g(pf,'inputs.cpmCoverage.publishable')??null,independentDaysAfterContract:g(pf,'time.independentDaysAfterCurrentContract.value')??null,projectVersion:pf.projectVersion??null};}
async function openPage(page,url){
  const t0=Date.now();await page.goto(url,{waitUntil:'domcontentloaded',timeout:240000});
  await page.waitForSelector('#moduleContent',{timeout:240000});
  let stuck=true;
  for(let i=0;i<360;i++){const s=await page.$eval('#moduleContent',e=>e.innerText).catch(()=>'');
    if(s.length>120&&!/^(Loading|Calculating|Opening|Updating|Preparing|Checking|Processing)/m.test(s.slice(0,160))){stuck=false;break;}await page.waitForTimeout(500);}
  await page.waitForTimeout(1500);return {ms:Date.now()-t0,stuck};
}
(async()=>{
  const local=/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE);const browser=await chromium.launch({proxy:!local&&process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
  const ctx=await browser.newContext({viewport:{width:1440,height:900}});const page=await ctx.newPage();
  let current=null;const facts={};
  page.on('response',async r=>{try{const u=r.url();if(!/\/api\/projects\//.test(u)||!(r.headers()['content-type']||'').includes('json'))return;
    const key=current;const body=await r.json().catch(()=>null);const d=body&&(body.data||body);const dg=digest(d);if(dg&&key){(facts[key]=facts[key]||[]).push({url:u.replace(BASE,'').slice(0,160),...dg});}}catch{}});
  const all=[];
  for(const m of MODULES){
    const errors=[];page.removeAllListeners('pageerror');page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));
    const row={key:m.key,title:m.title,group:m.group};current=m.key;
    try{
      Object.assign(row,await openPage(page,BASE+'/?view=project&project='+encodeURIComponent(PROJECT)+'&module='+m.key));
      await page.screenshot({path:OUT+'/'+m.key+'.png'});
      Object.assign(row,await page.evaluate(()=>{
        const root=document.querySelector('#moduleContent');const top=root.getBoundingClientRect().top;
        const vis=[];const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
        while((n=w.nextNode())){const p=n.parentElement;if(!p||!p.checkVisibility()||p.closest('script,style'))continue;const b=p.getBoundingClientRect();if(b.top<top+900){const t=n.textContent.replace(/\s+/g,' ').trim();if(t)vis.push(t);}}
        const header=(document.querySelector('.workspace-head, header, #projectStatus')?.innerText||'').replace(/\s+/g,' ').slice(0,600);
        const shown=root.innerText;const total=root.querySelectorAll('details').length;const visibleClosed=[...root.querySelectorAll('details')].filter(d=>!d.open&&d.offsetParent!==null&&!d.parentElement.closest('details:not([open])')).length;
        for(const d of root.querySelectorAll('details'))d.open=true;
        const full=root.innerText;
        return {firstScreen:vis.join(' | '),shownText:shown,fullText:full,header,closedSections:total,visibleClosedAtLoad:visibleClosed,tables:root.querySelectorAll('table').length,charts:root.querySelectorAll('svg,canvas').length};
      }));
    }catch(e){row.failure=String(e.message||e).slice(0,300);}
    row.errors=errors;row.facts=facts[m.key]||[];all.push(row);fs.writeFileSync(OUT+'/'+m.key+'.json',JSON.stringify(row,null,1));
    console.log(m.key,row.ms,row.failure?'FAILED':'',(row.fullText||'').length,row.facts.length);
  }
  current='__review__';
  try{await openPage(page,BASE+'/?view=project&project='+encodeURIComponent(PROJECT)+'&module=master-dashboard');
    await page.evaluate(()=>document.getElementById('openProjectActions')?.click());
    await page.waitForSelector('#projectReviewPanel [data-action-id], #projectReviewPanel .project-action-empty',{timeout:180000}).catch(()=>{});await page.waitForTimeout(2000);
    const review=await page.evaluate(()=>{const p=document.querySelector('#projectReviewPanel');const out={decisions:[...(p?p.querySelectorAll('[data-action-id]'):[])].map(e=>({id:e.getAttribute('data-action-id'),kind:e.getAttribute('data-action-kind')||e.className,text:e.innerText.slice(0,1500)}))};for(const d of (p?p.querySelectorAll('details'):[]))d.open=true;out.text=p?p.innerText:'';return out;});
    fs.writeFileSync(OUT+'/__review__.json',JSON.stringify(review,null,1));fs.writeFileSync(OUT+'/__review__.txt',review.text);console.log('review',review.text.length,review.decisions.length);}catch(e){console.log('review failed',e.message);}
  try{const shell=await page.evaluate(()=>({meta:document.getElementById('activeProjectMeta')?.innerText||'',badge:document.getElementById('evidenceBadge')?.innerText||'',body:document.body.innerText.slice(0,4000)}));fs.writeFileSync(OUT+'/__shell__.json',JSON.stringify(shell));}catch{}
  fs.writeFileSync(OUT+'/all.json',JSON.stringify(all.map(r=>({key:r.key,ms:r.ms,stuck:r.stuck,failure:r.failure,errors:r.errors}))));await browser.close();
})();
