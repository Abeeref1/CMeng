import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import PDFDocument from 'pdfkit';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {join} from 'node:path';
import type {AnalysisResult,AnalysisTable,AnalysisChart,Cell} from '../../project-ask/src/types';
import {AskError} from '../../project-ask/src/catalogue';
const font=join(process.cwd(),'packages/project-ask/assets/DejaVuSans.ttf');
const colors=['#336b91','#bb7938','#5d927f','#9c5e80'];
const display=(v:Cell|undefined)=>v===null||v===undefined?'Not established':String(v);
const safe=(s:string)=>s.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,70);
const xml=(s:unknown)=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const csv=(v:Cell|undefined)=>'"'+display(v).replace(/^[=+@\t\r]/,"'$&").replace(/^-([^\d])/,"'-$1").replace(/"/g,'""')+'"';
const rows=(r:AnalysisResult)=>r.sections.flatMap(s=>s.tables);
export interface AskExportView {
  title?:string;
  subtitle?:string|null;
  includeAuthorities?:string[];
  sectionOrder?:string[];
  includeCharts?:string[];
  includeTables?:string[];
  includeMetrics?:string[];
  chartTypes?:Record<string,'bar'|'line'>;
  chartLimits?:Record<string,number>;
  layout?:string|null;
  detailLevel?:'short'|'normal'|'detailed'|null;
}
function validExportView(view:AskExportView|undefined){
  if(!view)return undefined;
  const safeIds=(values:unknown)=>Array.isArray(values)?values.filter(v=>typeof v==='string'&&v.length<=160).slice(0,100):undefined;
  const types:Record<string,'bar'|'line'>={};for(const [key,value] of Object.entries(view.chartTypes??{}))if(key.length<=160&&(value==='bar'||value==='line'))types[key]=value;
  const limits:Record<string,number>={};for(const [key,value] of Object.entries(view.chartLimits??{}))if(key.length<=160&&Number.isSafeInteger(value)&&value>0&&value<=5000)limits[key]=value;
  const title=typeof view.title==='string'?view.title.trim().slice(0,160):'';
  const includeAuthorities=safeIds(view.includeAuthorities),sectionOrder=safeIds(view.sectionOrder),includeCharts=safeIds(view.includeCharts),includeTables=safeIds(view.includeTables),includeMetrics=safeIds(view.includeMetrics);
  const detailLevel=['short','normal','detailed'].includes(String(view.detailLevel))?view.detailLevel as 'short'|'normal'|'detailed':null;
  return {...(title?{title}:{}),...(typeof view.subtitle==='string'?{subtitle:view.subtitle.slice(0,500)}:{}),...(includeAuthorities?{includeAuthorities}:{}),...(sectionOrder?{sectionOrder}:{}),...(includeCharts?{includeCharts}:{}),...(includeTables?{includeTables}:{}),...(includeMetrics?{includeMetrics}:{}),chartTypes:types,chartLimits:limits,...(typeof view.layout==='string'?{layout:view.layout.slice(0,80)}:{}),...(detailLevel?{detailLevel}:{})} satisfies AskExportView;
}
export function preparedAskResult(result:AnalysisResult,input?:AskExportView){
  const view=validExportView(input);if(!view)return result;
  const include=view.includeAuthorities?.length?new Set(view.includeAuthorities):null,chartSet=view.includeCharts?.length?new Set(view.includeCharts):null,tableSet=view.includeTables?.length?new Set(view.includeTables):null,metricSet=view.includeMetrics?.length?new Set(view.includeMetrics):null;
  const order=new Map((view.sectionOrder??[]).map((id,index)=>[id,index]));
  const sections=result.sections.filter(s=>!include||include.has(s.authorityId)).map(s=>({...s,
    metrics:s.metrics.filter(metric=>!metricSet||metricSet.has(metric.id)),
    tables:s.tables.filter(table=>!tableSet||tableSet.has(table.id)),
    charts:s.charts.filter(chart=>(!chartSet||chartSet.has(chart.id))&&(!tableSet||tableSet.has(chart.tableId))).map(chart=>({...chart,type:view.chartTypes?.[chart.id]??chart.type}))
  })).sort((a,b)=>(order.get(a.authorityId)??9999)-(order.get(b.authorityId)??9999));
  return {...result,presentation:{...result.presentation,title:view.title??result.presentation.title,...(view.detailLevel?{detail:view.detailLevel}:{})},sections};
}
const metadata=(r:AnalysisResult)=>[['Project',r.scope.projectName],['Data Date',r.scope.dataDate??'Not established'],['Programme revision',r.scope.programmeRevision??'Not established'],['Project version',r.scope.projectVersion],['Analysis',r.id],['Source snapshot',r.snapshotHash],['Prepared by',r.presentation.preparedBy??'Not supplied'],['Job title',r.presentation.jobTitle??'Not supplied'],['Company',r.presentation.company??'Not supplied'],['Issue date',r.createdAt.slice(0,10)],['Status','Draft / Prepared'],['Confidentiality',r.presentation.confidentiality],['Scope',JSON.stringify({filters:r.plan.filters,authorityFilters:r.plan.authorityFilters??{},rankings:r.plan.rankings??[]})],['Grouping',r.plan.groupBy.join(', ')||'None']];

/** Charts are a rendering of table cells. No KPI is recalculated here. */
export function askChartPng(chart:AnalysisChart,table:AnalysisTable,options:{type?:'bar'|'line';limit?:number}={}){
  GlobalFonts.registerFromPath(font,'CMeng');const canvas=createCanvas(1200,560),c=canvas.getContext('2d');c.fillStyle='#ffffff';c.fillRect(0,0,1200,560);
  c.font='bold 22px CMeng';c.fillStyle='#24384a';c.fillText(chart.title.slice(0,86),28,35);c.font='14px CMeng';c.fillStyle='#53697d';c.fillText(chart.unit+' · Data Date '+(chart.dataDate??'not established'),28,62);
  const chartRows=table.rows.slice(0,options.limit??table.rows.length),chartType=options.type??chart.type;
  const values=chartRows.flatMap(r=>chart.series.map(s=>r[s])).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
  if(!values.length)return canvas.toBuffer('image/png');
  const lo=Math.min(0,...values),hi=Math.max(0,...values),span=hi-lo||1,left=85,top=96,width=1080,height=330;
  const y=(v:number)=>top+height-(v-lo)/span*height;c.font='13px CMeng';
  for(let i=0;i<=4;i++){const v=lo+span*i/4;c.strokeStyle='#e2e9ee';c.beginPath();c.moveTo(left,y(v));c.lineTo(left+width,y(v));c.stroke();c.fillStyle='#53697d';c.fillText(Number(v.toFixed(2)).toLocaleString('en-US'),8,y(v)+4);}
  const step=width/Math.max(chartRows.length,1);
  chart.series.forEach((key,index)=>{c.fillStyle=colors[index%colors.length]!;c.strokeStyle=c.fillStyle;c.lineWidth=3;let connected=false;
    chartRows.forEach((r,i)=>{const v=r[key];if(typeof v!=='number'){connected=false;return;}const x=left+step*(i+.5);
      if(chartType==='bar'){const bw=Math.max(1,step*.72/chart.series.length);c.fillRect(left+step*i+step*.14+bw*index,Math.min(y(v),y(0)),bw-1,Math.max(1,Math.abs(y(v)-y(0))));}
      else{if(!connected){c.beginPath();c.moveTo(x,y(v));}else c.lineTo(x,y(v));c.stroke();connected=true;c.beginPath();c.arc(x,y(v),3,0,2*Math.PI);c.fill();c.beginPath();c.moveTo(x,y(v));}
    });c.fillRect(32+index*280,510,14,14);c.fillStyle='#24384a';c.fillText(table.columns.find(col=>col.key===key)?.label??key,54+index*280,522);
  });
  chartRows.forEach((r,i)=>{if(i%Math.max(1,Math.ceil(table.rows.length/10)))return;c.save();c.translate(left+step*(i+.5),446);c.rotate(-.22);c.fillStyle='#53697d';c.fillText(display(r[chart.category]).slice(0,24),-24,0);c.restore();});
  return canvas.toBuffer('image/png');
}
async function workbook(result:AnalysisResult,view?:AskExportView){
  const book=new ExcelJS.Workbook();book.creator=result.presentation.preparedBy??'CMeng';book.title=result.presentation.title;book.created=new Date(result.createdAt);
  const report=book.addWorksheet('Executive Summary');report.addRows([['CMeng · '+result.presentation.title],...metadata(result),[],['Current position']]);
  for(const n of result.narrative)report.addRows([[n.heading],[n.text]]);
  const metrics=book.addWorksheet('KPI Dashboard');metrics.addRow(['Metric','Value','Unit','Evidence state','Basis','Evidence reference']);
  for(const m of result.sections.flatMap(s=>s.metrics))metrics.addRow([m.label,m.value??'Not established',m.unit??'',m.state,m.basis,m.traceId]);
  const index=book.addWorksheet('Dataset Index');index.addRow(['Worksheet','Analysis table','Rows','Source population','Excluded','Basis']);
  let number=0;for(const table of rows(result)){
    const name=String(++number).padStart(2,'0')+' '+table.title.replace(/[\\/?*\[\]:]/g,' ').slice(0,27);const sheet=book.addWorksheet(name);
    sheet.addRow(table.columns.map(c=>c.label+(c.unit?' ('+c.unit+')':'')));
    for(const row of table.rows)sheet.addRow(table.columns.map(c=>row[c.key]??'Not established'));
    index.addRow([name,table.title,table.rows.length,table.population,table.excluded,table.basis]);
  }
  const findings=book.addWorksheet('Findings and Actions');findings.addRow(['Finding','Explanation','Action','Owner','Due basis','Evidence']);for(const f of result.sections.flatMap(s=>s.findings))findings.addRow([f.title,f.explanation,f.action,f.owner??'Not assigned',f.dueBasis??'Not established',f.traceIds.join('; ')]);
  const gaps=book.addWorksheet('Evidence Gaps');gaps.addRow(['Unresolved information']);result.unresolved.forEach(g=>gaps.addRow([g]));
  if(result.coverage){const coverage=book.addWorksheet('Evidence Coverage');coverage.addRow(['Population','Source','Applicable','Relevant','Direct','Aggregated','Supporting omitted','Mandatory','Mandatory represented','State','Basis']);for(const c of result.coverage.entries)coverage.addRow([c.id,c.sourcePopulation,c.applicablePopulation,c.relevantPopulation,c.directlyRepresented,c.aggregated,c.supportingOmitted,c.mandatoryPopulation,c.mandatoryRepresented,c.state,c.omissionBasis]);}
  const trace=book.addWorksheet('Evidence Trace');trace.addRow(['Reference','Authority','Source module','Path','Data Date','Evidence state','Basis','Source references','Exclusions']);for(const t of result.sections.flatMap(s=>s.traces))trace.addRow([t.id,t.authorityId,t.module,t.path,t.dataDate??'Not established',t.state,t.basis,t.sourceRefs.join('; '),t.exclusions.join('; ')]);
  for(const sheet of book.worksheets){sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF24384A'}};sheet.getRow(1).height=30;(sheet.columns??[]).forEach((c,i)=>c.width=i===0?32:24);sheet.eachRow(row=>row.eachCell(c=>{c.alignment={vertical:'top',wrapText:true};if(typeof c.value==='number')c.numFmt='0.##########';if(typeof c.value==='string'&&c.value.length>32767)c.value=c.value.slice(0,32730)+' [text shortened; see JSON export]';}));if(!['Executive Summary'].includes(sheet.name)&&sheet.rowCount>1)sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:Math.max(1,sheet.columnCount)}};}
  report.getColumn(1).width=36;report.getColumn(2).width=110;report.eachRow(row=>{if(typeof row.getCell(1).value==='string'&&String(row.getCell(1).value).length>60){row.height=Math.min(220,Math.ceil(String(row.getCell(1).value).length/120)*18);report.mergeCells(row.number,1,row.number,5);}});
  let chartIndex=0;for(const chart of result.sections.flatMap(s=>s.charts)){const table=rows(result).find(t=>t.id===chart.tableId);if(!table)continue;const sheet=book.addWorksheet('Chart '+(++chartIndex));sheet.addRow([chart.title]);sheet.addRow([chart.basis]);const id=book.addImage({buffer:askChartPng(chart,table,{...(view?.chartLimits?.[chart.id]!==undefined?{limit:view.chartLimits[chart.id]}:{})}) as any,extension:'png'});sheet.addImage(id,{tl:{col:0,row:3},ext:{width:1000,height:467}});sheet.getColumn(1).width=140;sheet.getRow(2).alignment={wrapText:true};sheet.getRow(2).height=45;}
  return Buffer.from(await book.xlsx.writeBuffer());
}
async function pdf(result:AnalysisResult,view?:AskExportView){
  const doc=new PDFDocument({size:'A4',margins:{top:48,bottom:48,left:44,right:44},bufferPages:true,info:{Title:result.presentation.title,Author:result.presentation.preparedBy??'CMeng',Subject:result.scope.projectId+' · '+result.scope.dataDate}});
  doc.font(font);const chunks:Buffer[]=[];const done=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  const heading=(text:string)=>{if(doc.y>690)doc.addPage();doc.moveDown(.8).fontSize(15).fillColor('#24384a').text(text,{width:507}).moveDown(.4);};
  const para=(text:string,size=9)=>{doc.fontSize(size).fillColor('#334b61').text(text,{width:507,lineGap:3,paragraphGap:5}).moveDown(.4);};
  doc.fontSize(13).fillColor('#547d98').text('CMeng | PROJECT INTELLIGENCE');doc.moveDown(1.2).fontSize(25).fillColor('#24384a').text(result.presentation.title,{width:490});doc.moveDown();
  for(const [key,value]of metadata(result).filter(([k])=>!['Source snapshot','Scope','Grouping'].includes(String(k))))para(key+': '+value);
  for(const block of result.narrative){heading(block.heading);para(block.text);}
  heading('Key figures');for(const m of result.sections.flatMap(s=>s.metrics)){para(m.label+': '+display(m.value)+(m.unit?' '+m.unit:'')+' · '+m.state);}
  for(const chart of result.sections.flatMap(s=>s.charts)){const table=rows(result).find(t=>t.id===chart.tableId);if(!table)continue;if(doc.y>470)doc.addPage();doc.image(askChartPng(chart,table,{...(view?.chartLimits?.[chart.id]!==undefined?{limit:view.chartLimits[chart.id]}:{})}),44,doc.y,{width:507});doc.y+=248;para(chart.basis,8);}
  for(const table of rows(result).filter(t=>t.rows.length)){
    heading(table.title);para(table.basis,8);para('Showing '+Math.min(40,table.rows.length)+' of '+table.rows.length+' result rows. The Excel and structured exports contain every result row.',8);
    const columns=table.columns.filter(c=>!['recordId','projectVersion','programmeRevisionId'].includes(c.key));
    for(const row of table.rows.slice(0,40)){
      if(doc.y>680)doc.addPage();const text=columns.map(c=>c.label+': '+display(row[c.key])).join('  |  ');para(text,8);doc.strokeColor('#e0e6eb').moveTo(44,doc.y).lineTo(551,doc.y).stroke();doc.moveDown(.4);
    }
  }
  heading('Findings and actions');for(const f of result.sections.flatMap(s=>s.findings)){para(f.title+': '+f.explanation,9);para(f.action,8);}
  if(result.coverage){heading('Evidence coverage');for(const c of result.coverage.entries)para(c.id+': source '+c.sourcePopulation+'; applicable '+c.applicablePopulation+'; direct '+c.directlyRepresented+'; aggregated '+c.aggregated+'; supporting omitted '+c.supportingOmitted+'. '+c.omissionBasis,8);}
  heading('Missing and conflicting evidence');for(const gap of result.unresolved)para(gap,8);
  heading('Evidence and calculation basis');para('Analysis '+result.id+'\nSnapshot '+result.snapshotHash+'\nFilters: '+(result.plan.filters.map(f=>f.field+' '+f.operator+' '+f.value).join('; ')||'All selected records')+'\nGrouping: '+(result.plan.groupBy.join(', ')||'None'),8);for(const t of result.sections.flatMap(s=>s.traces)){para(t.id+' · '+t.module+' · '+t.basis+'\n'+t.sourceRefs.slice(0,8).join('; '),7);}
  const range=doc.bufferedPageRange();for(let i=range.start;i<range.start+range.count;i++){doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.fontSize(7).fillColor('#647687').text(result.presentation.confidentiality+' · Draft / Prepared · '+result.scope.projectId+' · Page '+(i+1)+' / '+range.count,44,807,{width:507,lineBreak:false});doc.page.margins.bottom=bottom;}
  doc.end();return done;
}
function wordParagraph(text:string,style='Normal'){return '<w:p><w:pPr><w:pStyle w:val="'+style+'"/>'+(/[\u0600-\u06ff]/.test(text)?'<w:bidi/>':'')+'</w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/></w:rPr><w:t xml:space="preserve">'+text.split('\n').map(line=>xml(line)).join('</w:t><w:br/><w:t xml:space="preserve">')+'</w:t></w:r></w:p>';}
async function word(result:AnalysisResult,view?:AskExportView){
  const zip=new JSZip();let body=wordParagraph('CMeng | '+result.presentation.title,'Title');for(const [k,v]of metadata(result).filter(([key])=>!['Source snapshot','Analysis','Project version','Programme revision','Scope'].includes(String(key))))body+=wordParagraph(k+': '+v);
  for(const n of result.narrative)body+=wordParagraph(n.heading,'Heading1')+wordParagraph(n.text);
  body+=wordParagraph('Key figures','Heading1');for(const m of result.sections.flatMap(s=>s.metrics))body+=wordParagraph(m.label+': '+display(m.value)+(m.unit?' '+m.unit:'')+' · '+m.state);
  const relationships:string[]=[];let imageIndex=0;
  for(const chart of result.sections.flatMap(s=>s.charts)){const table=rows(result).find(t=>t.id===chart.tableId);if(!table)continue;const id='rIdChart'+(++imageIndex);zip.file('word/media/chart'+imageIndex+'.png',askChartPng(chart,table,{...(view?.chartLimits?.[chart.id]!==undefined?{limit:view.chartLimits[chart.id]}:{})}));relationships.push('<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/chart'+imageIndex+'.png"/>');body+=wordParagraph(chart.title,'Heading1')+'<w:p><w:r><w:drawing><wp:inline><wp:extent cx="5486400" cy="2560320"/><wp:docPr id="'+imageIndex+'" name="Chart '+imageIndex+'"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+imageIndex+'" name="chart.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5486400" cy="2560320"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'+wordParagraph(chart.basis);}
  for(const table of rows(result).filter(t=>t.rows.length)){body+=wordParagraph(table.title,'Heading1')+wordParagraph(table.basis)+wordParagraph('Showing '+Math.min(100,table.rows.length)+' of '+table.rows.length+' result rows; all result rows are in Excel and structured exports.');
    // Narrow field/value tables remain readable for wide construction registers.
    for(const row of table.rows.slice(0,100)){body+='<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D9D9"/><w:left w:val="single" w:sz="4" w:color="D9D9D9"/><w:bottom w:val="single" w:sz="4" w:color="D9D9D9"/><w:right w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideH w:val="single" w:sz="4" w:color="D9D9D9"/><w:insideV w:val="single" w:sz="4" w:color="D9D9D9"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="2800"/><w:gridCol w:w="6200"/></w:tblGrid>';for(const col of table.columns)body+='<w:tr><w:tc><w:tcPr><w:tcW w:w="2800" w:type="dxa"/><w:shd w:fill="F1F5F8"/></w:tcPr>'+wordParagraph(col.label)+'</w:tc><w:tc><w:tcPr><w:tcW w:w="6200" w:type="dxa"/></w:tcPr>'+wordParagraph(display(row[col.key]))+'</w:tc></w:tr>';body+='</w:tbl>'+wordParagraph('');}}
  body+=wordParagraph('Findings and actions','Heading1');for(const f of result.sections.flatMap(s=>s.findings))body+=wordParagraph(f.title+': '+f.explanation)+wordParagraph(f.action);
  if(result.coverage){body+=wordParagraph('Evidence coverage','Heading1');for(const c of result.coverage.entries)body+=wordParagraph(c.id+': source '+c.sourcePopulation+'; applicable '+c.applicablePopulation+'; direct '+c.directlyRepresented+'; aggregated '+c.aggregated+'; supporting omitted '+c.supportingOmitted+'. '+c.omissionBasis);}
  body+=wordParagraph('Evidence gaps','Heading1');result.unresolved.forEach(g=>body+=wordParagraph(g));body+=wordParagraph('Evidence trace','Heading1')+wordParagraph('Analysis '+result.id+'\nSource snapshot '+result.snapshotHash);result.sections.flatMap(s=>s.traces).forEach(t=>body+=wordParagraph(t.id+' · '+t.basis+' · '+t.sourceRefs.join('; ')));
  zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+relationships.join('')+'</Relationships>');
  zip.file('word/styles.xml','<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="44"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="28"/></w:rPr></w:style></w:styles>');
  zip.file('word/document.xml','<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>');return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
export async function exportAskAnalysis(source:AnalysisResult,format:string,inputView?:AskExportView){
  const view=validExportView(inputView),result=preparedAskResult(source,view);
  const filename=safe(result.scope.projectId)+'_CMeng_'+result.id.slice(0,8);let bytes:Buffer,type:string,extension:string;
  if(format==='xlsx'){bytes=await workbook(result,view);type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';extension='xlsx';}
  else if(format==='pdf'){bytes=await pdf(result,view);type='application/pdf';extension='pdf';}
  else if(format==='docx'){bytes=await word(result,view);type='application/vnd.openxmlformats-officedocument.wordprocessingml.document';extension='docx';}
  else if(format==='json'){bytes=Buffer.from(JSON.stringify(result));type='application/json';extension='json';}
  else if(format==='csv'||format==='powerbi'){
    const zip=new JSZip();zip.file('analysis.json',JSON.stringify(result));zip.file('project.csv','projectId,dataDate,analysisId,snapshotHash\r\n'+[result.scope.projectId,result.scope.dataDate,result.id,result.snapshotHash].map(csv).join(','));
    const datasets:any[]=[];rows(result).forEach((table,i)=>{const name=String(i+1).padStart(2,'0')+'_'+safe(table.id)+'.csv';zip.file(name,'\uFEFF'+['projectId','analysisId',...table.columns.map(c=>c.key)].map(csv).join(',')+'\r\n'+table.rows.map(r=>[result.scope.projectId,result.id,...table.columns.map(c=>r[c.key])].map(csv).join(',')).join('\r\n'));datasets.push({file:name,title:table.title,columns:table.columns,rows:table.rows.length,basis:table.basis});});
    zip.file('dataset-schema.json',JSON.stringify({projectId:result.scope.projectId,dataDate:result.scope.dataDate,analysisId:result.id,snapshotHash:result.snapshotHash,datasets,relationships:[{from:'datasets.projectId',to:'project.projectId',cardinality:'many-to-one'}]},null,2));
    zip.file('README.txt','CMeng Project dataset\nImport the UTF-8 CSV tables into Power BI or Excel. projectId and analysisId identify their exact scope. Blank evidence is represented as Not established, never zero. Unit and currency groups remain separate. See dataset-schema.json and analysis.json for metadata, evidence, filters and exclusions. This is a populated Power BI-ready dataset, not a PBIX file.');bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});type='application/zip';extension='zip';
  }else throw new AskError(400,'format_not_supported','Choose Excel, PDF, Word, CSV, JSON or Power BI-ready data.');
  return {bytes,type,filename:filename+'.'+extension};
}
