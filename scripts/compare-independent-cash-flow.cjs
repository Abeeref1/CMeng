const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {createHash}=require('node:crypto');
const {buildCommercialFoundation}=require('../dist/packages/commercial-foundation/src');
const {buildCommercialPerformance}=require('../dist/packages/commercial-performance/src');
function compare(reference){
 return reference.cases.map(c=>{
  const foundation=buildCommercialFoundation({...c.input,contractValue:null,contractValueCandidates:[],variations:[],contractTimeBasis:null,ldTerms:null,contractSections:[],amendments:[],costMetrics:[],payments:[]});
  const actual=buildCommercialPerformance({...c.input,foundation}).cashFlow,differences=[];
  const check=(field,value,expected)=>{if(typeof expected==='number'?typeof value!=='number'||!Number.isFinite(value)||Math.abs(value-expected)>0.000001:value!==expected)differences.push({field,actual:value,expected});};
  check('partitions',actual.currencies.length,c.expected.length);
  for(const e of c.expected){
   const a=actual.currencies.find(p=>p.currency===e.currency&&p.taxBasis===e.taxBasis),prefix=e.currency+'/'+e.taxBasis;
   if(!a){differences.push({field:prefix,expected:'partition present',actual:null});continue;}
   for(const name of ['paidIncome','certifiedIncome','actualExpenditure'])for(const key of ['value','state'])check(prefix+'/'+name+'/'+key,a[name][key],e[name][key]);
   for(const name of ['netCashPosition','certifiedUnpaid','peakFundingNeed'])check(prefix+'/'+name,a[name].value,e[name]);
   for(const [month,value] of Object.entries(e.monthly))check(prefix+'/monthly/'+month,a.periodMovementSeries.find(p=>p.period===month)?.actualNetCashMovement,value);
   for(const [date,value] of e.timeline)check(prefix+'/timeline/'+date,a.cumulativeActualSeries.find(p=>p.asOf===date)?.net,value);
  }
  return {id:c.id,scenario:c.scenario,pass:!differences.length,differences,actual};
 });
}
module.exports={compare};
async function main(){
 const dir=resolve(process.argv[2]),bytes=readFileSync(join(dir,'reference.json')),hash=createHash('sha256').update(bytes).digest('hex');
 if(hash!==readFileSync(join(dir,'reference.sha256'),'utf8').trim())throw Error('Frozen reference changed.');
 const reference=JSON.parse(bytes),results=compare(reference);
 // One fresh case from each scenario also checks the actual JSON/XLSX writers
 // against the frozen answers, not merely against the on-screen producer.
 const {buildModuleWorkbook,buildModuleJsonDownload}=require('../dist/packages/runtime-api/src/module-report');
 const ExcelJS=require('exceljs');let exportChecks=0;
 mkdirSync(join(dir,'exports'),{recursive:true});
 for(const [index,row] of results.slice(0,20).entries()){
  const c=reference.cases[index],module={key:'cash-flow-register',status:'partial',reason:null,data:row.actual};
  const jsonBytes=buildModuleJsonDownload(c.id,module.key,module),json=JSON.parse(jsonBytes);
  const xlsx=await buildModuleWorkbook(c.id,module.key,module),book=new ExcelJS.Workbook();await book.xlsx.load(xlsx);
  const sheet=book.getWorksheet('currencies'),headers=sheet.getRow(1).values;
  const check=(field,actual,expected)=>{exportChecks++;if(typeof expected==='number'?typeof actual!=='number'||!Number.isFinite(actual)||Math.abs(actual-expected)>0.000001:actual!==expected)row.differences.push({field,actual,expected});};
  for(const expected of c.expected){
   const exported=json.result.data.currencies.find(p=>p.currency===expected.currency&&p.taxBasis===expected.taxBasis);
   const record=sheet.getRows(2,sheet.rowCount-1).find(r=>r.getCell(headers.indexOf('currency')).value===expected.currency&&r.getCell(headers.indexOf('taxBasis')).value===expected.taxBasis);
   for(const name of ['paidIncome','certifiedIncome','actualExpenditure','netCashPosition','certifiedUnpaid','peakFundingNeed']){
    const target=typeof expected[name]==='object'&&expected[name]!==null?expected[name].value:expected[name];
    check('json/'+expected.currency+'/'+expected.taxBasis+'/'+name,exported?.[name]?.value,target);
    check('xlsx/'+expected.currency+'/'+expected.taxBasis+'/'+name,record?.getCell(headers.indexOf(name+'.value')).value,target);
   }
  }
  row.pass=!row.differences.length;
  writeFileSync(join(dir,'exports',c.id+'.json'),jsonBytes);writeFileSync(join(dir,'exports',c.id+'.xlsx'),xlsx);
 }
 const report={referenceSha256:hash,total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,exportChecks,results};
 writeFileSync(join(dir,process.argv[3]||'comparison.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,results:results.filter(r=>!r.pass).slice(0,2).map(({id,scenario,differences})=>({id,scenario,differences:differences.slice(0,12)}))}));process.exitCode=report.failed?1:0;
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
