import type {IncomingMessage,ServerResponse} from 'node:http';
import {runtimeProjects} from './project-state';
import {moduleForProject} from './project-projections';
import {projectDiagnosisDetails} from './project-diagnosis';
import {attachProjectFloatWorkingDays} from './activity-float-reconciliation';
import {once} from 'node:events';
import {readablePathLabel} from './field-labels';

export async function diagnosisRequest(req:IncomingMessage,res:ServerResponse,url:URL){
 const match=/^\/api\/projects\/([^/]+)\/diagnosis$/.exec(url.pathname);if(!match)return false;
 const send=(status:number,value:unknown)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));};
 if(req.method!=='GET'){send(405,{error:'read_only'});return true;}
 const projectId=decodeURIComponent(match[1]!),state=runtimeProjects.get(projectId);if(!state){send(404,{error:'project_not_found'});return true;}
 const expected=url.searchParams.get('version');if(expected!==null&&Number(expected)!==state.version){send(409,{error:'project_changed',message:'The project changed. Refresh the diagnosis before viewing another page.'});return true;}
 const d=projectDiagnosisDetails((moduleForProject(projectId,'pmo-analysis').data as any)?.projectDiagnosis);
 if(!d){send(409,{error:'programme_needed',message:'Select the reporting programme to establish the diagnosis.'});return true;}
 const section=url.searchParams.get('section')??'network';
 const sections:Record<string,any[]>={network:d.network.rows,relationships:d.network.relationships,wbs:d.wbsRows,evidence:d.evidenceChecks,milestones:d.milestoneRows,actions:d.actions,changes:d.revision.largestChanges};
 const sourceRows=sections[section];if(!sourceRows){send(400,{error:'unknown_section'});return true;}
 // T06: float rows carry working days of each activity's own source calendar.
 const rows=sourceRows;
 const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??25),format=url.searchParams.get('format');
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100){send(400,{error:'invalid_page'});return true;}
 if(format&&!['xlsx','csv'].includes(format)){send(400,{error:'invalid_format'});return true;}
 if(format){
   // Downloads hold the whole section, so the whole section is converted.
   const rows=attachProjectFloatWorkingDays(state,sourceRows);
   const keys=[...new Set(rows.flatMap(Object.keys))],filename=projectId.replace(/[^a-zA-Z0-9_-]/g,'_')+'-'+section;
   const value=(v:unknown)=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):v;
   if(format==='xlsx'){
     const ExcelJS=(await import('exceljs')).default;
     res.writeHead(200,{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="'+filename+'.xlsx"'});
     const workbook=new ExcelJS.stream.xlsx.WorkbookWriter({stream:res,useStyles:false,useSharedStrings:false}),sheet=workbook.addWorksheet('Project diagnosis');
     sheet.addRow(['Project',projectId,'Data Date',d.dataDateIso,'Source revision',d.sourceRevisionId,'Project version',state.version]).commit();
     // T10 X1 (W1): headings in reader words; 'Column keys' maps each column to its field key.
     sheet.addRow([section==='network'?d.network.basis:d.rankingBasis]).commit();sheet.addRow(keys.map(k=>readablePathLabel(k)||k)).commit();
     for(const r of rows)sheet.addRow(keys.map(k=>value(r[k]))).commit();sheet.commit();
     const mapping=workbook.addWorksheet('Column keys');mapping.addRow(['Column','Heading','Field key']).commit();
     keys.forEach((k,i)=>mapping.addRow([i+1,readablePathLabel(k)||k,k]).commit());mapping.commit();await workbook.commit();
   }else{
     res.writeHead(200,{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="'+filename+'.csv"'});
     const cell=(v:unknown)=>{let s=String(value(v));if(typeof v==='string'&&/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
     res.write('\uFEFF'+keys.map(cell).join(',')+'\r\n');for(const row of rows){if(res.destroyed)break;if(!res.write(keys.map(k=>cell(row[k])).join(',')+'\r\n'))await once(res,'drain');}res.end();
   }
 }else send(200,{projectId,projectVersion:state.version,sourceRevisionId:d.sourceRevisionId,dataDateIso:d.dataDateIso,section,total:rows.length,offset,limit,rows:attachProjectFloatWorkingDays(state,rows.slice(offset,offset+limit))});
 return true;
}
