/** Cross-document View Transitions polish (CSS handles wipe; this adds shared names). */
export function initTransitions() {
  if (!document.startViewTransition) return;
  // Ensure navigations within the site opt into VT when supported
  document.documentElement.classList.add('vt-ready');
}
