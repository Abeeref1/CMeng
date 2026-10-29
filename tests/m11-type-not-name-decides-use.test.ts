import test from 'node:test';
import assert from 'node:assert/strict';
import {isProjectControlDocument} from '../packages/runtime-api/src/project-control-source-metrics';
import {productivityDocumentKind} from '../packages/runtime-api/src/source-productivity-forecast';

// M1.1 invariant (inclusion part): a calculation uses a document because of its
// type (the content reading or the user's decision), never because of its file
// name. The same content under a neutral name is used the same way, and a
// dataset prefix cannot pull in a file the user typed as something else.

const doc=(name:string,documentType:string,category='supporting')=>({documentId:name,sourceFilename:name,sourceRelativePath:name,documentType,category,basisState:'active'}) as any;
const pairs:Array<[string,string,string]>=[
  ['SCH02_Current_Schedule_Metrics.csv','Schedule_Metrics_Week_40.csv','schedule_metric_register'],
  ['SCH01_Schedule_Control_Basis.pdf','Planning_Basis_Note.pdf','schedule_control_basis'],
  ['PDB_Project_Data_Book.xlsx','Project_Data.xlsx','project_data_book'],
];
test('M1.1: schedule control sources are used by type; the name neither adds nor removes them',()=>{
  for(const [prefixed,neutral,type] of pairs){
    for(const name of [prefixed,neutral]){
      const typed={evidenceDocuments:[doc(name,type)]} as any;
      assert.equal(isProjectControlDocument(typed,name),true,name+' typed '+type+' is used');
      const decided={evidenceDocuments:[doc(name,'supporting_document')]} as any;
      assert.equal(isProjectControlDocument(decided,name),false,name+' typed as supporting by the user is not used');
    }
  }
});
test('M1.1: productivity sources are used by type; IF01/IF02 names add nothing',()=>{
  for(const [prefixed,neutral,type,kind] of [['IF01_Productivity_Forecast_Model.csv','Crew_Rates.csv','productivity_work_package_register','work_packages'],['IF02_Independent_Forecast_Method_Basis.pdf','Method_Note.pdf','productivity_forecast_basis','basis']] as const){
    for(const name of [prefixed,neutral]){
      assert.equal(productivityDocumentKind(doc(name,type)),kind,name);
      assert.equal(productivityDocumentKind(doc(name,'supporting_document')),null,name+': the user decision stands');
    }
  }
});
test('M1.1: a productivity model is recognised from its columns, under any name; a saved type decision stands',async()=>{
  const {productivityContentKind}=await import('../packages/runtime-api/src/source-productivity-forecast');
  const headers=['Work Package','Description','Remaining Quantity','Unit','Recent Achieved Rate / Day','Productive Days'];
  assert.equal(productivityContentKind(headers),'work_packages','columns decide, not the IF01 prefix');
  assert.equal(productivityContentKind(['Item','Description','Quantity','Rate','Amount']),null,'a BOQ is not a productivity model');
});
test('M1.1: a Metric/Value table is typed by what it measures, under any file name',async()=>{
  const {identifyEvidenceDocument}=await import('../packages/runtime-api/src/document-identification');
  const schedule='Metric,Value,Unit,Source\nData Date,2026-08-31,date,S03\nBaseline Completion,2029-03-31,date,S01\nCurrent Forecast,2029-08-20,date,S03\nNegative Float,120,activities,S03\nCPLI,0.94,ratio,S03';
  const resource='Metric,Value,Unit,Source\nPeak Manpower,1450,persons,R01\nAverage Utilization,82,%,R01\nPlanned Labour Hours,120000,h,R01';
  for(const name of ['SCH02_Current_Schedule_Metrics.csv','Weekly_Figures.csv']){
    assert.equal((await identifyEvidenceDocument({bytes:Buffer.from(schedule),sourceFilename:name,sourceRelativePath:null})).identification.detectedDocumentType,'schedule_metric_register',name);
    assert.equal((await identifyEvidenceDocument({bytes:Buffer.from(resource),sourceFilename:name,sourceRelativePath:null})).identification.detectedDocumentType,'resource_register',name);
  }
});
