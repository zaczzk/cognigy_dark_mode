/* Pure enrolment contract. No page content or account identifiers are stored. */
(() => {
  'use strict';
  const key='cogDepth.sites.v1', trial='https://trial.cognigy.ai';
  function address(input,prefix) {
    if(typeof input!=='string'||input.length>2048)throw new Error('Enter a site address.');
    const raw=input.trim();
    let url;try{url=new URL(raw.includes('://')?raw:'https://'+raw);}catch{throw new Error('Enter a valid site address.');}
    if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||/[\s*]/.test(raw)||url.hostname.endsWith('.'))throw new Error('Use an HTTPS hostname without credentials or a custom port.');
    if(['cognigy.com','www.cognigy.com'].includes(url.hostname))throw new Error('The public Cognigy website is excluded.');
    const match=/(?:^|\/)(projects|project|admincenter|insights)(?:\/|$)/.exec(url.pathname);
    const inferred=match?url.pathname.slice(0,match.index):url.pathname.replace(/\/$/,'');
    let basePath=prefix===undefined?inferred:prefix.trim();
    if(basePath==='/')basePath='';
    if(basePath&&!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(basePath))throw new Error('Use a simple application path, such as /cognigy.');
    if(basePath.length>160)throw new Error('The application path is too long.');
    return {origin:url.origin,basePath};
  }
  function valid(entry) {
    try {const p=address(entry.origin,entry.basePath);return p.origin===entry.origin&&p.basePath===entry.basePath&&typeof entry.enabled==='boolean'&&typeof entry.rev==='string'&&entry.rev.length<=80&&typeof entry.verified==='boolean';}catch{return false;}
  }
  function logicalPath(url,entry) {
    if(!valid(entry)||url.origin!==entry.origin)return null;
    const p=url.pathname||'/';
    if(entry.basePath&&p!==entry.basePath&&!p.startsWith(entry.basePath+'/'))return null;
    const rest=p.slice(entry.basePath.length)||'/';
    return /^\/(projects|project|admincenter|insights)(?:\/|$)/.test(rest)?rest:null;
  }
  const siteId=origin=>origin===trial?'trial':origin;
  const preferenceKey=origin=>'cogDepth.v1.'+siteId(origin);
  const pattern=origin=>origin+'/*';
  // Regional tenants (cognigy-au1, cognigy-eu2, ...) share one Chrome grant so a new region needs no new prompt. Scripts still register per enrolled origin.
  const regional=origin=>{try{return /^cognigy-[a-z0-9]{2,12}\.nicecxone\.com$/.test(new URL(origin).hostname);}catch{return false;}};
  const grant=origin=>regional(origin)?'https://*.nicecxone.com/*':pattern(origin);
  const registrationId=origin=>'cg-'+encodeURIComponent(origin);
  const api=Object.freeze({key,trial,address,valid,logicalPath,siteId,preferenceKey,pattern,regional,grant,registrationId});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else globalThis.CogGraphiteSites=api;
})();
