/* Renders the README popup images (docs/images/popup-*.png) from the real popup UI with synthetic fixture
 * sites, then the Chrome Web Store graphics into store-assets/ (kept out of git).
 * No dependencies: headless Chrome over the DevTools protocol. Store graphics are JPEG, so there is no alpha channel.
 * Usage: node scripts/store-assets.cjs [chrome-path]  (or set CHROME_PATH) */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'store-assets');
const name=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8')).name;
const chrome=process.argv[2]||process.env.CHROME_PATH||{
  win32:'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
}[process.platform]||'google-chrome';
const uri=file=>'data:image/png;base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
const font=weight=>`@font-face{font-family:V;font-weight:${weight};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(root,'extension/fonts/be-vietnam-pro-'+weight+'.woff2')).toString('base64')})}`;
const base=`${font(400)}${font(600)}*{margin:0;box-sizing:border-box}body{font-family:V,sans-serif;color:#E6EAF0;background:radial-gradient(120% 90% at 20% 0%,#25305a 0%,#15181E 55%,#0d0f14 100%);overflow:hidden}
h1{font-weight:600;letter-spacing:-.02em}p{color:#AEB7C6}.mark{display:flex;align-items:center;gap:14px}.mark img{border-radius:14px}`;
const page=(w,h,body)=>({w,h,html:`<!doctype html><meta charset=utf-8><style>${base}body{width:${w}px;height:${h}px}</style>${body}`});
const shot=(title,sub,image)=>page(1280,800,`<div style="padding:56px 64px 0"><div class=mark><img src="${uri('extension/icons/icon-128.png')}" width=44 height=44><span style="font-size:22px;font-weight:600">${name}</span></div>
<h1 style="font-size:46px;margin-top:28px">${title}</h1><p style="font-size:22px;margin-top:10px">${sub}</p></div>
<img src="${uri(image)}" style="position:absolute;left:140px;bottom:36px;width:1000px;border-radius:18px;box-shadow:0 20px 60px #0008">`);
const store=()=>({
  'screenshot-1-dark.jpg':shot('Dark mode for Cognigy.AI','Only colours change. Layout, controls and images stay the same.','docs/images/popup-ink.png'),
  'screenshot-2-light.jpg':shot('Follows your system by default','System, Dark or Original, per site. Enable any Cognigy site in one click.','docs/images/popup-paper.png'),
  'promo-small-440x280.jpg':page(440,280,`<div style="padding:34px 32px"><img src="${uri('extension/icons/icon-128.png')}" width=64 height=64 style="border-radius:16px">
<h1 style="font-size:26px;margin-top:22px">${name}</h1><p style="font-size:17px;margin-top:6px">Dark mode for Cognigy.AI</p></div>`)
});
// Three popup states: an enabled site in Dark, an unsaved regional site, and the saved list with its suggestion card.
const regional='https://cognigy-au1.nicecxone.com';
const states=[{query:''},{query:'?host='+encodeURIComponent(regional)},{query:'?new&host='+encodeURIComponent(regional),saved:true}];
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const json=url=>new Promise((ok,fail)=>http.get(url,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{ok(JSON.parse(d));}catch(e){fail(e);}});}).on('error',fail));
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  execFileSync(process.execPath,[path.join(root,'tests/browser/build-site-manager.cjs')],{stdio:'ignore'});
  const server=http.createServer((req,res)=>{
    const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));
    if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const port=9300+Math.floor(Math.random()*500),profile=fs.mkdtempSync(path.join(os.tmpdir(),'cg-store-'));
  const proc=spawn(chrome,['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--hide-scrollbars','about:blank'],{stdio:'ignore'});
  try {
    let target;for(let i=0;i<50&&!target;i++){try{target=(await json(`http://127.0.0.1:${port}/json`)).find(t=>t.type==='page');}catch{}if(!target)await sleep(200);}
    if(!target)throw new Error('Chrome did not start: '+chrome);
    const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
    let id=0;const waits=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(waits.has(m.id)){waits.get(m.id)(m);waits.delete(m.id);}});
    const send=(method,params={})=>new Promise((ok,fail)=>{const n=++id;waits.set(n,m=>m.error?fail(new Error(method+': '+m.error.message)):ok(m.result));ws.send(JSON.stringify({id:n,method,params}));});
    const evaluate=async expression=>(await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result.value;
    await send('Page.enable');
    for(const [theme,scheme] of [['ink','dark'],['paper','light']]) {
      await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:scheme}]});
      await send('Emulation.setDeviceMetricsOverride',{width:380,height:900,deviceScaleFactor:2,mobile:false});
      const panels=[];
      for(const state of states) {
        await send('Page.navigate',{url:origin+'/tests/browser/site-manager-preview.html'+state.query});await sleep(900);
        if(state.saved){await evaluate(`document.querySelector('#view-saved').click()`);await sleep(300);}
        await evaluate('document.fonts.ready');
        const height=await evaluate('Math.ceil(document.body.getBoundingClientRect().height)');
        const {data}=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:380,height,scale:1}});
        panels.push({data,height});
      }
      const bg=scheme==='dark'?'#0b0c12':'#e7e5df',h=640;
      await send('Emulation.setDeviceMetricsOverride',{width:1252,height:h,deviceScaleFactor:2,mobile:false});
      await send('Page.navigate',{url:'about:blank'});await sleep(200);
      const {frameTree}=await send('Page.getFrameTree');
      await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html:`<!doctype html><style>*{margin:0}body{width:1252px;height:${h}px;background:${bg};display:flex;gap:30px;padding:26px 31px;box-sizing:border-box;align-items:flex-start}img{width:380px;border-radius:14px;box-shadow:0 12px 40px #0005}</style>`+panels.map(p=>`<img src="data:image/png;base64,${p.data}">`).join('')});
      await evaluate('Promise.all([...document.images].map(i=>i.decode()))');
      const {data}=await send('Page.captureScreenshot',{format:'png',clip:{x:0,y:0,width:1252,height:h,scale:1}});
      fs.writeFileSync(path.join(root,'docs/images/popup-'+theme+'.png'),Buffer.from(data,'base64'));console.log('wrote docs/images/popup-'+theme+'.png');
    }
    await send('Emulation.setEmulatedMedia',{features:[]});
    const {frameTree}=await send('Page.getFrameTree');
    for(const [file,{w,h,html}] of Object.entries(store())) {
      await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
      await send('Page.setDocumentContent',{frameId:frameTree.frame.id,html});await evaluate('document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode())))');
      const {data}=await send('Page.captureScreenshot',{format:'jpeg',quality:92,clip:{x:0,y:0,width:w,height:h,scale:1}});
      fs.writeFileSync(path.join(out,file),Buffer.from(data,'base64'));console.log('wrote store-assets/'+file,w+'x'+h);
    }
    ws.close();
  } finally {proc.kill();server.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
