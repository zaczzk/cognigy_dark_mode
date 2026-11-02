/* Canvas only for the entry routes that redirect into the app. Must not mark the bundle as preloaded. */
(() => {
  if(window!==window.top)return;
  const root=document.documentElement;
  if(root&&!root.hasAttribute('data-cg-startup'))root.setAttribute('data-cg-startup','system');
})();
