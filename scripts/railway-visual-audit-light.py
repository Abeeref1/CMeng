"""Lightweight screenshot-first visual audit for DOM-heavy CMeng pages."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ["CMENG_EXPECTED_RELEASE"]
IDX=int(os.environ["CMENG_AUDIT_PAGE_INDEX"])
PAGES=[
("01-master-dashboard","master-dashboard"),("02-command-center","command-center"),("03-master-control-programme","master-control-programme"),
("04-management-position","pmo-analysis"),("05-programme-review","schedule-analytics"),("06-activity-review","activity-analytics"),
("07-look-ahead","lookahead-schedule"),("08-programme-changes","schedule-change-report"),("09-revision-history","revision-trend"),
("10-milestones","milestones"),("11-near-critical-float-risk","near-critical"),("12-resources","resource-utilization"),
("13-progress-position","progress-report"),("14-variance-trend","variance-trends"),("15-progress-s-curve","progress-scurve"),
("16-installed-quantities","quantity-scurve"),("17-wbs-progress","progress-breakdown"),("18-man-hour-s-curve","manhour-scurve"),
("19-completion-forecast-history","forecast-history"),("20-cmeng-completion-forecast","independent-forecast"),("21-delay-events-claims","delay-claims"),
("22-notices-eot-claims","notices-claims"),("23-delay-windows","windows-analysis"),("24-eot-position","eot-assessment"),
("25-challenge-contract","challenge-contract"),("26-commercial-overview","commercial-overview"),("27-cost-forecast","cost-forecast"),
("28-variations-change","variations-change"),("29-payments","payments"),("30-cash-flow","cash-flow"),
("31-claims-notices","commercial-claims-notices"),("32-contract-particulars-bonds","contract-particulars-bonds")]
label,key=PAGES[IDX]
out=Path("visual-audit-light"); out.mkdir(exist_ok=True)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    context=browser.new_context(viewport={"width":1600,"height":1200})
    def get_json(path):
        r=context.request.get(BASE+path,timeout=90000)
        if r.status!=200: raise RuntimeError(f"GET {path} -> {r.status}")
        return r.json()
    if get_json("/health").get("release")!=EXPECTED: raise RuntimeError("release mismatch")
    projects=get_json("/api/portfolio")["projects"]
    candidates=[p for p in projects if "ORBIT" in p["projectId"].upper()]
    if not candidates and len(projects)==1: candidates=projects
    if len(candidates)!=1: raise RuntimeError("acceptance project not unique")
    pid=candidates[0]["projectId"]
    mutations=[]
    def reads_only(route):
        if route.request.method!="GET":
            mutations.append(route.request.method); route.abort()
        else: route.continue_()
    context.route("**/*",reads_only)
    page=context.new_page()
    context.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');localStorage.setItem("cmeng-module",'+json.dumps(key)+');')
    page.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
    page.wait_for_function('key => currentModuleResult?.key === key && document.getElementById("moduleBadge").textContent !== "Updating"',arg=key,timeout=180000)
    page.wait_for_timeout(600)
    overall=page.locator('.role-view-button[data-role-view="overall"]')
    if overall.count() and overall.first.is_visible():
        overall.first.click(); page.wait_for_timeout(250)
    page.evaluate("window.scrollTo(0,0)")
    doc_h=page.evaluate("document.documentElement.scrollHeight")
    positions=list(range(0,min(max(doc_h-1200,0),12000)+1,1000))
    if positions[-1] != max(0,min(doc_h-1200,12000)): positions.append(max(0,min(doc_h-1200,12000)))
    for i,y in enumerate(sorted(set(positions))):
        page.evaluate("(y)=>window.scrollTo(0,y)",y); page.wait_for_timeout(100)
        page.screenshot(path=str(out/f"{label}-viewport-{i:02d}.jpg"),type="jpeg",quality=82,full_page=False)
    page.evaluate("window.scrollTo(0,0)")
    info=page.evaluate("""() => ({
      title:(document.querySelector('.module-workspace-head h3')?.innerText||'').trim(),
      badge:(document.getElementById('moduleBadge')?.innerText||'').trim(),
      body:(document.getElementById('moduleContent')?.innerText||'').replace(/\\s+/g,' ').trim(),
      documentHeight:document.documentElement.scrollHeight
    })""")
    (out/f"{label}.json").write_text(json.dumps(info,indent=2),encoding="utf-8")
    if mutations: raise RuntimeError("mutation attempted")
    if get_json("/health").get("release")!=EXPECTED: raise RuntimeError("release changed")
    browser.close()
print(json.dumps({"status":"pass","page":label,"release":EXPECTED}))
