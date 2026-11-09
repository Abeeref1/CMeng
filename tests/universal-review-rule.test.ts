import test from 'node:test';
import assert from 'node:assert/strict';
import {applyUniversalReviewRule,reviewRole,type ProjectAction} from '../packages/runtime-api/src/project-actions';

// Owner rule (3 Nov): if CMeng has a defensible answer and already uses it, the item is
// not a required question; it is shown as CMeng's answer with a control to change it.
// Missing evidence is a data gap. Only genuine decisions CMeng cannot establish stay
// required. No bulk review of thousands of records as a question.
const item=(id:string,extra:Omit<Partial<ProjectAction>,'target'>&{target?:Partial<ProjectAction['target']>}={}):ProjectAction=>({
  id,category:'confirmation',title:id,reason:extra.reason??'',recordCount:extra.recordCount??1,
  resolution:{kind:extra.resolution?.kind??'choose',requiresUserAction:true,instruction:'',completionRule:''},
  ...extra,target:{type:'inline',label:'Choose',...(extra.target??{})} as ProjectAction['target']});

const cases:Array<[string,ProjectAction,'decision'|'answer'|'gap']>=[
  ['tax basis the contract states',item('matter:tax-basis',{reason:'196 register amounts state no VAT basis. The contract states its values exclusive of VAT, so CMeng uses that basis.',target:{kind:'review-commercial-record',reviewChoice:'exclusive',reviewOptions:[{value:'exclusive',label:'Exclusive of VAT (as the contract states)'},{value:'inclusive',label:'Inclusive of VAT'}]}}),'answer'],
  ['tax basis no source states',item('matter:tax-basis',{target:{kind:'review-commercial-record',reviewChoice:null,reviewOptions:[{value:'exclusive',label:'Exclusive of VAT'},{value:'inclusive',label:'Inclusive of VAT'}]}}),'decision'],
  ['one contract value read',item('matter:contract-value',{target:{kind:'review-contract-value',reviewChoice:'value:SAR:100',reviewOptions:[{value:'value:SAR:100',label:'SAR 100'},{value:'enter_value',label:'Enter my own'}]}}),'answer'],
  ['two contract values read',item('matter:contract-value',{target:{kind:'review-contract-value',reviewChoice:null,reviewOptions:[{value:'value:SAR:100',label:'SAR 100'},{value:'value:SAR:120',label:'SAR 120'},{value:'enter_value',label:'Enter my own'}]}}),'decision'],
  ['sources disagree on a contract term',item('matter:contract-fact:ld-rate',{target:{kind:'review-contract-fact',reviewChoice:null}}),'decision'],
  ['EOT overlap proposal in use',item('matter:eot-overlap',{target:{kind:'review-eot-overlap',reviewChoice:'accept_proposal'}}),'answer'],
  ['duration basis',item('matter:calendar-basis',{target:{kind:'review-commercial-record',reviewChoice:null}}),'answer'],
  ['calendar working week not stated',item('matter:calendar-pattern:C3',{target:{kind:'review-commercial-record',reviewChoice:null}}),'decision'],
  ['HSE rates as reported',item('matter:hse-rate-basis',{target:{kind:'review-hse-rates',reviewChoice:null}}),'answer'],
  ['risk ratings as entered',item('matter:risk-rating-rule',{target:{kind:'review-risk',reviewChoice:null}}),'answer'],
  ['undated risks',item('matter:risk-status-snapshot',{target:{kind:'review-risk-snapshot',reviewChoice:null}}),'gap'],
  ['document type read from content',item('classification:D1',{reason:'Content classification differs from the stored type.',target:{kind:'review-document-classification',reviewChoice:'risk_register'}}),'answer'],
  ['document type from the file name',item('classification:D2',{reason:'The content could not establish the document type, so it was taken from the file name only.',target:{kind:'review-document-classification',reviewChoice:'wbs_dictionary'}}),'answer'],
  ['single amendment relationship',item('document:D3',{reason:'C03.pdf. Choose once; CMeng will apply the relationship.',target:{type:'document',reviewChoice:'amendment',relationshipOptions:[{value:'new_record',label:'New record'},{value:'amendment',label:'Contract amendment'}]}}),'answer'],
  ['competing candidates of one family',item('document:D4',{reason:'This source family has 2 unselected documents. Compare each source.',target:{type:'document',reviewChoice:'new_record'}}),'decision'],
  ['register counted as supplied',item('delivery-population:submittal',{recordCount:2600,resolution:{kind:'confirm',requiresUserAction:true,instruction:'',completionRule:''},target:{type:'delivery',population:true}}),'answer'],
  ['register missing dates',item('delivery-population:asset',{recordCount:12000,resolution:{kind:'upload',requiresUserAction:true,instruction:'',completionRule:''},target:{type:'upload'}}),'gap'],
  ['finish qualification needs a corrected programme',item('matter:forecast-qualifications',{category:'review',resolution:{kind:'upload',requiresUserAction:true,instruction:'',completionRule:''},target:{type:'upload'}}),'gap'],
  ['no schedule',item('schedule-missing',{target:{type:'upload'}}),'gap'],
  ['contract value no source holds',item('matter:contract-value-entry',{resolution:{kind:'confirm',requiresUserAction:true,instruction:'',completionRule:''}}),'gap'],
  ['thousands of unclear activity links',item('delivery-activity-links',{recordCount:10000,target:{type:'module'}}),'gap'],
  ['721 BOQ source pages',item('boq-page-review',{recordCount:721,target:{kind:'boq-numeric-review'}}),'gap'],
  ['locations for 9,322 activities',item('matter:location-grouping',{recordCount:9322,target:{kind:'review-locations',reviewChoice:null}}),'answer'],
  ['risk records that disagree between sources',item('matter:risks',{target:{kind:'review-risk',reviewChoice:null}}),'decision'],
  ['testing scope by name',item('matter:programme-tasks-testing',{recordCount:1368,target:{kind:'review-programme-tasks',reviewChoice:'selected_tasks'}}),'answer'],
  ['adopted record kept until decided',item('matter:payment:IPC1',{target:{kind:'review-commercial-record',reviewChoice:null,reviewOptions:[{value:'keep_adopted',label:'Keep the adopted value'},{value:'use_source:X',label:'Use X'}]}}),'answer'],
  ['procurement date basis',item('matter:procurement-date-basis',{target:{kind:'review-procurement-date',reviewChoice:null}}),'decision'],
];

for(const [name,a,role] of cases)test('Universal review rule: '+name+' is '+(role==='decision'?'a required decision':role==='answer'?'CMeng\'s answer in use':'a data gap'),()=>{
  assert.equal(reviewRole(a).role,role);
  const out=applyUniversalReviewRule([a]);
  const placed=role==='decision'?out.decisions:role==='answer'?out.answers:out.gaps;
  assert.equal(placed.length,1);
  if(role!=='decision'){
    assert.equal(placed[0]!.category,'information');assert.equal(placed[0]!.resolution?.requiresUserAction,false,'never a required question');
    if(role==='answer'){assert.ok(placed[0]!.cmengAnswer?.statement,'the answer is stated');assert.ok(!/undefined/.test(placed[0]!.cmengAnswer!.statement));}
    else assert.equal(placed[0]!.dataGap,true);
  }
});

test('Universal review rule: a full document pack keeps only genuine decisions',()=>{
  const out=applyUniversalReviewRule(cases.map(c=>c[1]));
  assert.equal(out.decisions.length,cases.filter(c=>c[2]==='decision').length);
  assert.equal(out.decisions.length+out.answers.length+out.gaps.length,cases.length,'nothing is lost');
  assert.equal(out.answers.find(a=>a.id==='matter:tax-basis')!.target.reviewChoice,'exclusive');
  assert.equal(out.answers.find(a=>a.id==='matter:calendar-basis')!.target.reviewChoice,'working_days');
});
