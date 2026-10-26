/* Registered only on approved application paths. No page traversal. */
(() => {
  if(window!==window.top)return;
  globalThis.CogGraphitePreloaded=true;
  const root=document.documentElement;
  if(root&&!root.hasAttribute('data-cg-startup'))root.setAttribute('data-cg-startup','dark');
})();
