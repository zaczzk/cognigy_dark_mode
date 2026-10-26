"""Freeze an allowlisted candidate; never collect fixtures or account captures."""
import argparse, hashlib, json, uuid, zipfile
from datetime import datetime, timezone
from pathlib import Path

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--label',required=True)
args=parser.parse_args()
if not args.label or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in args.label):
    raise SystemExit('Label must contain lowercase letters, digits and hyphens only')
files=['sites.js','worker.js','bootstrap.js','startup-dark.js','startup-system.js','startup.css','site-ui.js','build.js','core.js','adapters.js','content.js','manifest.json','palette.css','application.css','popup.html','popup.js','popup.css','README.md']
source=root/'extension'
snapshot={name:(source/name).read_bytes() for name in files}
manifest=json.loads(snapshot['manifest.json'])
destination=root/'releases'/args.label
if destination.exists(): raise SystemExit('Candidate already exists; never overwrite a frozen build')
destination.mkdir(parents=True)
folder=destination/'extension';folder.mkdir()
candidate_id=str(uuid.uuid4())
identity={'candidateId':candidate_id,'version':manifest['version'],'protocolVersion':1}
for name,data in snapshot.items(): (folder/name).write_bytes(data)
(folder/'build.js').write_text('/* Frozen candidate identity. */\nglobalThis.CogGraphiteBuild=Object.freeze('+json.dumps(identity,separators=(',',':'))+');\n',encoding='utf-8')
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
receipt={'createdAt':datetime.now(timezone.utc).isoformat(),'identity':identity,'files':[{'path':n,'sha256':digest(folder/n),'sourceSha256':hashlib.sha256(snapshot[n]).hexdigest(),'bytes':(folder/n).stat().st_size} for n in files],
 'scope':'Development candidate toward v1; installed acceptance pending','privateCapturesIncluded':False,'generatedFiles':['build.js']}
assert all((folder/name).read_bytes()==data for name,data in snapshot.items() if name!='build.js')
assert all((source/name).read_bytes()==data for name,data in snapshot.items()), 'Source changed during freeze; discard this candidate and rerun with a new label'
archive=destination/('cognigy-graphite-'+manifest['version']+'-'+args.label+'.zip')
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED) as z:
    for name in files:z.write(folder/name,name)
with zipfile.ZipFile(archive) as z:
    assert sorted(z.namelist())==sorted(files)
    assert all(z.read(name)==(folder/name).read_bytes() for name in files)
receipt['archive']={'path':archive.name,'sha256':digest(archive),'bytes':archive.stat().st_size}
(destination/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'folder':str(folder),'archive':str(archive),'candidateId':candidate_id,'files':len(files),'archiveSha256':receipt['archive']['sha256']},indent=2))
