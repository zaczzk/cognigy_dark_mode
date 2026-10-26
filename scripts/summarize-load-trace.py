"""Read local native DevTools traces; paint metrics are not app-ready timing."""
import argparse
import gzip
import json
import statistics
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('trace', type=Path)
p.add_argument('--extension-id', required=True)
p.add_argument('--single-journey', action='store_true', help='Trace contains exactly one manually initiated reload; include any painted intermediate replacement documents.')
a = p.parse_args()
raw = a.trace.read_bytes()
events = json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)['traceEvents']
navs = sorted((e for e in events if e['name'] == 'navigationStart'
    and e.get('args', {}).get('data', {}).get('isOutermostMainFrame')
    and e['args']['data'].get('documentLoaderURL', '').startswith('https://trial.cognigy.ai/projects')), key=lambda e:e['ts'])
paint_ids = {e.get('args', {}).get('data', {}).get('navigationId') for e in events if e['name'] == 'firstContentfulPaint'}
# A reload can contain a same-URL replacement before its first paint. Keep that
# elapsed time instead of silently reporting only the last navigation leg.
# Validate the resulting group count against the manually observed reloads.
groups, pending = [], []
for nav in navs:
    pending.append(nav)
    if nav['args']['data']['navigationId'] in paint_ids:
        groups.append(pending)
        pending = []
rows = []
if a.single_journey:
    groups = [navs] if navs else []
    pending = [] if navs and navs[-1]['args']['data']['navigationId'] in paint_ids else navs
for i, group in enumerate(groups):
    nav = group[-1]
    start = group[0]['ts']
    end = groups[i+1][0]['ts'] if i+1 < len(groups) else float('inf')
    nav_id = nav['args']['data']['navigationId']
    same = [e for e in events if e.get('args', {}).get('data', {}).get('navigationId') == nav_id]
    def paint(name, last=False):
        times = [e['ts'] for e in same if e['name'] == name]
        return round(((max(times) if last else min(times))-start)/1000, 3) if times else None
    threads = {(n['pid'], n['tid']) for n in group}
    own = [e for e in events if start <= e['ts'] < end and (e.get('pid'),e.get('tid')) in threads
        and e['name'] in ('EvaluateScript', 'FunctionCall')
        and a.extension_id in json.dumps(e.get('args', {}))]
    intervals = sorted((e['ts'], e['ts']+e.get('dur', 0)) for e in own)
    merged = []
    for left, right in intervals:
        if merged and left <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], right)
        else:
            merged.append([left, right])
    rows.append({'run':i+1, 'navigationLegs':len(group),
        'replacementElapsedMs':round((nav['ts']-start)/1000,3), 'fcpMs':paint('firstContentfulPaint'),
        'lcpMs':paint('largestContentfulPaint::Candidate', True),
        'directExtensionEventCount':len(own),
        'directExtensionUnionMs':round(sum(r-l for l,r in merged)/1000, 3),
        'maximumDirectExtensionEventMs':round(max((e.get('dur',0) for e in own), default=0)/1000,3)})
summary = {}
for key in ['fcpMs','lcpMs','directExtensionUnionMs','maximumDirectExtensionEventMs']:
    values = [r[key] for r in rows if r[key] is not None]
    summary[key] = {'median':statistics.median(values),'min':min(values),'max':max(values)} if values else None
result = {'trace':a.trace.name,'grouping':'single-observed-reload' if a.single_journey else 'painted-document-groups','navigationAttempts':len(navs),'uncompletedTrailingAttempts':len(pending),'runs':rows,'summary':summary,
    'paintTimingDefinition':'Final navigation document FCP/LCP timestamp minus the first navigation start in the group; includes replacement delay. Not the first paint across all documents or exact app readiness.',
    'limitations':'FCP/LCP are paint metrics, not exact app-ready latency. Direct extension intervals include synchronous descendants, exclude asynchronous downstream costs, and do not establish causal total overhead. Sequential batches can have order/network confounding.'}
output = a.trace.with_name(a.trace.stem+'-loads.json')
output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
