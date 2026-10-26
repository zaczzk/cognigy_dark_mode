/* Restore capture-only scroll positions, which HTML does not serialize. No product paint or DOM geometry changes. */
(() => {
  const chart=document.querySelector('#chartEditor');
  if(chart){chart.scrollLeft=1397;chart.scrollTop=938;}
  // Captures do not serialize scroll positions. Reconstruct the fixture view
  // from the captured bottom-placed portal and its native anchor, or the named
  // section. This moves the local scroll position only; no extension geometry.
  const portal=document.querySelector('.MuiAutocomplete-popper');
  const popupInput=document.querySelector('[role="combobox"][aria-expanded="true"] input[aria-controls]');
  if(portal&&popupInput&&portal.getAttribute('x-placement')?.startsWith('bottom')) {
    const anchor=popupInput.closest('.MuiInputBase-root');let scroll=anchor.parentElement;
    while(scroll&&!(scroll.scrollHeight>scroll.clientHeight&&['auto','scroll'].includes(getComputedStyle(scroll).overflowY)))scroll=scroll.parentElement;
    if(scroll)scroll.scrollTop+=anchor.getBoundingClientRect().bottom-portal.getBoundingClientRect().top;
  } else if(document.documentElement.dataset.fixtureSelectOffset) {
    const trigger=document.querySelector('.MuiSelect-select[aria-expanded="true"]'),paper=document.querySelector('.MuiPopover-paper');
    let scroll=trigger?.parentElement;
    while(scroll&&!(scroll.scrollHeight>scroll.clientHeight&&['auto','scroll'].includes(getComputedStyle(scroll).overflowY)))scroll=scroll.parentElement;
    if(scroll&&paper)scroll.scrollTop+=trigger.getBoundingClientRect().top-paper.getBoundingClientRect().top-Number(document.documentElement.dataset.fixtureSelectOffset);
  } else if(document.documentElement.dataset.fixtureView)document.querySelector(document.documentElement.dataset.fixtureView)?.scrollIntoView({block:'center'});
})();
