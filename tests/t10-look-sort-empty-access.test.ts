// T10 look rules on the shared renderers: L5 (filters with real choices, sortable tables),
// L6 (contrast and keyboard access), S2 (an empty table says why), S3 (no empty chart).
// The functions under test are taken from the complete assembled browser script.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from './browser-context';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';

// A small element model with the parts of the DOM the shared look code uses.
class Text{nodeType=3;parentNode:El|null=null;constructor(public data:string){}get textContent(){return this.data;}remove(){this.parentNode?.removeChild(this);}}
type Node=El|Text;
class El{
 nodeType=1;parentNode:El|null=null;childNodes:Node[]=[];attrs:Record<string,string>={};
 disabled=false;multiple=false;value='';type='';title='';selectedIndex=0;
 private spans:Record<string,number>={};
 constructor(public tagName:string,public ownerDocument:any){}
 get children(){return this.childNodes.filter((n):n is El=>n instanceof El);}
 get firstChild():Node|null{return this.childNodes[0]??null;}
 get isConnected(){return true;}
 get className(){return this.attrs.class??'';}set className(v:string){this.attrs.class=v;}
 get classList(){const self=this;const list=()=>self.className.split(/\s+/).filter(Boolean);return{contains:(c:string)=>list().includes(c),add:(c:string)=>{if(!list().includes(c))self.className=[...list(),c].join(' ');},remove:(c:string)=>{self.className=list().filter(x=>x!==c).join(' ');}};}
 get colSpan(){return this.spans.colSpan??Number(this.attrs.colspan??1);}set colSpan(v:number){this.spans.colSpan=v;this.attrs.colspan=String(v);}
 get rowSpan(){return Number(this.attrs.rowspan??1);}
 get textContent():string{return this.childNodes.map(n=>n.textContent).join('');}
 set textContent(v:string){this.childNodes=[];this.appendChild(new Text(v));}
 get tHead():El|null{return this.children.find(c=>c.tagName==='THEAD')??null;}
 get tBodies(){return this.children.filter(c=>c.tagName==='TBODY');}
 get rows(){return this.children.filter(c=>c.tagName==='TR');}
 get cells(){return this.children.filter(c=>c.tagName==='TH'||c.tagName==='TD');}
 get options(){return this.children.filter(c=>c.tagName==='OPTION');}
 get nextElementSibling():El|null{const s:El[]=this.parentNode?.children??[];return s[s.indexOf(this)+1]??null;}
 getAttribute(n:string){return n in this.attrs?this.attrs[n]!:null;}
 setAttribute(n:string,v:string){this.attrs[n]=String(v);}
 hasAttribute(n:string){return n in this.attrs;}
 removeAttribute(n:string){delete this.attrs[n];}
 appendChild(n:Node){n.parentNode?.removeChild(n);n.parentNode=this;this.childNodes.push(n);return n;}
 removeChild(n:Node){this.childNodes=this.childNodes.filter(x=>x!==n);n.parentNode=null;}
 remove(){this.parentNode?.removeChild(this);}
 insertAdjacentElement(_where:'afterend',n:El){const p=this.parentNode!;n.parentNode?.removeChild(n);n.parentNode=p;p.childNodes.splice(p.childNodes.indexOf(this)+1,0,n);}
 matches(selector:string):boolean{return selector.split(',').some(one=>{
  const m=one.trim().match(/^([a-z]*)((?:\.[\w-]+)*)(?:\[([\w-]+)(?:=([\w-]+))?\])?$/i);if(!m)throw new Error('selector '+one);
  const[,tag,classes,attr,attrValue]=m;
  if(tag&&this.tagName!==tag.toUpperCase())return false;
  if(classes&&!classes.split('.').filter(Boolean).every(c=>this.classList.contains(c)))return false;
  if(attr){const v=attr==='type'?this.type||this.attrs.type:this.attrs[attr];if(v===undefined)return false;if(attrValue!==undefined&&v!==attrValue)return false;}
  return true;});}
 closest(selector:string){let n:El|null=this;while(n){if(n.matches(selector))return n;n=n.parentNode;}return null;}
 querySelectorAll(selector:string){const out:El[]=[];const walk=(e:El)=>{for(const c of e.children){if(c.matches(selector))out.push(c);walk(c);}};walk(this);return out;}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]??null;}
}
const doc:any={createElement:(t:string)=>new El(t.toUpperCase(),doc)};
function h(tag:string,attrs:Record<string,string>|null,...kids:(Node|string)[]){
 const e=new El(tag.toUpperCase(),doc);for(const[k,v]of Object.entries(attrs??{})){if(k==='value')e.value=v;else if(k==='type'){e.type=v;e.attrs.type=v;}else e.attrs[k]=v;}
 for(const k of kids)e.appendChild(typeof k==='string'?new Text(k):k);return e;
}
const table=(head:string[],rows:string[][])=>h('table',null,h('thead',null,h('tr',null,...head.map(x=>h('th',null,x)))),h('tbody',null,...rows.map(r=>h('tr',null,...r.map(x=>h('td',null,x))))));
const column=(t:El,i:number)=>t.tBodies[0]!.rows.map(r=>r.cells[i]!.textContent);
const run=(code:string,context:Record<string,unknown>={})=>runInNewContext(code,{...context,document:undefined,MutationObserver:undefined});

test('L5: every table header becomes a keyboard sort button with aria-sort, and sorting reorders only the shown rows',()=>{
 const t=table(['Activity','Float'],[['A100','10 days'],['A200','Not established'],['A300','-3 days'],['A400','1,200 days']]);
 run('lookEnhanceTable(t)',{t});
 const ths=t.tHead!.rows[0]!.cells;
 for(const th of ths){const b=th.querySelector('.th-sort')!;assert.ok(b,'header has a sort button');assert.equal(b.tagName,'BUTTON');assert.equal(b.type,'button');assert.equal(th.getAttribute('aria-sort'),'none');assert.match(b.getAttribute('aria-label')!,/^Sort by /);}
 assert.equal(ths[1]!.textContent,'Float','header text is kept');
 const click=(i:number)=>run('lookHandleSortClick({target:b})',{b:ths[i]!.querySelector('.th-sort')});
 click(1);
 assert.deepEqual(column(t,1),['-3 days','10 days','1,200 days','Not established']);
 assert.equal(ths[1]!.getAttribute('aria-sort'),'ascending');assert.equal(ths[0]!.getAttribute('aria-sort'),'none');
 click(1);
 assert.deepEqual(column(t,1),['1,200 days','10 days','-3 days','Not established'],'unknown stays last; it is never read as the smallest number');
 assert.equal(ths[1]!.getAttribute('aria-sort'),'descending');
 // Enhancing again (re-render observer) never doubles the buttons.
 run('lookEnhanceTable(t)',{t});assert.equal(t.querySelectorAll('.th-sort').length,2);
});

test('L5: sort keys read numbers, dates and unknown words the way people write them',()=>{
 const keys=JSON.parse(run('JSON.stringify(["1,234.5","-40 h","12.5%","SAR 2,000","2031-04-15","15 Apr 2031","Not established","\\u2014","Not started","R1"].map(lookCellSortKey))') as string) as any[];
 assert.deepEqual(keys.map(k=>k.kind),['number','number','number','number','date','date','unknown','unknown','text','text']);
 assert.equal(keys[0].value,1234.5);assert.equal(keys[1].value,-40);assert.equal(keys[3].value,2000);
 assert.equal(keys[4].value,keys[5].value,'ISO and written dates sort as the same day');
});

test('L5: grouped tables keep their order instead of breaking groups apart',()=>{
 const t=table(['Group','Value'],[['B','2'],['A','1']]);
 const group=h('tr',null,h('td',{colspan:'2'},'Group heading'));t.tBodies[0]!.childNodes.unshift(group);group.parentNode=t.tBodies[0]!;
 run('lookEnhanceTable(t)',{t});
 assert.equal(run('lookSortTable(t,1,"ascending")',{t}),false);
 assert.deepEqual(t.tBodies[0]!.rows.map(r=>r.textContent),['Group heading','B2','A1']);
});

test('S2: an empty table says why it is empty, using the filters on screen when they cause it',()=>{
 const plain=table(['Document','Type','Read from'],[]);
 run('lookEnhanceTable(t)',{t:plain});
 const row=plain.tBodies[0]!.rows[0]!;
 assert.ok(row.classList.contains('look-empty-row'));assert.equal(row.cells[0]!.colSpan,3);
 assert.match(row.textContent,/No records of this kind are in the current project documents/);

 const filtered=table(['Activity','Float'],[]);
 const select=h('select',{value:'late'},h('option',{value:''},'All activities'),h('option',{value:'late'},'Late'));select.selectedIndex=1;
 h('section',null,select,filtered);
 run('lookEnhanceTable(t)',{t:filtered});
 assert.match(filtered.textContent,/No rows match the selected filters/);

 const stated=table(['Notice','Due'],[]);stated.setAttribute('data-empty-reason','No notices are due before the Data Date.');
 run('lookEnhanceTable(t)',{t:stated});assert.match(stated.textContent,/No notices are due before the Data Date\./);

 // When rows arrive (paging, filters cleared) the reason is removed; an existing message row is not doubled.
 plain.tBodies[0]!.appendChild(h('tr',null,h('td',null,'Spec.pdf'),h('td',null,'Specification'),h('td',null,'Text')));
 run('lookEnhanceTable(t)',{t:plain});assert.equal(plain.querySelectorAll('.look-empty-row').length,0);
 const message=table(['Activity','Float'],[]);message.tBodies[0]!.appendChild(h('tr',null,h('td',{colspan:'2'},'No activities match the selected filters.')));
 run('lookEnhanceTable(t)',{t:message});assert.equal(message.querySelectorAll('.look-empty-row').length,0);
});

test('L5: a filter list with only "All" is switched off and says so; a real choice stays usable',()=>{
 const only=h('select',null,h('option',{value:''},'All owners'));h('label',null,only);
 run('lookCheckFilter(s)',{s:only});
 assert.equal(only.disabled,true);assert.equal(only.nextElementSibling?.textContent,'No other values in this data to filter by.');
 const real=h('select',null,h('option',{value:''},'All owners'),h('option',{value:'pmc'},'PMC'));h('label',null,real);
 run('lookCheckFilter(s)',{s:real});assert.equal(real.disabled,false);
 // When the list later gains a value, the filter is switched back on.
 only.appendChild(h('option',{value:'contractor'},'Contractor'));run('lookCheckFilter(s)',{s:only});
 assert.equal(only.disabled,false);assert.equal(only.nextElementSibling,null);
});

test('S3: a chart whose values are all zero shows the reason and the values, not empty bars',()=>{
 const ctx={fmt:String,escapeHtml:(s:unknown)=>String(s),percent2:(n:number)=>n.toFixed(2)};
 const zero=run('renderVisualBars([{label:"Delayed",value:0},{label:"On time",value:0}],"activities")',ctx) as string;
 assert.doesNotMatch(zero,/visual-bar-row/);assert.match(zero,/Every value in this chart is zero, so no bars are drawn\./);
 assert.match(zero,/Delayed<\/span> <b>0 activities<\/b>/);assert.match(zero,/On time<\/span> <b>0 activities<\/b>/);
 const shown=run('renderVisualBars([{label:"Delayed",value:3},{label:"On time",value:0}],"")',ctx) as string;
 assert.match(shown,/visual-bar-row/,'a chart with a real value is still drawn');
 assert.match(run('renderWaterfallChart([{label:"Move",value:0}],"days")',ctx) as string,/Every value in this chart is zero/);
 assert.match(run('renderCashMovementBars([{label:"Jan",value:0}],"SAR")',ctx) as string,/Every value in this chart is zero/);
 const panel=h('section',{'data-visual-panel':''},h('div',{class:'visual-chart-head'},h('h5',null,'S-curve')),h('div',{class:'visual-chart-body'}));
 run('lookCheckChartPanel(p)',{p:panel});
 assert.match(panel.textContent,/No values are established for this chart in the current project documents, so no chart is drawn\./);
});

const lum=(hex:string)=>{const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4);return .2126*c[0]!+.7152*c[1]!+.0722*c[2]!;};
const ratio=(a:string,b:string)=>{const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};

test('L6: text colour tokens reach WCAG AA 4.5:1 on every light panel colour, and focus is visible',()=>{
 const html=cmengUatHtml();
 const root=html.match(/:root\{([\s\S]*?)\}/)![1]!;
 const token=(n:string)=>root.match(new RegExp('--'+n+':(#[0-9a-f]{6})','i'))![1]!;
 const surfaces=['panel','bg','soft','soft-blue','stone','accent-soft'].map(token);
 for(const text of ['ink','muted','graphite','slate','danger','warn','ok','teal','accent-strong'])
  for(const surface of surfaces)assert.ok(ratio(token(text),surface)>=4.5,'--'+text+' on '+surface+' is '+ratio(token(text),surface).toFixed(2));
 const style=html.match(/<style>([\s\S]*?)<\/style>/)![1]!;
 // The brand accent (#4f7fb4) stays for borders and marks; text in the accent colour uses the stronger shade.
 assert.doesNotMatch(style,/(^|[^-a-z])color:(var\(--accent\)|#4f7fb4)/i,'accent text below 4.5:1 remains');
 for(const grey of ['#7b8795','#718096','#8a96a6','#7a8594','#667085'])
  assert.doesNotMatch(style,new RegExp('(^|[^-a-z])color:'+grey,'i'),'low-contrast grey text '+grey+' remains');
 assert.match(style,/button:focus-visible,a:focus-visible,select:focus-visible/);assert.match(style,/\.th-sort:focus-visible\{outline:2px solid/);
 const script=html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
 assert.match(script,/\nlookStart\(\);\nbootstrapWorkspace\(\)/,'the shared look rules run on every page');
});
