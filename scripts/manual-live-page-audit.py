"""Read-only exhaustive live page capture for manual CMeng credibility review.

This is diagnostic collection, not a product acceptance test. It never sends mutation requests.
"""
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = os.environ.get("CMENG_RAILWAY_URL", "https://cmeng-main-production.up.railway.app").rstrip("/")
EXPECTED = os.environ["CMENG_EXPECTED_RELEASE"]
OUT = Path(os.environ.get("CMENG_AUDIT_OUT", "live-page-audit"))
OUT.mkdir(parents=True, exist_ok=True)

KEYS = [
    "master-dashboard","command-center","master-control-programme",
    "pmo-analysis","schedule-analytics","activity-analytics","lookahead-schedule",
    "schedule-change-report","revision-trend","milestones","near-critical",
    "resource-utilization","progress-report","variance-trends","progress-scurve",
    "quantity-scurve","progress-breakdown","manhour-scurve","forecast-history",
    "independent-forecast","delay-claims","notices-claims","windows-analysis",
    "eot-assessment","challenge-contract","commercial-overview","cost-forecast",
    "variations-change","payments","cash-flow","commercial-claims-notices",
    "contract-particulars-bonds"
]

def safe_name(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-") or "page"

def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1920, "height": 1200},
        device_scale_factor=1,
    )

    def get_json(path):
        response = context.request.get(BASE + path, timeout=120000)
        if response.status != 200:
            raise RuntimeError(f"GET {path} failed with {response.status}")
        return response.json()

    health = get_json("/health")
    if health.get("release") != EXPECTED:
        raise RuntimeError(f"Expected live release {EXPECTED}, got {health.get('release')}")

    projects = get_json("/api/portfolio").get("projects", [])
    requested = os.environ.get("CMENG_PROJECT_CODE")
    if requested:
        candidates = [p for p in projects if p.get("projectId") == requested]
    else:
        candidates = [p for p in projects if "ORBIT" in str(p.get("projectId", "")).upper()]
        if not candidates and len(projects) == 1:
            candidates = projects
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one audit project, found {len(candidates)}")
    project_id = candidates[0]["projectId"]
    prefix = "/api/projects/" + quote(project_id, safe="")

    # API evidence snapshot for independent trace.
    (OUT / "portfolio-project.json").write_text(json.dumps(candidates[0], indent=2), encoding="utf-8")
    evidence = get_json(prefix + "/evidence/documents")
    (OUT / "evidence-documents.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    overview_api = get_json(prefix + "/overview")
    (OUT / "overview.json").write_text(json.dumps(overview_api, indent=2), encoding="utf-8")

    mutation_attempts = []
    browser_errors = []
    def reads_only(route):
        if route.request.method != "GET":
            mutation_attempts.append({"method": route.request.method, "url": route.request.url})
            route.abort()
        else:
            route.continue_()
    context.route("**/*", reads_only)

    page = context.new_page()
    page.on("pageerror", lambda err: browser_errors.append(type(err).__name__))
    page.add_init_script(
        "localStorage.setItem('cmeng-project'," + json.dumps(project_id) + ");"
        "localStorage.setItem('cmeng-module','master-dashboard');"
        "localStorage.setItem('cmeng-role-view','overall');"
    )
    page.goto(BASE + "/", wait_until="domcontentloaded", timeout=120000)
    page.wait_for_function(
        "typeof overview !== 'undefined' && overview && typeof currentModuleResult !== 'undefined' && currentModuleResult",
        timeout=120000,
    )

    nav_snapshot = page.evaluate("""() => ({
      moduleStates: overview?.moduleStates ?? [],
      latestDataDateIso: overview?.latestDataDateIso ?? null,
      latestRevisionId: overview?.latestRevisionId ?? null,
      latestRevisionLabel: overview?.latestRevisionLabel ?? null
    })""")
    (OUT / "navigation-states.json").write_text(json.dumps(nav_snapshot, indent=2), encoding="utf-8")

    audit_index = {
        "release": EXPECTED,
        "projectId": project_id,
        "viewport": {"width": 1920, "height": 1200},
        "moduleCount": len(KEYS),
        "pages": [],
        "browserErrors": browser_errors,
        "mutationAttempts": mutation_attempts,
    }

    for number, key in enumerate(KEYS, start=1):
        page.locator(f'.nav-item[data-key="{key}"]').click(timeout=30000)
        page.wait_for_function(
            "key => currentModuleResult?.key === key && document.getElementById('moduleBadge').textContent !== 'Updating'",
            arg=key,
            timeout=120000,
        )
        page.wait_for_timeout(250)

        title = page.locator("#moduleTitle").inner_text().strip()
        status = page.locator("#moduleBadge").inner_text().strip()
        subtitle = page.locator("#moduleSubtitle").inner_text().strip()
        body_text = page.locator("#moduleContent").inner_text()
        module_result = page.evaluate("() => currentModuleResult")
        role = page.evaluate("() => typeof selectedRoleView === 'undefined' ? null : selectedRoleView")

        # Capture every visible numeric-bearing leaf/table element with local context.
        numeric_inventory = page.evaluate(r"""() => {
          const root = document.getElementById('moduleContent');
          if (!root) return [];
          const hasDigit = text => /(?:^|[^\p{L}])[-+]?(?:\d[\d,]*(?:\.\d+)?|\.\d+)(?:%|\s*(?:d|days?|h|hrs?|hours?|pp|items?|records?|activities?|AED|SAR|USD|EUR|GBP))?/u.test(text || '');
          const visible = el => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
          };
          const contextFor = el => {
            const owner = el.closest(
              '.planning-kpi,.management-metric-card,.currency-line,.visual-bar-row,.cash-readiness-item,' +
              '.domain-metric,.scalar,.summary-metric,.revision-value-card,.comparison-ribbon,.chart-insight,' +
              '.management-alert,.management-decision,.basis-chip,tr,.notice,.state-pill,.coverage-line'
            );
            if (!owner) return '';
            return (owner.innerText || '').replace(/\s+/g,' ').trim().slice(0,1200);
          };
          const candidates = [...root.querySelectorAll(
            'td,th,strong,b,span,small,p,.planning-kpi,.management-metric-value,.visual-bar-value,.domain-metric,.scalar'
          )];
          const out = [];
          const seen = new Set();
          for (const el of candidates) {
            if (!visible(el)) continue;
            const text = (el.innerText || '').replace(/\s+/g,' ').trim();
            if (!text || !hasDigit(text)) continue;
            const numericChild = [...el.children].some(child => hasDigit((child.innerText || '').trim()));
            if (numericChild && !el.matches('td,th,.planning-kpi,.domain-metric,.scalar')) continue;
            const context = contextFor(el);
            const key = [text, context, el.tagName, el.className].join('|');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              text,
              context,
              tag: el.tagName,
              className: String(el.className || ''),
              title: el.getAttribute('title'),
              ariaLabel: el.getAttribute('aria-label')
            });
          }
          return out;
        }""")

        # Structured UI inventory helps manual review of chart/table/card density.
        structure = page.evaluate("""() => {
          const root = document.getElementById('moduleContent');
          const count = selector => root ? root.querySelectorAll(selector).length : 0;
          return {
            kpiCards: count('.planning-kpi,.management-metric-card,.summary-metric'),
            panels: count('.planning-panel,.chart-card,.visual-chart'),
            tables: count('table'),
            tableRows: count('tbody tr'),
            charts: count('svg,.visual-chart,.chart-card'),
            notices: count('.notice'),
            badges: count('.badge,.state-pill'),
            details: count('details'),
            visibleRawIsoCount: ((root?.innerText || '').match(/\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z/g) || []).length
          };
        }""")

        prefix_name = f"{number:02d}-{safe_name(key)}"
        page.screenshot(path=str(OUT / f"{prefix_name}.png"), full_page=True)
        (OUT / f"{prefix_name}.txt").write_text(body_text, encoding="utf-8")
        (OUT / f"{prefix_name}-numbers.json").write_text(json.dumps(numeric_inventory, indent=2), encoding="utf-8")
        (OUT / f"{prefix_name}-data.json").write_text(json.dumps(module_result, indent=2), encoding="utf-8")

        audit_index["pages"].append({
            "number": number,
            "key": key,
            "title": title,
            "status": status,
            "subtitle": subtitle,
            "role": role,
            "bodyTextLength": len(body_text),
            "numericItemCount": len(numeric_inventory),
            "dataDigest": digest(module_result),
            "structure": structure,
            "screenshot": f"{prefix_name}.png",
            "textFile": f"{prefix_name}.txt",
            "numbersFile": f"{prefix_name}-numbers.json",
            "dataFile": f"{prefix_name}-data.json",
        })

    audit_index["browserErrors"] = browser_errors
    audit_index["mutationAttempts"] = mutation_attempts
    (OUT / "audit-index.json").write_text(json.dumps(audit_index, indent=2), encoding="utf-8")
    browser.close()

print(json.dumps({
    "release": EXPECTED,
    "projectId": project_id,
    "pages": len(KEYS),
    "output": str(OUT),
    "browserErrors": len(browser_errors),
    "mutationAttempts": len(mutation_attempts),
}, indent=2))
