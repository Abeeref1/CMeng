import type {AuthorityResult,Column,EvidenceState,ProjectScope,Cell} from '../../project-ask/src/types';
import {cell,columnsFor,label} from '../../project-ask/src/primitives';
export const at=(v:any,path:string):any=>path.split('.').reduce((a,k)=>a?.[k],v);
export const evidenceState=(s:unknown):EvidenceState=>['established','available','ready','verified','governed','source','official','calculated','complete'].includes(String(s))?'established':['candidate','working','extracted_candidate'].includes(String(s))?'candidate':['conflicting','conflicted'].includes(String(s))?'conflicting':s==='stale'?'stale':s==='scenario'?'scenario':['missing','blocked','unavailable','not_established'].includes(String(s))?'unavailable':'partial';
export class AuthorityBuilder {
  result:AuthorityResult;
  constructor(readonly id:string,readonly title:string,readonly module:string,readonly scope:ProjectScope,state:EvidenceState,explanation:string){this.result={authorityId:id,title,state,explanation,metrics:[],tables:[],charts:[],findings:[],traces:[]};}
  trace(path:string,basis:string,sourceRefs:unknown[]=[],state=this.result.state){
    const id=this.id+':'+path;
    if(!this.result.traces.some(t=>t.id===id))this.result.traces.push({id,authorityId:this.id,projectId:this.scope.projectId,module:this.module,path,sourceRefs:sourceRefs.map(r=>typeof r==='string'?r:JSON.stringify(r)),dataDate:this.scope.dataDate,basis,exclusions:[],state});return id;
  }
  metric(id:string,name:string,value:unknown,unit:string|null,basis:string,options:{path?:string;state?:unknown;refs?:unknown[];fact?:boolean}={}){
    const v=cell(value),state=v===null?'unavailable':options.state?evidenceState(options.state):this.result.state;
    this.result.metrics.push({id:this.id+'.'+id,label:name,value:v,unit,state,classification:options.fact?'project_fact':'calculated_intelligence',traceId:this.trace(options.path??id,basis,options.refs??[],state),basis});return this;
  }
  table(id:string,title:string,source:unknown,basis:string,overrides:Record<string,Partial<Column>>={},mapper?:(row:any)=>Record<string,unknown>){
    const input=Array.isArray(source)?source:[];
    const rows=input.filter(r=>r&&typeof r==='object').map(raw=>{const r=mapper?mapper(raw):raw;return Object.fromEntries(Object.entries(r).filter(([k,v])=>!['projectId','fields','sourceRefs','receipts','links','diagnostics','history','evidence','trace'].includes(k)&&(v===null||['string','number','boolean'].includes(typeof v))).map(([k,v])=>[k,cell(v)]));});
    const columns=columnsFor(rows,overrides);this.result.tables.push({id:this.id+'.'+id,title,authorityId:this.id,columns,rows,population:rows.length,excluded:0,state:this.result.state,basis,traceId:this.trace(id,basis,input.flatMap(r=>r?.sourceRefs??[]).slice(0,200))});return this;
  }
  finding(id:string,title:string,explanation:string,action:string,values:Record<string,Cell>={},refs:string[]=[]){
    this.result.findings.push({id:this.id+':'+id,severity:'review',title,explanation,values,traceIds:refs.length?refs:[this.trace(id,explanation)],action,owner:null,dueBasis:null});return this;
  }
}
