"""Capture a shard of CMeng live pages for manual human review."""
import json, os, hashlib
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED = os.environ["CMENG_EXPECTED_RELEASE"]
SHARD = int(os.environ["CMENG_AUDIT_SHARD"])
OUT = Path(f"visual-audit-shard-{SHARD}")
OUT.mkdir(exist_ok=True)

SHARDS = {
  1: [
    ("13-progress-position","progress-report"),
    ("14-variance-trend","variance-trends"),
    ("15-progress-s-curve","progress-scurve"),
    ("16-installed-quantities","quantity-scurve"),
    ("17-wbs-progress","progress-breakdown"),
  ],
  2: [
    ("18-man-hour-s-curve","manhour-scurve"),
    ("19-completion-forecast-history","forecast-history"),
    ("20-cmeng-completion-forecast","independent-forecast"),
    ("21-delay-events-claims","delay-claims"),
    ("22-notices-eot-claims","notices-claims"),
  ],
  3: [
    ("23-delay-windows","windows-analysis"),
    ("24-eot-position","eot-assessment"),
    ("25-challenge-contract","challenge-contract"),
    ("26-commercial-overview","commercial-overview"),
    ("27-cost-forecast","cost-forecast"),
  ],
  4: [
    ("28-variations-change","variations-change"),
    ("29-payments","payments"),
    ("30-cash-flow","cash-flow"),
    ("31-claims-notices","commercial-claims-notices"),
    ("32-contract-particulars-bonds","contract-particulars-bonds"),
  ],
}
PAGES = SHARDS[SHARD]

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
    first_key=PAGES[0][1]
    context.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');localStorage.setItem("cmeng-module",'+json.dumps(first_key)+');')
    page.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
    page.wait_for_function('typeof currentModuleResult !== "undefined" && currentModuleResult',timeout=90000)

    audit={"release":EXPECTED,"projectId":pid,"shard":SHARD,"pages":[],"mutationAttempts":[],"pageErrors":[]}
    for label,key in PAGES:
        nav=page.locator(f'.nav-item[data-key="{key}"]')
        if nav.count()!=1:
            raise RuntimeError(f"missing nav {key}")
        nav.click(timeout=20000)
        page.wait_for_function('key => currentModuleResult?.key === key && document.getElementById("moduleBadge").textContent !== "Updating"',arg=key,timeout=90000)
        page.wait_for_timeout(700)

        overall=page.locator('.role-view-button[data-role-view="overall"]')
        if overall.count() and overall.first.is_visible():
            overall.first.click()
            page.wait_for_timeout(250)

        # Full rendered evidence plus viewport exactly as a human sees it.
        page.screenshot(path=str(OUT/f"{label}-viewport.jpg"),type="jpeg",quality=85,full_page=False)
        page.screenshot(path=str(OUT/f"{label}-full.jpg"),type="jpeg",quality=85,full_page=True)

        data=page.evaluate("""() => {
          const root=document.getElementById('moduleContent');
          const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
          const selector=[
            '.management-metric-card','.kpi-card','.planning-kpi','.position-card','.scalar',
            '.cash-flow-hero','.cash-readiness-grid','.currency-line','.movement-card',
            '.planning-panel','.chart-card','.commercial-ledger','.role-lens','.commercial-position-card',
            '.visual-chart','.reconciliation-panel'
          ].join(',');
          const cards=[...root.querySelectorAll(selector)].map((el,i)=>({
            i,cls:el.className,text:clean(el.innerText).slice(0,3000)
          })).filter(x=>x.text);
          const tables=[...root.querySelectorAll('table')].map((t,i)=>({
            i,
            totalRows:t.querySelectorAll('tr').length,
            rows:[...t.querySelectorAll('tr')].slice(0,40).map(r=>[...r.children].map(c=>clean(c.innerText)))
          }));
          const buttons=[...root.querySelectorAll('button,a,summary')].map((x,i)=>({i,text:clean(x.innerText)})).filter(x=>x.text);
          return {
            title:clean(document.querySelector('.module-workspace-head h3')?.innerText),
            badge:clean(document.getElementById('moduleBadge')?.innerText),
            body:clean(root.innerText),
            cards,tables,buttons,
            rawIso:[...new Set((root.innerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g)||[]))],
            document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}
          };
        }""")
        (OUT/f"{label}.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
        audit["pages"].append({
          "label":label,"key":key,"title":data["title"],"badge":data["badge"],
          "bodyLength":len(data["body"]),"cards":len(data["cards"]),"tables":len(data["tables"]),
          "rawIso":data["rawIso"],"document":data["document"]
        })

    after=get_json(prefix+"/evidence/documents")
    audit["mutationAttempts"]=mutation_attempts
    audit["pageErrors"]=errors
    audit["sourcePreserved"]=(source_before==fingerprint(after["documents"]))
    audit["releaseAfter"]=get_json("/health").get("release")
    (OUT/"index.json").write_text(json.dumps(audit,indent=2),encoding="utf-8")
    browser.close()

if mutation_attempts:
    raise RuntimeError("browser attempted mutations")
if errors:
    raise RuntimeError("browser page errors")
if not audit["sourcePreserved"]:
    raise RuntimeError("source evidence changed")
if audit["releaseAfter"] != EXPECTED:
    raise RuntimeError("release changed during audit")
print(json.dumps({"status":"pass","shard":SHARD,"pages":len(audit["pages"]),"release":EXPECTED},indent=2))
