/* Local-only harness: unchanged product scripts, real DOM/MutationObserver.
 * Chrome storage/messages and route events are explicit doubles, not installation. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const label=process.argv[2];
if(label&&!/^[a-z0-9-]+$/.test(label))throw new Error('Invalid candidate label');
const extensionRoot=label?'releases/'+label+'/extension':'extension';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
fs.writeFileSync(path.join(__dirname,'controller.generated.js'),
  '(function(location,chrome,navigation){\n'+read(extensionRoot+'/content.js')+'\n})(FixtureRuntime.location,FixtureRuntime.chrome,FixtureRuntime.navigation);\n');
const asset=p=>p+'?v='+crypto.createHash('sha256').update(read(p.replace(/^\//,''))).digest('hex').slice(0,12);
const refs=['/'+extensionRoot+'/build.js','/'+extensionRoot+'/core.js','/'+extensionRoot+'/adapters.js','/tests/browser/view.js','/tests/browser/runtime.js','/tests/browser/controller.generated.js','/tests/browser/journeys.js'].map(p=>'<script src="'+asset(p)+'"></script>').join('');
const workspaces=fs.readdirSync(root).filter(f=>/^(admin|insights|projects|authoring)-.*-fixture\.html$/.test(f)).map(f=>[f.replace('-fixture.html',''),f]);
for(const [name,source] of [...workspaces,['flow','fixture.html'],['agent','agent-dropdown-fixture.html'],['dashboard','dashboard-fixture.html'],['dashboard-menu','dashboard-menu-fixture.html']].filter(([,source])=>fs.existsSync(path.join(root,source)))) {
  let html=read(source).replace('<head>','<head><base href="/">');
  if(!fs.existsSync(path.join(root,extensionRoot,'public.css')))html=html.replace(/<link[^>]+href="extension\/public\.css[^"\s]*"[^>]*>/g,'');
  html=html.replace(/href="(extension\/[^"?]+\.css)\?v=[^"]+"/g,(_,p)=>'href="'+asset('/'+p.replace(/^extension/,extensionRoot))+'"');
  html=html.replace(/<script src="[^\"]*(?:adapters|fixture)\.js[^\"]*"><\/script>/g,'');
  html=html.replace(/<div id="fixture-controls">[\s\S]*?<\/div>/, '<div id="fixture-controls"><button id="compose-dark">Dark</button><button id="compose-native">Original</button><button id="compose-check">Check composition</button><output id="compose-report">Ready</output></div>');
  const end=html.lastIndexOf('</body>');html=html.slice(0,end)+refs+html.slice(end);
  fs.writeFileSync(path.join(__dirname,'composed-'+name+'.html'),html);
  if(name==='flow')fs.writeFileSync(path.join(__dirname,'performance-flow.html'),html.replace('<script src="'+asset('/tests/browser/view.js')+'"></script>','<script src="'+asset('/tests/browser/performance.js')+'"></script><script src="'+asset('/tests/browser/view.js')+'"></script>'));
}
const contract=read('tests/browser/contracts.html').replace(/(src|href)="([^"?]+\.(?:js|css))"/g,(_,attribute,file)=>attribute+'="'+asset(file.startsWith('/')?file.replace(/^\/extension/,'/'+extensionRoot):'/tests/browser/'+file)+'"');
fs.writeFileSync(path.join(__dirname,'contracts.generated.html'),contract);
fs.writeFileSync(path.join(__dirname,'workspace-contracts.generated.html'),read('tests/browser/workspace-contracts.html').replace(/(src|href)="([^"?]+\.(?:js|css))"/g,(_,attribute,file)=>attribute+'="'+asset(file.startsWith('/')?file.replace(/^\/extension/,'/'+extensionRoot):'/tests/browser/'+file)+'"'));
const sources=Object.fromEntries(['build.js','core.js','adapters.js','content.js','application.css','palette.css'].map(f=>[f,crypto.createHash('sha256').update(read(extensionRoot+'/'+f)).digest('hex')]));
fs.writeFileSync(path.join(__dirname,'sources.json'),JSON.stringify({builtAt:new Date().toISOString(),extensionRoot,boundary:'real controller+adapters+DOM; Chrome/route doubles',sources},null,2));
console.log('Composed flow, Agent and dashboard fixtures built from current source.');
