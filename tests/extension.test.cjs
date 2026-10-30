const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'../extension');
const core=require(path.join(base,'core.js'));
test('exact sites and strict preference values',()=>{
  assert.equal(core.sites['https://trial.cognigy.ai'],'trial');
  for(const origin of ['https://cognigy.com','https://www.cognigy.com','http://trial.cognigy.ai','https://trial.cognigy.ai:444','https://evil.trial.cognigy.ai','https://trial.cognigy.ai.evil.com'])assert.equal(core.sites[origin],undefined);
  for(const value of [null,{},'dark',{mode:'bright'},{mode:'dark',extra:true}])assert.equal(core.modeOf(value),'native');
  assert.equal(core.modeOf({mode:'dark'}),'dark');
  assert.equal(core.modeOf(undefined),'system');
  assert.equal(core.modeOf({mode:'native'}),'native');
  assert.equal(core.requestedDark('system',false),false);
  assert.equal(core.requestedDark('system',true),true);
  for(const value of [undefined,null,{},{level:'standard'},{level:'MORE'},{level:'more',extra:true}])assert.equal(core.contrastOf(value),'standard');
  assert.equal(core.contrastOf({level:'more'}),'more');
});
class Element {
  constructor(){this.attrs=new Map();}
  getAttribute(name){return this.attrs.has(name)?this.attrs.get(name):null;}
  hasAttribute(name){return this.attrs.has(name);}
  setAttribute(name,value){this.attrs.set(name,value);}
  removeAttribute(name){this.attrs.delete(name);}
}
function harness({initial='native',missing=false,defer=false,origin='https://trial.cognigy.ai',navigation=true,retry=false}={}) {
  const storageKey='cogDepth.v1.'+core.sites[origin];
  const root=new Element(),paint=new Element(),events={},nav={},media={},qualifications=[],observations=[];let stored=missing?undefined:{mode:initial},contrastStored,storageListener,receiver,resolveGet,mutation;
  const timers=new Map(),frames=new Map();let timerId=0;
  const environment={location:{origin},document:{documentElement:root,addEventListener(name,fn){events[name]=fn;}},CogGraphiteCore:core,
    CogGraphiteAdapters:{qualify(doc,loc,own,only){qualifications.push(only?[...only]:null);own(paint,'data-cg-slot','panel','chart');return {applied:true,partial:retry,retryFamilies:retry&&(!only||only.has('chat'))?['chat']:[]};}},
    matchMedia(query){return media[query]??={matches:false,addEventListener(name,fn){this.listener=fn;}};},
    queueMicrotask,setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},requestAnimationFrame(fn){frames.set(++timerId,fn);return timerId;},cancelAnimationFrame(id){frames.delete(id);},MutationObserver:class{constructor(fn){mutation=fn;}observe(target,options){observations.push(options);}disconnect(){}},
    addEventListener(name,fn){events[name]=fn;},
    chrome:{storage:{local:{get(){if(defer)return new Promise(r=>resolveGet=r);return Promise.resolve({[storageKey]:stored,[core.contrastKey]:contrastStored});}},onChanged:{addListener(fn){storageListener=fn;}}},runtime:{id:'extension-id',onMessage:{addListener(fn){receiver=fn;}}}},
  };
  environment.window=environment;environment.top=environment;
  if(navigation)environment.navigation={addEventListener(name,fn){nav[name]=fn;}};
  vm.runInNewContext(fs.readFileSync(path.join(base,'content.js'),'utf8'),environment);
  return {root,paint,events,nav,media,environment,qualifications,observations,timers,frames,runFrames(){for(const [id,fn] of [...frames]){frames.delete(id);fn();}},runTimers(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}},mutate(records){mutation(records);},
    set(mode){stored={mode};storageListener({[storageKey]:{newValue:stored}},'local');},
    stored(mode){stored={mode};},
    contrast(level){contrastStored={level};storageListener({[core.contrastKey]:{newValue:contrastStored}},'local');},
    deferNext(){defer=true;},
    complete(mode){resolveGet({[storageKey]:{mode},[core.contrastKey]:contrastStored});defer=false;},
    status(id=7){return new Promise(resolve=>receiver({type:'GET_STATUS',requestId:id},{id:'extension-id'},resolve));}
  };
}
const flush=()=>new Promise(r=>setImmediate(r));
test('destroy is terminal during pending preference reads and queued qualification',async()=>{
  const h=harness({initial:'dark',defer:true});h.environment.CogGraphiteController.destroy();h.complete('dark');await flush();
  assert.equal(h.root.attrs.size,0);assert.equal(h.paint.attrs.size,0);assert.equal(h.qualifications.length,0);assert.equal(h.environment.CogGraphiteController,undefined);
  h.set('dark');await flush();h.runTimers();assert.equal(h.qualifications.length,0);
});
test('an in-flight status reply reports native after its controller is destroyed',async()=>{
  const h=harness({initial:'dark'});await flush();h.deferNext();const reply=h.status();h.environment.CogGraphiteController.destroy();h.complete('dark');
  const result=await reply;assert.equal(result.appliedMode,'native');assert.equal(result.status,'unsupported');assert.equal(h.root.attrs.size,0);
});
test('Original removes all paint; System and forced colours resolve correctly',async()=>{
  const h=harness({initial:'dark'});await flush();assert.equal(h.root.getAttribute('data-cg-palette'),'graphite-v3');
  h.set('native');await flush();assert.equal(h.root.attrs.size,0);assert.equal(h.paint.attrs.size,0);
  h.set('system');await flush();assert.equal(h.root.attrs.size,0);
  const dark=h.media['(prefers-color-scheme: dark)'];dark.matches=true;dark.listener();await flush();assert.equal(h.root.attrs.size,2);
  const forced=h.media['(forced-colors: active)'];forced.matches=true;forced.listener();await flush();assert.equal(h.root.attrs.size,0);
  assert.equal((await h.status()).status,'forced');
});
test('new storage event wins over delayed initial read',async()=>{
  const h=harness({defer:true});h.set('dark');h.complete('native');await flush();assert.equal(h.root.getAttribute('data-cg-palette'),'graphite-v3');
});
test('new sites follow system changes while saved Original and Dark override them',async()=>{
  for(const origin of Object.keys(core.sites)) {
    const h=harness({origin,missing:true});await flush();assert.equal((await h.status()).savedMode,'system');
    const preference=h.media['(prefers-color-scheme: dark)'];preference.matches=true;preference.listener();await flush();assert.equal((await h.status()).appliedMode,'dark');
    h.set('native');await flush();preference.matches=false;preference.listener();preference.matches=true;preference.listener();await flush();assert.equal(h.root.attrs.size,0);
    h.set('dark');await flush();preference.matches=false;preference.listener();await flush();assert.equal((await h.status()).appliedMode,'dark');
    h.set('system');await flush();assert.equal(h.root.attrs.size,0);preference.matches=true;preference.listener();await flush();assert.equal((await h.status()).appliedMode,'dark');
  }
});
test('BFCache page show reloads storage before applying',async()=>{
  const h=harness({initial:'dark'});await flush();h.events.pagehide();assert.equal(h.root.attrs.size,0);
  h.stored('native');h.events.pageshow();assert.equal(h.root.attrs.size,0);await flush();assert.equal(h.root.attrs.size,0);
  assert.equal((await h.status()).savedMode,'native');
});
test('missing Navigation API and marker collisions fail native',async()=>{
  const h=harness({initial:'dark',navigation:false});await flush();assert.equal(h.root.attrs.size,0);assert.equal((await h.status()).status,'unsupported');
  const j=harness({defer:true});j.paint.setAttribute('data-cg-slot','someone-else');j.complete('dark');await flush();
  assert.equal(j.root.attrs.size,0);assert.equal(j.paint.getAttribute('data-cg-slot'),'someone-else');
});
test('navigation retains the outgoing theme until commit and reports actual mode',async()=>{
  const h=harness({initial:'dark'});await flush();h.nav.navigate();assert.equal(h.root.getAttribute('data-cg-palette'),'graphite-v3');
  h.nav.navigatesuccess();await flush();const status=await h.status(42);
  assert.equal(status.requestId,42);assert.equal(status.siteId,'trial');assert.equal(status.savedMode,'dark');assert.equal(status.appliedMode,'dark');
});
test('ordinary pageshow preserves startup paint; restored documents still refresh',async()=>{
  const h=harness({initial:'dark'});await flush();const count=h.qualifications.length;
  h.events.pageshow({persisted:false});assert.equal(h.root.getAttribute('data-cg-palette'),'graphite-v3');await flush();
  assert.equal(h.qualifications.length,count);
  h.events.pagehide();h.stored('native');h.events.pageshow({persisted:true});await flush();assert.equal(h.root.attrs.size,0);
});
test('partial qualification retains activation but clears it if no owner survives',async()=>{
  const h=harness({initial:'dark'});await flush();
  let activationDuringQualification;
  h.environment.CogGraphiteAdapters.qualify=()=>{activationDuringQualification=h.root.getAttribute('data-cg-palette');return {applied:false};};
  const inspector={nodeType:1,closest(s){return s==='#editSidebarWrapper,.MuiAutocomplete-popper'?this:null;}};
  h.mutate([{type:'attributes',attributeName:'class',target:inspector}]);await flush();
  assert.equal(activationDuringQualification,'graphite-v3');assert.equal(h.paint.getAttribute('data-cg-slot'),'panel');
  const chart={nodeType:1,closest(s){return s==='#flowChartEditorTabContent'?this:null;}};
  h.mutate([{type:'attributes',attributeName:'class',target:chart}]);await flush();assert.equal(h.paint.attrs.size,0);assert.equal(h.root.attrs.size,0);
  assert.equal((await h.status()).status,'unsupported');
});
test('Original skips mutation traversal and qualifies current DOM when Dark is selected',async()=>{
  const h=harness();await flush();
  const target={nodeType:1,closest(){throw new Error('Original must not traverse owners');}};
  h.mutate([{type:'attributes',attributeName:'class',target}]);await flush();assert.equal(h.qualifications.length,0);
  h.set('dark');await flush();assert.equal(h.qualifications.length,1);
});
test('status reads preserve settled paint and reconcile an unannounced preference',async()=>{
  const h=harness({initial:'dark'});await flush();const count=h.qualifications.length;
  const first=await h.status(1),second=await h.status(2);
  assert.equal(h.qualifications.length,count);assert.equal(second.appliedMode,'dark');
  assert.equal(h.root.getAttribute('data-cg-build'),first.candidateId);assert.equal(first.candidateId,'development');assert.equal(first.protocolVersion,1);
  assert.deepEqual(Array.from(first.activeFamilies),['chart']);
  assert.equal(first.routeFamily,'unmapped');
  h.stored('native');assert.equal((await h.status(3)).savedMode,'native');assert.equal(h.paint.attrs.size,0);
  h.stored('dark');assert.equal((await h.status(4)).appliedMode,'dark');assert.equal(h.qualifications.length,count+1);
});
test('only affected paint families requalify; transforms and excluded trees are ignored',async()=>{
  const h=harness({initial:'dark'});await flush();const count=h.qualifications.length;
  let style='transform: translate(1px, 2px)';
  const target={nodeType:1,matches(){return false;},closest(selector){return selector==='#flowChartEditorTabContent'?this:null;},getAttribute(){return style;}};
  h.mutate([{type:'attributes',attributeName:'style',oldValue:'transform: translate(0px, 0px)',target}]);await flush();assert.equal(h.qualifications.length,count);
  style='background-color: red';h.mutate([{type:'attributes',attributeName:'style',oldValue:'',target}]);await flush();assert.deepEqual(h.qualifications.at(-1),['chart']);
  const current=h.qualifications.length;
  const editor={nodeType:1,closest(selector){return selector.includes('.monaco-editor')?this:null;}};
  h.mutate([{type:'childList',target:editor,addedNodes:[],removedNodes:[]}]);await flush();assert.equal(h.qualifications.length,current);
  const toggle={nodeType:1,closest(selector){return selector==='#interactionPanel'?this:null;}};
  h.mutate([{type:'attributes',attributeName:'class',target:toggle}]);await flush();assert.deepEqual(h.qualifications.at(-1),['chat']);
});
test('agent hooks, alpha changes and slider interaction invalidate only relevant families',async()=>{
  const h=harness({initial:'dark'});await flush();
  const filter=h.observations[0].attributeFilter;
  for(const name of ['data-test','data-test-id','data-pa-id','aria-pressed','aria-owns','aria-controls','data-focus'])assert.ok(filter.includes(name));
  const owner={querySelector(){return {};}};
  const thumb={nodeType:1,closest(selector){if(selector==='div#mainContent .MuiSlider-thumb')return this;if(selector==='div#mainContent')return owner;if(selector.includes('main#mainContent[data-test'))return owner;return null;},getAttribute(){return 'opacity: .2';}};
  h.events.pointerover({target:thumb});await flush();assert.deepEqual(h.qualifications.at(-1),['agents']);
  h.events.focusout({target:thumb});await flush();assert.deepEqual(h.qualifications.at(-1),['agents']);
  h.mutate([{type:'attributes',attributeName:'style',oldValue:'opacity: .38',target:thumb}]);await flush();assert.deepEqual(h.qualifications.at(-1),['agents']);
  const option={nodeType:1,closest(selector){return selector.includes('.MuiAutocomplete-popper')?this:null;}};
  h.mutate([{type:'attributes',attributeName:'data-focus',target:option}]);await flush();assert.deepEqual(h.qualifications.at(-1),['agents','inspector']);
  h.events.pagehide();const count=h.qualifications.length;h.events.focusin({target:thumb});await flush();assert.equal(h.qualifications.length,count);
});
test('list linkage changes invalidate its menu dependency and lost roots retain ownership',async()=>{
  const h=harness({initial:'dark'});await flush();
  for(const attribute of ['id','role','aria-labelledby','aria-haspopup'])assert.ok(h.observations.at(-1).attributeFilter.includes(attribute));
  const trigger={nodeType:1,closest(selector){return selector==='main#mainContent,div#mainContent'?this:null;}};
  h.mutate([{type:'attributes',attributeName:'aria-haspopup',target:trigger}]);await flush();assert.deepEqual(h.qualifications.at(-1),['list','menu']);
  h.paint.nodeType=1;h.paint.closest=()=>null;
  h.mutate([{type:'attributes',attributeName:'id',target:h.paint}]);await flush();assert.deepEqual(h.qualifications.at(-1),['chart']);
});
test('dashboard SVG paints and period option mutations invalidate their owner',async()=>{
  const h=harness({initial:'dark'});await flush();
  for(const name of ['fill','stroke','opacity','data-value'])assert.ok(h.observations.at(-1).attributeFilter.includes(name));
  const plot={nodeType:1,closest(selector){return selector.includes('AgentDashboardHeader')?this:null;}};
  h.mutate([{type:'attributes',attributeName:'stroke',target:plot}]);await flush();assert.deepEqual(h.qualifications.at(-1),['dashboard']);
  const option={nodeType:1,closest(selector){return selector.includes('.MuiPopover-root')?this:null;}};
  h.mutate([{type:'attributes',attributeName:'data-value',target:option}]);await flush();assert.deepEqual(h.qualifications.at(-1),['dashboard','menu','global']);
});
test('resource header linkage and Snapshot hover invalidate dependent paint only',async()=>{
  const h=harness({initial:'dark'});await flush();h.environment.location.pathname='/project/a/b/snapshots';
  assert.ok(h.observations.at(-1).attributeFilter.includes('aria-describedby'));
  const header={nodeType:1,closest(selector){return selector==='[role="banner"]'?this:null;}};
  h.mutate([{type:'attributes',attributeName:'data-test',target:header}]);await flush();assert.deepEqual(h.qualifications.at(-1),['banner','list','menu']);
  const row={nodeType:1,closest(selector){return selector==='main#mainContent [role="row"]'?this:null;}};
  h.events.pointerover({target:row});await flush();assert.deepEqual(h.qualifications.at(-1),['list','menu']);
  h.events.pointerout({target:row});await flush();assert.deepEqual(h.qualifications.at(-1),['list','menu']);
  h.environment.location.pathname='/project/a/b/endpoints';const count=h.qualifications.length;h.events.pointerover({target:row});await flush();assert.equal(h.qualifications.length,count);
});
test('Settings anonymous main, portals and sliders retain scoped ownership',async()=>{
  const h=harness({initial:'dark'});await flush();h.environment.location.pathname='/project/a/b/settings';
  const setting={nodeType:1,closest(selector){return selector.includes('AgentSettingsHeader')?this:null;}};
  h.mutate([{type:'attributes',attributeName:'class',target:setting}]);await flush();assert.deepEqual(h.qualifications.at(-1),['settings']);
  h.events.pointerover({target:setting});await flush();assert.deepEqual(h.qualifications.at(-1),['settings']);
  h.events.focusout({target:setting});await flush();assert.deepEqual(h.qualifications.at(-1),['settings']);
  const option={nodeType:1,closest(selector){return selector.includes('.MuiAutocomplete-popper')?this:null;}};
  h.mutate([{type:'attributes',attributeName:'aria-owns',target:option}]);await flush();assert.deepEqual(h.qualifications.at(-1),['settings','agents','inspector']);
  h.environment.location.pathname='/project/a/b/flows';const count=h.qualifications.length;
  h.mutate([{type:'attributes',attributeName:'class',target:setting}]);await flush();assert.equal(h.qualifications.length,count);
  h.environment.location.pathname='/project/a/b/settings';
  h.environment.CogGraphiteAdapters.qualify=(doc,loc,own)=>{own(h.paint,'data-cg-owner','settings','settings');return {applied:true};};
  h.set('dark');await flush();h.paint.nodeType=1;h.paint.closest=()=>null;
  const before=h.qualifications.length;
  h.environment.CogGraphiteAdapters.qualify=(doc,loc,own,only)=>{h.qualifications.push([...only]);return {applied:false};};
  h.mutate([{type:'attributes',attributeName:'class',target:h.paint}]);await flush();assert.equal(h.qualifications.length,before+1);assert.deepEqual(h.qualifications.at(-1),['settings']);
});
test('public marketing sites never activate or observe the page',async()=>{
  for(const origin of ['https://cognigy.com','https://www.cognigy.com']) {
    const h=harness({initial:'dark',origin});await flush();
    assert.equal(h.qualifications.length,0);assert.equal(h.observations.length,0);assert.equal(h.root.attrs.size,0);
  }
});
test('unexposed placeholder transitions retry once, survive unrelated paint, and cancel on teardown',async()=>{
  const h=harness({initial:'dark',retry:true});await flush();assert.equal(h.timers.size,1);
  const target={nodeType:1,closest(selector){return selector==='#flowChartEditorTabContent'?this:null;}};
  h.mutate([{type:'attributes',attributeName:'class',target}]);await flush();assert.equal(h.timers.size,1);
  h.runTimers();assert.deepEqual(h.qualifications.at(-1),['chat']);assert.equal(h.timers.size,0);
  h.set('dark');await flush();assert.equal(h.timers.size,1);h.set('native');await flush();assert.equal(h.timers.size,0);
  h.set('dark');await flush();h.events.pagehide();assert.equal(h.timers.size,0);
  const j=harness({initial:'dark',retry:true});await flush();j.nav.navigate();assert.equal(j.timers.size,0);
});
test('hidden tabs defer settlement without polling and requalify on visibility',async()=>{
  const h=harness({initial:'dark',retry:true});await flush();
  h.environment.document.visibilityState='hidden';h.events.visibilitychange();assert.equal(h.timers.size,0);
  const count=h.qualifications.length;h.set('dark');await flush();assert.equal(h.timers.size,0);
  h.environment.document.visibilityState='visible';h.events.visibilitychange();await flush();
  assert.equal(h.qualifications.length,count+2);assert.deepEqual(h.qualifications.at(-1),['chat']);assert.equal(h.timers.size,1);
  h.runTimers();assert.equal(h.timers.size,0);
});
test('continuous retryable mutations preserve a deadline and permanent refusal cancels it',async()=>{
  const h=harness({initial:'dark',retry:true});await flush();const deadline=[...h.timers.keys()][0];
  const target={nodeType:1,closest(selector){return selector==='#interactionPanel'?this:null;}};
  for(let i=0;i<3;i++){h.mutate([{type:'attributes',attributeName:'class',target}]);await flush();}
  assert.deepEqual([...h.timers.keys()],[deadline]);h.runTimers();assert.deepEqual(h.qualifications.at(-1),['chat']);assert.equal(h.timers.size,0);
  h.set('dark');await flush();assert.equal(h.timers.size,1);
  h.environment.CogGraphiteAdapters.qualify=()=>({applied:false,failedFamilies:['chat'],retryFamilies:[]});
  h.mutate([{type:'attributes',attributeName:'class',target}]);await flush();assert.equal(h.timers.size,0);
});
test('higher contrast marks the root only while dark paint is applied and restores exactly',async()=>{
  const h=harness({initial:'dark'});await flush();assert.equal(h.root.getAttribute('data-cg-contrast'),null);
  h.contrast('more');await flush();assert.equal(h.root.getAttribute('data-cg-contrast'),'more');assert.equal(h.root.getAttribute('data-cg-palette'),'graphite-v3');
  h.contrast('standard');await flush();assert.equal(h.root.hasAttribute('data-cg-contrast'),false);assert.equal(h.root.getAttribute('data-cg-palette'),'graphite-v3');
  h.contrast('more');await flush();h.set('native');await flush();assert.equal(h.root.attrs.size,0);
  h.set('dark');await flush();assert.equal(h.root.getAttribute('data-cg-contrast'),'more');
  h.environment.CogGraphiteController.destroy();assert.equal(h.root.attrs.size,0);
});
test('higher contrast saved before load applies on the first qualification',async()=>{
  const h=harness({initial:'dark',defer:true});h.contrast('more');h.complete('dark');await flush();
  assert.equal(h.root.getAttribute('data-cg-contrast'),'more');
});function popupHarness() {
  let selected,storageListener,rejectWrite=false;const reads=[],writes=[];
  const element=()=>({textContent:'',disabled:true,dataset:{},addEventListener(event,fn){this[event]=fn;}});
  const host=element(),status=element(),fieldset=element();
  const inputs=['native','dark','system'].map(value=>({...element(),value,set checked(v){if(v)selected=value;}}));
  const document={querySelector(selector){return {'#host':host,'#status':status,'fieldset':fieldset}[selector]||inputs.find(x=>selector===`input[value="${x.value}"]`);},querySelectorAll(){return inputs;}};
  const chrome={runtime:{sendMessage:async()=>({ok:true})},tabs:{query:async()=>[{id:1}],sendMessage(tab,msg){return new Promise((resolve,reject)=>reads.push({msg,resolve,reject}));}},storage:{local:{set(value){writes.push(value);return rejectWrite?Promise.reject(new Error('Write rejected')):Promise.resolve();}},onChanged:{addListener(fn){storageListener=fn;}}}};
  vm.runInNewContext(fs.readFileSync(path.join(base,'popup.js'),'utf8'),{CogGraphiteCore:core,CogGraphiteBuild:{candidateId:'test-candidate',version:'0.11.0',protocolVersion:1},document,chrome});
  const reply=(index,mode,identity={candidateId:'test-candidate',version:'0.11.0',protocolVersion:1},extra={})=>reads[index].resolve({...identity,requestId:reads[index].msg.requestId,siteId:'trial',savedMode:mode,appliedMode:mode==='dark'?'dark':'native',status:mode==='dark'?'dark':'original',...extra});
  return {reads,writes,status,fieldset,reply,failWrites(value=true){rejectWrite=value;},disconnect(index){reads[index].reject(new Error('No receiver'));},selected:()=>selected,choose(mode){selected=mode;inputs.find(x=>x.value===mode).change();},external(){storageListener({'cogDepth.v1.trial':{}},'local');}};
}
test('choosing System restores automatic System mode',async()=>{
  const h=popupHarness();await flush();h.reply(0,'dark');await flush();h.choose('system');await flush();
  assert.equal(h.writes.at(-1)['cogDepth.v1.trial'].mode,'system');h.reply(1,'system');await flush();assert.equal(h.selected(),'system');
});
test('popup reports partial coverage only when a family was refused',async()=>{
  for(const [mode,refusedFamilies,text,tone] of [['dark',[],'Dark applied','on'],['system',[],'System · Dark','on'],['dark',['chat'],'Dark · some areas kept original','on']]) {
    const h=popupHarness();await flush();h.reply(0,mode,undefined,{status:'partial',refusedFamilies});await flush();
    assert.equal(h.status.textContent,text);assert.equal(h.status.dataset.tone,tone);
  }
});
test('popup rejects an older user choice acknowledgement',async()=>{
  const h=popupHarness();await flush();h.reply(0,'native');await flush();h.choose('dark');await flush();
  h.choose('native');h.reply(1,'dark');await flush();assert.notEqual(h.selected(),'dark');
  h.reply(2,'native');await flush();assert.equal(h.selected(),'native');assert.equal(h.status.textContent,'Original');
});
test('popup rejects out-of-order external storage status replies',async()=>{
  const h=popupHarness();await flush();h.reply(0,'native');await flush();
  h.external();await flush();h.external();await flush();
  h.reply(2,'dark');await flush();h.reply(1,'native');await flush();
  assert.equal(h.selected(),'dark');assert.equal(h.status.textContent,'Dark applied');
});
test('failed popup write restores acknowledged mode and allows retry',async()=>{
  const h=popupHarness();await flush();h.reply(0,'native');await flush();h.failWrites();h.choose('dark');await flush();
  assert.equal(h.selected(),'native');assert.equal(h.status.textContent,'Couldn’t save. Try again.');
  h.reply(1,'native');await flush();assert.equal(h.selected(),'native');assert.equal(h.fieldset.disabled,false);
  h.failWrites(false);h.choose('dark');await flush();h.reply(2,'dark');await flush();assert.equal(h.selected(),'dark');assert.equal(h.status.textContent,'Dark applied');
});
test('failed write reconciles a concurrent preference and preserves its error',async()=>{
  const h=popupHarness();await flush();h.reply(0,'native');await flush();h.failWrites();h.choose('dark');await flush();
  h.reply(1,'system');await flush();assert.equal(h.selected(),'system');assert.equal(h.status.textContent,'Couldn’t save. Try again.');
});
test('saved preference with no acknowledgement is not reported applied',async()=>{
  const h=popupHarness();await flush();h.reply(0,'native');await flush();h.choose('dark');await flush();h.disconnect(1);await flush();
  assert.equal(h.selected(),'dark');assert.equal(h.status.textContent,'Saved. Open Cognigy, or reload its tab');assert.equal(h.fieldset.disabled,true);
});
test('no receiver gives truthful recovery and leaves controls disabled',async()=>{
  const h=popupHarness();await flush();h.disconnect(0);await flush();assert.equal(h.status.textContent,'Open Cognigy, or reload its tab');assert.equal(h.fieldset.disabled,true);
});
test('older failed status cannot disconnect a newer acknowledged popup',async()=>{
  const h=popupHarness();await flush();h.reply(0,'native');await flush();h.external();await flush();h.external();await flush();
  h.reply(2,'dark');await flush();h.disconnect(1);await flush();assert.equal(h.status.textContent,'Dark applied');assert.equal(h.fieldset.disabled,false);assert.equal(h.selected(),'dark');
});
test('popup rejects legacy, mismatched candidate, version and protocol acknowledgements',async()=>{
  for(const identity of [{},{candidateId:'older',version:'0.11.0',protocolVersion:1},{candidateId:'test-candidate',version:'0.10.0',protocolVersion:1},{candidateId:'test-candidate',version:'0.11.0',protocolVersion:2}]) {
    const h=popupHarness();await flush();h.reply(0,'dark',identity);await flush();
    assert.equal(h.fieldset.disabled,true);
    assert.equal(h.status.textContent,'Reload Cognigy to use this version');assert.notEqual(h.selected(),'dark');
  }
});
test('manifest is confined to the exact AI building host',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
  assert.deepEqual(manifest.permissions,['storage','activeTab','scripting']);assert.deepEqual(manifest.optional_host_permissions,['https://*/*']);assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.content_scripts[0].matches,Object.keys(core.sites).map(o=>o+'/*'));
  assert.equal(manifest.content_scripts[0].all_frames,false);
  assert.equal(manifest.background.service_worker,'worker.js');assert.deepEqual(manifest.content_scripts[0].js,['sites.js','bootstrap.js']);assert.deepEqual(manifest.host_permissions,['https://trial.cognigy.ai/*']);
});
test('theme CSS cannot change geometry or use unscoped paint',()=>{
  const allowed=new Set(['color','background-color','background-image','box-shadow','border-top-color','border-right-color','border-bottom-color','border-left-color','outline-color','text-decoration-color','caret-color','fill','stroke']);
  for(const name of ['application.css']) {
    const css=fs.readFileSync(path.join(base,name),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
    for(const rule of css.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
      assert.ok(rule[1].trim().startsWith(':root[data-cg-palette="graphite-v3"]'),name);
      assert.ok(!rule[1].includes('*'),name);
      for(const declaration of rule[2].split(';').filter(x=>x.trim())) {
        const [property,...value]=declaration.split(':');const prop=property.trim();
        const placeholderAlpha=prop==='opacity'&&rule[1].trim()===':root[data-cg-palette="graphite-v3"] [data-cg-slot~="placeholder"]::placeholder'&&value.join(':').trim()==='1!important';
        const placeholderTransition=prop==='transition'&&rule[1].trim()===':root[data-cg-palette="graphite-v3"] [data-cg-placeholder-guard]::placeholder'&&value.join(':').trim()==='color 0s,opacity 0s!important';
        assert.ok(allowed.has(prop)||placeholderAlpha||placeholderTransition,`${name}: ${prop}`);
      }
    }
  }
});


test('Insights history keeps qualified outgoing report until selected navigation commits',async()=>{
  const h=harness({initial:'native'});await flush();
  const nav=new Element(),main=new Element(),link=new Element();
  const oldPath='/insights/example/dashboard/nlu',nextPath='/insights/example/dashboard/goals';
  link.setAttribute('href',oldPath);nav.querySelector=()=>link;
  h.environment.location.pathname=oldPath;
  h.environment.document.querySelector=selector=>selector.startsWith('nav')?nav:selector.startsWith('main')?main:null;
  let calls=0;
  h.environment.CogGraphiteAdapters.qualify=(doc,loc,own)=>{calls++;own(nav,'data-cg-owner','insights','insights');own(nav,'data-cg-slot','shell','insights');own(main,'data-cg-slot','canvas','insights');return {applied:true};};
  h.set('dark');await flush();assert.equal(calls,1);
  h.environment.location.pathname=nextPath;h.nav.currententrychange();await flush();
  assert.equal(calls,1);assert.equal(main.getAttribute('data-cg-slot'),'canvas');
  link.setAttribute('href',nextPath);h.nav.navigatesuccess();await flush();assert.equal(calls,2);
  h.environment.location.pathname=oldPath;h.nav.currententrychange();await flush();assert.equal(calls,2);
  h.set('native');await flush();assert.equal(main.attrs.size,0);assert.equal(nav.attrs.size,0);
  h.set('dark');await flush();assert.equal(calls,3);
  h.environment.location.pathname='/insights/other/dashboard/nlu';h.nav.currententrychange();await flush();assert.equal(calls,4);
  h.environment.location.pathname='/insights/other/unsupported';h.nav.currententrychange();await flush();assert.equal(calls,5);
});
