"""Canonical facts per project (ground truth for the invariant matrix). Usage: fetch_facts.py <base> <out dir> [project ...] (default: portfolio)"""
import json, sys, os, urllib.request, urllib.parse
B, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
ps = sys.argv[3:] or [p['projectId'] for p in json.load(urllib.request.urlopen(B + '/api/portfolio', timeout=120))['projects']]
for pid in ps:
    try: d = json.load(urllib.request.urlopen(B + '/api/projects/' + urllib.parse.quote(pid) + '/schedule/modules/independent-forecast', timeout=1800)).get('data') or {}
    except Exception as e: print(pid, 'ERR', e); continue
    keep = {k: d.get(k) for k in ('projectFacts', 'calculatedCompletionIso', 'diagnosticCompletionIso', 'independentForecastCompletionIso', 'managementForecastCompletionIso', 'sourceForecastCompletionIso',
                                  'activityCoveragePercent', 'calculationMode', 'unresolvedActivityCount', 'calculatedActivityCount', 'dataDateIso', 'forecastReconciliationGate')}
    keep['calculatedCompletionIso'] = keep['calculatedCompletionIso'] or keep.get('diagnosticCompletionIso')  # the date that must not be published when diagnostic
    keep['assumedCalendarOpenActivityIds'] = len(d.get('assumedCalendarOpenActivityIds') or [])
    json.dump(keep, open(os.path.join(OUT, pid.replace('(', '_').replace(')', '_') + '.json'), 'w'))
    print(pid, 'ok')
