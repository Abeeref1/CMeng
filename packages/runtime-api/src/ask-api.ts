import {randomUUID} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {auditContext} from './audit-context';
import {ProjectAskEngine,askCatalogue,compactAskResult} from './ask-engine';
import {AskError} from '../../project-ask/src/catalogue';
import type {AskRequest,AskSession,SavedView} from '../../project-ask/src/types';
import {readAskReference} from './ask-references';
import {exportAskAnalysis,askChartPng} from './ask-export';
import {sendHttpBody} from './http-response';
import {runtimeProjects} from './project-state';
import {configuredAskModel} from '../../project-ask/src/provider';
async function body(req:IncomingMessage,limit:number){const chunks:Buffer[]=[];let size=0;for await(const c of req){size+=c.length;if(size>limit)throw new AskError(413,'request_too_large','This request is too large.');chunks.push(Buffer.from(c));}return Buffer.concat(chunks);}
async function jsonBody(req:IncomingMessage){try{return JSON.parse((await body(req,128*1024)).toString('utf8'));}catch(e){if(e instanceof AskError)throw e;throw new AskError(400,'invalid_request','The request could not be read.');}}
function json(res:ServerResponse,status:number,value:unknown){sendHttpBody(res,status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'},JSON.stringify(value));}
function session(req:IncomingMessage):AskSession {const actor=auditContext().actor;return {userId:actor.id,workspaceId:'cmeng-projects',name:null,title:null,company:null,allowModel:req.headers['x-cmeng-paid-ai']!=='0'};}
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
    const chartMatch=/^results\/([a-zA-Z0-9_-]+)\/charts\/(.+)$/.exec(path);
    if(req.method==='GET'&&chartMatch){const result=await engine.store.result(chartMatch[1]!,projectId,user),chart=result.sections.flatMap(s=>s.charts).find(c=>c.id===decodeURIComponent(chartMatch[2]!)),table=chart?result.sections.flatMap(s=>s.tables).find(t=>t.id===chart.tableId):null;if(!chart||!table)throw new AskError(404,'chart_not_found','This chart is not available.');sendHttpBody(res,200,{'content-type':'image/png','cache-control':'no-store'},askChartPng(chart,table));return true;}
    const resultMatch=/^results\/([a-zA-Z0-9_-]+)(?:\/(export))?$/.exec(path);
    if(req.method==='GET'&&resultMatch){
      const result=await engine.store.result(resultMatch[1]!,projectId,user);
      if(resultMatch[2]){const output=await exportAskAnalysis(result,url.searchParams.get('format')??'xlsx');sendHttpBody(res,200,{'content-type':output.type,'cache-control':'no-store','content-disposition':'attachment; filename="'+output.filename+'"'},output.bytes);}
      else json(res,200,compactAskResult(result));return true;
    }
    if(req.method==='POST'&&path==='views'){
      const input=await jsonBody(req);if(typeof input.name!=='string'||!input.name.trim()||input.name.length>120)throw new AskError(400,'view_name_required','Enter a view name of up to 120 characters.');
      const result=await engine.store.result(String(input.analysisId??''),projectId,user),now=new Date().toISOString();
      const view:SavedView={schemaVersion:1,id:randomUUID(),projectId,workspaceId:user.workspaceId,ownerId:user.userId,name:input.name.trim(),visibility:input.visibility==='project'?'project':'personal',plan:result.plan,presentation:result.presentation,createdAt:now,updatedAt:now};
      await engine.store.saveView(view,user);json(res,201,view);return true;
    }
    const viewMatch=/^views\/([a-zA-Z0-9_-]+)\/open$/.exec(path);
    if(req.method==='POST'&&viewMatch){const view=await engine.store.view(viewMatch[1]!,projectId,user);json(res,200,compactAskResult(await engine.ask(projectId,user,{question:view.plan.objective},view)));return true;}
    throw new AskError(404,'ask_action_not_found','This Ask CMeng action is not available.');
  }catch(error){const e=error instanceof AskError?error:null;json(res,e?.status??500,{error:e?.code??'analysis_unavailable',message:e?.message??'This analysis could not be prepared. Project records have not been changed.'});}
  return true;
}
