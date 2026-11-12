import test from 'node:test';
import assert from 'node:assert/strict';
import {pageLayoutScript,pageLayoutStyles} from '../packages/runtime-api/src/ui-page-layout';
import {countTextSource} from '../packages/runtime-api/src/count-text';

// P3 (owner rule, shared page layout): on every page the management answer leads,
// the page's actions follow, and qualifications and system evidence come after them.
// Unknown information is stated once, not on every row or in every block.
// The real shared layout script runs in a real headless Chromium on a synthetic page.

function loadChromium():any{
  try{return require('playwright').chromium;}catch{return null;}
}

function pageHtml(body:string){
  return '<!doctype html><html><head><meta charset="utf-8"><style>'+pageLayoutStyles+
    ' body{margin:0;font:14px sans-serif} #moduleContent{width:1200px} .tall{height:900px}</style></head><body><div id="moduleContent">'+body+
    '</div><script>'+countTextSource()+';const fmt=n=>Number(n).toLocaleString("en-US");'+pageLayoutScript+'</script></body></html>';
}

const VERDICT='<section class="position-verdict amber"><h4>Review needed</h4><p><b>Current finding:</b> The contractor\'s programme finishes on 23 Aug 2049.</p></section>';
const BASIS='<div class="module-basis"><span class="basis-chip"><b>Programme basis</b><strong>Update March</strong></span><span class="basis-chip"><b>Data date</b><strong>4 Mar 2039</strong></span></div>';
const EVIDENCE='<section class="planning-panel management-panel" data-page-role="evidence"><div class="planning-panel-head"><div><h4>Control Readiness</h4><p>Calculation availability and checks.</p></div></div><div class="planning-panel-body"><div class="planning-kpi"><b>Fully defensible views</b><strong>12</strong></div></div></section>';
const TILES='<div class="planning-kpi-grid"><div class="planning-kpi"><b>Forecast finish</b><strong>23 Aug 2049</strong></div></div>';
const ACTION='<p class="action-notification">Confirm the schedule used for reporting. <button class="btn small">Open project review</button></p>';
const LINK='<p class="module-evidence-link">Evidence and qualifications</p>';

async function run(chromium:any,body:string,fn:string){
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.setContent(pageHtml(body));
    return await page.evaluate(fn);
  }finally{await browser.close();}
}

const ORDER=`(()=>{const c=document.getElementById('moduleContent');arrangePageDetail(c);
 return Array.from(c.children).map(n=>n.className.split(' ')[0]+(n.dataset.pageRole?':'+n.dataset.pageRole:''));})()`;

test('a page that fits: the answer leads, the basis line follows it, then content, actions, and system evidence last',async t=>{
  const chromium=loadChromium();if(!chromium){t.skip('Chromium is not available');return;}
  // As the page renderer emits it today: basis first, evidence before the answer tiles, action at the end.
  const order=await run(chromium,BASIS+VERDICT+EVIDENCE+LINK+TILES+ACTION,ORDER);
  assert.deepEqual(order,['position-verdict','module-basis','planning-kpi-grid','action-notification','planning-panel:evidence','module-evidence-link']);
});

test('a long page: system evidence never takes first-screen room from the answer; it goes to More detail',async t=>{
  const chromium=loadChromium();if(!chromium){t.skip('Chromium is not available');return;}
  const tall='<section class="planning-panel"><h4>Activity table</h4><div class="tall">rows</div></section>';
  const result=await run(chromium,BASIS+VERDICT+EVIDENCE+TILES+tall+tall+tall+ACTION,`(()=>{const c=document.getElementById('moduleContent');arrangePageDetail(c);
   const more=c.querySelector('.page-more-detail');const first=c.firstElementChild;
   return {first:first.className,evidenceInMore:!!more&&more.contains(c.querySelector('[data-page-role="evidence"]')),
     tilesInMore:!!more&&more.contains(c.querySelector('.planning-kpi-grid')),actionInMore:!!more&&more.contains(c.querySelector('.action-notification'))};})()`);
  assert.equal(result.first,'position-verdict amber','the verdict is the first thing on the page');
  assert.equal(result.evidenceInMore,true,'Control Readiness goes to More detail');
  assert.equal(result.tilesInMore,false,'the answer tiles stay on the first screen');
  assert.equal(result.actionInMore,false,'the page action stays on the first screen');
});

test('inside a panel the method note follows the panel answer',async t=>{
  const chromium=loadChromium();if(!chromium){t.skip('Chromium is not available');return;}
  const panel='<section class="planning-panel management-panel"><div class="planning-panel-head"><div><h4>Executive Project Position</h4><p>Established and qualified positions. Missing measures are kept out.</p></div></div><div class="planning-panel-body"><div class="planning-kpi"><b>Finish</b><strong>23 Aug 2049</strong></div></div></section>';
  const last=await run(chromium,VERDICT+panel,`(()=>{const c=document.getElementById('moduleContent');arrangePageDetail(c);const p=c.querySelector('.management-panel');return p.lastElementChild.className+'|'+p.lastElementChild.textContent;})()`);
  assert.match(last,/^page-panel-basis\|Established and qualified positions/);
});

test('an unknown column is one line, not one cell per row; known columns stay',async t=>{
  const chromium=loadChromium();if(!chromium){t.skip('Chromium is not available');return;}
  const rows=['A','B','C','D','E'].map(id=>'<tr><td>'+id+'</td><td>12 May 2040</td><td>Not established</td></tr>').join('');
  const table='<div class="table-wrap"><table><thead><tr><th>Activity</th><th>Planned finish</th><th>Forecast finish</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  const result=await run(chromium,VERDICT+table,`(()=>{const c=document.getElementById('moduleContent');arrangePageDetail(c);
   const shown=s=>Array.from(c.querySelectorAll(s)).filter(n=>n.checkVisibility()).length;
   return {line:c.querySelector('.page-unknown-once')?.textContent,unknownCellsShown:Array.from(c.querySelectorAll('td')).filter(n=>n.checkVisibility()&&/Not established/.test(n.textContent)).length,
     plannedShown:shown('td:nth-child(2)'),cellsKept:c.querySelectorAll('td').length};})()`);
  assert.equal(result.line,'Not established for every row: Forecast finish.');
  assert.equal(result.unknownCellsShown,0,'the unknown is not repeated on every row');
  assert.equal(result.plannedShown,5,'the known column stays on every row');
  assert.equal(result.cellsKept,15,'nothing is removed from the table');
});

test('the same unknown sentence on many rows is stated once above the table',async t=>{
  const chromium=loadChromium();if(!chromium){t.skip('Chromium is not available');return;}
  const sentence='Not established: no progress record supplied for this activity.';
  const rows=['A','B','C','D'].map((id,i)=>'<tr><td>'+id+'</td><td>'+(i===3?'45%':sentence)+'</td></tr>').join('');
  const table='<table><thead><tr><th>Activity</th><th>Progress</th></tr></thead><tbody>'+rows+'</tbody></table>';
  const result=await run(chromium,VERDICT+table,`(()=>{const c=document.getElementById('moduleContent');arrangePageDetail(c);
   const visible=Array.from(c.querySelectorAll('td:nth-child(2)')).map(td=>td.innerText.trim());
   return {visible,line:c.querySelector('.page-unknown-once')?.textContent,kept:Array.from(c.querySelectorAll('td')).filter(td=>td.textContent.includes('no progress record supplied')).length};})()`);
  assert.deepEqual(result.visible,['Not established','Not established','Not established','45%']);
  assert.equal(result.line,'Progress (3 rows): '+sentence);
  assert.equal(result.kept,3,'the full sentence stays in each cell');
});

test('the same unknown sentence in several blocks is shown once',async t=>{
  const chromium=loadChromium();if(!chromium){t.skip('Chromium is not available');return;}
  const note='Contract comparison is not established because no contractual completion date has been confirmed.';
  const body=VERDICT+'<div class="notice warn">'+note+'</div><section class="planning-panel"><h4>Time</h4><p>'+note+'</p></section><section class="planning-panel"><h4>Cost</h4><p>'+note+'</p><p>Cost is 4% over budget.</p></section>';
  const shown=await run(chromium,body,`(()=>{const c=document.getElementById('moduleContent');arrangePageDetail(c);
   return Array.from(c.querySelectorAll('p,.notice')).filter(n=>n.checkVisibility()&&n.textContent.trim()===${JSON.stringify(note)}).length+'|'+c.innerText.includes('Cost is 4% over budget.');})()`);
  assert.equal(shown,'1|true');
});

test('a line that only says a figure is not calculable never opens the page; the answer and actions come first',async t=>{
  const chromium=loadChromium();if(!chromium){t.skip('Chromium is not available');return;}
  const unknown='<p class="boq-coverage"><b>BOQ programme coverage:</b> Not calculable, because no BOQ quantities are linked. <button class="btn small">Review scope links</button></p>';
  const order=await run(chromium,BASIS+VERDICT+unknown+TILES+ACTION,ORDER);
  assert.deepEqual(order,['position-verdict','module-basis','planning-kpi-grid','action-notification','boq-coverage']);
});
