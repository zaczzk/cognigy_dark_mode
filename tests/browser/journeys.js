(() => {
  const runtime=FixtureRuntime,report=document.querySelector('#compose-report');
  const frame=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  const settle=async()=>{
    await document.fonts.ready;await frame();await frame();
    await Promise.race([Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))),new Promise(r=>setTimeout(r,3000))]);
    await new Promise(r=>setTimeout(r,350));await frame();
  };
  const snapshot=()=>new Map([...document.querySelectorAll('#app-container *,header *, .body-container-wrapper *,.footer-container-wrapper *,.MuiAutocomplete-popper *,.MuiPopover-root *,.MuiDialog-root *')].map(e=>{
    const g=getComputedStyle(e),r=e.getBoundingClientRect();
    return [e,JSON.stringify([r.x,r.y,r.width,r.height,g.font,g.borderRadius,g.transform,g.opacity,g.filter,g.outlineWidth,g.outlineStyle,g.outlineOffset,g.boxShadow.replace(/rgba?\([^)]+\)/g,'colour'),e.tagName==='IMG'?[e.getAttribute('src'),e.getAttribute('srcset'),e.currentSrc,g.objectFit,g.objectPosition]:null])];
  }));
  const paint=()=>document.querySelectorAll('[data-cg-slot],[data-cg-text],[data-cg-owner]').length;
  document.querySelector('#compose-dark')?.addEventListener('click',async()=>{runtime.mode('dark');await settle();report.textContent=JSON.stringify({paint:paint(),status:await runtime.status()});});
  document.querySelector('#compose-native')?.addEventListener('click',async()=>{runtime.mode('native');await settle();report.textContent=JSON.stringify({paint:paint(),status:await runtime.status()});});
  document.querySelector('#compose-check')?.addEventListener('click',async()=>{
    runtime.mode('native');await settle();const animated=document.getAnimations().filter(a=>a.effect?.getTiming().iterations===Infinity);for(const a of animated){a.pause();a.currentTime=0;}await frame();const before=snapshot();runtime.mode('dark');await settle();
    const status=await runtime.status();await settle();
    const after=snapshot(),changed=[...before].filter(([e,v])=>after.get(e)!==v),differences=changed.length;
    const props=['x','y','width','height','font','radius','transform','opacity','filter','outlineWidth','outlineStyle','outlineOffset','shadowGeometry','media'];
    const detail=changed.slice(0,6).map(([e,v])=>({tag:e.tagName,changes:JSON.parse(v).flatMap((a,i)=>JSON.stringify(a)!==JSON.stringify(JSON.parse(after.get(e)||'[]')[i])?[{property:props[i],before:i===13?'media':a,after:i===13?'media':JSON.parse(after.get(e)||'[]')[i]}]:[])}));
    const result={nativeInfiniteAnimationsFixedForComparison:animated.length,qualificationMs:[...runtime.qualification],boundary:'real controller+adapter+DOM; Chrome and route doubles',paint:paint(),geometryMediaDifferences:differences,detail,removedElements:[...before.keys()].filter(e=>!after.has(e)).length,addedElements:[...after.keys()].filter(e=>!before.has(e)).length,status};
    runtime.mode('native');await settle();const restored=snapshot();result.restorePaint=paint();result.restoreDifferences=[...before].filter(([e,v])=>restored.get(e)!==v).length;
    runtime.mode('dark');await settle();report.textContent=JSON.stringify(result);report.dataset.complete='true';
  });
})();
