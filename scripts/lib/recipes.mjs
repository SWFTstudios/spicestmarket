/**
 * Recipe pages, recipe index and the "Recipes" mega menu.
 * Markup reuses Webflow classes for the frame (wood panel, shelf heading, button-5)
 * and `ssm-*` classes (src/styles/enhance.css) for everything new.
 */
import { formatQty, formatUnit } from '../../src/js/lib/quantity.js';

const SITE = 'https://spicestmarket.elombe.workers.dev';
const HEAT = ['No heat', 'Mild', 'Medium', 'Hot'];

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const packOf = (data, id) => data.packs.find((p) => p.id === id);
const recipesIn = (data, packId) =>
  data.recipes.filter((r) => r.pack === packId || (r.alsoIn || []).includes(packId));

function minutes(m) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} hr ${rest} min` : `${h} hr`;
}

const chili = (on) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" class="${on ? 'is-on' : ''}"><path d="M14.5 3.2c.9-.6 2.2-.4 2.8.5.3.4.3.9.2 1.4 1.7.5 3 2.1 3 4 0 5.3-6.3 11.7-14 11.7-1.4 0-2.6-.8-3.1-2-.4-1 .3-2 1.3-2.2 4.5-.8 7.7-3.9 8.7-7.6.3-1.2 1.2-2.1 2.4-2.4-.3-.9-.3-1.8.7-3.4z"/></svg>`;

export function heatMeter(level) {
  return `<span class="ssm-heat" data-heat="${level}" title="Heat: ${HEAT[level]}">${[1, 2, 3]
    .map((n) => chili(n <= level))
    .join('')}<span class="ssm-heat__label">${HEAT[level]}</span></span>`;
}

/** Two crossing street-sign plates, the brand's "Meet me by ___ Ave & ___ Blvd" device. */
export function streetSign([ave, blvd], { size = '' } = {}) {
  return `<div class="ssm-sign ${size}" aria-hidden="true">
  <span class="ssm-sign__plate ssm-sign__plate--ave">${esc(ave)} <small>Ave</small></span>
  <span class="ssm-sign__plate ssm-sign__plate--blvd">${esc(blvd)} <small>Blvd</small></span>
  <span class="ssm-sign__pole"></span>
</div>`;
}

function ingredientLine(ing) {
  const qty = formatQty(ing.q);
  const unit = formatUnit(ing.u, ing.q ?? 0);
  const amount = qty
    ? `<span class="ssm-ing__qty" data-q="${ing.q}" data-u="${esc(ing.u)}">${esc(qty)}${unit ? ` ${esc(unit)}` : ''}</span> `
    : '';
  return `${amount}<span class="ssm-ing__item${ing.blend ? ' is-blend' : ''}">${esc(ing.i)}</span>`;
}

/* ---------- Nav mega menu ---------- */

export async function renderNavMenu(data, img) {
  const cols = await Promise.all(
    data.packs.map(async (pack) => {
      const items = await Promise.all(
        recipesIn(data, pack.id).map(
          async (r) => `<li><a class="ssm-mega__link" href="/recipes/${r.slug}/" style="--blend:${r.color}">
  <span class="ssm-mega__tin">${await img(r.tin, { alt: '', sizes: '48px', widths: [160] })}</span>
  <span class="ssm-mega__text"><strong>${esc(r.blend)}</strong><small>${esc(r.title.split(':').pop().trim())}</small></span>
</a></li>`
        )
      );
      return `<div class="ssm-mega__col">
  <p class="ssm-mega__pack">${esc(pack.name)}</p>
  <ul role="list">${items.join('')}</ul>
</div>`;
    })
  );
  return `<div class="ssm-nav-recipes" data-recipes-menu>
  <a href="/recipes/" class="nav-link-small w-nav-link ssm-nav-recipes__link">Recipes</a>
  <button type="button" class="ssm-nav-recipes__toggle" aria-expanded="false" aria-controls="ssm-mega" aria-label="Show recipes by spice blend">
    <svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
  </button>
  <div class="ssm-mega" id="ssm-mega" data-recipes-panel>
    <div class="ssm-mega__grid">${cols.join('')}</div>
    <a class="ssm-mega__all" href="/recipes/">All ${data.recipes.length} recipes <span aria-hidden="true">→</span></a>
  </div>
</div>`;
}

/* ---------- Recipes index ---------- */

export async function renderIndexContent(data, img) {
  const chips = [['all', 'All blends'], ...data.packs.map((p) => [p.id, p.name])]
    .map(
      ([id, label], i) =>
        `<button type="button" class="ssm-chip" data-filter="${id}" aria-pressed="${i === 0}">${esc(label)}</button>`
    )
    .join('');

  const cards = await Promise.all(
    data.recipes.map(async (r) => {
      const packs = [r.pack, ...(r.alsoIn || [])].join(' ');
      const visual = r.photo
        ? await img(r.photo, { alt: r.title, sizes: '(max-width: 767px) 90vw, (max-width: 991px) 45vw, 30vw', className: 'ssm-card__photo', extra: ` style="view-transition-name:r-${r.slug}"` })
        : `<div class="ssm-card__poster" style="--blend:${r.color};view-transition-name:r-${r.slug}">${await img(r.tin, { alt: r.title, sizes: '(max-width: 767px) 90vw, 30vw', className: 'ssm-card__poster-img' })}</div>`;
      return `<li class="ssm-card" data-pack="${packs}" data-search="${esc(`${r.blend} ${r.title} ${r.notes.join(' ')}`.toLowerCase())}" style="--blend:${r.color}">
  <a href="/recipes/${r.slug}/" class="ssm-card__link">
    <div class="ssm-card__media">
      ${visual}
      ${r.photo ? `<span class="ssm-card__tin">${await img(r.tin, { alt: '', sizes: '96px', widths: [480] })}</span>` : ''}
    </div>
    <div class="ssm-card__body">
      <p class="ssm-card__blend">${esc(r.blend)}</p>
      <h3 class="ssm-card__title">${esc(r.title.split(':').pop().trim())}</h3>
      <p class="ssm-card__blurb">${esc(r.blurb)}</p>
      <p class="ssm-card__meta"><span>${minutes(r.prep + r.cook)}</span>${heatMeter(r.heat)}</p>
    </div>
  </a>
</li>`;
    })
  );

  return `<div class="ssm-recipes" data-recipe-index>
  <p class="ssm-recipes__lede">${esc(data.lede)}</p>
  <div class="ssm-recipes__tools">
    <div class="ssm-chips" role="group" aria-label="Filter by spice pack">${chips}</div>
    <label class="ssm-search">
      <span class="visually-hidden">Search recipes</span>
      <input type="search" placeholder="Search a blend, dish or spice…" data-recipe-search autocomplete="off" />
    </label>
  </div>
  <ul class="ssm-grid" role="list" data-recipe-grid>${cards.join('')}</ul>
  <p class="ssm-recipes__empty" data-recipe-empty hidden>Nothing on this block yet. Try another spice.</p>
</div>`;
}

/* ---------- Recipe detail ---------- */

function jsonLd(r, data, imageUrl) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: r.title,
    description: r.blurb,
    image: [SITE + imageUrl],
    author: { '@type': 'Organization', name: 'Spice St. Market' },
    recipeYield: `${r.servings} servings`,
    prepTime: `PT${r.prep}M`,
    cookTime: `PT${r.cook}M`,
    totalTime: `PT${r.prep + r.cook}M`,
    recipeCategory: packOf(data, r.pack).name,
    keywords: [r.blend, r.blendType, ...r.notes].join(', '),
    recipeIngredient: r.ingredients.map((i) =>
      [formatQty(i.q), formatUnit(i.u, i.q ?? 0), i.i].filter(Boolean).join(' ')
    ),
    recipeInstructions: r.steps.map((s, n) => ({ '@type': 'HowToStep', position: n + 1, text: s.t })),
  };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

export async function renderRecipeContent(r, data, img) {
  const pack = packOf(data, r.pack);
  const heroSrc = r.photo || r.tin;
  const hero = r.photo
    ? await img(r.photo, { alt: r.title, sizes: '(max-width: 991px) 92vw, 46vw', eager: true, className: 'ssm-hero__photo' })
    : `<div class="ssm-hero__poster">${await img(r.tin, { alt: `${r.blend} spice blend`, sizes: '(max-width: 991px) 92vw, 46vw', eager: true, className: 'ssm-hero__photo' })}</div>`;

  const others = recipesIn(data, r.pack).filter((x) => x.slug !== r.slug).slice(0, 3);
  const otherCards = await Promise.all(
    others.map(
      async (o) => `<li><a class="ssm-next__card" href="/recipes/${o.slug}/" style="--blend:${o.color}">
  <span class="ssm-next__tin">${await img(o.tin, { alt: '', sizes: '80px', widths: [480] })}</span>
  <span><small>${esc(o.blend)}</small><strong>${esc(o.title.split(':').pop().trim())}</strong></span>
</a></li>`
    )
  );

  const steps = r.steps
    .map(
      (s, n) => `<li class="ssm-step" data-step>
  <button type="button" class="ssm-step__num" data-step-toggle aria-pressed="false" aria-label="Mark step ${n + 1} done">${n + 1}</button>
  <div class="ssm-step__body">
    <p>${esc(s.t)}</p>
    ${s.min ? `<button type="button" class="ssm-timer" data-timer="${s.min}" aria-label="Start a ${s.min} minute timer"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v4l2.5 2M9 2h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span data-timer-label>${s.min} min</span></button>` : ''}
  </div>
</li>`
    )
    .join('');

  const ingredients = r.ingredients
    .map(
      (ing, n) => `<li class="ssm-ing">
  <label><input type="checkbox" data-ing="${n}" /><span class="ssm-ing__box" aria-hidden="true"></span><span class="ssm-ing__text">${ingredientLine(ing)}</span></label>
</li>`
    )
    .join('');

  const html = `<article class="ssm-recipe" data-recipe="${r.slug}" data-servings="${r.servings}" style="--blend:${r.color}">
  <div class="ssm-progress" aria-hidden="true"><span data-progress></span></div>
  <header class="ssm-hero">
    <div class="ssm-hero__copy">
      <nav class="ssm-crumbs" aria-label="Breadcrumb"><a href="/recipes/">Recipes</a><span aria-hidden="true">/</span><a href="/recipes/#${pack.id}">${esc(pack.name)}</a></nav>
      ${streetSign(r.street)}
      <p class="ssm-hero__meet">Meet me by ${esc(r.street[0])} Ave &amp; ${esc(r.street[1])} Blvd</p>
      <h1 class="ssm-hero__title">${esc(r.title)}</h1>
      <p class="ssm-hero__tagline">“${esc(r.tagline)}”</p>
      <p class="ssm-hero__blurb">${esc(r.blurb)}</p>
      <dl class="ssm-facts">
        <div><dt>Prep</dt><dd>${minutes(r.prep)}</dd></div>
        <div><dt>Cook</dt><dd>${r.cook ? minutes(r.cook) : 'No cook'}</dd></div>
        <div><dt>Serves</dt><dd data-servings-label>${r.servings}</dd></div>
        <div><dt>Heat</dt><dd>${heatMeter(r.heat)}</dd></div>
      </dl>
      <div class="ssm-hero__actions">
        <button type="button" class="button-5 ssm-btn-cook" data-cook-mode>Start cook mode</button>
        <a class="button-5 ssm-btn-ghost" href="${esc(pack.amazon)}" target="_blank" rel="noopener" data-sneeze>Get the ${esc(pack.name)} pack</a>
      </div>
    </div>
    <figure class="ssm-hero__media" style="view-transition-name:r-${r.slug}">
      ${hero}
      <button type="button" class="ssm-shaker" data-shaker aria-label="Shake the ${esc(r.blend)} tin">
        <span class="ssm-shaker__frame">${await img(r.tin, { alt: '', sizes: '160px', widths: [480] })}</span>
        <span class="ssm-shaker__hint" aria-hidden="true">Shake me</span>
      </button>
    </figure>
  </header>

  <div class="ssm-body">
    <aside class="ssm-card-ing" aria-labelledby="ing-h">
      <div class="ssm-card-ing__head">
        <h2 id="ing-h">Ingredients</h2>
        <div class="ssm-serves" role="group" aria-label="Servings">
          <button type="button" data-serves="-1" aria-label="Fewer servings">−</button>
          <output data-serves-out aria-live="polite">${r.servings}</output>
          <button type="button" data-serves="1" aria-label="More servings">+</button>
        </div>
      </div>
      <ul class="ssm-ing-list" role="list">${ingredients}</ul>
      <button type="button" class="ssm-reset" data-reset>Clear checks</button>
    </aside>

    <section class="ssm-method" aria-labelledby="method-h">
      <h2 id="method-h">Let's cook</h2>
      <ol class="ssm-steps" role="list">${steps}</ol>
      <aside class="ssm-tip"><p class="ssm-tip__label">Street tip</p><p>${esc(r.tip)}</p></aside>

      <section class="ssm-blend" aria-labelledby="blend-h">
        <div class="ssm-blend__tin"><span class="ssm-blend__frame">${await img(r.tin, { alt: `${r.blend} by Spice St. Market`, sizes: '(max-width: 767px) 40vw, 200px', widths: [480] })}</span></div>
        <div>
          <p class="ssm-blend__eyebrow">The blend</p>
          <h2 id="blend-h">${esc(r.blend)}</h2>
          <p class="ssm-blend__type">${esc(r.blendType)} · from the ${esc(pack.name)} pack</p>
          <ul class="ssm-notes" role="list">${r.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
          <a class="button-5 ssm-btn-buy" href="${esc(pack.amazon)}" target="_blank" rel="noopener" data-sneeze>Buy on Amazon</a>
        </div>
      </section>
    </section>
  </div>

  <section class="ssm-next" aria-labelledby="next-h">
    <h2 id="next-h">Next stop on the block</h2>
    <ul role="list">${otherCards.join('')}</ul>
  </section>

  <div class="ssm-cook" data-cook hidden role="dialog" aria-modal="true" aria-labelledby="cook-title">
    <div class="ssm-cook__bar">
      <p id="cook-title">${esc(r.blend)} · <span data-cook-count></span></p>
      <button type="button" data-cook-close aria-label="Exit cook mode">✕</button>
    </div>
    <div class="ssm-cook__stage" aria-live="polite"><p data-cook-text></p><div data-cook-timer></div></div>
    <div class="ssm-cook__nav">
      <button type="button" class="button-5" data-cook-prev>Back</button>
      <button type="button" class="button-5" data-cook-next>Next step</button>
    </div>
    <p class="ssm-cook__note" data-wake-note></p>
  </div>
</article>
${jsonLd(r, data, heroSrc)}`;

  return { html, heroSrc };
}

export function recipeMeta(r) {
  return {
    title: `${r.title} | Spice St. Market`,
    description: `${r.blurb} A ${r.blend} recipe from Spice St. Market.`,
  };
}

export { SITE };
