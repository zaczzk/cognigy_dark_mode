/* CSS follows the browser preference without waiting for the service worker. */
(() => {
  if(window!==window.top)return;
  globalThis.CogGraphitePreloaded=true;
  const root=document.documentElement;
  if(root&&!root.hasAttribute('data-cg-startup'))root.setAttribute('data-cg-startup','system');
})();
