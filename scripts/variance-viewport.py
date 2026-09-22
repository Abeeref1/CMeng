import json,os,hashlib
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright
BASE="https://cmeng-main-production.up.railway.app";EXPECTED="8c54f83af79e4e6818ba4d1195cb66d32be9a258";OUT=Path("variance-audit");OUT.mkdir(exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);c=b.new_context(viewport={"width":1600,"height":1200})
 def g(path):
  r=c.request.get(BASE+path,timeout=90000)
  if r.status!=200:raise RuntimeError(r.status)
  return r.json()
 if g("/health").get("release")!=EXPECTED:raise RuntimeError("release")
 ps=g("/api/portfolio")["projects"];p=[x for x in ps if "ORBIT" in x["projectId"].upper()][0]["projectId"]
 muts=[]
 def ro(route):
  if route.request.method!="GET":muts.append(route.request.method);route.abort()
  else:route.continue_()
 c.route("**/*",ro);pg=c.new_page();errs=[];pg.on("pageerror",lambda e:errs.append(str(e)))
 c.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(p)+');localStorage.setItem("cmeng-module","variance-trends");')
 pg.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
 pg.wait_for_function('typeof currentModuleResult!=="undefined"&&currentModuleResult',timeout=90000)
 pg.locator('.nav-item[data-key="variance-trends"]').click(timeout=20000)
 pg.wait_for_function('currentModuleResult?.key==="variance-trends"&&document.getElementById("moduleBadge").textContent!=="Updating"',timeout=90000)
 pg.wait_for_timeout(500)
 ov=pg.locator('.role-view-button[data-role-view="overall"]')
 if ov.count() and ov.first.is_visible():ov.first.click();pg.wait_for_timeout(200)
 pg.screenshot(path=str(OUT/"14-variance-trend-viewport.jpg"),type="jpeg",quality=82,full_page=False)
 d=pg.evaluate("""()=>{const r=document.getElementById('moduleContent'),c=s=>String(s||'').replace(/\s+/g,' ').trim();return{title:c(document.querySelector('.module-workspace-head h3')?.innerText),badge:c(document.getElementById('moduleBadge')?.innerText),body:c(r.innerText),document:{w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight},tables:[...r.querySelectorAll('table')].map(t=>t.querySelectorAll('tr').length)}}""")
 (OUT/"14-variance-trend.json").write_text(json.dumps(d,indent=2),encoding="utf-8")
 (OUT/"integrity.json").write_text(json.dumps({"mutations":muts,"errors":errs,"release":g("/health").get("release")},indent=2))
 b.close()
if muts or errs:raise RuntimeError("integrity")
