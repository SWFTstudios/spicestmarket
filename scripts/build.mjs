#!/usr/bin/env node
/**
 * Faithful port: rewrite scraped Webflow HTML + copy assets → dist/
 * Site 665ec1cc5ff6a46b977004bc — keep markup, CSS, custom code intact.
 */
import {
  mkdir,
  readdir,
  copyFile,
  readFile,
  writeFile,
  rm,
  stat,
  cp,
} from 'node:fs/promises';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import { createHash } from 'node:crypto';
import { createImagePipeline } from './lib/images.mjs';
import { renderNavMenu, renderIndexContent, renderRecipeContent, recipeMeta, esc, SITE } from './lib/recipes.mjs';

const require = createRequire(import.meta.url);
const { transform } = require('lightningcss');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SOURCE = join(ROOT, 'source');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
const CDN_SRC = join(SOURCE, 'cdn');

const PAGES = [
  { file: 'index.html', out: 'index.html' },
  { file: 'about.html', out: 'about/index.html' },
  { file: 'recipes.html', out: 'recipes/index.html' },
  { file: 'gallery.html', out: 'gallery/index.html' },
  { file: 'shop.html', out: 'shop/index.html' },
  { file: '404.html', out: '404.html' },
];

/** Hosts we rewrite to local /cdn/<host>/... */
const LOCAL_HOSTS = new Set([
  'cdn.prod.website-files.com',
  'd3e54v103j8qbb.cloudfront.net',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'cdn.finsweet.com',
  's3-us-west-2.amazonaws.com',
  'ajax.googleapis.com',
]);

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Map absolute URL → local /cdn/... path if we have the file */
function urlToLocal(url, fileIndex) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!LOCAL_HOSTS.has(u.hostname) && !u.hostname.includes('website-files.com')) {
    return null;
  }
  // Typekit stays remote
  if (u.hostname.includes('typekit.net')) return null;

  let pathPart = u.pathname.replace(/^\//, '');
  if (u.hostname === 'unpkg.com' && (pathPart === 'split-type' || pathPart === 'split-type/')) {
    pathPart = 'split-type.js';
  }

  const safeVariants = [
    pathPart.replace(/%20/g, '_').replace(/%2520/g, '_'),
    pathPart.replace(/%20/g, ' ').replace(/%2520/g, ' '),
  ];
  try {
    const decoded = decodeURIComponent(pathPart);
    safeVariants.push(decoded.replace(/ /g, '_'), decoded);
  } catch {
    /* ignore */
  }

  for (const safe of safeVariants) {
    const c = join(CDN_SRC, u.hostname, safe);
    const key = relative(CDN_SRC, c);
    if (fileIndex.has(key) || fileIndex.has(c)) {
      return '/cdn/' + key.split(/[/\\]/).join('/');
    }
  }

  // Videos are .gitignored (too big for the repo) — keep them on Webflow's CDN
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return null;

  // Fall back: scrape layout uses underscores for spaces
  const fallback = pathPart.replace(/%20/g, '_').replace(/%2520/g, '_');
  if (u.hostname.includes('website-files.com') || LOCAL_HOSTS.has(u.hostname)) {
    return '/cdn/' + u.hostname + '/' + fallback;
  }
  return null;
}

async function buildFileIndex() {
  const index = new Set();
  async function walk(dir) {
    if (!(await pathExists(dir))) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        index.add(relative(CDN_SRC, full));
        index.add(full);
      }
    }
  }
  await walk(CDN_SRC);
  return index;
}

function rewriteHtml(html, fileIndex) {
  // Absolute http(s) URLs in href/src
  html = html.replace(
    /(href|src)=["'](https?:\/\/[^"']+)["']/gi,
    (match, attr, url) => {
      // Keep Typekit + Google Fonts CSS/API remote
      if (
        url.includes('typekit.net') ||
        url.includes('fonts.googleapis.com') ||
        url.includes('fonts.gstatic.com') ||
        url.includes('googletagmanager.com') ||
        url.includes('google-analytics.com')
      ) {
        return match;
      }
      const local = urlToLocal(url, fileIndex);
      if (local) return `${attr}="${local}"`;
      return match;
    }
  );

  // srcset
  html = html.replace(/srcset=["']([^"']+)["']/gi, (match, value) => {
    const parts = value.split(',').map((part) => {
      const trimmed = part.trim();
      const [u, ...rest] = trimmed.split(/\s+/);
      if (!u?.startsWith('http')) return trimmed;
      const local = urlToLocal(u, fileIndex);
      if (!local) return trimmed;
      return [local, ...rest].join(' ');
    });
    return `srcset="${parts.join(', ')}"`;
  });

  // url() in inline styles
  html = html.replace(/url\(["']?(https?:\/\/[^"')]+)["']?\)/gi, (match, url) => {
    if (url.includes('typekit.net') || url.includes('fonts.gstatic.com')) return match;
    const local = urlToLocal(url, fileIndex);
    return local ? `url("${local}")` : match;
  });

  // Internal site links: keep as relative clean paths
  html = html.replace(
    /href=["']https?:\/\/spicest\.webflow\.io(\/[^"']*)["']/gi,
    (_, path) => `href="${path || '/'}"`
  );
  html = html.replace(
    /href=["']https?:\/\/(?:www\.)?spicestmarket\.com(\/[^"']*)["']/gi,
    (_, path) => `href="${path || '/'}"`
  );

  // Drop Webflow "Made in Webflow" badge if present
  html = html.replace(
    /<a[^>]*href=["'][^"']*webflow\.com\/[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    (m) => (/badge|Made in Webflow/i.test(m) ? '' : m)
  );
  html = html.replace(
    /<script[^>]*>[\s\S]*?webflow\.com\/badge[\s\S]*?<\/script>/gi,
    ''
  );

  // Prefetching amazon.com / instagram.com on every page view only burns bandwidth
  html = html.replace(/<link rel="prefetch" href="https?:\/\/(?:www\.)?(?:amazon|instagram)\.com[^"]*"\/?>/gi, '');
  // Swiper 7 loads right after Swiper 8 and is overwritten by Swiper 10 before any
  // `new Swiper()` runs, so it never initializes anything (~130 KB of dead JS)
  html = html.replace(/<script src="[^"]*swiper@7\/swiper-bundle\.min\.js"><\/script>/gi, '');
  // Assets are self-hosted now; the Webflow CDN preconnect is dead weight
  html = html.replace(/<link href="https:\/\/cdn\.prod\.website-files\.com" rel="preconnect"[^>]*>/i, '');

  // Inject enhance CSS + speculation rules in head, enhance JS before </body>
  html = html.replace(
    /<\/head>/i,
    `  <link rel="stylesheet" href="${ENHANCE.css}" />\n${SPECULATION}\n</head>`
  );
  html = html.replace(/<\/body>/i, `  <script src="${ENHANCE.js}" defer></script>\n</body>`);

  return html;
}

function rewriteCss(css, fileIndex, cssFileUrl) {
  return css.replace(/url\(["']?([^"')]+)["']?\)/gi, (match, raw) => {
    const u = raw.trim();
    if (u.startsWith('data:') || u.startsWith('#')) return match;
    let abs = u;
    if (u.startsWith('http')) {
      abs = u;
    } else if (cssFileUrl) {
      try {
        abs = new URL(u, cssFileUrl).href;
      } catch {
        return match;
      }
    } else {
      return match;
    }
    if (abs.includes('typekit.net') || abs.includes('fonts.gstatic.com')) return match;
    const local = urlToLocal(abs, fileIndex);
    return local ? `url("${local}")` : match;
  });
}

let IMAGES;

async function copyCdnTree(fileIndex) {
  const outRoot = join(DIST, 'cdn');
  await ensureDir(outRoot);
  if (!(await pathExists(CDN_SRC))) {
    throw new Error('Missing source/cdn — run npm run scrape first');
  }
  await cp(CDN_SRC, outRoot, { recursive: true });

  // Rewrite url() inside copied CSS files
  async function walkCss(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) await walkCss(full);
      else if (e.name.endsWith('.css')) {
        let css = await readFile(full, 'utf8');
        const rel = relative(join(DIST, 'cdn'), full).split(/[/\\]/).join('/');
        const fakeUrl = 'https://' + rel.replace(/^([^/]+)\//, '$1/');
        // Better: reconstruct original host URL
        const host = rel.split('/')[0];
        const pathAfter = rel.slice(host.length);
        const cssFileUrl = `https://${host}${pathAfter}`;
        css = rewriteCss(css, fileIndex, cssFileUrl);
        css = await IMAGES.rewriteCss(css);
        try {
          const { code } = transform({
            filename: e.name,
            code: Buffer.from(css),
            minify: true,
          });
          await writeFile(full, code);
        } catch {
          await writeFile(full, css);
        }
      }
    }
  }
  await walkCss(outRoot);
}

/** Hashed so /assets/* can be cached for a year. */
const ENHANCE = { js: '', css: '' };
const SPECULATION = `<script type="speculationrules">${JSON.stringify({
  prefetch: [
    {
      source: 'document',
      where: { and: [{ href_matches: '/*' }, { not: { href_matches: ['/cdn/*', '/img/*', '/assets/*'] } }] },
      eagerness: 'moderate',
    },
  ],
})}</script>`;

const contentHash = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 10);

async function buildEnhance() {
  await ensureDir(join(DIST, 'assets'));

  const js = await esbuild.build({
    entryPoints: [join(SRC, 'js/enhance.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    write: false,
    target: ['es2020'],
  });
  const jsCode = js.outputFiles[0].contents;
  ENHANCE.js = `/assets/enhance.${contentHash(jsCode)}.js`;
  await writeFile(join(DIST, ENHANCE.js), jsCode);

  const cssIn = await IMAGES.rewriteCss(await readFile(join(SRC, 'styles/enhance.css'), 'utf8'));
  const { code } = transform({
    filename: 'enhance.css',
    code: Buffer.from(cssIn),
    minify: true,
  });
  ENHANCE.css = `/assets/enhance.${contentHash(code)}.css`;
  await writeFile(join(DIST, ENHANCE.css), code);
  return { js: jsCode.length, css: code.length };
}

async function writeContactRedirect() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=/#footer" />
  <link rel="canonical" href="/#footer" />
  <title>Contact — Spice St. Market</title>
  <script>location.replace("/#footer");</script>
</head>
<body>
  <p><a href="/#footer">Continue to Spice St. Market</a></p>
</body>
</html>`;
  await ensureDir(join(DIST, 'contact'));
  await writeFile(join(DIST, 'contact/index.html'), html);
}

const NAV_RECIPES_LINK = /<a href="\/recipes"[^>]*class="nav-link-small hide w-nav-link[^"]*"[^>]*>[^<]*<\/a>/i;
const RECIPE_SECTION = /<section class="bbb-section-1[\s\S]*?<\/section>/i;

/** Per-page polish applied after URL localization. */
async function finishPage(html, { page, navMenu, active }) {
  html = html.replace(NAV_RECIPES_LINK, active === 'recipes' ? navMenu.replace('ssm-nav-recipes__link"', 'ssm-nav-recipes__link w--current" aria-current="page"') : navMenu);
  html = await IMAGES.rewriteCss(html); // inline style="background-image:url(/cdn/…)" + <style> blocks
  html = await IMAGES.rewriteHtml(html, { page });
  return html;
}

function setHead(html, { title, description, path, image }) {
  const url = SITE + path;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta content="[^"]*" name="description"\/?>/i, '');
  html = html.replace(/<meta content="[^"]*" property="og:(title|description|image|url)"\/?>/gi, '');
  html = html.replace(/<meta content="[^"]*" property="twitter:(title|description|image)"\/?>/gi, '');
  const tags = [
    `<meta name="description" content="${esc(description)}"/>`,
    `<meta property="og:title" content="${esc(title)}"/>`,
    `<meta property="og:description" content="${esc(description)}"/>`,
    `<meta property="og:url" content="${url}"/>`,
    image ? `<meta property="og:image" content="${SITE}${image}"/>` : '',
    `<link rel="canonical" href="${url}"/>`,
  ].join('');
  return html.replace(/<meta charset="utf-8"\/>/i, (m) => m + tags);
}

async function writeRecipes(recipesShell, data, navMenu) {
  const [before, after] = (() => {
    const m = recipesShell.match(RECIPE_SECTION);
    if (!m) throw new Error('recipes.html: could not find the recipe section to replace');
    return [recipesShell.slice(0, m.index), recipesShell.slice(m.index + m[0].length)];
  })();
  const sectionOpen = recipesShell
    .match(RECIPE_SECTION)[0]
    .split('<div class="padding-small">')[0]
    .replace(/ data-w-id="[^"]*" style="opacity:0"/, '');

  // Index
  const index = `${sectionOpen}<div class="padding-small">${await renderIndexContent(data, IMAGES.img)}</div></div></div></div></div></section>`;
  let html = setHead(before + index + after, {
    title: 'Recipes | Spice St. Market',
    description: data.lede,
    path: '/recipes/',
  });
  html = await finishPage(html, { page: 'recipes', navMenu, active: 'recipes' });
  await ensureDir(join(DIST, 'recipes'));
  await writeFile(join(DIST, 'recipes/index.html'), html);
  console.log('  ✓ recipes/index.html');

  // One page per blend
  for (const r of data.recipes) {
    const { html: body, heroSrc } = await renderRecipeContent(r, data, IMAGES.img);
    const meta = recipeMeta(r);
    let page = setHead(before + `<section class="ssm-recipe-section">${body}</section>` + after, {
      ...meta,
      path: `/recipes/${r.slug}/`,
      image: heroSrc,
    });
    page = await finishPage(page, { page: `recipes/${r.slug}`, navMenu, active: 'recipes' });
    await ensureDir(join(DIST, 'recipes', r.slug));
    await writeFile(join(DIST, 'recipes', r.slug, 'index.html'), page);
  }
  console.log(`  ✓ recipes/<blend>/ × ${data.recipes.length}`);
}

async function writeEdgeConfig(data) {
  const redirects = [
    ...Object.entries(data.legacy).map(([from, to]) => `/recipe/${from} /recipes/${to}/ 301`),
    '/recipe/* /recipes/ 301',
    '/recipe /recipes/ 301',
  ];
  await writeFile(join(DIST, '_redirects'), redirects.join('\n') + '\n');
  await writeFile(
    join(DIST, '_headers'),
    `/img/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/cdn/*
  Cache-Control: public, max-age=604800, stale-while-revalidate=86400
`
  );
}

async function main() {
  console.log('Building faithful Webflow port → dist/');
  // Wipe dist but keep nothing — fresh
  await rm(DIST, { recursive: true, force: true });
  await ensureDir(DIST);

  const sizesData = JSON.parse(await readFile(join(SRC, 'data/image-sizes.json'), 'utf8').catch(() => '{}'));
  IMAGES = createImagePipeline({ root: ROOT, cdnSrc: CDN_SRC, dist: DIST, sizesData });
  const recipes = JSON.parse(await readFile(join(SRC, 'data/recipes.json'), 'utf8'));

  const fileIndex = await buildFileIndex();
  console.log(`  Indexed ${fileIndex.size / 2 | 0} CDN files`);

  await copyCdnTree(fileIndex);
  console.log('  Copied /cdn assets (CSS backgrounds → optimized WebP)');

  const enhanceBytes = await buildEnhance();
  console.log(`  Built ${ENHANCE.js} (${(enhanceBytes.js / 1024).toFixed(1)} KB) + ${ENHANCE.css} (${(enhanceBytes.css / 1024).toFixed(1)} KB)`);

  const navMenu = await renderNavMenu(recipes, IMAGES.img);

  for (const page of PAGES) {
    const srcPath = join(SOURCE, page.file);
    if (!(await pathExists(srcPath))) {
      console.warn(`  skip missing ${page.file}`);
      continue;
    }
    let html = await readFile(srcPath, 'utf8');
    html = rewriteHtml(html, fileIndex);
    if (page.file === 'recipes.html') {
      await writeRecipes(html, recipes, navMenu);
      continue;
    }
    html = await finishPage(html, { page: page.file.replace('.html', ''), navMenu });
    const out = join(DIST, page.out);
    await ensureDir(dirname(out));
    await writeFile(out, html);
    console.log(`  ✓ ${page.out}`);
  }

  await writeContactRedirect();
  console.log('  ✓ contact/index.html → /#footer');

  await writeEdgeConfig(recipes);
  console.log('  ✓ _redirects + _headers');

  const st = IMAGES.stats;
  console.log(
    `  Images: ${st.sources} originals (${(st.inBytes / 1048576).toFixed(1)} MB) → ${st.variants} WebP variants (${(st.outBytes / 1048576).toFixed(1)} MB across all sizes)`
  );
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
