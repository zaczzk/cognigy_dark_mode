/* Isolated world. Owns only data-cg-* markers. Never reads field values. */
globalThis.CogGraphiteStart=() => {
  'use strict';
  const core = CogGraphiteCore;
  const build=globalThis.CogGraphiteBuild||{candidateId:'development',version:'development',protocolVersion:1};
  const session=globalThis.CogGraphiteSession;
  if(globalThis.CogGraphiteController||(globalThis.CogGraphiteGate&&!session?.active()))return;
  const loc=session?.location||location;
  const siteId=session?.siteId||core.sites[location.origin];
  if (!siteId || window.top !== window) return;
  let destroyed=false;
  const cleanup=[];
  const on=(target,name,fn)=>{target.addEventListener(name,fn);cleanup.push(()=>target.removeEventListener?.(name,fn));};
  const listen=(event,fn)=>{event.addListener(fn);cleanup.push(()=>event.removeListener?.(fn));};
  const storageKey = core.key(siteId);
  const darkMedia = matchMedia('(prefers-color-scheme: dark)');
  const forcedMedia = matchMedia('(forced-colors: active)');
  let mode = 'native', generation = 0, ready = false, suspended = false;
  let scheduled = false, state = {appliedMode:'native',status:'original'},refusedFamilies=[];
  let pendingFamilies = new Set(), pendingAll = false;
  let marked = new Map();
  let appRoots = new Set();
  let paintedInsights=null;
  let verification='pending';
  function verifySite() {
    if(destroyed||!session?.active()||verification!=='pending'||!chrome.runtime.sendMessage||
      !document.querySelector('#app-container')||!document.querySelector('.SIDEBAR_WRAPPER,#adminCenterHeader,#insightsMainContent,#indexDashboardAgentListheader'))return;
    verification='sending';
    chrome.runtime.sendMessage({type:'CG_VERIFIED',rev:session.rev}).then(result=>{verification=result?.ok?'done':'pending';},()=>{verification='pending';});
  }
  const settledRetries=new Map();
  // Keep geometry/opacity transitions intact. App colour transitions must not
  // interpolate through their native light colours during a synchronous recheck.
  const transitionGuards=new Map();
  const placeholderGuards=new Set();
  function guardPlaceholder(el) {
    if(placeholderGuards.has(el))return;
    if(el.hasAttribute('data-cg-placeholder-guard'))throw new Error('Marker collision');
    placeholderGuards.add(el);el.setAttribute('data-cg-placeholder-guard','');
  }
  const paintStops=', color 0s, background-color 0s, border-top-color 0s, border-right-color 0s, border-bottom-color 0s, border-left-color 0s, fill 0s, stroke 0s';
  function guardTransition(el,transition) {
    if(transitionGuards.has(el)||!el.style?.setProperty||typeof getComputedStyle!=='function')return;
    const computed=transition||getComputedStyle(el);
    if(!computed.transitionDuration?.split(',').some(value=>parseFloat(value)>0))return;
    if(!computed.transitionProperty?.split(',').some(value=>/^(all|color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|fill|stroke)$/.test(value.trim())))return;
    const prior=el.style.getPropertyValue('transition'),priority=el.style.getPropertyPriority('transition');
    const value=computed.transition+paintStops;
    el.style.setProperty('transition',value,'important');transitionGuards.set(el,{prior,priority,value:el.style.getPropertyValue('transition')});
  }
  function releaseTransitions(all=false) {
    for(const el of placeholderGuards)if(all||!marked.get(el)?.has('data-cg-slot')||!el.getAttribute('data-cg-slot')?.split(' ').includes('placeholder')||el.isConnected===false) {
      el.removeAttribute('data-cg-placeholder-guard');placeholderGuards.delete(el);
    }
    for(const [el,record] of transitionGuards)if(all||!marked.has(el)||el.isConnected===false) {
      if(el.style.getPropertyValue('transition')===record.value&&el.style.getPropertyPriority('transition')==='important') {
        if(record.prior)el.style.setProperty('transition',record.prior,record.priority);else el.style.removeProperty('transition');
      }
      transitionGuards.delete(el);
    }
  }
  function cancelRetries(only=null){for(const [family,pending] of settledRetries)if(!only||only.has(family)){clearTimeout(pending.timer);settledRetries.delete(family);}}
  const own = (el, name, value, family='palette',transition=null) => {
    if (el.hasAttribute(name) && !marked.get(el)?.has(name)) throw new Error('Marker collision');
    if (!marked.has(el)) marked.set(el, new Map());
    if (!marked.get(el).has(name)) marked.get(el).set(name, {prior:el.getAttribute(name),family});
    if(family!=='palette')guardTransition(el,transition);
    if(name==='data-cg-slot'&&value.split(' ').includes('placeholder'))guardPlaceholder(el);
    if(el.getAttribute(name)!==value)el.setAttribute(name, value);
  };
  function clear(only=null,preserveActivation=false) {
    for (const [el, attrs] of marked) {
      for (const [name, {prior,family}] of attrs) {
        // Tokens do not paint an unmarked element. Keep the switch active while
        // native styles are read for affected owners, so unrelated owners stay dark.
        if(preserveActivation&&family==='palette'&&el.isConnected!==false)continue;
        if(only && family!=='palette' && !only.has(family) && el.isConnected!==false)continue;
        if (prior === null) el.removeAttribute(name); else el.setAttribute(name, prior);
        attrs.delete(name);
      }
      if(!attrs.size)marked.delete(el);
    }
  }
  function resolve(only=null,isSettledRetry=false) {
    if(destroyed||session&&!session.active()){cancelRetries();clear();return;}
    if(loc.origin==='https://trial.cognigy.ai') {
      const current=new Set(document.querySelectorAll?.('#app-container')||[]);
      if(current.size!==appRoots.size||[...current].some(root=>!appRoots.has(root)))only=null;
      appRoots=current;
    }
    if(!only)refusedFamilies=[];
    else refusedFamilies=refusedFamilies.filter(f=>!only.has(f));
    state = {appliedMode:'native',status:mode==='system'?'system-original':'original'};
    if (suspended || !ready || !document.documentElement) {cancelRetries();clear();return;}
    if(session) {
      if(mode==='dark'||mode==='system')document.documentElement.setAttribute('data-cg-startup',mode);
      else document.documentElement.removeAttribute('data-cg-startup');
    }
    if (forcedMedia.matches) {cancelRetries();clear();releaseTransitions(true);state.status='forced'; return; }
    if (!core.requestedDark(mode, darkMedia.matches)) {cancelRetries();clear();releaseTransitions(true);return;}
    if (!window.navigation) {cancelRetries();clear();state.status='unsupported'; return; }
    // History traversal updates location before React commits the selected
    // report. Retain the already qualified outgoing report in this exact gap;
    // its aria-current/child mutations trigger the normal synchronous recheck.
    // Do not qualify old DOM against the new URL and release its paint guards.
    if(paintedInsights&&loc.pathname!==paintedInsights.path&&
      /^\/insights\/[^/]+\/dashboard\/(overview|business|engagement|liveAgent|goals|nlu)\/?$/.test(loc.pathname||'')&&
      loc.pathname.split('/')[2]===paintedInsights.path.split('/')[2]&&
      document.querySelector?.('nav[aria-label="Insights"]')===paintedInsights.nav&&
      document.querySelector?.('main#insightsMainContent')===paintedInsights.main&&
      marked.get(paintedInsights.nav)?.has('data-cg-slot')&&
      paintedInsights.nav.querySelector('a[aria-current="page"]')?.getAttribute('href')===paintedInsights.href)return;
    clear(only,true);
    try {
      // The captured Projects logo banner exists before its page headings/list.
      // Its early CSS foundation must not contaminate native compatibility reads.
      // This synchronous window cannot render; restore it even on a failed pass.
      const root=document.documentElement,priorRead=root.getAttribute('data-cg-native-read');
      let result;
      try {
        root.setAttribute('data-cg-native-read','');
        result=CogGraphiteAdapters.qualify(document, loc, own, only);
      } finally {
        if(priorRead===null)root.removeAttribute('data-cg-native-read');else root.setAttribute('data-cg-native-read',priorRead);
      }
      releaseTransitions();
      const families=['shell','banner','dashboard','settings','list','agents','menu','chart','inspector','chat','global','admin','insights','project-index','utility'];
      refusedFamilies=[...new Set([...refusedFamilies,...(result.failedFamilies||[]).filter(f=>families.includes(f))])];
      const retry=new Set(result.retryFamilies||[]);
      for(const family of settledRetries.keys())if((!only||only.has(family))&&(isSettledRetry||!retry.has(family)))cancelRetries(new Set([family]));
      if(!isSettledRetry)for(const family of retry) {
        // Continuous mutations must not keep moving an existing deadline.
        // The attempt reads the then-current DOM, never an earlier paint plan.
        if(settledRetries.has(family))continue;
        const pending={};settledRetries.set(family,pending);
        // Qualification already resolved native styles. One bounded settlement
        // timer avoids waiting on a throttled paint clock. Hidden tabs defer
        // their retry until visibility changes, without polling in the background.
        if(document.visibilityState!=='hidden')pending.timer=setTimeout(()=>{
          if(document.visibilityState==='hidden')return;
          settledRetries.delete(family);resolve(new Set([family]),true);
        },250);
      }
      const hasPaint=[...marked.values()].some(attrs=>[...attrs.values()].some(entry=>entry.family!=='palette'));
      if (!result.applied && !hasPaint) { clear(); state.status='unsupported'; return; }
      own(document.documentElement, 'data-cg-palette', 'graphite-v3');
      own(document.documentElement, 'data-cg-build', build.candidateId);
      state = {appliedMode:'dark',status:result.partial?'partial':mode==='system'?'system-dark':'dark'};
      const insightsNav=document.querySelector?.('nav[aria-label="Insights"]');
      const insightsMain=document.querySelector?.('main#insightsMainContent');
      if(insightsNav&&insightsMain&&marked.get(insightsNav)?.has('data-cg-slot'))
        paintedInsights={path:loc.pathname,nav:insightsNav,main:insightsMain,href:insightsNav.querySelector('a[aria-current="page"]')?.getAttribute('href')};
      else paintedInsights=null;
      verifySite();
    } catch {
      cancelRetries();clear();releaseTransitions(true); state = {appliedMode:'native',status:'unsupported'};
    }
  }
  function schedule(families=null) {
    if(destroyed||suspended)return;
    if(families instanceof Set)for(const f of families)pendingFamilies.add(f);else pendingAll=true;
    if (scheduled || suspended) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled=false;const only=pendingAll?null:new Set(pendingFamilies);
      pendingAll=false;pendingFamilies.clear();if(!suspended&&!destroyed)resolve(only);
    });
  }
  async function refresh() {
    if(destroyed)return;
    const before = generation, previousMode=mode, wasReady=ready;
    try {
      const value = await chrome.storage.local.get(storageKey);
      if (generation === before && !suspended && !destroyed) {mode=core.modeOf(value[storageKey]);ready=true;}
    } catch {if(!ready) mode='native';}
    if(!wasReady||mode!==previousMode)resolve();
  }
  const excluded='.monaco-editor,[data-1password-root],[data-codex-overlay],iframe,video';
  const owners=[['shell','.SIDEBAR_WRAPPER'],['banner','[role="banner"]'],['dashboard','div:has(> [role="banner"][data-test="AgentDashboardHeader"]),.MuiPopover-root'],['settings','div:has(> [role="banner"][data-test="AgentSettingsHeader"]),.MuiAutocomplete-popper,.MuiPopover-root'],['list','main#mainContent,div#mainContent'],['agents','main#mainContent[data-test="aiAgentMainContent"],div:has(> [role="banner"][data-test="AI-Agent-Edit"]),.MuiAutocomplete-popper,.MuiTooltip-popper'],['menu','.MuiPopover-root'],['chart','#flowChartEditorTabContent'],['inspector','#editSidebarWrapper,.MuiAutocomplete-popper'],['chat','#interactionPanel'],['global','#complementaryApplicationMenu,.MuiPopover-root,.MuiDialog-root:has(#hiddenDialogTitle):has(#dialogText)']];
  owners.push(['utility','[data-cg-owner="utility"],.MuiDialog-root,div:has(> div > [data-test="GoalDetailsHeader"]),[data-test="AgentLogsHeader"],[data-test="IntentTrainerHeader"],[data-test="AgentExtensionsHeader"],[data-test="AgentPackagesHeader"],[data-test="SimulationEditorHeader"],#flowNLUEditorTabContent,#flowSettingsTabContent,[data-test="AgentKnowledgeSourcesHeader"],[data-test="EndpointEditorHeader"],#editSidebarWrapper,aside[aria-labelledby="compactListHeader"],.MuiPopover-root,#mainContent,.MuiAutocomplete-popper']);
  const paintStyle=style=>String(style||'').split(';').filter(x=>/^\s*(background(?:-color|-image)?|color|border(?:-(?:top|right|bottom|left))?(?:-color)?|box-shadow|fill|stroke|opacity)\s*:/.test(x)).join(';');
  owners.push(['project-index','[data-cg-owner="project-index"],#indexDashboardAgentListheader,[data-test="AgentListHeader"],[role="navigation"][aria-labelledby="indexDashboardAgentListheader"],#mainContent,.MuiPopover-root'],['admin','aside[aria-labelledby="compactListHeader"],[data-cg-owner="admin"],nav[role="navigation"],[data-test="UserHeader"],#editSidebarWrapper,#adminCenterHeader,#opsCenterHeader,#mainContent,[role="banner"],section[role="tabpanel"],.MuiDialog-root,.MuiPopover-root,.MuiAutocomplete-popper,.MuiTooltip-popper'],['insights','[data-cg-owner="insights"],#insightsMainContent,#insightsMainRegionHeading,nav[aria-label="Insights"],.MuiPopover-root,.MuiAutocomplete-popper']);
  const observer = new MutationObserver(records => {
    // Original has no qualification work. A later preference change qualifies
    // the complete current DOM, so no mutations need to be collected meanwhile.
    if(destroyed||suspended||!ready||forcedMedia.matches||!core.requestedDark(mode,darkMedia.matches))return;
    const dirty=new Set();
    let identityChanged=false;
    const touchesApp=node=>node.nodeType===1&&(appRoots.has(node)||node.matches?.('#app-container')||node.querySelector?.('#app-container')||[...appRoots].some(root=>node.contains?.(root)));
    for(const r of records) {
      const target=r.target.nodeType===1?r.target:r.target.parentElement;
      if(!target||target.closest(excluded))continue;
      if(/\/connections\/?$/.test(loc.pathname)&&(target.closest('.MuiDialog-root:has([aria-labelledby="connectionEditorDialogTitle"])')||(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(node=>node.nodeType===1&&node.querySelector?.('[aria-labelledby="connectionEditorDialogTitle"]')))))dirty.add('list');
      if(r.type==='attributes'&&r.attributeName==='id'&&(r.oldValue==='app-container'||target.getAttribute?.('id')==='app-container'||appRoots.has(target)))identityChanged=true;
      if(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(touchesApp))identityChanged=true;
      if(r.type==='attributes'&&r.attributeName==='style'&&paintStyle(r.oldValue)===paintStyle(target.getAttribute('style'))&&
        !target.matches('[data-test="GlobalFilter-timeframe-panel"]')&&
        !(!target.childElementCount&&target.matches('section > div')&&target.closest('main > div > div:has(#AuditEventViewerDropdownBtn)')))continue;
      // Preserve ownership when a root loses the id/class that identified it.
      if(r.type==='attributes')for(const {family} of marked.get(target)?.values()||[])if(family!=='palette')dirty.add(family);
      for(const [family,selector] of owners) {
        if(family==='project-index'&&!/^\/projects\/?$/.test(loc.pathname))continue;
        if(family==='admin'&&!/^\/admincenter\//.test(loc.pathname))continue;
        if(family==='insights'&&!/^\/insights\//.test(loc.pathname))continue;
        if(!['admin','insights','project-index','global'].includes(family)&&/^\/(admincenter|insights|projects)(?:\/|$)/.test(loc.pathname))continue;
        if(family==='utility'&&!/^\/project\/[^/]+\/[^/]+\/(logs|trainer|extensions|packaging|simulator|knowledge(?:\/[^/]+)?|endpoint\/[^/]+|goal\/new|flow\/[^/]+\/(?:nlu|settings))(?:\/|$)/.test(loc.pathname))continue;
        if(family==='settings'&&!/^\/project\/[^/]+\/[^/]+\/settings\/?$/.test(loc.pathname))continue;
        if(target.closest(selector))dirty.add(family);
        if(r.type==='childList')for(const node of [...r.addedNodes,...r.removedNodes]) {
          if(node.nodeType===1 && (node.matches(selector)||node.querySelector(selector)))dirty.add(family);
        }
      }
    }
    if(/\/(endpoints|snapshots|playbooks|flows|knowledge|large-language-models|lexicons|goals|connections|nlu-connectors|functions|handover-providers|locales|tokens|members|contacts)\/?$/.test(loc.pathname)&&(dirty.has('banner')||dirty.has('list'))){dirty.add('banner');dirty.add('list');}
    if(dirty.has('list'))dirty.add('menu');
    if(identityChanged)schedule();else if(dirty.size)schedule(dirty);
  });
  // Native slider/Snapshot shadows and dashboard resource focus ink can change
  // without mutating DOM. Requalify only their observed owners.
  for(const type of ['pointerover','pointerout','focusin','focusout'])on(globalThis,type,event=>{
    if(event.target?.closest?.('div#mainContent .MuiSlider-thumb')&&event.target.closest('div#mainContent')?.querySelector('#AIAgent-Tab-persona'))schedule(new Set(['agents']));
    if(event.target?.closest?.('div:has(> [role="banner"][data-test="AgentSettingsHeader"]) .MuiSlider-thumb,div:has(> [role="banner"][data-test="AgentSettingsHeader"]) button[type="button"]:not(.MuiButtonBase-root)'))schedule(new Set(['settings']));
    if(/\/snapshots\/?$/.test(loc.pathname)&&event.target?.closest?.('main#mainContent [role="row"]'))schedule(new Set(['list','menu']));
    if((type==='focusin'||type==='focusout')&&/^\/project\/[^/]+\/[^/]+\/?$/.test(loc.pathname)&&event.target?.closest?.('div#mainContent[role="main"] ul[aria-labelledby="dashboardGetStartedWidgetHeading"] > li > a.MuiLink-root'))schedule(new Set(['dashboard']));
  });
  on(globalThis,'change',event=>{
    const family=/^\/admincenter\//.test(loc.pathname)?'admin':/^\/insights\//.test(loc.pathname)?'insights':null;
    if(family&&event.target?.matches?.('input[type="radio"],input[type="checkbox"]'))schedule(new Set([family]));
  });
  function observe() {
    observer.observe(document, {subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,
      attributeFilter:['style','class','id','role','name','type','href','aria-current','aria-label','alt','readonly','checked','placeholder','data-slate-leaf','data-slate-string','fill','stroke','opacity','aria-hidden','tabindex','aria-expanded','aria-selected','aria-disabled','aria-invalid','aria-controls','aria-owns','aria-labelledby','aria-describedby','aria-haspopup','aria-pressed','data-focus','data-value','data-check','disabled','hidden','data-test','data-test-id','data-pa-id']});
  }
  listen(chrome.storage.onChanged,(changes, area) => {
    if(destroyed)return;
    if (area !== 'local' || !Object.hasOwn(changes,storageKey)) return;
    generation++;mode=core.modeOf(changes[storageKey].newValue);ready=true;schedule();
  });
  listen(chrome.runtime.onMessage,(message, sender, respond) => {
    if(destroyed)return;
    if (sender.id !== chrome.runtime.id || message?.type !== 'GET_STATUS' ||
        !Number.isSafeInteger(message.requestId) || message.requestId<0) return;
    verifySite();
    refresh().then(()=>respond({requestId:message.requestId,siteId,savedMode:mode,...(destroyed||session&&!session.active()?{appliedMode:'native',status:'unsupported'}:state),...build,routeFamily:core.routeFamily(session?'trial':siteId,loc.pathname||''),refusedFamilies,
      activeFamilies:[...new Set([...marked.values()].flatMap(attrs=>[...attrs.values()].map(x=>x.family)).filter(f=>f!=='palette'))],
      reasonCodes:state.status==='partial'?['coverage-incomplete',...(refusedFamilies.length?['family-refused']:[])]:state.status==='unsupported'?['compatibility-refused']:state.status==='forced'?['forced-colours']:[]}));
    return true;
  });
  on(darkMedia,'change',schedule);
  on(forcedMedia,'change',schedule);
  on(document,'visibilitychange',()=>{
    if(document.visibilityState==='hidden') {
      for(const pending of settledRetries.values())clearTimeout(pending.timer);
    } else if(settledRetries.size&&!suspended) {
      const pending=new Set(settledRetries.keys());cancelRetries();schedule(pending);
    }
  });
  on(globalThis,'pagehide',()=>{suspended=true;ready=false;generation++;cancelRetries();observer.disconnect();clear();releaseTransitions(true);});
  on(globalThis,'pageshow',event=>{
    // document_start already initialized an ordinary load. Only a restored
    // document needs another preference read; avoid a second native-paint gap.
    if(!suspended&&!event?.persisted)return;
    suspended=false;ready=false;clear();observe();refresh();
  });
  if(window.navigation) {
    // The outgoing DOM still belongs to the outgoing route. Keep its qualified
    // paint until commit; currententrychange requalifies against the new route.
    on(navigation,'navigate',()=>{cancelRetries();});
    for(const name of ['currententrychange','navigatesuccess','navigateerror']) on(navigation,name,schedule);
  }
  globalThis.CogGraphiteController={route:schedule,destroy(){
    if(destroyed)return;destroyed=true;suspended=true;ready=false;generation++;state={appliedMode:'native',status:'unsupported'};
    cancelRetries();observer.disconnect();clear();releaseTransitions(true);document.documentElement?.removeAttribute('data-cg-startup');for(const remove of cleanup)remove();
    delete globalThis.CogGraphiteController;
  }};
  observe();
  refresh();
};
if(globalThis.CogGraphitePreloaded&&globalThis.CogGraphiteGate&&!globalThis.CogGraphiteSession?.active())globalThis.CogGraphiteGate.sync();
else globalThis.CogGraphiteStart();
