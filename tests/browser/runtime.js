/* Fixture only: no browser extension APIs or account connections. */
(() => {
  let stored={mode:'native'},receiver;
  const listeners=[];
  const qualification=[];const qualify=CogGraphiteAdapters.qualify;globalThis.CogGraphiteAdapters=Object.freeze({qualify:(...args)=>{const start=performance.now();try{return qualify(...args);}finally{qualification.push(performance.now()-start);}}});
  const site=CogGraphiteCore.sites[document.documentElement.dataset.fixtureOrigin||'https://trial.cognigy.ai'];
  const key=CogGraphiteCore.key(site);
  const chrome={
    storage:{local:{get:async()=>({[key]:stored})},onChanged:{addListener:fn=>listeners.push(fn)}},
    runtime:{id:'local-composition-double',onMessage:{addListener:fn=>receiver=fn}}
  };
  const location={origin:document.documentElement.dataset.fixtureOrigin||'https://trial.cognigy.ai',pathname:document.documentElement.dataset.fixturePath||'/project/a/b/flow/f/chart'};
  const navigation=new EventTarget();
  window.FixtureRuntime={chrome,location,navigation,qualification,
    mode(mode){stored={mode};listeners.forEach(fn=>fn({[key]:{newValue:stored}},'local'));},
    status(){return new Promise(resolve=>receiver({type:'GET_STATUS',requestId:1},{id:chrome.runtime.id},resolve));},
    route(path){navigation.dispatchEvent(new Event('navigate'));location.pathname=path;navigation.dispatchEvent(new Event('navigatesuccess'));}
  };
})();
