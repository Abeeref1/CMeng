"""Independent exhaustive two-activity, mixed-calendar feasibility reference.
Zero lag deliberately avoids a disputed choice of relationship-lag calendar.
Every feasible pair is enumerated; no CMeng modules or calculated output used.
"""
import datetime as dt,json,hashlib,secrets,random,pathlib,bisect
import sys
if len(sys.argv)<2:raise SystemExit('Provide a new reference directory')
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
if (out/'reference.json').exists():raise SystemExit('Frozen reference already exists')
seed=sys.argv[2] if len(sys.argv)>2 else secrets.token_hex(20);rng=random.Random(seed);base=dt.datetime(2026,1,1,tzinfo=dt.timezone.utc)
def calendar(k):
 weekdays,start,end=[([0,1,2,3,4],8,16),([0,1,2,3,4,5],6,16),([0,1,2,3,4,5,6],0,24),([1,2,3,4,5],9,15)][k]
 slots=[day*24+h for day in range(45) if (base+dt.timedelta(days=day)).weekday() in weekdays for h in range(start,end)]
 weeks=[{'dayIndex':s+1,'intervals':[{'start':f'{start:02}:00','finish':f'{end:02}:00','minutes':(end-start)*60}] if (s-1)%7 in weekdays else []} for s in range(7)]
 c={'calendarId':f'C{k}','name':f'Mixed calendar {k}','semanticComplete':True,'weeklyWorkMinutes':[sum(v['minutes'] for v in w['intervals']) for w in weeks],'weeklyWorkIntervals':weeks,'exceptions':[],'standardDayHours':end-start,'standardWeekHours':(end-start)*len(weekdays),'sourceRefs':[]}
 return c,slots
# Hand check: two working hours from 14:00 to a held 18:00 completion on an 08:00-16:00 calendar.
assert sum(1 for h in range(8,16) if 14<=h<18)==2
def iso(h):return (base+dt.timedelta(hours=h)).isoformat(timespec='milliseconds').replace('+00:00','Z')
cases=[]
for i in range(120):
 indices=rng.sample(range(4),2);calendars,slots=zip(*(calendar(k) for k in indices));dur=[rng.randint(1,24),rng.randint(1,24)];anchor=24*rng.randint(4,12);kind=['FS','SS','FF','SF'][i%4]
 options=[]
 for ss,d in zip(slots,dur):options.append([(ss[j],ss[j+d-1]+1,j) for j in range(len(ss)-d+1) if ss[j]>=anchor])
 def pair(a,b):
  target=a[1 if kind[0]=='F' else 0]
  if kind[1]=='S':return (a,b) if b[0]>=target else None
  finish=max(b[1],target)
  # Completion may be held within a nonworking gap; it adds no working hours.
  # A start/finish pair is valid only if the work-hour population equals duration.
  worked=sum(1 for h in slots[1] if b[0]<=h<finish)
  return (a,(b[0],finish,b[2])) if worked==dur[1] else None
 first=options[0][0];second=next(p[1] for b in options[1] if (p:=pair(first,b)))
 early=[first,second];finish=max(p[1] for p in early)
 feasible=[p for a in options[0] if a[1]<=finish for b in options[1] if b[1]<=finish and (p:=pair(a,b)) and p[1][1]<=finish]
 assert feasible
 late=[max((p[j] for p in feasible),key=lambda p:(p[0],-p[1])) for j in range(2)]
 expected=[{'activityId':f'A{j}','earlyStartIso':iso(early[j][0]),'earlyFinishIso':iso(early[j][1]),'lateStartIso':iso(late[j][0]),'lateFinishIso':iso(late[j][1]),'totalFloatHours':late[j][2]-early[j][2],'critical':late[j][2]==early[j][2]} for j in range(2)]
 cases.append({'id':f'MIXED-{seed[:10]}-{i:03}','calendars':calendars,'calendarIds':[c['calendarId'] for c in calendars],'anchor':iso(anchor),'durations':dur,'relationships':[[0,1,kind,0]],'expected':expected,'projectFinishIso':iso(finish),'feasiblePairs':len(feasible)})
data=(json.dumps({'seed':seed,'classification':'Internal independent exhaustive reference; not consultant acceptance','scope':'Two activities; different calendars; FS/SS/FF/SF zero lag; not-started; no constraints. Logical completion can be held to a required finish event inside nonworking time if working duration is unchanged.','cases':cases},indent=2)+'\n').encode()
(out/'reference.json').write_bytes(data);(out/'reference.sha256').write_text(hashlib.sha256(data).hexdigest()+'\n');print(json.dumps({'cases':len(cases),'sha256':hashlib.sha256(data).hexdigest()}))
