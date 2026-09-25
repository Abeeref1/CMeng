"""Read-only live human acceptance capture for CMeng root-truth release."""
import json, os, time, hashlib
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ["CMENG_EXPECTED_RELEASE"]
SHARD=int(os.environ["CMENG_AUDIT_SHARD"])
OUT=Path(f"root-truth-audit-{SHARD}");OUT.mkdir(exist_ok=True)
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
("19-completion-forecast-history","forecast-history"),("20-independent-forecast","independent-forecast"),
("21-delay-events-claims","delay-claims"),("22-notices-eot-claims","notices-claims"),
("23-delay-windows","windows-analysis"),("24-eot-position","eot-assessment"),
("25-challenge-contract","challenge-contract"),("26-commercial-overview","commercial-overview"),
("27-cost-forecast","cost-forecast"),("28-variations-change","variations-change"),
("29-payments","payments"),("30-cash-flow","cash-flow"),
("31-claims-notices","commercial-claims-notices"),("32-contract-particulars-bonds","contract-particulars-bonds")]
PAGES=ALL[(SHARD-1)*8:SHARD*8]

def fp(docs):
    return hashlib.sha256(json.dumps(sorted((d["documentId"],d["sourceHashSha256"]) for d in docs)).encode()).hexdigest()

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    ctx=browser.new_context(viewport={"width":1600,"height":1200},device_scale_factor=1)
    def getj(path,timeout=90000):
        r=ctx.request.get(BASE+path,timeout=timeout)
        if r.status!=200: raise RuntimeError(f"GET {path}->{r.status}")
        return r.json()

    # Wait for the exact production release, never audit an older deployment.
    deadline=time.time()+600
    health=None
    while time.time()<deadline:
        try:
            health=getj("/health",30000)
            if health.get("release")==EXPECTED: break
        except Exception:
            pass
        time.sleep(10)
    if not health or health.get("release")!=EXPECTED:
        raise RuntimeError(f"release mismatch after wait: {health and health.get('release')} != {EXPECTED}")

    projects=getj("/api/portfolio")["projects"]
    cand=[p for p in projects if "ORBIT" in p["projectId"].upper()]
    if not cand and len(projects)==1:cand=projects
    if len(cand)!=1: raise RuntimeError(f"expected one ORBIT pilot project, got {len(cand)}")
    pid=cand[0]["projectId"]; pref="/api/projects/"+quote(pid,safe="")
    before=fp(getj(pref+"/evidence/documents")["documents"])
    mutations=[]
    def ro(route):
        if route.request.method!="GET":
            mutations.append({"method":route.request.method,"url":route.request.url});route.abort()
        else: route.continue_()
    ctx.route("**/*",ro)
    p=ctx.new_page(); errors=[]; p.on("pageerror",lambda e:errors.append(str(e)))
    ctx.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');localStorage.setItem("cmeng-module",'+json.dumps(PAGES[0][1])+');')
    p.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
    p.wait_for_function('typeof currentModuleResult!=="undefined"&&currentModuleResult',timeout=90000)

    audit={"release":EXPECTED,"projectId":pid,"shard":SHARD,"pages":[]}
    for label,key in PAGES:
        nav=p.locator(f'.nav-item[data-key="{key}"]')
        if nav.count()!=1: raise RuntimeError(f"missing nav {key}")
        nav.click(timeout=20000)
        p.wait_for_function('key=>currentModuleResult?.key===key&&document.getElementById("moduleBadge").textContent!=="Updating"',arg=key,timeout=90000)
        p.wait_for_timeout(650)
        overall=p.locator('.role-view-button[data-role-view="overall"]')
        if overall.count() and overall.first.is_visible():
            overall.first.click();p.wait_for_timeout(250)
        p.screenshot(path=str(OUT/f"{label}-viewport.jpg"),type="jpeg",quality=86,full_page=False)
        p.screenshot(path=str(OUT/f"{label}-full.jpg"),type="jpeg",quality=82,full_page=True)
        data=p.evaluate("""()=>{const r=document.getElementById('moduleContent');const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
          const result=window.currentModuleResult;
          const safeResult=(()=>{try{return JSON.parse(JSON.stringify(result))}catch(e){return null}})();
          return {
            title:clean(document.querySelector('.module-workspace-head h3')?.innerText),
            badge:clean(document.getElementById('moduleBadge')?.innerText),
            body:clean(r.innerText),
            result:safeResult,
            cards:[...r.querySelectorAll('.management-metric-card,.kpi-card,.planning-kpi,.position-card,.scalar,.planning-panel,.chart-card,.commercial-ledger,.role-lens,.currency-line,.movement-card,.domain-card')].map((e,i)=>({i,cls:e.className,text:clean(e.innerText).slice(0,4000)})).filter(x=>x.text),
            tables:[...r.querySelectorAll('table')].map((t,i)=>({i,totalRows:t.querySelectorAll('tr').length,rows:[...t.querySelectorAll('tr')].slice(0,60).map(rr=>[...rr.children].map(cc=>clean(cc.innerText)))})),
            rawIso:[...new Set((r.innerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g)||[]))],
            document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}
          }}""")
        (OUT/f"{label}.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
        audit["pages"].append({"label":label,"key":key,"title":data["title"],"badge":data["badge"],"bodyLength":len(data["body"]),"rawIso":data["rawIso"],"status":data.get("result",{}).get("status") if isinstance(data.get("result"),dict) else None})
    after=fp(getj(pref+"/evidence/documents")["documents"])
    audit.update({"sourcePreserved":before==after,"mutations":mutations,"pageErrors":errors,"releaseAfter":getj("/health").get("release")})
    (OUT/"index.json").write_text(json.dumps(audit,indent=2),encoding="utf-8")
    browser.close()
if mutations or errors or not audit["sourcePreserved"] or audit["releaseAfter"]!=EXPECTED:
    raise RuntimeError("read-only audit integrity failure")
print(json.dumps({"status":"pass","shard":SHARD,"pages":len(PAGES),"release":EXPECTED},indent=2))
