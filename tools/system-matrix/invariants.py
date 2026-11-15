"""System invariant matrix: every page of every captured project against the shared invariants.
Usage: python3 invariants.py <capture root> <facts dir> <out.json>
Each failure is a manifestation: project, page, check, mechanism, detail. Mechanisms are the 14 shared ones."""
import json, os, re, sys, datetime, collections

MECH = {1: 'XER/P6 parsing and calendar semantics', 2: 'CPM calculation semantics', 3: 'Forecast credibility and publication',
        4: 'Baseline-only project state', 5: 'Unknown vs zero', 6: 'One canonical fact per measure',
        7: 'WBS/activity/location/task classification', 8: 'Project Review decision-vs-data-gap rule',
        9: 'Answer-first shared page rendering', 10: 'Section/page-density control', 11: 'Client wording/formatting',
        12: 'AI/document reading and reuse', 13: 'Upload/recalculation orchestration', 14: 'Performance/caching/cold path'}
ROOT, FACTS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


def date_forms(iso):
    """Every way a page may print one calendar date."""
    if not iso: return []
    d = datetime.date.fromisoformat(iso[:10]); m = MON[d.month - 1]
    return [f'{m} {d.day}, {d.year}', f'{d.day} {m} {d.year}', f'{d.day:02d} {m} {d.year}', d.isoformat(), f'{d.day}/{d.month}/{d.year}', f'{d.day:02d}/{d.month:02d}/{d.year}']


DATE_RX = r'(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}|\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}|\d{4}-\d\d-\d\d)'


def parse_date(s):
    for fmt in ('%b %d, %Y', '%d %b %Y', '%Y-%m-%d'):
        try: return datetime.datetime.strptime(s, fmt).date().isoformat()
        except ValueError: pass
    return None


def fmt_int(n): return f'{n:,}'


out = []
def hit(p, page, check, mech, detail):
    out.append({'project': p, 'page': page, 'check': check, 'mechanism': mech, 'detail': str(detail)[:300]})


projects = sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d)))
coverage = collections.Counter()
for P in projects:
    D = os.path.join(ROOT, P)
    pages = {}
    for f in os.listdir(D):
        if f.endswith('.json') and not f.startswith('__') and f != 'all.json':
            d = json.load(open(os.path.join(D, f)))
            if isinstance(d, dict) and 'key' in d: pages[d['key']] = d
    if not pages: continue
    ff = os.path.join(FACTS, P + '.json')
    fx = json.load(open(ff)) if os.path.exists(ff) else {}
    pf = fx.get('projectFacts') or {}
    g = lambda o, path: __import__('functools').reduce(lambda a, k: a.get(k) if isinstance(a, dict) else None, path.split('.'), o)
    sched = pf.get('schedule') or {}
    state = sched.get('programmeState') or {}
    baseline_only = state.get('baselineOnly') is True
    has_programme = bool(state.get('programmeCount'))
    progress_recorded = state.get('progressRecorded')
    data_date = g(pf, 'schedule.dataDateIso.value') or pf.get('dataDateIso')
    cal = g(pf, 'inputs.calendar') or {}
    open_n, cal_n, unres_n = cal.get('openActivityCount'), cal.get('calendarActivityCount'), cal.get('unresolvedCalendarActivityCount')
    no_calendar = bool(open_n) and cal_n == 0
    cmeng_iso = fx.get('calculatedCompletionIso')
    headline = g(pf, 'time.forecastHeadline') or {}

    for key, d in pages.items():
        coverage[P] += 1
        full = d.get('fullText') or ''; first = d.get('firstScreen') or ''; shown = d.get('shownText') or ''
        # 13 orchestration / 9 rendering: errors, stuck, empty
        if d.get('failure'): hit(P, key, 'page did not open', 13, d['failure'])
        if d.get('stuck'): hit(P, key, 'page stuck in a processing state', 13, full[:120])
        if d.get('errors'): hit(P, key, 'script error on the page', 9, d['errors'][0])
        if not d.get('failure') and len(full) < 120: hit(P, key, 'page empty', 9, full[:120])
        for m in re.finditer(r'\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b|(?<![\w"])null(?![\w"])', full):
            hit(P, key, 'broken value printed', 11, full[max(0, m.start() - 60):m.end() + 40]); break
        # 14 performance (warm live page open)
        if (d.get('ms') or 0) > 20000: hit(P, key, 'page took over 20 s to open', 14, d['ms'])
        # CMeng's own same-basis checks must pass: a failed check is a system
        # failure shown to the client (Actions required / source quality).
        m = re.search(r'System failures?\s*\|?\s*\n?\s*([1-9][\d,]*)', full)
        if m:
            hit(P, key, 'CMeng reports one of its own checks failed', 6, full[m.start():m.end() + 120].replace('\n', ' | '))
        # 6 one canonical fact per measure: every response the page received agrees with every other page
        for f in d.get('facts') or []:
            for k, v in (('headlineIso', (headline.get('completionIso') or None)), ('headlineSource', headline.get('source')), ('dataDate', g(pf, 'schedule.dataDateIso.value'))):
                fv = f.get(k)
                if pf and (fv or None) != (v or None) and not (k == 'headlineIso' and (fv or '')[:16] == (v or '')[:16]):
                    hit(P, key, 'canonical fact differs on this page: ' + k, 6, f'{f.get("url")}: {fv} vs {v}')
        for m in re.finditer(r'Data [Dd]ate[ :·|\t]{0,4}(' + DATE_RX + ')', full):
            got = parse_date(m.group(1))
            if data_date and got and got != data_date[:10]:
                hit(P, key, 'Data Date printed differs from the canonical Data Date', 6, f'{m.group(0)} vs {data_date[:10]}'); break
        # 3 forecast publication: no readable calendar at all -> CMeng's own date is diagnostic only
        if no_calendar and cmeng_iso:
            # Activity table rows print each activity's own source dates; one of
            # them can equal the diagnostic date by coincidence. Only prose,
            # cards and labelled values count as publishing CMeng's finish.
            def published(form):
                for mm in re.finditer(re.escape(form), full):
                    line = full[full.rfind('\n', 0, mm.start()) + 1:full.find('\n', mm.end()) if full.find('\n', mm.end()) >= 0 else len(full)]
                    if line.count('\t') < 4: return True
                return False
            for form in date_forms(cmeng_iso):
                if published(form):
                    hit(P, key, 'CMeng finish published although no open activity has a readable calendar', 3, form); break
            m = re.search(r"CMeng'?s?(?: own)? (?:finish|calculation|forecast)[^.\n]{0,40}\b\d[\d,]* (?:calendar )?days? (?:earlier|later)", full)
            if m: hit(P, key, 'comparison made with an unpublishable CMeng finish', 3, m.group(0))
        # 3 credible headline: the management pages lead with the canonical headline date
        if key == 'independent-forecast' and headline.get('completionIso'):
            if not any(f in first for f in date_forms(headline['completionIso'])):
                hit(P, key, 'headline finish not on the first screen', 3, headline['completionIso'][:10] + ' ' + str(headline.get('source')))
        if headline.get('source') == 'cmeng_calculation' and headline.get('notReliableReasons'):
            hit(P, key, 'CMeng finish leads although reasons say it is not reliable', 3, headline['notReliableReasons'][:2])
        # 7 classification: task lists picked by name must not catch procurement or trade handovers
        if key in ('delivery-commissioning', 'delivery-assets', 'handover-readiness'):
            m = re.search(r'(?:Appointment of|Sub-?contract agreement|Purchase order|Handover of [^\n]{0,40} to [^\n]{0,40}(?:Subcontractor|Works))', full, re.I)
            if m: hit(P, key, 'task list includes procurement or trade-to-trade items', 7, full[max(0, m.start() - 40):m.end() + 40])
        m = re.search(r'(?:^|[\t\n])([A-Z][\w &/-]{3,40}) · \1(?=[\t\n]|$| \+)', full, re.M)
        if m: hit(P, key, 'the same words repeated in one cell', 11, m.group(0).strip())
        # 1/3 calendar coverage stated precisely where it matters
        if key == 'independent-forecast' and unres_n:
            if not re.search(fmt_int(unres_n) + r'(?: of [\d,]+)? open activit(?:y has|ies have) no readable working calendar', full):
                hit(P, key, 'calendar coverage not stated with the canonical count', 1, f'{unres_n} of {open_n}')
            if 'shift start and finish times' not in full and 'Supply the working days' not in full:
                hit(P, key, 'missing calendar request does not say what to supply', 12, '')
        # 4 baseline-only state
        if baseline_only:
            for rx in (r'percentage points? (?:behind|ahead)', r'\b(?:behind|ahead of) (?:the )?(?:baseline )?plan\b', r'matches baseline plan', r'Recovery candidates exist',
                       r'Systematic revision shift', r'(\S+\.xer) → \1', r'slipped by', r'Variance · pp',
                       r'(?:Schedule (?:activity )?progress|Schedule snapshot)(?::| \|)? 0(?:\.0+)? ?%', r'(?:finish-date movement|Largest movement)(?::| \|)?[^\n|]{0,30}?(?:\| )?0 days\b',
                       r'Actual labou?r hours[^\n]{0,40}?\b0 h\b', r'Variance[^\n]{0,30}?\b0(?:\.0+)? (?:pp|percentage points)\b'):
                flat = re.sub(r'\s*\n\s*', ' | ', full)
                m = re.search(rx.replace('[^\\n]', '[^\\t]'), flat, re.I)
                if m: hit(P, key, 'baseline-only project shows movement, progress or recovery', 4, flat[max(0, m.start() - 50):m.end() + 40])
        elif has_programme and 'Only the baseline programme is supplied' in full:
            hit(P, key, 'says baseline only although an update is supplied', 4, '')
        if progress_recorded is False and not baseline_only:
            m = re.search(r'\d+(?:\.\d+)? percentage points? (?:behind|ahead)', full)
            if m: hit(P, key, 'progress variance shown although progress is not recorded', 4, m.group(0))
        # self-comparison
        m = re.search(r'([\w ()\-.]{4,80}\.xer)\s*(?:→|vs\.?|versus|against|compared with)\s*\1', full)
        if m: hit(P, key, 'a programme compared with itself', 4, m.group(0)[:160])
        # 5 unknown vs zero, on the canonical facts that are not established
        not_est = {k for k, v in (pf.get('controls') or {}).items() if isinstance(v, dict) and v.get('valueState') == 'not_established'}
        not_est |= {k for k, v in (pf.get('commercial') or {}).items() if isinstance(v, dict) and v.get('valueState') == 'not_established'}
        labels = {'openNcrCount': r'(?:open NCRs?|NCRs? open)', 'overdueNcrCount': r'overdue NCRs?', 'openRiskCount': r'open risks?', 'expiredPermitCount': r'expired permits?',
                  'activeBondCount': r'active (?:bonds?|securities)', 'pendingVariationCount': r'pending variations?', 'rejectedVariationCount': r'rejected variations?',
                  'openRfiCount': r'open RFIs?', 'overdueRfiCount': r'overdue RFIs?'}
        for k in not_est & set(labels):
            m = re.search(r'(?:\b0 ' + labels[k] + r'\b|\b' + labels[k] + r'[ :\t·|]{1,4}0\b(?![.,]\d))', full, re.I)
            if m: hit(P, key, 'zero shown for a measure that is not established: ' + k, 5, full[max(0, m.start() - 40):m.end() + 30])
        m = re.search(r'(?:Not supplied|not supplied)[^\n]{0,60}\t0\b(?![.,]\d)', full)
        if m: hit(P, key, 'zero beside a register marked not supplied', 5, m.group(0)[:120])
        # 9 answer first
        if re.match(r'^(Programme basis \| [^|]+ \| Data date \| [^|]+ \| )?(Information needed|Source records|Records owned|Open |Show |Documents)', first):
            hit(P, key, 'page opens with links or records, not its answer', 9, first[:120])
        # 10 density
        if (d.get('closedSections') or 0) > 60: hit(P, key, 'more than 60 sections in the page', 10, d['closedSections'])
        if (d.get('visibleClosedAtLoad') or 0) > 20: hit(P, key, 'more than 20 closed sections shown at load', 10, d['visibleClosedAtLoad'])
        # 11 wording and formatting
        for rx, what in ((r'\w\((?:s|es|ies)\)' if key != 'contract-particulars-bonds' else r'(?!x)x', 'plural written as (s)'), (r'(?<![\d.,])\b1 (?:days|items|activities|records|documents|findings|weeks|months|hours|actions|groups|packages|revisions|tasks|checks|links|windows|claims|NCRs|RFIs)\b', 'plural after 1'),
                         (r'\{"[A-Za-z]+":', 'raw data object printed'), (r'Reader confidence', 'internal reader score printed'), (r'Release [0-9a-f]{7}', 'build number printed'),
                         (r'\b\d{4}-\d\d-\d\d(?:T\d\d:\d\d)?\b', 'ISO date printed'), (r'\b\d{1,3}(?:,\d{3})+\.\d\d? (?:h|hours|labou?r hours)\b', 'hour total with decimals'),
                         (r'\b(?!19\d\d|20\d\d)\d{4,} (?:activities|tasks|records|items|documents|open activities)\b', 'count without separator'), (r'(?<![\w-])pp\b', 'abbreviation pp'),
                         (r'\b(?:Submitted-but-unparsed|Information & Actions)\b', 'internal or retired wording'),
                         (r'\b[a-z]+_[a-z]+(?:_[a-z]+)*\b(?![./])', 'internal key printed'),
                         (r'(?<![\w./-])[A-Z]{2,}(?:_[A-Z]{2,}){2,}(?![\w.-]*\.[A-Za-z]{2,4}\b)', 'internal diagnostic code printed')):
            for m in re.finditer(rx, full):
                ctx = full[max(0, m.start() - 50):m.end() + 30]
                if what == 'internal key printed' and re.search(r'\.(?:pdf|xer|xlsx?|csv|docx?|zip)', ctx, re.I): continue
                if what == 'ISO date printed' and re.search(r'\.(?:pdf|xer|xlsx?|csv|docx?)|_\d{4}-\d\d-\d\d', ctx, re.I): continue
                hit(P, key, what, 11, ctx.replace('\n', ' ')); break
        for m in re.finditer(r'(?<![A-Za-z])([a-z]{3,})([A-Z][a-z]{2,})', shown):
            w = m.group(0)
            if w in ('iPad', 'eTAHA') or re.search(r'[A-Za-z]+\.[a-z]{2,4}\b', shown[m.start() - 20:m.end() + 10]): continue
            hit(P, key, 'two words run together on screen', 11, shown[max(0, m.start() - 40):m.end() + 30].replace('\n', ' ')); break
        # 12 precise missing-source explanation
        m = re.search(r'\b(?:Provide|Supply|Upload|Add) (?:the |any )?(?:missing|required|relevant|additional|necessary) (?:inputs|information|data|documents|evidence)\b(?! listed| named| below)', full)
        if m: hit(P, key, 'request does not name the missing source', 12, full[max(0, m.start() - 40):m.end() + 60])
    # 8 Project Review: decisions that are data gaps
    rv = os.path.join(D, '__review__.json')
    if os.path.exists(rv):
        r = json.load(open(rv))
        for it in r.get('decisions') or []:
            kind, text = it.get('kind') or '', it.get('text') or ''
            if 'action-information' in kind: continue
            # Owner rule (3 Nov): a decision is a choice CMeng cannot establish (sources that disagree, a calendar week or
            # date basis no source states). Missing evidence is a data gap; an answer CMeng already uses is not a question.
            if 'Your decision' not in text and not re.search(r'\bChoose\b|\bConfirm\b', text):
                hit(P, '__review__', 'Project Review decision offers no choice', 8, text[:200].replace('\n', ' | '))
            elif re.search(r'\b(Upload|Add the|Provide the (?:file|document|register))\b', text):
                hit(P, '__review__', 'Project Review decision is missing evidence (a data gap)', 8, text[:200].replace('\n', ' | '))
        m = re.match(r'(\d+) decisions? needs? your review', r.get('text') or '')
        n_dec = sum(1 for it in r.get('decisions') or [] if 'action-information' not in (it.get('kind') or ''))
        if m and int(m.group(1)) != n_dec:
            hit(P, '__review__', 'Project Review decision count differs from the decisions listed', 8, f'{m.group(1)} stated, {n_dec} listed')
        t = r.get('text') or ''
        for rx, what in ((r'Reader confidence', 'internal reader score printed'), (r'Recorded type[^:]*: [a-z]+_[a-z_]+', 'internal key printed')):
            m = re.search(rx, t)
            if m: hit(P, '__review__', what, 11, t[max(0, m.start() - 40):m.end() + 30].replace('\n', ' '))

json.dump({'mechanisms': MECH, 'manifestations': out, 'pagesChecked': dict(coverage)}, open(OUT, 'w'), indent=1)
by_check = collections.Counter((h['mechanism'], h['check'].split(':')[0]) for h in out)
print('pages checked', sum(coverage.values()), 'projects', len(coverage), 'manifestations', len(out))
for (mech, check), n in sorted(by_check.items()):
    projs = len({h['project'] for h in out if h['mechanism'] == mech and h['check'].split(':')[0] == check})
    print(f'M{mech:>2} {n:>5} on {projs:>2} projects  {check}')
