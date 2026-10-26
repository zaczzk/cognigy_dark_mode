/* Tiny approved-host route gate. No DOM traversal/observer outside app routes. */
(() => {
  'use strict';
  if(window!==window.top)return;
  if(globalThis.CogGraphiteGate){globalThis.CogGraphiteGate.sync();return;}
  const sites=CogGraphiteSites;
  try{if(sites.address(location.origin,'').origin!==location.origin)return;}catch{return;}
  let entry=null,token=0,pending=null,disposed=false,readGeneration=0,syncRead=null;
  const stop=()=>{token++;pending=null;globalThis.CogGraphiteController?.destroy();document.documentElement?.removeAttribute('data-cg-startup');delete globalThis.CogGraphiteSession;};
  const eligible=()=>!disposed&&entry?.enabled&&sites.logicalPath(location,entry)!==null;
  function start() {
    if(!eligible()){stop();return Promise.resolve({ok:false});}
    if(globalThis.CogGraphiteController){globalThis.CogGraphiteController.route();return Promise.resolve({ok:true});}
    if(globalThis.CogGraphitePreloaded&&!globalThis.CogGraphiteStart)return Promise.resolve({ok:false});
    // Chrome has already delivered this bundle and its CSS on an approved app
    // route. Still validate the current registry before starting locally; do not
    // wait for a service-worker wake-up and three cross-process injections.
    if(globalThis.CogGraphitePreloaded&&globalThis.CogGraphiteStart) {
      const current=++token;pending=null;
      if(!gate.prepare(entry,current))return Promise.resolve({ok:false});
      gate.styles=true;globalThis.CogGraphiteStart();
      return Promise.resolve({ok:!!globalThis.CogGraphiteController});
    }
    if(pending)return pending;
    const current=++token;
    pending=chrome.runtime.sendMessage({type:'CG_ACTIVATE',rev:entry.rev,token:current}).catch(()=>({ok:false})).finally(()=>{if(current===token)pending=null;});
    return pending;
  }
  function sync() {
    // Static gate and registered bundle may arrive in either async storage
    // phase. Share their pending registry read; content startup resumes it.
    if(!syncRead)syncRead=readRegistry().finally(()=>{syncRead=null;});
    return syncRead.then(start);
  }
  async function readRegistry() {
    const generation=++readGeneration;
    try {
      const records=(await chrome.storage.local.get(sites.key))[sites.key];
      if(generation!==readGeneration||disposed)return;
      const next=Array.isArray(records)?records.find(e=>sites.valid(e)&&e.origin===location.origin):null;
      if(entry&&next?.rev!==entry.rev)stop();entry=next;
    } catch {if(generation===readGeneration){entry=null;stop();}}
  }
  const gate={styles:false,sync,prepare(record,current){
    if(!eligible()||current!==token||record.rev!==entry.rev||record.origin!==location.origin)return false;
    globalThis.CogGraphiteSession={siteId:sites.siteId(entry.origin),origin:entry.origin,basePath:entry.basePath,rev:entry.rev,active:()=>eligible()&&current===token,
      location:{get origin(){return 'https://trial.cognigy.ai';},get pathname(){return sites.logicalPath(location,entry)||'/';}}};
    return {styles:gate.styles};
  }};
  globalThis.CogGraphiteGate=gate;
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local'||!Object.hasOwn(changes,sites.key))return;
    readGeneration++;
    const data=changes[sites.key].newValue;
    const next=Array.isArray(data)?data.find(e=>sites.valid(e)&&e.origin===location.origin):null;
    if(entry&&next?.rev!==entry.rev)stop();entry=next;start();
  });
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(sender.id!==chrome.runtime.id||message?.type!=='CG_ENSURE')return;
    sync().then(()=>respond({ok:!!globalThis.CogGraphiteController}),()=>respond({ok:false}));return true;
  });
  if(window.navigation)navigation.addEventListener('currententrychange',()=>start());
  addEventListener('pagehide',()=>{disposed=true;readGeneration++;stop();});
  addEventListener('pageshow',event=>{if(event.persisted){disposed=false;sync();}});
  // A fresh trial install may be awaiting the worker's initial registry write.
  sync();
})();
