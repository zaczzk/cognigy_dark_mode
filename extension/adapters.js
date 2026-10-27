/* Positive paint-slot registry, based on the 24 October native DOM survey.
 * A computed value is a compatibility guard ONLY, never the role classifier.
 * No project text, values, image sources or application state are read here.
 */
(() => {
  'use strict';
  const TRANSPARENT='rgba(0, 0, 0, 0)';
  const LIGHT=['rgb(255, 255, 255)','rgb(250, 250, 250)','rgb(249, 249, 254)','rgb(245, 246, 253)','rgb(248, 248, 248)'];
  const TEXT=['rgb(0, 0, 0)','rgb(37, 37, 37)','rgba(0, 0, 0, 0.87)','rgba(0, 0, 0, 0.8)','rgb(31, 41, 55)'];
  const SECONDARY=['rgb(107, 114, 128)','rgb(143, 143, 153)','rgb(166, 166, 173)','rgba(0, 0, 0, 0.54)','rgb(117, 117, 117)','rgb(102, 102, 102)'];
  const LINK=['rgb(11, 54, 148)','rgb(18, 107, 206)','rgb(61, 159, 255)'];
  const PROTECTED='.monaco-editor, .c26-legacy-token-chip, .MuiAvatar-root, iframe, video, canvas, [data-1password-root], [data-codex-overlay], [data-cg-native]';
  const AGENT_GRADIENT='linear-gradient(rgb(236, 245, 254) 3.67%, rgb(255, 255, 255) 42.49%)';
  const AGENT_SHADOW='rgba(18, 107, 206, 0.1) 0px 8px 16px 0px, rgb(255, 255, 255) 0px 0px 0px 2px inset';
  const AVATAR_SHADOW='rgba(18, 107, 206, 0.3) 12px 12px 25px 0px, rgba(18, 107, 206, 0.15) 4px 4px 8px 0px';
  const unique=(doc,s)=>{const nodes=doc.querySelectorAll(s);return nodes.length===1?nodes[0]:null;};
  // Weak identities retain only previously committed Audit tooltips through native exit.
  const auditTooltipLinks=new WeakMap(),agentTooltipLinks=new WeakMap();
  function qualify(doc, loc, own, only=null) {
    const pendingAuditTooltipLinks=[],pendingAgentTooltipLinks=[];
    // All qualification reads precede the commit below. These caches live for
    // one synchronous pass only; no native style survives a later mutation.
    const styles=new WeakMap(),animations=new WeakMap(),paints=new WeakMap(),safety=new WeakMap();
    const safe=el=>{
      if(!safety.has(el))safety.set(el,!el.closest(PROTECTED) && !el.closest(':disabled, [aria-disabled="true"], .Mui-disabled'));
      return safety.get(el);
    };
    const getComputedStyle=(el,pseudo=null)=>{
      let entries=styles.get(el);if(!entries){entries=new Map();styles.set(el,entries);}
      if(!entries.has(pseudo))entries.set(pseudo,globalThis.getComputedStyle(el,pseudo));
      return entries.get(pseudo);
    };
    let indexedAnimations=false;
    const nativeAnimations=(el,subtree=false)=>{
      // Snapshot active effects once during this synchronous, read-only pass.
      // CSS settings alone cannot prove that a running transition has ended.
      // Callers match exact effect targets/pseudo-elements, so no descendant
      // enumeration is needed after the document's native animation snapshot.
      if(typeof doc.getAnimations==='function') {
        if(!indexedAnimations) {
          for(const animation of doc.getAnimations()) {
            const target=animation.effect?.target;if(!target)continue;
            if(!animations.has(target))animations.set(target,[]);
            animations.get(target).push(animation);
          }
          indexedAnimations=true;
        }
        return animations.get(el)||[];
      }
      let entries=animations.get(el);if(!entries){entries=new Map();animations.set(el,entries);}
      if(!entries.has(subtree))entries.set(subtree,el.getAnimations?.({subtree})||[]);
      return entries.get(subtree);
    };
    // Read the destination of native paint transitions rather than a transient
    // mixed colour. Animation timing and application styles stay untouched.
    function paintValue(el,property,pseudo=null) {
      let entries=paints.get(el);if(!entries){entries=new Map();paints.set(el,entries);}
      const key=(pseudo||'')+':'+property;
      if(entries.has(key))return entries.get(key);
      const current=getComputedStyle(el,pseudo)[property];
      const cssProperty=property.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
      const transition=nativeAnimations(el,!!pseudo).find(a=>a.transitionProperty===cssProperty&&a.effect?.target===el&&(a.effect.pseudoElement||null)===pseudo);
      if(!transition){entries.set(key,current);return current;}
      const frames=transition.effect.getKeyframes();
      const value=frames.length===2&&transition.playbackRate===1&&transition.effect.getTiming().direction==='normal'
        ?frames[1][property]??current:'unqualified-transition';
      entries.set(key,value);return value;
    }
    let applied=0, partial=false;
    let family='shell';
    const enabled=name=>!only||only.has(name);
    const plans=[];
    const boundaries=[];
    const rejected=new Set();
    const retryFamilies=new Set();
    const plan=(el,name,value)=>plans.push([el,name,value,family]);
    const slot=(el, value)=>{if(el && safe(el)) plan(el,'data-cg-slot',value);};
    const all=(root,s)=>Array.from(root.querySelectorAll(s)).filter(safe);
    const monoPaths=(svg,neutral)=>{
      const paths=Array.from(svg.querySelectorAll('path'));
      if(!paths.length||svg.querySelector('image,linearGradient,radialGradient')||!paths.every(p=>neutral.includes(getComputedStyle(p).fill)&&neutral.includes(getComputedStyle(p).stroke)))return;
      for(const p of paths){const g=getComputedStyle(p);if(g.fill!=='none')slot(p,'mono-fill');if(g.stroke!=='none')slot(p,'mono-stroke');}
    };
    const mono=svg=>monoPaths(svg,[...TEXT,...SECONDARY,'none']);
    const surface=(el,kind,allowed=LIGHT)=>{
      if(!el || !safe(el)) return false;
      const style=getComputedStyle(el);
      if(!allowed.includes(paintValue(el,'backgroundColor'))||style.backgroundImage!=='none') {partial=true;return false;}
      slot(el,kind);return true;
    };
    const text=(el, role='text')=>{
      if(!safe(el)) return;
      const c=paintValue(el,'color');
      if(TEXT.includes(c)) plan(el,'data-cg-text',role);
      else if(SECONDARY.includes(c)) plan(el,'data-cg-text','secondary');
      else if(LINK.includes(c)) plan(el,'data-cg-text','accent');
      else {
        // An explicitly registered leaf may be inheriting an ancestor's native
        // colour transition after teardown. Refuse now; retry once after native
        // settlement, without treating equal computed colours as inheritance.
        for(let parent=el.parentElement;parent;parent=parent.parentElement) {
          if(nativeAnimations(parent).some(a=>a.transitionProperty==='color'&&a.effect?.target===parent&&a.effect.getComputedTiming().duration<=200)) {
            rejected.add(family);retryFamilies.add(family);break;
          }
        }
      }
    };
    // Only these registered text-bearing component slots may receive foreground.
    function componentText(root) {
      all(root,'.MuiTypography-root, .MuiFormLabel-root, .MuiFormLabel-root > span, .MuiInputBase-input, .MuiButton-label, .MuiTab-wrapper, .MuiTableCell-root, .MuiTableSortLabel-root, .MuiFormHelperText-root, .c26-legacy-cognigy-text-editable').forEach(e=>text(e));
      all(root,'.MuiIconButton-label > .MuiSvgIcon-root, .MuiListItemIcon-root > .MuiSvgIcon-root, .MuiListItemSecondaryAction-root > .MuiSvgIcon-root, .MuiAccordionSummary-expandIcon .MuiSvgIcon-root').forEach(e=>text(e,'icon'));
      all(root,'.c26-legacy-cognigy-text-editable [data-slate-leaf="true"]').forEach(e=>text(e));
      all(root,'.c26-legacy-cognigy-text-editable [data-slate-leaf="true"] > [data-slate-string="true"], .MuiTab-wrapper > .MuiBadge-root > span:not(.MuiBadge-badge)').forEach(e=>text(e));
      all(root,'.c26-legacy-select-input-row > div > span').forEach(e=>text(e));
    }
    function controls(root) {
      componentText(root);
      // The observed yellow Deprecated badge remains a native semantic island.
      // Own its existing foreground explicitly so themed heading ink cannot leak in.
      for(const chip of all(root,'.MuiChip-root.MuiChip-sizeSmall')) {
        const label=unique(chip,':scope > .MuiChip-label.MuiChip-labelSmall');
        if(chip.childElementCount===1&&label&&!label.childElementCount&&paintValue(chip,'backgroundColor')==='rgb(255, 215, 90)'&&getComputedStyle(chip).backgroundImage==='none'&&
          paintValue(chip,'color')==='rgba(0, 0, 0, 0.87)'&&paintValue(label,'color')==='rgba(0, 0, 0, 0.87)'&&getComputedStyle(chip).opacity==='1') {
          slot(chip,'native-semantic-surface');plan(label,'data-cg-text','native-dark');
        }
      }
      all(root,'.MuiButton-containedPrimary').forEach(e=>{if(LINK.includes(paintValue(e,'backgroundColor')))slot(e,'primary');});
      all(root,'.MuiButton-textPrimary, .MuiButton-outlinedPrimary, .MuiIconButton-root').forEach(e=>{
        const bg=paintValue(e,'backgroundColor');
        if(bg===TRANSPARENT || LIGHT.includes(bg)) {slot(e,'button');text(e,'icon');}
        if(e.matches('.MuiButton-outlinedPrimary,.MuiIconButton-root')&&LIGHT.includes(bg))surface(e,'secondary-button');
      });
      all(root,'.MuiInputBase-root, .c26-legacy-cognigy-text-input-row').forEach(e=>{
        if(family==='utility'&&e.closest('[data-test="IntentTrainerHeader"]')&&unique(e,'[role="button"][aria-haspopup="listbox"][aria-labelledby="filterPresetsId"]')&&surface(e,'primary',LINK))return;
        const agentEditable=family==='agents'&&e.matches('.c26-legacy-cognigy-text-input-row')&&
          unique(e,':scope > [data-test="CognigyTextEditableField"].c26-legacy-cognigy-text-editable');
        if(agentEditable&&!surface(agentEditable,'agent-editable',[TRANSPARENT,'rgb(236, 236, 237)']))rejected.add(family);
        const focusedAgent=['agents','settings','inspector','admin'].includes(family)&&e.matches('.MuiInputBase-root.MuiAutocomplete-inputRoot.Mui-focused')&&e.closest('[role="combobox"].Mui-focused');
        const focusedScenario=family==='utility'&&loc.pathname.endsWith('/simulator/create')&&root.matches('[data-test="SimulationEditorHeader"]')&&e.matches('.MuiInputBase-root.Mui-focused')&&unique(e,':scope > input#field-name,:scope > input#field-personaName,:scope > textarea#field-persona,:scope > textarea#field-mission,:scope > input#selectFieldForCustomTextName,:scope > textarea#selectFieldForCustomTextDescription,:scope > input#selectFieldForGoal');
        const trainerField=family==='utility'&&loc.pathname.endsWith('/trainer')&&e.closest('[data-test="IntentTrainerHeader"]')&&e.matches('.MuiInputBase-root.MuiAutocomplete-inputRoot')&&unique(e,'input:is(#flowSelectId,#intentSelectId,#recordsSelectId,#foundIntentSelectId,#foundSlotSelectId,#intentScoreSelectId)');
        const focusedKnowledge=family==='utility'&&loc.pathname.endsWith('/knowledge')&&root.id==='mainContent'&&unique(root,'.MuiStepper-root')&&e.matches('.MuiInputBase-root.MuiInput-root.Mui-focused')&&unique(e,':scope > input#field-name.MuiInputBase-input');
        const goalStepField=family==='utility'&&loc.pathname.endsWith('/goal/new')&&root.matches('.MuiDialog-paper[role="dialog"]')&&unique(root,'input#field-completionStep[type="checkbox"]')&&e.matches('.MuiInputBase-root')&&unique(e,':scope > input[id="field-name"], :scope > textarea[id="field-description"], :scope > input[id="field-metrics.duration.unit"]');
        const focusedHandover=family==='inspector'&&loc.pathname.endsWith('/handover-providers')&&root.id==='editSidebarWrapper'&&unique(root,'[role="radiogroup"][aria-labelledby="tileSelectLabel"]')&&e.matches('.MuiInputBase-root.MuiInput-root.Mui-focused')&&unique(e,':scope > input#field-name.MuiInputBase-input');
        const focusedSlot=family==='inspector'&&root.id==='editSidebarWrapper'&&e.matches('.MuiInputBase-root.MuiInput-root.Mui-focused')&&(loc.pathname.endsWith('/nlu/slots-filler')&&unique(e,':scope > input.MuiInputBase-input[id^="field-"]')||(loc.pathname.endsWith('/flows')&&unique(root,'input#field-flowGenerationInput.MuiSelect-nativeInput')||loc.pathname.endsWith('/large-language-models')&&unique(root,'input#selectFielProvider')&&unique(root,'input#selectFieldModel')||loc.pathname.endsWith('/lexicons')&&unique(root,'input#field-generateEntries.MuiSwitch-input')||loc.pathname.endsWith('/nlu-connectors')&&unique(root,'[role="radiogroup"][aria-labelledby="tileSelectLabel"]')||['functions','playbooks'].includes(loc.pathname.split('/').pop())&&root.querySelectorAll('input,textarea,select').length===1||loc.pathname.endsWith('/snapshots')&&unique(root,'textarea#field-newDescription'))&&unique(e,':scope > input#field-newName.MuiInputBase-input, :scope > textarea#field-description.MuiInputBase-input, :scope > textarea#field-newDescription.MuiInputBase-input'));
        const autocompleteHover=(family==='admin'||family==='inspector'&&(loc.pathname.endsWith('/nlu/slots-filler')||loc.pathname.endsWith('/large-language-models'))&&root.id==='editSidebarWrapper'||family==='utility'&&(loc.pathname.endsWith('/settings/configuration')&&root.id==='flowSettingsTabContent'||loc.pathname.endsWith('/simulator/create')&&root.matches('[data-test="SimulationEditorHeader"]')&&unique(e,'input#selectFieldForGoal'))) &&e.matches('.MuiInputBase-root.MuiAutocomplete-inputRoot.c26-legacy-select-input-row')&&e.closest('[role="combobox"].MuiAutocomplete-root')&&unique(e,'input.MuiAutocomplete-input');
        if(surface(e,'field',[...LIGHT,TRANSPARENT,'rgb(245, 245, 246)',...(agentEditable||focusedAgent||focusedSlot||focusedHandover||focusedKnowledge||focusedScenario||autocompleteHover||goalStepField||trainerField?['rgb(236, 236, 237)']:[])])) {
          if(e.matches('.MuiInputBase-root'))text(e);
          all(e,':scope > .MuiOutlinedInput-notchedOutline').forEach(outline=>slot(outline,'field-outline'));
        } else rejected.add(family);
      });
      all(root,'.MuiAccordion-root').forEach(e=>{
        const lexiconGeneration=family==='inspector'&&loc.pathname.endsWith('/lexicons')&&root.id==='editSidebarWrapper'&&unique(e,'input#field-generateEntries.MuiSwitch-input[type="checkbox"]');
        if(!surface(e,'panel',[...LIGHT,...(lexiconGeneration?['rgb(250, 252, 255)']:[])]))rejected.add(family);
      });
      all(root,'.MuiInputBase-root[role="search"] > .MuiSvgIcon-root').forEach(e=>text(e,'icon'));
      // Native .42 placeholder alpha cannot reach 4.5:1 on a dark field, even
      // with white ink. This pseudo-element alone uses the opaque muted token.
      all(root,'input.MuiInputBase-input[placeholder]').forEach(e=>{
        if(paintValue(e,'opacity','::placeholder')==='0.42')slot(e,'placeholder');
        else if(!(['admin','insights','utility'].includes(family)&&paintValue(e,'opacity','::placeholder')==='0')) {
          // Chromium does not expose every placeholder transition as an
          // Animation. Keep this owner native, then allow one settled retry.
          rejected.add(family);
          const p=getComputedStyle(e,'::placeholder');
          if(p.transitionProperty.split(',').some(x=>['opacity','all'].includes(x.trim()))&&
            p.transitionDuration.split(',').every(x=>parseFloat(x)*(x.trim().endsWith('ms')?1:1000)<=200))retryFamilies.add(family);
        }
      });
      all(root,'.MuiTabs-indicator').forEach(e=>slot(e,'tab-indicator'));
      all(root,'.MuiTab-root').forEach(e=>slot(e,'tab'));
      // Keep switches/radio/slider native pending simultaneous-state acceptance.
      if(root.querySelector('.MuiSwitch-root,.MuiRadio-root,.MuiSlider-root'))partial=true;
    }
    function switches(root) {
          for(const toggle of all(root,'.MuiSwitch-root')) {
            const base=unique(toggle,'.MuiSwitch-switchBase');
            const thumb=unique(toggle,'.MuiSwitch-thumb');
            const track=unique(toggle,':scope > .MuiSwitch-track');
            const checkbox=unique(toggle,'input[type="checkbox"]');
            const checked=base?.classList.contains('Mui-checked');
            if(family==='utility'&&checkbox?.disabled&&base?.classList.contains('Mui-disabled')){partial=true;continue;}
            if(family==='inspector'&&loc.pathname.endsWith('/lexicons')&&checkbox?.id==='field-generateEntries'&&checkbox.disabled&&base?.classList.contains('Mui-disabled')){partial=true;continue;}
            if(family==='agents'&&/\/ai-agents\/edit\/[^/]+\/(?:persona|jobs(?:\/[^/]+)?)\/?$/.test(loc.pathname)&&checkbox?.id==='field-enableVoiceConfigs'&&checkbox.disabled&&base?.classList.contains('Mui-disabled')){partial=true;continue;}
            if(!base||!thumb||!track||!checkbox||checkbox.checked!==checked||!safe(checkbox)||
              paintValue(thumb,'backgroundColor')!==(checked?'rgb(11, 54, 148)':'rgb(250, 250, 250)')||
              paintValue(track,'backgroundColor')!==(checked?'rgb(11, 54, 148)':'rgb(0, 0, 0)')||
              paintValue(track,'opacity')!==(checked?'0.5':'0.38')) {rejected.add(family);continue;}
            slot(thumb,checked?'switch-on-thumb':'switch-off-thumb');
            slot(track,checked?'switch-on-track':'switch-off-track');
          }
    }
    function sliders(root,names,counts={}) {
      for(const slider of all(root,'.MuiSlider-root')) {
        const rail=unique(slider,':scope > .MuiSlider-rail'),track=unique(slider,':scope > .MuiSlider-track'),thumbs=Array.from(slider.querySelectorAll(':scope > .MuiSlider-thumb[role="slider"]'));
        const input=unique(slider,':scope > input[type="hidden"][name]');
        if(!rail||!track||!input||!names.includes(input.getAttribute('name'))||thumbs.length!==(counts[input.getAttribute('name')]||1)||
          [rail,track,...thumbs].some(e=>paintValue(e,'backgroundColor')!=='rgb(11, 54, 148)')||
          getComputedStyle(rail).opacity!=='0.38'||getComputedStyle(track).opacity!=='1'||thumbs.some(thumb=>getComputedStyle(thumb).opacity!=='1')) {rejected.add(family);continue;}
        slot(rail,'agent-slider-rail');slot(track,'agent-slider-track');
        for(const thumb of thumbs) {
        const halo=paintValue(thumb,'boxShadow');
        if(halo==='rgba(11, 54, 148, 0.16) 0px 0px 0px 8px')slot(thumb,'agent-slider-halo8');
        else if(halo==='rgba(11, 54, 148, 0.16) 0px 0px 0px 14px')slot(thumb,'agent-slider-halo14');
        else if(halo!=='none'){rejected.add(family);continue;}
        slot(thumb,'agent-slider-thumb');
        if(family==='settings') {
          const bubble=unique(thumb,':scope > .MuiSlider-valueLabel > span:only-child');
          const label=bubble&&unique(bubble,':scope > span:only-child');
          if(!bubble||!label||label.childElementCount||paintValue(bubble,'backgroundColor')!=='rgb(11, 54, 148)'||
            paintValue(label,'color')!=='rgb(255, 255, 255)'||getComputedStyle(label).backgroundColor!==TRANSPARENT||
            getComputedStyle(bubble).backgroundImage!=='none'||getComputedStyle(bubble).opacity!=='1')rejected.add(family);
          else slot(bubble,'slider-label');
        }
        }
      }
    }
    function autocomplete(form) {
      for(const combo of all(form,'[role="combobox"][aria-expanded="true"]')) {
          const input=unique(combo,'input[aria-controls]');
          const id=input?.getAttribute('aria-controls');
          const target=id&&!/\s/.test(id)&&combo.getAttribute('aria-owns')===id?unique(doc,'#'+CSS.escape(id)):null;
          // MUI omits the linked listbox entirely for this observed empty Goal chooser.
          const emptyGoal=family==='utility'&&loc.pathname.endsWith('/simulator/create')&&input?.id==='selectFieldForGoal'&&
            combo.matches('[data-test="SimulationGoalSelectInput"]')&&!target&&id&&combo.getAttribute('aria-owns')===id&&
            doc.querySelectorAll('[role="combobox"][aria-expanded="true"]').length===1;
          const emptyPaper=emptyGoal&&unique(doc,'.MuiAutocomplete-popper > .MuiPaper-root.MuiAutocomplete-paper');
          const emptyLabel=emptyPaper&&unique(emptyPaper,':scope > .MuiAutocomplete-noOptions:only-child:not(:has(*))');
          if(emptyLabel&&paintValue(emptyPaper,'boxShadow')==='rgba(0, 0, 0, 0.1) 0px 8px 8px -8px'&&
            surface(emptyPaper,'overlay',['rgb(245, 245, 246)'])) {
            plan(emptyPaper.parentElement,'data-cg-owner',family);boundaries.push([emptyPaper,family]);
            slot(emptyPaper,'agent-dropdown-shadow');text(emptyLabel);continue;
          }
          const paper=target?.parentElement;
          const trainerChoice=family==='utility'&&loc.pathname.endsWith('/trainer')&&combo.closest('[data-test="IntentTrainerHeader"]')&&input?.matches('#flowSelectId,#intentSelectId,#recordsSelectId,#foundIntentSelectId,#foundSlotSelectId,#intentScoreSelectId');
          if(!input||!safe(input)||!target?.matches('[role="listbox"]')||
            !paper?.matches('.MuiPaper-root.MuiAutocomplete-paper')||!paper.closest('.MuiAutocomplete-popper')||
            !['rgba(0, 0, 0, 0.1) 0px 8px 8px -8px',...(trainerChoice?['none']:[])].includes(paintValue(paper,'boxShadow'))||
            !surface(paper,'overlay',['rgb(245, 245, 246)'])) {rejected.add(family);continue;}
          plan(paper.closest('.MuiAutocomplete-popper'),'data-cg-owner',family);
          boundaries.push([paper,family]);slot(paper,'agent-dropdown-shadow');
          const options=Array.from(target.children);
          if(!options.length)rejected.add(family);
          for(const option of options) {
            const label=option.firstElementChild;
            // Project Settings model choices contain a provider icon and an
            // optional Global badge, unlike plain autocomplete text choices.
            const modelOption=family==='settings'&&input.id.startsWith('field-generativeAISettings.')&&label?.matches('div')&&
              label.children.length>=1&&label.children.length<=2&&label.firstElementChild.matches('.MuiListItemIcon-root')&&
              label.firstElementChild.children.length===1&&label.firstElementChild.firstElementChild.matches('img,svg.MuiSvgIcon-root')&&
              (label.children.length===1||label.lastElementChild.matches('span')&&label.lastElementChild.children.length===1&&
                label.lastElementChild.firstElementChild.matches('span')&&!label.lastElementChild.firstElementChild.children.length);
            if(!option.matches('li.MuiAutocomplete-option[role="option"]')||!safe(option)||
              !['true','false'].includes(option.getAttribute('aria-selected'))||
              ![null,'true','false'].includes(option.getAttribute('data-focus'))||
              option.childElementCount!==1||!label?.matches('div')||(label.childElementCount&&!modelOption)||!safe(label)||
              label.style.color!=='inherit'||paintValue(label,'color')!==paintValue(option,'color')||
              paintValue(label,'backgroundColor')!==TRANSPARENT||getComputedStyle(label).backgroundImage!=='none'||getComputedStyle(label).opacity!=='1'||
              !TEXT.includes(paintValue(option,'color'))||
              !surface(option,'agent-option',['rgb(245, 245, 246)','rgba(0, 0, 0, 0.04)'])) {rejected.add(family);continue;}
            text(option);slot(label,'agent-option-label');
            if(modelOption) {
              const icon=label.firstElementChild;
              text(icon,'icon');
              all(icon,'svg.MuiSvgIcon-root').forEach(svg=>{text(svg,'icon');mono(svg);});
              all(label,':scope > span,:scope > span > span').forEach(e=>text(e,'secondary'));
            }
          }
        }
    }
    // Admin Center and Insights have independent page identities. Their plans
    // never overlap the authoring banner/list families below.
    const adminRoute=/^\/admincenter\/(?:dashboard|users|user\/[^/]+|auditevents(?:\/[^/]+)?|resources\/global-(?:llms|connections|llm\/[^/]+|connection\/[^/]+)|opscenter\/(?:overview|voice-gateway|endpoints|flows|handover-provider)\/(?:metrics|alerts|errors)(?:\/[^/]+)?)\/?$/.test(loc.pathname);
    const insightsRoute=/^\/insights\/[^/]+\/(?:dashboard\/(?:overview|business|engagement|liveAgent|goals|nlu)|transcript-explorer(?:\/[^/]+)?|conversation-analyzer\/(?:configuration|analysis\/(?:intent-discovery|basic-analysis|custom-evaluation)))\/?$/.test(loc.pathname);
    const indexRoute=/^\/projects\/?$/.test(loc.pathname);
    const workspaceRoute=adminRoute||insightsRoute||indexRoute;
    function workspaceText(root) {
      componentText(root);
      const leaves='h1,h2,h3,h4,h5,h6,p,label,.sr-only,.MuiListSubheader-root,.MuiTab-wrapper > div,.MuiToggleButton-label,button:not(.MuiButtonBase-root),div[role="button"],[role="cell"], [role="cell"] > a,div:has(> [data-test-id="AgentBadgeDropdownButton"]) > div,.MuiTypography-root > span,.MuiFormHelperText-root > span,[data-test="EmptyResult"],.MuiListItemText-primary > div > span,.text-transition > div,legend > span,[data-test="InputLabel"] > label,[data-test="InputLabel"] > span,#insightsMainContent > div > div:has(> hr) span:not(svg *)';
      all(root,leaves).filter(e=>!e.closest('.MuiChip-root')).forEach(e=>text(e));
      all(root,'#insightsMainRegionHeading span,.MuiMenuItem-root,.MuiMenuItem-root > span:not(.MuiTouchRipple-root)').forEach(e=>text(e));
      all(root,'a[href*="#mainContent"],a[href*="#complementaryApplicationMenu"],a[href*="#insightsMainContent"]').forEach(e=>{if(paintValue(e,'color')==='rgb(0, 0, 238)')plan(e,'data-cg-text','accent');else text(e);});
      // These neutral inks are used by the separate Insights typography theme.
      all(root,leaves+',.MuiTypography-root,.MuiButton-label,.MuiFormLabel-root').filter(e=>!e.closest('.MuiChip-root')).forEach(e=>{
        if(paintValue(e,'color')==='rgb(48, 48, 48)')plan(e,'data-cg-text','text');
        if(['rgb(58, 57, 74)','rgb(104, 104, 104)','rgb(116, 116, 129)','rgb(177, 177, 177)','rgb(215, 215, 215)','rgba(0, 0, 0, 0.38)'].includes(paintValue(e,'color')))plan(e,'data-cg-text','secondary');
        if(e.matches('.Mui-error')&&paintValue(e,'color')==='rgb(244, 67, 54)')plan(e,'data-cg-text','error');
        if(e.matches('#insightsMainContent > div > div:has(> hr) span > span')&&paintValue(e,'color')==='rgb(204, 0, 0)')plan(e,'data-cg-text','error');
      });
      all(root,'.MuiFormLabel-root.error,.MuiFormLabel-root.error > span,.MuiFormHelperText-root.Mui-error').forEach(e=>{if(['rgb(204, 0, 0)','rgb(244, 67, 54)'].includes(paintValue(e,'color')))plan(e,'data-cg-text','error');});
      all(root,'.MuiTab-wrapper > div').forEach(e=>{if(paintValue(e,'color')==='rgb(249, 249, 254)')plan(e,'data-cg-text','text');});
      all(root,'.MuiSvgIcon-root:not(.recharts-surface *)').forEach(e=>{text(e,'icon');if(paintValue(e,'color')==='rgb(58, 57, 74)')plan(e,'data-cg-text','icon');monoPaths(e,[...TEXT,...SECONDARY,...LINK,'rgb(58, 57, 74)','none']);});
    }
    function workspaceComponents(root) {
      controls(root);workspaceText(root);switches(root);
      all(root,'nav .MuiTypography-root > div,div:has(> #insightsMainRegionHeading) > div,div:has(> div > #insightsMainRegionHeading) > div:not(:has(*))').forEach(e=>{
        if(!e.childElementCount&&paintValue(e,'backgroundColor')==='rgb(152, 71, 175)'&&paintValue(e,'color')==='rgb(255, 255, 255)'){
          slot(e,'native-semantic-surface');plan(e,'data-cg-text','on-button');
        } else if(paintValue(e,'backgroundColor')===TRANSPARENT)text(e);
      });
      all(root,'.MuiButton-root:not(.MuiButton-containedPrimary),button:not(.MuiButtonBase-root),div[role="button"]').forEach(e=>{
        const bg=paintValue(e,'backgroundColor');
        if([...LIGHT,'rgb(227, 233, 248)','rgb(245, 245, 246)'].includes(bg))surface(e,'secondary-button',[...LIGHT,'rgb(227, 233, 248)','rgb(245, 245, 246)']);
      });
      for(const paper of all(root,'.MuiPaper-root')) {
        if(paper.closest('.MuiAvatar-root'))continue;
        const bg=paintValue(paper,'backgroundColor');
        if([...LIGHT,TRANSPARENT,'rgb(245, 245, 246)'].includes(bg))surface(paper,paper.matches('.MuiDrawer-paper')?'shell':'panel',[...LIGHT,TRANSPARENT,'rgb(245, 245, 246)']);
        const shadow=paintValue(paper,'boxShadow');
        if(shadow==='rgba(0, 0, 0, 0.1) 0px 2px 20px 0px')slot(paper,'dashboard-shadow');
      }
      all(root,'.MuiCardContent-root,.MuiCardHeader-root').forEach(e=>{
        if(LIGHT.includes(paintValue(e,'backgroundColor')))surface(e,'panel');
      });
      all(root,'[role="rowgroup"] > [role="row"],[role="rowgroup"] > div > [role="row"],[role="row"] a.MuiListItem-button').forEach(e=>{
        if(surface(e,paintValue(e,'backgroundColor')==='rgb(236, 236, 237)'?'workspace-alt-row':'workspace-row',[...LIGHT,TRANSPARENT,'rgb(236, 236, 237)','rgba(61, 159, 255, 0.11)','rgba(0, 0, 0, 0.04)']))workspaceText(e);
      });
      all(root,'.MuiDivider-root,hr').forEach(e=>slot(e,'workspace-divider'));
      all(root,'.MuiToggleButton-root').forEach(e=>{
        const topicPicker=family==='insights'&&loc.pathname.endsWith('/conversation-analyzer/configuration')&&
          e.matches('button[type="button"]:not(.MuiToggleButtonGroup-grouped)[aria-pressed]')&&
          unique(e,':scope > .MuiToggleButton-label > span:only-of-type')&&
          unique(e.parentElement,':scope > .MuiPaper-root > ul[role="menu"]');
        if(surface(e,'workspace-toggle',[...LIGHT,TRANSPARENT,'rgb(180, 203, 251)','rgba(0, 0, 0, 0.05)','rgba(0, 0, 0, 0.12)',...(topicPicker?['rgb(227, 233, 248)']:[])]))workspaceText(e);
      });
      all(root,'.MuiTab-root').forEach(e=>{const bg=paintValue(e,'backgroundColor');if(bg==='rgb(234, 234, 234)')surface(e,'secondary-button',['rgb(234, 234, 234)']);else if(bg==='rgb(37, 37, 37)')slot(e,'workspace-selected');});
      all(root,'.MuiCheckbox-root,.MuiRadio-root').forEach(e=>{text(e,'icon');});
      // Disabled input boxes keep their behaviour, opacity and geometry, with
      // an explicit neutral paint exception for the observed MUI fields.
      for(const field of root.querySelectorAll('.MuiInputBase-root.Mui-disabled')) {
        const input=unique(field,':scope > input:disabled.MuiInputBase-input');
        if(!input||field.closest(PROTECTED)||getComputedStyle(field).backgroundImage!=='none'||input.style.getPropertyPriority('color')||input.style.getPropertyPriority('-webkit-text-fill-color')||getComputedStyle(input).backgroundImage!=='none'||paintValue(input,'backgroundColor')!==TRANSPARENT||
          ![...LIGHT,TRANSPARENT,'rgb(245, 245, 246)'].includes(paintValue(field,'backgroundColor')))continue;
        const neutral=[...TEXT,...SECONDARY,'rgba(0, 0, 0, 0.38)','rgba(0, 0, 0, 0.26)'];
        if(!neutral.includes(paintValue(input,'color')))continue;
        plan(field,'data-cg-slot','workspace-disabled-field');plan(input,'data-cg-text','secondary');
        for(const icon of field.querySelectorAll('.MuiSvgIcon-root'))if(neutral.includes(paintValue(icon,'color'))&&!icon.style.getPropertyPriority('color'))plan(icon,'data-cg-text','secondary');
      }
      for(const button of root.querySelectorAll('button.MuiButton-containedPrimary.Mui-disabled:disabled')) {
        const label=unique(button,':scope > .MuiButton-label');
        if(button.closest(PROTECTED)||!label||label.childElementCount||label.style.getPropertyPriority('color')||button.style.getPropertyPriority('color')||getComputedStyle(button).backgroundImage!=='none'||paintValue(label,'backgroundColor')!==TRANSPARENT||getComputedStyle(label).backgroundImage!=='none'||
          paintValue(button,'backgroundColor')!=='rgba(0, 0, 0, 0.12)'||paintValue(label,'color')!=='rgba(0, 0, 0, 0.26)')continue;
        plan(button,'data-cg-slot','disabled-action');plan(label,'data-cg-slot','disabled-action-label');
      }
      // Calendar axes are neutral; series colours and chart artwork remain native.
      all(root,'.recharts-cartesian-axis-tick-value,.recharts-cartesian-axis-tick-value > tspan').forEach(e=>{
        if(['rgb(102, 102, 102)','rgb(0, 0, 0)','rgb(37, 37, 37)'].includes(paintValue(e,'fill'))&&paintValue(e,'stroke')==='none')slot(e,'dashboard-tick');
      });
      all(root,'.recharts-cartesian-axis-line,.recharts-cartesian-axis-tick-line,.recharts-cartesian-grid line').forEach(e=>{
        if(['rgb(102, 102, 102)','rgb(204, 204, 204)','rgb(227, 233, 248)'].includes(paintValue(e,'stroke')))slot(e,'workspace-grid');
      });
    }
    function workspacePage(app) {
      family=adminRoute?'admin':insightsRoute?'insights':'project-index';
      if(!enabled(family))return;
      let heading,main,page;
      if(indexRoute) {
        heading=unique(app,'[data-test="AgentListHeader"] > h1#indexDashboardAgentListheader');main=unique(app,'#mainContent.contentAreaWithNews');
        const list=unique(app,'[role="navigation"][aria-labelledby="indexDashboardAgentListheader"]');
        if(!heading||!main||!list||!unique(app,'button[data-test="CreateAgentButton"]')){partial=true;return;}
        page=heading.parentElement;while(page&&page!==app&&!page.contains(main))page=page.parentElement;
        if(page?.parentElement!==app&&unique(page?.parentElement||app,':scope > [role="banner"]'))page=page.parentElement;
        if(!page||page===app){partial=true;return;}
      } else if(adminRoute) {
        const path=loc.pathname;
        const hook=path.includes('/opscenter/')?'#opsCenterHeader':path.includes('/user/')?'[data-test="UserHeader"] h1':path.includes('/auditevents/')?'[role="banner"] h1':'#adminCenterHeader';
        heading=unique(app,hook);
        main=path.includes('/opscenter/')?unique(app,'section[role="tabpanel"][id^="Routable-Tab-Panel-"]:not(section section)'):unique(app,'#mainContent,[role="main"]');
        const nav=unique(app,'nav[role="navigation"]');
        const section=path.includes('/opscenter/')?'opscenter':(path.includes('/user/')||/\/users\/?$/.test(path))?'users':path.includes('/resources/global-llm')?'resources/global-llms':path.includes('/resources/global-connection')?'resources/global-connections':path.includes('/auditevents')?'auditevents':'dashboard';
        const current=nav&&unique(nav,'a[aria-current="page"]');
        const resourceDetail=path.includes('/resources/global-llm/')&&unique(app,'#llmEditorId');
        const selectedSection=current?.getAttribute('href')?.endsWith('/admincenter/'+section)||(!current&&resourceDetail&&unique(nav,'a[href$="/admincenter/resources/global-llms"]'));
        const detailHook=section==='dashboard'?'#adminCenterDashboardHeader':section==='users'&&!path.includes('/user/')?'#userListHeader':section==='auditevents'&&!path.includes('/auditevents/')?'#auditEventsListHeader':null;
        // Resource lists mount their header and spinner before the main table.
        // Qualify this linked loading region instead of dropping the whole page.
        if(!main&&/^\/admincenter\/resources\/global-(llms|connections)\/?$/.test(path)) {
          const listHeading=unique(app,'h2#dataListHeader');
          const region=listHeading?.parentElement?.parentElement?.parentElement;
          const loader=region?.lastElementChild;
          if(region?.matches('div')&&region.childElementCount===2&&region.firstElementChild.contains(listHeading)&&
            loader?.matches('div')&&loader.childElementCount===1&&
            loader.firstElementChild.matches('.MuiCircularProgress-root[role="progressbar"]'))main=loader;
        }
        if(!heading||!main||!nav?.querySelector('a[href$="/admincenter/dashboard"]')||!selectedSection||(detailHook&&!unique(app,detailHook))){partial=true;return;}
        boundaries.push([nav,family]);plan(nav,'data-cg-owner',family);if(paintValue(nav,'backgroundColor')==='rgb(37, 37, 37)'&&getComputedStyle(nav).backgroundImage==='none')slot(nav,'native-semantic-surface');else if(!surface(nav,'shell')){rejected.add(family);return;}workspaceComponents(nav);
        all(nav,'.MuiListItem-button').forEach(e=>slot(e,'nav-item'));
        all(nav,'.MuiListItemIcon-root > svg:not(.MuiSvgIcon-root)').forEach(mono);
        all(nav,'#sidebarGroupAssetsList').forEach(e=>surface(e,'shell')); 
        page=heading.parentElement;
        while(page&&page!==app&&!page.contains(main))page=page.parentElement;
        if(!page||page===app||page.classList.contains('SIDEBAR_AREA')){rejected.add(family);return;}
      } else {
        heading=unique(app,'h1#insightsMainRegionHeading');main=unique(app,'main#insightsMainContent[aria-labelledby="insightsMainRegionHeading"]');
        const nav=unique(app,'nav[aria-label="Insights"]');
        const selected=nav&&unique(nav,'a[aria-current="page"]');
        const selectedPath=selected?.getAttribute('href')?.replace(/^.*?\/insights\/[^/]+/,'');
        const routePath=loc.pathname.replace(/^\/insights\/[^/]+/,'');
        const branch=p=>p?.startsWith('/conversation-analyzer/analysis/')?'/conversation-analyzer/analysis':p?.startsWith('/transcript-explorer/')?'/transcript-explorer':p?.replace(/\/$/,'');
        // Insights mounts its real heading/main and a skeleton sidebar before
        // the selected navigation link arrives. Recognize that bounded state.
        const loadingNav=!selected&&!nav?.querySelector('[data-test="SidebarItemDashboard-overview"]')&&
          !!nav?.closest('.MuiDrawer-paper')&&!!nav.querySelector(':scope > ul > li .MuiSkeleton-root')&&
          !!nav.querySelector('a[aria-label="Back to Overview Report"][href$="/dashboard/overview"]');
        // During route changes Cognigy retains this two-column shell while
        // unmounting both the page heading and main. Keep its verified canvas
        // and navigation painted rather than waiting for the new page body.
        const validNav=loadingNav||!!nav?.querySelector('[data-test="SidebarItemDashboard-overview"]')&&branch(selectedPath)===branch(routePath);
        if(!heading&&!main&&validNav) {
          const frame=nav.closest('.__insights'),drawer=nav.closest('.MuiDrawer-paper');
          const content=frame?.lastElementChild;
          if(frame?.childElementCount===2&&drawer?.parentElement===frame.firstElementChild&&
            frame.firstElementChild.matches('.MuiDrawer-root.MuiDrawer-docked')&&content?.matches('div')&&
            !content.querySelector('h1,main,[role="banner"]')) {
            boundaries.push([frame,family]);plan(frame,'data-cg-owner',family);
            if(!surface(frame,'canvas')||!surface(content,'canvas',[...LIGHT,TRANSPARENT])||!surface(drawer,'shell')||!surface(nav,'shell'))rejected.add(family);
            workspaceComponents(drawer);workspaceComponents(content);
            all(nav,'#insights-advanced-groupList').forEach(e=>surface(e,'shell'));
            all(nav,'.MuiListItem-button').forEach(e=>slot(e,'nav-item'));
            all(nav,'li > div[aria-hidden="true"]').forEach(e=>{if(paintValue(e,'borderTopColor')==='rgb(143, 143, 153)')slot(e,'workspace-divider');});
            all(content,':scope > div').forEach(e=>surface(e,'canvas',[...LIGHT,TRANSPARENT]));
            return;
          }
        }
        if(!heading||!main||(!loadingNav&&(!nav?.querySelector('[data-test="SidebarItemDashboard-overview"]')||branch(selectedPath)!==branch(routePath)))){partial=true;return;}
        page=main.parentElement;
        if(!page.contains(heading)||!unique(page,'[role="banner"]')){partial=true;return;}
        const drawer=nav.closest('.MuiDrawer-paper');
        if(drawer){boundaries.push([drawer,family]);plan(drawer,'data-cg-owner',family);if(!surface(drawer,'shell')||!surface(nav,'shell')){rejected.add(family);return;}workspaceComponents(drawer);
          all(nav,'#insights-advanced-groupList').forEach(e=>surface(e,'shell'));
          all(nav,'.MuiListItem-button').forEach(e=>slot(e,'nav-item'));
          all(nav,'li > div[aria-hidden="true"]').forEach(e=>{if(paintValue(e,'borderTopColor')==='rgb(143, 143, 153)')slot(e,'workspace-divider');});
        }
      }
      boundaries.push([page,family]);plan(page,'data-cg-owner',family);
      if(!surface(page,'canvas',[...LIGHT,TRANSPARENT])){rejected.add(family);return;}
      if(!surface(main,'canvas',[...LIGHT,TRANSPARENT])){rejected.add(family);return;}
      // Verified page-frame containers: no descendant-wide background rewrite.
      all(page,':scope > div,[role="banner"],[role="banner"] > div,[data-test="UserHeader"]').forEach(e=>{
        if([...LIGHT,'rgb(245, 245, 246)'].includes(paintValue(e,'backgroundColor')))surface(e,e.matches('[role="banner"], [role="banner"] > div,[data-test="UserHeader"]')?'shell':'canvas',[...LIGHT,'rgb(245, 245, 246)']);
      });
      if(adminRoute&&loc.pathname.includes('/resources/'))all(page,'div:has(> #dataListHeader),div:has(> div > #dataListHeader),div:has(> #llmEditorId),div:has(> div > #llmEditorId),div:has(> div > div > #llmEditorId)').forEach(e=>{
        if(LIGHT.includes(paintValue(e,'backgroundColor')))surface(e,'shell');
      });
      workspaceComponents(page);
      if(adminRoute)autocomplete(page);
      if(adminRoute&&(loc.pathname.includes('/user/')||loc.pathname.includes('/resources/global-llm/'))) {
        for(const badge of all(main,'div[role="button"].disabled')) {
          if(!badge.childElementCount&&unique(badge.parentElement,'button[aria-label="Assign new role"]')&&
            paintValue(badge,'backgroundColor')==='rgb(245, 245, 246)'&&paintValue(badge,'color')==='rgba(0, 0, 0, 0.58)'&&
            !badge.style.getPropertyPriority('color'))plan(badge,'data-cg-text','secondary');
        }
        const compact=unique(app,'aside[aria-labelledby="compactListHeader"]');
        if(compact&&unique(compact,'#compactListHeader')&&unique(compact,loc.pathname.includes('/user/')?'button[aria-label="List of Users"]':'button[aria-label="List of Global LLMs"]')) {
          boundaries.push([compact,family]);plan(compact,'data-cg-owner',family);workspaceComponents(compact);
          all(compact,loc.pathname.includes('/user/')?'a.MuiListItem-button[role="link"][href^="/admincenter/user/"]':'a.MuiListItem-button[role="link"][href^="/admincenter/resources/global-llm/"]').forEach(e=>{
            const bg=paintValue(e,'backgroundColor');
            if(surface(e,'workspace-row',[TRANSPARENT,'rgb(227, 233, 248)','rgba(0, 0, 0, 0.04)'])&&bg==='rgb(227, 233, 248)')slot(e,'workspace-selected');
          });
          all(compact,'.MuiListItemText-primary div:not(:has(*))').forEach(e=>text(e));
          for(const e of [compact,...all(compact,':scope > div,:scope > div > div')])if([...LIGHT,TRANSPARENT].includes(paintValue(e,'backgroundColor')))surface(e,'shell',[...LIGHT,TRANSPARENT]);
        }
      }
      if(indexRoute) {
        all(page,'div:has(> #mainContent.contentAreaWithNews),div:has(> [role="navigation"][aria-labelledby="indexDashboardAgentListheader"]),[data-test^="AgentListItem-"][role="listitem"] > div,#mainContent > div,#mainContent > div > div').forEach(e=>{if(LIGHT.includes(paintValue(e,'backgroundColor')))surface(e,'panel');});
        all(page,'#mainContent a').forEach(e=>text(e));
        // The captured news/help cards paint a pale backing while their CSS
        // image downloads. Own only that backing; image bytes and geometry stay native.
        all(main,'a.MuiLink-root > span.sr-only + div[style]').forEach(e=>{
          if(e.childElementCount||!e.nextElementSibling?.matches('div')||
            !e.nextElementSibling.querySelector(':scope > p.MuiTypography-root')||
            !e.style.backgroundImage||!getComputedStyle(e).backgroundImage.startsWith('url(')||
            e.style.getPropertyPriority('background-color')||
            paintValue(e,'backgroundColor')!=='rgb(249, 249, 254)')return;
          slot(e,'media-backing');
        });
      }
      all(page,'div:has(> [data-test-id="AgentBadgeDropdownButton"])').forEach(e=>surface(e,'panel'));
      all(page,'#FiltersPanelFilterToggleButton').forEach(e=>{if(paintValue(e,'backgroundColor')==='rgb(255, 255, 255)')surface(e,'secondary-button');});
      if(adminRoute&&/^\/admincenter\/opscenter\/overview\/metrics\/?$/.test(loc.pathname)) {
        // Neutral backing behind the native two-chevron card connectors.
        all(page,'#Routable-Tab-Panel-metrics div > svg.MuiSvgIcon-root[viewBox="0 0 32 32"][aria-hidden="true"]').forEach(svg=>{
          const backing=svg.parentElement,paths=Array.from(svg.children);
          if(backing.childElementCount===1&&paths.length===2&&
            paths.every((p,i)=>p.matches('path')&&p.getAttribute('d')===(i?'M16 16L0 32V0L16 16Z':'M32 16L16 32V0L32 16Z')&&paintValue(p,'fill')==='rgb(227, 233, 248)')&&
            backing.parentElement.querySelector('a[href*="/admincenter/opscenter/"]'))surface(backing,'canvas',['rgb(255, 255, 255)']);
        });
      }
      if(adminRoute&&loc.pathname.includes('/opscenter/')) {
        all(page,'section[role="tabpanel"],section[role="tabpanel"] > div,section[role="tabpanel"] header,.MuiGrid-item > article,.MuiGrid-item > div > div:has(> h2),div:has(> a[href*="/opscenter/"] > p.MuiTypography-root),a[href*="/opscenter/"] > div:has(> p.MuiTypography-root)').forEach(e=>{
          if([...LIGHT,TRANSPARENT].includes(paintValue(e,'backgroundColor')))surface(e,e.matches('article,div:has(> h2),div:has(> a)')?'panel':'canvas',[...LIGHT,TRANSPARENT]);
        });
      }
      if(insightsRoute) {
        if(loc.pathname.endsWith('/conversation-analyzer/configuration'))for(const toggle of main.querySelectorAll('button.MuiToggleButton-root.Mui-disabled:disabled:not(.MuiToggleButtonGroup-grouped)[aria-pressed="false"]')) {
          const label=unique(toggle,':scope > .MuiToggleButton-label'),leaf=label&&unique(label,':scope > span'),icon=label&&unique(label,':scope > svg.MuiSvgIcon-root');
          const paper=unique(toggle.parentElement,':scope > .MuiPaper-root');
          if(toggle.closest(PROTECTED)||!label||!leaf||leaf.childElementCount||!icon||label.childElementCount!==2||!paper||
            !unique(paper,'ul[role="menu"]')||!unique(paper,'.MuiInputBase-root > input.MuiInputBase-input[placeholder]')||
            paintValue(toggle,'backgroundColor')!=='rgb(245, 246, 253)'||getComputedStyle(toggle).backgroundImage!=='none'||
            [toggle,label,leaf,icon].some(e=>paintValue(e,'color')!=='rgb(177, 177, 177)'||e.style.getPropertyPriority('color'))||
            [label,leaf,icon].some(e=>paintValue(e,'backgroundColor')!==TRANSPARENT||getComputedStyle(e).backgroundImage!=='none'))continue;
          // Loading must remain disabled; only the observed neutral paint is owned.
          plan(toggle,'data-cg-slot','workspace-disabled-field');
          for(const e of [label,leaf,icon])plan(e,'data-cg-text','secondary');
        }
        // Analysis mounts a selected Tailwind blue tab before its asynchronous
        // empty result disables the tabs. It is an accent, not unknown ink.
        if(loc.pathname.includes('/conversation-analyzer/analysis/'))all(page,'button.MuiTab-root.MuiTab-textColorPrimary[role="tab"] > .MuiTab-wrapper').forEach(e=>{
          const tab=e.parentElement;
          if(tab.getAttribute('aria-selected')==='true'&&tab.classList.contains('!text-blue-800')&&paintValue(e,'color')==='oklch(0.424 0.199 265.638)')plan(e,'data-cg-text','accent');
          if(tab.getAttribute('aria-selected')==='false'&&tab.classList.contains('!text-gray-600')&&paintValue(e,'color')==='oklch(0.446 0.03 256.802)')plan(e,'data-cg-text','secondary');
        });
        // Before the agent badge resolves, its name occupies a plain span.
        all(page,'div:has(> button[data-test-id="AgentBadgeDropdownButton"][aria-label="Switch Agent"]) > span').forEach(e=>{
          if(!e.childElementCount&&paintValue(e,'color')==='rgb(58, 57, 74)'&&paintValue(e,'backgroundColor')===TRANSPARENT&&getComputedStyle(e).backgroundImage==='none')plan(e,'data-cg-text','text');
        });
        if(loc.pathname.endsWith('/conversation-analyzer/configuration'))all(main,':scope > div > div:has(> button[type="button"]):has(> button:not([type]))').forEach(e=>surface(e,'panel'));
        all(page,'[data-test="InputLabel"],[data-test="GlobalFilter-timeframe-root"] > button,[data-test="GlobalFilter-timeframe-panel"],main > div > div:has(> hr),main > div > div:has(> div > [role="table"])').forEach(e=>{
          if([...LIGHT,TRANSPARENT,'rgb(245, 245, 246)'].includes(paintValue(e,'backgroundColor')))surface(e,e.matches('button')?'field':'panel',[...LIGHT,TRANSPARENT,'rgb(245, 245, 246)']);
        });
        all(page,'#insightsMainContent > div > div:has(> hr) span:not(svg *)').forEach(e=>{
          if(LIGHT.includes(paintValue(e,'backgroundColor')))surface(e,'node');
        });
      }
      if(adminRoute&&/\/users\/?$/.test(loc.pathname)) {
        const sidebar=unique(app,'#editSidebarWrapper[role="region"][aria-labelledby="editSidebarTitle"][data-test="EditSidebar"]');
        if(sidebar&&unique(sidebar,'h1#editSidebarTitle')&&unique(sidebar,'input#field-newName[type="text"]')) {
          boundaries.push([sidebar,family]);plan(sidebar,'data-cg-owner',family);
          if(!surface(sidebar,'overlay'))rejected.add(family);else workspaceComponents(sidebar);
        }
      }
      if(adminRoute) {
        const llmForm=unique(main,'form[aria-labelledby="llmEditorId"]');
        const llmSave=llmForm&&unique(llmForm,'button[type="submit"][data-test="globalLLMFormSubmit"]');
        if(llmSave?.parentElement.matches('div')&&llmSave.parentElement.childElementCount===1)
          surface(llmSave.parentElement,'panel');
        // Assigned-project chips are neutral labels, not status badges.
        for(const chip of all(main,'[role="table"] .MuiChip-root[datatest="projectChip"],form[aria-labelledby="llmEditorId"] .MuiChip-root.MuiChip-deletable[datatest="projectChip"][role="button"]')) {
          const label=unique(chip,':scope > span.MuiChip-label');
          const remove=unique(chip,':scope > svg.MuiChip-deleteIcon');
          if(!label||chip.childElementCount!==(remove?2:1)||label.childElementCount||(remove&&(remove.style.getPropertyPriority('color')||paintValue(remove,'color')!=='rgb(104, 104, 104)'))||
            [chip,label].some(e=>e.style.getPropertyPriority('color')||e.style.getPropertyPriority('background-color')||getComputedStyle(e).backgroundImage!=='none'||paintValue(e,'color')!=='rgb(104, 104, 104)')||
            paintValue(label,'backgroundColor')!==TRANSPARENT)continue;
          if(surface(chip,'secondary-button',['rgb(215, 215, 215)'])) {
            plan(chip,'data-cg-text','secondary');plan(label,'data-cg-text','secondary');if(remove)plan(remove,'data-cg-text','secondary');
          }
        }
        for(const button of main.querySelectorAll('[role="columnheader"] > button.MuiButton-textPrimary.Mui-disabled:disabled')) {
          const label=unique(button,':scope > span.MuiButton-label');
          if(!label||label.childElementCount||button.closest(PROTECTED)||
            [button,label].some(e=>e.style.getPropertyPriority('color')||getComputedStyle(e).backgroundImage!=='none'||paintValue(e,'backgroundColor')!==TRANSPARENT||paintValue(e,'color')!=='rgb(11, 54, 148)'))continue;
          plan(button,'data-cg-text','secondary');plan(label,'data-cg-text','secondary');
        }
      }
      if(adminRoute&&loc.pathname.includes('/auditevents')) {
        for(const portal of all(doc,'.MuiTooltip-popper[role="tooltip"]')) {
          const triggers=[...main.querySelectorAll('[role="row"] a[role="link"] > div[aria-describedby]')].filter(e=>portal.id&&(e.getAttribute('aria-describedby')||'').split(/\s+/).includes(portal.id));
          const paper=unique(portal,':scope > .MuiTooltip-tooltip.MuiTooltip-tooltipArrow');
          const body=paper&&unique(paper,':scope > div');
          const arrow=paper&&unique(paper,':scope > span.MuiTooltip-arrow');
          const labels=body?[...body.children]:[];
          const previous=auditTooltipLinks.get(portal);
          // MUI unlinks before applying its exit styles; retain this exact known portal until unmount.
          const exiting=triggers.length===0&&previous?.main===main&&previous.path===loc.pathname&&previous.paper===paper&&main.contains(previous.trigger);
          if((triggers.length!==1&&!exiting)||!paper||paper.childElementCount!==2||!body||!arrow||labels.length!==2||
            labels.some(e=>!e.matches('p.MuiTypography-root')||e.childElementCount||paintValue(e,'color')!=='rgb(58, 57, 74)'||paintValue(e,'backgroundColor')!==TRANSPARENT||getComputedStyle(e).backgroundImage!=='none'||e.style.getPropertyPriority('color'))||
            paintValue(body,'backgroundColor')!==TRANSPARENT||getComputedStyle(body).backgroundImage!=='none'||
            paintValue(paper,'backgroundColor')!=='rgb(255, 255, 255)'||getComputedStyle(paper).backgroundImage!=='none'||paper.style.getPropertyPriority('background-color')||
            paintValue(arrow,'color')!=='rgb(255, 255, 255)'||paintValue(arrow,'backgroundColor','::before')!=='rgb(255, 255, 255)')continue;
          plan(portal,'data-cg-owner',family);surface(paper,'overlay');
          labels.forEach(e=>plan(e,'data-cg-text','text'));slot(arrow,'workspace-tooltip-arrow');
          if(triggers.length===1)pendingAuditTooltipLinks.push([portal,{main,path:loc.pathname,paper,trigger:triggers[0]}]);
        }
      }
      if(adminRoute&&loc.pathname.includes('/auditevents/'))all(page,'main > div > div:has(#AuditEventViewerDropdownBtn)').forEach(viewer=>{
        surface(viewer,'panel');
        // Monaco's React wrapper briefly renders a plain loading leaf before
        // mounting the protected editor. Qualify that observed leaf, without
        // reading its text or allowing arbitrary descendants through the guard.
        if(!unique(viewer,'button[aria-label="Close audit event viewer"]'))return;
        // The editor host is a sibling while Monaco is loading. Only the
        // single leaf matching the observed loading layout owns this text slot.
        const loaders=[...viewer.querySelectorAll(':scope > div > div > section > div')].filter(loader=>
          !loader.childElementCount&&loader.style.display==='flex'&&
          loader.style.height==='100%'&&loader.style.width==='100%'&&
          loader.style.justifyContent==='center'&&loader.style.alignItems==='center'&&
          paintValue(loader,'backgroundColor')===TRANSPARENT&&getComputedStyle(loader).backgroundImage==='none');
        if(loaders.length===1)text(loaders[0]);
      });
      if(adminRoute&&/\/resources\/global-connections\/?$/.test(loc.pathname)) {
        const dialog=unique(doc,'.MuiDialog-paper[role="dialog"][aria-labelledby="connectionEditorDialogTitle"]');
        if(dialog&&unique(dialog,'h1#connectionEditorDialogTitle')&&unique(dialog,'form')) {
          boundaries.push([dialog,family]);plan(dialog.closest('.MuiDialog-root'),'data-cg-owner',family);
          if(!surface(dialog,'overlay'))rejected.add(family);else workspaceComponents(dialog);
        }
      }
      if(adminRoute&&loc.pathname.includes('/opscenter/')) {
        const dialog=unique(doc,'.MuiDialog-paper[role="dialog"]');
        if(dialog&&unique(dialog,'button[aria-label="Close ops center activation dialog"]')&&unique(dialog,'img[alt="AI Ops Center Preview"]')&&unique(dialog,'.MuiDialogTitle-root h2')) {
          boundaries.push([dialog,family]);plan(dialog.closest('.MuiDialog-root'),'data-cg-owner',family);
          if(!surface(dialog,'overlay'))rejected.add(family);else {workspaceComponents(dialog);all(dialog,'.MuiDialogContent-root .MuiTypography-root > strong').forEach(e=>text(e));}
        }
      }
      // Menus expose a reverse aria-labelledby relationship to their unique
      // button. Do not adopt an unlinked third-party popover on the same page.
      for(const paper of all(doc,'.MuiPopover-paper')) {
        const menu=unique(paper,'[role="menu"][aria-labelledby]');
        const triggerId=menu?.getAttribute('aria-labelledby');
        const trigger=triggerId&&!/\s/.test(triggerId)?unique(page,'#'+CSS.escape(triggerId)):null;
        const linked=trigger?.matches('[aria-haspopup="true"],[aria-haspopup="menu"]')&&menu.id==='menuForButton-'+triggerId;
        const timeframe=insightsRoute&&unique(page,'[data-test="GlobalFilter-timeframe-panel"]');
        const picker=unique(doc,'.MuiPopover-paper .MuiPickersBasePicker-container');
        const calendar=timeframe&&getComputedStyle(timeframe).display!=='none'&&getComputedStyle(timeframe).visibility==='visible'&&timeframe.getBoundingClientRect().height>0&&
          unique(timeframe,'[data-test="GlobalFilter-timeframe-customPeriod"] input[type="radio"]:checked')&&timeframe.querySelectorAll('input[readonly].MuiInputBase-input').length===2&&
          picker?.parentElement===paper&&unique(picker,'.MuiPickersDatePickerRoot-toolbar')&&unique(picker,'.MuiPickersCalendarHeader-daysHeader');
        // Insights' More Filters card has no aria-controls link. Its two
        // observed filter families and the page's primary filters identify it;
        // do not adopt arbitrary MUI popovers by heading or generated class.
        const moreFilters=insightsRoute&&!!timeframe&&
          !!unique(page,'[data-test="GlobalFilter-snapshot-toggle"]')&&
          !!unique(paper,':scope > .MuiCard-root > div > h2.MuiTypography-root')&&
          ['locales','rating'].every(key=>{
            const root=unique(paper,':scope > .MuiCard-root > div > [data-test="InputLabel"] > [data-test="GlobalFilter-'+key+'-root"]');
            return root&&unique(root,':scope > button[data-test="GlobalFilter-'+key+'-toggle"]')&&
              unique(root,':scope > .MuiPaper-root[data-test="GlobalFilter-'+key+'-panel"]');
          });
        if(!linked&&!calendar&&!moreFilters)continue;
        const portal=paper.closest('.MuiPopover-root');
        if(!portal){rejected.add(family);continue;}
        boundaries.push([paper,family]);plan(portal,'data-cg-owner',family);
        if(!surface(paper,'overlay')){rejected.add(family);continue;}
        workspaceComponents(paper);
        if(moreFilters)for(const key of ['locales','rating']) {
          const toggle=unique(paper,'[data-test="GlobalFilter-'+key+'-root"] > button.MuiToggleButton-root:is([aria-pressed="true"],[aria-pressed="false"])[data-test="GlobalFilter-'+key+'-toggle"]');
          // The same native fill is used while hovered but not selected,
          // including the closing transition before the pointer leaves.
          if(toggle)surface(toggle,'workspace-toggle',[...LIGHT,'rgb(227, 233, 248)']);
        }
        all(paper,'.MuiMenuItem-root').forEach(e=>slot(e,'menu-item'));
        if(calendar) {
          all(paper,'button.MuiPickersCalendarHeader-iconButton:not(:disabled):not(.Mui-disabled)').forEach(e=>surface(e,'secondary-button'));
          all(paper,'.MuiPickersToolbar-toolbar').forEach(e=>{if(LINK.includes(paintValue(e,'backgroundColor')))slot(e,'workspace-selected');});
          all(paper,'.MuiPickersToolbarText-toolbarTxt').forEach(e=>{
            if(['rgba(255, 255, 255, 0.54)','rgb(255, 255, 255)'].includes(paintValue(e,'color')))plan(e,'data-cg-text',e.classList.contains('MuiPickersToolbarText-toolbarBtnSelected')?'text':'secondary');
          });
          all(paper,'.MuiPickersDay-daySelected').forEach(e=>{const label=unique(e,'.MuiTypography-root');if(label&&LINK.includes(paintValue(e,'backgroundColor'))&&['rgb(255, 255, 255)',...TEXT].includes(paintValue(label,'color'))){slot(e,'calendar-selected-day');plan(label,'data-cg-text','on-selected');}});
        }
      }
    }
    if(loc.origin==='https://trial.cognigy.ai') {
      const app=unique(doc,'#app-container');
      if(!app) return {applied:false,partial:true};
      const route=/^\/project\/[^/]+\/[^/]+(?:\/(flow\/[^/]+\/(chart|nlu|settings)(?:\/[^/]+)?|flows|ai-agents(?:\/edit\/[^/]+\/(?:jobs(?:\/[^/]+)?|persona)|\/[^/]+(?:\/[^/]+)?)?|knowledge(?:\/[^/]+(?:\/[^/]+)?)?|endpoints|endpoint\/[^/]+|snapshots|large-language-models|playbooks|settings|lexicons|goals|goal\/new|connections|nlu-connectors|functions|handover-providers|locales|tokens|members|contacts|simulator(?:\/(?:overview|scenarios|runner|create))?|logs|trainer|extensions|packaging))?\/?$/.test(loc.pathname);
      if(!route&&!workspaceRoute) return {applied:false,partial:true};
      if(workspaceRoute)workspacePage(app);
      // Account navigation is rendered outside the workspace page. Own only
      // the exact reverse-linked global menu, on already recognized app routes.
      family='global';
      if(enabled(family)) {
        const bar=unique(doc,'#complementaryApplicationMenu[role="menubar"]');
        const trigger=bar&&unique(bar,'button#globalmenu_user[role="menuitem"][aria-haspopup="true"]');
        const menu=trigger&&unique(doc,'.MuiPopover-paper > #menuForButton-globalmenu_user[role="menu"][aria-labelledby="globalmenu_user"]');
        const paper=menu?.parentElement,portal=paper?.closest('.MuiPopover-root');
        if(portal) {
          boundaries.push([paper,family]);plan(portal,'data-cg-owner',family);
          if(!surface(paper,'overlay'))rejected.add(family);
          workspaceComponents(paper);
          all(menu,':scope > .MuiMenuItem-root[role="menuitem"]').forEach(e=>{text(e);slot(e,'menu-item');});
          const logout=unique(menu,'[data-test="LogoutButton"] > .MuiListItemText-root > .MuiTypography-root > div');
          const version=logout&&unique(logout,':scope > p[aria-label]');
          if(logout?.childElementCount===1&&version&&!version.childElementCount) {text(logout);text(version,'secondary');}
          if(paintValue(paper,'boxShadow')==='rgba(0, 0, 0, 0.1) 0px 2px 10px 0px')slot(paper,'popover-shadow');
        }
      }
      // Native confirmation portal: identify its stable title/body hooks and
      // three-button structure; preserve the semantic warning badge/border.
      if(enabled('global')) {
        family='global';
        const dialog=unique(doc,'.MuiDialog-paper.c26PaperOptOut[role="dialog"]:has(#hiddenDialogTitle):has(p#dialogText)');
        const panel=dialog&&unique(dialog,':scope > div:only-child');
        const actions=panel&&unique(panel,'div:has(> button[type="button"]):has(> button:not([type]))');
        const close=panel&&unique(panel,'button.MuiIconButton-root:has(.sr-only):has(svg.MuiSvgIcon-root)');
        if(panel&&actions&&actions.children.length===2&&close&&panel.querySelectorAll('button').length===3) {
          boundaries.push([panel,family]);plan(dialog.closest('.MuiDialog-root'),'data-cg-owner',family);
          if(!surface(panel,'overlay'))rejected.add(family);
          controls(panel);
          all(panel,'#hiddenDialogTitle,#dialogText,.sr-only').forEach(e=>text(e));
          all(actions,':scope > button').forEach(e=>{
            if(LINK.includes(paintValue(e,'backgroundColor')))slot(e,'primary');
            else if(!surface(e,'secondary-button',[...LIGHT,TRANSPARENT,'rgb(227, 233, 248)','rgba(11, 54, 148, 0.04)']))rejected.add(family);
            if(paintValue(e,'color')==='rgb(6, 28, 76)')plan(e,'data-cg-text','accent');else text(e);
          });
        }
      }
      if(!workspaceRoute) {
      const nav=unique(app,'.SIDEBAR_WRAPPER nav');
      family='shell';
      if(enabled(family)&&nav && nav.querySelector('#sidebarGroupBuildList') && surface(nav,'shell')) {
        boundaries.push([nav,family]);
        controls(nav);applied++;
        all(nav,'.MuiListItem-button').forEach(e=>slot(e,'nav-item'));
        all(nav,'.MuiListItemIcon-root > svg:not(.MuiSvgIcon-root)').forEach(mono);
        if(getComputedStyle(nav.parentElement).borderRightColor==='rgb(227, 233, 248)')slot(nav.parentElement,'rail-boundary');
        all(nav,'li:has(> .MuiCollapse-root > .MuiCollapse-wrapper > .MuiCollapse-wrapperInner > ul[id^="sidebarGroup"])').forEach(e=>surface(e,'shell',['rgb(227, 233, 248)',TRANSPARENT]));
      }
      const banner=unique(app,'[role="banner"]');
      const list=unique(app,'main#mainContent:has([role="table"]),div#mainContent:has([role="table"])');
      const table=list?unique(list,'[role="table"]'):null;
      // Heading IDs and table labels differ on several native Cognigy pages.
      // Keep both identities explicit instead of treating every table as a list.
      const resourceMap={
        endpoints:['AgentEndpointsHeader','endpointListHeader'],snapshots:['AgentSnapshotsHeader','snapshotListHeader'],
        playbooks:['AgentPlaybooksHeader','playbookListHeader'],flows:['AgentFlowsHeader','flowListHeader'],
        knowledge:['AgentKnowledgeStoresHeader','knowledgeStoresListHeader','functionListHeader'],
        'large-language-models':['AgentLargeLanguageModelsHeader','largeLanguageModelListHeader','largeLanguageModelsListHeader'],
        lexicons:['AgentLexiconsHeader','lexiconListHeader'],goals:['AgentGoalsHeader','goalListHeader','goalsListHeader'],
        connections:['AgentConnectionsHeader','connectionListHeader'],'nlu-connectors':['AgentNLUConnectorsHeader','nluConnectorListHeader'],
        functions:['AgentFunctionsHeader','functionListHeader'],'handover-providers':['AgentHandoverProvidersHeader','handoverProviderListHeader'],
        locales:['LocalizationHeader','localeListHeader'],tokens:['AgentTokensHeader','tokenListHeader'],
        members:['AgentMembersHeader','memberListHeader'],contacts:['ContactProfilesHeader','genericHeaderId']
      };
      const resource=/^\/project\/[^/]+\/[^/]+\/([^/]+)\/?$/.exec(loc.pathname)?.[1];
      const resourceHooks=resourceMap[resource];
      const resourceMatch=!!resourceHooks&&banner?.getAttribute('data-test')===resourceHooks[0]&&
        !!unique(banner,'h1#'+resourceHooks[1])&&table?.getAttribute('aria-labelledby')===(resourceHooks[2]||resourceHooks[1]);
      const listPage=!!resource && table && table.querySelectorAll('[role="rowgroup"]').length===2&&resourceMatch;
      const knowledgeWizardMain=resource==='knowledge'&&banner?.getAttribute('data-test')==='AgentKnowledgeStoresHeader'&&unique(banner,'h1#knowledgeStoresListHeader')&&unique(app,'main#mainContent:has(.MuiStepper-root):has(input#field-name):has(input[type="radio"])');
      const knowledgeWizard=!!knowledgeWizardMain&&knowledgeWizardMain.querySelectorAll('.MuiStep-root').length===4&&knowledgeWizardMain.querySelectorAll('form').length===2;
      // Knowledge mounts a spinner-only main before choosing list or onboarding.
      // Match its actual bounded structure, never a generic application spinner.
      const knowledgeLoadingMain=resource==='knowledge'&&banner?.getAttribute('data-test')==='AgentKnowledgeStoresHeader'&&unique(banner,'h1#knowledgeStoresListHeader')&&unique(app,'main#mainContent');
      const knowledgeLoader=knowledgeLoadingMain?.firstElementChild;
      const knowledgeLoading=!!knowledgeLoadingMain&&knowledgeLoadingMain.childElementCount===1&&knowledgeLoader?.matches('div')&&knowledgeLoader.childElementCount===1&&knowledgeLoader.firstElementChild.matches('.MuiCircularProgress-root[role="progressbar"]')&&!knowledgeLoadingMain.querySelector('input,button,form,[role="table"]');
      const flowRoute=/^\/project\/[^/]+\/[^/]+\/flow\/[^/]+\/(chart|nlu|settings)(?:\/[^/]+)?\/?$/.exec(loc.pathname)?.[1];
      const gallery=unique(app,'main#mainContent[data-test="aiAgentMainContent"]:has([data-pa-id="agents-grid"])');
      // The named gallery header mounts before its grid and title finish loading.
      // Its own native paint/text guards do not depend on those sibling contents.
      const galleryHeader=resource==='ai-agents'&&banner?.getAttribute('data-test')==='AIAgentListHeader';
      family='banner';
      if(enabled(family)&&banner && ((flowRoute&&banner.querySelector('#flowChartEditorTabItem'))||listPage||gallery||galleryHeader||knowledgeWizard||knowledgeLoading) && surface(banner,'shell',resource==='contacts'?[...LIGHT,TRANSPARENT]:LIGHT)) {
        boundaries.push([banner,family]);
        controls(banner);workspaceText(banner);if(resource==='contacts')workspaceComponents(banner);applied++;
        // List-page banner keeps its native inner project-picker strip.
        if(listPage||gallery||galleryHeader||knowledgeWizard||knowledgeLoading)all(banner,':scope > div:has([data-test-id="AgentBadgeDropdownButton"])').forEach(e=>surface(e,'shell'));
        // Before the project resolves, the native picker strip is empty white.
        if(listPage||knowledgeLoading||galleryHeader) {
          const pendingPicker=banner.firstElementChild;
          if(pendingPicker?.matches('div:empty'))surface(pendingPicker,'shell');
        }
        all(banner,'[role="button"] .MuiSvgIcon-root').forEach(mono);
        const picker=banner.querySelector('[data-test-id="AgentBadgeDropdownButton"]');
        if(picker && surface(picker.parentElement,'panel')) {
          text(picker.parentElement);
          all(picker,'.MuiSvgIcon-root').forEach(e=>text(e,'icon'));
        }
        if(resource==='flows'||resource==='large-language-models')for(const button of banner.querySelectorAll('button[data-test="manage-llm-settings-button"].MuiButton-outlinedPrimary.Mui-disabled:disabled')) {
          const label=unique(button,':scope > .MuiButton-label');
          const icon=label&&unique(label,':scope > .MuiButton-startIcon > .MuiSvgIcon-root');
          if(label&&icon&&button.childElementCount===1&&label.childElementCount===1&&paintValue(button,'backgroundColor')==='rgb(255, 255, 255)'&&getComputedStyle(button).backgroundImage==='none'&&[button,label,icon].every(e=>paintValue(e,'color')==='rgba(0, 0, 0, 0.26)'&&!e.style.getPropertyPriority('color'))) {
            plan(button,'data-cg-slot','disabled-action');plan(label,'data-cg-slot','disabled-action-label');plan(icon,'data-cg-text','muted');
          }
        }
        if(resource==='snapshots')for(const button of banner.querySelectorAll('button.MuiButton-containedPrimary')) {
          if(button.classList.contains('Mui-disabled')!==button.disabled){rejected.add(family);continue;}
          if(!button.disabled)continue;
          const label=unique(button,':scope > span.MuiButton-label');
          const svg=label&&unique(label,':scope > span.MuiButton-startIcon > svg.MuiSvgIcon-root');
          const paths=svg?Array.from(svg.querySelectorAll('path')):[];
          if(button.childElementCount!==1||!label||label.childElementCount!==1||!svg||paths.length!==1||svg.childElementCount!==1||
            paintValue(button,'backgroundColor')!=='rgba(0, 0, 0, 0.12)'||paintValue(button,'color')!=='rgba(0, 0, 0, 0.26)'||
            paintValue(button,'boxShadow')!=='none'||getComputedStyle(button).backgroundImage!=='none'||getComputedStyle(button).opacity!=='1'||
            paintValue(label,'color')!=='rgba(0, 0, 0, 0.26)'||getComputedStyle(label).backgroundColor!==TRANSPARENT||getComputedStyle(label).opacity!=='1'||
            button.style.getPropertyPriority('color')||label.style.getPropertyPriority('color')||paths[0].style.getPropertyPriority('fill')||
            getComputedStyle(paths[0]).fill!=='rgba(0, 0, 0, 0.26)'||getComputedStyle(paths[0]).stroke!=='none') {rejected.add(family);continue;}
          // Explicit disabled-state exception, like disabled Send. No semantic,
          // opacity, shadow or hit-area changes; native disabled attributes stay.
          plan(button,'data-cg-slot','disabled-action');plan(label,'data-cg-slot','disabled-action-label');plan(paths[0],'data-cg-slot','disabled-action-icon');
        }
      }
      // Utility pages have a qualified header and body, separate from lists.
      if(enabled('list')&&resource==='connections'&&banner?.getAttribute('data-test')==='AgentConnectionsHeader') {
        family='list';
        const dialog=unique(doc,'.MuiDialog-paper[role="dialog"][aria-labelledby="connectionEditorDialogTitle"]');
        if(dialog&&unique(dialog,'h1#connectionEditorDialogTitle')&&unique(dialog,'form')) {
          boundaries.push([dialog,family]);plan(dialog.closest('.MuiDialog-root'),'data-cg-owner',family);
          if(!surface(dialog,'overlay'))rejected.add(family);else workspaceComponents(dialog);
        }
      }
      family='utility';
      const utilityHooks={logs:['AgentLogsHeader','genericCollapsibleHeaderId'],trainer:['IntentTrainerHeader','genericCollapsibleHeaderId'],extensions:['AgentExtensionsHeader','genericHeaderId'],packaging:['AgentPackagesHeader','genericHeaderId']};
      const utility=utilityHooks[resource];
      let utilityPage=knowledgeWizard?knowledgeWizardMain:knowledgeLoading?knowledgeLoadingMain:null;
      if(utility&&banner?.getAttribute('data-test')===utility[0]&&unique(banner,'h1#'+utility[1])) {
        const main=unique(app,'#mainContent');
        if(main?.parentElement===banner.parentElement)utilityPage=main.parentElement;
      }
      if(/\/simulator\/(overview|scenarios|runner)\/?$/.test(loc.pathname)) {
        const simulator=unique(app,'[data-test="SimulationEditorHeader"]');
        const tab={overview:'simulationOverviewTabItem',scenarios:'scenarioListEditorTabItem',runner:'simulationRunsEditorTabItem'}[loc.pathname.replace(/\/$/,'').split('/').at(-1)];
        const scenariosHeader=simulator&&unique(simulator,'[role="banner"][data-test="AgentSimulationsHeader"]:has(h1#simulationListHeader)');
        const scenariosMain=simulator&&unique(simulator,'main#mainContent');
        const standaloneScenarios=loc.pathname.endsWith('/simulator/scenarios')&&scenariosHeader&&scenariosMain&&
          scenariosHeader.parentElement===scenariosMain.parentElement&&
          scenariosHeader.parentElement.parentElement===simulator&&
          unique(simulator,':scope > [role="banner"]')&&unique(scenariosHeader,'[role="search"]');
        if(simulator&&unique(simulator,'#simulationListHeader')&&(unique(simulator,'#'+tab+'[aria-selected="true"]')||standaloneScenarios))utilityPage=simulator;
      }
      const scenarioCreate=loc.pathname.endsWith('/simulator/create')&&unique(app,'div[data-test="SimulationEditorHeader"]:not([role])');
      const scenarioForm=scenarioCreate&&unique(scenarioCreate,'form:has(input#field-name[required]):has(input#field-personaName[required]):has(textarea#field-persona[required]):has(textarea#field-mission[required]):has(input[name="maxTurns"][type="hidden"])');
      if(scenarioForm&&unique(scenarioCreate,'[role="banner"][data-test="SimulationEditorHeader"] h1#simulationListHeader')&&
        scenarioCreate.querySelectorAll('.MuiCard-root[role="button"]:has(img):has(button)').length===2)utilityPage=scenarioCreate;
      const knowledgeDetail=/^\/project\/[^/]+\/[^/]+\/knowledge\/[^/]+\/?$/.test(loc.pathname);
      if(knowledgeDetail&&banner?.getAttribute('data-test')==='AgentKnowledgeSourcesHeader'&&unique(banner,'#knowledgeSourcesListHeader')) {
        const main=unique(banner.parentElement,':scope > main#mainContent');
        if(main?.parentElement===banner.parentElement&&unique(main,'#KnowledgeSource-Tab-sources')&&unique(main,'#KnowledgeSource-Tab-connectors'))utilityPage=main.parentElement;
      }
      const endpointDetail=/^\/project\/[^/]+\/[^/]+\/endpoint\/[^/]+\/?$/.test(loc.pathname);
      if(endpointDetail&&banner?.getAttribute('data-test')==='EndpointEditorHeader'&&unique(banner,'#endpointEditorHeader')) {
        const page=banner.parentElement;
        if(unique(page,'main#mainContent form[aria-labelledby="endpointEditorHeader"]'))utilityPage=page;
      }
      const newGoal=loc.pathname.endsWith('/goal/new')&&banner?.getAttribute('data-test')==='GoalDetailsHeader'&&unique(banner,'h1#genericHeaderId');
      const goalPage=newGoal?banner.parentElement?.parentElement:null;
      const goalBody=goalPage&&unique(goalPage,':scope > div:has(> .MuiDialogContent-root):has(> .MuiDialogActions-root[role="group"])');
      if(goalBody&&goalBody.querySelectorAll(':scope > .MuiDialogContent-root').length===3&&
        goalBody.querySelectorAll('input.MuiInputBase-input[type="text"][required]').length===2&&
        goalBody.querySelectorAll('textarea.MuiInputBase-input:not([aria-hidden])').length===2&&
        unique(goalBody,'.MuiDialogActions-root > button[type="button"]')&&unique(goalBody,'.MuiDialogActions-root > div > button[type="submit"]'))utilityPage=goalPage;
      if(flowRoute==='nlu') {
        const body=unique(app,'#flowNLUEditorTabContent[role="main"]');
        const selected=body&&unique(body,'[role="tab"][aria-selected="true"][id^="flowNLU"]');
        const hooks={'intents':['flowNLUIntentsTabItem','intentsTabContent'],'flow-attachments':['flowNLUFlowAttachmentsTabItem','flowAttachmentsTabContent'],'lexicon-attachments':['flowNLULexiconAttachmentsTabItem','lexiconAttachmentsTabContent'],'slots-filler':['flowNLUSlotFillersTabItem','slotFillersTabContent']};
        const hook=hooks[loc.pathname.split('/').filter(Boolean).at(-1)];
        if(hook&&selected?.id===hook[0]&&unique(body,'#'+hook[1]))utilityPage=body;
      }
      if(flowRoute==='settings') {
        const body=unique(app,'#flowSettingsTabContent[role="main"]');
        const hook=loc.pathname.endsWith('/configuration')?'flowSettingsConfigurationTabContent':loc.pathname.endsWith('/default-context')?'flowSettingsDefaultContextTabContent':null;
        if(hook&&body&&unique(body,'#'+hook))utilityPage=body;
      }
      if(enabled(family)&&utilityPage) {
        boundaries.push([utilityPage,family]);plan(utilityPage,'data-cg-owner',family);
        if(!surface(utilityPage,'canvas',[...LIGHT,TRANSPARENT]))rejected.add(family);
        workspaceComponents(utilityPage);autocomplete(utilityPage);
        if(scenarioCreate&&utilityPage===scenarioCreate) {
          sliders(scenarioForm,['maxTurns']);
          all(scenarioForm,'textarea#field-persona[placeholder],textarea#field-mission[placeholder]').forEach(e=>{
            if(paintValue(e,'opacity','::placeholder')==='0.42')slot(e,'placeholder');
          });
          const help=unique(scenarioForm,'div:has(> h6.MuiTypography-root) > div:has(> svg.MuiSvgIcon-root:only-child)');
          if(help&&paintValue(help,'backgroundColor')==='rgb(255, 255, 255)'&&paintValue(help,'color')==='rgb(48, 48, 48)') {
            surface(help,'panel');plan(help,'data-cg-text','secondary');
            all(help,'svg.MuiSvgIcon-root').forEach(e=>{if(paintValue(e,'color')==='rgb(48, 48, 48)')plan(e,'data-cg-text','secondary');});
          }
          for(let box=scenarioForm.parentElement;box&&box!==scenarioCreate;box=box.parentElement)
            if(LIGHT.includes(paintValue(box,'backgroundColor')))surface(box,'panel');
          all(scenarioCreate,'.MuiCard-root[role="button"]').forEach(card=>{
            surface(card,'panel');
            all(card,'div:has(> img:only-child)').forEach(mat=>{if(paintValue(mat,'backgroundColor')==='rgb(227, 233, 248)')slot(mat,'workspace-selected');});
          });
          all(scenarioCreate,'button:not(.MuiButtonBase-root):not(:disabled)').forEach(button=>{
            surface(button,'secondary-button',[TRANSPARENT,...LIGHT,'rgb(227, 233, 248)','rgba(11, 54, 148, 0.04)']);
            if(paintValue(button,'color')==='rgb(6, 28, 76)')plan(button,'data-cg-text','accent');else text(button);all(button,'span:not(:has(*)),svg').forEach(e=>text(e));
          });
          all(scenarioCreate,'p.MuiTypography-root').forEach(e=>{if(['rgb(48, 48, 48)','rgb(104, 104, 104)'].includes(paintValue(e,'color')))plan(e,'data-cg-text','secondary');});
        }
        if(newGoal&&utilityPage===goalPage) {
          // The legacy Goal editor has no main/form identity. Its named header,
          // three native sections, paired fields and footer define this owner.
          const dialog=unique(doc,'.MuiDialog-paper[role="dialog"]:has(> form[action="#"])');
          if(dialog&&['field-name','field-description','field-completionStep','field-metrics.currency','field-metrics.revenue','field-metrics.duration.value','field-metrics.duration.unit'].every(id=>unique(dialog,'[id="'+id+'"]'))&&
            unique(dialog,'input#field-completionStep[type="checkbox"]')&&unique(dialog,'.MuiDialogActions-root[role="group"] > button[type="button"]')&&unique(dialog,'.MuiDialogActions-root[role="group"] > button[type="submit"]')) {
            boundaries.push([dialog,family]);plan(dialog.closest('.MuiDialog-root'),'data-cg-owner',family);
            if(!surface(dialog,'overlay'))rejected.add(family);
            workspaceComponents(dialog);autocomplete(dialog);
            all(dialog,'.MuiDialogActions-root[role="group"] > button[type="button"]').forEach(button=>{
              if(!button.childElementCount&&[...LINK,'rgb(6, 28, 76)'].includes(paintValue(button,'color'))&&surface(button,'secondary-button',[...LIGHT,TRANSPARENT,'rgb(227, 233, 248)','rgba(11, 54, 148, 0.04)']))plan(button,'data-cg-text','accent');
            });
          }
          all(banner,':scope > div, h1#genericHeaderId > span').forEach(e=>{
            if(LIGHT.includes(paintValue(e,'backgroundColor')))surface(e,'shell');
          });
          all(goalBody,':scope > div:has(> span), :scope > div > span').forEach(e=>{
            text(e);if(paintValue(e,'color')==='rgb(104, 104, 104)')plan(e,'data-cg-text','secondary');
          });
          all(goalBody,':scope > .MuiDialogContent-root > button').forEach(e=>{
            if(surface(e,'primary',LINK))all(e,'.MuiSvgIcon-root').forEach(icon=>plan(icon,'data-cg-text','on-button'));
          });
        }
        if(knowledgeWizard) {
          const card=unique(utilityPage,':scope > div > div > div:has(> p.MuiTypography-root)');
          if(card&&surface(card,'panel')&&paintValue(card,'boxShadow')==='rgba(0, 0, 0, 0.1) 0px 2px 20px 0px')slot(card,'dashboard-shadow');
          // Provider artwork stays native; only its surrounding UI is coloured.
          all(utilityPage,'.MuiTypography-root').forEach(e=>{if(paintValue(e,'color')==='rgb(58, 57, 74)')plan(e,'data-cg-text','secondary');});
          for(const e of utilityPage.querySelectorAll('.MuiStepLabel-root.Mui-disabled .MuiStepLabel-label'))if(paintValue(e,'color')==='rgba(0, 0, 0, 0.54)'&&!e.style.getPropertyPriority('color'))plan(e,'data-cg-text','secondary');
          if(card)all(card,':scope > p > div > div > div,.MuiIconButton-label > div:has([id$="-itemName"])').forEach(e=>{
            const border=paintValue(e,'borderTopColor');
            if(getComputedStyle(e).borderTopWidth==='1px'&&getComputedStyle(e).borderTopStyle==='solid'&&['rgb(236, 236, 237)','rgb(11, 54, 148)'].includes(border))slot(e,border==='rgb(11, 54, 148)'?'knowledge-selected-border':'knowledge-border');
          });
          all(utilityPage,'span:has(> img:only-child)').forEach(e=>{if(e.childElementCount===1&&paintValue(e,'backgroundColor')===TRANSPARENT)slot(e,'native-media-mat');});
        }
        if(flowRoute==='settings') {
          // Flow configuration owns this sticky action bar and its disabled
          // legacy select. Keep disabled semantics and native geometry intact.
          const config=unique(utilityPage,'#flowSettingsConfigurationTabContent > form > [data-test="FlowConfigForm"]');
          if(config) {
            const footer=unique(config,':scope > div > div:has(> hr.MuiDivider-root):has(> div > button[type="submit"].MuiButton-root)');
            if(footer&&footer.children.length===2&&getComputedStyle(footer).position==='sticky')surface(footer,'panel');
            const select=unique(config,'#field-field-agentYesNoLogic.MuiSelect-root.Mui-disabled[role="button"][aria-disabled="true"]');
            const native=select&&unique(select.parentElement,':scope > input#field-agentYesNoLogic.MuiSelect-nativeInput[aria-hidden="true"][tabindex="-1"]');
            const neutral=[...TEXT,...SECONDARY,'rgba(0, 0, 0, 0.38)','rgba(0, 0, 0, 0.26)'];
            if(native&&select.parentElement.matches('.MuiInputBase-root.Mui-disabled')&&!select.closest(PROTECTED)&&paintValue(select,'backgroundColor')==='rgb(245, 245, 246)'&&getComputedStyle(select).backgroundImage==='none'&&!select.style.getPropertyPriority('background-color')&&neutral.includes(paintValue(select,'color'))&&!select.style.getPropertyPriority('color')) {
              plan(select,'data-cg-slot','workspace-disabled-field');plan(select,'data-cg-text','secondary');
              const label=unique(config,'label#labelFor-field-agentYesNoLogic.Mui-disabled');
              const ink=[...select.parentElement.querySelectorAll('.MuiSelect-icon.Mui-disabled'),...(label?[label,...label.querySelectorAll(':scope > span')]:[])];
              for(const e of ink)if(neutral.includes(paintValue(e,'color'))&&!e.style.getPropertyPriority('color'))plan(e,'data-cg-text','secondary');
            }
          }
          for(const tab of utilityPage.querySelectorAll('a.MuiTab-root.Mui-disabled[role="tab"][aria-disabled="true"]')) {
            if(!tab.closest(PROTECTED)&&TEXT.includes(paintValue(tab,'color'))&&!tab.style.getPropertyPriority('color'))plan(tab,'data-cg-text','muted');
          }
        }
        if(utilityPage.matches('[data-test="SimulationEditorHeader"]')) {
          for(const button of utilityPage.querySelectorAll('[data-test="AgentSimulationsHeader"] button[data-test="manage-llm-settings-button"].MuiButton-outlinedPrimary.Mui-disabled:disabled')) {
            const label=unique(button,':scope > span.MuiButton-label:not(:has(*))');
            if(label&&!button.closest(PROTECTED)&&paintValue(button,'backgroundColor')==='rgb(255, 255, 255)'&&
              paintValue(button,'color')==='rgba(0, 0, 0, 0.26)'&&paintValue(label,'color')==='rgba(0, 0, 0, 0.26)'&&
              paintValue(button,'borderTopColor')==='rgba(0, 0, 0, 0.12)'&&!button.style.getPropertyPriority('background-color')) {
              plan(button,'data-cg-slot','disabled-action');plan(label,'data-cg-slot','disabled-action-label');
            }
          }
          const emptyState=unique(utilityPage,'#mainContent > div > div:has(> img):has(button[data-test="simulatorCreateButton"])');
          if(emptyState)all(emptyState,'h1.MuiTypography-root,p.MuiTypography-root').forEach(e=>{
            if(e.matches('h1')&&paintValue(e,'color')==='rgb(42, 85, 179)')plan(e,'data-cg-text','accent');
            if(e.matches('p')&&paintValue(e,'color')==='rgb(48, 48, 48)')plan(e,'data-cg-text','secondary');
          });
          all(utilityPage,'svg[role="img"] text').forEach(e=>{if(TEXT.includes(paintValue(e,'fill'))&&!e.style.getPropertyPriority('fill'))slot(e,'dashboard-tick');});
          all(utilityPage,'.MuiSelect-select > span').forEach(e=>text(e));
          all(utilityPage,'.MuiListItemText-primary > figure').forEach(e=>{
            if(paintValue(e,'backgroundColor')==='rgb(213, 242, 223)'&&paintValue(e,'color')==='rgb(13, 128, 70)') {slot(e,'native-semantic-surface');plan(e,'data-cg-text','native-success');}
          });
        }
        all(utilityPage,':scope > div,[role="banner"],[role="banner"] > div,#mainContent,#mainContent > div,#mainContent > div > div,#collapsibleHeaderContent,[role="tabpanel"],[role="tabpanel"] > div').forEach(e=>{
          if([...LIGHT,'rgb(245, 245, 246)'].includes(paintValue(e,'backgroundColor')))surface(e,e.matches('[role="banner"],[role="banner"] > div')?'shell':'canvas',[...LIGHT,'rgb(245, 245, 246)']);
        });
        all(utilityPage,'div:has(> [data-test-id="AgentBadgeDropdownButton"])').forEach(e=>{if(surface(e,'panel'))text(e);});
        all(utilityPage,'.MuiListSubheader-root,.MuiFormHelperText-root,.MuiTypography-root,.MuiTypography-root > strong,[role="columnheader"],span[id^="intentNameTooltipContent-"],#dropPackageForImportLabel,[data-test="IntentTrainerHeader"] div:has(> .MuiSvgIcon-root) > span').forEach(e=>{
          text(e);
          if(['rgba(0, 0, 0, 0.6)','rgba(37, 37, 37, 0.6)','rgb(58, 57, 74)'].includes(paintValue(e,'color')))plan(e,'data-cg-text','secondary');
        });
        // Packaging's "not included in packages" notice is a leaf div two levels below the banner.
        if(resource==='packaging')all(utilityPage,'[data-test="AgentPackagesHeader"] > div > div:not(:has(*))').forEach(e=>{
          if(paintValue(e,'color')==='rgb(58, 57, 74)'&&surface(e,'panel',['rgb(227, 233, 248)']))plan(e,'data-cg-text','secondary');
        });
        if(knowledgeDetail||endpointDetail) {
          if(knowledgeDetail)all(utilityPage,'main#mainContent a.MuiListItem-root > div > span').forEach(e=>text(e));
          if(endpointDetail)all(utilityPage,'form[aria-labelledby="endpointEditorHeader"] > div').forEach(e=>{if(LIGHT.includes(paintValue(e,'backgroundColor')))surface(e,'panel');});
          if(endpointDetail)all(utilityPage,'form[aria-labelledby="endpointEditorHeader"] div:not(:has(*))').forEach(e=>text(e));
          if(endpointDetail)all(utilityPage,'form[aria-labelledby="endpointEditorHeader"] [id$="FormSection"],form[aria-labelledby="endpointEditorHeader"] .MuiAccordionDetails-root div:not(:has(*)),form[aria-labelledby="endpointEditorHeader"] .MuiFormLabel-root span').forEach(e=>{text(e);if(paintValue(e,'color')==='rgb(58, 57, 74)')plan(e,'data-cg-text','secondary');});
          const compact=unique(app,'aside[aria-labelledby="compactListHeader"]');
          if(compact&&unique(compact,'#compactListHeader')) {
            boundaries.push([compact,family]);plan(compact,'data-cg-owner',family);workspaceComponents(compact);
            all(compact,'.MuiListItemText-primary div:not(:has(*))').forEach(e=>text(e));
            for(const e of [compact,...all(compact,':scope > div,:scope > div > div')])if([...LIGHT,TRANSPARENT].includes(paintValue(e,'backgroundColor')))surface(e,'shell',[...LIGHT,TRANSPARENT]);
          }
          const drawer=unique(app,'#editSidebarWrapper[role="region"][aria-labelledby="editSidebarTitle"][data-test="EditSidebar"]');
          if(knowledgeDetail&&drawer&&unique(drawer,'#editSidebarTitle')&&unique(drawer,'#field-field-type[aria-haspopup="listbox"]')) {
            boundaries.push([drawer,family]);plan(drawer,'data-cg-owner',family);
            if(!surface(drawer,'overlay'))rejected.add(family);else workspaceComponents(drawer);
            const menu=unique(doc,'#menuFor-field-type.MuiPopover-root [role="listbox"][aria-labelledby="labelFor-field-type"]');
            const paper=menu?.closest('.MuiPopover-paper');
            if(paper&&unique(drawer,'#labelFor-field-type')) {
              boundaries.push([paper,family]);plan(paper.closest('.MuiPopover-root'),'data-cg-owner',family);
              if(!surface(paper,'overlay'))rejected.add(family);else {
                workspaceComponents(paper);all(paper,'[role="option"]').forEach(e=>{text(e);slot(e,'menu-item');});
                all(paper,'[role="option"] > div').forEach(e=>{if(paintValue(e,'backgroundColor')==='rgb(152, 71, 175)'&&paintValue(e,'color')==='rgb(255, 255, 255)')slot(e,'native-semantic-surface');});
              }
            }
          }
        }
        if(['logs','trainer'].includes(resource)) {
          const toggle=unique(utilityPage,'button.MuiIconButton-root[aria-controls="collapsibleHeaderContent"][aria-expanded]');
          if(toggle&&unique(utilityPage,'#collapsibleHeaderContent')&&unique(toggle,'svg[viewBox="0 0 50 50"]'))
            surface(toggle,'secondary-button',['rgb(245, 245, 246)']);
        }
        if(resource==='trainer') {
          all(utilityPage,'[role="gridcell"],[role="gridcell"] > span,#mainContent > div > div:not(:has(*))').forEach(e=>text(e));
          for(const button of utilityPage.querySelectorAll('#mainContent [role="columnheader"] > button.MuiButton-textPrimary.Mui-disabled:disabled')) {
            const label=unique(button,':scope > .MuiButton-label:not(:has(*))');
            if(label&&paintValue(button,'backgroundColor')===TRANSPARENT&&[button,label].every(e=>paintValue(e,'color')==='rgba(0, 0, 0, 0.26)')) {
              plan(button,'data-cg-text','muted');plan(label,'data-cg-text','muted');
            }
          }
          const footer=unique(utilityPage,'#mainContent > div:last-child > [role="group"]:has(> button[type="button"]:disabled):has(> button:not([type]):disabled)');
          const dismiss=footer&&footer.children.length===2&&unique(footer,':scope > button[type="button"]:disabled:not(:has(*))');
          if(dismiss&&paintValue(dismiss,'backgroundColor')==='rgb(255, 255, 255)'&&paintValue(dismiss,'color')==='rgb(11, 54, 148)'&&paintValue(dismiss,'opacity')==='0.5') {
            plan(dismiss,'data-cg-slot','secondary-button');plan(dismiss,'data-cg-text','accent');
          }
          // This avatar-shaped counter contains text only, never an agent image.
          for(const counter of utilityPage.querySelectorAll('#mainContent [role="gridcell"] > .MuiAvatar-root.MuiAvatar-colorDefault[aria-hidden="true"]:not(:has(*))')) {
            if(counter.previousElementSibling?.matches('span.sr-only')&&paintValue(counter,'backgroundColor')==='rgb(230, 234, 244)'&&paintValue(counter,'color')==='rgb(11, 54, 148)') {
              plan(counter,'data-cg-slot','workspace-selected');plan(counter,'data-cg-text','accent');
            }
          }
          const preset=unique(utilityPage,'[role="button"][aria-labelledby="filterPresetsId"][aria-haspopup="listbox"][aria-expanded="true"]');
          const presetList=preset&&unique(doc,'.MuiPopover-paper > [role="listbox"][aria-labelledby="filterPresetsId"]');
          const menuButton=unique(utilityPage,'button#intentTrainerHeaderSecBtn[aria-haspopup="true"]');
          const headerMenu=menuButton&&unique(doc,'.MuiPopover-paper > #menuForButton-intentTrainerHeaderSecBtn[role="menu"][aria-labelledby="intentTrainerHeaderSecBtn"]');
          for(const menu of [presetList,headerMenu].filter(Boolean)) {
            const paper=menu.parentElement;
            boundaries.push([paper,family]);plan(paper.closest('.MuiPopover-root'),'data-cg-owner',family);
            if(!surface(paper,'overlay'))rejected.add(family);
            workspaceComponents(paper);
            all(menu,':scope > .MuiMenuItem-root').forEach(option=>{
              if(!surface(option,'overlay',[...LIGHT,TRANSPARENT,'rgba(0, 0, 0, 0.04)','rgba(0, 0, 0, 0.08)','rgba(61, 159, 255, 0.05)']))rejected.add(family);
              slot(option,'menu-item');text(option);
            });
          }
        }
        if(resource==='packaging')all(utilityPage,'#mainContent .MuiList-root,#mainContent .MuiList-root > li,#mainContent .MuiList-root > li > div,#mainContent .MuiListSubheader-root').forEach(e=>{if(LIGHT.includes(paintValue(e,'backgroundColor')))surface(e,'panel');});
        if(resource==='packaging')all(utilityPage,'div:has(> #dropPackageForImportLabel),div:has(> #dropPackageForImportLabel) > button').forEach(e=>surface(e,'panel',['rgba(236, 236, 237, 0.7)']));
        if(resource==='extensions')all(utilityPage,'a[id^="installedExtensionCard-"],a[id^="marketPlaceExtensionCard-"]').forEach(card=>{
          surface(card.parentElement,'panel');
          all(card,'div:has(> p.MuiTypography-root)').forEach(e=>{
            if(paintValue(e,'backgroundColor')==='rgba(11, 54, 148, 0.1)')surface(e,'panel',['rgba(11, 54, 148, 0.1)']);
          });
          all(card,'.MuiTypography-root').forEach(e=>{if(paintValue(e,'color')==='rgba(11, 54, 148, 0.8)')plan(e,'data-cg-text','accent');});
          if(!surface(card,'panel',[...LIGHT,TRANSPARENT]))rejected.add(family);
          all(card,'span[id^="installedExtensionCardVersionNumberId-"],span[id^="marketPlaceExtensionCardVersionNumberId-"]').forEach(e=>{text(e);if(paintValue(e,'color')==='rgb(0, 0, 238)')plan(e,'data-cg-text','accent');});
        });
      }
      // The project dashboard owns its four cards, chart and period portal as
      // one atomic family. No generated class names, labels or chart values.
      family='dashboard';
      const dashboard=unique(app,'div#mainContent[role="main"]');
      const dashboardPage=dashboard?.parentElement;
      const dashboardBanner=dashboardPage&&unique(dashboardPage,':scope > [role="banner"][data-test="AgentDashboardHeader"]');
      // Widgets fetch their data after the page frame mounts. While any shows its
      // native spinner, paint only the frame, header and cards; rows, chart and
      // period select are qualified once the data has loaded.
      const dashLoading=!!dashboard?.querySelector('.MuiCircularProgress-root[role="progressbar"]');
      if(enabled(family)&&/^\/project\/[^/]+\/[^/]+\/?$/.test(loc.pathname)&&dashboardBanner&&dashboardPage.childElementCount===2) {
        boundaries.push([dashboardPage,family]);
        if(!surface(dashboardPage,'canvas',['rgb(249, 249, 254)'])||!surface(dashboard,'canvas',['rgb(249, 249, 254)']))rejected.add(family);
        if(!surface(dashboardBanner,'canvas',[TRANSPARENT]))rejected.add(family);
        controls(dashboardPage);
        const strip=unique(dashboardBanner,':scope > div:has([data-test-id="AgentBadgeDropdownButton"])');
        if(!surface(strip,'shell'))rejected.add(family);
        const picker=strip?.querySelector('[data-test-id="AgentBadgeDropdownButton"]');
        if(!picker||!surface(picker.parentElement,'panel'))rejected.add(family);
        else text(picker.parentElement);
        all(dashboardPage,'.MuiSvgIcon-root').forEach(e=>{text(e,'icon');monoPaths(e,[...TEXT,...SECONDARY,...LINK,'none']);});
        all(dashboardPage,'.sr-only').forEach(e=>text(e));
        const headings=['dashboardAnalyticsWidgetHeading','dashboardGetStartedWidgetHeading','dashboardMembersWidgetHeading','dashboardRecentWidgetHeading'];
        const cards=headings.map(id=>unique(dashboard,':scope > div:has(> h2 p#'+id+')'));
        const cardShadow='rgba(0, 0, 0, 0.1) 0px 2px 20px 0px';
        if(dashboard.childElementCount!==4||cards.some(e=>!e))rejected.add(family);
        for(const card of cards.filter(Boolean)) {
          if(card.childElementCount!==2||!card.children[0].matches('h2')||!card.children[1].matches('div')||
            paintValue(card,'boxShadow')!==cardShadow||!surface(card,'panel',['rgb(255, 255, 255)']))rejected.add(family);
          else slot(card,'dashboard-shadow');
        }
        if(!dashLoading)for(const id of ['dashboardMembersWidgetHeading','dashboardRecentWidgetHeading']) {
          const rows=unique(dashboard,'ul.MuiList-root[aria-labelledby="'+id+'"]');
          if(!rows)rejected.add(family);
          else all(rows,':scope > li > a.MuiListItem-button[role="button"]').forEach(e=>{
            if(!surface(e,'settings-row',[TRANSPARENT,'rgba(0, 0, 0, 0.04)']))rejected.add(family);
          });
        }
        all(dashboard,'ul[aria-labelledby="dashboardRecentWidgetHeading"] .MuiListItemText-primary > div > div:not(:has(*))').forEach(e=>text(e));
        // Original Explore background images and avatar subtrees are untouched.
        all(dashboard,'ul[aria-labelledby="dashboardGetStartedWidgetHeading"] > li > a.MuiLink-root > div > p.MuiTypography-root').forEach(e=>{
          if(paintValue(e,'color')==='rgb(116, 116, 129)')plan(e,'data-cg-text','secondary');
        });
        // Before its data arrives the analytics card shows a static empty-state line.
        if(dashLoading&&cards[0])all(cards[0],'p.MuiTypography-root:not(#dashboardAnalyticsWidgetHeading)').forEach(e=>{
          if(!e.childElementCount&&paintValue(e,'color')==='rgb(58, 57, 74)')plan(e,'data-cg-text','text');
        });
        if(!dashLoading) {
        const analytics=cards[0];
        const plot=analytics&&unique(analytics,'.recharts-responsive-container > .recharts-wrapper');
        const svg=plot&&unique(plot,':scope > svg.recharts-surface');
        const curve=svg&&unique(svg,'.recharts-line > path.recharts-line-curve');
        const dots=svg?all(svg,'.recharts-line-dots > circle.recharts-dot.recharts-line-dot'):[];
        const ticks=svg?all(svg,'text.recharts-text.recharts-cartesian-axis-tick-value'):[];
        const active=svg?all(svg,'.recharts-active-dot > circle.recharts-dot'):[];
        if(!svg||!curve||svg.querySelectorAll('.recharts-line').length!==1||!dots.length||!ticks.length||active.length>1)rejected.add(family);
        else {
          const known=new Set([curve,...dots,...active,...ticks,...all(svg,'text.recharts-cartesian-axis-tick-value > tspan'),...all(svg,'defs > clipPath > rect')]);
          if(all(svg,'path,circle,line,polyline,polygon,rect,ellipse,text,tspan,image,use,foreignObject').some(e=>!known.has(e)))rejected.add(family);
          const svgPaint=(e,fill,stroke,value)=>{
            const g=getComputedStyle(e);
            if(g.fill!==fill||g.stroke!==stroke||g.opacity!=='1'||e.style.getPropertyPriority('fill')||e.style.getPropertyPriority('stroke'))rejected.add(family);
            else slot(e,value);
          };
          svgPaint(curve,'none','rgb(11, 54, 148)','dashboard-line');
          dots.forEach(e=>svgPaint(e,'rgb(255, 255, 255)','rgb(11, 54, 148)','dashboard-dot'));
          active.forEach(e=>svgPaint(e,'rgb(11, 54, 148)','rgb(255, 255, 255)','dashboard-active-dot'));
          for(const tick of ticks) {
            svgPaint(tick,'rgb(102, 102, 102)','none','dashboard-tick');
            all(tick,':scope > tspan').forEach(e=>svgPaint(e,'rgb(102, 102, 102)','none','dashboard-tick'));
          }
          const tooltip=unique(plot,':scope > .recharts-tooltip-wrapper');
          if(!tooltip||tooltip.childElementCount>1)rejected.add(family);
          if(tooltip?.childElementCount) {
            const paper=tooltip.firstElementChild;
            if(!paper.matches('div')||paper.childElementCount!==2||
              !Array.from(paper.children).every(e=>e.matches('p.MuiTypography-root'))||
              paintValue(paper,'boxShadow')!==cardShadow||!surface(paper,'overlay',['rgb(255, 255, 255)']))rejected.add(family);
            else {slot(paper,'dashboard-shadow');componentText(paper);}
          }
        }
        // This native select has no ARIA popup ID. Its exact, observed enum
        // structure plus a unique expanded trigger establishes bounded ownership.
        const selectors=analytics?all(analytics,'.MuiSelect-root[role="button"][aria-haspopup="listbox"]'):[];
        const trigger=selectors.length===1?selectors[0]:null;
        const periodInput=trigger&&unique(trigger.parentElement,':scope > input.MuiSelect-nativeInput[aria-labelledby="dashboardAnalyticsWidgetHeading"]');
        if(!trigger||!periodInput||!safe(trigger))rejected.add(family);
        const portal=unique(doc,'#menu-.MuiPopover-root[role="presentation"]');
        if(trigger?.getAttribute('aria-expanded')==='true'||portal) {
          const paper=portal&&unique(portal,':scope > .MuiPaper-root.MuiMenu-paper.MuiPopover-paper');
          const listbox=paper&&unique(paper,':scope > ul.MuiMenu-list[role="listbox"]');
          if(trigger?.getAttribute('aria-expanded')!=='true'||!paper||!listbox||paper.childElementCount!==1||listbox.childElementCount!==2||
            doc.querySelectorAll('.MuiPopover-root').length!==1||
            paintValue(paper,'boxShadow')!=='rgba(0, 0, 0, 0.1) 0px 2px 10px 0px'||!surface(paper,'overlay',['rgb(255, 255, 255)']))rejected.add(family);
          else {
            boundaries.push([paper,family]);slot(paper,'popover-shadow');plan(portal,'data-cg-owner','dashboard');
            let selected=0;
            for(const [i,option] of Array.from(listbox.children).entries()) {
              const label=option.firstElementChild,isSelected=option.getAttribute('aria-selected')==='true',hover=option.matches(':hover');
              if(isSelected)selected++;
              if(!option.matches('li.MuiMenuItem-root[role="option"][aria-disabled="false"]')||option.getAttribute('data-value')!==String(i)||
                ![null,'false','true'].includes(option.getAttribute('aria-selected'))||option.classList.contains('Mui-selected')!==isSelected||
                option.childElementCount!==2||!label?.matches('p.MuiTypography-root')||label.childElementCount||
                !option.lastElementChild.matches('span.MuiTouchRipple-root')||
                !(isSelected||hover?LINK:TEXT).includes(paintValue(option,'color'))||paintValue(label,'color')!==paintValue(option,'color')||
                paintValue(label,'backgroundColor')!==TRANSPARENT||getComputedStyle(label).backgroundImage!=='none'||getComputedStyle(label).opacity!=='1'||
                !surface(option,'dashboard-option',isSelected?['rgba(61, 159, 255, 0.2)']:hover?['rgba(61, 159, 255, 0.11)']:[TRANSPARENT,'rgba(0, 0, 0, 0.08)'])) {rejected.add(family);continue;}
              text(option);slot(label,'dashboard-option-label');
            }
            if(selected!==1)rejected.add(family);
          }
        }
        }
      }
      family='list';
      if(enabled(family)&&listPage&&surface(list,'panel')) {
        boundaries.push([list,family]);controls(list);workspaceText(list);
        if(resource==='locales')for(const chip of all(list,'.MuiChip-root.MuiChip-colorPrimary.MuiChip-sizeSmall')) {
          const label=unique(chip,':scope > .MuiChip-label.MuiChip-labelSmall');
          if(label&&!label.childElementCount&&chip.childElementCount===1&&paintValue(chip,'backgroundColor')==='rgb(144, 202, 249)'&&paintValue(label,'color')==='rgb(58, 57, 74)') {
            slot(chip,'native-semantic-surface');plan(label,'data-cg-text','native-dark');
          }
        }
        all(table,'.MuiPaper-root').forEach(e=>{if(!surface(e,'panel'))rejected.add(family);});
        all(table,'[role="row"] .MuiListItem-button').forEach(e=>{
          if(surface(e,'list-row',[TRANSPARENT,...LIGHT,'rgba(61, 159, 255, 0.05)']))componentText(e);else rejected.add(family);
          // Native Endpoint virtual rows overlap their preceding 1px divider.
          // Preserve transparency so recolouring never hides that existing line.
          if(resource==='endpoints')slot(e,'resource-row');
        });
        if(resource==='snapshots') {
          const body=table.querySelectorAll('[role="rowgroup"]')[1];
          for(const row of all(body,'[role="row"]')) {
            const cell=unique(row,'.MuiListItemText-root[role="cell"][aria-describedby]');
            const id=cell?.getAttribute('aria-describedby');
            const description=id&&!/\s/.test(id)?unique(doc,'#'+CSS.escape(id)):null;
            const shadow=paintValue(row,'boxShadow');
            if(!row.querySelector(':scope > .MuiAvatar-root[aria-hidden="true"]')||!description?.matches('span.sr-only')||!row.contains(description)||
              !['none','rgba(0, 0, 0, 0.1) 0px 2px 10px 0px'].includes(shadow)||
              !surface(row,'snapshot-row',[TRANSPARENT,'rgb(255, 255, 255)'])) {rejected.add(family);continue;}
            text(description);
            if(shadow!=='none')slot(row,'popover-shadow');
          }
        }
        all(table,'[data-test="llmListItem"] .MuiListItem-root:not(.MuiListItem-button)').forEach(e=>{
          if(!surface(e,'panel',[TRANSPARENT,...LIGHT]))rejected.add(family);
        });
        all(table,'[data-test="llmListItem"] .MuiListItemText-primary > span').forEach(e=>text(e));
        // Provider artwork remains byte-for-byte native, including black logos.
        // Retain its original white backing within the existing image box.
        all(table,'[data-test="llmListItem"] .MuiListItem-root > img').forEach(e=>{
          if(getComputedStyle(e).backgroundColor===TRANSPARENT)slot(e,'native-media-mat');
        });
        all(table,'.MuiDivider-root').forEach(e=>{
          if(['rgba(0, 0, 0, 0.08)','rgba(0, 0, 0, 0.12)'].includes(getComputedStyle(e).backgroundColor))slot(e,'divider');
        });
      }
      family='agents';
      if(enabled(family)&&gallery&&surface(gallery,'canvas')) {
        boundaries.push([gallery,family]);
        if(!surface(gallery.parentElement,'canvas',[TRANSPARENT]))rejected.add(family);
        const grid=unique(gallery,'[data-pa-id="agents-grid"].MuiPaper-root');
        if(!surface(grid,'canvas'))rejected.add(family);
        if(grid)all(grid,'.MuiListItem-container > a.MuiListItem-button').forEach(e=>{if(!e.parentElement.parentElement.matches('[data-test="ai-agent-card"]'))rejected.add(family);});
        for(const card of all(gallery,'[data-test="ai-agent-card"]')) {
          if(!card.querySelector(':scope > .MuiListItem-container > a.MuiListItem-button')||
             !card.querySelector('[data-test="ai-agent-name"]')||
             !['rgb(227, 233, 248)','rgb(11, 54, 148)'].includes(paintValue(card,'borderTopColor'))||
             !surface(card,'gallery-card')) {rejected.add(family);continue;}
          controls(card);
          all(card,'[data-test="ai-agent-description"]').forEach(e=>{
            if(paintValue(e,'color')==='rgb(104, 104, 104)')plan(e,'data-cg-text','secondary');
          });
        }
      }
      // The editor wrapper owns its banner, canvas and form together. Qualification
      // is structural; neither agent names nor form contents are inspected.
      const agentMain=unique(app,'div#mainContent:has(#AIAgent-Tab-jobs):has(#AIAgent-Tab-persona)');
      const agentPage=agentMain?.parentElement;
      const agentView=/\/ai-agents\/edit\/[^/]+\/(jobs|persona)(?:\/[^/]+)?\/?$/.exec(loc.pathname)?.[1];
      const agentBanner=agentPage&&unique(agentPage,':scope > [role="banner"][data-test="AI-Agent-Edit"]');
      if(enabled(family)&&agentBanner&&surface(agentPage,'canvas',[TRANSPARENT])) {
        boundaries.push([agentPage,family]);controls(agentPage);
        const frame=unique(agentMain,':scope > div:has([role="tablist"])');
        const editorLoader=frame&&!frame.querySelector('form')&&frame.children.length===3&&
          frame.children[1].matches('div:empty')&&frame.lastElementChild.matches('div:has(> svg.MuiSvgIcon-root.loading:only-child > g.loading-ai-container)');
        if(!frame||(!frame.querySelector('form')&&!editorLoader)||!surface(frame,'panel'))rejected.add(family);
        if(frame) {
        all(agentBanner,':scope > div:has([data-test-id="AgentBadgeDropdownButton"])').forEach(e=>{if(!surface(e,'shell'))rejected.add(family);});
        const picker=agentBanner.querySelector('[data-test-id="AgentBadgeDropdownButton"]');
        // The named editor header mounts its empty picker strip first.
        const pendingPicker=unique(agentBanner,':scope > div:first-child:empty');
        if(!picker&&pendingPicker&&!surface(pendingPicker,'shell'))rejected.add(family);
        if(picker&&surface(picker.parentElement,'panel')) {text(picker.parentElement);all(picker,'.MuiSvgIcon-root').forEach(e=>text(e,'icon'));}
        all(frame,':scope > div:empty').forEach(e=>{
          if(getComputedStyle(e).backgroundColor==='rgb(227, 233, 248)')slot(e,'divider');
        });
        all(agentPage,'.sr-only').forEach(e=>text(e));
        all(agentPage,'.MuiTypography-root').forEach(e=>{if(paintValue(e,'color')==='rgb(104, 104, 104)')plan(e,'data-cg-text','secondary');});
        all(frame,'button:not(.MuiButtonBase-root):not(:has(img))').forEach(e=>{
          if(safe(e)&&LINK.includes(paintValue(e,'color'))&&surface(e,'secondary-button')) {slot(e,'button');text(e);all(e,':scope > span:not(:has(*))').forEach(label=>text(label));}
        });
        // Native tabs use .7 opacity and generated active classes. The observed
        // route plus the form's structural content identifies the selected tab.
        all(frame,'#AIAgent-Tab-jobs,#AIAgent-Tab-persona').forEach(e=>{
          if(getComputedStyle(e).opacity==='0.7') {slot(e,'agent-tab');if(agentView===e.id.slice('AIAgent-Tab-'.length))slot(e,'agent-tab-active');}else rejected.add(family);
        });
        const form=unique(frame,'form');
        if(form)all(form,':scope > div:last-child:has(> div > button[type="submit"])').forEach(e=>{if(!surface(e,'panel',[TRANSPARENT,...LIGHT]))rejected.add(family);});
        // A route commits before React replaces the outgoing form. Classify
        // the mounted form independently so that valid outgoing paint survives.
        const jobs=!!agentView&&form?.querySelector('[data-test="CognigyTextEditableField"]')&&!form.querySelector('#field-name');
        const persona=!!agentView&&form?.querySelector('#field-name')&&!form.querySelector('[data-test="CognigyTextEditableField"]');
        // Jobs mounts its profile/list and placeholder before the detail fields.
        const pendingBody=!jobs&&!persona&&form?.children.length===2?form.firstElementChild:null;
        const pendingMaster=pendingBody?.children[0],pendingDivider=pendingBody?.children[1];
        const pendingOuter=pendingBody?.children[2],pendingDetail=pendingOuter?.firstElementChild;
        const pendingProfile=pendingMaster&&unique(pendingMaster,':scope > div:first-child:has(> div > div > img:only-child):has(> div > div > p.MuiTypography-root)');
        const pendingList=pendingMaster?.children[1];
        const pendingMessage=pendingDetail?.firstElementChild;
        const pendingJobs=!!agentView&&pendingBody?.children.length===3&&pendingProfile&&pendingMaster.children.length===2&&
          pendingDivider?.matches('div:empty')&&pendingOuter?.matches('div')&&pendingOuter.children.length===1&&
          pendingDetail?.matches('div')&&pendingDetail.children.length===1&&
          (pendingList?.matches('ul.MuiList-root')||pendingList?.matches('div:has(> p.MuiTypography-body2.MuiTypography-colorTextSecondary:only-child)'))&&
          (pendingMessage?.matches('p.MuiTypography-body1:not(:has(*))')||pendingMessage?.matches('div:has(> svg):has(> h6.MuiTypography-root):has(> p.MuiTypography-body2)')&&pendingMessage.children.length===3)&&
          !pendingDetail.querySelector('input,textarea,button,[contenteditable],a');
        if(!jobs&&!persona&&!editorLoader&&!pendingJobs)rejected.add(family);
        if(pendingJobs) {
          if(!surface(pendingMaster,'panel')||!surface(pendingDetail,'panel')||
            !surface(pendingProfile,'agent-profile',[TRANSPARENT,'rgba(0, 0, 0, 0.04)']))rejected.add(family);
          if(paintValue(pendingDivider,'backgroundColor')==='rgba(0, 0, 0, 0.12)')slot(pendingDivider,'divider');else rejected.add(family);
          componentText(pendingMaster);componentText(pendingDetail);
          all(pendingMaster,':scope > div > div > div').forEach(e=>text(e));
          all(pendingMaster,'.MuiListItem-root').forEach(e=>{if(surface(e,'agent-job',[TRANSPARENT,'rgb(227, 233, 248)']))componentText(e);else rejected.add(family);});
          all(pendingMaster,'.MuiSvgIcon-root').forEach(e=>{text(e,'icon');mono(e);});
          all(pendingDetail,'svg').forEach(e=>{text(e,'icon');mono(e);});
        }
        if(jobs&&form) {
          // Monaco renders a plain loading leaf before its protected editor mounts.
          all(form,'.MuiAccordionDetails-root .MuiGrid-root.MuiGrid-container > div > section:first-child').forEach(section=>{
            const [loading,mount]=section.children;
            if(section.children.length===2&&loading.matches('div:not(:has(*))')&&mount.matches('div:empty')&&
              getComputedStyle(loading).display==='flex'&&getComputedStyle(mount).display==='none')text(loading);
          });
          switches(form);
          sliders(form,['config.knowledgeSearchTopK','config.maxTokens','config.temperature']);
          // Match only the two observed disabled Advanced slider labels.
          // Hidden inputs stay untouched; the disabled state and warning SVGs remain native.
          for(const name of ['config.maxTokens','config.temperature']) {
            const input=unique(form,`.MuiSlider-root.Mui-disabled > input[name="${name}"]`);
            const group=input?.closest('.MuiGrid-container.MuiGrid-direction-xs-column');
            const label=group&&unique(group,':scope > div > div > span > label.MuiFormLabel-root.Mui-disabled');
            if(label&&!label.closest(PROTECTED)&&paintValue(label,'color')==='rgba(0, 0, 0, 0.38)'&&
              !label.style.getPropertyPriority('color')) {
              for(const leaf of label.querySelectorAll(':scope > span:not(:has(*))'))
                if(paintValue(leaf,'color')==='rgba(0, 0, 0, 0.38)'&&!leaf.style.getPropertyPriority('color'))plan(leaf,'data-cg-text','secondary');
            }
          }
          // Preserve provider artwork; its existing wrapper supplies a light mat.
          all(form,'.MuiInputBase-root:has(> input[id="field-config.llmProviderReferenceId"]) > span:has(> img:only-child)').forEach(e=>{
            if(!surface(e,'native-media-mat',[TRANSPARENT]))rejected.add(family);
          });
          const toolsBox=unique(form,'div:has(> div > [role="button"][tabindex="0"]:not(.MuiButtonBase-root))');
          if(!toolsBox)rejected.add(family);
          if(toolsBox) {
            if(!surface(toolsBox,'panel'))rejected.add(family);
            all(toolsBox,':scope > div > [role="button"]').forEach(e=>{
              if(!['true','false'].includes(e.getAttribute('aria-pressed')))rejected.add(family);
              if(!surface(e,'agent-tool',[TRANSPARENT,'rgba(0, 0, 0, 0.04)']))rejected.add(family);
              all(e,'.MuiSvgIcon-root').forEach(svg=>text(svg,'icon'));
            });
            for(const portal of all(doc,'.MuiTooltip-popper[role="tooltip"]')) {
              const paper=unique(portal,':scope > .MuiTooltip-tooltip.MuiTooltip-tooltipArrow');
              const arrow=paper&&unique(paper,':scope > span.MuiTooltip-arrow');
              const triggers=[...toolsBox.querySelectorAll('[role="button"][tabindex="0"] > div > div > div[aria-describedby]')]
                .filter(e=>portal.id&&(e.getAttribute('aria-describedby')||'').split(/\s+/).includes(portal.id));
              const previous=agentTooltipLinks.get(portal);
              const exiting=triggers.length===0&&previous?.form===form&&previous.path===loc.pathname&&previous.paper===paper&&toolsBox.contains(previous.trigger);
              if((triggers.length!==1&&!exiting)||!paper||paper.children.length!==1||!arrow||arrow.children.length||
                paintValue(paper,'backgroundColor')!=='rgb(255, 255, 255)'||getComputedStyle(paper).backgroundImage!=='none'||
                paintValue(paper,'color')!=='rgb(58, 57, 74)'||paper.style.getPropertyPriority('color')||
                paintValue(arrow,'color')!=='rgb(255, 255, 255)'||paintValue(arrow,'backgroundColor','::before')!=='rgb(255, 255, 255)')continue;
              boundaries.push([paper,family]);plan(portal,'data-cg-owner',family);
              surface(paper,'overlay');plan(paper,'data-cg-text','text');slot(arrow,'workspace-tooltip-arrow');
              if(triggers.length===1)pendingAgentTooltipLinks.push([portal,{form,path:loc.pathname,paper,trigger:triggers[0]}]);
            }
          }
          const master=unique(form,':scope > div:first-child > div:has(> ul.MuiList-root)');
          const detail=unique(form,':scope > div:first-child > div > div:has(> div [data-test="CognigyTextEditableField"])');
          if(!surface(master,'panel')||!surface(detail,'panel'))rejected.add(family);
          if(master) {
            // The profile summary is hovered immediately after gallery navigation.
            // Its translucent native hover must remain within the editor owner.
            const profile=unique(master,':scope > div:first-child:has(> div > div > img:only-child):has(> div > div > p.MuiTypography-root)');
            if(profile) {
              if(surface(profile,'agent-profile',[TRANSPARENT,'rgba(0, 0, 0, 0.04)']))componentText(profile);
              else rejected.add(family);
            }
            componentText(master);
            all(master,'.MuiSvgIcon-root').forEach(e=>{text(e,'icon');mono(e);});
            all(master,':scope > div > div > div').forEach(e=>text(e));
            all(master,'.MuiListItem-root').forEach(e=>{
              if(surface(e,'agent-job',[TRANSPARENT,'rgb(227, 233, 248)']))componentText(e);else rejected.add(family);
            });
          }
          all(form,':scope > div:first-child > div:empty').forEach(e=>{
            if(getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0.12)')slot(e,'divider');
          });
        }
        if(persona) {
          const disabledKnowledge=unique(form,'input#field-type.MuiInputBase-input:disabled');
          const disabledField=disabledKnowledge?.parentElement;
          if(disabledKnowledge&&disabledField?.matches('.MuiInputBase-root.Mui-disabled')&&!disabledField.closest(PROTECTED)&&
            getComputedStyle(disabledField).backgroundImage==='none'&&LIGHT.includes(paintValue(disabledField,'backgroundColor'))&&
            paintValue(disabledKnowledge,'backgroundColor')===TRANSPARENT&&paintValue(disabledKnowledge,'color')==='rgba(0, 0, 0, 0.38)'&&
            !disabledKnowledge.style.getPropertyPriority('color')&&!disabledKnowledge.style.getPropertyPriority('-webkit-text-fill-color')) {
            plan(disabledField,'data-cg-slot','workspace-disabled-field');plan(disabledKnowledge,'data-cg-text','secondary');
            const label=unique(disabledKnowledge.closest('section'),'label.Mui-disabled[for="field-type"]');
            if(label&&paintValue(label,'color')==='rgba(0, 0, 0, 0.38)')plan(label,'data-cg-text','secondary');
            for(const icon of disabledField.querySelectorAll('.MuiSvgIcon-root'))if(paintValue(icon,'color')==='rgba(0, 0, 0, 0.26)')plan(icon,'data-cg-text','secondary');
          }
          // The Knowledge setup warning is native semantic text, not body ink.
          const knowledgePath=loc.pathname.replace(/\/ai-agents\/edit\/[^/]+\/(?:persona|jobs(?:\/[^/]+)?)\/?$/,'/knowledge');
          all(form,'section:has(input#field-type) p.MuiTypography-root > div:has(> a.MuiButton-containedPrimary)').forEach(warning=>{
            const link=unique(warning,':scope > a.MuiButton-containedPrimary');
            if(link?.getAttribute('href')===knowledgePath&&paintValue(warning,'color')==='rgb(244, 67, 54)'&&paintValue(warning.parentElement,'color')==='rgb(244, 67, 54)') {
              plan(warning,'data-cg-text','error');plan(warning.parentElement,'data-cg-text','error');
            }
          });
          all(form,'section p.MuiTypography-colorTextSecondary > i:only-child').forEach(e=>{
            if(!e.childElementCount&&paintValue(e,'color')==='rgb(104, 104, 104)')plan(e,'data-cg-text','secondary');
          });
          all(form,'section > div > div > span').forEach(e=>text(e));
          sliders(form,['speakingStyle.completeness','speakingStyle.formality']);
          switches(form);
          all(form,':scope > div > div:last-child:has(> div > button[type="submit"])').forEach(e=>{if(!surface(e,'panel',[TRANSPARENT,...LIGHT]))rejected.add(family);});
        }
        // Agent autocomplete portals share the form's atomic owner. Both native
        // ARIA links must identify the same unique listbox; generated IDs/classes
        // are never recorded. Parent field failure also restores the portal.
        if(form)autocomplete(form);
        }
      }
      // A settings page owns its banner, form and explicitly linked portals.
      // The main has no stable id after SPA navigation; use the direct sibling.
      family='settings';
      const settingsBanner=unique(app,'[role="banner"][data-test="AgentSettingsHeader"]');
      const settingsPage=settingsBanner?.parentElement;
      const settingsMain=settingsPage&&unique(settingsPage,':scope > div[role="main"]');
      const settingsForm=settingsMain&&unique(settingsMain,':scope > form');
      const settingsRoute=/^\/project\/[^/]+\/[^/]+\/settings\/?$/.test(loc.pathname);
      // The Settings header mounts before the form and project picker resolve.
      // Admit only this named header; never darken an unidentified loading page.
      if(enabled(family)&&settingsRoute&&settingsBanner&&!settingsForm&&unique(settingsBanner,'h1#genericHeaderId')) {
        boundaries.push([settingsBanner,family]);
        if(!surface(settingsBanner,'shell',[TRANSPARENT]))rejected.add(family);
        controls(settingsBanner);
        const strip=settingsBanner.firstElementChild;
        const picker=unique(settingsBanner,'[data-test-id="AgentBadgeDropdownButton"]');
        if(strip?.matches('div:empty')) {
          if(!surface(strip,'shell'))rejected.add(family);
        } else if(strip?.matches('div')&&picker&&strip.contains(picker)&&surface(strip,'shell')&&surface(picker.parentElement,'panel')) {
          text(picker.parentElement);all(picker,'.MuiSvgIcon-root').forEach(e=>text(e,'icon'));
        } else rejected.add(family);
      }
      if(enabled(family)&&settingsPage&&settingsForm&&settingsRoute&&
        unique(settingsBanner,'h1#genericHeaderId')&&unique(settingsForm,'#saveSettingsButton')) {
        boundaries.push([settingsPage,family]);
        if(!surface(settingsPage,'canvas',[TRANSPARENT])||!surface(settingsMain,'canvas',['rgb(249, 249, 254)'])||
          !surface(settingsBanner,'shell',[TRANSPARENT]))rejected.add(family);
        const sections=['generativeAISettings','audioPreviewSettings','knowledgeAISettings','translationSettings','currencySettings','nluSettings','liveAgentSettings'];
        if(sections.some(id=>!unique(settingsForm,'#'+id+'CollapsableSection')))rejected.add(family);
        controls(settingsPage);switches(settingsForm);sliders(settingsForm,['intentThreshold','yesNoIntentThreshold'],{intentThreshold:2});
        all(settingsPage,'.sr-only').forEach(e=>text(e));
        all(settingsForm,'.MuiAccordionSummary-content label.MuiInputLabel-root > span > div').forEach(e=>{if(!e.childElementCount)text(e);});
        // Native redaction summaries pair a labelled category with scope chips.
        all(settingsForm,'label.MuiInputLabel-root > span > div:has(> span > label.MuiInputLabel-root):has(> div > span > .MuiChip-outlinedPrimary)').forEach(summary=>{
          all(summary,':scope > span,:scope > div > span').forEach(e=>{if(!e.childElementCount)text(e,'secondary');});
        });
        all(settingsForm,'.MuiListSubheader-root').forEach(e=>text(e));
        // A configured speech provider adds a "Type: …" helper line whose text sits in a child span.
        all(settingsForm,'.MuiFormHelperText-root:not(.Mui-error) > span').forEach(e=>{if(!e.childElementCount)text(e);});
        all(settingsForm,'#generativeAISettingsCollapsableSection .MuiSvgIcon-colorPrimary').forEach(e=>text(e,'icon'));
        all(settingsForm,'#generativeAISettingsCollapsableSection .MuiAccordionSummary-content label.MuiInputLabel-root > span > .MuiGrid-container > .MuiGrid-item').forEach(e=>{if(!e.childElementCount)text(e);});
        all(settingsForm,'.MuiInputBase-root:has(> input[id^="field-generativeAISettings."]) > span:has(> img:only-child)').forEach(e=>{
          if(!surface(e,'native-media-mat',[TRANSPARENT]))rejected.add(family);
        });
        all(settingsForm,'button[type="button"]:not(.MuiButtonBase-root):not(:has(img))').forEach(e=>{
          const bg=paintValue(e,'backgroundColor'),ink=paintValue(e,'color'),image=paintValue(e,'backgroundImage');
          const primaryInk=ink==='rgb(255, 255, 255)',dark='rgb(6, 28, 76)';
          const rim=primaryInk?[...LINK,dark]:[...LINK,dark,'rgb(227, 233, 248)'];
          if(paintValue(e,'boxShadow')!=='none'||getComputedStyle(e).opacity!=='1'||
            ['borderTopColor','borderRightColor','borderBottomColor','borderLeftColor'].some(p=>!rim.includes(paintValue(e,p)))||
            ['color','border','border-color','border-top-color','border-right-color','border-bottom-color','border-left-color'].some(p=>e.style.getPropertyPriority(p)))rejected.add(family);
          else if(primaryInk&&[...LINK,dark].includes(bg)&&
            (image==='none'||image==='radial-gradient(circle, rgba(0, 0, 0, 0) 1%, rgb(6, 28, 76) 1%)'))slot(e,'settings-primary-button');
          else if([...LINK,dark].includes(ink)&&image==='none'&&['rgb(255, 255, 255)','rgba(11, 54, 148, 0.04)','rgb(227, 233, 248)'].includes(bg)){
            slot(e,'settings-secondary-button');plan(e,'data-cg-text','accent');
            for(const svg of all(e,'svg.MuiSvgIcon-root')) {
              const path=unique(svg,':scope > path:only-child');
              if(!path||getComputedStyle(path).fill!=='rgb(11, 54, 148)'||getComputedStyle(path).stroke!=='none'||
                [svg,path].some(g=>g.style.getPropertyPriority('fill')||g.style.getPropertyPriority('color')))rejected.add(family);
              else {slot(svg,'settings-action-icon');slot(path,'settings-action-icon');}
            }
          }
          else rejected.add(family);
        });
        for(const badge of all(settingsForm,'.MuiChip-outlinedPrimary')) {
          const label=unique(badge,':scope > span.MuiChip-label');
          if(badge.childElementCount!==1||!label||label.childElementCount||paintValue(badge,'backgroundColor')!==TRANSPARENT||
            getComputedStyle(badge).backgroundImage!=='none'||paintValue(badge,'boxShadow')!=='none'||
            ['borderTopColor','borderRightColor','borderBottomColor','borderLeftColor'].some(p=>paintValue(badge,p)!=='rgb(11, 54, 148)')||
            ['border','border-color','border-top-color','border-right-color','border-bottom-color','border-left-color'].some(p=>badge.style.getPropertyPriority(p)))rejected.add(family);
          else {slot(badge,'settings-badge');text(label);}
        }
        all(settingsBanner,':scope > div:has([data-test-id="AgentBadgeDropdownButton"])').forEach(e=>{if(!surface(e,'shell'))rejected.add(family);});
        const picker=unique(settingsBanner,'[data-test-id="AgentBadgeDropdownButton"]');
          const pendingPicker=settingsBanner.firstElementChild;
          if(picker&&surface(picker.parentElement,'panel')){text(picker.parentElement);all(picker,'.MuiSvgIcon-root').forEach(e=>text(e,'icon'));}
          // The form can mount while the named header's picker is still empty.
          // Keep the same verified form contract; only this empty strip is pending.
          else if(!picker&&pendingPicker?.matches('div:empty')&&surface(pendingPicker,'shell')){}
          else rejected.add(family);
        const footer=unique(settingsForm,':scope > div:has(> div > #saveSettingsButton)');
        if(!surface(footer,'panel',['rgb(249, 249, 254)']))rejected.add(family);
        all(settingsForm,'.MuiAccordion-root').forEach(e=>{
          if(paintValue(e,'boxShadow')!=='none'||paintValue(e,'backgroundColor','::before')!=='rgba(0, 0, 0, 0.12)')rejected.add(family);
          else slot(e,'settings-accordion');
        });
        all(settingsForm,'.MuiSelect-select[role="button"]').forEach(e=>{
          if(!surface(e,'field',['rgb(245, 245, 246)','rgb(236, 236, 237)']))rejected.add(family);
        });
        all(settingsForm,'.MuiSelect-select > .MuiListItemIcon-root:has(> img:only-child)').forEach(e=>{
          if(!surface(e,'native-media-mat',[TRANSPARENT]))rejected.add(family);
        });
        all(settingsForm,'.MuiSelect-icon').forEach(e=>text(e,'icon'));
        // Radio glyphs inherit one verified ink; the native dot/ring transforms
        // retain checked state, focus, shape and interaction semantics.
        for(const radio of all(settingsForm,'.MuiRadio-root')) {
          const input=unique(radio,'input[type="radio"]'),svgs=Array.from(radio.querySelectorAll('svg.MuiSvgIcon-root'));
          const checked=radio.classList.contains('Mui-checked'),ink=checked?'rgb(11, 54, 148)':'rgba(0, 0, 0, 0.54)';
          if(!input||input.checked!==checked||!safe(input)||!input.getAttribute('name')?.startsWith('piiDataRedactionSettings.')||
            svgs.length!==2||paintValue(radio,'color')!==ink||radio.style.getPropertyPriority('color')||
            svgs.some(svg=>svg.childElementCount!==1||!svg.firstElementChild.matches('path')||getComputedStyle(svg).fill!==ink||
              getComputedStyle(svg.firstElementChild).fill!==ink||getComputedStyle(svg.firstElementChild).stroke!=='none'||
              svg.style.getPropertyPriority('color')||svg.style.getPropertyPriority('fill')||svg.firstElementChild.style.getPropertyPriority('fill'))) {rejected.add(family);continue;}
          text(radio,'icon');
          for(const svg of svgs){slot(svg,'settings-radio-glyph');slot(svg.firstElementChild,'settings-radio-path');}
        }
        const save=unique(settingsForm,'#saveSettingsButton');
        if(save.classList.contains('Mui-disabled')!==save.disabled)rejected.add(family);
        if(save.disabled) {
          const label=unique(save,':scope > span.MuiButton-label');
          if(save.childElementCount!==1||!label||label.childElementCount||paintValue(save,'backgroundColor')!=='rgba(0, 0, 0, 0.12)'||
            paintValue(save,'color')!=='rgba(0, 0, 0, 0.26)'||paintValue(label,'color')!=='rgba(0, 0, 0, 0.26)'||
            paintValue(save,'boxShadow')!=='none'||getComputedStyle(save).backgroundImage!=='none'||getComputedStyle(save).opacity!=='1'||
            getComputedStyle(label).backgroundColor!==TRANSPARENT||getComputedStyle(label).opacity!=='1'||
            save.style.getPropertyPriority('color')||label.style.getPropertyPriority('color'))rejected.add(family);
          else {plan(save,'data-cg-slot','disabled-action');plan(label,'data-cg-slot','disabled-action-label');}
        }
        autocomplete(settingsForm);
        for(const trigger of all(settingsForm,'.MuiSelect-select[role="button"][aria-expanded="true"]')) {
          const input=unique(trigger.parentElement,':scope > input.MuiSelect-nativeInput[id]');
          const id=input?.id,label=id&&unique(settingsForm,'#'+CSS.escape('labelFor-'+id));
          const listbox=label&&unique(doc,'[role="listbox"][aria-labelledby="'+CSS.escape(label.id)+'"]');
          const paper=listbox?.parentElement,portal=paper?.closest('.MuiPopover-root');
          if(!input||!['audioPreviewProviderInput','translationProvider','field-yesNoLogic'].includes(id)||
            !label||trigger.id!=='field-'+id||trigger.getAttribute('aria-labelledby')!==label.id+' '+trigger.id||
            !paper?.matches('.MuiMenu-paper.MuiPopover-paper')||portal?.id!=='menuFor-'+id||
            paintValue(paper,'boxShadow')!=='rgba(0, 0, 0, 0.1) 0px 2px 10px 0px'||!surface(paper,'overlay')) {rejected.add(family);continue;}
          plan(portal,'data-cg-owner',family);
          boundaries.push([paper,family]);slot(paper,'popover-shadow');
          const options=Array.from(listbox.children);
          if(!options.length||options.filter(e=>e.getAttribute('aria-selected')==='true').length>1)rejected.add(family);
          for(const option of options) {
            if(!option.matches('li.MuiMenuItem-root[role="option"][data-value]')||!safe(option)||
              ![null,'false','true'].includes(option.getAttribute('aria-selected'))||
              option.classList.contains('Mui-selected')!==(option.getAttribute('aria-selected')==='true')||
              ![...TEXT,...LINK].includes(paintValue(option,'color'))||
              Array.from(option.children).some(e=>!e.matches('.MuiTouchRipple-root,.MuiListItemIcon-root:has(> img:only-child)'))||
              !surface(option,'settings-select-option',[TRANSPARENT,'rgba(0, 0, 0, 0.08)','rgba(61, 159, 255, 0.11)','rgb(227, 233, 248)'])) {rejected.add(family);continue;}
            text(option);
            all(option,':scope > .MuiListItemIcon-root').forEach(e=>{if(!surface(e,'native-media-mat',[TRANSPARENT]))rejected.add(family);});
          }
        }
      }
      family='menu';
      if(enabled(family)&&listPage)for(const menu of doc.querySelectorAll('.MuiPopover-paper > [role="menu"][aria-labelledby]')) {
        const label=menu.getAttribute('aria-labelledby');
        const trigger=label&&!/\s/.test(label)?unique(doc,'#'+CSS.escape(label)):null;
        if(!trigger?.matches('button[aria-haspopup="true"]')||!table.contains(trigger))continue;
        const paper=menu.parentElement;
        if(!surface(paper,'overlay'))continue;
        boundaries.push([paper,family]);
        all(menu,':scope > [role="menuitem"]').forEach(e=>{text(e);slot(e,'menu-item');});
        if(getComputedStyle(paper).boxShadow==='rgba(0, 0, 0, 0.1) 0px 2px 10px 0px')slot(paper,'popover-shadow');
      }
      const chart=unique(app,'#chartContent');
      family='chart';
      if(enabled(family)&&flowRoute==='chart'&&chart && chart.closest('#flowChartEditorTabContent')) {
        const paths=all(chart,':scope > svg > path');
        const connectorsSafe=paths.length>0&&paths.every(e=>{const g=getComputedStyle(e);return g.fill==='none'&&g.stroke==='rgb(234, 234, 234)';});
        if(connectorsSafe && surface(chart,'canvas',['rgb(249, 249, 254)'])) {
          boundaries.push([chart,family]);
          applied++;
          const page=chart.closest('.chart');if(page)surface(page,'canvas',['rgb(249, 249, 254)']);
          all(chart,':scope > svg > path').forEach(e=>{
            const g=getComputedStyle(e);
            if(g.fill==='none'&&g.stroke==='rgb(234, 234, 234)')slot(e,'connector');else partial=true;
          });
          all(chart,'.chartNode-normal').forEach(face=>{
            const wrapper=face.closest('.chartNode[role="button"]');
            if(!wrapper||!face.querySelector('[id^="nodeLabelFor-"]')) {partial=true;return;}
            if(surface(face,'node',['rgb(255, 255, 255)'])) {
              componentText(face);slot(wrapper,'node-owner');
              // Native preview text has .55 opacity. White composites to 5.08:1.
              all(face,'div:has(> [id^="nodeLabelFor-"]) + div > div > div').forEach(e=>text(e,'on-button'));
              all(face,':scope > div:first-child > div').forEach(e=>{
                if(getComputedStyle(e).boxShadow==='rgba(119, 150, 216, 0.2) 0px 0px 15px 0px')surface(e,'port',['rgb(255, 255, 255)']);
              });
            }
          });
          all(chart,'.chartNode-mini').forEach(face=>{
            if(surface(face,'mini',['rgb(255, 255, 255)'])) {
              componentText(face);
              all(face,'.MuiSvgIcon-root').forEach(mono);
              all(face,':scope > div').forEach(e=>surface(e,'mini-foot',['rgb(248, 248, 248)']));
            }
          });
          all(chart,'.ai-agent-node').forEach(face=>{
            const img=face.querySelector(':scope > img[alt="AI Agent Avatar"]');
            const wrapper=face.closest('.chartNode[role="button"]');
            const g=getComputedStyle(face);
            if(!img||!wrapper||g.backgroundImage!==AGENT_GRADIENT||g.boxShadow!==AGENT_SHADOW||
                !['rgb(229, 242, 255)','rgb(61, 159, 255)'].includes(g.borderTopColor)) {partial=true;return;}
            slot(face,'agent');slot(wrapper,'agent-owner');componentText(face);
            all(face,':scope > div > div:first-child > div:first-child').forEach(e=>text(e));
            if(getComputedStyle(img).boxShadow===AVATAR_SHADOW)slot(img,'avatar');
          });
          const chartPanel=chart.closest('#chart');
          all(chartPanel,':scope > div:has(> button[aria-label="Zoom Out"]), :scope > div:has(> button[aria-label="Search Nodes"])').forEach(toolbar=>{
            if(surface(toolbar,'toolbar',['rgba(248, 248, 248, 0.85)'])) {
              all(toolbar,':scope > button, :scope > p, button > .MuiSvgIcon-root').forEach(e=>text(e,'icon'));
            }
          });
          // The native history group wraps each icon button in a tooltip span.
          for(const toolbar of all(chartPanel,':scope > div:has(> span > button[aria-label="Undo"])')) {
            const buttons=Array.from(toolbar.querySelectorAll(':scope > span > button.MuiIconButton-root'));
            if(toolbar.children.length!==2||buttons.length!==2||
              buttons[0].getAttribute('aria-label')!=='Undo'||buttons[1].getAttribute('aria-label')!=='Redo'||
              !buttons.every(b=>!b.closest(PROTECTED)&&b.parentElement.children.length===1&&
                (b.disabled?paintValue(b,'color')==='rgba(0, 0, 0, 0.26)':[...TEXT,...SECONDARY].includes(paintValue(b,'color')))))continue;
            if(surface(toolbar,'toolbar',['rgba(248, 248, 248, 0.85)']))for(const button of buttons) {
              if(button.disabled)plan(button,'data-cg-text','muted');else text(button,'icon');
            }
          }
        }
      }
      const inspector=unique(app,'#editSidebarWrapper');
      family='inspector';
      const slotFillerInspector=flowRoute==='nlu'&&loc.pathname.endsWith('/nlu/slots-filler')&&
        inspector?.matches('[role="region"][data-test="EditSidebar"][aria-labelledby="editSidebarTitle"]')&&
        ['field-name','field-type','field-slot','field-contextKey'].every(id=>unique(inspector,'input#'+id));
      const newFlowInspector=listPage&&loc.pathname.endsWith('/flows')&&
        inspector?.matches('[role="region"][data-test="EditSidebar"][aria-labelledby="editSidebarTitle"]')&&
        unique(inspector,'input#field-newName')&&unique(inspector,'textarea#field-description')&&unique(inspector,'input#field-flowGenerationInput.MuiSelect-nativeInput');
      const newLlmInspector=listPage&&loc.pathname.endsWith('/large-language-models')&&
        inspector?.matches('[role="region"][data-test="EditSidebar"][aria-labelledby="editSidebarTitle"]')&&
        unique(inspector,'input#field-newName')&&unique(inspector,'textarea#field-description')&&
        unique(inspector,'input#selectFielProvider.MuiAutocomplete-input')&&unique(inspector,'input#selectFieldModel.MuiAutocomplete-input');
      const newLexiconInspector=listPage&&loc.pathname.endsWith('/lexicons')&&
        inspector?.matches('[role="region"][data-test="EditSidebar"][aria-labelledby="editSidebarTitle"]')&&
        unique(inspector,'input#field-newName')&&unique(inspector,'textarea#field-description')&&unique(inspector,'input#field-generateEntries[type="checkbox"].MuiSwitch-input');
      const newNluInspector=listPage&&loc.pathname.endsWith('/nlu-connectors')&&
        inspector?.matches('[role="region"][data-test="EditSidebar"][aria-labelledby="editSidebarTitle"]')&&
        unique(inspector,'input#field-newName[type="text"]')&&unique(inspector,'[role="radiogroup"][aria-labelledby="tileSelectLabel"]')&&
        ['cognigy','code','alexa','dialogflow','lex','luis','watson'].every(id=>unique(inspector,'input#'+id+'[type="radio"]'));
      const handoverTypes=resource==='handover-providers'&&inspector&&unique(inspector,'[role="radiogroup"][aria-labelledby="tileSelectLabel"]');
      const newHandoverInspector=listPage&&loc.pathname.endsWith('/handover-providers')&&
        inspector?.matches('[role="region"][data-test="EditSidebar"][aria-labelledby="editSidebarTitle"]')&&
        unique(inspector,'input#field-name[type="text"][required]')&&handoverTypes&&
        handoverTypes.querySelectorAll('input[type="radio"]').length>0&&
        Array.from(handoverTypes.querySelectorAll('input[type="radio"]')).every(input=>
          /^[a-f0-9]{24}$/.test(input.id)&&input.getAttribute('aria-labelledby')===input.id+'-itemName'&&
          input.getAttribute('aria-describedby')===input.id+'-itemDescription'&&
          unique(handoverTypes,'[id="'+input.id+'-itemName"]')&&unique(handoverTypes,'[id="'+input.id+'-itemDescription"]'));
      const newSingleNameInspector=listPage&&['functions','playbooks'].includes(resource)&&
        inspector?.matches('[role="region"][data-test="EditSidebar"][aria-labelledby="editSidebarTitle"]')&&
        unique(inspector,'[data-test="EditSidebarContent"] input#field-newName[type="text"][required]')&&
        inspector.querySelectorAll('input,textarea,select').length===1&&
        unique(inspector,'[role="group"] > button[type="submit"]')&&unique(inspector,'[role="group"] > button[type="button"]');
      const newSnapshotInspector=listPage&&loc.pathname.endsWith('/snapshots')&&
        inspector?.matches('[role="region"][data-test="EditSidebar"][aria-labelledby="editSidebarTitle"]')&&
        unique(inspector,'input#field-newName[type="text"][required]')&&unique(inspector,'textarea#field-newDescription')&&
        !inspector.querySelector('select,input:not(#field-newName)')&&
        unique(inspector,'[role="group"] > button[type="submit"]')&&unique(inspector,'[role="group"] > button[type="button"]');
      const inspectorEligible=(flowRoute==='chart'||slotFillerInspector||newFlowInspector||newLlmInspector||newLexiconInspector||newNluInspector||newSingleNameInspector||newHandoverInspector||newSnapshotInspector)&&inspector?.matches('[role="region"]')&&inspector.querySelector('#editSidebarTitle');
      if(enabled(family)&&inspectorEligible && surface(inspector,'panel')) {
        boundaries.push([inspector,family]);
        if(slotFillerInspector||newFlowInspector||newLlmInspector||newLexiconInspector||newNluInspector||newSingleNameInspector||newHandoverInspector||newSnapshotInspector)workspaceComponents(inspector);else controls(inspector);
        if(newNluInspector||newHandoverInspector) {
          // Native provider artwork and yellow deprecation chips remain unchanged.
          for(const radio of all(inspector,'[role="radiogroup"] .MuiRadio-root')) {
            text(radio,'icon');
            const card=unique(radio,':scope > .MuiIconButton-label > div');
            if(!card){rejected.add(family);continue;}
            const border=paintValue(card,'borderTopColor');
            if(getComputedStyle(card).borderTopWidth!=='1px'||getComputedStyle(card).borderTopStyle!=='solid'||
              !['rgb(236, 236, 237)','rgb(11, 54, 148)'].includes(border)){rejected.add(family);continue;}
            slot(card,border==='rgb(11, 54, 148)'?'knowledge-selected-border':'knowledge-border');
            all(card,'span:has(> img:only-child)').forEach(e=>{if(e.childElementCount===1&&paintValue(e,'backgroundColor')===TRANSPARENT)slot(e,'native-media-mat');});
            all(card,'.MuiSvgIcon-root').forEach(e=>text(e,'icon'));
            const selectedGlyph=unique(card,':scope > svg.MuiSvgIcon-root.MuiSvgIcon-fontSizeSmall');
            if(selectedGlyph&&radio.classList.contains('Mui-checked'))surface(selectedGlyph,'panel');
          }
        }
        if(newLexiconInspector) {
          const generation=unique(inspector,'.MuiAccordion-root:has(input#field-generateEntries)');
          if(generation) {
            all(generation,'.MuiAccordionSummary-root label .MuiGrid-item').filter(e=>!e.childElementCount).forEach(e=>text(e));
            const label=unique(generation,'label.Mui-disabled[for="field-generateEntries"]');
            if(label)for(const e of [label,...label.querySelectorAll(':scope > span')])
              if(!e.closest(PROTECTED)&&paintValue(e,'color')==='rgba(0, 0, 0, 0.38)'&&!e.style.getPropertyPriority('color'))plan(e,'data-cg-text','secondary');
          }
        }
        if(newFlowInspector) {
          const disabled=unique(inspector,'.MuiAccordion-root.Mui-disabled:has(input#field-flowGenerationInput)');
          const select=disabled&&unique(disabled,'#field-field-flowGenerationInput.MuiSelect-root[aria-disabled="true"]');
          const neutral=[...TEXT,...SECONDARY,'rgba(0, 0, 0, 0.38)','rgba(0, 0, 0, 0.26)'];
          if(disabled&&select&&!disabled.closest(PROTECTED)&&getComputedStyle(disabled).backgroundImage==='none'&&paintValue(disabled,'backgroundColor')==='rgba(0, 0, 0, 0.12)'&&paintValue(select,'backgroundColor')==='rgb(245, 245, 246)'&&getComputedStyle(select).backgroundImage==='none') {
            plan(disabled,'data-cg-slot','panel');plan(select,'data-cg-slot','workspace-disabled-field');
            for(const e of disabled.querySelectorAll('.MuiFormLabel-root,.MuiFormLabel-root > span,.MuiGrid-item,.MuiSelect-root,.MuiSelect-icon,.MuiAccordionSummary-expandIcon .MuiSvgIcon-root'))
              if(!e.closest(PROTECTED)&&neutral.includes(paintValue(e,'color'))&&!e.style.getPropertyPriority('color'))plan(e,'data-cg-text','secondary');
          }
        }
        if(newFlowInspector||newLlmInspector||newLexiconInspector||newNluInspector||newSingleNameInspector||newHandoverInspector||newSnapshotInspector) {
          all(inspector,'[role="group"]:has(> button[type="submit"])').forEach(e=>{surface(e,'panel',[...LIGHT,TRANSPARENT]);all(e,'button[type="button"]').forEach(b=>{if(!b.childElementCount&&['rgb(11, 54, 148)','rgb(6, 28, 76)'].includes(paintValue(b,'color'))&&surface(b,'secondary-button',[...LIGHT,TRANSPARENT,'rgba(11, 54, 148, 0.04)']))plan(b,'data-cg-text','accent');else text(b);});});
        }
        applied++;text(inspector.querySelector('#editSidebarTitle'));
        // Native node-type subtitle has a plain direct span, unlike the title.
        // Give that observed leaf its own ink; do not infer descendant inheritance.
        all(inspector,'p#editSidebarSecondarySubtitle.MuiTypography-root > span').forEach(e=>{
          if(!e.childElementCount)text(e);
        });
        // Monaco mounts a plain centred loading label even in collapsed node
        // accordions. Qualify only its observed placeholder, never editor text.
        all(inspector,'.MuiAccordionDetails-root > div > .MuiGrid-root.MuiGrid-container.MuiGrid-direction-xs-column.MuiGrid-justify-content-xs-space-between > div > section > div').forEach(loader=>{
          if(!loader.childElementCount&&
            loader.style.display==='flex'&&loader.style.height==='100%'&&loader.style.width==='100%'&&
            loader.style.justifyContent==='center'&&loader.style.alignItems==='center'&&
            paintValue(loader,'backgroundColor')===TRANSPARENT&&getComputedStyle(loader).backgroundImage==='none')text(loader);
        });
        all(inspector,':scope > button.MuiIconButton-root').forEach(e=>{
          surface(e,'panel');
          // This native two-path sidebar chevron has literal blue fills.
          const svg=e.querySelector(':scope > .MuiIconButton-label > svg[viewBox="0 0 50 50"]');
          const paths=svg?Array.from(svg.querySelectorAll(':scope > path')):[];
          if(paths.length===2 && paths.every(p=>getComputedStyle(p).fill==='rgb(11, 54, 148)'&&getComputedStyle(p).stroke==='none'))paths.forEach(p=>slot(p,'mono-fill'));
        });
      }
      // Interaction panel: only the observed empty Chat, Info and Settings views.
      // Conversation/output and voice/simulation controls are separate native states.
      family='chat';
      const interaction=unique(doc,'aside#interactionPanel.open > #interactionPanelWrapper.RIGHT_PANEL');
      const interactionHead=interaction&&unique(interaction,':scope > [data-test="InteractionPanel"] > div:has(#chatTab)');
      if(enabled(family)&&interactionHead&&interaction.querySelector('#chatInfoTab')&&interaction.querySelector('#chatSettingsTab')&&surface(interaction,'panel')) {
        boundaries.push([interaction,family]);
        controls(interaction);
        all(interaction,'label.sr-only').forEach(e=>text(e));
        if(!surface(interactionHead,'shell'))rejected.add(family);
        if(getComputedStyle(interaction).boxShadow==='rgba(0, 0, 0, 0.1) 0px 0px 20px 0px')slot(interaction,'interaction-shadow');
        all(interactionHead,'.MuiFormControl-root:has(> .MuiInputBase-root > .MuiSelect-root)').forEach(e=>{
          if(!surface(e,'field'))rejected.add(family);
        });
        all(interaction,'.MuiSelect-icon').forEach(e=>text(e,'icon'));
        // The empty Snapshot select renders its "No Snapshot" placeholder in a child <i>.
        all(interactionHead,'.MuiSelect-select.MuiInputBase-input > i').forEach(e=>{if(!e.childElementCount)text(e);});
        all(interactionHead,'.MuiIconButton-label > svg ellipse').forEach(e=>{
          if(getComputedStyle(e).fill==='rgb(11, 54, 148)'&&getComputedStyle(e).stroke==='none')slot(e,'mono-fill');
        });
        const chat=unique(interaction,'#chatTabContent[role="tabpanel"][aria-labelledby="chatTab"]');
        const info=unique(interaction,'#chatInfoTabContent[role="tabpanel"][aria-labelledby="chatInfoTab"]');
        const settings=unique(interaction,'#chatSettingsTabContent[role="tabpanel"][aria-labelledby="chatSettingsTab"]');
        const paperShadow='rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px';
        if([chat,info,settings].filter(Boolean).length!==1)rejected.add(family);
        if(chat) {
          const transcript=unique(chat,':scope > #chatContainer');
          const composer=unique(chat,':scope > .MuiPaper-root');
          const input=unique(chat,'input#interactionPanelMessageTextField.MuiInputBase-input');
          // Voice mode swaps the text field for one Start Call control; the tab strip and paper are identical.
          const voice=composer&&!input&&unique(composer,'#voiceInputTab.Mui-selected')&&unique(composer,'button#startCallButton');
          const callArea=voice&&unique(composer,':scope > div:has(#startCallButton)');
          if(voice&&transcript&&!transcript.childElementCount&&callArea&&surface(transcript,'canvas')&&surface(composer,'panel')) {
            if(getComputedStyle(composer).boxShadow===paperShadow)slot(composer,'interaction-paper-shadow');
            if(!surface(callArea,'shell'))rejected.add(family);
            all(composer,'.MuiTab-root').forEach(e=>{
              if(surface(e,'input-mode',[TRANSPARENT,...LIGHT]))text(e,'icon');else rejected.add(family);
            });
          } else if(!transcript||transcript.childElementCount||!composer||!input||!surface(transcript,'canvas')||!surface(composer,'panel'))rejected.add(family);
          else {
            if(getComputedStyle(composer).boxShadow===paperShadow)slot(composer,'interaction-paper-shadow');
            const inputArea=unique(composer,':scope > div:has(#interactionPanelMessageTextField)');
            if(!surface(inputArea,'shell'))rejected.add(family);
            all(composer,'.MuiTab-root').forEach(e=>{
              if(surface(e,'input-mode',[TRANSPARENT,...LIGHT]))text(e,'icon');else rejected.add(family);
            });
            const send=unique(composer,'button.MuiFab-primary');
            if(send?.matches(':disabled.Mui-disabled')&&paintValue(send,'backgroundColor')==='rgba(0, 0, 0, 0.12)'&&paintValue(send,'color')==='rgba(0, 0, 0, 0.26)') {
              // Explicit disabled state: colour only; disabled semantics stay native.
              plan(send,'data-cg-slot','disabled-send');
            } else if(send&&safe(send)&&LINK.includes(paintValue(send,'backgroundColor')))slot(send,'primary');
            else rejected.add(family);
          }
        }
        if(info) {
          all(info,':scope > .MuiPaper-root, :scope > .MuiPaper-root > .MuiBottomNavigation-root').forEach(e=>{
            if(!surface(e,'panel'))rejected.add(family);
            if(getComputedStyle(e).boxShadow===paperShadow)slot(e,'interaction-paper-shadow');
          });
          all(info,'.MuiBottomNavigationAction-root[role="tab"]').forEach(e=>text(e,'icon'));
          // Monaco owns its own palette; theme only the surrounding native shell.
          all(info,':scope > [role="tabpanel"]').forEach(e=>{if(!surface(e,'panel'))rejected.add(family);});
        }
        if(settings) {
          all(settings,':scope > [role="group"] > .MuiTypography-root').forEach(e=>{
            if(getComputedStyle(e).color==='rgb(58, 57, 74)'&&getComputedStyle(e).opacity==='0.75')plan(e,'data-cg-text','text');
          });
          all(settings,'.MuiListItem-button').forEach(e=>{
            if(!surface(e,'settings-row',[TRANSPARENT,...LIGHT]))rejected.add(family);
          });
          all(settings,'.MuiSelect-root').forEach(e=>{
            if(!surface(e,'field',[TRANSPARENT,...LIGHT]))rejected.add(family);
          });
          all(settings,'.MuiDivider-root').forEach(e=>{
            if(getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0.12)')slot(e,'divider');
          });
          switches(settings);
        }
      }
      const globalMenu=unique(doc,'#complementaryApplicationMenu');
      family='global';
      if(enabled(family)&&globalMenu?.matches('[role="menubar"]')) for(const id of ['globalmenu_search','globalmenu_tasks','globalmenu_interactionpanel']) {
        const button=unique(globalMenu,'#'+id);
        if(button && surface(button,'global-button',['rgb(255, 255, 255)'])) {
          text(button,'icon');all(button,'.MuiSvgIcon-root').forEach(e=>{
            text(e,'icon');monoPaths(e,[...TEXT,...SECONDARY,...LINK,'none']);
          });
        }
      }
      if(enabled('global')&&globalMenu)for(const [hook,triggerHook] of [
        ['.MuiPopover-root [data-test-id="ProjectSwitcherPaper"]','[data-test-id="AgentBadgeDropdownButton"]'],
        ['.MuiPopover-root[data-test="SearchMenu"] [data-test="GlobalSearchInput"]','#globalmenu_search'],
        ['.MuiPopover-root[data-test="TaskMenu"] .MuiPopover-paper','#globalmenu_tasks']
      ]) {
        const hookNode=unique(doc,hook),trigger=unique(app,triggerHook)||unique(globalMenu,triggerHook);
        const paper=hookNode?.closest('.MuiPopover-paper'),portal=paper?.closest('.MuiPopover-root');
        if(!trigger||!paper||!portal)continue;
        boundaries.push([paper,family]);plan(portal,'data-cg-owner',family);
        if(!surface(paper,'overlay',[...LIGHT,TRANSPARENT])){rejected.add(family);continue;}
        workspaceComponents(paper);
        all(paper,':scope > div,li.MuiListItem-root').forEach(e=>{if(LIGHT.includes(paintValue(e,'backgroundColor')))surface(e,'panel');});
        all(paper,'a[role="button"],[role="option"]').forEach(e=>text(e));
      }
      // Narrow portal ownership: explicit controls relationship from a mapped field.
      family='inspector';
      for(const trigger of enabled(family)&&inspectorEligible?all(inspector,'[aria-controls][aria-expanded="true"],.MuiAutocomplete-root[role="combobox"][aria-owns][aria-expanded="true"]'):[]) {
        if(!boundaries.some(([root,owner])=>root===inspector&&owner===family)||rejected.has(family)) {rejected.add(family);continue;}
        const ids=(trigger.getAttribute('aria-controls')||trigger.getAttribute('aria-owns')||'').split(/\s+/).filter(Boolean);
        for(const id of ids) {
          const target=unique(doc,'#'+CSS.escape(id));
          if(!target?.matches('[role="listbox"]')){rejected.add(family);continue;}
          const paper=target.closest('.MuiAutocomplete-paper');
          const portal=paper?.closest('.MuiAutocomplete-popper');
          if(!paper||!portal||!surface(paper,'overlay',[...LIGHT,'rgb(245, 245, 246)'])){rejected.add(family);continue;}
          plan(portal,'data-cg-owner',family);boundaries.push([paper,family]);
          const separators=Array.from(target.children).filter(e=>slotFillerInspector&&e.matches('hr.MuiDivider-root')&&!e.childElementCount&&safe(e)&&paintValue(e,'backgroundColor')==='rgba(0, 0, 0, 0.12)');
          separators.forEach(e=>slot(e,'divider'));
          const options=Array.from(target.children).filter(e=>!separators.includes(e));
          if(!options.length||options.some(e=>!e.matches('[role="option"]')||!safe(e)))rejected.add(family);
          options.forEach(e=>{
            if(!surface(e,'overlay',[...LIGHT,TRANSPARENT,'rgb(245, 245, 246)','rgba(0, 0, 0, 0.04)']))rejected.add(family);
            slot(e,'option');text(e);componentText(e);
            const label=unique(e,':scope > div');
            const providerIcon=newLlmInspector&&(trigger.id==='selectFielProvider'||trigger.querySelector('#selectFielProvider'))&&label?.childElementCount===1&&
              unique(label,':scope > .MuiListItemIcon-root > div:only-child > :is(img,svg.MuiSvgIcon-root):only-child');
            const modelSuffix=newLlmInspector&&(trigger.id==='selectFieldModel'||trigger.querySelector('#selectFieldModel'))&&label?.childElementCount===1&&unique(label,':scope > span');
            const modelWarning=modelSuffix&&unique(modelSuffix,':scope > [role="button"][data-test="WarningIconToolTip"][aria-label="Warning"]');
            const modelLabel=modelSuffix&&(!modelSuffix.childElementCount||modelSuffix.childElementCount===1&&modelWarning&&modelWarning.childElementCount===2&&
              unique(modelWarning,':scope > svg.MuiSvgIcon-root[data-test="WarningIcon"]')&&unique(modelWarning,':scope > span.sr-only'));
            if(modelLabel&&modelWarning)text(unique(modelWarning,':scope > span.sr-only'));
            if(e.childElementCount===1&&label&&(!label.childElementCount||providerIcon||modelLabel)&&label.style.color==='inherit'&&
              label.style.display==='flex'&&label.style.alignItems==='center'&&label.style.width==='100%'&&
              paintValue(label,'backgroundColor')===TRANSPARENT&&getComputedStyle(label).backgroundImage==='none')text(label);
          });
        }
      }
      // The preview stays partial until chat/Insights and broader component states
      // and live execution/error combinations are accepted on the installed build.
      partial=true;
      }
    }
    // Each element can have several paint slots; keep token ownership explicit.
    const combined=new Map();
    for(const [el,attr,value,owner] of plans) {
      if(!combined.has(el))combined.set(el,new Map());
      const map=combined.get(el);map.set(attr,{owner,value:attr==='data-cg-slot'?[...new Set([...(map.get(attr)?.value||'').split(' ').filter(Boolean),value])].join(' '):value});
    }
    // Atomic text/surface dependency guard. Unknown transparent text or input
    // cannot inherit a dark surface. Inspect node types/lengths, never contents.
    const failed=new Set(rejected);
    const hasPaint=e=>combined.get(e)?.has('data-cg-slot');
    const textRange=doc.createRange();
    for(const [root,owner] of boundaries) {
      // Shared ancestry is immutable during this read-only pass. Resolve each
      // container once instead of walking it again for every text leaf.
      const ancestry=new WeakMap();
      const contextFor=node=>{
        if(ancestry.has(node))return ancestry.get(node);
        const parent=node!==root&&node.parentElement?contextFor(node.parentElement):{ink:false,island:false,opaque:true};
        const native=getComputedStyle(node),background=paintValue(node,'backgroundColor');
        const nativeSurface=node!==root&&!hasPaint(node)&&(background!==TRANSPARENT||native.backgroundImage!=='none');
        const mat=combined.get(node)?.get('data-cg-slot')?.value.split(' ').includes('native-media-mat');
        const result={ink:parent.ink||!!combined.get(node)?.has('data-cg-text'),island:parent.island||!!mat||nativeSurface,
          opaque:parent.opaque&&(!nativeSurface||/^rgb\(\d+, \d+, \d+\)$/.test(background))};
        ancestry.set(node,result);return result;
      };
      const candidates=[root,...root.querySelectorAll('*')];
      for(const e of candidates) {
        // Most descendants are structural wrappers or artwork. Avoid style and
        // layout reads for elements that cannot bear text or an input value.
        if(!e.matches('input,textarea')&&!Array.from(e.childNodes).some(n=>n.nodeType===3&&n.length))continue;
        if(!safe(e)||!e.getClientRects().length||e.matches('input[type="checkbox"],input[type="radio"],input[type="range"],input[type="hidden"]'))continue;
        if(e.matches('input.MuiSelect-nativeInput[aria-hidden="true"][tabindex="-1"]')&&paintValue(e,'opacity')==='0'&&getComputedStyle(e).pointerEvents==='none')continue;
        const ownText=Array.from(e.childNodes).some(n=>{
          if(n.nodeType!==3||!n.length)return false;
          // Formatted CMS HTML contains collapsed indentation. Measure whether
          // the text node has a rendered box without reading its contents.
          textRange.selectNodeContents(n);
          return Array.from(textRange.getClientRects()).some(r=>r.width>0&&r.height>0);
        });
        if(!ownText&&!e.matches('input,textarea'))continue;
        const paint=combined.get(e),slots=paint?.get('data-cg-slot')?.value.split(' ')||[];
        // Only explicitly qualified leaves own new ink. Equal native computed
        // colours do not establish CSS inheritance, including stylesheet ink.
        let mappedInk=paint?.has('data-cg-text')||slots.some(s=>['agent-option-label','dashboard-option-label'].includes(s))&&combined.get(e.parentElement)?.has('data-cg-text');
        const mappedFill=slots.includes('dashboard-tick')&&e.matches('text,tspan')&&!e.style.getPropertyPriority('fill');
        let covered=paintValue(e,'color')==='rgb(255, 255, 255)'||mappedInk&&!e.style.getPropertyPriority('color')||mappedFill;
        const context=contextFor(e);
        if(context.island)covered=context.opaque&&!mappedInk&&!context.ink&&!mappedFill;
        if(!covered) {
          failed.add(owner);break;
        }
      }
    }
    for(const [el,attrs] of combined) for(const [name,{value,owner}] of attrs) {
      if(name==='data-cg-slot'&&['background','background-color','background-image','box-shadow'].some(p=>el.style.getPropertyPriority(p)))failed.add(owner);
    }
    // Read transitions before any marker/style writes to avoid layout thrashing.
    const transitions=new Map();
    for(const [el,attrs] of combined)if([...attrs.values()].some(({owner})=>!failed.has(owner))) {
      const style=getComputedStyle(el);transitions.set(el,{transition:style.transition,transitionDuration:style.transitionDuration,transitionProperty:style.transitionProperty});
    }
    let committed=0;
    for(const [el,attrs] of combined) for(const [name,{value,owner}] of attrs)if(!failed.has(owner)){own(el,name,value,owner,transitions.get(el));committed++;}
    if(!failed.has('admin'))for(const [portal,link] of pendingAuditTooltipLinks)auditTooltipLinks.set(portal,link);
    if(!failed.has('agents'))for(const [portal,link] of pendingAgentTooltipLinks)agentTooltipLinks.set(portal,link);
    return {applied:committed>0,partial:partial||failed.size>0,failedFamilies:[...failed],retryFamilies:[...retryFamilies]};
  }
  globalThis.CogGraphiteAdapters=Object.freeze({qualify});
})();


