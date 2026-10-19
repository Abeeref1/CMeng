#!/usr/bin/env node
'use strict';
// T10 X1/X2: a download must carry the figures, data date and scope the page
// shows, in reader words. Compares each page response with its report.json and
// report.xlsx. Usage:
//   node scripts/verify-download-parity.cjs --base http://host:port --project ID
//   node scripts/verify-download-parity.cjs --fixture      (starts a local server
//     on a synthetic 8,900-activity project built from deterministic records)
// Exit code 1 when any mismatch is found. compareDownload() is also used by tests.
const {join}=require('node:path');

const SKIP_KEYS=new Set(['responsePaging','sourceLabels']);
const CODE_WORDS=/\b(?:fallback|deterministic|payload|stub|pointer|session id)\b/i;

function pointerGet(root,pointer){
  let value=root;
  for(const raw of pointer.split('/').slice(1)){
    const part=raw.replace(/~1/g,'/').replace(/~0/g,'~');
    if(value===null||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,part))return undefined;
    value=value[part];
  }
  return value;
}
const token=v=>String(v).replace(/~/g,'~0').replace(/\//g,'~1');

/** Every scalar on the screen equals the download at the same place; every
 * paged table has its complete population in the download. */
function compareScreenWithJson(screen,reportJson){
  const problems=[];
  const result=reportJson&&reportJson.result;
  if(!result||typeof result!=='object')return [{rule:'X2',pointer:'',problem:'download has no result'}];
  const paged=new Map((screen&&screen.responsePaging&&screen.responsePaging.tables||[]).map(t=>[t.pointer,t]));
  const walk=(value,pointer)=>{
    const page=paged.get(pointer);
    if(Array.isArray(value)){
      const other=pointerGet(result,pointer);
      if(!Array.isArray(other)){problems.push({rule:'X2',pointer,problem:'table missing from download'});return;}
      const total=page&&page.kind==='array'?page.total:value.length;
      if(other.length!==total)problems.push({rule:'X2',pointer,problem:'screen total '+total+', download rows '+other.length});
      if(page&&page.kind==='array')return; // the preview order may differ; the population is compared above
      value.forEach((item,i)=>walk(item,pointer+'/'+i));
      return;
    }
    if(value&&typeof value==='object'){
      if(value.detailAvailable===true&&Object.keys(value).length===1)return;
      for(const [key,child] of Object.entries(value)){
        if(pointer===''&&SKIP_KEYS.has(key))continue;
        if(key==='sourceLabels')continue;
        walk(child,pointer+'/'+token(key));
      }
      return;
    }
    if(page&&page.kind==='text')return;
    const other=pointerGet(result,pointer);
    if(other===undefined){problems.push({rule:'X2',pointer,problem:'figure missing from download',screen:value});return;}
    if(other!==value)problems.push({rule:'X2',pointer,problem:'different value',screen:value,download:other});
  };
  walk(screen,'');
  return problems;
}

/** Headline figures (numbers outside tables), data date and scope in the
 * workbook summary, all in reader words. */
function compareScreenWithWorkbook(screen,summaryRows,sheetHeaders,labelOf){
  const problems=[];
  const byLabel=new Map();
  for(const [label,value] of summaryRows){
    if(typeof label!=='string'||!label)continue;
    const list=byLabel.get(label)??[];list.push(value);byLabel.set(label,list);
  }
  const data=screen&&screen.data&&typeof screen.data==='object'?screen.data:{};
  const dataDate=(data.reportingContract&&data.reportingContract.dataDateIso)??data.dataDateIso??null;
  const dateRow=byLabel.get('Data date');
  if(!dateRow)problems.push({rule:'X2',pointer:'/data/dataDateIso',problem:'workbook has no data date row'});
  else if(dataDate&&!dateRow.some(v=>String(v??'').slice(0,10)===String(dataDate).slice(0,10)))problems.push({rule:'X2',pointer:'/data/dataDateIso',problem:'data date differs',screen:dataDate,download:dateRow});
  if(!byLabel.get('Project'))problems.push({rule:'X2',pointer:'/projectId',problem:'workbook has no project scope row'});
  const walk=(value,path)=>{
    if(Array.isArray(value))return;
    if(value&&typeof value==='object'){
      for(const [key,child] of Object.entries(value)){
        if(key==='sourceLabels'||key==='responsePaging')continue;
        walk(child,path?path+'.'+key:key);
      }
      return;
    }
    if(typeof value!=='number')return;
    const label=labelOf(path),values=byLabel.get(label);
    if(!values)problems.push({rule:'X2',pointer:path,problem:'headline figure missing from workbook',screen:value});
    else if(!values.some(v=>v===value))problems.push({rule:'X2',pointer:path,problem:'workbook value differs',screen:value,download:values.slice(0,3)});
  };
  walk(data,'');
  for(const label of [...byLabel.keys(),...sheetHeaders]){
    if(typeof label!=='string')continue;
    if(!/\s/.test(label)&&labelOf(label)!==label)problems.push({rule:'X1',pointer:label,problem:'field name used as a label (W1)'});
    if(CODE_WORDS.test(label))problems.push({rule:'X1',pointer:label,problem:'internal code word (W2)'});
    if(/\b(\w+)\s+\1\b/i.test(label))problems.push({rule:'X1',pointer:label,problem:'doubled word (W4)'});
  }
  return problems;
}

/** X3: a chart drawn from buckets must account for the population of the
 * table it summarises. Checked shapes (all produced in shared code):
 * - histogram groups {count,lowerHours} sum to knownCount;
 * - value distributions: knownCount + unknownCount = totalCount, groups never
 *   exceed knownCount, and totalCount equals the sibling population denominator;
 * - screening buckets (floatDistribution [{count}]) plus distributionUnresolvedCount
 *   equal populationCount. */
function checkChartTables(body){
  const problems=[];
  const walk=(v,pointer,parent)=>{
    if(Array.isArray(v)){v.forEach((x,i)=>walk(x,pointer+'/'+i,null));return;}
    if(!v||typeof v!=='object')return;
    const groups=Array.isArray(v.groups)?v.groups.filter(g=>g&&typeof g==='object'&&typeof g.count==='number'):null;
    if(groups&&typeof v.knownCount==='number'){
      const sum=groups.reduce((a,g)=>a+g.count,0);
      if(groups.some(g=>'lowerHours' in g)){if(sum!==v.knownCount)problems.push({rule:'X3',pointer,problem:'histogram bars total '+sum+', table known count '+v.knownCount});}
      else if(sum>v.knownCount)problems.push({rule:'X3',pointer,problem:'distribution groups total '+sum+' above known count '+v.knownCount});
      if(typeof v.unknownCount==='number'&&typeof v.totalCount==='number'&&v.knownCount+v.unknownCount!==v.totalCount)problems.push({rule:'X3',pointer,problem:'known '+v.knownCount+' + unknown '+v.unknownCount+' is not total '+v.totalCount});
      if(parent&&typeof v.totalCount==='number'&&typeof parent.denominator==='number'&&parent.denominator!==v.totalCount)problems.push({rule:'X3',pointer,problem:'chart total '+v.totalCount+', table population '+parent.denominator});
    }
    if(Array.isArray(v.floatDistribution)&&typeof v.populationCount==='number'){
      const sum=v.floatDistribution.reduce((a,g)=>a+(typeof g?.count==='number'?g.count:0),0),unresolved=typeof v.distributionUnresolvedCount==='number'?v.distributionUnresolvedCount:0;
      if(sum+unresolved!==v.populationCount)problems.push({rule:'X3',pointer:pointer+'/floatDistribution',problem:'chart buckets '+sum+' + unresolved '+unresolved+', table population '+v.populationCount});
    }
    for(const [k,x] of Object.entries(v))walk(x,pointer+'/'+token(k),v);
  };
  walk(body,'',null);
  return problems;
}

async function workbookParts(bytes){
  const ExcelJS=require('exceljs');
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);
  const summary=book.getWorksheet('Report'),summaryRows=[],headers=new Set();
  if(summary)summary.eachRow(row=>{summaryRows.push([row.getCell(1).value,row.getCell(2).value]);});
  for(const sheet of book.worksheets){
    if(sheet===summary)continue;
    const first=sheet.getRow(1).values;
    if(Array.isArray(first))for(const v of first)if(typeof v==='string')headers.add(v);
  }
  return {summaryRows,headers:[...headers]};
}

async function verifyProject(base,projectId,repo){
  const {readablePathLabel}=require(join(repo,'dist/packages/runtime-api/src/field-labels'));
  const get=async p=>{const r=await fetch(base+p,{signal:AbortSignal.timeout(300000)});return {status:r.status,bytes:Buffer.from(await r.arrayBuffer())};};
  const keysOf=x=>(Array.isArray(x)?x:(x.modules??x.data??[])).map(m=>m.key??m.moduleKey).filter(Boolean);
  const sched=keysOf(JSON.parse((await get('/api/schedule/modules')).bytes)),comm=keysOf(JSON.parse((await get('/api/commercial/modules')).bytes));
  const P='/api/projects/'+encodeURIComponent(projectId);
  const deliv=keysOf(JSON.parse((await get('/api/delivery/modules')).bytes));
  const pages=[...sched.map(k=>P+'/schedule/modules/'+k),...comm.map(k=>P+'/commercial/modules/'+k),...deliv.map(k=>P+'/delivery/modules/'+k)];
  const surfaces=JSON.stringify(JSON.parse((await get(P+'/management-surfaces')).bytes)).match(/"key":"[a-z0-9-]+"/g)??[];
  for(const k of new Set(surfaces.map(s=>s.slice(7,-1))))pages.push(P+'/management/'+k);
  const report=[];
  for(const page of pages){
    const screen=await get(page);if(screen.status!==200)continue;
    const body=JSON.parse(screen.bytes);
    const json=await get(page+'/report.json'),xlsx=await get(page+'/report.xlsx');
    const problems=[];
    if(json.status!==200)problems.push({rule:'X2',pointer:'',problem:'report.json status '+json.status});
    else problems.push(...compareScreenWithJson(body,JSON.parse(json.bytes)));
    problems.push(...checkChartTables(body));
    if(xlsx.status===200){const parts=await workbookParts(xlsx.bytes);problems.push(...compareScreenWithWorkbook(body,parts.summaryRows,parts.headers,readablePathLabel));}
    else if(xlsx.status!==409)problems.push({rule:'X2',pointer:'',problem:'report.xlsx status '+xlsx.status});
    report.push({page,problems});
  }
  return report;
}

function fixtureProject(repo){
  const {runtimeProjects}=require(join(repo,'dist/packages/runtime-api/src/project-state'));
  const {ELAPSED_24H_CALENDAR}=require(join(repo,'dist/packages/schedule-cpm/src/calendar'));
  const id='DOWNLOAD-PARITY-1',state=runtimeProjects.getOrCreate(id),count=8900;
  const activities=Array.from({length:count},(_,i)=>({projectId:id,activityId:'DP-'+i,nativeId:String(i),
    name:'Installation '+(i%5===0?'Mechanical':i%3===0?'Electrical':'Civil')+' Zone '+Math.floor(i/100),wbsId:'W'+Math.floor(i/100),calendarId:'C'+i%4,
    activityType:'task',status:'not_started',baselineStartIso:'2031-01-01',baselineFinishIso:'2031-02-01',currentStartIso:'2031-01-01',currentFinishIso:'2031-03-01',
    actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:24,remainingDurationHours:24,
    totalFloatHours:i%17===0?-8:i%13,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}));
  const relationships=[];
  for(let i=1;i<count;i++)if(i%100!==0)relationships.push({relationshipId:'R'+i,predecessorActivityId:activities[i-1].activityId,successorActivityId:activities[i].activityId,type:'FS',lagHours:0,sourceRefs:[],diagnostics:[]});
  const wbs=Array.from({length:count/100},(_,i)=>({wbsId:'W'+i,name:'Area '+i,parentWbsId:null,sourceRefs:[]}));
  const calendars=Array.from({length:4},(_,i)=>({...ELAPSED_24H_CALENDAR,calendarId:'C'+i}));
  for(let revision=0;revision<3;revision++){
    const revisionId='DP-REV-'+revision,model={projectId:id,source:'xer',sourceRevisionId:revisionId,dataDateIso:'2031-04-0'+(revision+1),
      activities:activities.map(row=>({...row,currentFinishIso:'2031-03-0'+(revision+1)})),relationships,wbs,calendars,diagnostics:[]};
    state.schedules.push({role:revision?'update':'baseline',format:'xer',sourceFilename:revisionId+'.xer',sourceHashSha256:revisionId,uploadedAt:model.dataDateIso,
      revision:{revisionId,label:revisionId,sequence:revision+1,effectiveAt:model.dataDateIso,model}});
  }
  state.testProject=true;runtimeProjects.touch(state);return id;
}

async function main(){
  const args=process.argv.slice(2),arg=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};
  const repo=arg('--repo')??process.cwd();
  if(arg('--x3')){
    // X3 over saved page responses (for example a parity snapshot directory).
    const fs=require('node:fs'),dir=arg('--x3');let pages=0,charts=0;
    for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json')&&!n.startsWith('_summary'))){
      const problems=checkChartTables(JSON.parse(fs.readFileSync(join(dir,name),'utf8')));pages++;
      if(problems.length){charts+=problems.length;console.log(name+': '+problems.length+' chart mismatch(es)');for(const p of problems.slice(0,8))console.log('  [X3] '+p.pointer+' : '+p.problem);}
    }
    console.log('chart parity: '+pages+' responses, '+charts+' mismatch(es)');if(charts)process.exitCode=1;return;
  }
  let base=arg('--base'),projectId=arg('--project'),child=null,root=null;
  if(args.includes('--fixture')){
    const {mkdtempSync}=require('node:fs'),{tmpdir}=require('node:os'),{spawn}=require('node:child_process');
    root=mkdtempSync(join(tmpdir(),'cmeng-download-parity-'));
    process.env.CMENG_DATA_DIR=root;process.env.CMENG_OCR_ENABLED='0';delete process.env.CMENG_TEST_MODE;
    projectId=fixtureProject(repo);
    const port=29000+Math.floor(Math.random()*9000);
    child=spawn(process.execPath,[join(repo,'dist/packages/runtime-api/src/project-gateway.js')],{cwd:repo,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{let log='';const t=setTimeout(()=>reject(new Error('server start timeout')),180000);
      child.stdout.on('data',c=>{log+=c;if(log.includes('CMeng runtime listening')){clearTimeout(t);resolve();}});child.on('exit',code=>{clearTimeout(t);reject(new Error('server exit '+code));});});
    base='http://127.0.0.1:'+port;
  }
  if(!base||!projectId)throw new Error('use --base URL --project ID, or --fixture');
  try{
    const report=await verifyProject(base,projectId,repo);
    let total=0;
    for(const {page,problems} of report){
      if(!problems.length)continue;total+=problems.length;
      console.log(page+': '+problems.length+' mismatch(es)');
      for(const p of problems.slice(0,12))console.log('  ['+p.rule+'] '+p.pointer+' : '+p.problem+(p.screen!==undefined?' screen='+JSON.stringify(p.screen):'')+(p.download!==undefined?' download='+JSON.stringify(p.download).slice(0,120):''));
    }
    const classes=new Map();
    for(const {page,problems} of report)for(const p of problems){const k=p.rule+' '+p.problem.replace(/\d+/g,'N');const c=classes.get(k)??{count:0,pages:new Set(),example:page+' '+p.pointer};c.count++;c.pages.add(page);classes.set(k,c);}
    for(const [k,c] of [...classes].sort((a,b)=>b[1].count-a[1].count))console.log('class '+c.count+' on '+c.pages.size+' page(s): '+k+'  e.g. '+c.example);
    const out=arg('--out');if(out)require('node:fs').writeFileSync(out,JSON.stringify(report,null,1));
    console.log('download parity: '+report.length+' pages, '+total+' mismatch(es)');
    if(total)process.exitCode=1;
  }finally{
    if(child&&child.exitCode===null)child.kill();
    if(root)require('node:fs').rmSync(root,{recursive:true,force:true});
  }
}
module.exports={compareScreenWithJson,compareScreenWithWorkbook,checkChartTables,workbookParts,pointerGet};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
