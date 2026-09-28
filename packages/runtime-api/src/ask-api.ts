import {randomUUID} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {auditContext} from './audit-context';
import {ProjectAskEngine,askCatalogue,compactAskResult} from './ask-engine';
import {AskError} from '../../project-ask/src/catalogue';
import type {AskRequest,AskSession,SavedView,AnalysisResult} from '../../project-ask/src/types';
import {readAskReference} from './ask-references';
import {askHash} from './ask-store';
import {exportAskAnalysis,askChartPng,type AskExportView} from './ask-export';
import {sendHttpBody} from './http-response';
import {runtimeProjects} from './project-state';
import {configuredAskModel} from '../../project-ask/src/provider';
async function body(req:IncomingMessage,limit:number){const chunks:Buffer[]=[];let size=0;for await(const c of req){size+=c.length;if(size>limit)throw new AskError(413,'request_too_large','This request is too large.');chunks.push(Buffer.from(c));}return Buffer.concat(chunks);}
async function jsonBody(req:IncomingMessage){try{return JSON.parse((await body(req,128*1024)).toString('utf8'));}catch(e){if(e instanceof AskError)throw e;throw new AskError(400,'invalid_request','The request could not be read.');}}
function json(res:ServerResponse,status:number,value:unknown){sendHttpBody(res,status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},JSON.stringify(value));}
function session(req:IncomingMessage):AskSession {const actor=auditContext().actor;return {userId:actor.id,workspaceId:'cmeng-projects',name:null,title:null,company:null,allowModel:req.headers['x-cmeng-paid-ai']!=='0'};}
function savedViewDefinition(input:any){
  const page=input?.pageContext&&typeof input.pageContext==='object'&&!Array.isArray(input.pageContext)?input.pageContext:null;
  const filters:Record<string,string>={};if(page?.filters&&typeof page.filters==='object'&&!Array.isArray(page.filters))for(const [key,value] of Object.entries(page.filters))if(typeof value==='string'&&value.length<=500)filters[String(key).slice(0,100)]=value;
  const pageContext=page?{projectId:String(page.projectId??'').slice(0,160),page:typeof page.page==='string'?page.page.slice(0,160):null,filters,
    selectedActivity:typeof page.selectedActivity==='string'?page.selectedActivity.slice(0,200):null,selectedWbs:typeof page.selectedWbs==='string'?page.selectedWbs.slice(0,200):null,
    selectedLocation:typeof page.selectedLocation==='string'?page.selectedLocation.slice(0,200):null,selectedPackage:typeof page.selectedPackage==='string'?page.selectedPackage.slice(0,200):null}:null;
  const rv=input?.reportView&&typeof input.reportView==='object'&&!Array.isArray(input.reportView)?input.reportView:null;
  const strings=(value:any)=>Array.isArray(value)?value.filter(x=>typeof x==='string').slice(0,200).map(x=>x.slice(0,200)):[];
  const chartTypes:Record<string,string>={},chartLimits:Record<string,number>={};
  if(rv?.chartTypes&&typeof rv.chartTypes==='object')for(const [key,value] of Object.entries(rv.chartTypes))if(typeof value==='string'&&['bar','line'].includes(value))chartTypes[key]=value;
  if(rv?.chartLimits&&typeof rv.chartLimits==='object')for(const [key,value] of Object.entries(rv.chartLimits))if(typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=5000)chartLimits[key]=value;
  const reportView=rv?{title:String(rv.title??'').slice(0,240),subtitle:typeof rv.subtitle==='string'?rv.subtitle.slice(0,500):null,includeAuthorities:strings(rv.includeAuthorities),sectionOrder:strings(rv.sectionOrder),includeCharts:strings(rv.includeCharts),includeTables:strings(rv.includeTables),includeMetrics:strings(rv.includeMetrics),chartTypes,chartLimits,layout:typeof rv.layout==='string'?rv.layout.slice(0,80):null,detailLevel:typeof rv.detailLevel==='string'?rv.detailLevel.slice(0,80):null}:null;
  const sort=input?.sort&&typeof input.sort==='object'&&typeof input.sort.field==='string'&&['asc','desc'].includes(input.sort.direction)?{field:input.sort.field.slice(0,160),direction:input.sort.direction as 'asc'|'desc'}:null;
  const dateRange=input?.dateRange&&typeof input.dateRange==='object'?{from:typeof input.dateRange.from==='string'?input.dateRange.from.slice(0,40):null,to:typeof input.dateRange.to==='string'?input.dateRange.to.slice(0,40):null}:null;
  return {pageContext,selectedRole:typeof input?.selectedRole==='string'?input.selectedRole.slice(0,100):null,dateRange,grouping:strings(input?.grouping),sort,topN:Number.isSafeInteger(input?.topN)&&input.topN>0&&input.topN<=5000?input.topN:null,metrics:strings(input?.metrics),tables:strings(input?.tables),layout:typeof input?.layout==='string'?input.layout.slice(0,80):null,subtitle:typeof input?.subtitle==='string'?input.subtitle.slice(0,500):null,detailLevel:typeof input?.detailLevel==='string'?input.detailLevel.slice(0,80):null,reportView};
}
function reportView(url:URL):AskExportView|undefined{
  const encoded=url.searchParams.get('view');if(!encoded)return undefined;if(encoded.length>16000)throw new AskError(400,'report_view_too_large','The report adjustment is too large.');
  try{const value=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value as AskExportView;}
  catch{throw new AskError(400,'report_view_invalid','The report preview settings could not be read.');}
}
export async function askAiRequest(req:IncomingMessage,res:ServerResponse,url:URL){
  const match=/^\/api\/projects\/([^/]+)\/intelligence(?:\/(.*))?$/.exec(url.pathname);if(!match)return false;
  try{
    const projectId=decodeURIComponent(match[1]!),path=match[2]??'',user=session(req),model=user.allowModel?configuredAskModel():null,engine=new ProjectAskEngine(undefined,model);
    if(!runtimeProjects.get(projectId))throw new AskError(404,'project_not_found','Open an existing project first.');
    if(req.method==='GET'&&path==='home'){
      const {scope}=engine.scope(projectId,user,{question:'Project overview'}),authorities=askCatalogue.available(user);
      const state=runtimeProjects.get(projectId)!;const suggestions=[...(scope.programmeRevision?['What changed since the previous update?','Show the worst 20 float-risk activities','Why is progress behind?']:[]),...(state.boq?['Show Top 20 BOQ cost drivers']:[]),...(state.delivery?.decisions.length?['Build procurement dashboard','Show materials needed in the next 60 days with delivery under 90%']:[]),'Prepare a Construction Intelligence Package'];
      json(res,200,{scope,authorities,suggestions,views:await engine.store.views(projectId,user),providerConfigured:model!==null});return true;
    }
    if(req.method==='POST'&&path==='ask'){
      const input=await jsonBody(req);if(input.profile&&typeof input.profile==='object')for(const key of ['name','title','company'] as const)if(typeof input.profile[key]==='string')user[key]=input.profile[key].slice(0,160);
      json(res,200,compactAskResult(await engine.ask(projectId,user,input as AskRequest)));return true;
    }
    if(req.method==='POST'&&path==='references'){
      const filename=String(req.headers['x-source-filename']??url.searchParams.get('filename')??'');
      const reference=await readAskReference(projectId,user,filename,await body(req,20*1024*1024));await engine.store.saveReference(reference,user);
      const {pages,...summary}=reference;json(res,201,{...summary,pages:pages.length});return true;
    }
    const sectionRefreshMatch=/^results\/([a-zA-Z0-9_-]+)\/sections\/([^/]+)\/refresh$/.exec(path);
    if(req.method==='POST'&&sectionRefreshMatch){
      const base=await engine.store.result(sectionRefreshMatch[1]!,projectId,user),authorityId=decodeURIComponent(sectionRefreshMatch[2]!);
      const current=runtimeProjects.get(projectId)!;
      if(current.version!==base.scope.projectVersion)throw new AskError(409,'project_changed','The Project has changed. Refresh the full analysis so every section uses one reporting basis.');
      if(!base.sections.some(section=>section.authorityId===authorityId))throw new AskError(404,'section_not_found','This report section is not available.');
      const createdAt=new Date().toISOString(),view:SavedView={schemaVersion:1,id:randomUUID(),projectId,workspaceId:user.workspaceId,ownerId:user.userId,name:'Refresh '+authorityId,visibility:'personal',
        plan:{...structuredClone(base.plan),authorities:[authorityId],rankings:(base.plan.rankings??[]).filter(r=>r.authorityId===authorityId),
          authorityFilters:base.plan.authorityFilters?.[authorityId]?{[authorityId]:structuredClone(base.plan.authorityFilters[authorityId]!)}:{},
          ...(authorityId==='activities'&&base.plan.activityBreakouts?{activityBreakouts:structuredClone(base.plan.activityBreakouts)}:{})},
        presentation:structuredClone(base.presentation),savedFromDataDate:base.scope.dataDate,savedFromProjectVersion:base.scope.projectVersion,createdAt,updatedAt:createdAt};
      const one=await engine.ask(projectId,user,{question:base.plan.objective},view),replacement=one.sections.find(section=>section.authorityId===authorityId);
      if(!replacement)throw new AskError(409,'section_unavailable','CMeng could not refresh this section from the current Project information.');
      const merged:AnalysisResult={...structuredClone(base),id:randomUUID(),createdAt,sections:base.sections.map(section=>section.authorityId===authorityId?replacement:section),
        unresolved:[...new Set([...base.unresolved.filter(item=>!item.startsWith(base.sections.find(s=>s.authorityId===authorityId)?.title+':')),...one.unresolved])],
        improvementNeeds:[...new Set([...(base.improvementNeeds??[]),...(one.improvementNeeds??[])])],
        providerStatus:one.providerStatus,mode:one.mode,...(base.route?{route:base.route}:{})};
      merged.factsHash=askHash(merged.sections);merged.snapshotHash=askHash({scope:merged.scope,plan:merged.plan,sections:merged.sections});
      await engine.store.saveResult(merged,user);json(res,200,compactAskResult(merged));return true;
    }
    const chartMatch=/^results\/([a-zA-Z0-9_-]+)\/charts\/(.+)$/.exec(path);
    const tableMatch=/^results\/([a-zA-Z0-9_-]+)\/tables\/([^/]+)$/.exec(path);
    if(req.method==='GET'&&tableMatch){
      const result=await engine.store.result(tableMatch[1]!,projectId,user),table=result.sections.flatMap(s=>s.tables).find(t=>t.id===decodeURIComponent(tableMatch[2]!));
      if(!table)throw new AskError(404,'table_not_found','This activity list is not available.');
      const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??200);
      if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>200)throw new AskError(400,'invalid_page','Choose a valid page of up to 200 rows.');
      json(res,200,{id:table.id,analysisId:result.id,offset,rows:table.rows.slice(offset,offset+limit),totalRows:table.rows.length});return true;
    }
    if(req.method==='GET'&&chartMatch){
      const result=await engine.store.result(chartMatch[1]!,projectId,user),chart=result.sections.flatMap(s=>s.charts).find(c=>c.id===decodeURIComponent(chartMatch[2]!)),table=chart?result.sections.flatMap(s=>s.tables).find(t=>t.id===chart.tableId):null;if(!chart||!table)throw new AskError(404,'chart_not_found','This chart is not available.');
      const type=url.searchParams.get('type'),limitRaw=Number(url.searchParams.get('limit')??table.rows.length),limit=Number.isSafeInteger(limitRaw)&&limitRaw>0&&limitRaw<=5000?limitRaw:table.rows.length;
      if(type&&type!=='bar'&&type!=='line')throw new AskError(400,'chart_type_invalid','Choose a supported chart type.');
      sendHttpBody(res,200,{'content-type':'image/png','cache-control':'no-store'},askChartPng(chart,table,{...(type?{type:type as 'bar'|'line'}:{}),limit}));return true;
    }
    const resultMatch=/^results\/([a-zA-Z0-9_-]+)(?:\/(export))?$/.exec(path);
    if(req.method==='GET'&&resultMatch){
      const result=await engine.store.result(resultMatch[1]!,projectId,user);
      if(resultMatch[2]){const output=await exportAskAnalysis(result,url.searchParams.get('format')??'xlsx',reportView(url));sendHttpBody(res,200,{'content-type':output.type,'cache-control':'no-store','content-disposition':'attachment; filename="'+output.filename+'"'},output.bytes);}
      else json(res,200,compactAskResult(result));return true;
    }
    if(req.method==='POST'&&path==='views'){
      const input=await jsonBody(req);if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw new AskError(400,'view_name_required','Enter a view name of up to 120 characters.');
      const result=await engine.store.result(String(input.analysisId??''),projectId,user),now=new Date().toISOString();
      const view:SavedView={schemaVersion:1,id:randomUUID(),projectId,workspaceId:user.workspaceId,ownerId:user.userId,name:input.name.trim(),visibility:input.visibility==='project'?'project':'personal',plan:result.plan,presentation:result.presentation,
        viewDefinition:savedViewDefinition(input.viewDefinition),savedFromDataDate:result.scope.dataDate,savedFromProjectVersion:result.scope.projectVersion,createdAt:now,updatedAt:now};
      await engine.store.saveView(view,user);json(res,201,view);return true;
    }
    const viewMatch=/^views\/([a-zA-Z0-9_-]+)\/open$/.exec(path);
    if(req.method==='POST'&&viewMatch){
      const view=await engine.store.view(viewMatch[1]!,projectId,user),savedPageContext=view.viewDefinition?.pageContext??null;
      const refreshed=await engine.ask(projectId,user,{question:view.plan.objective,...(savedPageContext?{pageContext:savedPageContext}:{})},view),current=compactAskResult(refreshed);
      json(res,200,{...current,savedViewDefinition:view.viewDefinition??null,liveViewRefresh:{viewId:view.id,name:view.name,savedFromDataDate:view.savedFromDataDate??null,savedFromProjectVersion:view.savedFromProjectVersion??null,
        currentDataDate:refreshed.scope.dataDate,currentProjectVersion:refreshed.scope.projectVersion,
        refreshed:(view.savedFromProjectVersion??null)!==refreshed.scope.projectVersion||(view.savedFromDataDate??null)!==refreshed.scope.dataDate}});
      return true;
    }
    throw new AskError(404,'ask_action_not_found','This Ask CMeng action is not available.');
  }catch(error){const e=error instanceof AskError?error:null;json(res,e?.status??500,{error:e?.code??'analysis_unavailable',message:e?.message??'This analysis could not be prepared. Project records have not been changed.'});}
  return true;
}
