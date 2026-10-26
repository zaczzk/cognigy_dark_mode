"""Stage a verified frozen release at Chrome's permanent unpacked path.

This does not install or reload Chrome. Release snapshots are never modified.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--release', required=True)
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9-]+', args.release):
    raise SystemExit('Invalid release label')
release = root / 'releases' / args.release
receipt = json.loads((release / 'receipt.json').read_text(encoding='utf-8'))
target = root / 'chrome-development' / 'extension'
if target.resolve() != target or any(p.is_symlink() for p in [target, target.parent]):
    raise SystemExit('Development path must not be redirected')
digest = lambda data: hashlib.sha256(data).hexdigest()
snapshot = {}
for entry in receipt['files']:
    name = entry['path']
    if Path(name).name != name or not re.fullmatch(r'[a-zA-Z0-9_.-]+', name):
        raise SystemExit('Unexpected release filename')
    data = (release / 'extension' / name).read_bytes()
    if digest(data) != entry['sha256']:
        raise SystemExit('Release checksum mismatch: ' + name)
    snapshot[name] = data
if 'manifest.json' not in snapshot:
    raise SystemExit('Release manifest missing')
state_path = target.parent / 'staged.json'
if target.exists():
    if not state_path.exists():
        raise SystemExit('Existing unmanaged development folder; refusing overwrite')
    previous = json.loads(state_path.read_text(encoding='utf-8'))
    if set(p.name for p in target.iterdir()) != set(previous['sha256']):
        raise SystemExit('Development folder contains unexpected or missing files')
    for name, expected in previous['sha256'].items():
        p = target / name
        if not p.is_file() or p.is_symlink() or digest(p.read_bytes()) != expected:
            raise SystemExit('Development file was changed outside staging: ' + name)
    if set(snapshot) != set(previous['sha256']):
        raise SystemExit('Release file list changed; review migration before staging')
target.mkdir(parents=True, exist_ok=True)
for name, data in snapshot.items():
    temporary = target / (name + '.staging')
    with temporary.open('xb') as f:
        f.write(data)
    os.replace(temporary, target / name)
assert all((target / name).read_bytes() == data for name, data in snapshot.items())
state = {'release': args.release, 'identity': receipt['identity'],
         'sha256': {name: digest(data) for name, data in snapshot.items()}}
state_path.write_text(json.dumps(state, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'path': str(target), **state['identity'],
                  'files': len(snapshot), 'chromeReloadRequired': True}, indent=2))
