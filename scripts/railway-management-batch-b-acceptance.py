"""Read-only Batch B page acceptance. Requires exact deployed release; ORBIT last."""
import hashlib
import json
import os
import re
from pathlib import Path
from urllib.parse import quote
from playwright.sync_api import sync_playwright

BASE = os.environ.get('CMENG_RAILWAY_URL', 'https://cmeng-main-production.up.railway.app').rstrip('/')
EXPECTED = os.environ['CMENG_EXPECTED_RELEASE']
if not re.fullmatch(r'[a-f0-9]{40}', EXPECTED):
    raise ValueError('CMENG_EXPECTED_RELEASE must be an exact commit SHA')
KEYS = ['master-dashboard', 'command-center', 'cross-domain-accountability', 'master-control-programme']
OUT = Path('batch-b-acceptance')
OUT.mkdir(exist_ok=True)
summary = {'expectedRelease': EXPECTED, 'mode': 'PAGE_FIRST_GET_ONLY_BATCH_B', 'pages': KEYS,
           'checks': [], 'observations': [], 'status': 'running'}

def check(name, ok, project=None, page=None, detail=None):
    summary['checks'].append({'name': name, 'status': 'pass' if ok else 'fail',
                              'project': project, 'page': page, 'detail': detail})

def digest(documents):
    rows = sorted((x.get('documentId'), x.get('sourceHashSha256')) for x in documents.get('documents', []))
    return hashlib.sha256(json.dumps(rows).encode()).hexdigest()

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1440, 'height': 1000})
        context.set_default_timeout(60000)

        def get(path):
            response = context.request.get(BASE + path, timeout=90000)
            if response.status != 200:
                raise RuntimeError(f'GET {path}: {response.status}')
            return response.json()

        health = get('/health')
        check('Exact healthy release before', health.get('release') == EXPECTED and health.get('status') == 'ok')
        if health.get('release') != EXPECTED:
            raise RuntimeError('Deployed release does not match requested acceptance release')
        ids = sorted([x['projectId'] for x in get('/api/portfolio')['projects']],
                     key=lambda x: ('ORBIT' in x.upper(), x))
        summary['projectOrder'] = ids
        check('All required real projects present', len(ids) >= int(os.environ.get('CMENG_MIN_PROJECTS', '19')))
        before = {i: digest(get('/api/projects/' + quote(i, safe='') + '/evidence/documents')) for i in ids}
        blocked_writes, errors = [], []

        def route(request_route):
            if request_route.request.method != 'GET':
                blocked_writes.append({'method': request_route.request.method, 'url': request_route.request.url})
                request_route.abort()
            else:
                request_route.continue_()

        context.route('**/*', route)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until='domcontentloaded')
        # Page first, all projects, then the next page. This is not a project-first tour.
        for key in KEYS:
            for project in ids:
                item = {'project': project, 'page': key}
                try:
                    page.get_by_role('button', name='◫ Portfolio', exact=True).click()
                    card = page.locator('article').filter(has=page.get_by_role('heading', name=project, exact=True))
                    card.get_by_role('button', name='Open project', exact=True).click()
                    page.wait_for_function("id=>typeof overview!=='undefined'&&overview&&overview.projectId===id", arg=project)
                    page.locator('.nav-item[data-key="' + key + '"]').click()
                    page.wait_for_function("key=>typeof currentModuleResult!=='undefined'&&currentModuleResult?.key===key&&document.getElementById('moduleBadge').textContent!=='Updating'", arg=key)
                    view = page.evaluate("""()=>({key:currentModuleResult.key,status:currentModuleResult.status,
                      reason:currentModuleResult.reason,body:document.getElementById('moduleContent').innerText,
                      headings:[...document.querySelectorAll('#moduleContent h3,#moduleContent h4')].map(x=>x.innerText).filter(Boolean),
                      headers:[...document.querySelectorAll('#moduleContent th')].filter(x=>x.getClientRects().length).map(x=>x.innerText),
                      systemDefects:currentModuleResult.issueAssessment?.counts?.system_defect??0,project:overview.projectId})""")
                    item.update(view)
                    check('Correct project and page', view['key'] == key and view['project'] == project, project, key)
                    check('Governed readable result', view['status'] in ['ready', 'partial', 'blocked'] and len(view['body']) > 100, project, key)
                    check('No reported system defect', view['systemDefects'] == 0, project, key)
                    check('No raw undefined or nonfinite output', not re.search(r'\b(undefined|NaN|Infinity)\b', view['body']), project, key)
                    if key == 'cross-domain-accountability':
                        check('Accountability exposes management ownership and action',
                              bool(re.search(r'owner|responsib|unassigned', view['body'], re.I)) and
                              bool(re.search(r'action|escalat', view['body'], re.I)), project, key)
                    if key == 'command-center':
                        check('Command Center exposes consequences and actions',
                              bool(re.search(r'consequence', view['body'], re.I)) and
                              bool(re.search(r'action', view['body'], re.I)), project, key)
                    filename = key + '-' + hashlib.sha256(project.encode()).hexdigest()[:12] + '.png'
                    page.screenshot(path=str(OUT / filename), full_page=True)
                    item['screenshot'] = filename
                except Exception as error:
                    item['error'] = str(error)
                    check('Page inspection completed', False, project, key, str(error))
                summary['observations'].append(item)
                (OUT / 'report.json').write_text(json.dumps(summary, indent=2))
        for project in ids:
            check('Source identities and hashes unchanged',
                  before[project] == digest(get('/api/projects/' + quote(project, safe='') + '/evidence/documents')), project)
        check('No browser writes', not blocked_writes, detail=blocked_writes)
        check('No browser execution errors', not errors, detail=errors)
        health = get('/health')
        check('Exact healthy release after', health.get('release') == EXPECTED and health.get('status') == 'ok')
        context.close()
        browser.close()
except Exception as error:
    summary['error'] = str(error)
    check('Audit completed', False, detail=str(error))
finally:
    summary['failedChecks'] = sum(x['status'] == 'fail' for x in summary['checks'])
    summary['status'] = 'fail' if summary['failedChecks'] else 'pass'
    (OUT / 'report.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps({'status': summary['status'], 'observations': len(summary['observations']),
                      'failed': [x for x in summary['checks'] if x['status'] == 'fail']}))
raise SystemExit(1 if summary['failedChecks'] else 0)
