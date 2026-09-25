"""Read-only page-first human audit across every real CMeng project.

Outer loop is PAGE, inner loop is PROJECT so the same surface is compared side-by-side
across the live portfolio before moving to the next surface. No writes are allowed.
"""
import csv, hashlib, json, os, re, sys, time
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE=os.environ.get("CMENG_RAILWAY_URL","https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED=os.environ.get("CMENG_EXPECTED_RELEASE","")
OUT=Path("human-audit")
SHOT=OUT/"screenshots"
OUT.mkdir(exist_ok=True); SHOT.mkdir(parents=True,exist_ok=True)

PAGES=[
 ("Master Dashboard","master-dashboard","management"),
 ("Command Center","command-center","management"),
 ("Master Control Programme","master-control-programme","management"),
 ("Management Position","pmo-analysis","schedule"),
 ("Programme Review","schedule-analytics","schedule"),
 ("Activity Review","activity-analytics","schedule"),
 ("Look-Ahead","lookahead-schedule","schedule"),
 ("Programme Changes","schedule-change-report","schedule"),
 ("Revision History","revision-trend","schedule"),
 ("Milestones","milestones","schedule"),
 ("Near-Critical & Float Risk","near-critical","schedule"),
 ("Resources","resource-utilization","schedule"),
 ("Progress Position","progress-report","schedule"),
 ("Variance Trend","variance-trends","schedule"),
 ("Progress S-Curve","progress-scurve","schedule"),
 ("Installed Quantities","quantity-scurve","schedule"),
 ("WBS Progress","progress-breakdown","schedule"),
 ("Man-Hour S-Curve","manhour-scurve","schedule"),
 ("Forecast History","forecast-history","schedule"),
 ("Independent Forecast","independent-forecast","schedule"),
 ("Delay Events & Claims","delay-claims","schedule"),
 ("Notices, EOT & Claims","notices-claims","schedule"),
 ("Delay Windows","windows-analysis","schedule"),
 ("EOT Position","eot-assessment","schedule"),
 ("Challenge the Contract","challenge-contract","schedule"),
 ("Commercial Overview","commercial-overview","commercial"),
 ("Cost & Forecast","cost-forecast","commercial"),
 ("Variations & Change","variations-change","commercial"),
 ("Payments","payments","commercial"),
 ("Cash Flow","cash-flow","commercial"),
 ("Claims & Notices","commercial-claims-notices","commercial"),
 ("Contract Particulars & Bonds","contract-particulars-bonds","commercial"),
]

TECHNICAL_PATTERNS=[
 r"source_required",r"SOURCE_REQUIRED",r"producerVersion",r"reportingContract\.metricContracts",
 r"\bNaN\b",r"\bInfinity\b",r"\bundefined\b",r"\[object Object\]",
]
MISSING_WORDS=re.compile(r"\b(not established|not assessable|unresolved|unavailable|missing|not submitted|cannot be assessed|not confirmed)\b",re.I)
REASON_WORDS=re.compile(r"\b(because|until|requires?|due to|no |without|missing|not submitted|not established|not confirmed|evidence|source|date|register|programme|contract)\b",re.I)
ISO_RE=re.compile(r"\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b")

def stable(v):
    if isinstance(v,list): return [stable(x) for x in v]
    if isinstance(v,dict):
        return {k:stable(x) for k,x in sorted(v.items()) if k not in {"generatedAt","updatedAt"}}
    return v

def digest(v):
    return hashlib.sha256(json.dumps(stable(v),sort_keys=True,separators=(",",":"),default=str).encode()).hexdigest()

def safe_name(s):
    return re.sub(r"[^A-Za-z0-9._-]+","_",s)[:80]

def get_json(req,path,allowed=(200,)):
    r=req.get(BASE+path,timeout=120000)
    try: body=r.json()
    except Exception:
        try: body={"_text":r.text()[:2000]}
        except Exception: body={}
    return r.status,body

def module_api(project_id,key,area):
    prefix="/api/projects/"+quote(project_id,safe="")
    if area=="management": return prefix+"/management/"+key
    return prefix+"/"+area+"/modules/"+key

def report_api(project_id,key,area):
    return module_api(project_id,key,area)+"/report.json"

def first_n_unique(items,n=20):
    out=[]
    for x in items:
        x=" ".join(str(x).split())
        if x and x not in out: out.append(x)
        if len(out)>=n: break
    return out

audit={"base":BASE,"expectedRelease":EXPECTED,"startedAt":time.time(),"projectCount":0,"projects":[],"pages":[],"matrix":[],"global":[]}
csv_rows=[]

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    ctx=browser.new_context(viewport={"width":1440,"height":1000})
    req=ctx.request
    hs,hb=get_json(req,"/health")
    audit["health"]={"status":hs,"release":hb.get("release"),"service":hb.get("service")}
    if hs!=200: raise SystemExit("live health endpoint unavailable")
    if EXPECTED and hb.get("release")!=EXPECTED: raise SystemExit("live release does not match requested SHA")
    ps,pb=get_json(req,"/api/portfolio")
    if ps!=200: raise SystemExit("portfolio unavailable")
    projects=[p["projectId"] for p in pb.get("projects",[]) if p.get("projectId")]
    audit["projectCount"]=len(projects); audit["projects"]=projects
    if len(projects)!=6:
        audit["global"].append({"severity":"high","code":"REAL_PROJECT_COUNT","detail":"Expected 6 live non-demo projects; portfolio returned "+str(len(projects))+"."})

    before={}
    for pid in projects:
        st,b=get_json(req,"/api/projects/"+quote(pid,safe="")+"/evidence/documents")
        docs=b.get("documents",[]) if st==200 else []
        before[pid]=digest(sorted([[d.get("documentId"),d.get("sourceHashSha256")] for d in docs]))
    
    page=ctx.new_page()
    page_errors=[]
    page.on("pageerror",lambda err: page_errors.append(str(err)))
    mutations=[]
    def route_handler(route):
        if route.request.method!="GET":
            mutations.append({"method":route.request.method,"url":route.request.url})
            route.abort()
        else:
            route.continue_()
    ctx.route("**/*",route_handler)
    page.goto(BASE+"/",wait_until="domcontentloaded",timeout=120000)

    for page_index,(page_label,key,area) in enumerate(PAGES,1):
        page_group={"page":page_label,"key":key,"area":area,"projects":[]}
        audit["pages"].append(page_group)
        for pid in projects:
            entry={"projectId":pid,"page":page_label,"key":key,"area":area}
            t=time.perf_counter()
            try:
                page.evaluate("""arg=>{
                    localStorage.setItem('cmeng-project',arg.projectId);
                    localStorage.setItem('cmeng-module',arg.key);
                    selected=arg.key;
                    return openProject(arg.projectId);
                }""",{"projectId":pid,"key":key})
                page.wait_for_function(
                    """arg=>overview?.projectId===arg.projectId &&
                    currentModuleResult?.key===arg.key &&
                    document.getElementById('moduleBadge')?.textContent!=='Updating'""",
                    arg={"projectId":pid,"key":key},timeout=120000)
                entry["loadMs"]=round((time.perf_counter()-t)*1000,1)

                visible=page.evaluate("""() => {
                  const host=document.getElementById('moduleContent');
                  const norm=s=>(s||'').replace(/\s+/g,' ').trim();
                  const cards=[...host.querySelectorAll('.management-metric-card,.planning-kpi,.summary-metric,.scalar,.position-card,.currency-card')]
                    .map(n=>norm(n.innerText)).filter(Boolean);
                  const headings=[...host.querySelectorAll('h1,h2,h3,h4,h5,.section-kicker')]
                    .map(n=>norm(n.innerText)).filter(Boolean);
                  const notices=[...host.querySelectorAll('.notice,.reader-issue,.page-review-summary,.attention-card')]
                    .map(n=>norm(n.innerText)).filter(Boolean);
                  const tables=[...host.querySelectorAll('table')].map(t=>({
                    headers:[...t.querySelectorAll('thead th')].map(n=>norm(n.innerText)),
                    rows:t.querySelectorAll('tbody tr').length
                  }));
                  const charts=[...host.querySelectorAll('svg,canvas,.visual-chart,.chart-card,.cash-flow-hero,.planning-chart')]
                    .map(n=>norm(n.closest('.visual-chart,.chart-card,.planning-panel,.card')?.querySelector('h3,h4,h5')?.innerText||n.getAttribute('aria-label')||''))
                    .filter(Boolean);
                  return {
                    key:currentModuleResult?.key||null,
                    status:currentModuleResult?.status||null,
                    reason:currentModuleResult?.reason||null,
                    subtitle:document.getElementById('moduleSubtitle')?.innerText||'',
                    badge:document.getElementById('moduleBadge')?.innerText||'',
                    body:norm(host.innerText),
                    viewport:norm((()=>{let lines=[];for(const n of host.querySelectorAll('h1,h2,h3,h4,h5,.management-metric-card,.planning-kpi,.notice,.position-card')){const x=n.getBoundingClientRect();if(x.bottom>=0&&x.top<=window.innerHeight)lines.push(norm(n.innerText));}return lines.join(' | ')})()),
                    cards,headings,notices,tables,charts,
                    structuredCount:host.querySelectorAll('table,svg,canvas,.planning-panel,.chart-card,.position-card,.planning-kpi,.management-metric-card,.commercial-ledger').length,
                    scrollHeight:host.scrollHeight
                  };
                }""")
                entry.update({k:v for k,v in visible.items() if k!="body"})
                body=visible["body"]
                entry["bodyLength"]=len(body)
                entry["headlineCards"]=first_n_unique(visible["cards"],18)
                entry["sectionHeadings"]=first_n_unique(visible["headings"],30)
                entry["notices"]=first_n_unique(visible["notices"],16)
                entry["charts"]=first_n_unique(visible["charts"],20)
                entry["tables"]=visible["tables"][:20]
                entry["rawIsoVisible"]=bool(ISO_RE.search(body))
                entry["technicalTokens"]=[p for p in TECHNICAL_PATTERNS if re.search(p,body)]
                entry["missingStatements"]=first_n_unique([s.strip() for s in re.split(r"(?<=[.!?])\s+|\s*\|\s*",body) if MISSING_WORDS.search(s)],15)
                entry["missingWithoutReason"]=[s for s in entry["missingStatements"] if not REASON_WORDS.search(s)]
                entry["suspicious"]=[]
                if visible["structuredCount"]==0 and visible["status"]!="blocked": entry["suspicious"].append("No structured visual/table/card in usable page")
                if entry["rawIsoVisible"]: entry["suspicious"].append("Raw ISO timestamp visible")
                if entry["technicalTokens"]: entry["suspicious"].append("Implementation/invalid token visible")
                if visible["status"]=="blocked" and not visible["reason"]: entry["suspicious"].append("Blocked without reason")
                if entry["missingWithoutReason"]: entry["suspicious"].append("At least one unresolved/missing statement lacks nearby reason wording")

                pstatus,pbody=get_json(req,module_api(pid,key,area),(200,409))
                rstatus,rbody=get_json(req,report_api(pid,key,area),(200,409))
                entry["apiStatus"]=pstatus; entry["reportStatus"]=rstatus
                if pstatus==200 and rstatus==200:
                    page_data=pbody.get("data")
                    report_data=(rbody.get("result") or {}).get("data")
                    entry["reportParity"]=digest(page_data)==digest(report_data)
                elif pstatus==409 and rstatus==409:
                    entry["reportParity"]=True
                else:
                    entry["reportParity"]=False
                    entry["suspicious"].append("Page/report availability mismatch")

                shot=SHOT/(str(page_index).zfill(2)+"_"+safe_name(page_label)+"__"+safe_name(pid)+".png")
                page.screenshot(path=str(shot),full_page=False)
                entry["screenshot"]=str(shot)
            except Exception as e:
                entry["error"]=type(e).__name__+": "+str(e)[:400]
                entry["suspicious"]=["Page could not be human-opened"]
            page_group["projects"].append(entry)
            audit["matrix"].append(entry)
            csv_rows.append({
                "page":page_label,"key":key,"project":pid,
                "status":entry.get("status"),"load_ms":entry.get("loadMs"),
                "report_parity":entry.get("reportParity"),"structured":entry.get("structuredCount"),
                "suspicious":"; ".join(entry.get("suspicious",[])),
                "headline":" || ".join(entry.get("headlineCards",[])[:6]),
                "reason":entry.get("reason") or "",
            })

        page_group["comparison"]={
            "statuses":{e["projectId"]:e.get("status") for e in page_group["projects"]},
            "reportParityFailures":[e["projectId"] for e in page_group["projects"] if e.get("reportParity") is False],
            "humanOpenFailures":[e["projectId"] for e in page_group["projects"] if e.get("error")],
            "suspiciousProjects":[e["projectId"] for e in page_group["projects"] if e.get("suspicious")],
            "loadMs":{e["projectId"]:e.get("loadMs") for e in page_group["projects"]},
        }
        print("PAGE",page_label,json.dumps(page_group["comparison"],ensure_ascii=False))

    audit["browserErrors"]=page_errors
    audit["mutationAttempts"]=mutations

    after={}
    for pid in projects:
        st,b=get_json(req,"/api/projects/"+quote(pid,safe="")+"/evidence/documents")
        docs=b.get("documents",[]) if st==200 else []
        after[pid]=digest(sorted([[d.get("documentId"),d.get("sourceHashSha256")] for d in docs]))
    audit["sourcePreservation"]={pid:(before[pid]==after[pid]) for pid in projects}
    browser.close()

audit["finishedAt"]=time.time()
audit["summary"]={
    "matrixRows":len(audit["matrix"]),
    "reportParityFailures":sum(1 for x in audit["matrix"] if x.get("reportParity") is False),
    "humanOpenFailures":sum(1 for x in audit["matrix"] if x.get("error")),
    "rowsWithSuspicion":sum(1 for x in audit["matrix"] if x.get("suspicious")),
    "rawIsoRows":sum(1 for x in audit["matrix"] if x.get("rawIsoVisible")),
    "blockedWithoutReason":sum(1 for x in audit["matrix"] if x.get("status")=="blocked" and not x.get("reason")),
    "mutationAttempts":len(audit.get("mutationAttempts",[])),
    "sourcePreserved":all(audit["sourcePreservation"].values()) if projects else False,
}

(OUT/"audit.json").write_text(json.dumps(audit,indent=2,ensure_ascii=False))
with (OUT/"matrix.csv").open("w",newline="",encoding="utf-8") as fh:
    w=csv.DictWriter(fh,fieldnames=["page","key","project","status","load_ms","report_parity","structured","suspicious","headline","reason"])
    w.writeheader(); w.writerows(csv_rows)

lines=["# CMeng six-project page-first audit","",
       "Release: "+str(audit["health"].get("release")),
       "Projects: "+str(len(projects)),
       "Matrix rows: "+str(len(audit["matrix"])),""]
for pg in audit["pages"]:
    lines += ["## "+pg["page"],"",
              "| Project | Status | Load ms | Report parity | Structured | Initial human view / headline | Suspicious |",
              "|---|---|---:|---|---:|---|---|"]
    for e in pg["projects"]:
        headline=(e.get("viewport") or " || ".join(e.get("headlineCards",[])[:4])).replace("|","/")[:500]
        susp="; ".join(e.get("suspicious",[])).replace("|","/")
        lines.append("| "+str(e["projectId"])+" | "+str(e.get("status","ERROR"))+" | "+str(e.get("loadMs",""))+" | "+str(e.get("reportParity",""))+" | "+str(e.get("structuredCount",""))+" | "+headline+" | "+susp+" |")
    lines.append("")
(OUT/"page-first-summary.md").write_text("\n".join(lines),encoding="utf-8")
print("FINAL_SUMMARY",json.dumps(audit["summary"]))
if len(projects)!=6 or audit["summary"]["humanOpenFailures"] or audit["summary"]["mutationAttempts"] or not audit["summary"]["sourcePreserved"]:
    sys.exit(2)
