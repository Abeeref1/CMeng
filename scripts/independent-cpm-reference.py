"""Source-first CPM reference: difference constraints, no CMeng imports.

Bounded validation domain: acyclic networks, one shared calendar per project,
whole working-hour durations/lags, all activities not started, explicit anchor.
FS/SS/FF/SF become lower-bound inequalities on start times. Longest-path closure
solves earliest starts; reverse inequalities plus a finish bound on EVERY task
solve latest starts. Calendar dates are assigned only after solving the network.
Mixed calendars, status/actuals and source constraints need separate references.
"""
import argparse, datetime as dt, hashlib, json, pathlib, random, secrets

def solve(durations, edges, deadline=None):
    n=len(durations)
    weights=[]
    for pre,post,kind,lag in edges:
        weight=lag+(durations[pre] if kind[0]=='F' else 0)-(durations[post] if kind[1]=='F' else 0)
        weights.append((pre,post,weight))
    early=[0]*n
    for post in range(n):
        early[post]=max([0]+[early[p]+w for p,s,w in weights if s==post])
    finish=max(e+d for e,d in zip(early,durations))
    target=finish if deadline is None else deadline
    late=[target-d for d in durations]
    for pre in range(n-1,-1,-1):
        late[pre]=min([late[pre]]+[late[s]-w for p,s,w in weights if p==pre])
    assert all(early[s]>=early[p]+w for p,s,w in weights)
    assert all(late[s]>=late[p]+w for p,s,w in weights)
    assert all(late[i]+durations[i]<=target for i in range(n))
    return {'start':early,'finish':[e+d for e,d in zip(early,durations)],'lateStart':late,
            'lateFinish':[l+d for l,d in zip(late,durations)],'float':[l-e for l,e in zip(late,early)],'projectFinish':finish}

def self_check():
    assert solve([8,8],[(0,1,'FS',0)])['start']==[0,8]
    r=solve([40,8],[(0,1,'SS',0)])
    assert r['float']==[0,32] and r['lateFinish']==[40,40]
    assert solve([40,8],[(0,1,'FF',0)])['start']==[0,32]
    assert solve([8,4],[(0,1,'SF',16)])['start']==[0,12]
    assert solve([40,8],[(0,1,'SS',0)],24)['float']==[-16,16]
    assert solve([8,8,8],[(0,2,'FS',0),(1,2,'FS',0)])['float']==[0,0,0]
    # Exhaustive feasible starts independently check the closure on small cases.
    import itertools
    for d,e in [([3,1],[(0,1,'SS',0)]),([2,2],[(0,1,'FF',1)]),([2,1],[(0,1,'SF',2)]),([2,1],[(0,1,'FS',-1)])]:
        r=solve(d,e);valid=[]
        for starts in itertools.product(range(9),repeat=len(d)):
            if max(starts[i]+d[i] for i in range(len(d)))>r['projectFinish']:continue
            if all(starts[s]+(d[s] if k[1]=='F' else 0)>=starts[p]+(d[p] if k[0]=='F' else 0)+lag for p,s,k,lag in e):valid.append(starts)
        assert [max(t[i] for t in valid) for i in range(len(d))]==r['lateStart']

def calendar(index):
    if index%4==0: weekdays=list(range(7)); intervals=[(0,24)]; holidays=[];name='24-hour'
    elif index%4==1: weekdays=[0,1,2,3,4]; intervals=[(8,16)];holidays=[];name='Five-day'
    elif index%4==2: weekdays=[0,1,2,3,4];intervals=[(8,12),(13,17)];holidays=['2026-01-07'];name='Split-shift with holiday'
    else: weekdays=[0,1,2,3,4,5];intervals=[(6,16)];holidays=['2026-01-12'];name='Six-day with holiday'
    slots=[]
    for i in range(180):
        day=dt.datetime(2025,12,1,tzinfo=dt.timezone.utc)+dt.timedelta(days=i)
        if day.weekday() not in weekdays or day.date().isoformat() in holidays:continue
        for start,end in intervals:
            slots.extend(day+dt.timedelta(hours=h) for h in range(start,end))
    anchor=dt.datetime(2026,1,5,tzinfo=dt.timezone.utc)
    offset=next(i for i,t in enumerate(slots) if t>=anchor)
    def iso(index,finish=False):
        value=(slots[offset+index-1]+dt.timedelta(hours=1)) if finish else slots[offset+index]
        return value.isoformat(timespec='milliseconds').replace('+00:00','Z')
    weekly=[]
    for sunday_index in range(7):
        monday_index=(sunday_index-1)%7
        weekly.append({'dayIndex':sunday_index+1,'intervals':[{'start':f'{a:02}:00','finish':f'{b:02}:00','minutes':(b-a)*60} for a,b in intervals] if monday_index in weekdays else []})
    return {'calendarId':'C','name':name,'semanticComplete':True,'weeklyWorkMinutes':[sum(x['minutes'] for x in d['intervals']) for d in weekly],
      'weeklyWorkIntervals':weekly,'exceptions':[{'isoDate':d,'nonWorking':True,'workIntervals':[]} for d in holidays],
      'standardDayHours':sum(b-a for a,b in intervals),'standardWeekHours':sum(b-a for a,b in intervals)*len(weekdays),'sourceRefs':[]},iso

def main():
    p=argparse.ArgumentParser();p.add_argument('destination');p.add_argument('--seed');a=p.parse_args()
    out=pathlib.Path(a.destination);out.mkdir(parents=True,exist_ok=True)
    if (out/'reference.json').exists():raise SystemExit('Refuse to replace frozen source-first reference.')
    self_check();seed=a.seed or secrets.token_hex(20);rng=random.Random(seed);cases=[]
    for i in range(120):
        n=rng.randint(2,10);dur=[rng.randint(1,24) for _ in range(n)]
        edges=[(pre,post,rng.choice(['FS','SS','FF','SF']),rng.randint(-4,16)) for post in range(1,n) for pre in range(post) if rng.random()<0.3]
        first=solve(dur,edges);deadline=first['projectFinish']+rng.choice([-8,0,8]) if i%5==1 else None
        result=solve(dur,edges,deadline);cal,iso=calendar(i)
        expected=[{'activityId':f'A{j}','earlyStartIso':iso(result['start'][j]),'earlyFinishIso':iso(result['finish'][j],True),
          'lateStartIso':iso(result['lateStart'][j]),'lateFinishIso':iso(result['lateFinish'][j],True),'totalFloatHours':result['float'][j],
          'critical':result['float'][j]<=0} for j in range(len(dur))]
        cases.append({'id':f'CPM-{seed[:10]}-{i:03}','calendar':cal,'anchor':iso(0),'durations':dur,'relationships':edges,
          'requiredFinishIso':iso(deadline,True) if deadline is not None else None,'expected':expected,'projectFinishIso':iso(result['projectFinish'],True)})
    content=json.dumps({'seed':seed,'classification':'independent implementation; internal generated cases, not independent consultant acceptance',
      'method':'Difference constraints in working-time coordinates; calendar mapping independent from CMeng',
      'limitations':['one shared calendar per project','integer working hours','acyclic networks','not-started activities','no source constraints'],
      'handAndExhaustiveSelfChecks':10,'cases':cases},indent=2)+'\n'
    (out/'reference.json').write_text(content)
    (out/'reference.sha256').write_text(hashlib.sha256(content.encode()).hexdigest()+'\n')
    print(json.dumps({'cases':len(cases),'sha256':hashlib.sha256(content.encode()).hexdigest(),'seed':seed}))

if __name__=='__main__':main()
