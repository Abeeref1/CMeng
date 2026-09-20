"""Read-only browser smoke against the exact deployed CMeng source revision."""
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = os.environ.get('CMENG_RAILWAY_URL', 'https://cmeng-main-production.up.railway.app').rstrip('/')
EXPECTED = os.environ['CMENG_EXPECTED_RELEASE']
assert re.fullmatch(r'[0-9a-f]{40}', EXPECTED)
summary = {'expectedRelease': EXPECTED, 'mode': 'GET_ONLY_BROWSER', 'checks': [], 'status': 'running'}
stage = 'initialization'

def check(name, condition):
    if not condition:
        raise AssertionError(name)
    summary['checks'].append({'name': name, 'status': 'pass'})

def fingerprint(documents):
    identities = sorted((d['documentId'], d['sourceHashSha256']) for d in documents)
    return hashlib.sha256(json.dumps(identities).encode()).hexdigest()

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        def get_json(path):
            response = context.request.get(BASE + path, timeout=90000)
            if response.status != 200:
                raise AssertionError('Read-only API request failed')
            return response.json()
        stage = 'release identity'
        check('Exact released source before browser checks', get_json('/health').get('release') == EXPECTED)
        projects = get_json('/api/portfolio')['projects']
        requested = os.environ.get('CMENG_PROJECT_CODE')
        candidates = [p for p in projects if p['projectId'] == requested] if requested else [p for p in projects if 'ORBIT' in p['projectId'].upper()]
        if not requested and not candidates and len(projects) == 1:
            candidates = projects
        check('Unique existing acceptance project', len(candidates) == 1)
        project_id = candidates[0]['projectId']
        prefix = '/api/projects/' + quote(project_id, safe='')
        before = get_json(prefix + '/evidence/documents')
        source_before = fingerprint(before['documents'])
        summary['documentCount'] = len(before['documents'])
        mutation_attempts = []
        errors = []
        def allow_reads_only(route):
            if route.request.method != 'GET':
                mutation_attempts.append(route.request.method)
                route.abort()
            else:
                route.continue_()
        context.route('**/*', allow_reads_only)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(type(error).__name__))
        context.add_init_script('localStorage.setItem("cmeng-project",' + json.dumps(project_id) + ');localStorage.setItem("cmeng-module","commercial-overview");')
        stage = 'open existing project'
        page.goto(BASE + '/', wait_until='domcontentloaded', timeout=90000)
        page.wait_for_function('typeof overview !== "undefined" && overview && typeof currentModuleResult !== "undefined" && currentModuleResult', timeout=90000)
        keys = [
            'pmo-analysis','schedule-analytics','activity-analytics','lookahead-schedule',
            'schedule-change-report','revision-trend','milestones','near-critical',
            'resource-utilization','progress-report','variance-trends','progress-scurve',
            'quantity-scurve','progress-breakdown','manhour-scurve','forecast-history',
            'independent-forecast','delay-claims','notices-claims','windows-analysis',
            'eot-assessment','challenge-contract','commercial-overview','cost-forecast',
            'variations-change','payments','cash-flow','commercial-claims-notices',
            'contract-particulars-bonds'
        ]
        check('Navigation exposes all 29 Project Control pages', all(page.locator('.nav-item[data-key="' + key + '"]').count() == 1 for key in keys))
        for key in keys:
            stage = key
            page.locator('.nav-item[data-key="' + key + '"]').click(timeout=15000)
            page.wait_for_function('key => currentModuleResult?.key === key && document.getElementById("moduleBadge").textContent !== "Updating"', arg=key, timeout=90000)
            visible = page.evaluate('({key:currentModuleResult.key,status:currentModuleResult.status,bodyLength:document.getElementById("moduleContent").innerText.length,structuredCount:document.getElementById("moduleContent").querySelectorAll("table,svg,canvas,.planning-panel,.chart-card,.position-card,.planning-kpi,.commercial-ledger").length})')
            check(key + ': visible module response without a blocked state', visible['key'] == key and visible['status'] != 'blocked' and visible['bodyLength'] > 100)
            check(key + ': structured management view is rendered', visible['structuredCount'] > 0)
            if key == 'near-critical':
                check('Near-Critical page states the 5 working-day governed basis', '5' in page.locator('#moduleContent').inner_text() and ('working' in page.locator('#moduleContent').inner_text().lower() or 'calendar' in page.locator('#moduleContent').inner_text().lower()))
            if key == 'independent-forecast':
                body = page.locator('#moduleContent').inner_text()
                check('Independent Forecast shows the four distinct forecast positions', all(label in body for label in ['Contractor Programme Forecast','Source Productivity Forecast','CMeng Independent CPM Forecast','P50 probabilistic forecast']))
            if key == 'windows-analysis':
                body = page.locator('#moduleContent').inner_text()
                check('Delay Windows separates gross window movement from Project Completion movement', 'Gross positive window movement' in body and 'Project Completion movement' in body and 'not project delay or EOT' in body)
            if key == 'delay-claims':
                body = page.locator('#moduleContent').inner_text()
                check('Delay Events page exposes claim-event evidence chain', all(label in body for label in ['Activities','Windows','Notices','Determinations']))
            if key == 'eot-assessment':
                body = page.locator('#moduleContent').inner_text()
                check('EOT page exposes amendment and determination reconciliation', 'Amendment and determination reconciliation' in body and 'Full determination register' in body and 'Project Completion movement' in body)
            if key == 'resource-utilization':
                body = page.locator('#moduleContent').inner_text()
                check('Resources page exposes measured source utilization', 'capacity' in body.lower() and 'planned' in body.lower() and 'actual' in body.lower())
            if key == 'payments':
                check('Payment reconciliation panel is rendered', page.get_by_text('Cash allocation and balance reconciliation', exact=True).count() > 0)
                check('Reported and calculated balances stay separate in the view', page.get_by_text('Reported outstanding', exact=True).count() > 0 and page.get_by_text('Calculated outstanding', exact=True).count() > 0)
        stage = 'report popup'
        page.locator('.nav-item[data-key="payments"]').click()
        page.wait_for_function('currentModuleResult?.key === "payments" && document.getElementById("moduleBadge").textContent !== "Updating"', timeout=90000)
        with page.expect_popup(timeout=15000) as popup_info:
            page.locator('#moduleReport').click()
        report = popup_info.value
        report.wait_for_load_state('domcontentloaded')
        check('Payments report opens with print and two download controls', report.locator('#reportPrint').is_visible() and report.locator('a[download]').count() == 2 and 'Payments' in report.locator('h1').inner_text())
        check('Report includes canonical payment reconciliation', report.get_by_text('Cash allocation and balance reconciliation', exact=True).count() > 0)
        stage = 'preservation and errors'
        check('No uncaught browser JavaScript errors', not errors)
        check('No mutation requests were attempted', not mutation_attempts)
        check('Source document identities and hashes stay unchanged', source_before == fingerprint(get_json(prefix + '/evidence/documents')['documents']))
        check('Exact released source after browser checks', get_json('/health').get('release') == EXPECTED)
        browser.close()
        summary['status'] = 'pass'
except Exception as error:
    summary['status'] = 'fail'
    summary['failedStage'] = stage
    summary['errorType'] = type(error).__name__
    # Do not publish DOM text, project names, filenames or source rows in CI artifacts.
finally:
    Path('browser-acceptance.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
if summary['status'] != 'pass':
    sys.exit(1)
