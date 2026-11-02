/* Renders Chrome Web Store graphics from the committed popup images into store-assets/ (kept out of git).
 * No dependencies: headless Chrome over the DevTools protocol, JPEG output so there is no alpha channel.
 * Usage: node scripts/store-assets.cjs [chrome-path]  (or set CHROME_PATH) */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {spawn}=require('node:child_process');
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
const assets={
  'screenshot-1-dark.jpg':shot('Dark mode for Cognigy.AI','Only colours change. Layout, controls and images stay the same.','docs/images/popup-ink.png'),
  'screenshot-2-light.jpg':shot('Follows your system by default','System, Dark or Original, per site. Enable any Cognigy site in one click.','docs/images/popup-paper.png'),
  'promo-small-440x280.jpg':page(440,280,`<div style="padding:34px 32px"><img src="${uri('extension/icons/icon-128.png')}" width=64 height=64 style="border-radius:16px">
<h1 style="font-size:26px;margin-top:22px">${name}</h1><p style="font-size:17px;margin-top:6px">Dark mode for Cognigy.AI</p></div>`)
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const json=url=>new Promise((ok,fail)=>http.get(url,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{ok(JSON.parse(d));}catch(e){fail(e);}});}).on('error',fail));
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const port=9300+Math.floor(Math.random()*500),profile=fs.mkdtempSync(path.join(os.tmpdir(),'cg-store-'));
  const proc=spawn(chrome,['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+profile,'--no-first-run','--hide-scrollbars','about:blank'],{stdio:'ignore'});
  try {
    let target;for(let i=0;i<50&&!target;i++){try{target=(await json(`http://127.0.0.1:${port}/json`)).find(t=>t.type==='page');}catch{}if(!target)await sleep(200);}
    if(!target)throw new Error('Chrome did not start: '+chrome);
    const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
    let id=0;const waits=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(waits.has(m.id)){waits.get(m.id)(m);waits.delete(m.id);}});
    const send=(method,params={})=>new Promise((ok,fail)=>{const n=++id;waits.set(n,m=>m.error?fail(new Error(method+': '+m.error.message)):ok(m.result));ws.send(JSON.stringify({id:n,method,params}));});
    const {frameId}=await send('Page.getFrameTree').then(r=>({frameId:r.frameTree.frame.id}));
    for(const [name,{w,h,html}] of Object.entries(assets)) {
      await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});
      await send('Page.setDocumentContent',{frameId,html});await send('Runtime.evaluate',{expression:'document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode())))',awaitPromise:true});
      const {data}=await send('Page.captureScreenshot',{format:'jpeg',quality:92,clip:{x:0,y:0,width:w,height:h,scale:1}});
      fs.writeFileSync(path.join(out,name),Buffer.from(data,'base64'));console.log('wrote store-assets/'+name,w+'x'+h);
    }
    ws.close();
  } finally {proc.kill();}
})().catch(e=>{console.error(e.message);process.exit(1);});
