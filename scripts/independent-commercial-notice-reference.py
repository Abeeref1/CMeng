"""Freeze source facts and expected arithmetic before invoking CMeng.
No CMeng imports. Decimal arithmetic and civil dates are independent references.
This is internal reference validation, not professional entitlement acceptance.
"""
import datetime as dt, decimal, hashlib, json, pathlib, random, secrets, sys
D=decimal.Decimal
def six(value):
    return None if value is None else float(value.quantize(D('.000001'),rounding=decimal.ROUND_HALF_UP))
def ratio(a,b):return None if a is None or b in (None,0) else six(a/b)
def main():
    out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
    if (out/'reference.json').exists():raise SystemExit('Frozen reference already exists.')
    seed=secrets.token_hex(20);r=random.Random(seed);evm=[];notices=[]
    assert ratio(D(450),D(600))==0.75 and ratio(D(1),D(0)) is None
    assert (dt.date(2028,3,1)-dt.date(2028,2,28)).days==2
    for i in range(120):
        values={k:D(r.randint(1,10000000))/100 for k in ['bac','pv','ev','ac','eac','etc']}
        if i%12==0:values['pv']=D(0)
        if i%12==1:values['ac']=D(0)
        if i%12==2:values['ev']=None
        state=['official','official','official','candidate','partial','conflicted','missing','official'][i%8]
        tax='unknown' if i%12==3 else 'exclusive'
        a=values
        def sub(x,y):return None if x is None or y is None else six(x-y)
        expected={'cpi':ratio(a['ev'],a['ac']),'spi':ratio(a['ev'],a['pv']),'cv':sub(a['ev'],a['ac']),'sv':sub(a['ev'],a['pv'])}
        forecast={'calculatedVac':sub(a['bac'],a['eac']),
          'tcpiBudget':ratio(None if a['ev'] is None else a['bac']-a['ev'],a['bac']-a['ac']),
          'tcpiForecast':ratio(None if a['ev'] is None else a['bac']-a['ev'],a['eac']-a['ac']),
          'bac_over_cpi':None if a['ev'] in (None,0) or a['ac']==0 else six(a['bac']*a['ac']/a['ev']),
          'ac_plus_remaining_budget':None if a['ev'] is None else six(a['ac']+a['bac']-a['ev']),
          'ac_plus_source_etc':six(a['ac']+a['etc'])}
        if state in ('missing','conflicted') or tax=='unknown':expected={k:None for k in expected}
        if state in ('missing','conflicted') or tax=='unknown':forecast={k:None for k in forecast}
        evm.append({'id':f'EVM-{seed[:10]}-{i:03}','state':state,'taxBasis':tax,'date':'2026-08-31',
          'values':{k:float(v) if v is not None else None for k,v in a.items()},'expected':expected,'forecastExpected':forecast,
          'expectedState':{'official':'established','candidate':'candidate','partial':'partial','conflicted':'conflicted','missing':'missing'}[state]})
    for i in range(120):
        event=dt.date(2028,r.randint(1,12),r.randint(1,25));awareness=event+dt.timedelta(days=r.randint(0,5));basis='awareness' if i%2 else 'event_start'
        trigger=awareness if basis=='awareness' else event
        amendment=dt.date(2028,7,1);period=14 if trigger<amendment else 21
        elapsed=r.randint(0,35);issued=trigger+dt.timedelta(days=elapsed);scenario=['complete','late','event_missing','notice_missing','undated_notice','conflicted'][i%6]
        if scenario=='late':issued=trigger+dt.timedelta(days=period+1);elapsed=period+1
        expected={'elapsedDays':elapsed,'requiredNoticeDays':period,'timeliness':'timely' if elapsed<=period else 'late'}
        if scenario=='event_missing':expected={'elapsedDays':None,'timeliness':'event_date_missing'}
        if scenario=='notice_missing':expected={'elapsedDays':None,'requiredNoticeDays':period,'timeliness':'not_issued'}
        if scenario=='undated_notice':expected={'elapsedDays':None,'requiredNoticeDays':period,'timeliness':'notice_date_missing'}
        if scenario=='conflicted':expected={'elapsedDays':None,'requiredNoticeDays':None,'timeliness':'requirement_conflicted'}
        notices.append({'id':f'NOTICE-{seed[:10]}-{i:03}','event':event.isoformat(),'awareness':awareness.isoformat(),'triggerBasis':basis,'issued':issued.isoformat(),
          'scenario':scenario,'expected':expected,'amendmentDate':amendment.isoformat()})
    content=json.dumps({'seed':seed,'method':'Python Decimal arithmetic and civil-date differences; expected authority states frozen before CMeng',
      'acceptance':'Internal generated reference checks; not independent consultant acceptance','evm':evm,'notices':notices},indent=2)+'\n'
    (out/'reference.json').write_text(content);(out/'reference.sha256').write_text(hashlib.sha256(content.encode()).hexdigest()+'\n')
    print(json.dumps({'evm':len(evm),'notices':len(notices),'sha256':hashlib.sha256(content.encode()).hexdigest()}))
if __name__=='__main__':main()
