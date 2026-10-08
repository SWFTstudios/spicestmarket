/**
 * Thin enhancement layer — does not replace Webflow custom code.
 * Lenis smooth scroll only; View Transitions come from enhance.css (@view-transition).
 */
import Lenis from 'lenis';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initLenis() {
  if (reduceMotion) return;

  const lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    prevent: (node) =>
      Boolean(
        node?.closest?.(
          '.swiper, .swiper-slide, [carousel="component"], .tinyflow-slider, .w-slider, .carousel'
        )
      ),
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
  window.__spiceLenis = lenis;
}

function boot() {
  initLenis();
  document.documentElement.classList.add('spice-vt');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
