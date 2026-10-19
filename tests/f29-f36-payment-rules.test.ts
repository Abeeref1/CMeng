import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore,runtimeProjects} from '../packages/runtime-api/src/project-state';
import {commercialPositionForState} from '../packages/runtime-api/src/commercial-runtime';
import {commercialCanonical} from '../packages/runtime-api/src/commercial-canonical';
import {moduleForProject} from '../packages/runtime-api/src/project-projections';
import {paymentDueBasisLabel} from '../packages/runtime-api/src/commercial-sum-basis';
process.env.CMENG_OCR_ENABLED='0';

// F29 late-payment test and F36 payment rules, reproduced from the consultant's
// REEM case (Data Date 31 Aug 2026, QAR). No REEM file is in the repository, so
// the register is rebuilt with the consultant's totals:
//   gross certified to IPC-023 = gross work 184,258,538 + variations 11,776,000 = 196,034,538
//   retention 9,801,728 + advance recovery 19,603,452 -> net certified 166,629,358
//   advance 10% of the Accepted Contract Amount 210,000,000 = 21,000,000; outstanding 1,396,548
//   IPC-024 is only "Applied" (no certificate date): excluded from every certified total.
//   21 paid IPCs: certificate date + the 45-day contract payment period gives the due date;
//   11 paid late by 5..25 days, 10 on time. IPC-022 and IPC-023 are certified, not paid.
//   IPC-007 and IPC-015 carry a 1-riyal rounding between the stated net and the sum of lines.
const DATA_DATE='2026-08-31';
const iso=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const addDays=(date:string,days:number)=>iso(Date.parse(date+'T00:00:00Z')+days*86400000);
const monthEnd=(index:number)=>iso(Date.UTC(2024,8+index+1,0)); // index 0 -> 2024-09-30
const LATE=new Map([[2,5],[4,7],[6,9],[8,11],[10,13],[12,15],[14,17],[16,19],[18,21],[20,23],[21,25]]);
interface Row {no:string;type:string;periodEnd:string;certificateDate:string;paymentDate:string;dueDate:string;gross:number;variations:number;retention:number;advance:number;net:number;paid:number|null;status:string}
function rows():Row[]{
 const out:Row[]=[];
 for(let i=1;i<=23;i++){
  const gross=i===23?8_258_538:8_000_000,variations=i<=4?0:i===23?2_776_000:500_000;
  const retention=i<=4?400_000:i===23?551_728:i===7?425_001:i===15?424_999:425_000;
  const advance=i<=4?800_000:i===23?1_103_452:850_000;
  const net=i<=4?6_800_000:i===23?9_379_358:7_225_000;
  const periodEnd=monthEnd(i-1),certificateDate=addDays(periodEnd,10),due=addDays(certificateDate,45);
  const paidRow=i<=21,paymentDate=paidRow?addDays(due,LATE.get(i)??-2):'';
  out.push({no:'IPC-'+String(i).padStart(3,'0'),type:'Interim',periodEnd,certificateDate,paymentDate,dueDate:due,gross,variations,retention,advance,net,paid:paidRow?net:null,status:paidRow?'Paid':'Certified'});
 }
 out.push({no:'IPC-024',type:'Interim',periodEnd:monthEnd(23),certificateDate:'',paymentDate:'',dueDate:'',gross:2_948_260,variations:0,retention:147_413,advance:294_789,net:2_506_058,paid:null,status:'Applied'});
 return out;
}
function register(withDueDates=false){
 const head=['Certificate No','Payment Type','Period End','Certificate Date',...(withDueDates?['Payment Due Date']:[]),'Payment Date','Gross Work','Variations','Retention','Advance Recovery','Other Deductions','Net Certified','Paid Amount','Currency','VAT Basis','Status','Certified Amount Basis','Paid Amount Basis'];
 const body=rows().map(r=>[r.no,r.type,r.periodEnd,r.certificateDate,...(withDueDates?[r.dueDate]:[]),r.paymentDate,r.gross,r.variations,r.retention,r.advance,0,r.net,r.paid??'','QAR','Exclusive',r.status,'Incremental','Incremental'].join(','));
 const advance=['AP-001','Advance payment','2024-08-31','2024-09-05',...(withDueDates?['2024-10-20']:[]),'2024-09-20',21_000_000,0,0,0,0,21_000_000,21_000_000,'QAR','Exclusive','Paid','Incremental','Incremental'].join(',');
 return [head.join(','),advance,...body].join('\n')+'\n';
}
const XER_CAL='(0||CalendarData()((0||DaysOfWeek()('+Array.from({length:7},(_,i)=>'(0||'+(i+1)+'()('+(i<5?'(0||0(s|07:00|f|16:00)())':'')+'))').join('')+'))(0||Exceptions()())))';
const xer=['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date','%R\t1\tVLC\t'+DATA_DATE+' 07:00',
 '%T\tCALENDAR','%F\tclndr_id\tclndr_name\tday_hr_cnt\tclndr_data','%R\t1\tSun-Thu\t9\t'+XER_CAL,
 '%T\tTASK','%F\ttask_id\tproj_id\tclndr_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt\ttotal_float_hr_cnt',
 '%R\t1\t1\t1\tVLC-10-428\tPlaster Plot B43\tTK_NotStart\t2026-09-13 07:00\t2026-09-17 16:00\t45\t45\t-88','%E'].join('\n');
async function contractPdf(lines:string[]){
 const {PDFDocument,StandardFonts}=await import('pdf-lib');
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage([595,842]);
 page.drawText(lines.join('\n'),{x:45,y:790,size:10,font,lineHeight:22,maxWidth:505});
 return new Uint8Array(await pdf.save());
}
const CONTRACT=[
 'CONSTRUCTION CONTRACT','1 Contract Particulars','Contract currency is QAR.','Accepted Contract Amount: QAR 210000000.','Contractual completion date: 2027-09-08.',
 'Sub-Clause 14.2 Advance Payment','The amount of the advance payment is 10% of the Accepted Contract Amount.',
 'Sub-Clause 14.7 Payment','Payment of each interim amount shall be made within 45 days after the Engineer receives the Statement and supporting documents.',
];
async function project(t:any,id:string,options:{dueDates?:boolean;contract?:string[]}={}){
 const dir=mkdtempSync(join(tmpdir(),'f36-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=new RuntimeProjectStore({dataDir:dir,durable:false});const state=store.getOrCreate(id);
 const stamp=DATA_DATE+'T12:00:00Z';
 await store.ingestEvidenceFile({projectId:id,bytes:Buffer.from(xer),mediaType:'text/plain',sourceFilename:'P8 Update02.xer',uploadedAt:stamp,uploadIntent:'replace_current_basis',scheduleRole:'update'});
 await store.ingestContract({projectId:id,bytes:await contractPdf(options.contract??CONTRACT),mediaType:'application/pdf',sourceFilename:'Main_Contract.pdf',role:'main',uploadedAt:stamp});
 await store.ingestEvidenceFile({projectId:id,bytes:Buffer.from(register(options.dueDates)),mediaType:'text/csv',sourceFilename:'IPC_Register.csv',category:'boq_cost',documentType:'payment_certificates',uploadedAt:stamp});
 runtimeProjects.replace(state);
 return state;
}
const pos=(state:any)=>commercialPositionForState(state) as any;
const qar=(state:any)=>pos(state).currencies.find((c:any)=>c.currency==='QAR')!;

test('F36 gross and net certified are separate, the application IPC-024 is excluded and the advance outstanding is advance less recoveries',async t=>{
 const state=await project(t,'F36-PAYMENT-RULES');
 const ledger=commercialCanonical(state);
 assert.equal(ledger.payments.length,24,'23 certificates and one application');
 assert.equal(ledger.advancePayments?.length,1,'the advance payment is kept apart from interim certificates');
 const position=qar(state);
 assert.equal(position.grossCertifiedAmount.value,196_034_538,'gross = gross work + variations of the 23 certified IPCs');
 assert.equal(position.netCertifiedAmount.value,166_629_358,'net = after retention and advance recovery');
 assert.notEqual(position.grossCertifiedAmount.value,position.netCertifiedAmount.value);
 assert.equal(position.interimCertificateCount.value,23,'IPC-024 is an application, not a certificate');
 assert.equal(position.retentionDeductedAmount.value,9_801_728,'IPC-024 retention (147,413) is not in the certified deductions');
 assert.equal(position.advanceBalance.value,1_396_548,'21,000,000 advance less 19,603,452 recovered to IPC-023');
 assert.ok(position.advanceBalance.diagnostics.includes('ADVANCE_BALANCE_FROM_CONTRACT_ADVANCE_PERCENT_LESS_CERTIFIED_RECOVERIES'));
 const checks=(moduleForProject('F36-PAYMENT-RULES','payments').data as any).decisionAnalysis.paymentChecks;
 const ipc24=checks.rows.find((r:any)=>r.certificateReference==='IPC-024');
 assert.equal(ipc24.state,'application_not_certified');assert.equal(ipc24.includedInCertifiedTotals,false);
 assert.equal(checks.appliedExcludedCount,1);
});

test('F36 a 1-riyal rounding between the stated net and the sum of the lines is not an arithmetic failure',async t=>{
 const state=await project(t,'F36-ROUNDING');
 const ledger=commercialCanonical(state);
 for(const id of ['IPC-007','IPC-015']){
  const row=ledger.payments.find(p=>p.paymentId===id)!;
  assert.equal(Math.abs(row.componentArithmetic!.difference!),1,id+' differs by one riyal');
  assert.equal(row.componentArithmetic!.state,'matched',id+' rounding within the certificate\'s whole-riyal precision');
  assert.equal(row.reconciliation,'matched');
  assert.ok(!row.diagnostics.includes('CERTIFICATE_NET_COMPONENTS_CONFLICT'));
 }
 const group=pos(state).certificateProfile.groups.find((g:any)=>g.currency==='QAR')!;
 assert.equal(group.arithmetic.matched,group.arithmetic.total,'every current row balances: '+JSON.stringify(group.arithmetic));
});

test('F29 the late-payment test counts paid late and on time from certificate dates and the contract payment period: 11 of 21 late',async t=>{
 const state=await project(t,'F29-LATE-PAYMENT');
 const register=pos(state).foundation.paymentRegister;
 assert.equal(pos(state).foundation.commercialTerms.paymentPeriodDays.value,45,'Sub-Clause 14.7 period read from the contract');
 assert.equal(register.slaAssessmentState,'established');
 assert.deepEqual({onTime:register.slaCounts.paidOnTime,late:register.slaCounts.paidLate,overdue:register.slaCounts.overdueUnpaid,open:register.slaCounts.openUnpaid},
  {onTime:10,late:11,overdue:1,open:1},'21 paid IPCs: 11 late, 10 on time; IPC-022 overdue, IPC-023 not yet due');
 assert.deepEqual(register.latePaymentDays,{min:5,max:25});
 const byId=new Map(register.rows.map((r:any)=>[r.paymentId,r]));
 for(const r of rows().filter(r=>r.paid!==null)){
  const row:any=byId.get(r.no);
  assert.equal(row.lifecycle.paymentDueDate.value.slice(0,10),r.dueDate,r.no+' due = certificate date + 45 days');
  assert.equal(row.lifecycle.paymentDueDate.basis.method,'certification_date_plus_contract_payment_period');
  assert.equal(row.lifecycle.slaState,LATE.has(Number(r.no.slice(4)))?'late':'on_time',r.no);
 }
 assert.equal(byId.has('IPC-024')&&(byId.get('IPC-024') as any).lifecycle.slaState,'not_established','the application has no certificate date and is not in the late-payment population');
 const checks=(moduleForProject('F29-LATE-PAYMENT','payments').data as any).decisionAnalysis.paymentChecks;
 assert.equal(checks.lateCount,11);
 assert.equal(checks.rows.filter((r:any)=>r.state==='paid_within_period').length,10);
 assert.deepEqual(checks.rows.filter((r:any)=>r.state==='paid_late').map((r:any)=>r.daysLate).sort((a:number,b:number)=>a-b),[5,7,9,11,13,15,17,19,21,23,25]);
});

test('F36 the due date is shown with its basis, beside the contract Sub-Clause 14.7 period, and a register due date is compared with it',async t=>{
 const state=await project(t,'F36-DUE-BASIS');
 const row:any=pos(state).foundation.paymentRegister.rows.find((r:any)=>r.paymentId==='IPC-001');
 assert.match(paymentDueBasisLabel(row.lifecycle.paymentDueDate,row.lifecycle.certificationDate),/^Certificate date 2024-10-10 \+ 45-day contract payment period/);
 const checks=(moduleForProject('F36-DUE-BASIS','payments').data as any).decisionAnalysis.paymentChecks;
 const first=checks.rows.find((r:any)=>r.certificateReference==='IPC-001');
 assert.equal(first.paymentPeriodDays,45);assert.equal(first.contractDueDateIso,'2024-11-24');
 assert.match(first.basis,/certification date plus contract payment period/);
 // A register that states its own due dates: both dates and the comparison are shown.
 await project(t,'F36-DUE-REGISTER',{dueDates:true});
 const statedChecks=(moduleForProject('F36-DUE-REGISTER','payments').data as any).decisionAnalysis.paymentChecks;
 const statedFirst=statedChecks.rows.find((r:any)=>r.certificateReference==='IPC-001');
 assert.equal(statedFirst.contractDueDateIso,'2024-11-24','the register due date governs the check');
 assert.equal(statedFirst.contractPeriodDueDateIso,'2024-11-24','certificate date + 45 days is shown beside it');
 assert.equal(statedFirst.dueDateCheck,'register_matches_contract_period');
 assert.equal(statedChecks.lateCount,11);
});
