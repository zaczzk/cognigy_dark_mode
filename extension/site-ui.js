/* Popup-only management. The worker is the sole enrolment writer. */
(() => {
  'use strict';
  const sites=CogGraphiteSites,$=s=>document.querySelector(s);
  let entries=[],current=null,tabId,documentId,recognized=false,busy=false,sequence=0,acknowledged=false,restoreFocus=null,connectionMessage='Checking appearance…';
  const notice=text=>{$('#notice').textContent=text;$('#notice').hidden=!text;};
  const call=async message=>{const result=await chrome.runtime.sendMessage(message);if(!result?.ok)throw new Error(result?.error||'Couldn’t complete this action. Try again.');return result;};
  const badge=(text,state)=>{const b=document.createElement('span');b.className='badge';b.textContent=text;b.dataset.state=state;return b;};
  const label=entry=>!entry.enabled?'Paused':!entry.permission?'Permission needed':entry.verified?'Enabled':'Not verified';
  function show(view) {
    for(const name of ['current','saved']){$('#'+name+'-view').hidden=name!==view;$('#view-'+name).setAttribute('aria-pressed',String(name===view));}notice('');
  }
  function renderCurrent() {
    if(!current)return;
    const saved=entries.find(e=>e.origin===current.origin);
    $('#host').textContent=new URL(current.origin).hostname;
    $('#application-path').textContent=saved?.basePath||current.basePath||'Cognigy application';
    $('#site-state').textContent=saved?label(saved):recognized?'Ready to enable':'Not recognised';
    $('#site-state').dataset.state=saved?.enabled&&saved.permission?'enabled':'pending';
    $('#enable-site').hidden=!(recognized&&(!saved?.enabled||!saved.permission));$('#enable-site').disabled=busy;
    if(!saved?.enabled||!saved.permission||!recognized){globalThis.CogGraphitePopup?.disconnect();$('#status').textContent=saved&&!saved.enabled?'Site paused':recognized?'Ready when you are':'Open a Cognigy application';}
    else if(!acknowledged)$('#status').textContent=connectionMessage;
  }
  async function refresh() {
    const request=++sequence,result=await call({type:'SITES_LIST'});if(request!==sequence)return;
    entries=result.sites;$('#site-count').textContent=String(entries.length);
    const prefs=await chrome.storage.local.get(entries.map(e=>sites.preferenceKey(e.origin)));if(request!==sequence)return;
    const focused=document.activeElement;
    if(focused?.dataset?.site)restoreFocus={site:focused.dataset.site,action:focused.dataset.action};
    const list=$('#saved-list');list.replaceChildren();$('#empty-sites').hidden=entries.length!==0;
    for(const entry of [...entries].sort((a,b)=>a.origin.localeCompare(b.origin))) {
      const card=document.createElement('article');card.className='saved-card';
      const top=document.createElement('div');top.className='saved-top';
      const identity=document.createElement('div');identity.className='site-identity';
      const title=document.createElement('h2');title.textContent=new URL(entry.origin).hostname;identity.append(title);
      if(entry.basePath){const path=document.createElement('p');path.className='saved-path';path.textContent=entry.basePath;identity.append(path);}
      top.append(identity,badge(label(entry),entry.enabled?'enabled':'paused'));card.append(top);
      const controls=document.createElement('div');controls.className='saved-controls';
      const select=document.createElement('select');select.setAttribute('aria-label','Appearance for '+title.textContent);
      for(const [value,text] of [['system','System'],['dark','Dark'],['native','Original']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
      let savedMode=CogGraphiteCore.modeOf(prefs[sites.preferenceKey(entry.origin)]);select.value=savedMode;
      select.addEventListener('change',async()=>{select.disabled=true;try{await chrome.storage.local.set({[sites.preferenceKey(entry.origin)]:{mode:select.value}});savedMode=select.value;notice('Appearance saved.');}catch{select.value=savedMode;notice('Couldn’t save. Try again.');}finally{select.disabled=false;}});
      const toggle=document.createElement('button');toggle.textContent=entry.enabled&&entry.permission?'Pause':'Enable';toggle.disabled=busy;
      toggle.addEventListener('click',()=>entry.enabled&&entry.permission?action({type:'SITE_PAUSE',...entry}):enable(entry));
      const remove=document.createElement('button');remove.className='remove';remove.textContent='Remove';remove.disabled=busy;remove.setAttribute('aria-label','Remove '+title.textContent);
      remove.addEventListener('click',()=>action({type:'SITE_REMOVE',...entry}));
      for(const [control,name] of [[select,'appearance'],[toggle,'toggle'],[remove,'remove']]){control.dataset.site=entry.origin;control.dataset.action=name;}
      controls.append(select,toggle,remove);card.append(controls);list.append(card);
    }renderCurrent();
    if(restoreFocus&&!busy){const target=[...list.querySelectorAll('[data-site]')].find(e=>e.dataset.site===restoreFocus.site&&e.dataset.action===restoreFocus.action);(target||$('#show-add')).focus();restoreFocus=null;}
  }
  async function reconnect() {
    if(tabId===undefined||!documentId)return;
    connectionMessage='Checking appearance…';
    try{const ready=await chrome.tabs.sendMessage(tabId,{type:'CG_ENSURE'},{documentId});if(!ready?.ok)throw new Error('Not connected');await globalThis.CogGraphitePopup?.connect(tabId,documentId);}catch{globalThis.CogGraphitePopup?.disconnect();connectionMessage='Reload this page to connect';acknowledged=false;renderCurrent();}
  }
  async function action(message) {
    if(busy)return;busy=true;notice('');
    try{await call(message);acknowledged=false;await refresh();notice(message.type==='SITE_REMOVE'?'Site removed.':'Site paused.');}
    catch(error){notice(error.message);}finally{busy=false;await refresh().catch(()=>{});}
  }
  async function enable(profile,fromCurrent=false) {
    if(busy)return;busy=true;notice('');$('#add-error').textContent='';
    fromCurrent=fromCurrent||!!(recognized&&current?.origin===profile.origin&&documentId);
    // This request must stay directly in the click/submit gesture.
    const grant=chrome.permissions.request({origins:[sites.pattern(profile.origin)]});
    try {
      if(!await grant)throw new Error('Permission wasn’t granted. Try again when ready.');
      await call({type:'SITE_ENABLE',origin:profile.origin,basePath:profile.basePath,...(fromCurrent?{tabId,documentId}:{})});
      acknowledged=false;await refresh();if(fromCurrent)await reconnect();
      const formWasOpen=!$('#add-form').hidden;$('#add-form').hidden=true;if(formWasOpen)$('#show-add').focus();else if(fromCurrent&&!$('#current-view').hidden)document.querySelector('input[name=mode]:checked')?.focus();notice(fromCurrent?'Site enabled.':'Site saved.');
    }catch(error){if(!$('#add-form').hidden)$('#add-error').textContent=error.message;else notice(error.message);}
    finally{busy=false;await refresh().catch(()=>{});}
  }
  $('#view-current').addEventListener('click',()=>show('current'));$('#view-saved').addEventListener('click',()=>show('saved'));
  $('#show-add').addEventListener('click',()=>{$('#add-form').hidden=false;$('#site-address').focus();notice('');});
  $('#cancel-add').addEventListener('click',()=>{$('#add-form').hidden=true;$('#show-add').focus();});
  $('#enable-site').addEventListener('click',()=>{if(current&&recognized)enable(entries.find(e=>e.origin===current.origin)||current,true);});
  $('#add-form').addEventListener('submit',event=>{
    event.preventDefault();try {
      const profile=sites.address($('#site-address').value,$('#site-path').value.trim()||undefined);
      const existing=entries.find(e=>e.origin===profile.origin);
      if(existing?.enabled&&existing.permission&&existing.basePath===profile.basePath){$('#add-error').textContent='This site is already saved.';return;}
      enable(profile);
    }catch(error){$('#add-error').textContent=error.message;$('#site-address').focus();}
  });
  globalThis.CogGraphiteSiteUI={
    accepts(id){return current&&id===sites.siteId(current.origin)&&entries.some(e=>e.origin===current.origin&&e.enabled&&e.permission);},
    host:id=>id==='trial'?'trial.cognigy.ai':new URL(id).hostname,
    connected(){acknowledged=true;},disconnected(message){acknowledged=false;connectionMessage=message||'Reload this page to connect';}
  };
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(Object.hasOwn(changes,sites.key)||Object.keys(changes).some(k=>k.startsWith('cogDepth.v1.'))))refresh().catch(()=>{});});
  document.addEventListener('DOMContentLoaded',()=>{
  (async()=>{
    await refresh();const [tab]=await chrome.tabs.query({active:true,currentWindow:true});tabId=tab?.id;
    if(tabId===undefined)throw new Error('Open a Cognigy application');
    const results=await chrome.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>({origin:location.origin,path:location.pathname,recognized:document.querySelectorAll('#app-container').length===1&&!!document.querySelector('#flowChartEditorTabContent,#indexDashboardAgentListheader,#adminCenterHeader,#insightsMainContent,[data-test="AgentDashboardHeader"],[data-test="aiAgentMainContent"],[data-test="AI-Agent-Edit"],.SIDEBAR_WRAPPER')})});
    const result=results[0];documentId=result.documentId;current=sites.address(result.result.origin+result.result.path);
    const saved=entries.find(e=>e.origin===current.origin),profile={...current,...saved,enabled:true,rev:saved?.rev||'probe',verified:false};
    recognized=result.result.recognized&&sites.logicalPath({origin:current.origin,pathname:result.result.path},profile)!==null;
    renderCurrent();if(saved?.enabled&&saved.permission&&recognized)await reconnect();
  })().catch(error=>{$('#host').textContent='No application selected';$('#site-state').textContent='Not available';$('#application-path').textContent='Cognigy application';$('#status').textContent=error.message.includes('public Cognigy')?'Public website excluded':'Open a Cognigy application';});
  });
})();
