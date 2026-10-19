#!/usr/bin/env node
// T10 look check in a real browser (not run in CI). Usage:
//   node scripts/t10-look-browser-check.cjs <base-url> [page-path ...]
// For each page it reports: tables without sort buttons (L5), filter lists with only "All" that are still
// usable (L5), text below 4.5:1 contrast and sort buttons that cannot take keyboard focus (L6),
// empty tables with no reason (S2), chart panels drawn empty (S3), and horizontal page overflow (L4).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2];
const paths=process.argv.slice(3);
if(!base){console.error('usage: t10-look-browser-check.cjs <base-url> [page-path ...]');process.exit(2);}
(async()=>{
 const browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 let failures=0;
 for(const path of paths.length?paths:['/']){
  await page.goto(base.replace(/\/$/,'')+path,{waitUntil:'networkidle'});
  await page.waitForTimeout(500);
  const result=await page.evaluate(()=>{
   const lum=rgb=>{const c=rgb.slice(0,3).map(v=>v/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
   const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const p=m[1].split(',').map(Number);return p.length===4?p:[...p,1];};
   const background=el=>{for(let n=el;n;n=n.parentElement){const c=parse(getComputedStyle(n).backgroundColor);if(c&&c[3]>0.9)return c;}return [255,255,255,1];};
   const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';};
   const tables=[...document.querySelectorAll('table')].filter(visible);
   const unsorted=tables.filter(t=>t.tHead&&[...t.tHead.querySelectorAll('th')].some(th=>th.textContent.trim()&&!th.querySelector('.th-sort,input,select,button,a'))).length;
   const emptyNoReason=tables.filter(t=>![...t.tBodies].some(b=>b.rows.length)).length;
   const singleChoice=[...document.querySelectorAll('select')].filter(visible).filter(s=>!s.disabled&&s.options.length>0&&[...s.options].every(o=>/^all\b/i.test(o.textContent.trim())||o.value==='')).length;
   const emptyCharts=[...document.querySelectorAll('[data-visual-panel] .visual-chart-body')].filter(visible).filter(b=>!b.children.length&&!b.textContent.trim()).length;
   const sortNotFocusable=[...document.querySelectorAll('.th-sort')].filter(b=>b.tabIndex<0).length;
   const lowContrast=[];
   for(const el of document.querySelectorAll('body *')){
    if(!visible(el)||![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
    const style=getComputedStyle(el),fg=parse(style.color);if(!fg||Number(style.opacity)<0.5||el.closest('[disabled],[aria-disabled=true]'))continue;
    const bg=background(el),a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);
    if(ratio<(large?3:4.5))lowContrast.push((el.textContent||'').trim().slice(0,40)+' '+ratio.toFixed(2));
   }
   const overflow=document.documentElement.scrollWidth>window.innerWidth+1;
   return {tables:tables.length,unsorted,emptyNoReason,singleChoice,emptyCharts,sortNotFocusable,lowContrast:lowContrast.slice(0,10),lowContrastCount:lowContrast.length,overflow};
  });
  const bad=result.unsorted+result.emptyNoReason+result.singleChoice+result.emptyCharts+result.sortNotFocusable+result.lowContrastCount+(result.overflow?1:0);
  failures+=bad;
  console.log(JSON.stringify({path,...result}));
 }
 await browser.close();
 process.exit(failures?1:0);
})().catch(error=>{console.error(error);process.exit(2);});
