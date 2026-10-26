"""Create an offline, inert DOM fixture. No vendor scripts or remote assets run."""
import base64,hashlib,json,re,sys
from pathlib import Path
from html.parser import HTMLParser
from html import escape
root=Path(__file__).parent
source_path=root/(sys.argv[1] if len(sys.argv)>1 else 'native-fixture-source.json')
output_path=root/(sys.argv[2] if len(sys.argv)>2 else 'fixture.html')
def asset(name):
    return name+'?v='+hashlib.sha256((root/name).read_bytes()).hexdigest()[:12]
source=json.loads(source_path.read_text(encoding='utf-8'))
# scripts/capture-native-dom.js returns chunked html/css; join them here.
for key in ('html','css'):
    if key not in source:source[key]=''.join(source.get(key+'Chunks',[]))
asset_data={url:'data:'+item['contentType']+';base64,'+base64.b64encode((root/item['path']).read_bytes()).decode('ascii') for url,item in source.get('fixtureAssets',{}).items()}
local_media=source.get('fixtureMedia',{})
# Optional local screenshot crops stand in for native CSS-background artwork in
# offline visual fixtures only. They are never part of the extension package.
backgrounds={key:'data:image/png;base64,'+base64.b64encode((root/value).read_bytes()).decode('ascii') for key,value in source.get('fixtureBackgrounds',{}).items()}
class Sanitizer(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.parts=[];self.skip=0
    def handle_starttag(self,tag,attrs):
        if tag in ('script','iframe','object','embed'):
            self.skip+=1;return
        if self.skip:return
        clean=[]
        for k,v in attrs:
            if k=='src' and v in asset_data:v=asset_data[v]
            if k=='src' and v in local_media:v=local_media[v]
            if k.startswith('on') or k in ('srcset','action','formaction','value','srcdoc'):continue
            if k=='src' and not ((v or '').startswith('data:image/') or v in local_media.values()):continue
            if k in ('href','xlink:href') and not (v or '').startswith('#'):
                if not (source.get('fixturePreservePaths') and (v or '').startswith('/') and not (v or '').startswith('//')):v='#'
            if k=='contenteditable':v='false'
            if k=='style' and v:
                for url,data in backgrounds.items():v=v.replace(url,data)
                for url,data in asset_data.items():v=v.replace(url,data)
            clean.append(k if v is None else k+'="'+escape(v,quote=True)+'"')
        self.parts.append('<'+tag+(' '+' '.join(clean) if clean else '')+'>')
    def handle_endtag(self,tag):
        if tag in ('script','iframe','object','embed'):
            self.skip=max(0,self.skip-1);return
        if not self.skip:self.parts.append('</'+tag+'>')
    def handle_data(self,data):
        if not self.skip:self.parts.append(escape(data))
p=Sanitizer();p.feed(source['html'])
css=re.sub(r'@import[^;]+;','',source['css'])
# Serialized SVG URLs can contain parentheses inside quotes. Removing only up
# to their first ')' corrupts following CSS, including Monaco's native palette.
def local_url(match):
    url=match.group()[4:-1].strip().strip('"\'')
    if url.startswith('data:image/'):return match.group()
    return 'url("'+asset_data[url]+'")' if url in asset_data else 'none'
css=re.sub(r'''url\((?:[^'"()]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\)''',local_url,css)
origin=escape(source.get('origin','https://trial.cognigy.ai'),quote=True)
pathname=escape(source.get('pathname','/project/example/example/flow/example/chart'),quote=True)
view=escape(source.get('fixtureView',''),quote=True)
select_offset=escape(str(source.get('fixtureSelectOffset','')),quote=True)
html='''<!doctype html><html lang="en" data-fixture-origin="'''+origin+'''" data-fixture-path="'''+pathname+'''" data-fixture-view="'''+view+'''" data-fixture-select-offset="'''+select_offset+'''"><head><meta charset="utf-8"><title>Cognigy Graphite · Native DOM test</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; media-src 'self'">
<link rel="stylesheet" href="'''+asset('extension/palette.css')+'''"><style>'''+css+'''</style>
<link rel="stylesheet" href="'''+asset('extension/application.css')+'''"><link rel="stylesheet" href="'''+asset('fixture.css')+'''"></head><body>'''+''.join(p.parts)+'''
<div id="fixture-controls"><button id="fixture-original">Original</button><button id="fixture-dark">Dark</button><button id="fixture-guards">Check safeguards</button><output id="fixture-report">Native DOM fixture</output></div>
<script src="'''+asset('extension/adapters.js')+'''"></script><script src="'''+asset('fixture.js')+'''"></script></body></html>'''
output_path.write_text(html,encoding='utf-8')
print('Offline fixture generated; remote scripts, events, links and assets disabled.')
