"""Final cross-module and six-fix live verification for CMeng."""
import json, os, re, time
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ["CMENG_EXPECTED_RELEASE"]; OUT=Path("final-crosscheck");OUT.mkdir(exist_ok=True)
PAGES=[
 ("pmo","pmo-analysis"),("programme","schedule-analytics"),("activity","activity-analytics"),
 ("resources","resource-utilization"),("forecast","independent-forecast"),("delay","delay-claims"),
 ("challenge","challenge-contract"),("claims","commercial-claims-notices"),("contract","contract-particulars-bonds")]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);c=b.new_context(viewport={"width":1600,"height":1200})
 def gj(path):
  r=c.request.get(BASE+path,timeout=90000)
  if r.status!=200: raise RuntimeError(f"{path}:{r.status}")
  return r.json()
 deadline=time.time()+600
 while time.time()<deadline:
  try:
   if gj("/health").get("release")==EXPECTED:break
  except Exception:pass
  time.sleep(5)
 else:raise RuntimeError("release mismatch")
 ps=gj("/api/portfolio")["projects"]; pilots=[x for x in ps if "ORBIT" in x["projectId"].upper()]
 if len(pilots)!=1:raise RuntimeError("ORBIT pilot not unique")
 pid=pilots[0]["projectId"];p=c.new_page();c.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');')
 p.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000);p.wait_for_function('typeof currentModuleResult!=="undefined"&&currentModuleResult',timeout=90000)
 out={}
 for name,key in PAGES:
  p.locator(f'.nav-item[data-key="{key}"]').click(timeout=20000)
  p.wait_for_function('key=>currentModuleResult?.key===key&&document.getElementById("moduleBadge").textContent!=="Updating"',arg=key,timeout=90000)
  p.wait_for_timeout(350)
  out[name]=p.evaluate("""key=>{const r=currentModuleResult;const d=r?.data||{};const root=document.getElementById('moduleContent');const body=String(root?.innerText||'').replace(/\s+/g,' ').trim();const base={status:r?.status,badge:document.getElementById('moduleBadge')?.innerText.trim(),body};
    if(key==='pmo-analysis')return {...base,source:d.schedule?.sourceActivityCount,executable:d.schedule?.executableActivityCount,excluded:d.schedule?.excludedActivityCount,completed:d.progress?.completedCount,inProgress:d.progress?.inProgressCount,notStarted:d.progress?.notStartedCount,unknown:d.progress?.unknownStatusCount,assigned:d.resources?.assignedResourceCount,weeklyExceedance:d.resources?.overloadedResourceCount,movement:d.claims?.observedProgrammeMovementDays,variance:d.forecast?.varianceDays};
    if(key==='schedule-analytics'){const x=d.result||d;return {...base,source:x.population?.sourceActivityCount,executable:x.population?.executableActivityCount,excluded:x.population?.excludedActivityCount,completed:x.status?.completed,inProgress:x.status?.inProgress,notStarted:x.status?.notStarted,unknown:x.status?.unknown};}
    if(key==='activity-analytics')return {...base,source:d.population?.sourceActivityCount,executable:d.population?.executableActivityCount,excluded:d.population?.excludedActivityCount};
    if(key==='resource-utilization')return {...base,resourceCount:d.resourceCount,assigned:d.assignedResourceCount,weeklyExceedance:d.overloadedResourceCount};
    if(key==='independent-forecast')return {...base,variance:d.forecastVarianceDays};
    if(key==='delay-claims')return {...base,movement:d.observedPositiveProgrammeMovementDays};
    if(key==='commercial-claims-notices'){const bad=[...root.querySelectorAll('table th')].filter(th=>/^(Evidence|Source)$/.test(th.innerText.trim())&&!th.closest('details')).map(th=>th.innerText.trim());const drawers=[...root.querySelectorAll('details summary')].map(x=>x.innerText.trim());return {...base,badMainEvidenceHeaders:bad,drawers};}
    return base;
  }""",key)
 b.close()

checks={}
def eq(name,a,b): checks[name]={"pass":a is not None and b is not None and a==b,"left":a,"right":b}
eq("source population PMO vs Programme",out["pmo"]["source"],out["programme"]["source"])
eq("source population PMO vs Activity",out["pmo"]["source"],out["activity"]["source"])
eq("executable population PMO vs Programme",out["pmo"]["executable"],out["programme"]["executable"])
eq("executable population PMO vs Activity",out["pmo"]["executable"],out["activity"]["executable"])
eq("excluded population PMO vs Programme",out["pmo"]["excluded"],out["programme"]["excluded"])
eq("assigned resource PMO vs Resources",out["pmo"]["assigned"],out["resources"]["assigned"])
eq("weekly exceedance PMO vs Resources",out["pmo"]["weeklyExceedance"],out["resources"]["weeklyExceedance"])
eq("programme movement PMO vs Delay",out["pmo"]["movement"],out["delay"]["movement"])
eq("forecast variance PMO vs Independent Forecast",out["pmo"]["variance"],out["forecast"]["variance"])
checks["PMO execution status reconciles"]={"pass":sum([out["pmo"].get("completed") or 0,out["pmo"].get("inProgress") or 0,out["pmo"].get("notStarted") or 0,out["pmo"].get("unknown") or 0])==out["pmo"]["executable"]}
contract=out["contract"]["body"];pmo=out["pmo"]["body"];challenge=out["challenge"]["body"];claims=out["claims"]
checks["contract no false bond zero"]={"pass":not bool(re.search(r"Active bonds\s+0\b|Expired bonds\s+0\b|Expiring bonds\s+0\b",contract))}
checks["contract no false obligation zero"]={"pass":not bool(re.search(r"(?:Open obligations|Overdue obligations|Controlled obligation records)\s+0\b",contract))}
checks["retention overdue not assessable"]={"pass":"Retention overdue Not assessable" in contract and not bool(re.search(r"Retention overdue\s+0\b",contract))}
checks["PMO whole-day variance"]={"pass":"1,050 days" in pmo and "1050.333333" not in pmo}
checks["PMO weekly exceedance wording"]={"pass":"Resources with weekly exceedance" in pmo and "Overloaded 210" not in pmo}
checks["Challenge no raw ISO"]={"pass":not bool(re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}",challenge))}
checks["Claims main tables hide evidence hashes"]={"pass":len(claims["badMainEvidenceHeaders"])==0 and any("Evidence & technical trace" in x for x in claims["drawers"])}
failed=[k for k,v in checks.items() if not v["pass"]]
report={"release":EXPECTED,"projectId":pid,"checks":checks,"failed":failed,"snapshots":out}
(OUT/"crosscheck.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps({"failed":failed,"checkCount":len(checks)},indent=2))
if failed: raise RuntimeError("Final truth crosscheck failed: "+", ".join(failed))
