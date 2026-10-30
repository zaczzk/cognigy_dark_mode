/* Shared pure settings contract. No page data enters storage or messages. */
(() => {
  const sites = Object.freeze({
    'https://trial.cognigy.ai': 'trial'
  });
  const hosts = Object.freeze({trial:'trial.cognigy.ai'});
  const validMode = mode => ['native','dark','system'].includes(mode);
  // A new site follows the browser preference. Existing overrides survive
  // updates; malformed stored records still fail back to the native page.
  const modeOf = value => value === undefined ? 'system' : value && Object.keys(value).length === 1 && validMode(value.mode) ? value.mode : 'native';
  const requestedDark = (mode, osDark) => mode === 'dark' || (mode === 'system' && osDark);
  // One choice for every site, kept apart from the per-site mode records.
  const contrastKey = 'cogDepth.contrast.v1';
  const contrastOf = value => value && Object.keys(value).length === 1 && value.level === 'more' ? 'more' : 'standard';
  const routeFamily=(site,path)=>{
    if(site!=='trial')return 'unmapped';
    if(/^\/projects\/?$/.test(path))return 'project-index';
    if(/^\/admincenter(?:\/|$)/.test(path))return 'admin';
    if(/^\/insights(?:\/|$)/.test(path))return 'insights';
    if(/^\/project\/[^/]+\/[^/]+\/?$/.test(path))return 'dashboard';
    const flow=/^\/project\/[^/]+\/[^/]+\/flow\/[^/]+\/(chart|nlu|settings)(?:\/[^/]+)?\/?$/.exec(path);
    if(flow)return 'flow-'+flow[1];
    if(/^\/project\/[^/]+\/[^/]+\/goal\/new\/?$/.test(path))return 'goal';
    const area=/^\/project\/[^/]+\/[^/]+\/([^/]+)/.exec(path)?.[1];
    return ['flows','knowledge','ai-agents','endpoints','endpoint','snapshots','large-language-models','playbooks','settings','lexicons','goals','connections','nlu-connectors','functions','handover-providers','locales','tokens','members','contacts','logs','trainer','extensions','packaging','simulator'].includes(area)?area:'unmapped';
  };
  const api = Object.freeze({sites,hosts,validMode,modeOf,requestedDark,contrastKey,contrastOf,routeFamily,key:site=>'cogDepth.v1.'+site});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.CogGraphiteCore = api;
})();
