#!/usr/bin/env node
/**
 * Optimize images, minify CSS/JS, render multi-page HTML → dist/
 * Assets from Webflow site 665ec1cc5ff6a46b977004bc
 */
import { mkdir, readdir, copyFile, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const { transform } = require('lightningcss');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const ASSET = join(ROOT, 'source/cdn/cdn.prod.website-files.com/665ec1cc5ff6a46b977004bc');
const RECIPE_ASSET = join(ROOT, 'source/cdn/cdn.prod.website-files.com/67210621867751a15a07d46e');

const WIDTHS = [480, 800, 1200, 1600];
const FORCE = process.argv.includes('--clean');
const CACHE_FILE = join(DIST, 'images', '.cache.json');
let CACHE = {};

const IMAGE_JOBS = [
  { file: '67167048265253d733f6004b_Spice_St._Market_Logo_-_White.webp', stem: 'logo', alpha: true, q: 80, widths: [200, 400], dir: ASSET },
  { file: '6769d6baf5303bf5d46e840c_Spice_St_Market_Favicon_32.avif', stem: 'favicon', q: 85, widths: [32], formats: ['png'], dir: ASSET },
  { file: '6769d6bdb8a155442f91f47c_Spice_St_Market_Favicon_256.avif', stem: 'apple-touch-icon', q: 85, widths: [180], formats: ['png'], dir: ASSET },
  { file: '67f6f939c4d7f6148a180f0b_Spice_St._Market_GroupLineUp.JPG', stem: 'group-lineup', q: 68, maxW: 1600, dir: ASSET },
  { file: '67d329c9ce08b77ffbb2a1d2_SpiceSt.Group_01.webp', stem: 'group-01', q: 68, maxW: 1400, dir: ASSET },
  { file: '67d329c88e447d42c4617b65_SpiceSt.Group_02.avif', stem: 'group-02', q: 68, maxW: 1400, dir: ASSET },
  { file: '67d329c8c7f11fceff125f10_SpiceSt.Group_03.avif', stem: 'group-03', q: 68, maxW: 1400, dir: ASSET },
  { file: '67d329c90aa85c11705a4d77_SpiceSt.Group_04.webp', stem: 'group-04', q: 68, maxW: 1400, dir: ASSET },
  { file: '67d329c9f450ad383aba7392_SpiceSt.Group_05.webp', stem: 'group-05', q: 68, maxW: 1400, dir: ASSET },
  { file: '67d329c85a80528e52f581e1_SpiceSt.Group_06.avif', stem: 'group-06', q: 68, maxW: 1400, dir: ASSET },
  { file: '67d329c9058b637f4fcf48ac_SpiceSt.Group_07.webp', stem: 'group-07', q: 68, maxW: 1400, dir: ASSET },
  { file: '67f6f9dc1524581c012da74f_47617_L_01.webp', stem: 'spice-47617', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e3aa6da1fc5f84c31e_46784_L_01.webp', stem: 'spice-46784', q: 70, maxW: 800, dir: ASSET },
  { file: '67d2fb3bbbbd0fc321f3b5a6_47623_L_01.avif', stem: 'spice-47623', q: 70, maxW: 800, dir: ASSET },
  { file: '67d2fb3bbbbd0fc321f3b5b6_46786_L_01.avif', stem: 'spice-46786', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e11d5972d3de52bfd1_46791_L_01.webp', stem: 'spice-46791', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e883449644104529bc_46780_L_01.webp', stem: 'spice-46780', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e5d0b3c627aa0ee63d_46781_L_01.webp', stem: 'spice-46781', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e53f3d164c3cf44510_46782_L_01.webp', stem: 'spice-46782', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9dcdd4b17d13b07da62_47620_L_01.webp', stem: 'spice-47620', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e32b224112babfa6ba_46783_L_01.webp', stem: 'spice-46783', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e3769feacc57bf0848_46785_L_01.webp', stem: 'spice-46785', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e29ba9dcc51559ba64_46787_L_01.webp', stem: 'spice-46787', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e108f1bac4d1d59bf1_46789_L_01.webp', stem: 'spice-46789', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9e1e7a62f40717d1452_46790_L_01.webp', stem: 'spice-46790', q: 70, maxW: 800, dir: ASSET },
  { file: '67f6f9df08f1bac4d1d59a99_46792_L_01.webp', stem: 'spice-46792', q: 70, maxW: 800, dir: ASSET },
  { file: '67d2fb3bbbbd0fc321f3b551_46794_L_01.avif', stem: 'spice-46794', q: 70, maxW: 800, dir: ASSET },
  { file: '67f7e578adf8d8fde4928329_SpiceSt_TacoNight_Stills_17.webp', stem: 'still-taco-17', q: 68, maxW: 1200, dir: ASSET },
  { file: '67f5869f0ebd57b3da45119b_SpiceSt_TacoNight_Stills_21.webp', stem: 'still-taco-21', q: 68, maxW: 1200, dir: ASSET },
  { file: '67f7e5782a6dd515d5aee9b7_SpiceSt_TacoNight_Stills_22.webp', stem: 'still-taco-22', q: 68, maxW: 1200, dir: ASSET },
  { file: '67f5869c35077b982de40755_SpiceSt_TacoNight_Stills_23.webp', stem: 'still-taco-23', q: 68, maxW: 1200, dir: ASSET },
  { file: '67f7e57b807e0d2b48e7a0ff_SpiceSt_TacoNight_Stills_24.webp', stem: 'still-taco-24', q: 68, maxW: 1200, dir: ASSET },
  { file: '6824dbdc4c596521eda0cab6_spice-st-about-us-bg-image.webp', stem: 'about-bg', q: 70, maxW: 1600, dir: ASSET },
  { file: '67605b601ab2752b5baff0c2_spice_st_mkt_bg_v1.avif', stem: 'market-bg', q: 68, maxW: 1600, dir: ASSET },
  {
    file: '67f6f939c4d7f6148a180f0b_Spice_St._Market_GroupLineUp.JPG',
    stem: 'og',
    q: 82,
    widths: [1200],
    formats: ['jpg', 'webp'],
    og: { width: 1200, height: 630 },
    dir: ASSET,
  },
  { file: '67858834802ff1d2c5e92316_Garlic_and_Parsley_Blend_Roasted_Vegetables.png', stem: 'recipe-garlic', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '6785891d333de4224552ea06_Hot_Chili_Seasoning_Soup.png', stem: 'recipe-chili', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '6785892bbcf87cd722aac7b0_Basil_Citrus_Blend_Dressing.png', stem: 'recipe-basil', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '67858c42c13103f742a020cd_Savory_Bagel_Blend_Cream_Cheese.png', stem: 'recipe-bagel', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '67858cb281e253c62c083946_Taco_Seasoning_Chicken_Tacos.png', stem: 'recipe-taco', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '67858cc030a63e3bb6f0775e_Chipotle_Seasoning_Black_Beans.png', stem: 'recipe-chipotle', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '67858cd217e2cf03421fda98_Tuscan_Seasoning_Pasta.png', stem: 'recipe-tuscan', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '67858ce4bfe33c09fa224895_Greek_Herb_Salad_Dressing.png', stem: 'recipe-greek', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '67858cf8b730a7ac79c8e29a_Everything_Seasoning_Bagels.png', stem: 'recipe-everything', q: 68, maxW: 1000, dir: RECIPE_ASSET },
  { file: '67858d06e3e723fb53ce1e6c_Adobo_Seco_Chicken.png', stem: 'recipe-adobo', q: 68, maxW: 1000, dir: RECIPE_ASSET },
];

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function isFresh(out, inputMtime) {
  try {
    return (await stat(out)).mtimeMs >= inputMtime;
  } catch {
    return false;
  }
}

function picture(stem, alt, { widths = [480, 800, 1200], sizes = '100vw', className = '', eager = false } = {}) {
  const wlist = widths;
  const srcset = (fmt) => wlist.map((w) => `/images/${stem}-${w}.${fmt} ${w}w`).join(', ');
  const fallback = `/images/${stem}-${wlist[Math.min(1, wlist.length - 1)]}.webp`;
  return `<picture class="${className}">
  <source type="image/avif" srcset="${srcset('avif')}" sizes="${sizes}" />
  <source type="image/webp" srcset="${srcset('webp')}" sizes="${sizes}" />
  <img src="${fallback}" alt="${alt}" sizes="${sizes}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'} />
</picture>`;
}

async function processImage(job) {
  const input = join(job.dir || ASSET, job.file);
  const outDir = join(DIST, 'images');
  await ensureDir(outDir);
  const meta = await sharp(input).metadata();
  const widths = (job.widths || WIDTHS).filter((w) => w <= (job.maxW || 2400) && w <= (meta.width || 9999));
  if (!widths.length) widths.push(Math.min(meta.width || 800, job.maxW || 1600));
  const formats = job.formats || ['avif', 'webp'];
  const results = [];
  const inputMtime = (await stat(input)).mtimeMs;
  const signature = JSON.stringify({ file: job.file, stem: job.stem, q: job.q, widths, formats, og: job.og });
  const settingsChanged = job.stem in CACHE && CACHE[job.stem] !== signature;
  CACHE[job.stem] = signature;

  for (const w of widths) {
    let pipeline = sharp(input);
    if (job.og) {
      pipeline = pipeline.resize({ width: job.og.width, height: job.og.height, fit: 'cover', position: 'centre' });
    } else {
      pipeline = pipeline.resize({ width: w, withoutEnlargement: true });
    }
    for (const fmt of formats) {
      const out = join(outDir, `${job.stem}-${w}.${fmt}`);
      if (!FORCE && !settingsChanged && (await isFresh(out, inputMtime))) {
        results.push({ file: out, bytes: (await stat(out)).size, cached: true });
        continue;
      }
      let p = pipeline.clone();
      if (fmt === 'avif') p = p.avif({ quality: job.q || 65, effort: 4 });
      else if (fmt === 'webp') p = p.webp({ quality: job.q || 68, alphaQuality: job.alpha ? 70 : 100, effort: 4 });
      else if (fmt === 'jpg' || fmt === 'jpeg') p = p.jpeg({ quality: job.q || 82, mozjpeg: true });
      else if (fmt === 'png') p = p.png({ compressionLevel: 9 });
      await p.toFile(out);
      results.push({ file: out, bytes: (await stat(out)).size });
    }
  }
  return { stem: job.stem, width: job.og?.width || meta.width, height: job.og?.height || meta.height, results };
}

async function buildCss() {
  const css = await readFile(join(SRC, 'styles/main.css'), 'utf8');
  const { code } = transform({ filename: 'main.css', code: Buffer.from(css), minify: true, sourceMap: false });
  await ensureDir(join(DIST, 'css'));
  await writeFile(join(DIST, 'css/main.css'), code);
  return code.length;
}

async function buildJs() {
  await ensureDir(join(DIST, 'js'));
  await esbuild.build({
    entryPoints: [join(SRC, 'js/main.js')],
    outfile: join(DIST, 'js/main.js'),
    bundle: true,
    minify: true,
    target: ['es2020'],
    format: 'iife',
  });
  return (await stat(join(DIST, 'js/main.js'))).size;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nav(active) {
  const links = [
    ['/', 'Home'],
    ['/about/', 'About'],
    ['/recipes/', 'Recipes'],
    ['/gallery/', 'Gallery'],
    ['/contact/', 'Contact'],
  ];
  return links
    .map(([href, label]) => {
      const cur = active === label.toLowerCase() ? ' aria-current="page"' : '';
      return `<li><a href="${href}"${cur}>${label}</a></li>`;
    })
    .join('\n');
}

function layout({ title, description, path, active, body, og = '/images/og-1200.jpg' }) {
  const url = `https://spicestmarket.elombe.workers.dev${path}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${og}" />
  <meta property="og:url" content="${url}" />
  <link rel="icon" href="/images/favicon-32.png" type="image/png" />
  <link rel="apple-touch-icon" href="/images/apple-touch-icon-180.png" />
  <link rel="preload" href="/fonts/quatro-slab.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/chinook.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/css/main.css" />
</head>
<body data-page="${escapeHtml(active)}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="cursor-dot" data-cursor hidden></div>
  <header class="site-header" data-nav>
    <a class="brand-logo" href="/" aria-label="Spice St Market home">
      <img src="/images/logo-400.webp" width="64" height="64" alt="" />
      <span>Spice St Market</span>
    </a>
    <button class="nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-menu" aria-label="Menu">
      <span></span>
    </button>
    <ul class="nav-menu" id="site-menu" data-nav-menu>
      ${nav(active)}
      <li><a class="nav-cta" href="https://www.amazon.com/s?k=Spice+St.+Market" target="_blank" rel="noopener">Shop Amazon</a></li>
    </ul>
  </header>
  <main id="main">
    ${body}
  </main>
  <footer class="site-footer">
    <div class="site-footer__inner">
      <div class="site-footer__top">
        <div>
          <h2>Join the family</h2>
          <p>Get updated on the freshest spice blends and recipes.</p>
          <form class="newsletter" action="#" method="post" data-newsletter>
            <label class="visually-hidden" for="email-${active}">Email</label>
            <input id="email-${active}" name="email" type="email" required placeholder="you@email.com" autocomplete="email" />
            <button class="btn btn--light" type="submit">Join</button>
          </form>
        </div>
        <ul class="footer-nav">
          ${nav(active)}
        </ul>
      </div>
      <div class="site-footer__bottom">
        <span>© ${new Date().getFullYear()} Spice St. Market. All rights reserved.</span>
        <span>If you ain't sneezin, you ain't seasonin</span>
      </div>
    </div>
  </footer>
  <script src="/js/main.js" defer></script>
</body>
</html>`;
}

function renderPackTabs(packs) {
  const tabs = packs.packs
    .map(
      (p, i) =>
        `<button class="tabs__tab" role="tab" id="tab-${p.id}" aria-controls="panel-${p.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-pack-tab="${p.id}">${escapeHtml(p.name)}</button>`
    )
    .join('\n');

  const panels = packs.packs
    .map((p, i) => {
      const cards = p.spices
        .map(
          (s) => `<article class="pack-card" data-pack-card>
  ${picture(s.stem, s.name, { widths: [480, 800], sizes: '(max-width:560px) 45vw, 12rem' })}
  <h3>${escapeHtml(s.name)}</h3>
</article>`
        )
        .join('\n');
      return `<div class="tabs__panel" role="tabpanel" id="panel-${p.id}" aria-labelledby="tab-${p.id}" data-pack-panel="${p.id}" ${i === 0 ? '' : 'hidden'}>
  <div class="pack-grid" data-pack-grid>${cards}</div>
  <div class="pack-meta">
    <h3>${escapeHtml(p.name)}</h3>
    <p>${escapeHtml(p.short)}</p>
  </div>
  <div class="pack-actions">
    <a class="btn btn--light" href="${escapeHtml(p.amazon)}" target="_blank" rel="noopener" data-magnetic>Buy this pack on Amazon</a>
  </div>
</div>`;
    })
    .join('\n');

  return `<div class="tabs" data-pack-tabs>
  <div class="tabs__list" role="tablist" aria-label="Spice packs">${tabs}</div>
  ${panels}
</div>`;
}

function renderHome(packs, gallery) {
  const sceneSpices = packs.packs[0].spices;
  const tins = sceneSpices
    .map(
      (s, i) => `<figure class="spice-tin" data-spice-tin style="--i:${i}">
  ${picture(s.stem, s.name, { widths: [480, 800], sizes: '12rem' })}
  <figcaption class="spice-tin__label">${escapeHtml(s.name)}</figcaption>
</figure>`
    )
    .join('\n');

  return `
<section class="hero" data-hero>
  <div class="hero__bg" data-hero-bg>
    ${picture('group-lineup', 'Spice St Market spice pack lineup', { widths: [800, 1200, 1600], sizes: '100vw', eager: true })}
  </div>
  <div class="hero__veil"></div>
  <canvas class="hero__particles" data-particles aria-hidden="true"></canvas>
  <div class="hero__content">
    <p class="hero__eyebrow">Spice St Market</p>
    <h1 class="hero__title" data-hero-title>
      <span class="line"><span>Add flavor to</span></span>
      <span class="line"><span>the everyday</span></span>
    </h1>
    <p class="hero__lede">Unique spice blends for young adults who want to spice up their food. Shop our packs on Amazon.</p>
    <div class="cta-row">
      <a class="btn btn--primary" href="${escapeHtml(packs.packs[0].amazon)}" target="_blank" rel="noopener" data-magnetic>Shop on Amazon</a>
      <a class="btn btn--ghost" href="#spice-rack" data-magnetic>Explore the market</a>
    </div>
  </div>
</section>

<div class="marquee" data-marquee aria-hidden="true">
  <div class="marquee__track" data-marquee-track>
    ${Array.from({ length: 8 }, () => `<span>${escapeHtml(packs.tagline)} •</span>`).join('')}
  </div>
</div>

<section class="spice-scene" data-spice-scene>
  <div class="spice-scene__stage" data-spice-stage>
    ${tins}
  </div>
  <div class="spice-scene__copy">
    <h2>Spice up your life</h2>
  </div>
</section>

<section class="section section--rack" id="spice-rack">
  <div class="rack-sign">
    <p class="section__eyebrow">Our spice packs</p>
    <h2>Le Spice Rack</h2>
  </div>
  ${renderPackTabs(packs)}
</section>

<section class="section">
  <div class="section__inner">
    <p class="section__eyebrow" data-reveal>Shop with us</p>
    <h2 class="section__title" data-reveal>A spice blend for every meal</h2>
    <p class="section__lede" data-reveal>We aim to make “what’s for dinner?” have an exciting, easy answer. So let’s set the table and dig in, together.</p>
    <div class="card-grid">
      ${gallery.items
        .slice(0, 3)
        .map(
          (g) => `<article class="card" data-reveal>
  <figure>${picture(g.stem, g.alt, { widths: [480, 800, 1200], sizes: '(max-width:800px) 90vw, 22rem' })}</figure>
  <h3>${escapeHtml(g.alt.split(' ').slice(0, 3).join(' '))}</h3>
</article>`
        )
        .join('\n')}
    </div>
    <div class="cta-row" style="margin-top:2rem">
      <a class="btn btn--dark" href="/gallery/" data-magnetic>See our Spice Gallery</a>
      <a class="btn btn--primary" href="/recipes/" data-magnetic>Cook with us</a>
    </div>
  </div>
</section>

<section class="section section--dark">
  <div class="section__inner split">
    <div>
      <p class="section__eyebrow" data-reveal>Heard the word on the St?</p>
      <h2 class="section__title" data-reveal>Join the party</h2>
      <p class="section__lede" data-reveal>Join our community and get Michelin-star-worthy recipes sent directly to your inbox every week.</p>
      <a class="btn btn--light" href="/about/" data-magnetic data-reveal>About us</a>
    </div>
    <figure data-reveal>
      ${picture('still-taco-24', 'Taco night with Spice St Market blends', { widths: [800, 1200], sizes: '(max-width:800px) 90vw, 36rem' })}
    </figure>
  </div>
</section>`;
}

function renderAbout() {
  return `
<header class="page-hero">
  <p class="section__eyebrow">About us</p>
  <h1>Anyone can cook</h1>
  <p>Spice St Market is a spice blend brand for young adults who want unique flavor without the boring weeknight routine. We sell our packs on Amazon — bodega energy, chef-level seasoning.</p>
</header>
<section class="section">
  <div class="section__inner split">
    <figure data-reveal>
      ${picture('about-bg', 'Cooking with Spice St Market', { widths: [800, 1200, 1600], sizes: '(max-width:800px) 90vw, 40rem', eager: true })}
    </figure>
    <div>
      <h2 class="section__title" data-reveal>If you ain't sneezin, you ain't seasonin</h2>
      <p data-reveal>Each blend is built to enhance the natural goodness of ingredients you already love — roasted potatoes, grill nights, taco tables, and everything in between.</p>
      <p data-reveal>We keep it street-smart and table-ready: three packs, fifteen spices, one mission — spice up your life.</p>
      <div class="cta-row" style="margin-top:1.5rem">
        <a class="btn btn--primary" href="https://www.amazon.com/s?k=Spice+St.+Market" target="_blank" rel="noopener" data-magnetic>Shop on Amazon</a>
      </div>
    </div>
  </div>
</section>`;
}

function renderRecipes(recipes) {
  const cards = recipes.items
    .map(
      (r) => `<article class="card" data-reveal>
  <figure>${picture(r.stem, r.title, { widths: [480, 800, 1000], sizes: '(max-width:800px) 90vw, 20rem' })}</figure>
  <h3>${escapeHtml(r.title)}</h3>
  <p>${escapeHtml(r.blurb)}</p>
</article>`
    )
    .join('\n');
  return `
<header class="page-hero">
  <p class="section__eyebrow">Recipes</p>
  <h1>${escapeHtml(recipes.headline)}</h1>
  <p>${escapeHtml(recipes.lede)}</p>
</header>
<section class="section">
  <div class="section__inner card-grid">${cards}</div>
</section>`;
}

function renderGallery(gallery) {
  const items = gallery.items
    .map(
      (g, i) => `<button class="gallery-item" type="button" data-gallery-item data-full="/images/${g.stem}-1200.webp" data-index="${i}" aria-label="Open ${escapeHtml(g.alt)}">
  ${picture(g.stem, g.alt, { widths: [480, 800, 1200], sizes: '(max-width:700px) 90vw, 30vw' })}
</button>`
    )
    .join('\n');
  return `
<header class="page-hero">
  <p class="section__eyebrow">Gallery</p>
  <h1>${escapeHtml(gallery.headline)}</h1>
  <p>${escapeHtml(gallery.lede)}</p>
</header>
<section class="section">
  <div class="section__inner">
    <div class="gallery-grid">${items}</div>
  </div>
</section>
<dialog class="lightbox" data-lightbox>
  <div class="lightbox__frame">
    <img data-lightbox-img alt="" />
    <div class="lightbox__bar">
      <span data-lightbox-caption></span>
      <div class="lightbox__controls">
        <button type="button" data-lightbox-prev>Prev</button>
        <button type="button" data-lightbox-next>Next</button>
        <button type="button" data-lightbox-close>Close</button>
      </div>
    </div>
  </div>
</dialog>`;
}

function renderContact() {
  return `
<header class="page-hero">
  <p class="section__eyebrow">Contact</p>
  <h1>Join the party</h1>
  <p>Questions, collabs, or bodega-worthy recipe tips — say hey.</p>
</header>
<section class="section">
  <div class="section__inner split">
    <form class="form" action="#" method="post" data-contact>
      <label>Name<input name="name" required autocomplete="name" /></label>
      <label>Email<input name="email" type="email" required autocomplete="email" /></label>
      <label>Message<textarea name="message" required></textarea></label>
      <button class="btn btn--primary" type="submit" data-magnetic>Send it</button>
      <p data-form-status hidden></p>
    </form>
    <div>
      <h2 class="section__title">Shop our packs</h2>
      <p>Familiar Favorites, Neighborhood Cook-Out, and Around the World — live on Amazon.</p>
      <a class="btn btn--dark" href="https://www.amazon.com/s?k=Spice+St.+Market" target="_blank" rel="noopener" data-magnetic>Browse Amazon</a>
    </div>
  </div>
</section>`;
}

async function writePages() {
  const packs = JSON.parse(await readFile(join(SRC, 'data/packs.json'), 'utf8'));
  const recipes = JSON.parse(await readFile(join(SRC, 'data/recipes.json'), 'utf8'));
  const gallery = JSON.parse(await readFile(join(SRC, 'data/gallery.json'), 'utf8'));

  const pages = [
    { file: 'index.html', path: '/', active: 'home', title: "Spice St. Market — If you ain't sneezin, you ain't seasonin", description: 'Unique spice blends for young adults. Shop Familiar Favorites, Neighborhood Cook-Out, and Around the World on Amazon.', body: renderHome(packs, gallery) },
    { file: 'about/index.html', path: '/about/', active: 'about', title: 'About — Spice St. Market', description: 'Anyone can cook. Spice St Market brings unique blends to everyday meals.', body: renderAbout() },
    { file: 'recipes/index.html', path: '/recipes/', active: 'recipes', title: 'Recipes — Spice St. Market', description: recipes.lede, body: renderRecipes(recipes) },
    { file: 'gallery/index.html', path: '/gallery/', active: 'gallery', title: 'Gallery — Spice St. Market', description: gallery.lede, body: renderGallery(gallery) },
    { file: 'contact/index.html', path: '/contact/', active: 'contact', title: 'Contact — Spice St. Market', description: 'Join the Spice St Market party.', body: renderContact() },
    {
      file: '404.html',
      path: '/404',
      active: 'home',
      title: 'Not found — Spice St. Market',
      description: 'Page not found.',
      body: `<header class="page-hero"><h1>Lost the seasoning?</h1><p>This page isn’t on the shelf.</p><a class="btn btn--primary" href="/">Back home</a></header>`,
    },
  ];

  for (const p of pages) {
    const out = join(DIST, p.file);
    await ensureDir(dirname(out));
    await writeFile(out, layout(p));
    console.log(`  ✓ ${p.file}`);
  }
}

async function copyFonts() {
  await ensureDir(join(DIST, 'fonts'));
  const fontDir = join(SRC, 'fonts');
  try {
    for (const f of await readdir(fontDir)) {
      await copyFile(join(fontDir, f), join(DIST, 'fonts', f));
    }
  } catch {
    console.warn('No fonts in src/fonts — run npm run fonts');
  }
}

async function writeReport(imageStats, cssBytes, jsBytes) {
  const walk = async (dir, acc = []) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return acc;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p, acc);
      else acc.push({ path: p.replace(DIST + '/', ''), bytes: (await stat(p)).size });
    }
    return acc;
  };
  const files = await walk(DIST);
  const total = files.reduce((s, f) => s + f.bytes, 0);
  let baseline = null;
  try {
    baseline = JSON.parse(await readFile(join(ROOT, 'source/baseline.json'), 'utf8'));
  } catch {}
  const report = {
    builtAt: new Date().toISOString(),
    siteId: '665ec1cc5ff6a46b977004bc',
    distBytes: total,
    distMB: +(total / (1024 * 1024)).toFixed(2),
    fileCount: files.length,
    cssBytes,
    jsBytes,
    baselineMB: baseline?.totalMB ?? null,
    largest: files.sort((a, b) => b.bytes - a.bytes).slice(0, 15),
    images: imageStats.map((i) => ({ stem: i.stem, variants: i.results.length, bytes: i.results.reduce((s, r) => s + r.bytes, 0) })),
  };
  await writeFile(join(DIST, 'build-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nDist: ${report.fileCount} files, ${report.distMB} MB`);
}

async function main() {
  console.log('Building dist/…');
  if (FORCE) await rm(DIST, { recursive: true, force: true });
  else {
    for (const entry of await readdir(DIST).catch(() => [])) {
      if (entry !== 'images') await rm(join(DIST, entry), { recursive: true, force: true });
    }
  }
  await ensureDir(join(DIST, 'images'));
  if (!FORCE) CACHE = JSON.parse(await readFile(CACHE_FILE, 'utf8').catch(() => '{}'));

  console.log('Optimizing images…');
  const imageStats = [];
  for (const job of IMAGE_JOBS) {
    try {
      const r = await processImage(job);
      const kb = (r.results.reduce((s, x) => s + x.bytes, 0) / 1024).toFixed(1);
      const cached = r.results.every((x) => x.cached) ? ', cached' : '';
      console.log(`  ✓ ${job.stem} (${r.results.length} variants, ${kb} KB${cached})`);
      imageStats.push(r);
    } catch (err) {
      console.warn(`  ✗ ${job.stem}: ${err.message}`);
    }
  }
  const keep = new Set(imageStats.flatMap((i) => i.results.map((r) => basename(r.file))));
  keep.add('.cache.json');
  for (const f of await readdir(join(DIST, 'images'))) {
    if (!keep.has(f)) await rm(join(DIST, 'images', f));
  }
  await writeFile(CACHE_FILE, JSON.stringify(CACHE, null, 2));

  console.log('Minifying CSS…');
  const cssBytes = await buildCss();
  console.log(`  ✓ ${(cssBytes / 1024).toFixed(1)} KB`);

  console.log('Bundling JS…');
  const jsBytes = await buildJs();
  console.log(`  ✓ ${(jsBytes / 1024).toFixed(1)} KB`);

  console.log('Rendering pages…');
  await writePages();
  await copyFonts();
  await writeReport(imageStats, cssBytes, jsBytes);
  console.log('Done → dist/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
