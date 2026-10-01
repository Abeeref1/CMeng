import {buildDeliveryWorkbook} from './delivery-export';
import {createHash} from 'node:crypto';
import {exportAskAnalysis,type AskExportView} from './ask-export';
import type {AnalysisResult,AuthorityResult,AnalysisChart,Column,Cell,EvidenceState} from '../../project-ask/src/types';
import {pageApiKey,publicModuleResult} from './registry';
import ExcelJS from "exceljs";
import type {
  ModuleRuntimeResult,
} from "./project-state-types";
import {
  titleForModule,
} from "./registry";

type FlatValue =
  | string
  | number
  | boolean
  | null;

interface ArraySection {
  path: string;
  rows: unknown[];
}

function safeFilenamePart(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .replace(
      /[^A-Za-z0-9._-]+/g,
      "_",
    )
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function worksheetName(
  value: string,
  used: Set<string>,
): string {
  const base =
    (
      value
        .replace(
          /[\\/?*\[\]:]/g,
          " ",
        )
        .replace(/\s+/g, " ")
        .trim() || "Data"
    ).slice(0, 31);

  let name = base;
  let index = 2;
  while (used.has(name)) {
    const suffix =
      " " + index;
    name =
      base.slice(
        0,
        Math.max(
          1,
          31 -
            suffix.length,
        ),
      ) + suffix;
    index += 1;
  }
  used.add(name);
  return name;
}

function primitiveValue(
  value: unknown,
): FlatValue {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

function flattenRecord(
  value: unknown,
  prefix = "",
  out: Record<
    string,
    FlatValue
  > = {},
  depth = 0,
): Record<string, FlatValue> {
  if (depth > 6) {
    if (prefix) {
      out[prefix] =
        "[nested data]";
    }
    return out;
  }

  if (
    value === null ||
    value === undefined ||
    typeof value !== "object"
  ) {
    if (prefix) {
      out[prefix] =
        primitiveValue(value);
    }
    return out;
  }

  if (Array.isArray(value)) {
    if (prefix) {
      if (
        value.every(
          (item) =>
            item === null ||
            item === undefined ||
            typeof item !==
              "object",
        )
      ) {
        const joined = value
            .map(
              (item) =>
                item === null ||
                item ===
                  undefined
                  ? ""
                  : String(item),
            )
            .join("; ");
        out[prefix] = joined.length<=32000?joined:'['+value.length+' records; complete values are in the array worksheet]';
      } else {
        out[prefix] =
          "[" +
          value.length +
          " records]";
      }
    }
    return out;
  }

  const entries =
    Object.entries(
      value as Record<
        string,
        unknown
      >,
    );
  if (entries.length === 0) {
    if (prefix) {
      out[prefix] = "";
    }
    return out;
  }

  for (const [key, child] of entries) {
    const path =
      prefix
        ? prefix + "." + key
        : key;
    if (Array.isArray(child)) {
      if (
        child.every(
          (item) =>
            item === null ||
            item === undefined ||
            typeof item !==
              "object",
        )
      ) {
        const joined=child
            .map(
              (item) =>
                item === null ||
                item ===
                  undefined
                  ? ""
                  : String(item),
            )
            .join("; ");
        out[path]=joined.length<=32000?joined:'['+child.length+' records; complete values are in the array worksheet]';
      } else {
        out[path] =
          "[" +
          child.length +
          " records]";
      }
    } else if (
      child !== null &&
      typeof child ===
        "object"
    ) {
      flattenRecord(
        child,
        path,
        out,
        depth + 1,
      );
    } else {
      out[path] =
        primitiveValue(child);
    }
  }

  return out;
}

function collectArrays(
  value: unknown,
  prefix = "",
  out: ArraySection[] = [],
  depth = 0,
): ArraySection[] {
  if (
    depth > 6 ||
    value === null ||
    value === undefined ||
    typeof value !== "object"
  ) {
    return out;
  }

  if (Array.isArray(value)) {
    out.push({
      path:
        prefix || "records",
      rows: value,
    });
    return out;
  }

  for (
    const [key, child] of
      Object.entries(
        value as Record<
          string,
          unknown
        >,
      )
  ) {
    const path =
      prefix
        ? prefix + "." + key
        : key;
    if (Array.isArray(child)) {
      out.push({
        path,
        rows: child,
      });
      for (
        const row of child.slice(
          0,
          20,
        )
      ) {
        if (
          row &&
          typeof row ===
            "object" &&
          !Array.isArray(row)
        ) {
          collectArrays(
            row,
            path,
            out,
            depth + 1,
          );
        }
      }
    } else {
      collectArrays(
        child,
        path,
        out,
        depth + 1,
      );
    }
  }

  const seen = new Set<string>();
  return out.filter(
    (section) => {
      if (
        seen.has(section.path)
      ) {
        return false;
      }
      seen.add(section.path);
      return true;
    },
  );
}

function styleHeader(
  row: ExcelJS.Row,
): void {
  row.font = {
    bold: true,
    color: {
      argb: "FFFFFFFF",
    },
  };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF315F8A",
    },
  };
  row.alignment = {
    vertical: "middle",
    wrapText: true,
  };
}

function fitColumns(
  sheet: ExcelJS.Worksheet,
  maxWidth = 42,
): void {
  sheet.columns.forEach(
    (column) => {
      let width = 10;
      if (!column.eachCell) {
        column.width = width;
        return;
      }
      column.eachCell(
        {
          includeEmpty: false,
        },
        (cell) => {
          const text =
            cell.value === null ||
            cell.value ===
              undefined
              ? ""
              : typeof cell.value ===
                  "object"
                ? JSON.stringify(
                    cell.value,
                  )
                : String(
                    cell.value,
                  );
          width = Math.max(
            width,
            Math.min(
              maxWidth,
              text.length + 2,
            ),
          );
        },
      );
      column.width = width;
    },
  );
}

function addArraySheet(
  workbook: ExcelJS.Workbook,
  section: ArraySection,
  usedNames: Set<string>,
): void {
  const sheet =
    workbook.addWorksheet(
      worksheetName(
        section.path
          .split(".")
          .at(-1) ??
          section.path,
        usedNames,
      ),
    );

  if (section.rows.length === 0) {
    sheet.addRow([
      "No records",
    ]);
    return;
  }

  const flatRows =
    section.rows.map(
      (row) => {
        if (
          row &&
          typeof row ===
            "object" &&
          !Array.isArray(row)
        ) {
          return flattenRecord(
            row,
          );
        }
        return {
          value:
            primitiveValue(row),
        };
      },
    );

  const headers: string[] =
    [];
  const seen =
    new Set<string>();
  for (
    const row of flatRows
  ) {
    for (
      const key of
        Object.keys(row)
    ) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  sheet.addRow(headers);
  styleHeader(sheet.getRow(1));
  sheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];
  sheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column:
        Math.max(
          1,
          headers.length,
        ),
    },
  };

  for (
    const row of flatRows
  ) {
    sheet.addRow(
      headers.map(
        (key) =>
          row[key] ?? null,
      ),
    );
  }

  fitColumns(sheet);
}

export async function buildModuleWorkbook(
  projectId: string,
  moduleKey: string,
  result: ModuleRuntimeResult,
): Promise<Buffer> {
  if((result.data as any)?.projectionKey==="delivery")return buildDeliveryWorkbook(projectId,result);
  const workbook =
    new ExcelJS.Workbook();
  workbook.creator = "CMeng";
  workbook.company = "CMeng";
  workbook.subject =
    "CMeng module report";
  workbook.title =
    projectId +
    " - " +
    titleForModule(
      moduleKey,
    );
  workbook.created =
    new Date();

  const usedNames =
    new Set<string>();
  const summary =
    workbook.addWorksheet(
      worksheetName(
        "Report",
        usedNames,
      ),
    );

  summary.addRow([
    "CMeng Module Report",
  ]);
  summary.mergeCells(
    "A1:B1",
  );
  summary.getCell("A1").font = {
    bold: true,
    size: 18,
    color: {
      argb: "FF22364D",
    },
  };

  const reportRows: Array<
    [string, FlatValue]
  > = [
    [
      "Project",
      projectId,
    ],
    [
      "Module",
      titleForModule(
        moduleKey,
      ),
    ],
    [
      "Module key",
      pageApiKey(moduleKey),
    ],
    [
      "Status",
      result.status,
    ],
    [
      "Reason",
      result.reason ??
        null,
    ],
    [
      "Report generated",
      new Date()
        .toISOString(),
    ],
  ];

  for (
    const [label, value] of
      reportRows
  ) {
    summary.addRow([
      label,
      value,
    ]);
  }

  const data =
    result.data &&
    typeof result.data ===
      "object"
      ? result.data
      : {};
  const flat =
    flattenRecord(data);
  summary.addRow([]);
  summary.addRow([
    "Calculated / source fields",
  ]);
  const sectionHeader =
    summary.lastRow!;
  sectionHeader.font = {
    bold: true,
    color: {
      argb: "FFFFFFFF",
    },
  };
  sectionHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: "FF4F7FB4",
    },
  };

  for (
    const [key, value] of
      Object.entries(flat)
  ) {
    summary.addRow([
      key,
      value,
    ]);
  }

  summary.getColumn(1).width =
    42;
  summary.getColumn(2).width =
    46;
  summary.eachRow(
    (row, rowNumber) => {
      if (
        rowNumber > 1 &&
        rowNumber <=
          reportRows.length +
            1
      ) {
        row.getCell(1).font = {
          bold: true,
          color: {
            argb: "FF506579",
          },
        };
      }
      row.alignment = {
        vertical: "top",
        wrapText: true,
      };
    },
  );

  for (
    const section of
      collectArrays(data)
  ) {
    addArraySheet(
      workbook,
      section,
      usedNames,
    );
  }

  const buffer =
    await workbook.xlsx
      .writeBuffer();
  return Buffer.from(buffer);
}

export function buildModuleJsonDownload(
  projectId: string,
  moduleKey: string,
  result: ModuleRuntimeResult,
): Buffer {
  return Buffer.from(
    JSON.stringify(
      {
        report: {
          projectId,
          module:
            titleForModule(
              moduleKey,
            ),
          moduleKey:pageApiKey(moduleKey),
          generatedAt:
            new Date()
              .toISOString(),
        },
        // Preserve the route key used by the page so a report is a faithful
        // serialization of the same governed projection, not a renamed copy.
        // pageApiKey remains report metadata only.
        result:publicModuleResult(result,moduleKey),
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function moduleReportFilename(
  projectId: string,
  moduleKey: string,
  extension:
    | "xlsx"
    | "json",
): string {
  const title =
    titleForModule(
      moduleKey,
    );
  return (
    safeFilenamePart(
      projectId,
    ) +
    "_" +
    safeFilenamePart(
      title,
    ) +
    "_" +
    new Date()
      .toISOString()
      .slice(0, 10) +
    "." +
    extension
  );
}


export interface ModuleReportView extends AskExportView {
  filters?: Record<string,string>;
  selectedRole?: string|null;
  dateRange?: {from:string|null;to:string|null}|null;
  grouping?: string[];
  sort?: {field:string;direction:'asc'|'desc'}|null;
  topN?: number|null;
  layout?: string|null;
}
const normalizedKey=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,'');
const aliases:Record<string,string[]>={
  wbsid:['wbsid','wbs','wbspath'],zone:['zone'],floor:['floor','level'],level:['level','floor'],tower:['tower'],building:['building','block'],area:['area'],workfront:['workfront','affectedworkfront'],
  discipline:['discipline'],trade:['trade'],system:['system'],package:['package','packagecandidate','workpackage','reference'],contractor:['contractor','owner','responsibleparty'],subcontractor:['subcontractor'],
  status:['status','state','currentstatus','readinessstate','permitstatus'],criticality:['criticality'],currency:['currency']
};
function rowFilterValue(row:Record<string,unknown>,filter:string){
  const wanted=aliases[normalizedKey(filter)]??[normalizedKey(filter)],entries=Object.entries(row);
  for(const [key,value] of entries)if(wanted.includes(normalizedKey(key))&&value!==null&&value!==undefined)return String(value);
  return null;
}
function matchesModuleFilters(row:Record<string,unknown>,filters:Record<string,string>){
  for(const [rawKey,wantedRaw] of Object.entries(filters)){
    const wanted=String(wantedRaw??'').trim();if(!wanted||['search','displayState','scheduleCondition'].includes(rawKey))continue;
    const actual=rowFilterValue(row,rawKey);if(actual===null)continue;
    if(!actual.toLowerCase().includes(wanted.toLowerCase()))return false;
  }
  const condition=filters.scheduleCondition;
  if(condition){
    const float=Number(rowFilterValue(row,'totalFloatHours')),status=String(row.status??''),delayed=row.scheduleDelayed===true,missed=row.missedPlannedStart===true,overdue=row.finishOverdue===true;
    if(condition==='negative_float'&&!(Number.isFinite(float)&&float<0))return false;
    if(condition==='zero_float'&&float!==0)return false;
    if(condition==='delayed'&&!delayed)return false;
    if(condition==='missed_start'&&!missed)return false;
    if(condition==='overdue_finish'&&!overdue)return false;
    if(condition==='float_risk'&&row.floatRiskWatchlist!==true)return false;
    if(condition==='open_logic'&&!(row.openStart===true||row.openFinish===true||row.isolated===true))return false;
    if(condition==='not_started'&&!/not.?started/i.test(status))return false;
  }
  const q=filters.search?.trim().toLowerCase();if(q&&!JSON.stringify(row).toLowerCase().includes(q))return false;
  return true;
}
function applyModuleFilters(value:unknown,filters:Record<string,string>,depth=0):unknown{
  if(depth>8||value===null||value===undefined||typeof value!=='object')return value;
  if(Array.isArray(value)){
    const objects=value.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)) as Record<string,unknown>[];
    const recognized=objects.some(row=>Object.keys(filters).some(key=>rowFilterValue(row,key)!==null)||!!filters.scheduleCondition||!!filters.search);
    const rows=recognized?value.filter(v=>!v||typeof v!=='object'||Array.isArray(v)||matchesModuleFilters(v as Record<string,unknown>,filters)):value;
    return rows.map(v=>applyModuleFilters(v,filters,depth+1));
  }
  return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,applyModuleFilters(v,filters,depth+1)]));
}
export function preparedModuleResult(result:ModuleRuntimeResult,view?:ModuleReportView):ModuleRuntimeResult{
  if(!view?.filters||!Object.values(view.filters).some(Boolean))return result;
  return {...result,data:applyModuleFilters(result.data,view.filters) as any};
}
function analysisColumns(rows:Record<string,FlatValue>[]):Column[]{
  const keys:string[]=[];const seen=new Set<string>();for(const row of rows)for(const key of Object.keys(row))if(!seen.has(key)){seen.add(key);keys.push(key);}
  return keys.map(key=>{const values=rows.map(r=>r[key]).filter(v=>v!==null),sample=values[0];const type:Column['type']=typeof sample==='number'?'number':typeof sample==='boolean'?'boolean':typeof sample==='string'&&/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(sample)?'date':'text';
    return {key,label:key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._-]+/g,' ').replace(/^./,x=>x.toUpperCase()),type,unit:null,aggregate:'none',dimension:type==='text'};});
}
function reportEvidenceState(value:unknown,fallback:EvidenceState):EvidenceState{
  const state=String(value??'').toLowerCase();
  if(['established','available','ready','verified','governed','source','official','complete','calculated'].includes(state))return 'established';
  if(['candidate','working','extracted_candidate'].includes(state))return 'candidate';
  if(['conflicting','conflicted'].includes(state))return 'conflicting';
  if(state==='stale')return 'stale';
  if(state==='scenario')return 'scenario';
  if(['missing','blocked','unavailable','not_established'].includes(state))return 'unavailable';
  return state?'partial':fallback;
}
function canonicalFactSemantics(data:Record<string,unknown>,path:string):any{
  const parts=path.split('.');if(parts.length<2)return null;
  parts.pop();
  let parent:any=data;
  for(const part of parts){if(!parent||typeof parent!=='object')return null;parent=parent[part];}
  if(!parent||typeof parent!=='object'||Array.isArray(parent))return null;
  const allowed=new Set(['source','submitted','calculated','adjusted','official','scenario']);
  const declaredAuthority=typeof parent.authority==='string'&&allowed.has(parent.authority)?parent.authority:null;
  const inferredAuthority=/official/i.test(path)?'official':/source|submitted/i.test(path)?'submitted':null;
  const authority=declaredAuthority??inferredAuthority??'calculated';
  const unit=typeof parent.unit==='string'?parent.unit:typeof parent.currency==='string'?parent.currency:null;
  const state=typeof parent.state==='string'?parent.state:null;
  const qualification=typeof parent.basis==='string'?parent.basis:typeof parent.qualification==='string'?parent.qualification:typeof parent.reason==='string'?parent.reason:null;
  if(!declaredAuthority&&!inferredAuthority&&unit===null&&state===null&&qualification===null)return null;
  const reporting=(data as any)?.reportingContract??{};
  return {populationId:null,denominator:null,excludedCount:0,exclusionsRef:null,dataDateIso:reporting.dataDateIso??(data as any)?.dataDateIso??null,
    authority,dateBasis:qualification??'Metric-specific canonical module basis.',unit,state,qualification};
}
function reportMetricContract(data:Record<string,unknown>,path:string):any{
  const reporting=(data as any)?.reportingContract??{},contracts=reporting.metricContracts??{};
  if(contracts[path])return contracts[path];
  const wildcard=path.replace(/\[\d+\]/g,'[*]').replace(/\.\d+(?=\.|$)/g,'[*]');
  return contracts[wildcard]??canonicalFactSemantics(data,path);
}
function reportMetricBasis(contract:any){
  if(!contract)return 'Same canonical module result used by the live page.';
  const parts=[
    contract.qualification||contract.dateBasis||'Canonical module fact',
    contract.populationId?(contract.denominator===null?'Population retained':'Population '+String(contract.denominator)+(contract.excludedCount?' · excluded '+String(contract.excludedCount):'')):'Population not separately established',
    contract.dataDateIso?'Data Date '+String(contract.dataDateIso).slice(0,10):'Data Date not established',
    'Authority '+String(contract.authority??'calculated')
  ];
  return parts.join(' · ');
}
function moduleAnalysis(projectId:string,moduleKey:string,result:ModuleRuntimeResult,view?:ModuleReportView):AnalysisResult{
  const data=result.data&&typeof result.data==='object'?result.data as Record<string,unknown>:{},arrays=collectArrays(data);
  const dataDate=(data as any)?.reportingContract?.dataDateIso??(data as any)?.dataDateIso??null;
  const authorityState=result.status==='ready'?'established':result.status==='partial'?'partial':'unavailable';
  const sections:AuthorityResult[]=[];
  const flat=flattenRecord(data),metricRows=Object.entries(flat).filter(([key,v])=>!key.startsWith('reportingContract.')&&(v===null||['string','number','boolean'].includes(typeof v))).slice(0,1000);
  const metricTraces=metricRows.map(([key])=>{
    const contract=reportMetricContract(data,key),state=reportEvidenceState(contract?.state,authorityState);
    return {id:'module:metric:'+key,authorityId:'summary',projectId,module:moduleKey,path:key,sourceRefs:[],dataDate:contract?.dataDateIso??dataDate,basis:reportMetricBasis(contract),exclusions:contract?.excludedCount?['Reporting population excludes '+String(contract.excludedCount)+' record(s); see '+String(contract.exclusionsRef??'the reporting contract')+'.']:[],state};
  });
  sections.push({authorityId:'summary',title:titleForModule(moduleKey)+' · Key facts',state:authorityState,explanation:result.reason??'Current CMeng module position.',
    metrics:metricRows.map(([key,value],i)=>{const contract=reportMetricContract(data,key),state=reportEvidenceState(contract?.state,authorityState);return {id:'module.'+key,label:key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._-]+/g,' '),value:value as Cell,unit:contract?.unit??null,state,classification:['source','submitted','official'].includes(String(contract?.authority))?'project_fact':'calculated_intelligence',traceId:'module:metric:'+key,basis:reportMetricBasis(contract)};}),
    tables:[],charts:[],findings:[],traces:[{id:'module:summary',authorityId:'summary',projectId,module:moduleKey,path:'data',sourceRefs:[],dataDate,basis:'Canonical ModuleRuntimeResult; presentation does not recalculate Project facts.',exclusions:[],state:authorityState},...metricTraces]});
  arrays.forEach((section,index)=>{const flatRows=section.rows.map(row=>row&&typeof row==='object'&&!Array.isArray(row)?flattenRecord(row):{value:primitiveValue(row)}),columns=analysisColumns(flatRows),tableId='module-table-'+index;
    const category=columns.find(column=>column.dimension),numeric=columns.filter(column=>column.type==='number'&&flatRows.some(row=>typeof row[column.key]==='number')).slice(0,3);
    const charts:AnalysisChart[]=category&&numeric.length&&flatRows.length?[{id:'module-chart-'+index,title:section.path.replace(/[._-]+/g,' '),type:category.type==='date'?'line':'bar',tableId,category:category.key,series:numeric.map(column=>column.key),unit:'value',basis:'Chart of the same retained '+section.path+' table rows; no independent report calculation.',population:flatRows.length,dataDate}]:[];
    sections.push({authorityId:'table-'+index,title:section.path.replace(/[._-]+/g,' '),state:authorityState,explanation:'Same retained module population at '+section.path+'.',metrics:[],tables:[{id:tableId,title:section.path,authorityId:'table-'+index,columns,rows:flatRows as Record<string,Cell>[],population:flatRows.length,excluded:0,state:authorityState,basis:'Canonical module array '+section.path+' after the saved/current scope definition is applied.',traceId:'module:table:'+index}],charts,findings:[],traces:[{id:'module:table:'+index,authorityId:'table-'+index,projectId,module:moduleKey,path:section.path,sourceRefs:[],dataDate,basis:'Canonical module population; no independent export calculation.',exclusions:[],state:authorityState}]});
  });
  const projectVersion=Number((data as any)?.projectVersion??(data as any)?.reportingContract?.projectVersion??0),programmeRevision=(data as any)?.programmeRevisionId??(data as any)?.reportingContract?.programmeRevisionId??null;
  const snapshotHash=createHash('sha256').update(JSON.stringify({projectId,moduleKey,projectVersion,dataDate,data})).digest('hex');
  const detail=(view?.detailLevel&&['short','normal','detailed'].includes(view.detailLevel)?view.detailLevel:'normal') as 'short'|'normal'|'detailed';
  return {schemaVersion:1,id:'module-'+snapshotHash.slice(0,24),conversationId:'module-report',createdAt:new Date().toISOString(),
    scope:{scopeType:'project',projectId,projectName:projectId,workspaceId:'cmeng-projects',userId:'module-report',projectVersion,dataDate,authorityState:result.status,programmeRevision,pageContext:view?.filters?{projectId,page:moduleKey,filters:view.filters,selectedActivity:null,selectedWbs:view.filters.wbsId??null,selectedLocation:view.filters.zone??view.filters.location??null,selectedPackage:view.filters.package??null}:null},
    plan:{objective:titleForModule(moduleKey),kind:'report',authorities:sections.map(s=>s.authorityId),filters:[],groupBy:view?.grouping??[],rankBy:view?.sort?.field??null,rankDirection:view?.sort?.direction??'desc',limit:view?.topN??null,metricIds:[],issuesOnly:false,criticalOnly:false,nextDays:null,deliveryBelowPercent:null,asOf:null,scenario:null,attachmentIds:[]},
    presentation:{title:view?.title??titleForModule(moduleKey),audience:'project',language:'en',detail,charts:true,preparedBy:null,jobTitle:null,company:null,reportNumber:null,confidentiality:'Project information',status:'Draft / Prepared',format:'interactive'},
    mode:'Deterministic CMeng Summary',sections,narrative:[{heading:'Current position',text:result.reason??'Current CMeng module position.',classification:'calculated_intelligence',traceIds:['module:summary']}],unresolved:[],referenceFiles:[],snapshotHash,factsHash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),providerStatus:'not_needed'};
}
export async function exportModuleReport(projectId:string,moduleKey:string,result:ModuleRuntimeResult,format:string,view?:ModuleReportView){
  const prepared=preparedModuleResult(result,view);
  if(!view&&format==='xlsx')return {bytes:await buildModuleWorkbook(projectId,moduleKey,prepared),type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename:moduleReportFilename(projectId,moduleKey,'xlsx')};
  if(!view&&format==='json')return {bytes:buildModuleJsonDownload(projectId,moduleKey,prepared),type:'application/json; charset=utf-8',filename:moduleReportFilename(projectId,moduleKey,'json')};
  const analysis=moduleAnalysis(projectId,moduleKey,prepared,view),exported=await exportAskAnalysis(analysis,format,view);
  return {...exported,filename:safeFilenamePart(projectId)+'_'+safeFilenamePart(titleForModule(moduleKey))+'_'+new Date().toISOString().slice(0,10)+'.'+exported.filename.split('.').at(-1)};
}
