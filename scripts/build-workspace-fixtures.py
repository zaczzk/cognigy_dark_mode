"""Local native-DOM fixtures; account captures never enter the release package."""
from pathlib import Path
import json, subprocess, hashlib
root=Path(__file__).resolve().parents[1]
source=(root/'extension/adapters.js').read_text(encoding='utf-8')
debug=source.replace('const failed=new Set(rejected);','const failed=new Set(rejected);doc.documentElement.setAttribute("data-fixture-rejected",JSON.stringify([...rejected]));')
debug=debug.replace('if(!covered) {failed.add(owner);break;}','''if(!covered) {doc.documentElement.setAttribute("data-fixture-failure",JSON.stringify({owner,tag:e.tagName,cls:e.getAttribute("class"),id:e.id,color:paintValue(e,"color"),fill:paintValue(e,"fill"),mappedInk,mappedFill,nativeIsland,chain:(()=>{let a=[],n=e;while(n&&n!==root.parentElement){a.push({tag:n.tagName,cls:n.getAttribute("class"),bg:paintValue(n,"backgroundColor"),slot:combined.get(n)?.get("data-cg-slot")?.value,ink:combined.get(n)?.get("data-cg-text")?.value});n=n.parentElement;}return a;})()}));failed.add(owner);break;}''')
debug=debug.replace('doc.documentElement.setAttribute("data-fixture-failure",JSON.stringify(', 'doc.documentElement.setAttribute("data-fixture-failure",JSON.stringify([...JSON.parse(doc.documentElement.getAttribute("data-fixture-failure")||"[]"),').replace('}));failed.add(owner);break;}', '}].slice(-30)));failed.add(owner);}')
debug='\n'.join(line.replace('rejected.add(family)', '(rejected.add(family),doc.documentElement.setAttribute("data-fixture-rejection-line","'+str(number)+'"))') for number,line in enumerate(debug.splitlines(),1))
(root/'tests/browser/workspace-debug.generated.js').write_text(debug,encoding='utf-8')
debug_hash=hashlib.sha256(debug.encode()).hexdigest()[:12]
for p in [*root.glob('admin-*-fixture-source.json'),*root.glob('insights-*-fixture-source.json'),*root.glob('projects-*-fixture-source.json'),*root.glob('authoring-*-fixture-source.json')]:
    data=json.loads(p.read_text(encoding='utf-8'))
    if '[Truncated]' in data['css'] or '[Truncated]' in data['html']:
        print('Incomplete capture; recapture required: '+p.name);continue
    data['fixturePreservePaths']=True;p.write_text(json.dumps(data),encoding='utf-8')
    data['fixtureAssets']={prefix+font.name:{'path':str(font.relative_to(root)).replace('\\','/'),'contentType':'font/woff2'} for font in (root/'evidence/workspace-fonts').glob('*.woff2') for prefix in ['/assets/','/insights/assets/']}
    p.write_text(json.dumps(data),encoding='utf-8')
    target=p.name.replace('-source.json','.html')
    subprocess.run(['python',str(root/'build-fixture.py'),p.name,target],check=True,capture_output=True)
    html=(root/target).read_text(encoding='utf-8')
    import re
    diagnostic=re.sub(r'<script src="extension/adapters.js[^\"]*"></script>','<script src="tests/browser/workspace-debug.generated.js?v='+debug_hash+'"></script>',html)
    (root/target.replace('.html','-debug.html')).write_text(diagnostic,encoding='utf-8')
print('Workspace native and diagnostic fixtures built.')

