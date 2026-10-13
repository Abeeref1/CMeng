import {createHash} from 'node:crypto';
import {projectControlSchedule} from './canonical-time-claims';
import type {ProjectRuntimeState} from './project-state-types';

export interface RecoveryTradeInput {
 scope:string; demandBasis:'hours'|'quantity_norm'; remainingHours:number|null;
 remainingQuantity:number|null; unit:string; laborHoursPerUnit:number|null;
 crewCount:number|null; peoplePerCrew:number|null; productiveHoursPerShift:number|null;
 shiftsPerWorkingDay:number|null; availableWorkingDays:number|null;
}
export interface RecoveryScenarioDecision {
 sourceFingerprint:string; sourceRefs:string[]; fromIso:string; targetIso:string;
 reference:string; scopeCoverage:string; trades:RecoveryTradeInput[];
 savedAt:string; state:'saved'|'cleared';
}
export const recoveryQualification='User-entered planning assumptions for the named scope only. Different shifts use separate crews; productive hours exclude breaks. Each row has its own dedicated capacity. Shared crews, sequence, calendars, congestion and mobilisation are not simulated. This is not an approved manpower plan, a project finish forecast or an EOT decision.';
export function recoveryProgrammeBasis(state:ProjectRuntimeState){
 const schedule=projectControlSchedule(state);if(!schedule)return null;
 const model=schedule.revision.model;
 return {sourceFingerprint:createHash('sha256').update(JSON.stringify(['recovery-assumptions-v1',state.projectId,schedule.sourceHashSha256,schedule.revision.revisionId,model.sourceRevisionId,model.dataDateIso])).digest('hex'),
  sourceRefs:['schedule:'+schedule.revision.revisionId],sourceFilename:schedule.sourceFilename,dataDateIso:model.dataDateIso??null};
}
function requiredText(value:unknown,label:string){if(typeof value!=='string'||!value.trim())throw new Error('Enter '+label+'.');return value.trim();}
function dateInput(value:unknown,label:string){const text=requiredText(value,label);if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(Date.parse(text))||new Date(text).toISOString().slice(0,10)!==text)throw new Error('Enter a valid '+label+'.');return text;}
function numeric(value:unknown,label:string,min:number,max=Number.MAX_SAFE_INTEGER,integer=false):number|null{
 if(value===null||value===undefined||value==='')return null;
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))throw new Error(label+' is outside its valid range.');return value;
}
export function recoveryScenarioInput(state:ProjectRuntimeState,input:any):RecoveryScenarioDecision{
 const basis=recoveryProgrammeBasis(state);if(!basis)throw new Error('A current programme is required to anchor this scenario.');
 if(input.sourceFingerprint!==basis.sourceFingerprint)throw new Error('The programme changed. Reopen and review the scenario.');
 const reference=requiredText(input.reference,'the assumption or review reference');
 if(input.action==='clear')return {sourceFingerprint:basis.sourceFingerprint,sourceRefs:basis.sourceRefs,reference,scopeCoverage:'',fromIso:'',targetIso:'',trades:[],savedAt:new Date().toISOString(),state:'cleared'};
 if(input.action!=='save')throw new Error('Choose save or clear.');
 const fromIso=dateInput(input.fromIso,'scenario start date'),targetIso=dateInput(input.targetIso,'scenario target date');
 const calendarDays=(Date.parse(targetIso)-Date.parse(fromIso))/86400000;
 if(calendarDays<=0)throw new Error('The target must be later than the start. Working days count from start up to, but not including, the target.');
 const scopeCoverage=requiredText(input.scopeCoverage,'the scope covered and exclusions');
 if(!Array.isArray(input.trades)||!input.trades.length||input.trades.length>1000)throw new Error('Enter between 1 and 1,000 trade or work-front rows.');
 const scopes=new Set<string>();
 const trades:RecoveryTradeInput[]=input.trades.map((row:any)=>{
  if(!row||typeof row!=='object')throw new Error('Each scenario row needs its inputs.');
  const scope=requiredText(row.scope,'a unique trade or work-front scope'),scopeKey=scope.toLowerCase();
  if(scopes.has(scopeKey))throw new Error('Give each row a distinct scope; do not count the same labour twice.');scopes.add(scopeKey);
  if(!['hours','quantity_norm'].includes(row.demandBasis))throw new Error('Select remaining hours or quantity × labour norm.');
  const remainingHours=numeric(row.remainingHours,'Remaining hours',0),remainingQuantity=numeric(row.remainingQuantity,'Remaining quantity',0),laborHoursPerUnit=numeric(row.laborHoursPerUnit,'Labour hours per unit',Number.MIN_VALUE);
  if(row.demandBasis==='hours'&&(remainingQuantity!==null||laborHoursPerUnit!==null))throw new Error('Use one labour-demand basis per row; clear the quantity and norm when entering hours.');
  if(row.demandBasis==='quantity_norm'&&remainingHours!==null)throw new Error('Clear remaining hours when using quantity × labour norm.');
  const unit=row.demandBasis==='quantity_norm'?requiredText(row.unit,'the quantity unit'):'';
  const crewCount=numeric(row.crewCount,'Crews per shift',0,Number.MAX_SAFE_INTEGER,true),peoplePerCrew=numeric(row.peoplePerCrew,'People per crew',1,Number.MAX_SAFE_INTEGER,true);
  const productiveHoursPerShift=numeric(row.productiveHoursPerShift,'Productive hours per shift',Number.MIN_VALUE,24),shiftsPerWorkingDay=numeric(row.shiftsPerWorkingDay,'Shifts per working day',1,24,true);
  if(productiveHoursPerShift!==null&&shiftsPerWorkingDay!==null&&productiveHoursPerShift*shiftsPerWorkingDay>24)throw new Error('Productive hours across shifts cannot exceed 24 hours per working day.');
  const availableWorkingDays=numeric(row.availableWorkingDays,'Available working days',0,calendarDays);
  return {scope,demandBasis:row.demandBasis,remainingHours,remainingQuantity,unit,laborHoursPerUnit,crewCount,peoplePerCrew,productiveHoursPerShift,shiftsPerWorkingDay,availableWorkingDays};
 });
 // Reject finite inputs whose products overflow; never persist an invalid numeric result.
 for(const row of trades)calculateTrade(row);
 return {sourceFingerprint:basis.sourceFingerprint,sourceRefs:basis.sourceRefs,fromIso,targetIso,reference,scopeCoverage,trades,savedAt:new Date().toISOString(),state:'saved'};
}
function product(values:Array<number|null>):number|null {if(values.some(v=>v===null))return null;const result=(values as number[]).reduce((a,b)=>a*b,1);if(!Number.isFinite(result)||result>Number.MAX_SAFE_INTEGER||(result===0&&values.every(v=>v!==0)))throw new Error('Scenario arithmetic exceeds the supported numeric range.');return result;}
function ratio(n:number|null,d:number|null):number|null {if(n===null||d===null||d<=0)return null;const result=n/d;if(!Number.isFinite(result)||result>Number.MAX_SAFE_INTEGER||(result===0&&n!==0))throw new Error('Scenario arithmetic exceeds the supported numeric range.');return result;}
function calculateTrade(row:RecoveryTradeInput){
 const requiredLaborHours=row.demandBasis==='hours'?row.remainingHours:product([row.remainingQuantity,row.laborHoursPerUnit]);
 const peoplePerShift=product([row.crewCount,row.peoplePerCrew]),laborHoursPerWorkingDay=product([peoplePerShift,row.productiveHoursPerShift,row.shiftsPerWorkingDay]);
 const availableLaborHours=product([laborHoursPerWorkingDay,row.availableWorkingDays]);
 const requiredWorkingDays=requiredLaborHours===0?0:ratio(requiredLaborHours,laborHoursPerWorkingDay);
 const capacityGapHours=availableLaborHours!==null&&requiredLaborHours!==null?availableLaborHours-requiredLaborHours:null;
 const requiredPeoplePerShift=ratio(requiredLaborHours,product([row.availableWorkingDays,row.productiveHoursPerShift,row.shiftsPerWorkingDay]));
 const assumedProductionUnitsPerWorkingDay=row.demandBasis==='quantity_norm'?ratio(laborHoursPerWorkingDay,row.laborHoursPerUnit):null;
 const missingInputs=[...(requiredLaborHours===null?[row.demandBasis==='hours'?'remaining labour hours':'remaining quantity and labour hours per unit']:[]),...(['crewCount','peoplePerCrew','productiveHoursPerShift','shiftsPerWorkingDay','availableWorkingDays'] as const).filter(key=>row[key]===null)];
 return {scope:row.scope,requiredLaborHours,peoplePerShift,laborHoursPerWorkingDay,availableLaborHours,requiredWorkingDays,requiredPeoplePerShift:requiredPeoplePerShift===null?null:Math.ceil(requiredPeoplePerShift),assumedProductionUnitsPerWorkingDay,unit:row.unit,capacityGapHours,missingInputs,
  state:capacityGapHours===null?'inputs_incomplete':capacityGapHours<0?'conditional_shortfall':'conditional_capacity_covers_demand',
  basis:row.demandBasis==='hours'?'Entered remaining labour hours':'Entered remaining quantity × assumed labour hours per '+row.unit};
}
export function recoveryScenarioForState(state:ProjectRuntimeState){
 const saved=state.controls.recoveryScenario;
 const common={authority:'user_assumption_scenario',qualification:recoveryQualification};
 if(!saved||saved.state==='cleared')return {...common,state:'not_entered',reference:saved?.reference??null,rows:[]};
 const current=recoveryProgrammeBasis(state);
 if(!current||current.sourceFingerprint!==saved.sourceFingerprint)return {...common,state:'programme_changed',reference:saved.reference,rows:[],reason:'Saved assumptions belong to another programme basis. Review and save them again before calculating.'};
 return {...common,state:'conditional_scenario',reference:saved.reference,scopeCoverage:saved.scopeCoverage,fromIso:saved.fromIso,targetIso:saved.targetIso,sourceRefs:saved.sourceRefs,savedAt:saved.savedAt,rows:saved.trades.map(calculateTrade)};
}
