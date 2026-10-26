const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../extension'),sites=require(path.join(base,'sites.js'));
const flush=()=>new Promise(r=>setImmediate(r));
const entry=(origin='https://tenant.example.com',basePath='')=>({origin,basePath,enabled:true,verified:false,rev:'revision-1'});
test('addresses discard account route/query data and enforce HTTPS, public exclusion and segment boundaries',()=>{
  assert.deepEqual(sites.address('https://tenant.example.com/cognigy/project/private/account/flow/secret/chart?token=secret'),{origin:'https://tenant.example.com',basePath:'/cognigy'});
  for(const input of ['http://tenant.example.com','https://tenant.example.com:8443','https://user:pass@tenant.example.com','https://*.example.com','https://cognigy.com/projects','https://www.cognigy.com','javascript:alert(1)','https://tenant.example.com./projects'])assert.throws(()=>sites.address(input));
  const record=entry(undefined,'/cognigy');
  for(const path of ['/cognigy/projects','/cognigy/project/a/b','/cognigy/admincenter/auditevents','/cognigy/insights/a'])assert.ok(sites.logicalPath(new URL(record.origin+path),record));
  for(const path of ['/','/products','/cognigyevil/projects','/cognigy/projects-news','/cognigy/login'])assert.equal(sites.logicalPath(new URL(record.origin+path),record),null);
  assert.equal(sites.logicalPath(new URL('https://other.example.com/cognigy/projects'),record),null);
});
function workerHarness(initial,manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'))) {
  // Content-script matches are not the scripting API's explicit host grants.
  // Derive installation grants from the shipped manifest, never seed trial.
  const data=initial===undefined?{}:{[sites.key]:initial},grants=new Set(manifest.host_permissions||[]),registered=new Map(),calls=[];let receive;let failRegister=false,counter=0,scriptResult={origin:'https://tenant.example.com',top:true,styles:false,active:true,recognized:false};
  const events={};const event=name=>({addListener(fn){events[name]=fn;}});
  const chrome={runtime:{id:'extension',getURL:p=>'chrome-extension://extension/'+p,onMessage:{addListener(fn){receive=fn;}},onInstalled:event('installed'),onStartup:event('startup')},
    storage:{onChanged:event('storage'),local:{async get(keys){if(Array.isArray(keys))return Object.fromEntries(keys.map(k=>[k,data[k]]));return {[keys]:data[keys]};},async set(values){Object.assign(data,values);},async remove(key){delete data[key];}}},
    permissions:{async contains({origins}){return origins.every(o=>grants.has(o));},async remove({origins}){origins.forEach(o=>grants.delete(o));return true;},onAdded:event('added'),onRemoved:event('removed')},
    scripting:{async getRegisteredContentScripts(){return [...registered.values()];},async registerContentScripts(values){if(failRegister)throw new Error('failed');for(const r of values)registered.set(r.id,r);},async updateContentScripts(values){for(const r of values){if(!registered.has(r.id))throw new Error('missing');registered.set(r.id,{...registered.get(r.id),...r});}},async unregisterContentScripts({ids}){ids.forEach(id=>registered.delete(id));},async executeScript(args){calls.push(args);if(args.files)return [{result:undefined}];return [{result:scriptResult}];},async insertCSS(args){calls.push(args);}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(base,'worker.js'),'utf8'),{chrome,CogGraphiteSites:sites,importScripts(){},URL,crypto:{randomUUID:()=>String(++counter)}});
  return {data,grants,registered,calls,events,scriptResult(value){scriptResult=value;},failRegistration(){failRegister=true;},send(message,sender={id:'extension',url:'chrome-extension://extension/popup.html'}){return new Promise(resolve=>{const accepted=receive(message,sender,resolve);if(!accepted)resolve(undefined);});}};
}
test('only extension UI can enrol; denied grants cannot register; registration is exact-host and light',async()=>{
  const h=workerHarness([]),profile=entry();
  assert.equal(await h.send({type:'SITE_ENABLE',...profile},{id:'extension',url:profile.origin+'/projects',tab:{id:1}}),undefined);
  assert.equal((await h.send({type:'SITE_ENABLE',...profile})).ok,false);assert.equal(h.registered.size,0);
  h.grants.add(sites.pattern(profile.origin));assert.equal((await h.send({type:'SITE_ENABLE',...profile})).ok,true);
  const registration=[...h.registered.values()][0];assert.deepEqual([...registration.matches],[profile.origin+'/*']);assert.deepEqual([...registration.js],['sites.js','bootstrap.js']);assert.equal(registration.allFrames,false);assert.equal(registration.matchOriginAsFallback,false);assert.equal(registration.runAt,'document_start');
});

test('fresh trial installation activates from manifest host permission without popup enrolment',async()=>{
  const h=workerHarness(),list=await h.send({type:'SITES_LIST'}),record=list.sites[0];
  assert.equal(record.origin,sites.trial);assert.equal(record.enabled,true);assert.equal(record.permission,true);
  const sender={id:'extension',url:sites.trial+'/projects',frameId:0,documentId:'trial-document',tab:{id:9}};
  assert.equal((await h.send({type:'CG_ACTIVATE',rev:record.rev,token:1},sender)).ok,true);
  assert.ok(h.calls.some(call=>call.files?.includes('content.js')));assert.equal(h.registered.size,1);
  const scripts=h.calls.filter(call=>call.func||call.files?.some(file=>file.endsWith('.js')));
  assert.equal(scripts.length,3,'one gate, one controller injection and one result probe');
  assert.ok(scripts.every(call=>call.injectImmediately===true),'startup must never wait for document_idle');
});

test('content-script matching and optional eligibility alone do not grant worker injection',async()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));delete manifest.host_permissions;
  const h=workerHarness(undefined,manifest),record=(await h.send({type:'SITES_LIST'})).sites[0];
  assert.equal(record.permission,false);
  const sender={id:'extension',url:sites.trial+'/projects',frameId:0,documentId:'trial-document',tab:{id:9}};
  assert.equal((await h.send({type:'CG_ACTIVATE',rev:record.rev,token:1},sender)).ok,false);assert.equal(h.calls.length,0);
});

test('withheld trial access stays native and an upgrade preserves intentional pause',async()=>{
  const h=workerHarness(),record=(await h.send({type:'SITES_LIST'})).sites[0];h.grants.clear();
  assert.equal((await h.send({type:'SITES_LIST'})).sites[0].permission,false);
  const sender={id:'extension',url:sites.trial+'/projects',frameId:0,documentId:'trial-document',tab:{id:9}};
  assert.equal((await h.send({type:'CG_ACTIVATE',rev:record.rev,token:1},sender)).ok,false);assert.equal(h.calls.length,0);
  const paused=workerHarness([{...entry(sites.trial),enabled:false}]);paused.events.installed();await flush();
  assert.equal((await paused.send({type:'SITES_LIST'})).sites[0].enabled,false);
});
test('registration failure persists paused; restart does not silently enable it',async()=>{
  const h=workerHarness([]);h.grants.add(sites.pattern(entry().origin));h.failRegistration();assert.equal((await h.send({type:'SITE_ENABLE',...entry()})).ok,false);
  assert.equal(h.data[sites.key][0].enabled,false);h.events.startup();await flush();assert.equal(h.registered.size,0);
});
test('worker-only restart repairs a missing persistent registration without a browser startup event',async()=>{
  const record=entry(),h=workerHarness([record]);h.grants.add(sites.pattern(record.origin));await flush();
  assert.equal(h.registered.size,1);assert.equal(h.calls.length,0);
});
test('remove keeps trial removed across restart and clears preferences',async()=>{
  const h=workerHarness();await h.send({type:'SITES_LIST'});h.data[sites.preferenceKey(sites.trial)]={mode:'dark'};
  assert.equal((await h.send({type:'SITE_REMOVE',origin:sites.trial,basePath:''})).ok,true);
  h.events.startup();await flush();assert.equal((await h.send({type:'SITES_LIST'})).sites.length,0);assert.equal(h.data[sites.preferenceKey(sites.trial)],undefined);
});
test('permission revocation pauses the registry and unregisters without browsing watchers',async()=>{
  const h=workerHarness([]),record=entry();h.grants.add(sites.pattern(record.origin));await h.send({type:'SITE_ENABLE',...record});h.grants.delete(sites.pattern(record.origin));h.events.removed();await flush();
  assert.equal(h.data[sites.key][0].enabled,false);assert.equal(h.registered.size,0);assert.equal(h.calls.length,0);
});
test('activation rejects frames, other origins, native paths and stale revisions before injection',async()=>{
  const record=entry(),h=workerHarness([record]);h.grants.add(sites.pattern(record.origin));
  const sender={id:'extension',url:record.origin+'/projects',frameId:0,documentId:'document-a',tab:{id:9}};
  for(const bad of [{...sender,frameId:2},{...sender,url:'https://other.example.com/projects'},{...sender,url:record.origin+'/products'}])assert.equal((await h.send({type:'CG_ACTIVATE',rev:record.rev,token:1},bad)).ok,false);
  assert.equal((await h.send({type:'CG_ACTIVATE',rev:'old',token:1},sender)).ok,false);assert.equal(h.calls.length,0);
  assert.equal((await h.send({type:'CG_ACTIVATE',rev:record.rev,token:1},sender)).ok,true);
  assert.ok(h.calls.every(c=>c.target.tabId===9&&c.target.documentIds[0]==='document-a'));
});
test('one-click enable rejects a page that navigated to a different origin',async()=>{
  const h=workerHarness([]),record=entry('https://changed.example.com');h.grants.add(sites.pattern(record.origin));
  assert.equal((await h.send({type:'SITE_ENABLE',...record,tabId:7,documentId:'old-document'})).ok,false);assert.equal(h.data[sites.key].length,0);
});
test('bootstrap leaves non-app routes idle and prevents late activation after exit or remove',async()=>{
  const record=entry(),events={},requests=[];let storageListener,resolveRequest,destroys=0;
  const environment={document:{documentElement:{removeAttribute(){}}},URL,CogGraphiteSites:sites,location:{origin:record.origin,pathname:'/products'},addEventListener(name,fn){events[name]=fn;},navigation:{addEventListener(name,fn){events[name]=fn;}},chrome:{runtime:{id:'extension',onMessage:{addListener(){}},sendMessage(message){requests.push(message);return new Promise(r=>resolveRequest=r);}},storage:{local:{async get(){return {[sites.key]:[record]};}},onChanged:{addListener(fn){storageListener=fn;}}}}};
  environment.window=environment;environment.top=environment;vm.runInNewContext(fs.readFileSync(path.join(base,'bootstrap.js'),'utf8'),environment);await flush();assert.equal(requests.length,0);
  environment.location.pathname='/projects';events.currententrychange();assert.equal(requests.length,1);
  const token=requests[0].token;environment.location.pathname='/products';events.currententrychange();assert.equal(environment.CogGraphiteGate.prepare(record,token),false);resolveRequest({ok:true});await flush();assert.equal(environment.CogGraphiteSession,undefined);
  environment.location.pathname='/projects';events.currententrychange();const nextToken=requests[1].token;assert.ok(environment.CogGraphiteGate.prepare(record,nextToken));
  environment.CogGraphiteController={destroy(){destroys++;delete environment.CogGraphiteController;}};
  storageListener({[sites.key]:{newValue:[]}},'local');assert.equal(destroys,1);assert.equal(environment.CogGraphiteGate.prepare(record,nextToken),false);assert.equal(environment.CogGraphiteSession,undefined);
});

test('late recognition persists only for an approved current document and revision',async()=>{
  const record=entry(),h=workerHarness([record]);h.grants.add(sites.pattern(record.origin));
  const sender={id:'extension',url:record.origin+'/projects',frameId:0,documentId:'document-a',tab:{id:9}};
  h.scriptResult(false);
  assert.equal((await h.send({type:'CG_VERIFIED',rev:record.rev},sender)).ok,false);
  assert.equal(h.data[sites.key][0].verified,false);
  h.scriptResult(true);
  for(const bad of [{...sender,frameId:1},{...sender,url:record.origin+'/products'},{...sender,url:'https://other.example.com/projects'}])assert.equal((await h.send({type:'CG_VERIFIED',rev:record.rev},bad)).ok,false);
  assert.equal((await h.send({type:'CG_VERIFIED',rev:'stale'},sender)).ok,false);
  assert.equal((await h.send({type:'CG_VERIFIED',rev:record.rev},sender)).ok,true);
  assert.equal(h.data[sites.key][0].verified,true);
  assert.ok(h.calls.every(c=>c.target.documentIds[0]==='document-a'&&c.injectImmediately));
  assert.equal(h.data[sites.key][0].rev,record.rev,'recognition must not revoke the live gate');
});

test('startup canvas follows saved mode and exact application paths, and unregisters for Original',async()=>{
  const record={...entry(),basePath:'/cognigy',verified:true},h=workerHarness([record]);h.grants.add(sites.pattern(record.origin));
  h.events.startup();await flush();
  const id=sites.registrationId(record.origin)+'-startup';
  let script=h.registered.get(id);assert.ok(script);assert.deepEqual([...script.js],['startup-system.js','sites.js','bootstrap.js','build.js','core.js','adapters.js','content.js']);assert.deepEqual([...script.css],['startup.css','palette.css','application.css']);
  assert.ok(script.matches.includes(record.origin+'/cognigy/admincenter/*'));
  assert.ok(script.matches.includes(record.origin+'/cognigy/projects'));
  assert.equal(script.matches.includes(record.origin+'/*'),false);assert.equal(script.allFrames,false);
  const key=sites.preferenceKey(record.origin);h.data[key]={mode:'dark'};h.events.storage({[key]:{newValue:h.data[key]}},'local');await flush();
  assert.equal(h.registered.get(id).js[0],'startup-dark.js');
  h.data[key]={mode:'native'};h.events.storage({[key]:{newValue:h.data[key]}},'local');await flush();assert.equal(h.registered.has(id),false);
  h.data[key]={mode:'dark',extra:true};h.events.storage({[key]:{newValue:h.data[key]}},'local');await flush();assert.equal(h.registered.has(id),false);
});

test('paused and removed trial sites cannot retain a startup canvas registration',async()=>{
  const h=workerHarness(),record=(await h.send({type:'SITES_LIST'})).sites[0];h.events.startup();await flush();
  assert.ok(h.registered.has(sites.registrationId(record.origin)+'-startup'));
  await h.send({type:'SITE_PAUSE',origin:record.origin,basePath:''});assert.equal(h.registered.size,0);
  await h.send({type:'SITE_REMOVE',origin:record.origin,basePath:''});h.events.startup();await flush();assert.equal(h.registered.size,0);
});

test('unverified custom sites never prepaint and a page cannot request startup synchronization',async()=>{
  const record=entry(),h=workerHarness([record]);h.grants.add(sites.pattern(record.origin));h.events.startup();await flush();
  assert.equal(h.registered.has(sites.registrationId(record.origin)+'-startup'),false);
  assert.equal(await h.send({type:'SYNC_STARTUP'},{id:'extension',url:record.origin+'/projects',tab:{id:1}}),undefined);
  assert.equal((await h.send({type:'SYNC_STARTUP'})).ok,true);
});


test('preloaded bundle starts locally only after current registry and route validation',async()=>{
  for(const scenario of ['approved','paused','removed','public']) {
    const record=entry(),events={},requests=[];let started=0,storageListener;
    if(scenario==='paused')record.enabled=false;
    const environment={CogGraphitePreloaded:true,document:{documentElement:{removeAttribute(){}}},URL,CogGraphiteSites:sites,
      location:{origin:record.origin,pathname:scenario==='public'?'/products':'/projects'},
      addEventListener(name,fn){events[name]=fn;},navigation:{addEventListener(name,fn){events[name]=fn;}},
      chrome:{runtime:{id:'extension',onMessage:{addListener(){}},async sendMessage(message){requests.push(message);return {ok:false};}},
        storage:{local:{async get(){return {[sites.key]:scenario==='removed'?[]:[record]};}},onChanged:{addListener(fn){storageListener=fn;}}}}};
    environment.window=environment;environment.top=environment;
    environment.CogGraphiteStart=()=>{assert.ok(environment.CogGraphiteSession.active());started++;environment.CogGraphiteController={route(){},destroy(){delete environment.CogGraphiteController;}};};
    vm.runInNewContext(fs.readFileSync(path.join(base,'bootstrap.js'),'utf8'),environment);
    assert.equal(started,0,'must wait for saved registry');await flush();
    assert.equal(started,scenario==='approved'?1:0);assert.equal(requests.length,0,'preloaded start must not need worker activation');
    if(scenario==='approved') {
      assert.equal(environment.CogGraphiteGate.styles,true);
      const session=environment.CogGraphiteSession;
      storageListener({[sites.key]:{newValue:[]}},'local');
      assert.ok(!session.active());assert.equal(environment.CogGraphiteController,undefined);
    }
  }
});



test('registered scripts share storage reads and supersede an in-flight worker activation',async()=>{
  const record=entry(),events={},requests=[];let reads=0,resolveRead,started=0;
  const environment={document:{documentElement:{removeAttribute(){}}},URL,CogGraphiteSites:sites,
    location:{origin:record.origin,pathname:'/projects'},addEventListener(name,fn){events[name]=fn;},navigation:{addEventListener(name,fn){events[name]=fn;}},
    chrome:{runtime:{id:'extension',onMessage:{addListener(){}},sendMessage(message){requests.push(message);return new Promise(()=>{});}},storage:{local:{get(){reads++;return new Promise(r=>resolveRead=r);}},onChanged:{addListener(){}}}}};
  environment.window=environment;environment.top=environment;
  vm.runInNewContext(fs.readFileSync(path.join(base,'bootstrap.js'),'utf8'),environment);
  environment.CogGraphiteGate.sync();assert.equal(reads,1);
  resolveRead({[sites.key]:[record]});await flush();assert.equal(requests.length,1);
  const staleToken=requests[0].token;
  environment.CogGraphitePreloaded=true;
  environment.CogGraphiteStart=()=>{started++;environment.CogGraphiteController={route(){},destroy(){}};};
  const resumed=environment.CogGraphiteGate.sync();
  resolveRead({[sites.key]:[record]});await resumed;
  assert.equal(started,1);assert.equal(requests.length,1);
  assert.equal(environment.CogGraphiteGate.prepare(record,staleToken),false,'late worker cannot replace local session');
});
