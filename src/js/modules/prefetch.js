/**
 * Pages already carry Speculation Rules (prefetch on hover in Chromium).
 * Elsewhere, prefetch same-origin pages after a short hover / on touchstart.
 */
export function initPrefetch() {
  if (HTMLScriptElement.supports?.('speculationrules')) return;
  if (navigator.connection?.saveData) return;
  const done = new Set([location.pathname]);
  let timer = 0;

  const prefetch = (a) => {
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || /^\/(cdn|img|assets)\//.test(url.pathname) || done.has(url.pathname)) return;
    done.add(url.pathname);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url.pathname;
    document.head.appendChild(link);
  };

  document.addEventListener('pointerover', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a) return;
    clearTimeout(timer);
    timer = setTimeout(() => prefetch(a), 80);
  });
  document.addEventListener('pointerout', () => clearTimeout(timer));
  document.addEventListener('touchstart', (e) => {
    const a = e.target.closest?.('a[href]');
    if (a) prefetch(a);
  }, { passive: true });
}
