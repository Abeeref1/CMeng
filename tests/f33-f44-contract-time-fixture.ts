import {createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeProjects} from '../packages/runtime-api/src/project-state';
import {evidenceFamily} from '../packages/runtime-api/src/evidence-control';
import {ELAPSED_24H_CALENDAR} from '../packages/schedule-cpm/src/calendar';
import type {CanonicalScheduleModel} from '../packages/schedule-analysis-core/src';

// F33 / F44 shared fixture: a contract (completion 08 Sep 2027, delay damages
// USD 10,000 per day), a dated determination of 13 days EOT (extended date
// 21 Sep 2027), a claims register with pending claims, and a publishable
// programme on a continuous calendar whose CPM finish is 06 Oct 2027.
export const CONTRACT_COMPLETION='2027-09-08';
export const EXTENDED_COMPLETION='2027-09-21';
export const PROGRAMME_FINISH='2027-10-06';

export function contractTimeModel(projectId:string):CanonicalScheduleModel{
  const calendar={...ELAPSED_24H_CALENDAR,calendarId:'C24',name:'Continuous working'};
  const act=(activityId:string,name:string,activityType:string,status:string,start:string,finish:string,remaining:number,original:number,actualStart:string|null=null)=>({
    projectId,activityId,nativeId:activityId,name,wbsId:'W1',calendarId:'C24',activityType,status,
    baselineStartIso:start,baselineFinishIso:finish,currentStartIso:start,currentFinishIso:finish,actualStartIso:actualStart,actualFinishIso:null,
    forecastStartIso:start,forecastFinishIso:finish,originalDurationHours:original,remainingDurationHours:remaining,totalFloatHours:0,freeFloatHours:0,
    percentComplete:status==='in_progress'?40:0,sourceRefs:[],diagnostics:[]});
  const rel=(relationshipId:string,predecessorActivityId:string,successorActivityId:string)=>({relationshipId,predecessorActivityId,successorActivityId,type:'FS',lagHours:0,external:false,sourceRefs:[],diagnostics:[]});
  return {projectId,source:'xer',sourceRevisionId:'U1',dataDateIso:'2027-03-01T00:00:00Z',
    activities:[
      act('A100','Structure','task','in_progress','2027-01-01T00:00:00Z','2027-06-09T00:00:00Z',2400,3816,'2027-01-01T00:00:00Z'),
      act('A200','Finishes','task','not_started','2027-06-09T00:00:00Z','2027-10-06T00:00:00Z',2856,2856),
      act('M900','Project Completion','finish_milestone','not_started','2027-10-06T00:00:00Z','2027-10-06T00:00:00Z',0,0),
    ],
    relationships:[rel('R1','A100','A200'),rel('R2','A200','M900')],
    wbs:[{wbsId:'W1',name:'Works',parentWbsId:null,sourceRefs:[]}],calendars:[calendar],diagnostics:[]} as unknown as CanonicalScheduleModel;
}

let serial=0;
export function contractTimeProject(options:{claims?:string;eot?:boolean}={}):string{
  const projectId='F33-F44-CONTRACT-TIME-'+(++serial)+'-'+process.pid;
  const dir=mkdtempSync(join(tmpdir(),'f33-f44-'));
  const state:any=runtimeProjects.getOrCreate(projectId);
  const model=contractTimeModel(projectId);
  state.schedules.push({role:'update',format:'xer',sourceFilename:'March-update.xer',sourceHashSha256:'march-update',uploadedAt:'2027-03-02T00:00:00Z',
    revision:{revisionId:'U1',label:'March update',sequence:1,effectiveAt:'2027-03-01',model}});
  const contractResult={sections:[{text:'Contractual Completion 08 September 2027\nDelay Damages USD 10000 per day',heading:'Time for Completion',startPage:12,
    sectionKey:'completion',sourceMode:'deterministic',sourceSpans:[]}],pdf:{pages:[]}};
  state.evidenceDocuments.push({documentId:'MAIN-CONTRACT',category:'contract',documentType:'main_contract',sourceFilename:'contract.pdf',sourceRelativePath:'contract.pdf',
    sourceHashSha256:'main-contract-hash',uploadedAt:'2027-03-02T00:00:00Z',basisState:'active',authority:'source_approved',parserState:'parsed',
    familyKey:'contract:main',logicalDocumentKey:'contract:main',linkedArtifactId:null,diagnostics:[]});
  state.contractDocuments.push({documentId:'MAIN-CONTRACT',role:'main',result:contractResult});
  state.contract=contractResult;
  const csv=(text:string)=>{
    const documentId='doc-'+state.evidenceDocuments.length,path=join(dir,documentId+'.csv');writeFileSync(path,text);
    const category='risk_claims_procurement',documentType='delay_eot_claims_register';
    const family=evidenceFamily({category,documentType,scheduleRole:null,textSample:text,sourceFilename:documentId+'.csv'} as any);
    state.evidenceDocuments.push({documentId,category,documentType,sourceFilename:documentId+'.csv',sourceRelativePath:null,mediaType:'text/csv',
      sourceHashSha256:createHash('sha256').update(text).digest('hex'),sizeBytes:Buffer.byteLength(text),storedPath:path,uploadedAt:'2027-03-02T00:00:00Z',
      authority:'candidate_only',parserState:'parsed',linkedArtifactId:null,scheduleRole:null,mapping:null,assertions:[],uploadIntent:'add_update',
      familyKey:family.familyKey+':'+documentId,logicalDocumentKey:family.logicalDocumentKey+':'+documentId,basisState:'active',supersedesDocumentIds:[],
      supersededByDocumentId:null,diagnostics:[],identification:{},lineage:{}});
  };
  if(options.eot!==false)csv('Determination ID,Claim ID,Awarded EOT Days,Determination Date,Status,Authority\nD1,C1,13,2027-02-01,Determined,Engineer');
  if(options.claims)csv(options.claims);
  state.version++;runtimeProjects.touch(state);
  return projectId;
}

/** Two pending claims (Submitted, Under Review) with 10 + 11 assessed days. */
export const PENDING_CLAIMS='Claim ID,Event,Notice Date,Days Claimed,Assessed Days,Status\nC1,Late access,2026-12-01,20,13,Determined\nC2,Design change,2027-01-10,15,10,Submitted\nC3,Utility diversion,2027-02-10,14,11,Under Review';
