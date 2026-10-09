"""Fast single-page read-only capture for CMeng final truth audit."""
import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ["CMENG_EXPECTED_RELEASE"]
LABEL=os.environ["CMENG_PAGE_LABEL"]; KEY=os.environ["CMENG_PAGE_KEY"]
OUT=Path("one-page-final-audit");OUT.mkdir(exist_ok=True)
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    c=b.new_context(viewport={"width":1600,"height":1200},device_scale_factor=1)
    def gj(path):
        r=c.request.get(BASE+path,timeout=90000)
        if r.status!=200: raise RuntimeError(f"{path}:{r.status}")
        return r.json()
    deadline=time.time()+600
    while time.time()<deadline:
        try:
            h=gj("/health")
            if h.get("release")==EXPECTED: break
        except Exception: pass
        time.sleep(5)
    else: raise RuntimeError("release mismatch")
    ps=gj("/api/portfolio")["projects"]; cand=[x for x in ps if "ORBIT" in x["projectId"].upper()]
    if len(cand)!=1: raise RuntimeError(f"pilot project count {len(cand)}")
    pid=cand[0]["projectId"]
    muts=[]
    def ro(route):
        if route.request.method!="GET": muts.append(route.request.method); route.abort()
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
    if ov.count() and ov.first.is_visible(): ov.first.click();p.wait_for_timeout(200)
    p.screenshot(path=str(OUT/f"{LABEL}-viewport.jpg"),type="jpeg",quality=84,full_page=False)
    data=p.evaluate("""()=>{const r=document.getElementById('moduleContent');const clean=s=>String(s||'').replace(/\s+/g,' ').trim();const x=window.currentModuleResult;let result=null;try{result=JSON.parse(JSON.stringify(x))}catch(e){}return{title:clean(document.querySelector('.module-workspace-head h3')?.innerText),badge:clean(document.getElementById('moduleBadge')?.innerText),body:clean(r.innerText),result,tables:[...r.querySelectorAll('table')].map((t,i)=>({i,totalRows:t.querySelectorAll('tr').length,rows:[...t.querySelectorAll('tr')].slice(0,25).map(rr=>[...rr.children].map(cc=>clean(cc.innerText)))}))}}""")
    (OUT/f"{LABEL}.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
    b.close()
if muts or errs: raise RuntimeError("audit integrity")
print(json.dumps({"page":LABEL,"badge":data["badge"],"release":EXPECTED}))
