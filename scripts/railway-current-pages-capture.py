"""Capture current live CMeng pages 1-12 for same-release human review."""
import json, os, hashlib
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ["CMENG_EXPECTED_RELEASE"]
SHARD=int(os.environ["CMENG_AUDIT_SHARD"])
OUT=Path(f"visual-audit-current-{SHARD}")
OUT.mkdir(exist_ok=True)
SHARDS={
  1:[("01-master-dashboard","master-dashboard"),("02-command-center","command-center"),("03-master-control-programme","master-control-programme"),("04-management-position","pmo-analysis")],
  2:[("05-programme-review","schedule-analytics"),("06-activity-review","activity-analytics"),("07-look-ahead","lookahead-schedule"),("08-programme-changes","schedule-change-report")],
  3:[("09-revision-history","revision-trend"),("10-milestones","milestones"),("11-near-critical-float-risk","near-critical"),("12-resources","resource-utilization")]
}
PAGES=SHARDS[SHARD]

def fp(docs):
    return hashlib.sha256(json.dumps(sorted((d["documentId"],d["sourceHashSha256"]) for d in docs)).encode()).hexdigest()

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    ctx=browser.new_context(viewport={"width":1600,"height":1200},device_scale_factor=1)
    def getj(path):
        r=ctx.request.get(BASE+path,timeout=90000)
        if r.status!=200: raise RuntimeError(f"GET {path}->{r.status}")
        return r.json()
    if getj("/health").get("release")!=EXPECTED: raise RuntimeError("release mismatch")
    projects=getj("/api/portfolio")["projects"]
    candidates=[p for p in projects if "ORBIT" in p["projectId"].upper()]
    if not candidates and len(projects)==1:candidates=projects
    if len(candidates)!=1: raise RuntimeError(f"audit project count {len(candidates)}")
    pid=candidates[0]["projectId"]
    pref="/api/projects/"+quote(pid,safe="")
    before=fp(getj(pref+"/evidence/documents")["documents"])
    muts=[]
    def readonly(route):
        if route.request.method!="GET":
            muts.append(route.request.method); route.abort()
        else: route.continue_()
    ctx.route("**/*",readonly)
    page=ctx.new_page(); errs=[]; page.on("pageerror",lambda e:errs.append(str(e)))
    ctx.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');localStorage.setItem("cmeng-module",'+json.dumps(PAGES[0][1])+');')
    page.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
    page.wait_for_function('typeof currentModuleResult!=="undefined"&&currentModuleResult',timeout=90000)
    audit={"release":EXPECTED,"projectId":pid,"shard":SHARD,"pages":[]}
    for label,key in PAGES:
        page.locator(f'.nav-item[data-key="{key}"]').click(timeout=20000)
        page.wait_for_function('key=>currentModuleResult?.key===key&&document.getElementById("moduleBadge").textContent!=="Updating"',arg=key,timeout=90000)
        page.wait_for_timeout(650)
        overall=page.locator('.role-view-button[data-role-view="overall"]')
        if overall.count() and overall.first.is_visible():
            overall.first.click(); page.wait_for_timeout(250)
        page.screenshot(path=str(OUT/f"{label}-viewport.jpg"),type="jpeg",quality=85,full_page=False)
        page.screenshot(path=str(OUT/f"{label}-full.jpg"),type="jpeg",quality=85,full_page=True)
        data=page.evaluate("""()=>{const r=document.getElementById('moduleContent');const c=s=>String(s||'').replace(/\s+/g,' ').trim();return{title:c(document.querySelector('.module-workspace-head h3')?.innerText),badge:c(document.getElementById('moduleBadge')?.innerText),body:c(r.innerText),cards:[...r.querySelectorAll('.management-metric-card,.kpi-card,.planning-kpi,.position-card,.scalar,.planning-panel,.chart-card,.commercial-ledger,.role-lens,.currency-line,.movement-card')].map((e,i)=>({i,cls:e.className,text:c(e.innerText).slice(0,3000)})).filter(x=>x.text),tables:[...r.querySelectorAll('table')].map((t,i)=>({i,totalRows:t.querySelectorAll('tr').length,rows:[...t.querySelectorAll('tr')].slice(0,40).map(rr=>[...rr.children].map(cc=>c(cc.innerText)))})),rawIso:[...new Set((r.innerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g)||[]))]}}""")
        (OUT/f"{label}.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
        audit["pages"].append({"label":label,"key":key,"title":data["title"],"badge":data["badge"],"rawIso":data["rawIso"]})
    audit["sourcePreserved"]=before==fp(getj(pref+"/evidence/documents")["documents"])
    audit["mutationAttempts"]=muts;audit["pageErrors"]=errs;audit["releaseAfter"]=getj("/health").get("release")
    (OUT/"index.json").write_text(json.dumps(audit,indent=2),encoding="utf-8")
    browser.close()
if muts or errs or not audit["sourcePreserved"] or audit["releaseAfter"]!=EXPECTED: raise RuntimeError("audit integrity failure")
print(json.dumps({"status":"pass","shard":SHARD,"pages":len(PAGES)},indent=2))
