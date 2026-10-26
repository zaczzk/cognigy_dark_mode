(() => {
  // Native relative routes are retained in workspace captures for structural
  // qualification, but the offline view cannot navigate or submit account data.
  document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();},true);
  document.addEventListener('submit',e=>e.preventDefault(),true);
  const markers=[];
  const isPublic=!!document.querySelector('.body-container-wrapper');
  const elements=Array.from(document.querySelectorAll(isPublic?'body,header,header *,.body-container-wrapper,.body-container-wrapper *,.footer-container-wrapper,.footer-container-wrapper *':'#app-container *,[role="menu"] *,[role="menu"],.MuiAutocomplete-popper,.MuiAutocomplete-popper *,.MuiPopover-root,.MuiPopover-root *'));
  const snapshot=()=>elements.map(e=>{const r=e.getBoundingClientRect(),g=getComputedStyle(e);return [r.x,r.y,r.width,r.height,g.borderRadius,g.font,g.transform,g.opacity,g.filter,g.outlineWidth,g.outlineStyle,g.outlineOffset,g.boxShadow.replace(/rgba?\([^)]+\)/g,'color'),e.tagName==='IMG'?e.getAttribute('src'):null,isPublic&&e.matches('body,header li.hs-menu-depth-1,header .light-blue-cta a')?['::before','::after'].map(p=>{const s=getComputedStyle(e,p);return [s.content,s.width,s.height,s.transform,s.opacity,s.backgroundImage,s.borderRadius,s.boxShadow.replace(/rgba?\([^)]+\)/g,'color')];}):null];});
  let native;
  const chart=document.querySelector('#chartEditor');
  if(chart){chart.scrollLeft=1397;chart.scrollTop=938;}
  // Captures do not serialize scroll positions. Reconstruct the fixture view
  // from the captured bottom-placed portal and its native anchor, or the named
  // section. This moves the local scroll position only; no extension geometry.
  const portal=document.querySelector('.MuiAutocomplete-popper');
  const popupInput=document.querySelector('[role="combobox"][aria-expanded="true"] input[aria-controls]');
  if(portal&&popupInput&&portal.getAttribute('x-placement')?.startsWith('bottom')) {
    const anchor=popupInput.closest('.MuiInputBase-root');let scroll=anchor.parentElement;
    while(scroll&&!(scroll.scrollHeight>scroll.clientHeight&&['auto','scroll'].includes(getComputedStyle(scroll).overflowY)))scroll=scroll.parentElement;
    if(scroll)scroll.scrollTop+=anchor.getBoundingClientRect().bottom-portal.getBoundingClientRect().top;
  } else if(document.documentElement.dataset.fixtureSelectOffset) {
    const trigger=document.querySelector('.MuiSelect-select[aria-expanded="true"]'),paper=document.querySelector('.MuiPopover-paper');
    let scroll=trigger?.parentElement;
    while(scroll&&!(scroll.scrollHeight>scroll.clientHeight&&['auto','scroll'].includes(getComputedStyle(scroll).overflowY)))scroll=scroll.parentElement;
    if(scroll&&paper)scroll.scrollTop+=trigger.getBoundingClientRect().top-paper.getBoundingClientRect().top-Number(document.documentElement.dataset.fixtureSelectOffset);
  } else if(document.documentElement.dataset.fixtureView)document.querySelector(document.documentElement.dataset.fixtureView)?.scrollIntoView({block:'center'});
  function clear(){for(const [el,name] of markers)el.removeAttribute(name);markers.length=0;document.documentElement.removeAttribute('data-cg-palette');}
  const report=document.querySelector('#fixture-report');
  const apply=()=>{
    clear();
    const result=CogGraphiteAdapters.qualify(document,{origin:document.documentElement.dataset.fixtureOrigin||'https://trial.cognigy.ai',pathname:document.documentElement.dataset.fixturePath||'/project/example/example/flow/example/chart'},(el,name,value)=>{markers.push([el,name]);el.setAttribute(name,value);});
    if(result.applied)document.documentElement.setAttribute('data-cg-palette','graphite-v3');
    report.dataset.result=JSON.stringify(result);return result;
  };
  const settingsForm=document.querySelector('[data-test="AgentSettingsHeader"]')?.parentElement.querySelector('[role="main"] > form');
  if(isPublic)for(const key of ['closed','solutions','platform','industries','customers','resources','company']) {
    const button=document.createElement('button');button.textContent='Preview '+key;document.querySelector('#fixture-controls').append(button);
    button.addEventListener('click',()=>{
      clear();
      document.querySelectorAll('header li.hs-menu-depth-1,header .mega-menu-popout').forEach(e=>e.classList.remove('activated','visible'));
      const open=key!=='closed';document.body.classList.toggle('activated',open);document.querySelector('header .header-nav').classList.toggle('activated',open);
      document.querySelectorAll('header .mega-menu-popout').forEach(e=>{e.style.display=e.getAttribute('data-check')===key?'':'none';});
      if(open){document.querySelector('header li.hs-menu-depth-1[data-check="'+key+'"]').classList.add('activated');document.querySelector('header .mega-menu-popout[data-check="'+key+'"]').classList.add('visible');}
      report.textContent='Native captured '+key+' state; choose Dark after transition';
    });
  }
  if(isPublic) {
    const button=document.createElement('button');button.textContent='Preview navigation focus';document.querySelector('#fixture-controls').append(button);
    button.addEventListener('click',()=>{clear();const link=document.querySelector('header li.hs-menu-depth-1 > a');link.focus();const before=snapshot();apply();const after=snapshot();report.textContent=`${markers.length} paint markers · ${after.filter((v,i)=>JSON.stringify(v)!==JSON.stringify(before[i])).length} geometry/media differences · native navigation focus`;});
  }
  if(isPublic)for(const [title,selector] of [['Channels','.icon-liftup-banner-module'],['Results','.number-liftups-module'],['News','.latest-blog-posts-2022-module'],['Footer','.footer-section']]) {
    const button=document.createElement('button');button.textContent=title;
    button.addEventListener('click',()=>document.querySelector(selector).scrollIntoView({block:'center',behavior:'instant'}));
    document.querySelector('#fixture-controls').append(button);
  }
  if(settingsForm)for(const [title,selector,simulateHalo] of [
    ['Preview action focus','button[type="button"]:not(.MuiButtonBase-root):has(svg)',false],
    ['Preview threshold focus','.MuiSlider-root:has(input[name="intentThreshold"]) .MuiSlider-thumb[data-index="1"]',true]
  ]) {
    const target=settingsForm.querySelector(selector),button=document.createElement('button');button.textContent=title;document.querySelector('#fixture-controls').append(button);
    button.addEventListener('click',()=>{clear();target.focus();if(simulateHalo)target.classList.add('Mui-focusVisible');const before=snapshot();apply();const after=snapshot();report.textContent=`${markers.length} paint markers · ${after.filter((v,i)=>JSON.stringify(v)!==JSON.stringify(before[i])).length} geometry/media differences · ${title}`;});
  }
  const personaThumb=document.querySelector('form:has(#field-name) .MuiSlider-thumb');
  const dashboardOption=document.querySelector('#menu- [role="option"]:not([aria-selected="true"])');
  if(dashboardOption){
    const focusButton=document.createElement('button');focusButton.textContent='Preview menu focus';focusButton.id='fixture-menu-focus';document.querySelector('#fixture-controls').append(focusButton);
    focusButton.addEventListener('click',()=>{clear();document.querySelector('#menu- [aria-selected="true"]').classList.remove('Mui-focusVisible');dashboardOption.classList.add('Mui-focusVisible');apply();report.textContent='Native menu focus state · original selection retained';});
  }
  if(personaThumb){
    const focusButton=document.createElement('button');focusButton.textContent='Preview slider focus';focusButton.id='fixture-focus';document.querySelector('#fixture-controls').append(focusButton);
    focusButton.addEventListener('click',()=>{clear();personaThumb.classList.add('Mui-focusVisible');personaThumb.scrollIntoView({block:'center'});apply();report.textContent='Native slider focus geometry · recoloured halo';});
  }
  document.querySelector('#fixture-original').addEventListener('click',()=>{clear();report.textContent='Original restored';});
  document.querySelector('#fixture-dark').addEventListener('click',()=>{
    clear();native=snapshot();
    const result=apply();
    const after=snapshot();
    const changed=after.flatMap((v,i)=>JSON.stringify(v)!==JSON.stringify(native[i])?[i]:[]);
    report.textContent=`${markers.length} paint markers · ${changed.length} geometry/media differences · ${result.partial?'partial adapter':'applied'}${result.failedFamilies?.length?' · native '+result.failedFamilies.join(', '):''}`;
  });
  document.querySelector('#fixture-guards').addEventListener('click',async()=>{
    if(isPublic) {
      clear();const checks={},body=document.querySelector('.body-container-wrapper'),footer=document.querySelector('.footer-section');
      const artwork=()=>[...document.querySelectorAll('img,video,source,.hero-container,.flip-box-front,.flip-box-back,.gartner-banner__grid,.analyst-recognition__grid,.logo-scroll-item')].map(e=>[e.tagName,[...e.attributes].map(a=>[a.name,a.value]),getComputedStyle(e).backgroundImage,getComputedStyle(e).opacity,getComputedStyle(e).filter]);
      const originalArt=JSON.stringify(artwork());
      const isNative=root=>!root.matches('[data-cg-slot],[data-cg-text]')&&!root.querySelector('[data-cg-slot],[data-cg-text]');
      const change=(name,node,attr,value,target=body)=>{const old=node.getAttribute(attr);node.setAttribute(attr,value);apply();checks[name]=isNative(target);clear();if(old===null)node.removeAttribute(attr);else node.setAttribute(attr,old);};
      change('route',document.documentElement,'data-fixture-path','/news');
      change('header',document.querySelector('header.global-header'),'class','unrecognized');
      change('bodyFill',body,'style','background-color:rgb(240,240,240)');
      change('trustGradient',document.querySelector('section:has(> .row-trust-slider)'),'style','background-image:linear-gradient(to right,white,black)');
      change('statFill',document.querySelector('.number-liftups-item.box-bg-white'),'style','background-color:rgb(250,240,230)');
      change('actionPriority',document.querySelector('.harness-the-power:not(.dark) a.cta-2023-primary'),'style','color:white!important');
      change('newsFill',document.querySelector('.post-body'),'style','background-color:rgb(240,240,240)');
      change('footerFill',footer,'style','background-color:rgb(250,240,230)',footer);
      change('footerPriority',footer.querySelector('.hs-menu-wrapper a'),'style','color:rgb(34,33,43)!important',footer);
      change('brandMat',footer.querySelector('.widget-type-linked_image'),'style','background-color:rgb(245,245,245)',footer);
      change('socialMat',footer.querySelector('li:has(> a > img:only-child)'),'style','background-color:rgb(245,245,245)',footer);
      const header=document.querySelector('header'),nav=header.querySelector('.header-nav'),active=header.querySelector('.mega-menu-popout.visible');
      change('headerNavFill',nav,'style','background-color:rgb(240,240,240)',header);
      change('headerNavShadow',nav,'style','box-shadow:0 2px 15px black',header);
      change('headerBrandMat',nav.querySelector('.black-logo'),'style','background-color:rgb(250,240,230)',header);
      change('headerLanguage',nav.querySelector('.lang_list_class'),'style','background-color:rgb(240,240,240)',header);
      change('headerTriggerKey',nav.querySelector('li.hs-menu-depth-1'),'data-check','unknown',header);
      change('headerActionPriority',nav.querySelector('.light-blue-cta a'),'style','background-color:rgb(33,33,43)!important',header);
      if(active) {
        const panel=active.querySelector('.mega-menu-popout__desktop');
        change('headerMenuKey',active,'data-check','unknown',header);
        change('headerMenuFill',panel,'style','background-color:rgb(240,240,240)',header);
        change('headerMenuShadow',panel,'style','box-shadow:0 2px 16px rgba(0,0,0,.1)',header);
        change('headerBodyState',document.body,'class',document.body.className.replace('activated',''),header);
        const label=panel.querySelector('.h6');change('headerTextPriority',label,'style','color:rgb(11,54,148)!important',header);
        const divider=panel.querySelector('.mega-menu__column__wrapper.col-2');
        if(divider)change('headerBorderPriority',divider,'style','border-left-color:rgba(11,54,148,.15)!important',header);
        const icon=panel.querySelector('.image-wrapper--small');
        if(icon)change('headerIconMat',icon,'style','background-color:rgb(240,240,240)',header);
      }
      const extraHeader=document.createElement('small');extraHeader.textContent='Unknown header';extraHeader.style.color='rgb(3,7,12)';nav.append(extraHeader);apply();checks.headerUnknown=isNative(header);checks.headerFailureIndependent=!isNative(body)&&!isNative(footer);checks.headerScrimRestored=!document.body.hasAttribute('data-cg-slot');clear();extraHeader.remove();
      const unknown=document.createElement('span');unknown.style.color='rgb(3,7,12)';unknown.textContent='Unregistered';body.append(unknown);
      apply();checks.unknownText=isNative(body);checks.footerIndependent=!isNative(footer);checks.headerIndependent=!isNative(header);clear();unknown.remove();
      for(const tag of ['strong','em','b','small']) {const extra=document.createElement(tag);extra.textContent='Unknown';extra.style.color='rgb(3,7,12)';body.append(extra);apply();checks['unknown-'+tag]=isNative(body);clear();extra.remove();}
      const oldFooter=footer.getAttribute('style');footer.style.backgroundColor='rgb(250,240,230)';apply();checks.bodyIndependent=!isNative(body);clear();if(oldFooter===null)footer.removeAttribute('style');else footer.setAttribute('style',oldFooter);
      apply();const count=markers.length;checks.artwork=JSON.stringify(artwork())===originalArt;clear();checks.restoration=markers.length===0&&!document.documentElement.hasAttribute('data-cg-palette');apply();checks.reapply=markers.length===count;
      report.textContent=Object.entries(checks).map(([k,v])=>`${k} ${v?'PASS':'FAIL'}`).join(' · ');report.dataset.guardDetails=JSON.stringify(checks);return;
    }
    const settingsBanner=document.querySelector('[data-test="AgentSettingsHeader"]');
    if(settingsBanner) {
      clear();const checks={},owner=settingsBanner.parentElement,form=owner.querySelector('[role="main"] > form');
      const portals=[...document.querySelectorAll('.MuiAutocomplete-paper,.MuiPopover-paper')];
      const roots=[owner,...portals],nativeArt=roots.flatMap(r=>[...r.querySelectorAll('img')].map(e=>e.outerHTML));
      const isNative=()=>roots.every(r=>!r.matches('[data-cg-slot],[data-cg-text]')&&!r.querySelector('[data-cg-slot],[data-cg-text]'));
      const change=(name,node,attr,value)=>{const old=node.getAttribute(attr);node.setAttribute(attr,value);apply();checks[name]=isNative();clear();if(old===null)node.removeAttribute(attr);else node.setAttribute(attr,old);};
      change('route',document.documentElement,'data-fixture-path','/project/a/b/flows');
      change('headerHook',settingsBanner,'data-test','UnknownHeader');
      change('sectionHook',form.querySelector('#currencySettingsCollapsableSection'),'id','unknown-section');
      change('mainFill',form.parentElement,'style','background-color:rgb(255,250,240)');
      change('fieldFill',form.querySelector('.MuiInputBase-root'),'style','background-color:rgb(255,250,240)');
      change('accordionFill',form.querySelector('.MuiAccordion-root'),'style','background-color:rgb(255,250,240)');
      change('switchAlpha',form.querySelector('.MuiSwitch-track'),'style','opacity:.2');
      const slider=form.querySelector('.MuiSlider-root:has(input[name="intentThreshold"])'),thumb=slider.querySelectorAll('.MuiSlider-thumb')[1];
      const next=thumb.nextSibling;thumb.remove();apply();checks.rangeCount=isNative();clear();slider.insertBefore(thumb,next);
      change('sliderShadow',thumb,'style','box-shadow:0 0 0 9px red');
      const radio=form.querySelector('.MuiRadio-root input');const checked=radio.checked;radio.checked=!checked;apply();checks.radioState=isNative();clear();radio.checked=checked;
      const glyph=radio.closest('.MuiRadio-root').querySelector('svg'),glyphStyle=glyph.getAttribute('style'),nativeInk=getComputedStyle(glyph).fill;
      glyph.style.setProperty('fill',nativeInk,'important');apply();checks.radioPriority=isNative();clear();if(glyphStyle===null)glyph.removeAttribute('style');else glyph.setAttribute('style',glyphStyle);
      glyph.style.fill=nativeInk;apply();checks.radioLiteral=getComputedStyle(glyph).fill===getComputedStyle(radio.closest('.MuiRadio-root')).color&&getComputedStyle(glyph).fill!==nativeInk;clear();if(glyphStyle===null)glyph.removeAttribute('style');else glyph.setAttribute('style',glyphStyle);
      const save=form.querySelector('#saveSettingsButton');change('savePriority',save,'style','color:rgba(0,0,0,.26)!important');
      save.disabled=false;apply();checks.saveState=isNative();clear();save.disabled=true;
      apply();checks.saveSemantics=save.disabled&&save.tabIndex===-1&&getComputedStyle(save).opacity==='1';clear();
      const auto=document.querySelector('.MuiAutocomplete-popper [role="listbox"]');
      if(auto){const combo=owner.querySelector('[role="combobox"][aria-expanded="true"]');change('autocompleteLink',combo,'aria-owns','missing');change('autocompleteOption',auto.firstElementChild,'style','background-color:rgb(255,250,240)');}
      const select=document.querySelector('.MuiPopover-paper [role="listbox"]');
      if(select){change('selectLink',select,'aria-labelledby','missing');change('selectPortal',select.closest('.MuiPopover-root'),'id','missing');change('selectOption',select.firstElementChild,'style','background-color:rgb(255,250,240)');}
      const unknown=document.createElement('div');unknown.textContent='Unknown widget';unknown.style.color='black';owner.append(unknown);apply();checks.unknownText=isNative();clear();unknown.remove();
      checks.restoration=isNative();apply();apply();const result=apply();
      if(result.retryFamilies?.length){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,250))));apply();}
      checks.reapply=owner.hasAttribute('data-cg-slot');
      checks.artwork=JSON.stringify(nativeArt)===JSON.stringify(roots.flatMap(r=>[...r.querySelectorAll('img')].map(e=>e.outerHTML)));
      report.textContent=Object.entries(checks).map(([k,v])=>`${k} ${v?'PASS':'FAIL'}`).join(' · ');report.dataset.guardDetails=JSON.stringify(checks);return;
    }
    const gallery=document.querySelector('main#mainContent[data-test="aiAgentMainContent"]');
    const agentMain=document.querySelector('div#mainContent:has(#AIAgent-Tab-jobs)');
    const agentOwner=gallery||agentMain?.parentElement;
    if(agentOwner) {
      const checks={};clear();
      const nativeArt=[...agentOwner.querySelectorAll('img')].map(e=>e.outerHTML);
      const isNative=()=>!agentOwner.querySelector('[data-cg-slot],[data-cg-text]')&&!agentOwner.hasAttribute('data-cg-slot');
      if(gallery) {
        const card=gallery.querySelector('[data-test="ai-agent-card"]');
        const original=card.getAttribute('style');card.style.backgroundColor='rgb(255,250,240)';apply();checks.card=isNative();clear();
        if(original===null)card.removeAttribute('style');else card.setAttribute('style',original);
        card.removeAttribute('data-test');apply();checks.anchor=isNative();clear();card.setAttribute('data-test','ai-agent-card');
        card.style.borderColor='rgb(11,54,148)';apply();checks.hover=gallery.hasAttribute('data-cg-slot');clear();
        if(original===null)card.removeAttribute('style');else card.setAttribute('style',original);
      } else {
        const frame=agentMain.firstElementChild,form=frame.querySelector('form'),parent=form.parentElement,next=form.nextSibling;
        form.remove();apply();checks.frame=isNative()&&!!document.querySelector('.SIDEBAR_WRAPPER [data-cg-slot]');clear();parent.insertBefore(form,next);
        const savedPath=document.documentElement.dataset.fixturePath;
        document.documentElement.dataset.fixturePath=savedPath.replace(/\/(jobs|persona)(?:\/[^/]+)?$/,(m,k)=>k==='jobs'?'/persona':'/jobs');
        apply();checks.route=isNative();clear();document.documentElement.dataset.fixturePath=savedPath;
        const field=form.querySelector('.MuiInputBase-root,.c26-legacy-cognigy-text-input-row');
        const original=field.getAttribute('style');field.style.backgroundColor='rgb(255,250,240)';apply();checks.field=isNative();clear();
        if(original===null)field.removeAttribute('style');else field.setAttribute('style',original);
        const tool=form.querySelector('[role="button"][aria-pressed]');if(tool){const pressed=tool.getAttribute('aria-pressed');tool.removeAttribute('aria-pressed');apply();checks.tool=isNative();clear();tool.setAttribute('aria-pressed',pressed);}
        const rail=form.querySelector('.MuiSlider-rail');
        if(rail){const style=rail.getAttribute('style');rail.style.opacity='.2';apply();checks.slider=isNative();clear();if(style===null)rail.removeAttribute('style');else rail.setAttribute('style',style);}
        const thumb=form.querySelector('.MuiSlider-thumb');
        if(thumb){thumb.classList.add('Mui-focusVisible');apply();checks.focus=thumb.getAttribute('data-cg-slot')?.split(' ').includes('agent-slider-halo8');clear();thumb.classList.remove('Mui-focusVisible');
          const style=thumb.getAttribute('style');thumb.style.boxShadow='0px 0px 0px 9px rgb(255,0,0)';apply();checks.shadow=isNative();clear();if(style===null)thumb.removeAttribute('style');else thumb.setAttribute('style',style);}
        const track=form.querySelector('.MuiSwitch-track');
        if(track){const style=track.getAttribute('style');track.style.opacity='.2';apply();checks.switch=isNative();clear();if(style===null)track.removeAttribute('style');else track.setAttribute('style',style);}
      }
      const accordion=agentOwner.querySelector('.MuiAccordion-root');if(accordion){const expanded=accordion.classList.contains('Mui-expanded');accordion.classList.add('Mui-expanded');apply();checks.advanced=agentOwner.hasAttribute('data-cg-slot');clear();accordion.classList.toggle('Mui-expanded',expanded);
        const style=accordion.getAttribute('style');accordion.style.backgroundColor='rgb(255,250,240)';apply();checks.accordionFill=isNative();clear();if(style===null)accordion.removeAttribute('style');else accordion.setAttribute('style',style);}
      const popup=document.querySelector('.MuiAutocomplete-popper [role="listbox"]');
      if(popup) {
        const paper=popup.parentElement,combo=agentOwner.querySelector('[role="combobox"][aria-expanded="true"]'),input=combo.querySelector('input[aria-controls]');
        const portalNative=()=>isNative()&&!paper.matches('[data-cg-slot],[data-cg-text]')&&!paper.querySelector('[data-cg-slot],[data-cg-text]');
        const controls=input.getAttribute('aria-controls'),owns=combo.getAttribute('aria-owns');
        input.removeAttribute('aria-controls');apply();checks.missingLink=portalNative();clear();input.setAttribute('aria-controls',controls);
        combo.setAttribute('aria-owns','unknown-listbox');apply();checks.mismatchedLink=portalNative();clear();combo.setAttribute('aria-owns',owns);
        const field=input.closest('.MuiInputBase-root'),style=field.getAttribute('style');field.style.backgroundColor='rgb(255,250,240)';apply();checks.parentFailure=portalNative();clear();if(style===null)field.removeAttribute('style');else field.setAttribute('style',style);
        const option=popup.firstElementChild,optionStyle=option.getAttribute('style');option.style.color='rgb(255,0,255)';apply();checks.unknownOption=portalNative();clear();if(optionStyle===null)option.removeAttribute('style');else option.setAttribute('style',optionStyle);
        const label=option.firstElementChild,labelStyle=label.getAttribute('style');label.style.color=getComputedStyle(option).color;apply();checks.explicitLabel=portalNative();clear();label.setAttribute('style',labelStyle);
        label.style.backgroundColor='white';apply();checks.opaqueLabel=portalNative();clear();label.setAttribute('style',labelStyle);
        const focus=option.getAttribute('data-focus');option.setAttribute('data-focus','true');apply();checks.optionFocus=getComputedStyle(option).backgroundColor==='rgb(141, 182, 255)'&&getComputedStyle(option).color==='rgb(21, 24, 30)';clear();if(focus===null)option.removeAttribute('data-focus');else option.setAttribute('data-focus',focus);
      }
      const unknown=document.createElement('div');unknown.textContent='Unmapped widget';unknown.style.color='rgb(0,0,0)';agentOwner.append(unknown);apply();checks.unknown=isNative();clear();unknown.remove();
      checks.restoration=isNative();apply();apply();const result=apply();
      if(result.retryFamilies?.length){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,250))));apply();}
      checks.reapply=agentOwner.hasAttribute('data-cg-slot');
      checks.artwork=JSON.stringify(nativeArt)===JSON.stringify([...agentOwner.querySelectorAll('img')].map(e=>e.outerHTML));
      report.textContent=Object.entries(checks).map(([k,v])=>`${k} ${v?'PASS':'FAIL'}`).join(' · ');
      report.dataset.guardDetails=JSON.stringify(checks);return;
    }
    const interaction=document.querySelector('#interactionPanel.open > #interactionPanelWrapper');
    if(interaction) {
      const checks={};clear();
      const field=interaction.querySelector('.MuiInputBase-root');
      const fieldStyle=field.getAttribute('style');field.style.backgroundColor='rgb(255, 250, 240)';
      apply();checks.field=!interaction.hasAttribute('data-cg-slot')&&!field.querySelector('[data-cg-slot~="field-outline"]');clear();
      if(fieldStyle===null)field.removeAttribute('style');else field.setAttribute('style',fieldStyle);
      const unknown=document.createElement('div');unknown.textContent='Unknown widget';unknown.style.color='rgb(0, 0, 0)';interaction.append(unknown);
      apply();checks.unknown=!interaction.hasAttribute('data-cg-slot');clear();unknown.remove();
      const transcript=interaction.querySelector('#chatContainer');
      if(transcript){const message=document.createElement('div');message.textContent='Unmapped message';transcript.append(message);apply();checks.conversation=!interaction.hasAttribute('data-cg-slot');clear();message.remove();}
      const toggle=interaction.querySelector('.MuiSwitch-root');
      if(toggle) {
        const base=toggle.querySelector('.MuiSwitch-switchBase'),input=toggle.querySelector('input'),track=toggle.querySelector('.MuiSwitch-track');
        const checked=input.checked;getComputedStyle(track).opacity;
        base.classList.toggle('Mui-checked',!checked);input.checked=!checked;
        await new Promise(resolve=>setTimeout(resolve,70));
        apply();checks.transition=interaction.hasAttribute('data-cg-slot');clear();
        base.classList.toggle('Mui-checked',checked);input.checked=checked;
        await new Promise(resolve=>setTimeout(resolve,180));
        const oldOpacity=track.style.opacity;track.style.opacity='0.2';
        apply();checks.switch=!interaction.hasAttribute('data-cg-slot');clear();track.style.opacity=oldOpacity;
      }
      const editor=interaction.querySelector('.monaco-editor');
      apply();if(editor)checks.editor=!editor.matches('[data-cg-slot],[data-cg-text]')&&!editor.querySelector('[data-cg-slot],[data-cg-text]');
      clear();checks.restoration=!interaction.querySelector('[data-cg-slot],[data-cg-text]');
      apply();apply();const finalApply=apply();
      report.dataset.retryDetails=JSON.stringify(finalApply);
      if(finalApply.retryFamilies?.length){await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,250))));apply();}
      checks.reapply=interaction.hasAttribute('data-cg-slot');
      const messageInput=interaction.querySelector('#interactionPanelMessageTextField');
      if(messageInput)checks.placeholder=messageInput.getAttribute('data-cg-slot')?.split(' ').includes('placeholder')===true;
      report.textContent=Object.entries(checks).map(([k,v])=>`${k} ${v?'PASS':'FAIL'}`).join(' · ');
      report.dataset.guardDetails=JSON.stringify(checks);return;
    }
    const dashboard=document.querySelector('[data-test="AgentDashboardHeader"]')?.parentElement;
    if(dashboard) {
      clear();const checks={},popup=document.querySelector('#menu-'),main=dashboard.querySelector('div#mainContent');
      const isNative=()=>![dashboard,popup].filter(Boolean).some(e=>e.matches('[data-cg-slot],[data-cg-text],[data-cg-owner]')||e.querySelector('[data-cg-slot],[data-cg-text],[data-cg-owner]'));
      const art=[...dashboard.querySelectorAll('[style*="background-image"],.MuiAvatar-root')].map(e=>e.outerHTML);
      const change=(name,node,attribute,value)=>{const old=node.getAttribute(attribute);node.setAttribute(attribute,value);apply();checks[name]=isNative();clear();if(old===null)node.removeAttribute(attribute);else node.setAttribute(attribute,old);};
      change('route',document.documentElement,'data-fixture-path','/project/example/example/settings');
      change('header',dashboard.querySelector('[data-test="AgentDashboardHeader"]'),'data-test','UnmappedHeader');
      change('heading',main.querySelector('p#dashboardAnalyticsWidgetHeading'),'id','unmappedHeading');
      change('cardFill',main.firstElementChild,'style','background-color:rgb(255,250,240)');
      change('shadow',main.firstElementChild,'style','box-shadow:0 2px 21px rgba(0,0,0,.1)');
      const curve=dashboard.querySelector('.recharts-line-curve');
      change('chartPaint',curve,'stroke','rgb(255,0,255)');
      change('chartPriority',curve,'style','stroke:rgb(11,54,148)!important');
      const extra=curve.cloneNode();curve.parentElement.append(extra);apply();checks.extraSeries=isNative();clear();extra.remove();
      change('tickAlpha',dashboard.querySelector('.recharts-cartesian-axis-tick-value'),'opacity','.5');
      const unknown=document.createElement('div');unknown.textContent='Unmapped widget';unknown.style.color='black';dashboard.append(unknown);apply();checks.unknown=isNative();clear();unknown.remove();
      if(popup) {
        const trigger=dashboard.querySelector('.MuiSelect-root[aria-haspopup="listbox"]'),option=popup.querySelector('[role="option"]');
        change('closedTrigger',trigger,'aria-expanded','false');
        change('portalIdentity',popup,'id','unknown-menu');
        change('optionEnum',option,'data-value','unknown');
        change('optionPaint',option,'style','background-color:rgb(255,250,240)!important');
        change('opaqueLabel',option.firstElementChild,'style','background-color:white');
        const unselected=popup.querySelector('[role="option"]:not([aria-selected="true"])');
        const original=unselected.className,selected=popup.querySelector('[aria-selected="true"]'),selectedClass=selected.className;
        selected.classList.remove('Mui-focusVisible');unselected.classList.add('Mui-focusVisible');apply();
        await new Promise(resolve=>setTimeout(resolve,250));
        checks.menuFocus=getComputedStyle(unselected).backgroundColor==='rgb(141, 182, 255)'&&getComputedStyle(unselected.firstElementChild).color==='rgb(21, 24, 30)';clear();unselected.className=original;selected.className=selectedClass;
      }
      const tooltip=dashboard.querySelector('.recharts-tooltip-wrapper > div');if(tooltip)change('tooltipFill',tooltip,'style','background-color:rgb(255,250,240)');
      checks.restoration=isNative();apply();apply();const result=apply();
      checks.reapply=main.hasAttribute('data-cg-slot')&&!result.failedFamilies.includes('dashboard');
      checks.artwork=JSON.stringify(art)===JSON.stringify([...dashboard.querySelectorAll('[style*="background-image"],.MuiAvatar-root')].map(e=>e.outerHTML));
      report.textContent=Object.entries(checks).map(([k,v])=>`${k} ${v?'PASS':'FAIL'}`).join(' · ');
      report.dataset.guardDetails=JSON.stringify(checks);return;
    }
    if(/\/(endpoints|snapshots|playbooks)\/?$/.test(document.documentElement.dataset.fixturePath)) {
      clear();const checks={},list=document.querySelector('main#mainContent'),table=list.querySelector('[role="table"]'),banner=document.querySelector('[role="banner"]');
      const row=table.querySelectorAll('[role="rowgroup"]')[1].querySelector('[role="row"]');
      const nativeArt=[...list.querySelectorAll('img,.MuiAvatar-root')].map(e=>e.outerHTML);
      const isNative=()=>!list.matches('[data-cg-slot],[data-cg-text]')&&!list.querySelector('[data-cg-slot],[data-cg-text]');
      const change=(name,node,attr,value)=>{const prior=node.getAttribute(attr);node.setAttribute(attr,value);apply();checks[name]=isNative();clear();if(prior===null)node.removeAttribute(attr);else node.setAttribute(attr,prior);};
      change('listingRoute',document.documentElement,'data-fixture-path','/project/a/b/endpoints/example');
      change('routeBodyMismatch',document.documentElement,'data-fixture-path','/project/a/b/flows');
      change('headerHook',banner,'data-test','UnknownHeader');
      change('tableLink',table,'aria-labelledby','unknown-heading');
      const unknown=document.createElement('div');unknown.textContent='Unknown widget';unknown.style.color='black';list.append(unknown);apply();checks.unknownText=isNative();clear();unknown.remove();
      const described=row?.querySelector('[aria-describedby]');
      if(described){change('descriptionLink',described,'aria-describedby','missing-description');change('rowFill',row,'style','background-color:rgb(255,250,240)');change('rowShadow',row,'style','box-shadow:0 2px 11px rgba(0,0,0,.1)');}
      const disabled=banner.querySelector('button.MuiButton-containedPrimary:disabled');
      if(disabled){
        const style=disabled.getAttribute('style');disabled.style.backgroundColor='rgb(255,250,240)';apply();checks.disabledPaint=!banner.hasAttribute('data-cg-slot');clear();if(style===null)disabled.removeAttribute('style');else disabled.setAttribute('style',style);
        disabled.style.setProperty('color','rgba(0, 0, 0, 0.26)','important');apply();checks.disabledPriority=!banner.hasAttribute('data-cg-slot');clear();if(style===null)disabled.removeAttribute('style');else disabled.setAttribute('style',style);
        disabled.disabled=false;apply();checks.disabledMismatch=!banner.hasAttribute('data-cg-slot');clear();disabled.disabled=true;
        apply();checks.disabledSemantics=disabled.disabled&&getComputedStyle(disabled).opacity==='1'&&disabled.getAttribute('tabindex')==='-1';clear();
      }
      const link=row?.querySelector('.MuiListItem-button');
      if(link){change('rowFill',link,'style','background-color:rgb(255,250,240)');change('rowPriority',link,'style','background-color:white!important');}
      const menu=document.querySelector('.MuiPopover-paper > [role="menu"][aria-labelledby]');
      if(menu){const id=menu.getAttribute('aria-labelledby');menu.setAttribute('aria-labelledby','missing-trigger');apply();checks.menuLink=!menu.parentElement.hasAttribute('data-cg-slot');clear();menu.setAttribute('aria-labelledby',id);}
      checks.restoration=isNative();apply();apply();const result=apply();
      checks.reapply=list.hasAttribute('data-cg-slot')&&!result.failedFamilies.includes('list');
      checks.artwork=JSON.stringify(nativeArt)===JSON.stringify([...list.querySelectorAll('img,.MuiAvatar-root')].map(e=>e.outerHTML));
      report.textContent=Object.entries(checks).map(([k,v])=>`${k} ${v?'PASS':'FAIL'}`).join(' · ');report.dataset.guardDetails=JSON.stringify(checks);return;
    }
    if(!chart){
      clear();const list=document.querySelector('main#mainContent');
      const row=list?.querySelector('[role="row"] .MuiListItem-button');
      const field=document.querySelector('[role="banner"] .MuiInputBase-root');
      if(!row||!field){report.textContent='This fixture has no guard targets';return;}
      const card=row.closest('.MuiPaper-root');const rowStyle=card.getAttribute('style');card.style.backgroundColor='rgb(255, 250, 240)';
      const injectedRowColor=getComputedStyle(card).backgroundColor;const rowResult=apply();const rowGuard=!list.hasAttribute('data-cg-slot')&&!row.querySelector('[data-cg-text]');
      const rowDiagnostic={injectedRowColor,families:rowResult.failedFamilies,list:list.getAttribute('data-cg-slot'),textMarkers:row.querySelectorAll('[data-cg-text]').length};clear();
      if(rowStyle===null)card.removeAttribute('style');else card.setAttribute('style',rowStyle);
      const fieldStyle=field.getAttribute('style');field.style.backgroundColor='rgb(255, 250, 240)';
      apply();const fieldGuard=!field.hasAttribute('data-cg-slot')&&!field.querySelector('[data-cg-slot~="field-outline"]');clear();
      if(fieldStyle===null)field.removeAttribute('style');else field.setAttribute('style',fieldStyle);
      const menu=document.querySelector('[role="menu"][aria-labelledby]');let menuGuard=true;
      if(menu){const label=menu.getAttribute('aria-labelledby');menu.setAttribute('aria-labelledby','missing-trigger');apply();menuGuard=!menu.parentElement.hasAttribute('data-cg-slot');clear();menu.setAttribute('aria-labelledby',label);}
      const restored=!document.documentElement.hasAttribute('data-cg-palette');apply();apply();apply();
      const reapply=list.hasAttribute('data-cg-slot');
      report.textContent=`Pale card ${rowGuard?'PASS':'FAIL'} · field/outline ${fieldGuard?'PASS':'FAIL'} · menu linkage ${menuGuard?'PASS':'FAIL'} · restoration ${restored?'PASS':'FAIL'} · reapply ${reapply?'PASS':'FAIL'}`;
      report.dataset.guardDetails=JSON.stringify(rowDiagnostic);return;
    }
    clear();const canvas=document.querySelector('#chartContent');const line=canvas.querySelector(':scope > svg > path');
    const originalStyle=line.getAttribute('style');
    line.style.stroke='rgb(255, 0, 255)';apply();const connectorGuard=!canvas.hasAttribute('data-cg-slot');clear();
    if(originalStyle===null)line.removeAttribute('style');else line.setAttribute('style',originalStyle);
    const unknown=document.createElement('div');unknown.textContent='Unknown widget';unknown.style.color='rgb(0, 0, 0)';canvas.append(unknown);
    apply();const textGuard=!canvas.hasAttribute('data-cg-slot');clear();unknown.remove();
    const originalCanvasStyle=canvas.getAttribute('style');canvas.style.setProperty('background-color','rgb(249, 249, 254)','important');
    apply();const importantGuard=!canvas.hasAttribute('data-cg-slot');clear();
    if(originalCanvasStyle===null)canvas.removeAttribute('style');else canvas.setAttribute('style',originalCanvasStyle);
    const restoration=markers.length===0&&!document.documentElement.hasAttribute('data-cg-palette');
    apply();report.textContent=`Connector ${connectorGuard?'PASS':'FAIL'} · unknown text ${textGuard?'PASS':'FAIL'} · inline priority ${importantGuard?'PASS':'FAIL'} · restoration ${restoration?'PASS':'FAIL'}`;
  });
})();
