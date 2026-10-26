/* Local measurement only. Wraps the real adapter; never packaged. */
(() => {
  const adapter=CogGraphiteAdapters, calls=[];
  window.CogGraphiteAdapters=Object.freeze({qualify(...args){
    const started=performance.now(),activation=document.documentElement.getAttribute('data-cg-palette');
    let result;
    try{return result=adapter.qualify(...args);}finally{calls.push({ms:performance.now()-started,activation,families:args[3]?[...args[3]]:null,retryFamilies:result?.retryFamilies,failedFamilies:result?.failedFamilies});}
  }});
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const settled=async()=>{await document.fonts.ready;await sleep(650);};
  const summarize=values=>{
    const sorted=[...values].sort((a,b)=>a-b);
    const middle=Math.floor(sorted.length/2);
    const median=sorted.length?(sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2):0;
    return {count:values.length,medianMs:median,maxMs:sorted.at(-1)||0,totalMs:values.reduce((a,b)=>a+b,0)};
  };
  addEventListener('DOMContentLoaded',()=>{
    const button=document.createElement('button');button.id='measure-performance';button.textContent='Measure theme cost';
    const output=document.createElement('output');output.id='performance-report';output.textContent='Ready';
    const controls=document.querySelector('#fixture-controls');controls.append(button,output);
    button.addEventListener('click',async()=>{
      button.disabled=true;
      const started=performance.now(),visibilityStart=document.visibilityState;
      let frameCount=0,frameId;
      const countFrame=()=>{frameCount++;frameId=requestAnimationFrame(countFrame);};
      frameId=requestAnimationFrame(countFrame);
      try {
        const rt=FixtureRuntime;rt.mode('native');await settled();
        const nativeStart=calls.length;await sleep(1500);const nativeIdleCalls=calls.length-nativeStart;
        const darkBatches=[];
        for(let sample=0;sample<5;sample++) {
          const before=calls.length;rt.mode('dark');await settled();
          darkBatches.push(calls.slice(before));rt.mode('native');await settled();
        }
        rt.mode('dark');await settled();const idleStart=calls.length;await sleep(2000);const darkIdleCalls=calls.length-idleStart,idleDetails=calls.slice(idleStart);
        const beforeShow=calls.length;dispatchEvent(new PageTransitionEvent('pageshow',{persisted:false}));await sleep(100);
        const normalPageshowCalls=calls.length-beforeShow;
        const inspector=document.querySelector('#editSidebarWrapper'),beforeMutation=calls.length;
        const repaintFrames=[];let sampleId,sampling=true;
        const sample=()=>{if(!sampling)return;if(inspector){const s=getComputedStyle(inspector);repaintFrames.push({bg:s.backgroundColor,painted:inspector.hasAttribute('data-cg-slot'),palette:document.documentElement.hasAttribute('data-cg-palette')});}sampleId=requestAnimationFrame(sample);};
        sampleId=requestAnimationFrame(sample);
        if(inspector){inspector.classList.add('performance-probe');await settled();inspector.classList.remove('performance-probe');await settled();}
        sampling=false;cancelAnimationFrame(sampleId);
        const mutationCalls=calls.slice(beforeMutation);
        output.textContent=JSON.stringify({boundary:'Captured native DOM, actual controller/adapter; Chrome/route doubles, vendor scripts inactive. Not hosted load performance.',
          elapsedMs:performance.now()-started,visibilityStart,visibilityEnd:document.visibilityState,frameCount,trace:window.FixtureRetryTrace,
          viewport:[innerWidth,innerHeight],elements:document.querySelectorAll('*').length,nativeIdleMs:1500,nativeIdleCalls,darkIdleMs:2000,darkIdleCalls,idleDetails,normalPageshowCalls,
          coldAndWarmQualification:summarize(darkBatches.flat().map(c=>c.ms)),fullPassMs:darkBatches.map(batch=>batch.filter(c=>!c.families).map(c=>c.ms)),darkBatches,
          mutationQualification:summarize(mutationCalls.map(c=>c.ms)),mutationCalls,mutationActivationLoss:mutationCalls.filter(c=>!c.activation).length,
          repaintFrames:repaintFrames.length,unpaintedFrames:repaintFrames.filter(f=>!f.painted||!f.palette).length,observedBackgrounds:[...new Set(repaintFrames.map(f=>f.bg))],
          painted:document.querySelectorAll('[data-cg-slot],[data-cg-text],[data-cg-owner]').length,status:await rt.status()});
      }catch(error){output.textContent=JSON.stringify({error:String(error)});}finally{cancelAnimationFrame(frameId);button.disabled=false;}
    });
  });
})();
