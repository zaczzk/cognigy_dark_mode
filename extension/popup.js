(() => {
  const build=CogGraphiteBuild;
  const core=CogGraphiteCore, host=document.querySelector('#host'), status=document.querySelector('#status');
  const fieldset=document.querySelector('fieldset'), reset=document.querySelector('#reset');
  const labels={original:'Original',dark:'Dark applied','system-dark':'System · Dark','system-original':'System · Original',partial:'Partly supported',unsupported:'Page not supported',forced:'System colours active',applying:'Applying…'};
  let documentId;
  let tabId, siteId, requestId=0, statusSequence=0, writing=Promise.resolve(),lastSaved='system',saveError=false;
  const select=mode=>{document.querySelector(`input[value="${mode}"]`).checked=true;};
  function disconnected(message='Open Cognigy, or reload its tab') {
    fieldset.disabled=true;reset.disabled=true;select(lastSaved);status.textContent=message;globalThis.CogGraphiteSiteUI?.disconnected(message);
  }
  async function acknowledge(id,expectedMode) {
    if(id!==requestId)return;
    const sequence=++statusSequence;
    let response;
    try {response=await chrome.tabs.sendMessage(tabId,{type:'GET_STATUS',requestId:id,expectedMode},documentId?{documentId}:undefined);}
    catch(error) {if(id!==requestId||sequence!==statusSequence)return;throw error;}
    if(id!==requestId || sequence!==statusSequence) return;
    if(response?.requestId!==id || !(globalThis.CogGraphiteSiteUI?CogGraphiteSiteUI.accepts(response.siteId):core.hosts[response.siteId]) || !core.validMode(response.savedMode)) throw new Error('Invalid status');
    if(response.candidateId!==build.candidateId||response.version!==build.version||response.protocolVersion!==build.protocolVersion) {
      disconnected('Reload Cognigy to use this version');return;
    }
    siteId=response.siteId;host.textContent=globalThis.CogGraphiteSiteUI?CogGraphiteSiteUI.host(siteId):core.hosts[siteId];
    globalThis.CogGraphiteSiteUI?.connected();
    fieldset.disabled=false;reset.disabled=false;
    lastSaved=response.savedMode;select(lastSaved);
    status.textContent=saveError?'Couldn’t save. Try again.':labels[response.status]||'Page not supported';
  }
  function save(mode) {
    if(!siteId || !core.validMode(mode)) return;
    const saveSite=siteId;
    const id=++requestId;saveError=false;status.textContent='Applying…';
    writing=writing.catch(()=>{}).then(async()=>{
      if(id!==requestId)return;
      try {await chrome.storage.local.set({[core.key(saveSite)]:{mode}});if(id===requestId)lastSaved=mode;}
      catch {
        if(id!==requestId)return;
        saveError=true;select(lastSaved);status.textContent='Couldn’t save. Try again.';
        try {await acknowledge(id);}catch {if(id===requestId)disconnected('Couldn’t save. Open Cognigy, or reload its tab');}
        return;
      }
      try {
        if(chrome.runtime?.sendMessage) {
          const startup=await chrome.runtime.sendMessage({type:'SYNC_STARTUP'});
          if(startup?.ok!==true)throw new Error('Startup registration failed');
        }
        await acknowledge(id,mode);
      }
      catch {if(id===requestId)disconnected('Saved. Open Cognigy, or reload its tab');}
    });
  }
  document.querySelectorAll('input[name="mode"]').forEach(input=>input.addEventListener('change',()=>save(input.value)));
  reset.addEventListener('click',()=>save('system'));
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local' && siteId && Object.hasOwn(changes,core.key(siteId))) {
      const current=requestId;
      writing.finally(()=>{if(current===requestId)acknowledge(current).catch(()=>{if(current===requestId)disconnected();});});
    }
  });
  globalThis.CogGraphitePopup={disconnect(){requestId++;siteId=undefined;disconnected();},async connect(id,doc){tabId=id;documentId=doc;return acknowledge(++requestId);}};
  if(!globalThis.CogGraphiteSiteUI)chrome.tabs.query({active:true,currentWindow:true}).then(async tabs=>{
    tabId=tabs[0]?.id;if(tabId===undefined) throw new Error('No tab');await acknowledge(++requestId);
  }).catch(()=>{host.textContent='Cognigy';disconnected();});
})();
