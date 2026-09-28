import json,os,time
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE="https://cmeng-main-production.up.railway.app"; EXPECTED="0d7b392a6e6416514dfa2115e64a021fa7acc4ac"
OUT=Path("resource-final-check");OUT.mkdir(exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True);c=b.new_context(viewport={"width":1600,"height":1200})
 def gj(path):
  r=c.request.get(BASE+path,timeout=90000)
  if r.status!=200:raise RuntimeError(str(r.status))
  return r.json()
 for _ in range(120):
  try:
   if gj("/health").get("release")==EXPECTED:break
  except: pass
  time.sleep(5)
 else:raise RuntimeError("release")
 ps=gj("/api/portfolio")["projects"];pid=[x["projectId"] for x in ps if "ORBIT" in x["projectId"].upper()][0]
 p=c.new_page();c.add_init_script('localStorage.setItem("cmeng-project",'+json.dumps(pid)+');localStorage.setItem("cmeng-module","resource-utilization");')
 p.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000);p.wait_for_function('typeof currentModuleResult!=="undefined"&&currentModuleResult',timeout=90000)
 p.locator('.nav-item[data-key="resource-utilization"]').click();p.wait_for_function('currentModuleResult?.key==="resource-utilization"&&document.getElementById("moduleBadge").textContent!=="Updating"',timeout=90000);p.wait_for_timeout(500)
 p.screenshot(path=str(OUT/"12-resources-viewport.jpg"),type="jpeg",quality=86)
 data=p.evaluate("""()=>({badge:document.getElementById('moduleBadge').innerText.trim(),body:document.getElementById('moduleContent').innerText.replace(/\s+/g,' ').trim()})""")
 (OUT/"12-resources.json").write_text(json.dumps(data,indent=2),encoding="utf-8")
 b.close()
print(data["badge"])
