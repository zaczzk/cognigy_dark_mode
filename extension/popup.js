(() => {
  const build=CogGraphiteBuild;
  const core=CogGraphiteCore, host=document.querySelector('#host'), status=document.querySelector('#status');
  const fieldset=document.querySelector('fieldset');
  const labels={original:'Original',dark:'Dark applied','system-dark':'System · Dark','system-original':'System · Original',partial:'Dark · some areas kept original',unsupported:'Page not supported',forced:'System colours active',applying:'Applying…'};
  const tones={original:'off','system-original':'off',dark:'on','system-dark':'on',partial:'on'};
  let documentId;
  let tabId, siteId, requestId=0, statusSequence=0, writing=Promise.resolve(),lastSaved='system',saveError=false;
  const select=mode=>{document.querySelector(`input[value="${mode}"]`).checked=true;};
  const say=(text,tone)=>{status.textContent=text;status.dataset.tone=tone;};
  function disconnected(message='Open Cognigy, or reload its tab') {
    fieldset.disabled=true;select(lastSaved);say(message,'warn');globalThis.CogGraphiteSiteUI?.disconnected(message);
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
    fieldset.disabled=false;
    lastSaved=response.savedMode;select(lastSaved);
    // Every project route reports partial coverage; only a refused family is worth surfacing.
    const shown=response.status==='partial'&&!response.refusedFamilies?.length?(response.savedMode==='system'?'system-dark':'dark'):response.status;
    if(saveError)say('Couldn’t save. Try again.','warn');else say(labels[shown]||'Page not supported',tones[shown]||'warn');
  }
  function save(mode) {
    if(!siteId || !core.validMode(mode)) return;
    const saveSite=siteId;
    const id=++requestId;saveError=false;say('Applying…','busy');
    writing=writing.catch(()=>{}).then(async()=>{
      if(id!==requestId)return;
      try {await chrome.storage.local.set({[core.key(saveSite)]:{mode}});if(id===requestId)lastSaved=mode;}
      catch {
        if(id!==requestId)return;
        saveError=true;select(lastSaved);say('Couldn’t save. Try again.','warn');
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
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==='local' && siteId && Object.hasOwn(changes,core.key(siteId))) {
      const current=requestId;
      writing.finally(()=>{if(current===requestId)acknowledge(current).catch(()=>{if(current===requestId)disconnected();});});
    }
  });
  // Higher contrast is one global choice; the popup previews it at once and
  // content scripts on every enabled site pick it up from storage.
  const contrast=document.querySelector('#contrast');
  if(contrast) {
    const show=level=>{contrast.checked=level==='more';document.documentElement.dataset.contrast=level;};
    chrome.storage.local.get(core.contrastKey).then(value=>show(core.contrastOf(value[core.contrastKey])),()=>show('standard'));
    contrast.addEventListener('change',()=>{
      const level=contrast.checked?'more':'standard';show(level);
      chrome.storage.local.set({[core.contrastKey]:{level}}).catch(()=>{show(level==='more'?'standard':'more');say('Couldn’t save. Try again.','warn');});
    });
    chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.hasOwn(changes,core.contrastKey))show(core.contrastOf(changes[core.contrastKey].newValue));});
  }
  globalThis.CogGraphitePopup={disconnect(){requestId++;siteId=undefined;disconnected();},async connect(id,doc){tabId=id;documentId=doc;return acknowledge(++requestId);}};
  if(!globalThis.CogGraphiteSiteUI)chrome.tabs.query({active:true,currentWindow:true}).then(async tabs=>{
    tabId=tabs[0]?.id;if(tabId===undefined) throw new Error('No tab');await acknowledge(++requestId);
  }).catch(()=>{host.textContent='Cognigy';disconnected();});
})();
