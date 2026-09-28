"""Fast one-page live capture for pages 13-17."""
import json, os, hashlib
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright
BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ["CMENG_EXPECTED_RELEASE"]
KEY=os.environ["CMENG_PAGE_KEY"]; LABEL=os.environ["CMENG_PAGE_LABEL"]
OUT=Path("audit-page");OUT.mkdir(exist_ok=True)
def fp(docs): return hashlib.sha256(json.dumps(sorted((d["documentId"],d["sourceHashSha256"]) for d in docs)).encode()).hexdigest()
with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True);c=b.new_context(viewport={"width":1600,"height":1200},device_scale_factor=1)
  def gj(path):
    r=c.request.get(BASE+path,timeout=90000)
    if r.status!=200: raise RuntimeError(f"{path}:{r.status}")
    return r.json()
  if gj("/health").get("release")!=EXPECTED: raise RuntimeError("release mismatch")
  ps=gj("/api/portfolio")["projects"]; cand=[p for p in ps if "ORBIT" in p["projectId"].upper()]
  if not cand and len(ps)==1:cand=ps
  if len(cand)!=1: raise RuntimeError("project")
  pid=cand[0]["projectId"]; pref="/api/projects/"+quote(pid,safe="")
  before=fp(gj(pref+"/evidence/documents")["documents"]); muts=[]
  def ro(route):
    if route.request.method!="GET": muts.append(route.request.method);route.abort()
    else: route.continue_()
  c.route("**/*",ro)
  p=c.new_page();errs=[];p.on("pageerror",lambda e:errs.append(str(e)))
  c.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');localStorage.setItem("cmeng-module",'+json.dumps(KEY)+');')
  p.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
  p.wait_for_function('typeof currentModuleResult!=="undefined"&&currentModuleResult',timeout=90000)
  p.locator(f'.nav-item[data-key="{KEY}"]').click(timeout=20000)
  p.wait_for_function('key=>currentModuleResult?.key===key&&document.getElementById("moduleBadge").textContent!=="Updating"',arg=KEY,timeout=90000)
  p.wait_for_timeout(500)
  ov=p.locator('.role-view-button[data-role-view="overall"]')
  if ov.count() and ov.first.is_visible():ov.first.click();p.wait_for_timeout(200)
  p.screenshot(path=str(OUT/f"{LABEL}-viewport.jpg"),type="jpeg",quality=82,full_page=False)
  p.screenshot(path=str(OUT/f"{LABEL}-full.jpg"),type="jpeg",quality=82,full_page=True)
  data=p.evaluate("""()=>{const r=document.getElementById('moduleContent');const c=s=>String(s||'').replace(/\s+/g,' ').trim();return{title:c(document.querySelector('.module-workspace-head h3')?.innerText),badge:c(document.getElementById('moduleBadge')?.innerText),body:c(r.innerText),cards:[...r.querySelectorAll('.management-metric-card,.kpi-card,.planning-kpi,.position-card,.scalar,.planning-panel,.chart-card,.commercial-ledger,.role-lens,.currency-line,.movement-card')].map((e,i)=>({i,cls:e.className,text:c(e.innerText).slice(0,3000)})).filter(x=>x.text),tables:[...r.querySelectorAll('table')].map((t,i)=>({i,totalRows:t.querySelectorAll('tr').length,rows:[...t.querySelectorAll('tr')].slice(0,40).map(rr=>[...rr.children].map(cc=>c(cc.innerText)))})),rawIso:[...new Set((r.innerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g)||[]))],document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}}}""")
  (OUT/f"{LABEL}.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
  integrity={"release":EXPECTED,"sourcePreserved":before==fp(gj(pref+"/evidence/documents")["documents"]),"mutations":muts,"errors":errs,"releaseAfter":gj("/health").get("release")}
  (OUT/"integrity.json").write_text(json.dumps(integrity,indent=2),encoding="utf-8")
  b.close()
if muts or errs or not integrity["sourcePreserved"] or integrity["releaseAfter"]!=EXPECTED: raise RuntimeError("integrity")
