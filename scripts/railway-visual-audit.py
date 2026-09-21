"""Capture every live CMeng page exactly as rendered for manual visual review."""
import json, os, hashlib
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED = os.environ["CMENG_EXPECTED_RELEASE"]
OUT = Path("visual-audit")
OUT.mkdir(exist_ok=True)

PAGES = [
 ("01-master-dashboard","master-dashboard"),
 ("02-command-center","command-center"),
 ("03-master-control-programme","master-control-programme"),
 ("04-management-position","pmo-analysis"),
 ("05-programme-review","schedule-analytics"),
 ("06-activity-review","activity-analytics"),
 ("07-look-ahead","lookahead-schedule"),
 ("08-programme-changes","schedule-change-report"),
 ("09-revision-history","revision-trend"),
 ("10-milestones","milestones"),
 ("11-near-critical-float-risk","near-critical"),
 ("12-resources","resource-utilization"),
 ("13-progress-position","progress-report"),
 ("14-variance-trend","variance-trends"),
 ("15-progress-s-curve","progress-scurve"),
 ("16-installed-quantities","quantity-scurve"),
 ("17-wbs-progress","progress-breakdown"),
 ("18-man-hour-s-curve","manhour-scurve"),
 ("19-completion-forecast-history","forecast-history"),
 ("20-cmeng-completion-forecast","independent-forecast"),
 ("21-delay-events-claims","delay-claims"),
 ("22-notices-eot-claims","notices-claims"),
 ("23-delay-windows","windows-analysis"),
 ("24-eot-position","eot-assessment"),
 ("25-challenge-contract","challenge-contract"),
 ("26-commercial-overview","commercial-overview"),
 ("27-cost-forecast","cost-forecast"),
 ("28-variations-change","variations-change"),
 ("29-payments","payments"),
 ("30-cash-flow","cash-flow"),
 ("31-claims-notices","commercial-claims-notices"),
 ("32-contract-particulars-bonds","contract-particulars-bonds"),
]

def fingerprint(docs):
    ids=sorted((d["documentId"],d["sourceHashSha256"]) for d in docs)
    return hashlib.sha256(json.dumps(ids).encode()).hexdigest()

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    context=browser.new_context(viewport={"width":1600,"height":1200}, device_scale_factor=1)
    def get_json(path):
        r=context.request.get(BASE+path,timeout=90000)
        if r.status != 200:
            raise RuntimeError(f"GET {path} -> {r.status}")
        return r.json()
    health=get_json("/health")
    if health.get("release") != EXPECTED:
        raise RuntimeError(f"release mismatch {health.get('release')} != {EXPECTED}")
    projects=get_json("/api/portfolio")["projects"]
    requested=os.environ.get("CMENG_PROJECT_CODE")
    candidates=[p for p in projects if p["projectId"]==requested] if requested else [p for p in projects if "ORBIT" in p["projectId"].upper()]
    if not requested and not candidates and len(projects)==1:
        candidates=projects
    if len(candidates)!=1:
        raise RuntimeError(f"expected one audit project, found {len(candidates)}")
    pid=candidates[0]["projectId"]
    prefix="/api/projects/"+quote(pid,safe="")
    before=get_json(prefix+"/evidence/documents")
    source_before=fingerprint(before["documents"])

    mutation_attempts=[]
    def get_only(route):
        if route.request.method != "GET":
            mutation_attempts.append({"method":route.request.method,"url":route.request.url})
            route.abort()
        else:
            route.continue_()
    context.route("**/*",get_only)

    page=context.new_page()
    errors=[]
    page.on("pageerror",lambda e: errors.append(str(e)))
    context.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');localStorage.setItem("cmeng-module","master-dashboard");')
    page.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
    page.wait_for_function('typeof currentModuleResult !== "undefined" && currentModuleResult',timeout=90000)

    shard=int(os.environ.get("CMENG_AUDIT_SHARD","0"))
    shard_count=int(os.environ.get("CMENG_AUDIT_SHARD_COUNT","1"))
    selected=[item for i,item in enumerate(PAGES) if i % shard_count == shard]
    audit={"release":EXPECTED,"projectId":pid,"shard":shard,"shardCount":shard_count,"pages":[],"mutationAttempts":[],"pageErrors":[]}
    for label,key in selected:
        print("CAPTURE_START",label,key,flush=True)
        page.locator(f'.nav-item[data-key="{key}"]').click(timeout=15000)
        page.wait_for_function('key => currentModuleResult?.key === key && document.getElementById("moduleBadge").textContent !== "Updating"',arg=key,timeout=90000)
        page.wait_for_timeout(800)

        overall=page.locator('.role-view-button[data-role-view="overall"]')
        if overall.count() and overall.first.is_visible():
            overall.first.click()
            page.wait_for_timeout(300)

        page.evaluate("window.scrollTo(0,0)")
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUT/f"{label}-viewport-00.jpg"),type="jpeg",quality=82,full_page=False)
        doc_h=page.evaluate("document.documentElement.scrollHeight")
        max_y=max(0,min(doc_h-1200,12000))
        y=1000
        shot=1
        while y <= max_y:
            page.evaluate("(y)=>window.scrollTo(0,y)",y)
            page.wait_for_timeout(120)
            page.screenshot(path=str(OUT/f"{label}-viewport-{shot:02d}.jpg"),type="jpeg",quality=82,full_page=False)
            shot += 1
            y += 1000
        if max_y > 0 and (y-1000) < max_y:
            page.evaluate("(y)=>window.scrollTo(0,y)",max_y)
            page.wait_for_timeout(120)
            page.screenshot(path=str(OUT/f"{label}-viewport-{shot:02d}.jpg"),type="jpeg",quality=82,full_page=False)
        page.evaluate("window.scrollTo(0,0)")

        data=page.evaluate("""() => {
          const root=document.getElementById('moduleContent');
          const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
          const selectors=[
            '.management-metric-card','.kpi-card','.planning-kpi','.position-card','.scalar',
            '.cash-flow-hero','.cash-readiness-grid','.currency-line','.movement-card',
            '.planning-panel','.chart-card','.commercial-ledger','.role-lens'
          ];
          const cards=[...root.querySelectorAll(selectors.join(','))].map((el,i)=>({
            i,cls:el.className,text:clean(el.innerText).slice(0,2500)
          })).filter(x=>x.text);
          const tables=[...root.querySelectorAll('table')].map((t,i)=>{
            const rows=[...t.querySelectorAll('tr')].slice(0,30).map(r=>[...r.children].map(c=>clean(c.innerText)));
            return {i,rows,totalRows:t.querySelectorAll('tr').length};
          });
          const svgs=[...root.querySelectorAll('svg')].map((s,i)=>({
            i,text:clean(s.innerText),aria:s.getAttribute('aria-label'),width:s.getAttribute('width'),height:s.getAttribute('height')
          }));
          return {
            title:clean(document.querySelector('.module-workspace-head h3')?.innerText),
            badge:clean(document.getElementById('moduleBadge')?.innerText),
            body:clean(root.innerText),
            cards,tables,svgs,
            rawIso:[...new Set((root.innerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g)||[]))],
            viewport:{w:window.innerWidth,h:window.innerHeight},
            document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}
          };
        }""")
        (OUT/f"{label}.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
        audit["pages"].append({"label":label,"key":key,"title":data["title"],"badge":data["badge"],"bodyLength":len(data["body"]),"cards":len(data["cards"]),"tables":len(data["tables"]),"rawIso":data["rawIso"],"document":data["document"]})
        print("CAPTURE_DONE",label,key,flush=True)

    audit["mutationAttempts"]=mutation_attempts
    audit["pageErrors"]=errors
    after=get_json(prefix+"/evidence/documents")
    audit["sourcePreserved"]=(source_before==fingerprint(after["documents"]))
    audit["releaseAfter"]=get_json("/health").get("release")
    (OUT/"index.json").write_text(json.dumps(audit,indent=2),encoding="utf-8")
    browser.close()

if mutation_attempts:
    raise RuntimeError("browser attempted mutations")
if errors:
    raise RuntimeError("browser page errors")
if not audit["sourcePreserved"]:
    raise RuntimeError("source evidence changed during read-only visual audit")
if audit["releaseAfter"] != EXPECTED:
    raise RuntimeError("production release changed during visual audit")
print(json.dumps({"status":"pass","pages":len(audit["pages"]),"release":EXPECTED},indent=2))
