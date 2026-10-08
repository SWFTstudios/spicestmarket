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

  // Inject enhance CSS in head + enhance JS before </body>
  if (!html.includes('/css/enhance.css')) {
    html = html.replace(
      /<\/head>/i,
      '  <link rel="stylesheet" href="/css/enhance.css" />\n</head>'
    );
  }
  if (!html.includes('/js/enhance.js')) {
    html = html.replace(
      /<\/body>/i,
      '  <script src="/js/enhance.js" defer></script>\n</body>'
    );
  }

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

async function buildEnhance() {
  await ensureDir(join(DIST, 'js'));
  await ensureDir(join(DIST, 'css'));

  await esbuild.build({
    entryPoints: [join(SRC, 'js/enhance.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    outfile: join(DIST, 'js/enhance.js'),
    target: ['es2020'],
  });

  const cssIn = await readFile(join(SRC, 'styles/enhance.css'));
  const { code } = transform({
    filename: 'enhance.css',
    code: cssIn,
    minify: true,
  });
  await writeFile(join(DIST, 'css/enhance.css'), code);
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

async function main() {
  console.log('Building faithful Webflow port → dist/');
  // Wipe dist but keep nothing — fresh
  await rm(DIST, { recursive: true, force: true });
  await ensureDir(DIST);

  const fileIndex = await buildFileIndex();
  console.log(`  Indexed ${fileIndex.size / 2 | 0} CDN files`);

  await copyCdnTree(fileIndex);
  console.log('  Copied /cdn assets');

  await buildEnhance();
  console.log('  Built enhance.js + enhance.css');

  for (const page of PAGES) {
    const srcPath = join(SOURCE, page.file);
    if (!(await pathExists(srcPath))) {
      console.warn(`  skip missing ${page.file}`);
      continue;
    }
    let html = await readFile(srcPath, 'utf8');
    html = rewriteHtml(html, fileIndex);
    const out = join(DIST, page.out);
    await ensureDir(dirname(out));
    await writeFile(out, html);
    console.log(`  ✓ ${page.out}`);
  }

  await writeContactRedirect();
  console.log('  ✓ contact/index.html → /#footer');

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
