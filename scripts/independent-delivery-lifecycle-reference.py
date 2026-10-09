"""Fresh source files and lifecycle expectations, frozen before CMeng runs."""
import datetime as dt
import hashlib
import json
import pathlib
import random
import secrets
import sys

out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
if (out/'reference.json').exists():raise SystemExit('Frozen reference exists.')
seed=secrets.token_hex(20);r=random.Random(seed);cases=[]
cutoff=dt.date(2035,3,31)
for i in range(60):
    case_id=f'LIFECYCLE-{seed[:10].upper()}-{i:03}'
    source_dir=out/'sources'/case_id;source_dir.mkdir(parents=True)
    revisions=[];files={}
    for revision in (1,2):
        submitted=dt.date(2035,1,1)+dt.timedelta(days=r.randint(0,50))
        response=submitted+dt.timedelta(days=r.randint(0,25))
        if i%5==1 and revision==2:response=cutoff+dt.timedelta(days=r.randint(1,15))
        if i%5==2 and revision==2:response=submitted-dt.timedelta(days=r.randint(1,10))
        interval=(response-submitted).days if submitted<=response<=cutoff else None
        revisions.append(dict(reviewDays=interval,reviewCount=0 if interval is None else 1))
        files[f'Submittal-R{revision}.csv']='Submittal ID,Description,Raised Date,Actual Submission Date,Response Date,Due Date\n'+f'SUB-{i},Drawing revision {revision},2034-12-01,{submitted},{response},2035-03-30\n'
    closed=dt.date(2035,3,r.randint(10,25));verification=closed-dt.timedelta(days=1)
    if i%3==1:closed=cutoff+dt.timedelta(days=5);verification=cutoff+dt.timedelta(days=4)
    if i%3==2:verification=cutoff+dt.timedelta(days=4)
    files['Snag.csv']='Snag ID,Description,Raised Date,Due Date,Verification Date,Closed Date\n'+f'SNAG-{i},Inspection scope {r.randint(1000,9999)},2035-03-01,2035-03-20,{verification},{closed}\n'
    files['Programme.xer']='\n'.join(['ERMHDR\t23.12','%T\tPROJECT','%F\tproj_id\tproj_short_name\tlast_recalc_date',f'%R\t1\t{case_id}\t{cutoff}','%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name\tstatus_code\tearly_start_date\tearly_end_date\ttarget_drtn_hr_cnt\tremain_drtn_hr_cnt','%R\t1\t1\tA1\tInstall equipment\tTK_NotStart\t2035-04-10 08:00\t2035-04-11 16:00\t16\t16','%E'])
    hashes={}
    for name,content in files.items():
        (source_dir/name).write_text(content);hashes[name]=hashlib.sha256(content.encode()).hexdigest()
    cases.append(dict(id=case_id,reference=f'SUB-{i}',snagReference=f'SNAG-{i}',files=hashes,expected=dict(
        revisions=revisions,initialClosure='verification_required' if closed<=cutoff else 'open',
        verifiedClosure='closed' if closed<=cutoff and verification<=cutoff else 'verification_required' if closed<=cutoff else 'open',
        closedCount=1 if closed<=cutoff and verification<=cutoff else None if closed<=cutoff else 0)))
content=json.dumps(dict(seed=seed,classification='Internal independently specified lifecycle reference; not consultant acceptance',
    limits=['Submittal source revision, review timing, verified snag closure, restart, positive UI filtering and exact workbook rows; other Delivery kinds retain separate checks'],cases=cases),indent=2)+'\n'
(out/'reference.json').write_text(content);digest=hashlib.sha256(content.encode()).hexdigest();(out/'reference.sha256').write_text(digest+'\n')
print(json.dumps(dict(projects=len(cases),sourceFiles=sum(len(c['files']) for c in cases),sha256=digest)))
