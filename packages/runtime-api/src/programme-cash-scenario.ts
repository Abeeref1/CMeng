import type {CommercialControlPosition} from '../../commercial-control/src';

/** An explicit, reversible planning assumption over the existing money facts.
 * It never writes to the certificate, receipt or actual expenditure ledgers. */
export function programmeCashScenario(position:CommercialControlPosition,dataDateIso:string|null){
 const finishIso=position.contractControls?.liquidatedDamages.scenarios.find(row=>row.forecastCompletion.value)?.forecastCompletion.value?.slice(0,10)??null;
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
 const groups=position.currencies.flatMap(currency=>{
  const current=currency.currentContractValue.value,certified=currency.grossCertifiedAmount.value;
  if(current===null||certified===null||!months.length)return [];
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
  return [{currency:currency.currency,remainingGross,retention,advanceRecovery,netReceipts:net,rows}];
 });
 return {state:groups.length?'calculated_with_stated_assumption':'missing',dataDateIso,programmeFinishIso:finishIso,retentionPercent,paymentDays,groups,
  basis:'Straight-line valuation of current contract value less dated gross certification from the day after the Data Date to the submitted programme finish. Monthly statements are assumed at period end. Remaining advance recovery is spread over the future receipts; retention uses the recorded contract rate. Receipt dates assume the recorded payment period in calendar days after each statement. This is a planning sensitivity, not a submitted cash plan.',
  exclusions:'Existing unpaid certificates, tax, retention release, financing and future expenditure are excluded. Net funding requirements need a separate expenditure forecast.'};
}
