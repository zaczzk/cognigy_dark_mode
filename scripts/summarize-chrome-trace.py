"""Summarize a locally exported Chrome trace; no browser connection or upload.

Pixel samples flag candidates for visual review, not universal flash acceptance.
Direct extension durations are inclusive and may overlap; not page-load overhead.
"""
import argparse
import base64
import gzip
import io
import json
from pathlib import Path
from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument('trace', type=Path)
parser.add_argument('--extension-id', required=True)
args = parser.parse_args()
raw = args.trace.read_bytes()
data = json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)
events = data['traceEvents']
shots = [e for e in events if e['name'] == 'Screenshot']
own = [e for e in events if e['name'] in ('EvaluateScript', 'FunctionCall')
       and args.extension_id in json.dumps(e.get('args', {}))]
summary = {'frames': len(shots), 'lightTopLeftFrames': [], 'largeLightAreaFrames': [],
           'directExtensionEvents': len(own),
           'maximumInclusiveEventMs': max((e.get('dur', 0) for e in own), default=0)/1000,
           'summedInclusiveEventMs': sum(e.get('dur', 0) for e in own)/1000,
           'navigationAndPaint': []}
for e in events:
    if e['name'] in ('navigationStart', 'firstContentfulPaint', 'largestContentfulPaint::Candidate', 'MarkDOMContent', 'MarkLoad'):
        summary['navigationAndPaint'].append({'name': e['name'], 'ts': e['ts'], 'args': e.get('args', {})})
if shots:
    # Split contact sheets to keep review legible even for long captures.
    for offset in range(0, len(shots), 40):
        batch = shots[offset:offset+40]
        canvas = Image.new('RGB', (1000, ((len(batch)+3)//4)*190), '#555')
        draw = ImageDraw.Draw(canvas)
        for j, e in enumerate(batch):
            i = offset+j
            im = Image.open(io.BytesIO(base64.b64decode(e['args']['snapshot']))).convert('RGB')
            if min(im.getpixel((5, 5))) > 180:
                summary['lightTopLeftFrames'].append(i)
            # A persistent dark sidebar can hide a white main page from the
            # corner probe. Sample the entire frame; media can also trigger
            # this flag, so it always requires visual interpretation.
            probe = im.copy()
            probe.thumbnail((160, 100))
            pixels = list(probe.getdata())
            light_fraction = sum(min(p) > 180 and max(p)-min(p) < 35 for p in pixels)/len(pixels)
            if light_fraction > .15:
                summary['largeLightAreaFrames'].append({'frame': i, 'fraction': round(light_fraction, 3)})
            im.thumbnail((245, 160))
            x, y = (j % 4)*250, (j//4)*190
            canvas.paste(im, (x, y+22))
            draw.text((x+4, y+3), f"{i}: {(e['ts']-shots[0]['ts'])/1e6:.3f}s", fill='white')
        canvas.save(args.trace.with_name(args.trace.stem+f'-filmstrip-{offset//40}.png'))
args.trace.with_name(args.trace.stem+'-summary.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps({k: (len(v) if k in ('lightTopLeftFrames', 'largeLightAreaFrames') else v) for k, v in summary.items() if k != 'navigationAndPaint'}, indent=2))
