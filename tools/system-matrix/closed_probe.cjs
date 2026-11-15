// List visible closed sections (summary text and nesting) at load. Usage: node closed_probe.cjs <base> <project> <module>
const {chromium}=require('playwright');
const [BASE,PROJECT,MOD]=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.goto(BASE+'/?view=project&project='+encodeURIComponent(PROJECT)+'&module='+MOD,{waitUntil:'domcontentloaded',timeout:240000});
 await p.waitForSelector('#moduleContent');for(let i=0;i<300;i++){const s=await p.$eval('#moduleContent',e=>e.innerText).catch(()=>'');if(s.length>120&&!/^(Loading|Calculating|Opening|Updating|Preparing|Checking|Processing)/m.test(s.slice(0,160)))break;await p.waitForTimeout(500);}
 await p.waitForTimeout(1500);
 const rows=await p.evaluate(()=>[...document.querySelectorAll('#moduleContent details')].filter(d=>!d.open&&d.offsetParent!==null).map(d=>{let depth=0,x=d.parentElement;while(x){if(x.tagName==='DETAILS')depth++;x=x.parentElement;}
   const sec=d.closest('section,[data-section]');return depth+' '+(d.className||'-')+' | '+(d.querySelector('summary')?.innerText||'').replace(/\s+/g,' ').slice(0,90)+' | in '+(sec?.querySelector('h2,h3,h4')?.innerText||'').slice(0,40);}));
 console.log(rows.length);console.log(rows.join('\n'));await b.close();})();
