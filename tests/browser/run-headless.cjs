/* Runs the generated contract pages in headless Chrome over the DevTools protocol.
 * No dependencies: Node 22 http + global WebSocket. Build first with build.cjs.
 * Usage: node tests/browser/run-headless.cjs [chrome-path]  (or set CHROME_PATH) */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const pages=['tests/browser/contracts.generated.html','tests/browser/workspace-contracts.generated.html'];
const chrome=process.argv[2]||process.env.CHROME_PATH||{
  win32:'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
}[process.platform]||'google-chrome';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

for(const page of pages)if(!fs.existsSync(path.join(root,page)))throw new Error(page+' is missing; run node tests/browser/build.cjs first');

const server=http.createServer((req,res)=>{
  const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname));
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end();}
  res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});

async function main() {
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cg-contracts-'));
  const browser=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1400,1000','about:blank'],{stdio:'ignore'});
  let failed=0;
  try {
    const portFile=path.join(profile,'DevToolsActivePort');
    for(let i=0;i<100&&!fs.existsSync(portFile);i++)await sleep(100);
    const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
    const target=(await (await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(t=>t.type==='page');
    const ws=new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
    let id=0;const pending=new Map(),errors=[];
    ws.onmessage=({data})=>{
      const msg=JSON.parse(data);
      if(msg.id&&pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}
      if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    };
    const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
    const evaluate=async expression=>(await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true})).result?.result?.value;
    await send('Runtime.enable');await send('Page.enable');
    for(const page of pages) {
      errors.length=0;
      await send('Page.navigate',{url:origin+'/'+page});
      for(let i=0;i<100&&await evaluate('document.readyState')!=='complete';i++)await sleep(100);
      await evaluate('document.querySelector("#run").click()');
      let report=null;
      for(let i=0;i<600&&!report;i++){await sleep(100);report=await evaluate('(()=>{try{const r=JSON.parse(document.querySelector("#results").textContent);return typeof r.passed==="number"?r:null;}catch{return null;}})()');}
      if(!report){failed++;console.log('FAIL '+page+': no report within 60s');}
      else {
        const bad=report.results.filter(r=>!r.pass);failed+=bad.length;
        console.log((bad.length?'FAIL ':'PASS ')+page+': '+report.passed+'/'+report.total);
        for(const r of bad)console.log('  - '+r.name+(r.error?': '+r.error:''));
      }
      for(const e of errors)console.log('  page error: '+e);
    }
    ws.close();
  } finally {
    browser.kill();server.close();
    await sleep(300);try{fs.rmSync(profile,{recursive:true,force:true});}catch{}
  }
  process.exitCode=failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;server.close();});
