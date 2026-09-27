import type {ControlIssue} from '../../truth-kernel/src';
import type {ProjectRuntimeState} from './project-state-types';

/** Group the underlying matter, not the page on which its consequences appear.
 * Every original finding and affected page remains in the group. Missing optional
 * domains are coverage information, not tasks created merely by uploading a XER. */
export function projectReviewGroup(issue:ControlIssue,state:ProjectRuntimeState){
  const path=[issue.sourceFactKey??'',...issue.evidencePaths,issue.summary,issue.detail].join(' ').toLowerCase().replaceAll('_',' ');
  const modules=issue.moduleKeys.join(' ');
  const docs=state.evidenceDocuments.filter(d=>['active','additive','candidate'].includes(d.basisState));
  const has=(pattern:RegExp)=>docs.some(d=>pattern.test(d.documentType+' '+d.category));
  const group=(key:string,title:string,available:boolean,note:string)=>({key,title,available,note});
  if(/board-publication/.test(issue.code))return group('report-publication','Report publication',false,'Report publication is a separate choice. It does not prevent live project analysis.');
  if(/contract.*(?:completion|finish)|contractual.*(?:date|finish)|completionauthority/.test(path))return group('contract-completion','Contractual completion date',has(/contract/),'Confirm the applicable contract completion date for contract and entitlement comparisons. Programme forecasts remain available.');
  if(/baseline|completionbases\[basis=programme\]|second (?:schedule )?revision|previous revision|two revision|revision history/.test(path))return group('programme-comparison','Baseline and revision comparisons',state.schedules.length>1,'A confirmed baseline or earlier adopted revision is needed only for the corresponding comparison. Current programme analysis remains available.');
  if((/SUBMITTED_INDEPENDENT_DIFFERENCE|CALCULATION_BASIS_REVIEW|COMPARABLE_SOURCE_CONFLICT/.test(issue.code)&&/pmo-analysis|independent-forecast|near-critical|schedule-analytics|milestones/.test(modules))||/calendarbasisreview|working.day|elapsed.day|duration basis/.test(path))return group('schedule-calculation','Programme calculation and date differences',state.schedules.length>0,'The submitted position and CMeng calculation use separate stated bases. Review the actual differences and assumptions here. A difference does not prove delay causation.');
  if(/productivity/.test(path))return group('productivity','Productivity forecast',has(/productivity/),'A productivity forecast needs quantities, rates and work-package dates. Its absence does not block the programme calendar forecast.');
  if(/quantit|allocation|boq|physical progress|installed/.test(path+' '+modules))return group('quantities','Measured quantities and programme links',has(/boq|quantity|installed/),'Quantity-based progress needs the BOQ, dated measurements and relevant activity links. Schedule progress and dates remain separate.');
  if(/resource|manhour|man.hour|labou?r|capacity/.test(path+' '+modules))return group('resources','Resource hours and capacity',has(/resource|manhour|labour|labor/),'Review demand, dated usage and capacity for the same resource and period. Missing capacity does not stop schedule calculation.');
  if(/risk/.test(path+' '+modules))return group('risks','Risk dates and assessment',has(/risk/),'Review reporting dates and the supplied risk-rating basis. Missing risk information does not change schedule calculations.');
  if(/hse|injur|safety/.test(path+' '+modules))return group('hse','HSE records and reporting dates',has(/hse|safety|incident/),'HSE measures require dated incidents and the matching exposure hours.');
  if(/quality|ncr|inspection/.test(path+' '+modules))return group('quality','Quality records and reporting dates',has(/quality|ncr|inspection/),'Quality counts require the relevant records, status and dates.');
  if(/rfi|design|permit/.test(path+' '+modules))return group('design-permits','Design and permit records',has(/rfi|design|permit/),'Readiness uses the linked design or permit record; absence of a record is not a confirmed blocker.');
  if(/claim|notice|eot|entitlement|delay.event|causal/.test(path+' '+modules))return group('claims','Claims, notices and delay-event evidence',has(/claim|notice|determination|delay/),'Causation and entitlement need dated events and activity links. Available programme dates remain usable.');
  if(/payment|cash|certificate|certified|invoice|retention/.test(path+' '+modules))return group('payments','Payments and cash records',has(/payment|cash|certificate|invoice/),'Payment and cash measures need their own dated records and amounts; they do not gate programme analysis.');
  if(/variation|commercial|cost|contract|bond|currency|insurance/.test(path+' '+modules))return group('commercial','Contract and commercial information',has(/contract|boq|cost|variation|commercial|bond/),'Review the relevant contract particulars, amounts, currency and dates together. Each unavailable measure keeps its own limitation.');
  if(/schedule|programme|critical|float|lookahead/.test(path+' '+modules))return group('programme-information','Programme inputs and comparison scope',state.schedules.length>0,'Review the specific programme fields listed below. Available activities, dates and calculations stay visible.');
  return group('source:'+ (issue.sourceFactKey??issue.code+':'+issue.evidencePaths.join('|')),issue.summary,issue.kind!=='missing_information'||issue.sourceRefs.length>0,issue.action);
}
