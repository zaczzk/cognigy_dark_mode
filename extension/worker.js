/* Event-driven site enrolment. Never watches browsing or requests network data. */
importScripts('sites.js');
const sites=CogGraphiteSites;
let queue=Promise.resolve();
const serial=fn=>{const job=queue.then(fn);queue=job.catch(()=>{});return job;};
const stamp=()=>crypto.randomUUID();
async function registry() {
  const data=(await chrome.storage.local.get(sites.key))[sites.key];
  if(data===undefined) {
    const initial=[{origin:sites.trial,basePath:'',enabled:true,verified:false,rev:stamp()}];
    await persist(initial);return initial;
  }
  // A corrupt registry must never seed new grants or restore a removed site.
  return Array.isArray(data)?data.filter(sites.valid):[];
}
const persist=entries=>chrome.storage.local.set({[sites.key]:entries});
const allowed=origin=>chrome.permissions.contains({origins:[sites.pattern(origin)]});
async function reconcile(entries) {
  const registrations=await chrome.scripting.getRegisteredContentScripts();
  const wanted=[];
  for(const entry of entries)if(entry.enabled&&entry.origin!==sites.trial&&await allowed(entry.origin))wanted.push(sites.registrationId(entry.origin));
  const startup=[];
  for(const entry of entries)if(entry.enabled&&(entry.origin===sites.trial||entry.verified)&&await allowed(entry.origin)) {
    const key=sites.preferenceKey(entry.origin),value=(await chrome.storage.local.get(key))[key];
    const mode=value===undefined?'system':value&&Object.keys(value).length===1&&['dark','system'].includes(value.mode)?value.mode:'native';
    if(mode==='native')continue;
    const id=sites.registrationId(entry.origin)+'-startup';wanted.push(id);
    const matches=['projects','project','admincenter','insights'].flatMap(area=>{
      const base=entry.origin+entry.basePath+'/'+area;return [base,base+'/*',base+'?*'];
    });
    startup.push({id,matches,js:['startup-'+mode+'.js','sites.js','bootstrap.js','build.js','core.js','adapters.js','content.js'],css:['startup.css','palette.css','application.css'],runAt:'document_start',persistAcrossSessions:true,world:'ISOLATED',allFrames:false,matchOriginAsFallback:false});
  }
  const obsolete=registrations.filter(x=>x.id.startsWith('cg-')&&!wanted.includes(x.id)).map(x=>x.id);
  if(obsolete.length)await chrome.scripting.unregisterContentScripts({ids:obsolete});
  for(const entry of entries)if(wanted.includes(sites.registrationId(entry.origin))&&!registrations.some(x=>x.id===sites.registrationId(entry.origin))) {
    await chrome.scripting.registerContentScripts([{id:sites.registrationId(entry.origin),matches:[sites.pattern(entry.origin)],js:['sites.js','bootstrap.js'],runAt:'document_start',persistAcrossSessions:true,world:'ISOLATED',allFrames:false,matchOriginAsFallback:false}]);
  }
  for(const script of startup) {
    const previous=registrations.find(x=>x.id===script.id);
    if(previous&&JSON.stringify(previous.matches)===JSON.stringify(script.matches)&&JSON.stringify(previous.js)===JSON.stringify(script.js)&&JSON.stringify(previous.css)===JSON.stringify(script.css))continue;
    // Updating in place avoids an unregister/register interval on mode changes.
    if(previous)await chrome.scripting.updateContentScripts([script]);
    else await chrome.scripting.registerContentScripts([script]);
  }
}
async function activeContext(tabId,documentId,origin) {
  if(!Number.isInteger(tabId)||typeof documentId!=='string')return null;
  const target={tabId,documentIds:[documentId]};
  const results=await chrome.scripting.executeScript({target,injectImmediately:true,func:()=>({origin:location.origin,top:window===window.top})});
  return results[0]?.result?.top&&results[0].result.origin===origin?target:null;
}
async function ui(message) {
  const entries=await registry();
  if(message.type==='SITES_LIST')return {ok:true,sites:await Promise.all(entries.map(async entry=>({...entry,permission:await allowed(entry.origin)})))};
  const profile=sites.address(message.origin,message.basePath);
  if(profile.origin!==message.origin)throw new Error('Site address changed. Try again.');
  const found=entries.find(e=>e.origin===profile.origin);
  if(message.type==='SITE_ENABLE') {
    if(!await allowed(profile.origin))throw new Error('Site permission is needed.');
    // The popup requests permission in the click gesture; this worker cannot grant it.
    const target=message.tabId===undefined?null:await activeContext(message.tabId,message.documentId,profile.origin);
    if(message.tabId!==undefined&&!target)throw new Error('The page changed. Open the extension again.');
    const entry={...profile,enabled:true,verified:found?.verified===true&&found.basePath===profile.basePath,rev:stamp()};
    const next=[...entries.filter(e=>e.origin!==profile.origin),entry];
    await persist(next);
    try{await reconcile(next);}catch(error){await persist([...entries.filter(e=>e.origin!==profile.origin),{...entry,enabled:false,rev:stamp()}]);throw new Error('Couldn’t enable this site. Try again.');}
    if(target)await chrome.scripting.executeScript({target,injectImmediately:true,files:['sites.js','bootstrap.js']});
    return {ok:true};
  }
  if(!found)throw new Error('This site is no longer saved.');
  if(message.type==='SITE_PAUSE'||message.type==='SITE_REMOVE') {
    // Persist disabled state before unregister/revoke. Live gates observe this key.
    const next=entries.map(e=>e.origin===found.origin?{...e,enabled:false,rev:stamp()}:e);
    await persist(next);await reconcile(next);
    if(message.type==='SITE_REMOVE') {
      if(found.origin!==sites.trial) {
        const removed=await chrome.permissions.remove({origins:[sites.pattern(found.origin)]});
        if(!removed&&await allowed(found.origin))throw new Error('Site paused. Remove its access in Chrome, then retry.');
      }
      await chrome.storage.local.remove(sites.preferenceKey(found.origin));
      await persist(next.filter(e=>e.origin!==found.origin));
    }
    return {ok:true};
  }
  throw new Error('Unknown action.');
}
async function activate(message,sender) {
  if(sender.frameId!==0||!sender.documentId||!Number.isInteger(sender.tab?.id))throw new Error('Unsupported frame.');
  const url=new URL(sender.url),entries=await registry(),entry=entries.find(e=>e.origin===url.origin);
  if(!entry?.enabled||entry.rev!==message.rev||!sites.logicalPath(url,entry)||!await allowed(entry.origin))return {ok:false};
  const target={tabId:sender.tab.id,documentIds:[sender.documentId]};
  // The bootstrap runs at document_start. The default executeScript timing is
  // document_idle, which would delay this entire chain until after native paint.
  const ready=await chrome.scripting.executeScript({target,injectImmediately:true,func:(record,token)=>globalThis.CogGraphiteGate?.prepare(record,token)||false,args:[entry,message.token]});
  if(!ready[0]?.result)return {ok:false};
  if(!ready[0].result.styles) {
    await chrome.scripting.insertCSS({target,files:['startup.css','palette.css','application.css']});
  }
  await chrome.scripting.executeScript({target,injectImmediately:true,files:['build.js','core.js','adapters.js','content.js']});
  const result=await chrome.scripting.executeScript({target,injectImmediately:true,func:()=>{if(globalThis.CogGraphiteGate)globalThis.CogGraphiteGate.styles=true;return {active:!!globalThis.CogGraphiteController,recognized:!!document.querySelector('#app-container')&&!!document.querySelector('#flowChartEditorTabContent,#indexDashboardAgentListheader,#adminCenterHeader,#insightsMainContent,[data-test="AgentDashboardHeader"],[data-test="aiAgentMainContent"],[data-test="AI-Agent-Edit"],.SIDEBAR_WRAPPER')};}});
  if(result[0]?.result?.recognized&&!entry.verified) {const verified=entries.map(e=>e.origin===entry.origin?{...e,verified:true}:e);await persist(verified);await reconcile(verified);}
  return {ok:result[0]?.result?.active===true};
}
async function verify(message,sender) {
  if(sender.frameId!==0||!sender.documentId||!Number.isInteger(sender.tab?.id))return {ok:false};
  const url=new URL(sender.url),entries=await registry(),entry=entries.find(e=>e.origin===url.origin);
  if(!entry?.enabled||entry.rev!==message.rev||!sites.logicalPath(url,entry)||!await allowed(entry.origin))return {ok:false};
  const target={tabId:sender.tab.id,documentIds:[sender.documentId]};
  const result=await chrome.scripting.executeScript({target,injectImmediately:true,func:rev=>!!globalThis.CogGraphiteController&&globalThis.CogGraphiteSession?.rev===rev&&globalThis.CogGraphiteSession.active()&&!!document.querySelector('#app-container')&&!!document.querySelector('.SIDEBAR_WRAPPER,#adminCenterHeader,#insightsMainContent,#indexDashboardAgentListheader'),args:[entry.rev]});
  if(result[0]?.result!==true)return {ok:false};
  if(!entry.verified) {const verified=entries.map(e=>e.origin===entry.origin?{...e,verified:true}:e);await persist(verified);await reconcile(verified);}
  return {ok:true};
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id)return;
  const fromPopup=sender.url===chrome.runtime.getURL('popup.html')&&!sender.tab;
  if(message?.type==='CG_ACTIVATE'&&sender.tab)serial(()=>activate(message,sender)).then(respond,()=>respond({ok:false}));
  else if(message?.type==='CG_VERIFIED'&&sender.tab)serial(()=>verify(message,sender)).then(respond,()=>respond({ok:false}));
  else if(fromPopup&&message?.type==='SYNC_STARTUP')serial(async()=>{await reconcile(await registry());return {ok:true};}).then(respond,()=>respond({ok:false}));
  else if(fromPopup&&['SITES_LIST','SITE_ENABLE','SITE_PAUSE','SITE_REMOVE'].includes(message?.type))serial(()=>ui(message)).then(respond,error=>respond({ok:false,error:error.message}));
  else return;
  return true;
});
const reconcileEvent=()=>serial(async()=>reconcile(await registry())).catch(()=>{});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='local'&&Object.keys(changes).some(key=>key.startsWith('cogDepth.v1.')))reconcileEvent();
});
chrome.runtime.onInstalled.addListener(reconcileEvent);
chrome.runtime.onStartup.addListener(reconcileEvent);
chrome.permissions.onRemoved.addListener(()=>serial(async()=>{
  const entries=await registry();let changed=false;
  const next=[];for(const entry of entries){const revoked=entry.enabled&&!await allowed(entry.origin);changed||=revoked;next.push(revoked?{...entry,enabled:false,rev:stamp()}:entry);}
  if(changed)await persist(next);await reconcile(next);
}).catch(()=>{}));
chrome.permissions.onAdded.addListener(reconcileEvent);
// A worker can restart without a browser onStartup event. Recover a persisted
// transaction before queued UI/activation work, including missing registrations.
reconcileEvent();
