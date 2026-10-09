"""Independent certificate arithmetic and Delivery readiness truth tables.
Inputs/expectations are frozen before CMeng; no product imports or outputs.
"""
import decimal, hashlib, json, pathlib, random, secrets, sys
D=decimal.Decimal
def main():
 out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
 if (out/'reference.json').exists():raise SystemExit('Frozen reference exists.')
 seed=secrets.token_hex(20);r=random.Random(seed);ledger=[];delivery=[]
 for i in range(120):
  gross=D(r.randint(10000,10000000))/100;vo=D(r.randint(0,100000))/100
  ret=(gross*D('.05')).quantize(D('.01'));advance=(gross*D('.1')).quantize(D('.01'));other=D(r.randint(0,10000))/100
  net=gross+vo-ret-advance-other;paid=(net*D(str(r.choice([0,.2,.6,1])))).quantize(D('.01'))
  scenario=['complete','zero_paid','missing_paid','future_receipt','currency_mismatch','unposted_receipt','candidate','missing_deduction','wrong_net','undated_receipt','allocation_unknown','complete'][i%12]
  if scenario=='zero_paid':paid=D(0)
  source_net=net+D(17) if scenario=='wrong_net' else net
  valid_outstanding=scenario in ('complete','zero_paid','missing_deduction','wrong_net')
  expected_outstanding=float(source_net-paid) if valid_outstanding else None
  ledger.append({'id':f'LEDGER-{seed[:10]}-{i:03}','projectId':f'LEDGER-{seed[:10]}-P{i//12:02}','currency':r.choice(['AED','SAR','USD']),
    'scenario':scenario,'values':{'grossWork':float(gross),'variations':float(vo),'retentionDeduction':float(ret),'advanceRecovery':float(advance),
      'otherDeduction':None if scenario=='missing_deduction' else float(other),'taxAmount':0,'netCertifiedAmount':float(source_net),
      'paidAmount':None if scenario=='missing_paid' else float(paid)},
    'expected':{'reconciliation':'unresolved' if scenario=='missing_deduction' else 'conflicted' if scenario=='wrong_net' else 'matched',
      'calculatedOutstandingAmount':expected_outstanding,'fullComponentNet':None if scenario=='missing_deduction' else float(net)}})
 for i in range(120):
  scenario=['ready','blocked','at_risk','future','not_applicable','unconfirmed','unknown_applicability','mixed_ready'][i%8]
  count=r.randint(2,6);gates=[{'applicable':'yes','outcome':'ready','outcomeDate':'2026-08-31','satisfiedDate':None} for _ in range(count)]
  expected={'state':'ready','applicableCount':count,'readinessPercent':100};confirm=True
  if scenario=='blocked':gates[0]['outcome']='blocked';expected={'state':'blocked','applicableCount':count,'readinessPercent':round((count-1)/count*100,6)}
  if scenario=='at_risk':gates[0]['outcome']='at risk';expected={'state':'at_risk','applicableCount':count,'readinessPercent':round((count-1)/count*100,6)}
  if scenario=='future':gates[0]['outcomeDate']='2026-09-01';gates[0]['satisfiedDate']='2026-09-01';expected={'state':'unknown','applicableCount':None,'readinessPercent':None}
  if scenario=='not_applicable':
   for g in gates:g['applicable']='no'
   expected={'state':'not_applicable','applicableCount':0,'readinessPercent':None}
  if scenario=='unconfirmed':confirm=False;expected={'state':'unknown','applicableCount':None,'readinessPercent':None}
  if scenario=='unknown_applicability':gates[0]['applicable']='';expected={'state':'unknown','applicableCount':None,'readinessPercent':None}
  if scenario=='mixed_ready':gates[0]['applicable']='no';expected={'state':'ready','applicableCount':count-1,'readinessPercent':100}
  delivery.append({'id':f'DELIVERY-{seed[:10]}-{i:03}','projectId':f'DELIVERY-{seed[:10]}-P{i//12:02}','scenario':scenario,'gates':gates,'confirmPopulation':confirm,'expected':expected})
 content=json.dumps({'seed':seed,'classification':'Internal independent arithmetic/state reference; not professional approval or consultant acceptance',
  'ledger':ledger,'delivery':delivery,'limits':['Certificate reconciliation, not full project cash-flow aggregation','Readiness gates, not every Delivery lifecycle operation']},indent=2)+'\n'
 (out/'reference.json').write_text(content);(out/'reference.sha256').write_text(hashlib.sha256(content.encode()).hexdigest()+'\n')
 print(json.dumps({'ledger':len(ledger),'delivery':len(delivery),'sha256':hashlib.sha256(content.encode()).hexdigest()}))
if __name__=='__main__':main()
