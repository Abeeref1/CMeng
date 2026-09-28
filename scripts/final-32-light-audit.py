"""Lightweight read-only human audit of all 32 live CMeng pages."""
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ["CMENG_EXPECTED_RELEASE"]
SHARD=int(os.environ["CMENG_AUDIT_SHARD"])
OUT=Path(f"final-32-audit-{SHARD}");OUT.mkdir(exist_ok=True)
ALL=[
("01-master-dashboard","master-dashboard"),("02-command-center","command-center"),
("03-master-control-programme","master-control-programme"),("04-management-position","pmo-analysis"),
("05-programme-review","schedule-analytics"),("06-activity-review","activity-analytics"),
("07-look-ahead","lookahead-schedule"),("08-programme-changes","schedule-change-report"),
("09-revision-history","revision-trend"),("10-milestones","milestones"),
("11-near-critical-float-risk","near-critical"),("12-resources","resource-utilization"),
("13-progress-position","progress-report"),("14-variance-trend","variance-trends"),
("15-progress-s-curve","progress-scurve"),("16-installed-quantities","quantity-scurve"),
("17-wbs-progress","progress-breakdown"),("18-man-hour-s-curve","manhour-scurve"),
("19-forecast-history","forecast-history"),("20-independent-forecast","independent-forecast"),
("21-delay-events-claims","delay-claims"),("22-notices-eot-claims","notices-claims"),
("23-delay-windows","windows-analysis"),("24-eot-position","eot-assessment"),
("25-challenge-contract","challenge-contract"),("26-commercial-overview","commercial-overview"),
("27-cost-forecast","cost-forecast"),("28-variations-change","variations-change"),
("29-payments","payments"),("30-cash-flow","cash-flow"),
("31-claims-notices","commercial-claims-notices"),("32-contract-particulars-bonds","contract-particulars-bonds")]
PAGES=ALL[(SHARD-1)*4:SHARD*4]

with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True)
  c=b.new_context(viewport={"width":1600,"height":1200},device_scale_factor=1)
  def gj(path):
    r=c.request.get(BASE+path,timeout=90000)
    if r.status!=200: raise RuntimeError(f"GET {path}: {r.status}")
    return r.json()
  deadline=time.time()+600
  while time.time()<deadline:
    try:
      if gj("/health").get("release")==EXPECTED: break
    except Exception: pass
    time.sleep(5)
  else: raise RuntimeError("expected production release not active")
  projects=gj("/api/portfolio")["projects"]
  pilots=[x for x in projects if "ORBIT" in x["projectId"].upper()]
  if len(pilots)!=1: raise RuntimeError(f"ORBIT pilot count={len(pilots)}")
  pid=pilots[0]["projectId"]
  mutations=[]
  def readonly(route):
    if route.request.method!="GET":
      mutations.append({"method":route.request.method,"url":route.request.url});route.abort()
    else: route.continue_()
  c.route("**/*",readonly)
  p=c.new_page(); errors=[];p.on("pageerror",lambda e:errors.append(str(e)))
  c.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');')
  p.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
  p.wait_for_function('typeof currentModuleResult!=="undefined"&&currentModuleResult',timeout=90000)
  results=[]
  for label,key in PAGES:
    p.locator(f'.nav-item[data-key="{key}"]').click(timeout=20000)
    p.wait_for_function('key=>currentModuleResult?.key===key&&document.getElementById("moduleBadge").textContent!=="Updating"',arg=key,timeout=90000)
    p.wait_for_timeout(350)
    p.screenshot(path=str(OUT/f"{label}-viewport.jpg"),type="jpeg",quality=82,full_page=False)
    data=p.evaluate("""()=>{const root=document.getElementById('moduleContent');const clean=s=>String(s||'').replace(/\s+/g,' ').trim();return{badge:clean(document.getElementById('moduleBadge')?.innerText),title:clean(document.querySelector('.module-workspace-head h3')?.innerText),body:clean(root.innerText),rawIso:(root.innerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g)||[])}}""")
    (OUT/f"{label}.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
    results.append({"label":label,"key":key,"badge":data["badge"],"rawIsoCount":len(data["rawIso"]),"bodyLength":len(data["body"])})
  b.close()
audit={"release":EXPECTED,"projectId":pid,"shard":SHARD,"pages":results,"mutations":mutations,"errors":errors}
(OUT/"index.json").write_text(json.dumps(audit,indent=2),encoding="utf-8")
if mutations or errors: raise RuntimeError("read-only audit integrity failure")
print(json.dumps(audit,indent=2))
