import type {CommercialControlPosition} from '../../commercial-control/src';

/** An explicit, reversible planning assumption over the existing money facts.
 * It never writes to the certificate, receipt or actual expenditure ledgers. */
export function programmeCashScenario(position:CommercialControlPosition,dataDateIso:string|null,submittedProgrammeFinishIso:string|null=null){
 // Receipts are independent of whether LD terms exist or have sectional rates.
 // A missing sectional LD cannot erase the submitted programme finish.
 // A forward-receipts curve remains a scenario even when its only finish
 // input is an explicit LD forecast scenario; it is never an adopted date.
 const scenarioDates=[...new Set(((position.contractControls as any)?.liquidatedDamages?.scenarios??[])
  .map((item:any)=>item?.forecastCompletion?.value)
  .filter((value:unknown):value is string=>typeof value==='string'&&/^\\d{4}-\\d{2}-\\d{2}/.test(value)))];
 const scenarioFinish= !submittedProgrammeFinishIso&&scenarioDates.length===1?scenarioDates[0]:null;
 const finishIso=(submittedProgrammeFinishIso??scenarioFinish)?.slice(0,10)??null;
 const start=dataDateIso?Date.parse(dataDateIso.slice(0,10)+'T00:00:00Z')+86400000:NaN;
 const finish=finishIso?Date.parse(finishIso+'T00:00:00Z'):NaN;
 const retentionPercent=position.foundation.commercialTerms.retentionPercent.value;
 const paymentDays=position.foundation.commercialTerms.paymentPeriodDays.value;
 const months:Array<{periodEndIso:string;days:number}>=[];
 if(Number.isFinite(start)&&Number.isFinite(finish)&&finish>=start&&finish-start<=20*366*86400000){
  let cursor=start;
  while(cursor<=finish){const d=new Date(cursor),end=Math.min(finish,Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0));
   months.push({periodEndIso:new Date(end).toISOString().slice(0,10),days:(end-cursor)/86400000+1});cursor=end+86400000;}
 }
 const round=(value:number)=>Math.round(value*100)/100,totalDays=months.reduce((sum,row)=>sum+row.days,0);
 type CashRow={periodEndIso:string;grossValuation:number;netReceipt:number|null;assumedReceiptIso:string|null};
 type CashGroup={currency:string;remainingGross:number|null;retention:number|null;advanceRecovery:number|null;
   netReceipts:number|null;rows:CashRow[];certificateCount:number|null;missingInputs:string[];basis:string};
 const groups:CashGroup[]=position.currencies.flatMap((currency):CashGroup[]=>{
  const current=currency.currentContractValue.value,certified=currency.grossCertifiedAmount.value;
  if(current===null||certified===null||!months.length){
   const knownCertificates=currency.interimCertificateCount?.value??null;
   if(knownCertificates===null||knownCertificates<=0)return [];
   const missingInputs=[current===null?'Current contract value':null,certified===null?'Dated gross certification':null,!months.length?'Submitted programme finish after reporting date':null].filter((x):x is string=>!!x);
   return [{currency:currency.currency,remainingGross:null,retention:null,advanceRecovery:null,netReceipts:null,
     rows:[] as Array<{periodEndIso:string;grossValuation:number;netReceipt:number|null;assumedReceiptIso:string|null}>,
     certificateCount:knownCertificates,missingInputs,
     basis:'Receipts planning scenario withheld pending exact source inputs; '+knownCertificates+' payment certificates are recorded and retained.'}];
  }
  const remainingGross=round(Math.max(0,current-certified)),advance=currency.advanceBalance.value;
  const retention=retentionPercent===null?null:round(remainingGross*retentionPercent/100);
  const advanceRecovery=advance===null?null:Math.min(Math.max(0,advance),Math.max(0,remainingGross-(retention??0)));
  const net=retention===null||advanceRecovery===null?null:round(remainingGross-retention-advanceRecovery);
  let assignedGross=0,assignedNet=0;
  const rows=months.map((month,index)=>{
   const last=index===months.length-1,gross=last?round(remainingGross-assignedGross):round(remainingGross*month.days/totalDays);
   const netReceipt=net===null?null:last?round(net-assignedNet):round(net*month.days/totalDays);
   assignedGross+=gross;if(netReceipt!==null)assignedNet+=netReceipt;
   return {periodEndIso:month.periodEndIso,grossValuation:gross,netReceipt,
    assumedReceiptIso:paymentDays===null?null:new Date(Date.parse(month.periodEndIso+'T00:00:00Z')+paymentDays*86400000).toISOString().slice(0,10)};
  });
  return [{currency:currency.currency,remainingGross,retention,advanceRecovery,netReceipts:net,rows,
    certificateCount:currency.interimCertificateCount?.value??null,missingInputs:[] as string[],
    basis:'Straight-line source-qualified future receipts, not actual cash.'}];
 });
 return {state:groups.length&&groups.every(group=>group.rows.length>0)?'calculated_with_stated_assumption':groups.length?'incomplete_source_scenario':'missing',dataDateIso,programmeFinishIso:finishIso,retentionPercent,paymentDays,groups,
  basis:'Straight-line valuation of current contract value less dated gross certification from the day after the Data Date to the '+(submittedProgrammeFinishIso?'submitted programme finish':'explicit forecast scenario finish (not adopted)'). Monthly statements are assumed at period end. Remaining advance recovery is spread over the future receipts; retention uses the recorded contract rate. Receipt dates assume the recorded payment period in calendar days after each statement. This is a receipts-only planning scenario based on the submitted programme, not actual cash or a contractual determination.',
  exclusions:'Existing unpaid certificates, tax, retention release, financing and future expenditure are excluded. Net funding requirements need a separate expenditure forecast.'};
}
