/* Local UI fixture only: simulated Chrome API, synthetic sites, no host grants. */
(() => {
  const listeners=[];let records=[{origin:'https://trial.cognigy.ai',basePath:'',enabled:true,verified:true,rev:'fixture-1',permission:true},{origin:'https://studio.example.com',basePath:'/cognigy',enabled:true,verified:false,rev:'fixture-2',permission:true}];
  const data={'cogDepth.v1.trial':{mode:'dark'}};
  const emit=changes=>listeners.forEach(fn=>fn(changes,'local'));
  const params=new URLSearchParams(location.search),deny=params.has('denied'),fresh=params.has('new');
  records[0].permission=CogGraphiteFixtureHostPermissions.includes('https://trial.cognigy.ai/*')&&!params.has('withheld');
  if(fresh)records=records.filter(e=>e.origin!=='https://trial.cognigy.ai');
  globalThis.chrome={storage:{onChanged:{addListener:fn=>listeners.push(fn)},local:{async get(keys){return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]]));},async set(values){Object.assign(data,values);emit(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])));}}},
    permissions:{async request(){return !deny;}},scripting:{async executeScript(){return [{documentId:'fixture-document',result:{origin:'https://trial.cognigy.ai',path:'/project/local/local/flow/local/chart',recognized:true}}];}},
    tabs:{async query(){return [{id:1}];},async sendMessage(tab,msg){if(params.has('disconnected'))throw new Error('No receiver');if(msg.type==='CG_ENSURE')return {ok:true};const mode=data['cogDepth.v1.trial']?.mode||'system';return {...CogGraphiteBuild,requestId:msg.requestId,siteId:'trial',savedMode:mode,appliedMode:mode==='native'?'native':'dark',status:mode==='native'?'original':mode==='system'?'system-dark':'partial'};}},
    runtime:{async sendMessage(message){if(message.type==='SYNC_STARTUP')return {ok:true};if(message.type==='SITES_LIST')return {ok:true,sites:structuredClone(records)};
      if(message.type==='SITE_ENABLE')records=[...records.filter(e=>e.origin!==message.origin),{origin:message.origin,basePath:message.basePath,enabled:true,verified:false,permission:true,rev:'fixture-'+Date.now()}];
      else if(message.type==='SITE_PAUSE')records=records.map(e=>e.origin===message.origin?{...e,enabled:false}:e);
      else if(message.type==='SITE_REMOVE')records=records.filter(e=>e.origin!==message.origin);
      emit({'cogDepth.sites.v1':{newValue:records}});return {ok:true};}}
  };
})();
