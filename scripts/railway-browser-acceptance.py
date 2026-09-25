"""Read-only client-experience acceptance against every live CMeng project."""
import hashlib, json, os, re, sys
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ["CMENG_EXPECTED_RELEASE"]
assert re.fullmatch(r"[0-9a-f]{40}",EXPECTED)
SUMMARY={"expectedRelease":EXPECTED,"mode":"GET_ONLY_ALL_REAL_PROJECTS_BROWSER","checks":[],"projects":[],"status":"running"}
STAGE="initialization"

KEYS=[
 "master-dashboard","command-center","master-control-programme","source-quality",
 "pmo-analysis","schedule-analytics","activity-analytics","lookahead-schedule",
 "schedule-change-report","revision-trend","milestones","near-critical",
 "resource-utilization","progress-report","variance-trends","progress-scurve",
 "quantity-scurve","progress-breakdown","manhour-scurve","forecast-history",
 "independent-forecast","delay-claims","notices-claims","windows-analysis",
 "eot-assessment","challenge-contract","commercial-overview","cost-forecast",
 "variations-change","payments","cash-flow","commercial-claims-notices",
 "contract-particulars-bonds"
]

def fp(documents):
    identities=sorted((d["documentId"],d["sourceHashSha256"]) for d in documents)
    return hashlib.sha256(json.dumps(identities).encode()).hexdigest()

def check(name,condition,project=None,detail=None):
    row={"name":name,"status":"pass" if condition else "fail"}
    if project: row["projectFingerprint"]=hashlib.sha256(project.encode()).hexdigest()[:16]
    if not condition and detail: row["detail"]=detail
    SUMMARY["checks"].append(row)
    return condition

try:
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    context=browser.new_context(viewport={"width":1440,"height":1000})
    def get_json(path):
      r=context.request.get(BASE+path,timeout=90000)
      if r.status!=200: raise AssertionError("Read-only API request failed: "+str(r.status))
      return r.json()

    STAGE="release identity"
    check("Exact released source before browser checks",get_json("/health").get("release")==EXPECTED)
    projects=get_json("/api/portfolio").get("projects",[])
    check("Real project portfolio is available",len(projects)>0,detail="projectCount="+str(len(projects)))

    mutation_attempts=[]
    def reads_only(route):
      if route.request.method!="GET":
        mutation_attempts.append(route.request.method)
        route.abort()
      else:
        route.continue_()
    context.route("**/*",reads_only)

    for project in projects:
      project_id=project["projectId"]
      STAGE="project:"+hashlib.sha256(project_id.encode()).hexdigest()[:12]
      prefix="/api/projects/"+quote(project_id,safe="")
      STAGE+="/source-before"
      before=get_json(prefix+"/evidence/documents")
      source_before=fp(before.get("documents",[]))
      errors=[]
      page=context.new_page()
      page.on("pageerror",lambda error,errors=errors: errors.append(type(error).__name__))
      STAGE=hashlib.sha256(project_id.encode()).hexdigest()[:12]+"/open-workspace"
      page.goto(BASE+"/",wait_until="domcontentloaded",timeout=90000)
      page.evaluate("(id)=>{localStorage.setItem('cmeng-project',id);localStorage.setItem('cmeng-module','master-dashboard')}",project_id)
      STAGE=hashlib.sha256(project_id.encode()).hexdigest()[:12]+"/restore-project"
      page.reload(wait_until="domcontentloaded",timeout=90000)
      STAGE=hashlib.sha256(project_id.encode()).hexdigest()[:12]+"/wait-project"
      page.wait_for_function("typeof overview!=='undefined' && overview && overview.projectId===arg",arg=project_id,timeout=90000)
      project_result={"projectFingerprint":hashlib.sha256(project_id.encode()).hexdigest()[:16],"pages":0,"blocked":[]}
      SUMMARY["projects"].append(project_result)

      check("Navigation exposes complete client workspace",all(page.locator('.nav-item[data-key="'+key+'"]').count()==1 for key in KEYS),project_id)

      for key in KEYS:
        STAGE=project_result["projectFingerprint"]+":"+key
        page.locator('.nav-item[data-key="'+key+'"]').click(timeout=15000)
        page.wait_for_function("key=>currentModuleResult?.key===key && document.getElementById('moduleBadge').textContent!=='Updating'",arg=key,timeout=90000)
        visible=page.evaluate("""() => ({
          key:currentModuleResult?.key,
          status:currentModuleResult?.status,
          reason:currentModuleResult?.reason,
          systemDefects:currentModuleResult?.issueAssessment?.counts?.system_defect??0,
          body:document.getElementById('moduleContent')?.innerText??'',
          structured:document.getElementById('moduleContent')?.querySelectorAll('table,svg,canvas,.planning-panel,.chart-card,.position-card,.planning-kpi,.commercial-ledger,.notice').length??0
        })""")
        project_result["pages"]+=1
        body=visible["body"]
        ok_state=visible["status"] in ["ready","partial","blocked"]
        check(key+": governed page state rendered",visible["key"]==key and ok_state and len(body)>40,project_id)
        if visible["status"]=="blocked":
          project_result["blocked"].append(key)
          check(key+": blocked client view explains why",bool(visible["reason"]) and len(str(visible["reason"]).strip())>10,project_id)
        else:
          check(key+": usable structured client view rendered",visible["structured"]>0 and len(body)>100,project_id)
        check(key+": client canvas contains no raw non-finite values",re.search(r"\b(?:NaN|Infinity|-Infinity)\b",body) is None,project_id)
        check(key+": client canvas hides raw ISO timestamps",re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z",body) is None,project_id)
        check(key+": client canvas hides implementation labels",not any(token in body for token in ["producerVersion","reportingContract.metricContracts","source_required","SOURCE_REQUIRED"]),project_id)
        check(key+": calculation error is shown only for a classified system defect",("Calculation error" not in body) or visible["systemDefects"]>0,project_id)

        if key=="master-dashboard" and visible["status"]!="blocked":
          check("Master Dashboard keeps executive hierarchy",all(label in body for label in ["Executive Project Position","Control Readiness","Evidence Snapshot","Commercial Exposure by Currency"]),project_id)
        if key=="near-critical" and visible["status"]!="blocked":
          check("Near-Critical discloses threshold authority",("Project control basis" in body or "CMeng screening policy" in body or "Threshold authority unresolved" in body),project_id)
        if key=="windows-analysis" and visible["status"]!="blocked":
          check("Delay Windows separates analytical submitted and net movement",all(label in body for label in ["Gross analytical movement","Positive submitted window movement","Project Completion movement"]),project_id)
        if key=="delay-claims" and visible["status"]!="blocked":
          check("Delay Events exposes full/current date populations",all(label in body for label in ["Current delay events","Source delay-event rows","After Data Date","Event date missing"]),project_id)
        if key=="cash-flow" and visible["status"]!="blocked":
          check("Cash Flow does not invent a funding curve when readiness is false",
            page.evaluate("""() => {
              const cash=currentModuleResult?.data?.position?.performance?.cashFlow?.currencies??[];
              return cash.every(c=>c?.sourceReadiness?.fundingCurveReady!==false || document.querySelectorAll('.cash-flow-primary .visual-chart').length===0 || document.querySelectorAll('.cash-flow-curve-withheld').length>0)
            }"""),project_id)

      check("No uncaught browser JavaScript errors",not errors,project_id,",".join(errors))
      after=get_json(prefix+"/evidence/documents")
      check("Browser acceptance preserves real client source files",source_before==fp(after.get("documents",[])),project_id)
      page.close()

    check("No write request was attempted during real-project browser acceptance",not mutation_attempts,detail=",".join(mutation_attempts))
    check("Exact released source after browser checks",get_json("/health").get("release")==EXPECTED)
    browser.close()
    failures=[x for x in SUMMARY["checks"] if x["status"]=="fail"]
    SUMMARY["failedCheckCount"]=len(failures)
    SUMMARY["status"]="pass" if not failures else "fail"
except Exception as error:
  SUMMARY["status"]="fail"
  SUMMARY["failedStage"]=STAGE
  SUMMARY["errorType"]=type(error).__name__
  # Keep the actionable browser error without publishing client identifiers.
  message=str(error).split("Call log:")[0].replace(BASE,"<application>")
  for project in locals().get("projects",[]):
    message=message.replace(project["projectId"],"<project>")
  SUMMARY["errorMessage"]=message[:1500]
finally:
  Path("browser-acceptance.json").write_text(json.dumps(SUMMARY,indent=2))
  print(json.dumps(SUMMARY,indent=2))
if SUMMARY["status"]!="pass": sys.exit(1)
