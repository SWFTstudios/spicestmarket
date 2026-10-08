/**
 * Enhancement layer — sits on top of Webflow custom code, never replaces it.
 *  - Lenis smooth scroll
 *  - Recipes mega menu in the nav
 *  - "Sneeze" spice bursts on Amazon CTAs + the shake-the-tin easter egg
 *  - Recipe tools (servings scaler, checklists, timers, cook mode)
 *  - Recipe index filters
 *  - Hover prefetch fallback where Speculation Rules aren't supported
 */
import Lenis from 'lenis';
import { initRecipesMenu } from './modules/recipes-menu.js';
import { initSneeze } from './modules/sneeze.js';
import { initRecipe } from './modules/recipe.js';
import { initRecipeIndex } from './modules/recipe-index.js';
import { initPrefetch } from './modules/prefetch.js';
import { initReveal } from './modules/reveal.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initLenis() {
  if (reduceMotion) return null;

  const lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    prevent: (node) =>
      Boolean(
        node?.closest?.(
          '.swiper, .swiper-slide, [carousel="component"], .tinyflow-slider, .w-slider, .carousel, .ssm-mega, .ssm-cook'
        )
      ),
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
  window.__spiceLenis = lenis;
  return lenis;
}

function boot() {
  const lenis = initLenis();
  document.documentElement.classList.add('spice-vt');
  const ctx = { reduceMotion, lenis };
  initRecipesMenu(ctx);
  const sneeze = initSneeze(ctx);
  initRecipe({ ...ctx, sneeze });
  initRecipeIndex(ctx);
  initReveal(ctx);
  initPrefetch();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
